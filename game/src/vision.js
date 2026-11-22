// Sight and hearing geometry: which tiles block a view, whether a point sits inside a
// vision cone, and whether the straight line between two points crosses cover.

import { TILE } from './config.js';

const BLOCKING = new Set(['#', 'x', '+', 'C']);

export function tileBlocksSight(grid, col, row) {
  if (row < 0 || row >= grid.length || col < 0 || col >= grid[row].length) return true;
  return BLOCKING.has(grid[row][col]);
}

export function angleDifference(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function turnToward(angle, target, maxTurn) {
  const diff = angleDifference(angle, target);
  if (Math.abs(diff) <= maxTurn) return target;
  return angle + Math.sign(diff) * maxTurn;
}

/** True when nothing sight-blocking stands between the two points (sampled every few pixels). */
export function lineOfSight(grid, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + dx * (i / steps);
    const y = y1 + dy * (i / steps);
    if (tileBlocksSight(grid, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/**
 * Whether (px, py) is inside the cone cast from (ox, oy) facing `angle`, and how deep:
 * returns 0 when outside, otherwise the fraction of the cone length remaining (1 at the eye).
 */
export function coneCoverage(grid, ox, oy, angle, halfAngle, length, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const distance = Math.hypot(dx, dy);
  if (distance > length || distance < 1) return 0;
  const diff = Math.abs(angleDifference(angle, Math.atan2(dy, dx)));
  if (diff > halfAngle) return 0;
  if (!lineOfSight(grid, ox, oy, px, py)) return 0;
  return 1 - distance / length;
}

/** Shortest distance from a point to a segment, for laser trip checks. */
export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
