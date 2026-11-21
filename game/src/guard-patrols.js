// Guard patrols — five guards, each walking a route the player can learn.
// States: patrol (walk the route, pause and look around at each stop),
// suspicious (heard or glimpsed something: turn and look), alert (saw the
// player: chase), search (lost the player: check the last seen spot), then
// back to patrol. Awareness is the meter that drives the changes.
import { GUARD, STEP } from './config.js';
import { moveWithCollision } from './level-gallery.js';
import { guardSeesPlayer, detectionRate } from './vision-cones.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_ALERT = 'alert';
export const STATE_SEARCH = 'search';

export function createGuard(spawn) {
  const first = spawn.route[0];
  return {
    name: spawn.name,
    color: spawn.color,
    route: spawn.route,
    routeIndex: 1,
    x: first.x,
    y: first.y,
    facing: 0,
    state: STATE_PATROL,
    awareness: 0,
    waitTimer: 0,
    stateTimer: 0,
    lastSeen: null,
    heardAt: null,
    stepPhase: spawn.route.length * 1.7,
  };
}

function moveToward(level, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const moved = moveWithCollision(level, guard.x, guard.y, GUARD.radius, nx - guard.x, ny - guard.y);
  guard.facing = Math.atan2(moved.y - guard.y, moved.x - guard.x);
  if (moved.x === guard.x && moved.y === guard.y) return true;
  guard.x = moved.x;
  guard.y = moved.y;
  return dist - step < 2;
}

/** One guard, one frame: see, grow suspicious, and act on its state. */
export function updateGuard(level, guard, player, dt, events) {
  const clarity = guardSeesPlayer(level, guard, player);
  if (clarity > 0) {
    guard.awareness = Math.min(1, guard.awareness + detectionRate(level, guard, player, clarity) * dt);
    guard.lastSeen = { x: player.x, y: player.y };
  } else {
    guard.awareness = Math.max(0, guard.awareness - GUARD.awarenessFall * dt);
  }

  if (guard.awareness >= 1 && guard.state !== STATE_ALERT) {
    guard.state = STATE_ALERT;
    guard.stateTimer = GUARD.chaseSeconds;
    events.push({ type: 'alarm', guard: guard.name });
  } else if (guard.state === STATE_ALERT && guard.awareness < GUARD.alarmedAt) {
    guard.state = STATE_SEARCH;
    guard.stateTimer = GUARD.searchSeconds;
  } else if (guard.state === STATE_PATROL && guard.awareness >= GUARD.suspiciousAt) {
    // A glimpse is enough: stop, turn, and look hard at where you saw it.
    guard.state = STATE_SUSPICIOUS;
    guard.stateTimer = 2.5;
  } else if (guard.state === STATE_SUSPICIOUS && guard.awareness < 0.12) {
    guard.state = STATE_PATROL;
    guard.heardAt = null;
  }

  if (guard.state === STATE_PATROL) {
    updateGuardPatrol(level, guard, dt, events);
  } else if (guard.state === STATE_SUSPICIOUS) {
    updateGuardSuspicious(level, guard, player, dt);
  } else if (guard.state === STATE_ALERT) {
    updateGuardAlert(level, guard, player, dt, events);
  } else {
    updateGuardSearch(level, guard, dt);
  }

  // A footstep heard nearby turns a patrolling guard suspicious.
  if (guard.state === STATE_PATROL && player.noiseRadius > 0) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (dist < player.noiseRadius) {
      guard.state = STATE_SUSPICIOUS;
      guard.stateTimer = 1.6;
      guard.heardAt = { x: player.x, y: player.y };
      events.push({ type: 'heard', guard: guard.name });
    }
  }
  guard.stepPhase += dt * (guard.state === STATE_ALERT ? 11 : 7);
}

function updateGuardPatrol(level, guard, dt, events) {
  if (guard.waitTimer > 0) {
    guard.waitTimer -= dt;
    // Look around while waiting at a waypoint: a patrol you can learn.
    guard.facing += Math.sin(guard.waitTimer * 2.2) * 0.012;
    return;
  }
  const target = guard.route[guard.routeIndex];
  const speed = GUARD.patrolSpeed * (level.patrolSpeedMul || 1);
  if (moveToward(level, guard, target.x, target.y, speed, dt)) {
    guard.routeIndex = (guard.routeIndex + 1) % guard.route.length;
    guard.waitTimer = 1.2;
    events.push({ type: 'waypoint', guard: guard.name });
  }
}

function updateGuardSuspicious(level, guard, player, dt) {
  guard.stateTimer -= dt;
  const lookAt = guard.heardAt || guard.lastSeen || player;
  guard.facing = Math.atan2(lookAt.y - guard.y, lookAt.x - guard.x);
  // Nearly sure: walk toward the spot to check it.
  if (guard.awareness >= GUARD.alarmedAt && guard.lastSeen) {
    moveToward(level, guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed * (level.patrolSpeedMul || 1), dt);
  }
  if (guard.stateTimer <= 0 && guard.awareness < GUARD.suspiciousAt) {
    guard.state = STATE_PATROL;
    guard.heardAt = null;
  }
}

function updateGuardAlert(level, guard, player, dt, events) {
  guard.stateTimer -= dt;
  moveToward(level, guard, player.x, player.y, GUARD.chaseSpeed * (level.patrolSpeedMul || 1), dt);
  if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchRadius) {
    events.push({ type: 'caught', guard: guard.name });
  }
  if (guard.stateTimer <= 0 && guard.awareness < 1) {
    guard.state = STATE_SEARCH;
    guard.stateTimer = GUARD.searchSeconds;
  }
}

function updateGuardSearch(level, guard, dt) {
  guard.stateTimer -= dt;
  const target = guard.lastSeen || guard.route[guard.routeIndex];
  if (moveToward(level, guard, target.x, target.y, GUARD.searchSpeed * (level.patrolSpeedMul || 1), dt)) {
    guard.facing += 0.03;
  }
  if (guard.stateTimer <= 0) {
    guard.state = STATE_PATROL;
    guard.lastSeen = null;
  }
}

/** The highest awareness among all guards: the game's detection meter. */
export function highestAwareness(guards) {
  let top = 0;
  for (let i = 0; i < guards.length; i += 1) {
    if (guards[i].awareness > top) top = guards[i].awareness;
  }
  return top;
}

/** True when any guard is actively chasing the player. */
export function anyGuardAlert(guards) {
  for (let i = 0; i < guards.length; i += 1) {
    if (guards[i].state === STATE_ALERT) return true;
  }
  return false;
}
