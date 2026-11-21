// Pebble distract — the lure: throw a pebble and a guard goes to listen.
// One quiet tool against five lanterns. A pebble lands, rings, and every
// guard close enough to hear it walks over to check the spot, giving Wren
// the seconds to slip past the cone. Pebbles are scarce: five per wing.
import { PEBBLE } from './config.js';
import { STATE_SEARCH, STATE_ALERT } from './guard-patrols.js';
import { playPebbleTink } from './sound-footsteps.js';

/** Throw a pebble from the player toward (tx, ty), inside throwing range. */
export function throwPebble(state, tx, ty) {
  if (state.screen !== 'play' || state.pebblesLeft <= 0) return false;
  const dx = tx - state.player.x;
  const dy = ty - state.player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return false;
  const reach = Math.min(dist, PEBBLE.range);
  const lx = state.player.x + (dx / dist) * reach;
  const ly = state.player.y + (dy / dist) * reach;
  state.pebblesLeft -= 1;
  state.thrownPebbles.push({ x: lx, y: ly, age: 0 });
  playPebbleTink();
  // Every guard in earshot goes to listen at the landing spot.
  for (let i = 0; i < state.guards.length; i += 1) {
    const guard = state.guards[i];
    if (guard.state === STATE_ALERT) continue;
    if (Math.hypot(guard.x - lx, guard.y - ly) < PEBBLE.hearRadius) {
      guard.lastSeen = { x: lx, y: ly };
      guard.state = STATE_SEARCH;
      guard.stateTimer = PEBBLE.searchSeconds;
      guard.awareness = Math.max(guard.awareness, 0.3);
    }
  }
  return true;
}

/** Age thrown pebbles; the ring fades and the stone is spent. */
export function updatePebbles(state, dt) {
  for (let i = state.thrownPebbles.length - 1; i >= 0; i -= 1) {
    state.thrownPebbles[i].age += dt;
    if (state.thrownPebbles[i].age > 6) state.thrownPebbles.splice(i, 1);
  }
}

/** Draw each landed pebble: a stone, and a ring guards can hear. */
export function drawPebbles(ctx, pebbles) {
  for (let i = 0; i < pebbles.length; i += 1) {
    const p = pebbles[i];
    const fade = Math.max(0, 1 - p.age / 6);
    ctx.strokeStyle = `rgba(200, 210, 230, ${0.7 * fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10 + p.age * 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c8d2e6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
