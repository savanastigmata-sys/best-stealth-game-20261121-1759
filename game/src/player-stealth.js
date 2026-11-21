// Player stealth — Wren, the shadow courier: walk, sneak or run.
// Sneaking is slow and nearly silent and hard to spot; running is fast and
// loud and easy to spot. Every footstep makes a noise ring guards can hear,
// and the ring is drawn so the player can see how loud they are being.
import { PLAYER } from './config.js';
import { moveWithCollision, plantAt } from './level-gallery.js';

export function createPlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: -Math.PI / 2,
    sneaking: false,
    running: false,
    moving: false,
    noiseRadius: 0,
    noisePulse: 0,
    hiddenInPlant: false,
    relicsTaken: 0,
    stepsTaken: 0,
  };
}

/** Move the player one frame from held keys; returns nothing, mutates player. */
export function updatePlayer(level, player, keys, dt) {
  let dx = 0;
  let dy = 0;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  player.sneaking = !!keys.sneak;
  player.running = !!keys.run && !player.sneaking;
  player.moving = dx !== 0 || dy !== 0;
  if (!player.moving) {
    player.noiseRadius = 0;
    return;
  }
  const len = Math.hypot(dx, dy);
  dx /= len;
  dy /= len;
  const speed = player.running ? PLAYER.runSpeed : player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const moved = moveWithCollision(level, player.x, player.y, PLAYER.radius, dx * speed * dt, dy * speed * dt);
  const actuallyMoved = Math.hypot(moved.x - player.x, moved.y - player.y);
  if (actuallyMoved > 0.01) {
    player.facing = Math.atan2(dy, dx);
    player.stepsTaken += actuallyMoved;
  }
  player.x = moved.x;
  player.y = moved.y;
  player.hiddenInPlant = plantAt(level, player.x, player.y) !== null;
  player.noiseRadius = footstepNoiseRadius(player);
  player.noisePulse += dt * (player.running ? 9 : 5);
}

/** How far this step is heard: sneak < walk < run. */
export function footstepNoiseRadius(player) {
  if (!player.moving) return 0;
  if (player.running) return PLAYER.noiseRun;
  if (player.sneaking) return PLAYER.noiseSneak;
  return PLAYER.noiseWalk;
}

/** True when the player stands on a relic's pedestal and can take it. */
export function relicInReach(level, player) {
  for (let i = 0; i < level.relics.length; i += 1) {
    const relic = level.relics[i];
    if (relic.taken) continue;
    if (Math.hypot(relic.x - player.x, relic.y - player.y) < 34) return relic;
  }
  return null;
}

/** True when the player stands in the exit doorway. */
export function playerAtExit(level, player) {
  const e = level.exit;
  return player.x >= e.x && player.x <= e.x + e.w && player.y >= e.y && player.y <= e.y + e.h;
}

/** True once every relic in the gallery has been taken. */
export function allRelicsTaken(level) {
  for (let i = 0; i < level.relics.length; i += 1) {
    if (!level.relics[i].taken) return false;
  }
  return true;
}
