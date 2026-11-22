// Shared constants for Gilt & Gone: the playfield geometry, the cast's speeds and senses,
// and the prices of the tools. Everything the other modules agree on lives here.

export const TILE = 32;
export const COLS = 32;
export const ROWS = 20;
export const FIELD_WIDTH = COLS * TILE; // 1024
export const FIELD_HEIGHT = ROWS * TILE; // 640
export const HUD_HEIGHT = 64;
export const CANVAS_WIDTH = FIELD_WIDTH;
export const CANVAS_HEIGHT = FIELD_HEIGHT + HUD_HEIGHT;

export const STEP = 1 / 60;

export const THIEF = {
  radius: 11,
  walkSpeed: 152,
  sprintSpeed: 238,
  sneakSpeed: 84,
  hearingRadius: 92, // sprinting inside this ring of a guard is heard
};

export const GUARD = {
  radius: 11,
  patrolSpeed: 74,
  chaseSpeed: 118,
  investigateSpeed: 96,
  coneLength: 158,
  coneHalfAngle: 0.56, // radians, about 32 degrees
  spotSeconds: 0.5, // standing in a cone this long raises the alarm
  tackleDistance: 24,
  pauseSeconds: 0.9,
  scanRadians: 0.7,
};

export const CAMERA = {
  coneLength: 128,
  coneHalfAngle: 0.46,
  spotSeconds: 0.9,
};

export const ALARM_MAX = 100;
export const ALARM_FROM_GUARD = 30;
export const ALARM_FROM_CAMERA = 22;
export const ALARM_FROM_LASER = 30;
export const ALARM_DECAY_PER_SECOND = 1.1;

export const TOOLS = {
  emp: { key: 'KeyE', cost: 500, radius: 190, disableSeconds: 6 },
  smoke: { key: 'KeyQ', cost: 300, hideSeconds: 4 },
  coin: { cost: 100, lureRadius: 230, lureSeconds: 3.2 },
};

export const LOOT_VALUES = { cash: 400, gold: 750, gem: 2500 };
export const GHOST_BONUS = 1000; // per level, when the alarm never reaches 50
export const TIME_BONUS_PER_SECOND = 15;
