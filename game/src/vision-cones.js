// Vision cones — the heart of the stealth: what a guard can actually see.
// A guard sees the player only when all three hold: the player is inside the
// lantern cone's range and angle, and the straight line between them crosses
// no wall or plinth. Cover works because it breaks the line of sight.
import { GUARD, DETECTION } from './config.js';
import { solidRects, plantAt, inLamplight } from './level-gallery.js';

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does the segment (x1,y1)-(x2,y2) cross any solid rectangle? */
export function lineBlockedBySolids(level, x1, y1, x2, y2) {
  const solids = solidRects(level);
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, solids[i])) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  // Trivial reject: both ends on one side of the rectangle.
  if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return false;
  if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return false;
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  return (
    segmentsCross(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
    segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
    segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
    segmentsCross(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y)
  );
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = side(dx, dy, ax, ay, bx, by);
  const d2 = side(dx, dy, cx, cy, bx, by);
  const d3 = side(ax, ay, cx, cy, dx, dy);
  const d4 = side(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function side(px, py, ax, ay, bx, by) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/**
 * How clearly a guard sees the player right now, 0 (unseen) to 1 (dead centre,
 * close, in lamplight). 0 when the player is outside the cone or behind cover.
 */
export function guardSeesPlayer(level, guard, player) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.sightRange) return 0;
  const angleToPlayer = Math.atan2(dy, dx);
  const offAngle = Math.abs(angleDifference(angleToPlayer, guard.facing));
  if (offAngle > GUARD.sightHalfAngle) return 0;
  if (lineBlockedBySolids(level, guard.x, guard.y, player.x, player.y)) return 0;
  // Dead centre of the cone and close up: seen at once. Edge and far: slow.
  const centre = 1 - offAngle / GUARD.sightHalfAngle;
  const closeness = 1 - dist / GUARD.sightRange;
  let clarity = 0.35 + 0.65 * centre * (0.4 + 0.6 * closeness);
  if (dist < DETECTION.closeRange) clarity = Math.max(clarity, 0.9);
  return clarity;
}

/**
 * How fast this guard's awareness rises while it sees the player.
 * Sneaking, shadow and ferns slow it down; running and lamplight speed it up.
 */
export function detectionRate(level, guard, player, clarity) {
  if (clarity <= 0) return 0;
  let rate = GUARD.awarenessRise * clarity;
  if (player.sneaking) rate *= DETECTION.sneakMultiplier;
  if (player.running) rate *= DETECTION.runMultiplier;
  if (plantAt(level, player.x, player.y)) rate *= DETECTION.plantMultiplier;
  else if (inLamplight(level, player.x, player.y)) rate *= DETECTION.lightMultiplier;
  else rate *= DETECTION.shadowMultiplier;
  return rate;
}

/** The polygon of a guard's vision cone, clipped by walls, for drawing. */
export function computeVisionCone(level, guard) {
  const range = GUARD.sightRange;
  const steps = 24;
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= steps; i += 1) {
    const a = guard.facing - GUARD.sightHalfAngle + (2 * GUARD.sightHalfAngle * i) / steps;
    const hit = castSightRay(level, guard.x, guard.y, a, range);
    points.push(hit);
  }
  return points;
}

function castSightRay(level, x, y, angle, range) {
  const solids = solidRects(level);
  let best = range;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    const t = rayHitsRect(x, y, dx, dy, r);
    if (t !== null && t < best) best = t;
  }
  return { x: x + dx * best, y: y + dy * best };
}

function rayHitsRect(x, y, dx, dy, r) {
  let tmin = 0;
  let tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (x < r.x || x > r.x + r.w) return null;
  } else {
    let t1 = (r.x - x) / dx;
    let t2 = (r.x + r.w - x) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y < r.y || y > r.y + r.h) return null;
  } else {
    let t1 = (r.y - y) / dy;
    let t2 = (r.y + r.h - y) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
