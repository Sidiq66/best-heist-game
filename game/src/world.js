// The heist simulation: the thief, the guards and their suspicion, the sweeping cameras,
// the blinking lasers, the alarm, the loot and the way out. Pure state and fixed rules —
// rendering and input live elsewhere, so this file can be stepped headlessly.

import {
  ALARM_DECAY_PER_SECOND, ALARM_FROM_CAMERA, ALARM_FROM_GUARD, ALARM_FROM_LASER, ALARM_MAX,
  CAMERA, GHOST_BONUS, GUARD, LOOT_VALUES, THIEF, TILE, TIME_BONUS_PER_SECOND, TOOLS,
} from './config.js';
import { LEVELS } from './levels.js';
import { angleDifference, coneCoverage, lineOfSight, pointToSegmentDistance, turnToward } from './vision.js';

const SOLID = new Set(['#', 'x', '+', 'C']);
const tileCenter = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

export function isSolidAt(state, x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (row < 0 || row >= state.grid.length || col < 0 || col >= state.grid[row].length) return true;
  return SOLID.has(state.grid[row][col]);
}

function circleHitsWall(state, x, y, radius) {
  const c0 = Math.floor((x - radius) / TILE), c1 = Math.floor((x + radius) / TILE);
  const r0 = Math.floor((y - radius) / TILE), r1 = Math.floor((y + radius) / TILE);
  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      if (!isSolidAt(state, col * TILE + 1, row * TILE + 1)) continue;
      const nearX = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const nearY = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      if (Math.hypot(x - nearX, y - nearY) < radius) return true;
    }
  }
  return false;
}

function moveCircle(state, entity, dx, dy, radius) {
  if (dx !== 0 && !circleHitsWall(state, entity.x + dx, entity.y, radius)) entity.x += dx;
  if (dy !== 0 && !circleHitsWall(state, entity.x, entity.y + dy, radius)) entity.y += dy;
}

export function createWorld(levelIndex) {
  const def = LEVELS[levelIndex];
  const grid = def.map;
  const state = {
    levelIndex,
    def,
    grid,
    time: 0,
    status: 'playing',
    caughtReason: '',
    player: { x: 0, y: 0, angle: 0, moving: false, mode: 'walk', grabT: 0 },
    guards: [],
    cameras: [],
    lasers: [],
    loots: [],
    exit: { x: 0, y: 0 },
    alarm: 0,
    alarmPeak: 0,
    lastDetectionT: -10,
    timeLeft: def.parSeconds,
    lootTotal: 0,
    lootTaken: 0,
    lootCount: 0,
    hasPrize: false,
    tools: { ...def.tools },
    toolSpend: 0,
    smokeT: 0,
    empCooldownT: 0,
    coinFlight: null,
    lure: null,
    message: '',
    messageT: 0,
    result: null,
    events: [],
  };
  grid.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      const p = tileCenter(c, r);
      if (ch === 'S') { state.player.x = p.x; state.player.y = p.y; }
      if (ch === 'E') state.exit = p;
      if (ch === 'L') state.loots.push({ ...p, kind: 'cash', value: LOOT_VALUES.cash, taken: false, seed: c * 7 + r });
      if (ch === 'g') state.loots.push({ ...p, kind: 'gold', value: LOOT_VALUES.gold, taken: false, seed: c * 7 + r });
      if (ch === 'V') state.loots.push({ ...p, kind: 'gem', value: LOOT_VALUES.gem, taken: false, seed: c * 7 + r });
    });
  });
  state.lootCount = state.loots.length;
  state.guards = def.guards.map((g) => {
    const start = tileCenter(g.path[0][0], g.path[0][1]);
    const next = tileCenter(g.path[1][0], g.path[1][1]);
    return {
      ...start,
      waypoints: g.path.map(([c, r]) => tileCenter(c, r)),
      wpIndex: 1,
      speed: g.speed,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      mode: 'patrol',
      pauseT: 0,
      suspicion: 0,
      alertCooldownT: 0,
      lurePoint: null,
      stuckT: 0,
      lastX: start.x,
      lastY: start.y,
    };
  });
  state.cameras = def.cameras.map((cam) => {
    const p = tileCenter(cam.at[0], cam.at[1]);
    return { ...p, base: (cam.base * Math.PI) / 180, sweep: (cam.sweep * Math.PI) / 180, speed: cam.speed, angle: (cam.base * Math.PI) / 180, charge: 0, disabledT: 0, flashT: 0 };
  });
  state.lasers = def.lasers.map((lz) => {
    const a = tileCenter(lz.a[0], lz.a[1]);
    const b = tileCenter(lz.b[0], lz.b[1]);
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, period: lz.period, duty: lz.duty, phase: lz.phase, cooldownT: 0, disabledT: 0 };
  });
  return state;
}

function announce(state, text) {
  state.message = text;
  state.messageT = 2.4;
}

function raiseAlarm(state, amount, text, event) {
  state.alarm = Math.min(ALARM_MAX, state.alarm + amount);
  state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
  state.lastDetectionT = state.time;
  if (text) announce(state, text);
  if (event) state.events.push(event);
}

function caught(state, reason) {
  if (state.status !== 'playing') return;
  state.status = 'caught';
  state.caughtReason = reason;
  state.events.push('caught');
}

export function laserIsOn(state, laser) {
  if (laser.disabledT > 0) return false;
  const cycle = (state.time + laser.phase) % laser.period;
  return cycle < laser.period * laser.duty;
}

function stepPlayer(state, input, dt) {
  const player = state.player;
  const { x, y } = input.axes;
  const length = Math.hypot(x, y);
  player.mode = input.sneak ? 'sneak' : input.sprint ? 'sprint' : 'walk';
  player.moving = length > 0;
  if (length > 0) {
    const speed = player.mode === 'sprint' ? THIEF.sprintSpeed : player.mode === 'sneak' ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const nx = (x / (length || 1)) * speed * dt;
    const ny = (y / (length || 1)) * speed * dt;
    moveCircle(state, player, nx, ny, THIEF.radius);
    player.angle = Math.atan2(y, x);
  }
  if (input.emp) tryEmp(state);
  if (input.smoke) trySmoke(state);
  if (input.coinAt) throwCoin(state, input.coinAt.x, input.coinAt.y);
}

export function tryEmp(state) {
  if (state.tools.emp <= 0 || state.empCooldownT > 0 || state.status !== 'playing') return;
  state.tools.emp -= 1;
  state.toolSpend += TOOLS.emp.cost;
  state.empCooldownT = 1;
  let hit = 0;
  for (const device of [...state.cameras, ...state.lasers]) {
    const dx = (device.x ?? device.ax) - state.player.x;
    const dy = (device.y ?? device.ay) - state.player.y;
    if (Math.hypot(dx, dy) <= TOOLS.emp.radius) {
      device.disabledT = TOOLS.emp.disableSeconds;
      hit += 1;
    }
  }
  state.events.push('emp');
  announce(state, hit > 0 ? `EMP — ${hit} device${hit === 1 ? '' : 's'} dark for ${TOOLS.emp.disableSeconds}s (−$${TOOLS.emp.cost})` : `EMP wasted (−$${TOOLS.emp.cost})`);
}

export function trySmoke(state) {
  if (state.tools.smoke <= 0 || state.smokeT > 0 || state.status !== 'playing') return;
  state.tools.smoke -= 1;
  state.toolSpend += TOOLS.smoke.cost;
  state.smokeT = TOOLS.smoke.hideSeconds;
  state.events.push('smoke');
  announce(state, `Smoke out — unseen for ${TOOLS.smoke.hideSeconds}s (−$${TOOLS.smoke.cost})`);
}

export function throwCoin(state, tx, ty) {
  if (state.tools.coin <= 0 || state.coinFlight || state.status !== 'playing') return;
  state.tools.coin -= 1;
  state.toolSpend += TOOLS.coin.cost;
  state.coinFlight = { x: state.player.x, y: state.player.y, tx, ty, t: 0, duration: Math.min(0.6, Math.hypot(tx - state.player.x, ty - state.player.y) / 700) };
}

function stepCoin(state, dt) {
  const flight = state.coinFlight;
  if (flight) {
    flight.t += dt;
    if (flight.t >= flight.duration) {
      state.lure = { x: flight.tx, y: flight.ty, t: TOOLS.coin.lureSeconds };
      state.coinFlight = null;
      state.events.push('coin');
      for (const guard of state.guards) {
        if (Math.hypot(guard.x - flight.tx, guard.y - flight.ty) <= TOOLS.coin.lureRadius) {
          guard.mode = 'investigate';
          guard.lurePoint = { x: flight.tx, y: flight.ty };
          guard.stuckT = 0;
        }
      }
    }
  }
  if (state.lure) {
    state.lure.t -= dt;
    if (state.lure.t <= 0) state.lure = null;
  }
}

function guardSeesPlayer(state, guard) {
  if (state.smokeT > 0) return 0;
  return coneCoverage(state.grid, guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneLength, state.player.x, state.player.y);
}

function moveGuardToward(state, guard, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return true;
  const wanted = Math.atan2(dy, dx);
  guard.angle = turnToward(guard.angle, wanted, 3.4 * dt);
  const step = Math.min(distance, speed * dt);
  moveCircle(state, guard, Math.cos(guard.angle) * step, Math.sin(guard.angle) * step, GUARD.radius);
  const moved = Math.hypot(guard.x - guard.lastX, guard.y - guard.lastY);
  guard.stuckT = moved < step * 0.25 ? guard.stuckT + dt : 0;
  guard.lastX = guard.x;
  guard.lastY = guard.y;
  return distance < 10;
}

function nearestWaypoint(guard) {
  let best = 0;
  let bestDistance = Infinity;
  guard.waypoints.forEach((wp, i) => {
    const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
    if (d < bestDistance) { bestDistance = d; best = i; }
  });
  return best;
}

function stepGuard(state, guard, dt) {
  const player = state.player;
  guard.alertCooldownT = Math.max(0, guard.alertCooldownT - dt);

  if (guard.mode === 'patrol') {
    const target = guard.waypoints[guard.wpIndex];
    if (moveGuardToward(state, guard, target, guard.speed, dt)) {
      guard.mode = 'pause';
      guard.pauseT = GUARD.pauseSeconds;
    }
  } else if (guard.mode === 'pause') {
    guard.pauseT -= dt;
    guard.angle += Math.sin(state.time * 1.7 + guard.waypoints.length) * GUARD.scanRadians * dt * 0.6;
    if (guard.pauseT <= 0) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      guard.mode = 'patrol';
    }
  } else if (guard.mode === 'investigate') {
    if (!guard.lurePoint || guard.stuckT > 0.6 || moveGuardToward(state, guard, guard.lurePoint, GUARD.investigateSpeed, dt)) {
      guard.mode = 'lookaround';
      guard.pauseT = 1.2;
    }
  } else if (guard.mode === 'lookaround') {
    guard.pauseT -= dt;
    guard.angle += 1.9 * dt;
    if (guard.pauseT <= 0) { guard.mode = 'return'; guard.wpIndex = nearestWaypoint(guard); }
  } else if (guard.mode === 'return') {
    if (guard.stuckT > 0.6 || moveGuardToward(state, guard, guard.waypoints[guard.wpIndex], guard.speed, dt)) {
      guard.mode = 'pause';
      guard.pauseT = GUARD.pauseSeconds * 0.5;
    }
  }

  const coverage = guardSeesPlayer(state, guard);
  const sneakFactor = player.mode === 'sneak' ? 0.55 : 1;
  if (coverage > 0) {
    guard.suspicion += (dt / GUARD.spotSeconds) * (0.55 + coverage * 0.8) * sneakFactor;
    state.lastDetectionT = state.time;
  } else if (player.mode === 'sprint' && player.moving && Math.hypot(player.x - guard.x, player.y - guard.y) < THIEF.hearingRadius) {
    guard.suspicion += dt * 0.65;
    state.lastDetectionT = state.time;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - dt * 0.7);
  }
  if (guard.suspicion >= 1) {
    guard.suspicion = 0.45;
    guard.angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    if (guard.alertCooldownT <= 0) {
      guard.alertCooldownT = 1.4;
      raiseAlarm(state, ALARM_FROM_GUARD, 'SPOTTED BY A GUARD — ALARM UP', 'spotted');
    }
  }
  if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.tackleDistance) {
    caught(state, 'A guard brought you down in the open.');
  }
}

function stepCamera(state, camera, dt) {
  camera.disabledT = Math.max(0, camera.disabledT - dt);
  camera.flashT = Math.max(0, camera.flashT - dt);
  if (camera.disabledT > 0) { camera.charge = 0; return; }
  camera.angle = camera.base + Math.sin(state.time * camera.speed) * camera.sweep;
  if (state.smokeT > 0) { camera.charge = Math.max(0, camera.charge - dt); return; }
  const coverage = coneCoverage(state.grid, camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneLength, state.player.x, state.player.y);
  if (coverage > 0) {
    camera.charge += dt / CAMERA.spotSeconds;
    state.lastDetectionT = state.time;
    if (camera.charge >= 1) {
      camera.charge = 0.25;
      camera.flashT = 0.5;
      raiseAlarm(state, ALARM_FROM_CAMERA, 'ON CAMERA — ALARM UP', 'spotted');
    }
  } else {
    camera.charge = Math.max(0, camera.charge - dt * 0.8);
  }
}

function stepLaser(state, laser, dt) {
  laser.disabledT = Math.max(0, laser.disabledT - dt);
  laser.cooldownT = Math.max(0, laser.cooldownT - dt);
  if (!laserIsOn(state, laser) || laser.cooldownT > 0) return;
  const distance = pointToSegmentDistance(state.player.x, state.player.y, laser.ax, laser.ay, laser.bx, laser.by);
  if (distance < THIEF.radius + 3) {
    laser.cooldownT = 1.6;
    raiseAlarm(state, ALARM_FROM_LASER, 'LASER TRIPPED — ALARM UP', 'laser');
  }
}

function stepLootAndExit(state) {
  const player = state.player;
  for (const loot of state.loots) {
    if (loot.taken) continue;
    if (Math.hypot(player.x - loot.x, player.y - loot.y) < 17) {
      loot.taken = true;
      state.lootTaken += 1;
      state.lootTotal += loot.value;
      if (loot.kind === 'gem') {
        state.hasPrize = true;
        state.events.push('prize');
        announce(state, `${state.def.prize} SECURED — NOW GET OUT`);
      } else {
        state.events.push('pickup');
      }
    }
  }
  if (Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < 16) {
    if (state.hasPrize) {
      state.status = 'escaped';
      const timeBonus = Math.ceil(state.timeLeft) * TIME_BONUS_PER_SECOND;
      const ghostBonus = state.alarmPeak < 50 ? GHOST_BONUS : 0;
      state.result = {
        loot: state.lootTotal,
        timeBonus,
        ghostBonus,
        toolSpend: state.toolSpend,
        total: Math.max(0, state.lootTotal + timeBonus + ghostBonus - state.toolSpend),
        alarmPeak: Math.round(state.alarmPeak),
        lootTaken: state.lootTaken,
        lootCount: state.lootCount,
      };
      state.events.push('escaped');
    } else if (state.messageT <= 0) {
      announce(state, 'The way out stays shut without the prize.');
    }
  }
}

export function stepWorld(state, input, dt) {
  state.events = [];
  if (state.status !== 'playing') return state;
  state.time += dt;
  state.timeLeft -= dt;
  state.messageT = Math.max(0, state.messageT - dt);
  state.smokeT = Math.max(0, state.smokeT - dt);
  state.empCooldownT = Math.max(0, state.empCooldownT - dt);
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    caught(state, 'Out of time — the vault sealed with you inside.');
    return state;
  }
  stepPlayer(state, input, dt);
  stepCoin(state, dt);
  for (const guard of state.guards) stepGuard(state, guard, dt);
  for (const camera of state.cameras) stepCamera(state, camera, dt);
  for (const laser of state.lasers) stepLaser(state, laser, dt);
  if (state.time - state.lastDetectionT > 2) {
    state.alarm = Math.max(0, state.alarm - ALARM_DECAY_PER_SECOND * dt);
  }
  if (state.alarm >= ALARM_MAX) {
    caught(state, 'The alarm hit full and the vault locked down.');
    return state;
  }
  stepLootAndExit(state);
  return state;
}

/** Line of sight between two pixel points on this state's grid (used by the renderer for cones). */
export function sightLine(state, x1, y1, x2, y2) {
  return lineOfSight(state.grid, x1, y1, x2, y2);
}
