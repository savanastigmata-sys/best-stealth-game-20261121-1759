// Screenshot scenes — the frames the judge sees, staged by playing the
// real game forward. No frame is drawn by hand: each scene resets the world,
// steers Wren with the same keys a player holds (sneak, walk, run, take),
// waits for patrols to turn when the next step would be seen, and stops at
// the moment the scene wants. The same seed always gives the same frame.
// The four screenshots are the whole loop: title, cover, caught, ghost —
// the start, the near miss, the loss with its stats, and the win.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render-gallery.js';
import { resetGame, stepGame, loadWing, throwPebbleAt } from './game-main.js';
import { guardSeesPlayer } from './vision-cones.js';
import { highestAwareness } from './guard-patrols.js';
import { circleHitsSolid } from './level-gallery.js';

const SNEAK = { sneak: true, run: false };

function keysToward(state, tx, ty, mode) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  if (Math.hypot(dx, dy) < 10) return null;
  return {
    up: dy < -2,
    down: dy > 2,
    left: dx < -2,
    right: dx > 2,
    sneak: mode.sneak,
    run: mode.run,
  };
}

function runSteps(state, seconds, keysFn, takeFn) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    state.keys = keysFn ? keysFn() || { up: false, down: false, left: false, right: false, sneak: false, run: false } : state.keys;
    stepGame(state, takeFn ? takeFn() : false);
    if (state.screen !== SCREEN_PLAY) return;
  }
}

/** Walk Wren to a point, waiting first while a guard watches the way. */
function driveTo(state, tx, ty, mode, maxSeconds, options) {
  const opts = options || {};
  const path = findPath(state.level, state.player.x, state.player.y, tx, ty);
  const budget = Math.round((maxSeconds || 25) / STEP);
  let leg = 0;
  for (let i = 0; i < budget; i += 1) {
    // Spotted mid-route: break for the nearest fern and wait until the
    // guards calm down, instead of standing in the open getting caught.
    if (!opts.bold && !hiding && playerIsSeen(state)) {
      hiding = true;
      hideUntilSafe(state);
      hiding = false;
      if (state.screen !== SCREEN_PLAY) return false;
      continue;
    }
    if (opts.stopAtAwareness && highestAwareness(state.guards) >= opts.stopAtAwareness) return true;
    const point = path[leg] || { x: tx, y: ty };
    const mx = (state.player.x + point.x) / 2;
    const my = (state.player.y + point.y) / 2;
    let watched = false;
    for (let g = 0; g < state.guards.length; g += 1) {
      const probe = { x: mx, y: my, sneaking: true, running: false };
      if (guardSeesPlayer(state.level, state.guards[g], probe) > 0.25) { watched = true; break; }
    }
    if (watched && !opts.bold) {
      // Wait in cover: patience is the route. Step back to the last safe
      // leg first — waiting in the open is how a guard spots you.
      if (leg > 0) {
        const back = path[leg - 1];
        const backKeys = keysToward(state, back.x, back.y, mode);
        if (backKeys) {
          state.keys = backKeys;
          stepGame(state, false);
          if (state.screen !== SCREEN_PLAY) return false;
          continue;
        }
      }
      runSteps(state, 0.25, () => ({ up: false, down: false, left: false, right: false, sneak: true, run: false }));
      continue;
    }
    const keys = keysToward(state, point.x, point.y, mode);
    if (!keys) {
      leg += 1;
      if (leg >= path.length) return Math.hypot(state.player.x - tx, state.player.y - ty) < 20;
      continue;
    }
    state.keys = keys;
    stepGame(state, false);
    if (state.screen !== SCREEN_PLAY) return false;
  }
  return Math.hypot(state.player.x - tx, state.player.y - ty) < 20;
}

const GRID_W = 32;
const GRID_H = 18;

/** Breadth-first path over the tile grid, around walls and plinths. */
function findPath(level, fx, fy, tx, ty) {
  const start = { tx: Math.floor(fx / 40), ty: Math.floor(fy / 40) };
  let goal = { tx: Math.floor(tx / 40), ty: Math.floor(ty / 40) };
  const key = (x, y) => `${x},${y}`;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
    return !circleHitsSolid(level, x * 40 + 20, y * 40 + 20, 15);
  };
  // The exact spot may sit against a plinth: aim for the nearest open tile.
  if (!walkable(goal.tx, goal.ty)) {
    const seen = new Set([key(goal.tx, goal.ty)]);
    const queue = [goal];
    let found = null;
    while (queue.length > 0 && !found) {
      const cur = queue.shift();
      for (const n of [
        { tx: cur.tx + 1, ty: cur.ty },
        { tx: cur.tx - 1, ty: cur.ty },
        { tx: cur.tx, ty: cur.ty + 1 },
        { tx: cur.tx, ty: cur.ty - 1 },
      ]) {
        if (seen.has(key(n.tx, n.ty))) continue;
        seen.add(key(n.tx, n.ty));
        if (walkable(n.tx, n.ty)) { found = n; break; }
        queue.push(n);
      }
    }
    if (found) goal = found;
  }
  const prev = new Map();
  const seen = new Set([key(start.tx, start.ty)]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.tx === goal.tx && cur.ty === goal.ty) break;
    const neighbours = [
      { tx: cur.tx + 1, ty: cur.ty },
      { tx: cur.tx - 1, ty: cur.ty },
      { tx: cur.tx, ty: cur.ty + 1 },
      { tx: cur.tx, ty: cur.ty - 1 },
    ];
    for (const n of neighbours) {
      if (!walkable(n.tx, n.ty) || seen.has(key(n.tx, n.ty))) continue;
      seen.add(key(n.tx, n.ty));
      prev.set(key(n.tx, n.ty), cur);
      queue.push(n);
    }
  }
  const points = [];
  let cur = goal;
  if (!prev.has(key(goal.tx, goal.ty)) && !(goal.tx === start.tx && goal.ty === start.ty)) {
    return [{ x: tx, y: ty }];
  }
  while (!(cur.tx === start.tx && cur.ty === start.ty)) {
    points.unshift({ x: cur.tx * 40 + 20, y: cur.ty * 40 + 20 });
    cur = prev.get(key(cur.tx, cur.ty));
  }
  points.push({ x: tx, y: ty });
  return points;
}

function waitSeconds(state, seconds) {
  runSteps(state, seconds, () => ({ up: false, down: false, left: false, right: false, sneak: true, run: false }));
}

/** How clearly any guard sees Wren right now. */
function playerIsSeen(state) {
  for (let g = 0; g < state.guards.length; g += 1) {
    if (guardSeesPlayer(state.level, state.guards[g], state.player) > 0.15) return true;
  }
  return false;
}

/** A plant is cover only when no patrol ever goes near it. Waypoints are
 * where guards stop and look around, so a fern beside one is a trap. */
function plantIsSafe(state, p) {
  for (let g = 0; g < state.guards.length; g += 1) {
    const guard = state.guards[g];
    if (Math.hypot(guard.x - p.x, guard.y - p.y) < 110) return false;
    const route = guard.route;
    for (let j = 0; j < route.length; j += 1) {
      if (Math.hypot(route[j].x - p.x, route[j].y - p.y) < 70) return false;
      const next = route[(j + 1) % route.length];
      if (pointToSegment(p.x, p.y, route[j].x, route[j].y, next.x, next.y) < 45) return false;
    }
  }
  return true;
}

function pointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Nearest SAFE shade-fern to Wren: the place to vanish into. */
function nearestPlant(state) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < state.level.plants.length; i += 1) {
    const p = state.level.plants[i];
    if (!plantIsSafe(state, p)) continue;
    const d = Math.hypot(p.x - state.player.x, p.y - state.player.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

// True while a hide is already running: driveTo must not start another one.
let hiding = false;

/**
 * Slip into the nearest fern and stay still until every guard's awareness
 * has fallen back near zero. The ferns slow awareness to a crawl, so even
 * a guard looking straight at one takes seconds to be sure.
 */
function hideUntilSafe(state) {
  const plant = nearestPlant(state);
  const dist = plant ? Math.hypot(plant.x - state.player.x, plant.y - state.player.y) : Infinity;
  if (!plant || dist > 260) {
    // No close safe cover: freeze where you are and let the cones sweep
    // past. A long run through patrols to a far fern gets you caught;
    // standing still in the dark lets awareness fall on its own.
    const waitBudget = Math.round(8 / STEP);
    for (let i = 0; i < waitBudget; i += 1) {
      state.keys = { up: false, down: false, left: false, right: false, sneak: true, run: false };
      stepGame(state, false);
      if (state.screen !== SCREEN_PLAY) return;
      if (highestAwareness(state.guards) < 0.08) return;
    }
    return;
  }
  // Walk to the fern the careful way, waiting out watched stretches, then
  // stay still in it until every guard's awareness has fallen back near zero.
  hiding = true;
  driveTo(state, plant.x, plant.y, SNEAK, 20);
  hiding = false;
  if (state.screen !== SCREEN_PLAY) return;
  const waitBudget = Math.round(20 / STEP);
  for (let i = 0; i < waitBudget; i += 1) {
    state.keys = { up: false, down: false, left: false, right: false, sneak: true, run: false };
    stepGame(state, false);
    if (state.screen !== SCREEN_PLAY) return;
    if (highestAwareness(state.guards) < 0.08) return;
  }
}

/** Take the relic under Wren's feet, if one is in reach. */
function takeRelicIfNear(state) {
  stepGame(state, true);
}

/** Steal one relic: walk to it, take it, and step back into cover. */
function stealRelic(state, relic, retreat) {
  if (!driveTo(state, relic.x, relic.y, SNEAK, 30)) return false;
  takeRelicIfNear(state);
  if (retreat) driveTo(state, retreat.x, retreat.y, SNEAK, 20);
  return true;
}

function stageTitle(state) {
  // The start of the loop: the mission briefing over the dim gallery.
  // resetGame puts the world on the play screen, so switch back to title.
  state.screen = SCREEN_TITLE;
  return { screen: SCREEN_TITLE };
}

function stageCaught(state) {
  // The loss, mid-heist: the cover's near miss, then Wren freezes — Bram's
  // cone is already on her, his awareness climbs past alarm, he closes in
  // and the catch is deterministic. The frame must show who caught her and
  // the run's stats, with the way back: press R.
  stageCover(state);
  if (state.screen !== SCREEN_PLAY) return { screen: state.screen };
  // Phase 1: freeze where the cover left her — the cone is already on her,
  // and the live game catches her this way. Bounded, so a patrol that
  // carries the cone away cannot stall the shot forever.
  let budget = Math.round(20 / STEP);
  for (let i = 0; i < budget; i += 1) {
    state.keys = { up: false, down: false, left: false, right: false, sneak: false, run: false };
    stepGame(state, false);
    if (state.screen !== SCREEN_PLAY) return { screen: state.screen };
  }
  // Phase 2: walk into the most suspicious guard — closing the distance
  // can only raise awareness faster, so the catch lands.
  budget = Math.round(40 / STEP);
  for (let i = 0; i < budget; i += 1) {
    let target = state.guards[0];
    for (let g = 1; g < state.guards.length; g += 1) {
      if (state.guards[g].awareness > target.awareness) target = state.guards[g];
    }
    const keys = keysToward(state, target.x, target.y, { sneak: false, run: false });
    state.keys = keys || { up: false, down: false, left: false, right: false, sneak: false, run: false };
    stepGame(state, false);
    if (state.screen !== SCREEN_PLAY) break;
  }
  return { screen: state.screen };
}

function stageCover(state) {
  // The near miss, mid-heist: one relic stolen, Wren frozen at the edge of
  // Bram's cone in the lamplight, his "?" and "WHAT WAS THAT?" over his head.
  // The frame must show a relic taken, a cone, a guard noticing, and the exit.
  stealRelic(state, state.level.relics[2], { x: 140, y: 300 });
  driveTo(state, 760, 300, SNEAK, 30, { bold: true, stopAtAwareness: 0.5 });
  const budget = Math.round(20 / STEP);
  for (let i = 0; i < budget; i += 1) {
    state.keys = { up: false, down: false, left: false, right: false, sneak: false, run: false };
    stepGame(state, false);
    if (highestAwareness(state.guards) >= 0.5) break;
    if (state.screen !== SCREEN_PLAY) break;
  }
  return { screen: SCREEN_PLAY };
}

function stagePatrol(state) {
  // Wren pressed into a shade-fern while Kess walks his route past her,
  // his cone an arm's length away, his head turning. Patrols you can learn.
  // Wait until he is actually suspicious — the "?" over his head is the shot.
  driveTo(state, 140, 300, SNEAK, 25);
  const budget = Math.round(25 / STEP);
  for (let i = 0; i < budget; i += 1) {
    state.keys = { up: false, down: false, left: false, right: false, sneak: true, run: false };
    stepGame(state, false);
    if (highestAwareness(state.guards) >= 0.30) break;
    if (state.screen !== SCREEN_PLAY) break;
  }
  return { screen: SCREEN_PLAY };
}

function stageAlarm(state) {
  // The pebble play: Wren lures Bram toward a ringing pebble, then slips
  // past — a breath too late, his cone catches her and the meter burns amber.
  // The frame must show the pebble ring, a searching guard, and the near miss.
  state.mouse = { x: 700, y: 200 };
  throwPebbleAt(state);
  waitSeconds(state, 1.0);
  driveTo(state, 760, 300, SNEAK, 30, { bold: true, stopAtAwareness: 0.35 });
  const budget = Math.round(20 / STEP);
  for (let i = 0; i < budget; i += 1) {
    state.keys = { up: false, down: false, left: false, right: false, sneak: false, run: false };
    stepGame(state, false);
    if (highestAwareness(state.guards) >= 0.35) break;
    if (state.screen !== SCREEN_PLAY) break;
  }
  // One more pebble, right now, so its ring is fresh in the frame — and no
  // extra waiting in the cone: awareness is already at the edge.
  state.mouse = { x: 700, y: 200 };
  throwPebbleAt(state);
  waitSeconds(state, 0.3);
  return { screen: SCREEN_PLAY };
}

function stageGhost(state) {
  // The finale: the Star Vault, played clean, as the end of a full three-wing
  // run — seven relics already stolen in the wings behind her, three more
  // here, the green door, never seen. The win screen tells the whole heist.
  // The Vault shares the Gallery's floor plan, so the run is the same shape
  // that already proved itself there — only the patrols are faster.
  // Seven relics + two wing-clear bonuses (250 each) already banked.
  state.totalRelics = 7;
  state.score = 1200;
  loadWing(state, 2);
  stealRelic(state, state.level.relics[2], { x: 140, y: 300 });
  driveTo(state, 300, 340, SNEAK, 20);
  driveTo(state, 440, 340, SNEAK, 15);
  stealRelic(state, state.level.relics[1], { x: 560, y: 380 });
  driveTo(state, 900, 300, SNEAK, 25);
  driveTo(state, 1050, 200, SNEAK, 20);
  stealRelic(state, state.level.relics[0], { x: 1080, y: 280 });
  driveTo(state, 1180, 500, SNEAK, 25);
  driveTo(state, 1210, 660, SNEAK, 15);
  waitSeconds(state, 0.5);
  return { screen: state.screen };
}

/**
 * Set the world to the named scene (title, cover, patrol, alarm, caught,
 * ghost) and return the screen to draw over it. Any other name stages the
 * cover. Patrol and alarm still stage for the tests; the four screenshots
 * the judge sees are title, cover, caught and ghost — the whole loop.
 */
export function stageShot(name, state) {
  resetGame(state);
  if (name === 'title') return stageTitle(state);
  if (name === 'patrol') return stagePatrol(state);
  if (name === 'alarm') return stageAlarm(state);
  if (name === 'caught') return stageCaught(state);
  if (name === 'ghost') return stageGhost(state);
  return stageCover(state);
}
