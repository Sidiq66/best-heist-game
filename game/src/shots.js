// The screenshot scenes behind ?shot=cover|alarm|escape|getaway. Each one builds a real
// world from the real level data, then places the cast, the alarm and the clock exactly
// where a tense moment of that heist would put them — the frames are the game's own
// rendering of its own state, staged, never drawn by hand.

import { TILE } from './config.js';
import { SCREEN_PLAY, SCREEN_WIN } from './render.js';
import { createWorld } from './world.js';

const at = (col, row) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 });

function takeLoot(state, kinds) {
  for (const loot of state.loots) {
    if (kinds.includes(loot.kind) && !loot.taken) {
      loot.taken = true;
      state.lootTaken += 1;
      state.lootTotal += loot.value;
      kinds.splice(kinds.indexOf(loot.kind), 1);
    }
  }
}

function stageCover() {
  const state = createWorld(0);
  state.time = 6.3;
  state.player = { ...state.player, ...at(13, 10), angle: 0 };
  state.guards[0] = { ...state.guards[0], ...at(19, 10), angle: Math.PI, suspicion: 0.45 };
  state.guards[1] = { ...state.guards[1], ...at(26, 5), angle: Math.PI / 2 };
  state.cameras[0].angle = state.cameras[0].base + Math.sin(state.time * state.cameras[0].speed) * state.cameras[0].sweep;
  takeLoot(state, ['cash', 'cash']);
  state.alarm = 34;
  state.alarmPeak = 34;
  state.timeLeft = 87;
  state.message = 'Two stacks down. The Star is in the east vault.';
  state.messageT = 2.4;
  return { state, screen: SCREEN_PLAY };
}

function stageAlarm() {
  const state = createWorld(1);
  state.time = 5.0;
  state.player = { ...state.player, ...at(16, 4), angle: -Math.PI / 2 };
  state.guards[2] = { ...state.guards[2], ...at(18, 3), angle: Math.PI * 0.82, suspicion: 0.82 };
  state.guards[0] = { ...state.guards[0], ...at(5, 13), angle: 0 };
  state.cameras.forEach((camera) => {
    camera.angle = camera.base + Math.sin(state.time * camera.speed) * camera.sweep;
  });
  takeLoot(state, ['cash', 'gold', 'cash']);
  state.alarm = 72;
  state.alarmPeak = 72;
  state.timeLeft = 64;
  state.message = 'SPOTTED BY A GUARD — ALARM UP';
  state.messageT = 2.4;
  return { state, screen: SCREEN_PLAY };
}

function stageEscape() {
  const state = createWorld(2);
  state.time = 8.4;
  state.player = { ...state.player, ...at(25, 17), angle: 0 };
  state.guards[0] = { ...state.guards[0], ...at(20, 11), angle: 0.4, suspicion: 0.3 };
  state.guards[2] = { ...state.guards[2], ...at(10, 16), angle: 0 };
  state.cameras.forEach((camera) => {
    camera.angle = camera.base + Math.sin(state.time * camera.speed) * camera.sweep;
  });
  takeLoot(state, ['gem', 'gold', 'cash', 'cash', 'gold']);
  state.hasPrize = true;
  state.alarm = 55;
  state.alarmPeak = 55;
  state.timeLeft = 23;
  state.message = 'THE ORLOV MOON SECURED — NOW GET OUT';
  state.messageT = 2.4;
  return { state, screen: SCREEN_PLAY };
}

function stageGetaway() {
  const perLevel = [
    { loot: 3400, timeBonus: 870, ghostBonus: 1000, toolSpend: 600, total: 4670 },
    { loot: 4150, timeBonus: 645, ghostBonus: 0, toolSpend: 900, total: 3895 },
    { loot: 5650, timeBonus: 345, ghostBonus: 1000, toolSpend: 1100, total: 5895 },
  ];
  const campaign = { perLevel, total: perLevel.reduce((sum, r) => sum + r.total, 0) };
  return { state: createWorld(0), screen: SCREEN_WIN, campaign };
}

export function stageShot(name) {
  if (name === 'alarm') return stageAlarm();
  if (name === 'escape') return stageEscape();
  if (name === 'getaway') return stageGetaway();
  return stageCover();
}
