// Boot and game loop for Gilt & Gone: owns the screens (title, briefing, play, tally,
// busted, getaway), the campaign running total, the fixed-step simulation and the sound
// effects the world's events call for. With ?shot=<name> it stages a screenshot scene
// instead and holds it still.

import { STEP } from './config.js';
import { createInput } from './input.js';
import { sfx } from './audio.js';
import {
  SCREEN_BRIEF, SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TALLY, SCREEN_TITLE, SCREEN_WIN, draw,
} from './render.js';
import { stageShot } from './shots.js';
import { createWorld, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const input = createInput(canvas);

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let campaign = freshCampaign();
let state = createWorld(0);
let screen = SCREEN_TITLE;
let paused = false;
let accumulator = 0;
let lastStamp = performance.now();
let lastTickSecond = -1;

function freshCampaign() {
  return { perLevel: [], total: 0 };
}

const EVENT_SOUNDS = {
  pickup: () => sfx.pickup(),
  prize: () => sfx.prize(),
  spotted: () => sfx.spotted(),
  laser: () => sfx.laser(),
  emp: () => sfx.emp(),
  coin: () => sfx.coin(),
  smoke: () => sfx.smoke(),
  caught: () => sfx.caught(),
  escaped: () => sfx.escaped(),
};

function playEvents(events) {
  for (const name of new Set(events)) {
    if (EVENT_SOUNDS[name]) EVENT_SOUNDS[name]();
  }
}

function startLevel(index) {
  state = createWorld(index);
  screen = SCREEN_BRIEF;
  paused = false;
}

function advanceScreens() {
  const enter = input.tapped('Enter');
  const clicked = input.takeClick();
  if (screen === SCREEN_TITLE && (enter || clicked)) {
    sfx.unlock();
    campaign = freshCampaign();
    startLevel(0);
  } else if (screen === SCREEN_BRIEF && (enter || clicked)) {
    screen = SCREEN_PLAY;
  } else if (screen === SCREEN_TALLY && (enter || clicked)) {
    if (state.levelIndex + 1 < 3) {
      startLevel(state.levelIndex + 1);
    } else {
      screen = SCREEN_WIN;
    }
  } else if (screen === SCREEN_WIN && (enter || clicked)) {
    campaign = freshCampaign();
    state = createWorld(0);
    screen = SCREEN_TITLE;
  }
  if (screen === SCREEN_CAUGHT && input.tapped('KeyR')) {
    state = createWorld(state.levelIndex);
    screen = SCREEN_PLAY;
    paused = false;
  }
  if (screen === SCREEN_PLAY && input.tapped('KeyP')) paused = !paused;
  if (input.tapped('KeyM')) sfx.toggleMute();
}

function readPlayInput() {
  const click = input.takeClick();
  let coinAt = null;
  if (click && click.y > 64) coinAt = { x: click.x, y: click.y - 64 };
  return {
    axes: input.axes(),
    sprint: input.down('ShiftLeft') || input.down('ShiftRight'),
    sneak: input.down('ControlLeft') || input.down('ControlRight') || input.down('KeyC'),
    emp: input.tapped('KeyE'),
    smoke: input.tapped('KeyQ'),
    coinAt,
  };
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  const now = nowMs / 1000;
  if (shotName) {
    draw(ctx, { state, screen, campaign, now: state.time });
    return;
  }
  let elapsed = Math.min(0.1, (nowMs - lastStamp) / 1000);
  lastStamp = nowMs;
  advanceScreens();
  if (screen === SCREEN_PLAY && !paused) {
    accumulator += elapsed;
    const playInput = readPlayInput();
    let firstStep = true;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      stepWorld(state, firstStep ? playInput : { ...playInput, emp: false, smoke: false, coinAt: null }, STEP);
      firstStep = false;
      playEvents(state.events);
      if (state.status === 'caught') { screen = SCREEN_CAUGHT; break; }
      if (state.status === 'escaped') {
        campaign.perLevel[state.levelIndex] = state.result;
        campaign.total = campaign.perLevel.reduce((sum, r) => sum + (r ? r.total : 0), 0);
        screen = SCREEN_TALLY;
        break;
      }
    }
    const tickSecond = Math.ceil(state.timeLeft);
    if (state.alarm > 70 && tickSecond !== lastTickSecond) {
      lastTickSecond = tickSecond;
      sfx.tick();
    }
    statusLine.textContent = `Alarm ${Math.round(state.alarm)} percent. Loot ${state.lootTotal} dollars. ${state.hasPrize ? 'Prize in hand.' : 'Prize still in the vault.'}`;
  }
  draw(ctx, { state, screen, campaign, now });
  if (paused && screen === SCREEN_PLAY) {
    ctx.fillStyle = 'rgba(8,9,13,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e8e4d8';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — P to resume', canvas.width / 2, canvas.height / 2);
  }
  input.endFrame();
  void elapsed;
}

if (shotName) {
  const staged = stageShot(shotName);
  state = staged.state;
  screen = staged.screen;
  if (staged.campaign) campaign = staged.campaign;
}

// A handle for automated play-testing: read the world, never write it from outside.
window.__heist = {
  get state() { return state; },
  get screen() { return screen; },
  get campaign() { return campaign; },
};

requestAnimationFrame(frame);
