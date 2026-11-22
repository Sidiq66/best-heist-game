// Every pixel of Gilt & Gone: the bank floors, the furniture that hides you, the vision
// cones clipped by real sight lines, the cast, the loot, the HUD with its alarm meter,
// and the title / briefing / tally / busted / getaway screens.

import {
  ALARM_MAX, CAMERA, CANVAS_HEIGHT, CANVAS_WIDTH, FIELD_HEIGHT, FIELD_WIDTH, GUARD,
  HUD_HEIGHT, TILE, TOOLS,
} from './config.js';
import { tileBlocksSight } from './vision.js';
import { laserIsOn } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_TALLY = 'tally';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const INK = '#e8e4d8';
const DIM = '#9aa3b2';
const GOLD = '#f2c14e';
const RED = '#e5484d';

function castRay(grid, ox, oy, angle, maxLength) {
  const step = 4;
  let distance = 0;
  while (distance < maxLength) {
    distance += step;
    const x = ox + Math.cos(angle) * distance;
    const y = oy + Math.sin(angle) * distance;
    if (tileBlocksSight(grid, Math.floor(x / TILE), Math.floor(y / TILE))) return { x, y, distance };
  }
  return { x: ox + Math.cos(angle) * maxLength, y: oy + Math.sin(angle) * maxLength, distance: maxLength };
}

function drawCone(ctx, grid, ox, oy, angle, halfAngle, length, fillStyle) {
  const rays = 16;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const end = castRay(grid, ox, oy, a, length);
    ctx.lineTo(end.x, end.y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function drawFloor(ctx, state) {
  const { grid } = state;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      const ch = grid[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#39415a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#4a5878';
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
        continue;
      }
      ctx.fillStyle = (col + row) % 2 === 0 ? '#272c3a' : '#232834';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (ch === 'x') {
        ctx.fillStyle = '#1d3038';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = 'rgba(127,212,230,0.28)';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = GOLD;
        ctx.globalAlpha = 0.55;
        ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
        ctx.globalAlpha = 1;
        if ((col * 3 + row) % 3 === 0) {
          ctx.fillStyle = 'rgba(242,193,78,0.8)';
          ctx.beginPath();
          ctx.moveTo(x + 16, y + 10);
          ctx.lineTo(x + 21, y + 17);
          ctx.lineTo(x + 16, y + 23);
          ctx.lineTo(x + 11, y + 17);
          ctx.closePath();
          ctx.fill();
        }
      }
      if (ch === '+') {
        ctx.fillStyle = '#191d26';
        ctx.fillRect(x + 9, y + 9, 14, 14);
        ctx.fillStyle = RED;
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ch === 'C') {
        ctx.fillStyle = '#2c3140';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = '#59637c';
        ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
      }
      if (ch === 'S') {
        ctx.fillStyle = 'rgba(88,199,123,0.12)';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }
  // The way out: a green-lit door mat, locked until the prize is in hand.
  const exit = state.exit;
  const open = state.hasPrize;
  ctx.fillStyle = open ? 'rgba(64,220,130,0.4)' : 'rgba(64,220,130,0.14)';
  ctx.fillRect(exit.x - 15, exit.y - 15, 30, 30);
  ctx.strokeStyle = open ? '#40dc82' : '#2c7a4b';
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x - 15, exit.y - 15, 30, 30);
  ctx.lineWidth = 1;
  ctx.fillStyle = open ? '#b8ffd2' : '#5da87c';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x, exit.y + 3);
}

function drawLoot(ctx, state, now) {
  for (const loot of state.loots) {
    if (loot.taken) continue;
    const bob = Math.sin(now * 2.4 + loot.seed) * 2;
    if (loot.kind === 'cash') {
      ctx.fillStyle = '#3f9e4d';
      ctx.fillRect(loot.x - 9, loot.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#57c96b';
      ctx.fillRect(loot.x - 9, loot.y - 2 + bob, 18, 4);
      ctx.fillStyle = '#eaffea';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', loot.x, loot.y + 3 + bob);
    } else if (loot.kind === 'gold') {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(loot.x - 10, loot.y + 6 + bob);
      ctx.lineTo(loot.x - 6, loot.y - 5 + bob);
      ctx.lineTo(loot.x + 6, loot.y - 5 + bob);
      ctx.lineTo(loot.x + 10, loot.y + 6 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(loot.x - 5, loot.y - 4 + bob, 10, 3);
    } else {
      // The prize: a tall faceted gem under a pillar of light, named for the camera.
      const pulse = 0.75 + Math.sin(now * 3) * 0.25;
      const grad = ctx.createLinearGradient(loot.x, loot.y - 46, loot.x, loot.y + 12);
      grad.addColorStop(0, 'rgba(150,220,255,0)');
      grad.addColorStop(1, `rgba(150,220,255,${0.22 * pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(loot.x - 13, loot.y - 46, 26, 58);
      ctx.fillStyle = '#8fd8ff';
      ctx.beginPath();
      ctx.moveTo(loot.x, loot.y - 13 + bob);
      ctx.lineTo(loot.x + 10, loot.y - 2 + bob);
      ctx.lineTo(loot.x + 6, loot.y + 11 + bob);
      ctx.lineTo(loot.x - 6, loot.y + 11 + bob);
      ctx.lineTo(loot.x - 10, loot.y - 2 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(loot.x, loot.y - 13 + bob);
      ctx.lineTo(loot.x + 4, loot.y - 2 + bob);
      ctx.lineTo(loot.x, loot.y + 8 + bob);
      ctx.lineTo(loot.x - 4, loot.y - 2 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#cfeaff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.def.prize.toUpperCase(), loot.x, loot.y - 52);
    }
  }
}

function drawLasers(ctx, state, now) {
  for (const laser of state.lasers) {
    const on = laserIsOn(state, laser);
    ctx.strokeStyle = laser.disabledT > 0 ? 'rgba(120,120,120,0.25)' : on ? 'rgba(255,60,70,0.9)' : 'rgba(255,60,70,0.16)';
    ctx.lineWidth = on ? 2.5 : 1.5;
    ctx.setLineDash(on ? [] : [4, 6]);
    ctx.beginPath();
    ctx.moveTo(laser.ax, laser.ay);
    ctx.lineTo(laser.bx, laser.by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    if (on) {
      ctx.fillStyle = `rgba(255,120,120,${0.5 + Math.sin(now * 9) * 0.3})`;
      ctx.beginPath();
      ctx.arc((laser.ax + laser.bx) / 2, (laser.ay + laser.by) / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCamera(ctx, state, camera) {
  if (camera.disabledT <= 0) {
    const chargeColor = camera.charge > 0.05 ? 'rgba(255,90,90,0.20)' : 'rgba(96,200,255,0.15)';
    drawCone(ctx, state.grid, camera.x, camera.y, camera.angle, CAMERA.coneHalfAngle, CAMERA.coneLength, chargeColor);
  }
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.rotate(camera.angle);
  ctx.fillStyle = camera.disabledT > 0 ? '#4a4a4a' : '#20242e';
  ctx.fillRect(-4, -6, 13, 12);
  ctx.fillStyle = camera.flashT > 0 ? '#ff5252' : camera.disabledT > 0 ? '#666' : '#7fd4ff';
  ctx.beginPath();
  ctx.arc(10, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (camera.charge > 0.05 && camera.disabledT <= 0) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 13, -Math.PI / 2, -Math.PI / 2 + camera.charge * Math.PI * 2);
    ctx.stroke();
  }
}

function drawGuard(ctx, state, guard, now) {
  const alert = guard.suspicion > 0.03;
  const coneColor = guard.suspicion > 0.55 ? 'rgba(255,80,60,0.24)' : 'rgba(255,176,64,0.19)';
  drawCone(ctx, state.grid, guard.x, guard.y, guard.angle, GUARD.coneHalfAngle, GUARD.coneLength, coneColor);
  ctx.save();
  ctx.translate(guard.x, guard.y);
  ctx.rotate(guard.angle);
  ctx.fillStyle = '#2c4d8f';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3563';
  ctx.beginPath();
  ctx.arc(0, 0, 11, Math.PI * 0.6, Math.PI * 1.4);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(4.5, 0, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20365f';
  ctx.fillRect(1, -6.4, 7.5, 3.4);
  ctx.restore();
  if (alert) {
    const scale = 0.8 + guard.suspicion * 0.5 + Math.sin(now * 10) * 0.06;
    ctx.fillStyle = guard.suspicion > 0.55 ? RED : GOLD;
    ctx.font = `bold ${Math.round(17 * scale)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(guard.suspicion > 0.55 ? '!' : '?', guard.x, guard.y - 17);
  }
}

function drawThief(ctx, state, now) {
  const player = state.player;
  if (state.coinFlight) {
    const f = state.coinFlight;
    const t = Math.min(1, f.t / f.duration);
    const x = f.x + (f.tx - f.x) * t;
    const y = f.y + (f.ty - f.y) * t - Math.sin(t * Math.PI) * 26;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.lure) {
    ctx.strokeStyle = `rgba(242,193,78,${0.35 + Math.sin(now * 6) * 0.2})`;
    ctx.beginPath();
    ctx.arc(state.lure.x, state.lure.y, 8 + Math.sin(now * 6) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(player.x, player.y);
  if (state.smokeT > 0) {
    ctx.fillStyle = 'rgba(200,205,215,0.35)';
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.arc(Math.sin(now * 2 + i * 2.2) * 9, Math.cos(now * 1.7 + i * 1.9) * 8, 9 - i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.rotate(player.angle);
  ctx.globalAlpha = state.smokeT > 0 ? 0.45 : 1;
  ctx.fillStyle = '#14161d';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a4157';
  ctx.stroke();
  ctx.fillStyle = '#232838';
  ctx.beginPath();
  ctx.arc(-2, 0, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8c39a';
  ctx.fillRect(2.5, -4.6, 6, 9.2);
  ctx.fillStyle = '#14161d';
  ctx.fillRect(2.5, -4.6, 6, 3);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(6.4, -2.6, 1.8, 1.8);
  ctx.fillRect(6.4, 1, 1.8, 1.8);
  if (state.hasPrize) {
    ctx.fillStyle = '#8fd8ff';
    ctx.beginPath();
    ctx.arc(-6, 5, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#101219';
  ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_HEIGHT);
  ctx.fillStyle = 'rgba(242,193,78,0.35)';
  ctx.fillRect(0, HUD_HEIGHT - 2, CANVAS_WIDTH, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(state.def.name, 14, 26);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = state.hasPrize ? '#40dc82' : DIM;
  ctx.fillText(state.hasPrize ? `Prize in hand — GET OUT · Loot $${state.lootTotal}` : `Prize: ${state.def.prize} · Loot $${state.lootTotal}`, 14, 47);

  // The alarm meter: segmented, green through amber to red.
  const meterX = 356;
  const meterW = 300;
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', meterX, 20);
  const segments = 25;
  const filled = Math.round((state.alarm / ALARM_MAX) * segments);
  for (let i = 0; i < segments; i += 1) {
    const frac = i / segments;
    ctx.fillStyle = i < filled ? (frac < 0.45 ? '#58c773' : frac < 0.75 ? '#f2c14e' : '#e5484d') : '#262a36';
    ctx.fillRect(meterX + i * (meterW / segments + 1), 27, meterW / segments - 2, 13);
  }
  ctx.fillStyle = state.alarm > 70 ? RED : INK;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${Math.round(state.alarm)}%`, meterX + meterW + 36, 38);

  ctx.textAlign = 'right';
  ctx.fillStyle = state.timeLeft < 20 ? RED : INK;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(formatTime(state.timeLeft), CANVAS_WIDTH - 14, 27);
  ctx.fillStyle = DIM;
  ctx.font = '11px system-ui, sans-serif';
  const tools = state.tools;
  ctx.fillText(`[E] EMP ×${tools.emp} (−$${TOOLS.emp.cost})   [Q] SMOKE ×${tools.smoke} (−$${TOOLS.smoke.cost})   CLICK coin ×${tools.coin} (−$${TOOLS.coin.cost})`, CANVAS_WIDTH - 14, 47);
}

function drawField(ctx, state, now) {
  ctx.save();
  ctx.translate(0, HUD_HEIGHT);
  drawFloor(ctx, state);
  drawLoot(ctx, state, now);
  drawLasers(ctx, state, now);
  for (const camera of state.cameras) drawCamera(ctx, state, camera);
  for (const guard of state.guards) drawGuard(ctx, state, guard, now);
  drawThief(ctx, state, now);
  // A whisper of darkness at the edges, so the middle of the room feels lit.
  const grad = ctx.createRadialGradient(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_HEIGHT * 0.42, FIELD_WIDTH / 2, FIELD_HEIGHT / 2, FIELD_HEIGHT * 0.86);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  if (state.messageT > 0) {
    ctx.globalAlpha = Math.min(1, state.messageT);
    ctx.fillStyle = 'rgba(10,10,14,0.72)';
    const width = ctx.measureText(state.message).width + 30;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const boxW = Math.max(280, width);
    ctx.fillRect(FIELD_WIDTH / 2 - boxW / 2, 12, boxW, 30);
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(state.message, FIELD_WIDTH / 2, 32);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawHud(ctx, state);
}

function panel(ctx, width, height) {
  ctx.fillStyle = 'rgba(8,9,13,0.82)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#171a23';
  ctx.fillRect(CANVAS_WIDTH / 2 - width / 2, CANVAS_HEIGHT / 2 - height / 2, width, height);
  ctx.strokeStyle = 'rgba(242,193,78,0.6)';
  ctx.strokeRect(CANVAS_WIDTH / 2 - width / 2 + 0.5, CANVAS_HEIGHT / 2 - height / 2 + 0.5, width - 1, height - 1);
  return { x: CANVAS_WIDTH / 2 - width / 2, y: CANVAS_HEIGHT / 2 - height / 2 };
}

function centred(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS_WIDTH / 2, y);
}

function drawTitle(ctx, now) {
  ctx.fillStyle = '#101219';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Two sweeping cones and a gem, as a poster.
  ctx.fillStyle = 'rgba(255,176,64,0.10)';
  ctx.beginPath();
  ctx.moveTo(150, 560);
  ctx.lineTo(420, 210);
  ctx.lineTo(560, 560);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(96,200,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(560, 560);
  ctx.lineTo(830, 230);
  ctx.lineTo(920, 560);
  ctx.closePath();
  ctx.fill();
  const bob = Math.sin(now * 1.6) * 5;
  ctx.fillStyle = '#8fd8ff';
  ctx.beginPath();
  ctx.moveTo(512, 128 + bob);
  ctx.lineTo(548, 168 + bob);
  ctx.lineTo(530, 208 + bob);
  ctx.lineTo(494, 208 + bob);
  ctx.lineTo(476, 168 + bob);
  ctx.closePath();
  ctx.fill();
  centred(ctx, 'GILT & GONE', 300, 'bold 64px system-ui, sans-serif', GOLD);
  centred(ctx, 'a three-vault heist — take the prize, dodge the cones, beat the alarm', 336, '17px system-ui, sans-serif', INK);
  centred(ctx, 'WASD / arrows — move      SHIFT — sprint (loud)      CTRL — sneak (quiet)', 396, '14px system-ui, sans-serif', DIM);
  centred(ctx, 'E — EMP pulse      Q — smoke bomb      CLICK — toss a coin to lure a guard', 422, '14px system-ui, sans-serif', DIM);
  centred(ctx, 'Every tool comes out of your take. Every second in a cone feeds the alarm.', 448, '14px system-ui, sans-serif', DIM);
  centred(ctx, 'ENTER or CLICK — plan the job', 520 + Math.sin(now * 3) * 2, 'bold 18px system-ui, sans-serif', '#40dc82');
}

function drawBriefing(ctx, state) {
  drawField(ctx, state, 0);
  const { x, y } = panel(ctx, 560, 300);
  centred(ctx, state.def.name.toUpperCase(), y + 52, 'bold 24px system-ui, sans-serif', GOLD);
  centred(ctx, `Prize: ${state.def.prize} — $${2500}`, y + 84, '15px system-ui, sans-serif', '#8fd8ff');
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  wrapText(ctx, state.def.briefing, CANVAS_WIDTH / 2, y + 118, 500, 20);
  centred(ctx, `Par time ${formatTime(state.def.parSeconds)} · Guards ${state.guards.length} · Cameras ${state.cameras.length} · Lasers ${state.lasers.length}`, y + 196, '13px system-ui, sans-serif', DIM);
  centred(ctx, `Tools in the bag: EMP ×${state.tools.emp} · Smoke ×${state.tools.smoke} · Coins ×${state.tools.coin}`, y + 222, '13px system-ui, sans-serif', DIM);
  centred(ctx, 'ENTER — go in', y + 264, 'bold 16px system-ui, sans-serif', '#40dc82');
  void x;
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

function money(n) { return `$${n.toLocaleString('en-US')}`; }

function drawTally(ctx, state, campaign) {
  drawField(ctx, state, 0);
  const { y } = panel(ctx, 480, 330);
  centred(ctx, 'CLEAN GETAWAY', y + 50, 'bold 26px system-ui, sans-serif', '#40dc82');
  const r = state.result;
  const lines = [
    ['Loot carried out', money(r.loot)],
    [`Time bonus (${Math.max(0, Math.ceil(state.timeLeft))}s to spare)`, money(r.timeBonus)],
    [r.ghostBonus > 0 ? 'Ghost bonus — alarm never passed 50%' : 'Ghost bonus — alarm ran too hot', money(r.ghostBonus)],
    ['Tools spent', `−${money(r.toolSpend)}`],
    ['This vault', money(r.total)],
    ['Whole night so far', money(campaign.total)],
  ];
  ctx.font = '15px system-ui, sans-serif';
  lines.forEach(([label, value], i) => {
    const yy = y + 92 + i * 30;
    ctx.fillStyle = i >= 4 ? GOLD : INK;
    ctx.font = i >= 4 ? 'bold 16px system-ui, sans-serif' : '15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, CANVAS_WIDTH / 2 - 200, yy);
    ctx.textAlign = 'right';
    ctx.fillText(value, CANVAS_WIDTH / 2 + 200, yy);
  });
  centred(ctx, 'ENTER — next vault', y + 296, 'bold 15px system-ui, sans-serif', '#40dc82');
}

function drawCaught(ctx, state) {
  drawField(ctx, state, 0);
  ctx.fillStyle = 'rgba(120,10,16,0.35)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const { y } = panel(ctx, 500, 240);
  centred(ctx, 'BUSTED', y + 62, 'bold 40px system-ui, sans-serif', RED);
  centred(ctx, state.caughtReason, y + 104, '15px system-ui, sans-serif', INK);
  centred(ctx, `Loot in hand when it ended: ${money(state.lootTotal)} — it stays in the vault.`, y + 134, '13px system-ui, sans-serif', DIM);
  centred(ctx, 'R — try this vault again', y + 190, 'bold 16px system-ui, sans-serif', GOLD);
}

export function rankFor(total) {
  if (total >= 12000) return 'GHOST LEGEND';
  if (total >= 9500) return 'MASTER THIEF';
  if (total >= 7000) return 'PROFESSIONAL';
  if (total >= 4500) return 'CAT BURGLAR';
  return 'SMASH-AND-GRAB';
}

function drawWin(ctx, campaign, now) {
  ctx.fillStyle = '#101219';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  centred(ctx, 'THE FULL HAUL', 150, 'bold 44px system-ui, sans-serif', GOLD);
  centred(ctx, 'All three vaults emptied. The Meridian Trust will never know what hit it.', 186, '15px system-ui, sans-serif', DIM);
  ctx.font = '16px system-ui, sans-serif';
  campaign.perLevel.forEach((r, i) => {
    const yy = 250 + i * 38;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(`Vault ${i + 1} — loot ${money(r.loot)} · time ${money(r.timeBonus)} · ghost ${money(r.ghostBonus)} · tools −${money(r.toolSpend)}`, CANVAS_WIDTH / 2 - 320, yy);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.fillText(money(r.total), CANVAS_WIDTH / 2 + 320, yy);
  });
  centred(ctx, money(campaign.total), 420, 'bold 52px system-ui, sans-serif', '#40dc82');
  centred(ctx, `Rank: ${rankFor(campaign.total)}`, 462, 'bold 19px system-ui, sans-serif', '#8fd8ff');
  centred(ctx, 'ENTER — run the whole night again', 540 + Math.sin(now * 3) * 2, 'bold 16px system-ui, sans-serif', INK);
}

/** Draw the current screen. `view` = { state, screen, campaign, now }. */
export function draw(ctx, view) {
  const { state, screen, campaign, now } = view;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (screen === SCREEN_TITLE) { drawTitle(ctx, now); return; }
  if (screen === SCREEN_WIN) { drawWin(ctx, campaign, now); return; }
  if (screen === SCREEN_BRIEF) { drawBriefing(ctx, state); return; }
  if (screen === SCREEN_TALLY) { drawTally(ctx, state, campaign); return; }
  if (screen === SCREEN_CAUGHT) { drawCaught(ctx, state); return; }
  drawField(ctx, state, now);
}
