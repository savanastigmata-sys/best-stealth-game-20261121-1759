// Core-logic tests for Nightshade Gallery (Vitest, node environment).
// These run the real game modules headless: no DOM, no canvas, no audio.
// The same scenarios the Playwright smoke test plays in a real browser
// (tests/playwright-smoke.mjs) are asserted here at the logic level.
import { describe, it, expect } from 'vitest';
import {
  createGameState, resetGame, startGame, loadWing, stepGame,
  throwPebbleAt, detectionMeter,
} from '../game/src/game-main.js';
import { stageShot } from '../game/src/screenshot-scenes.js';
import {
  highestAwareness, anyGuardAlert,
  STATE_PATROL, STATE_SUSPICIOUS, STATE_SEARCH,
} from '../game/src/guard-patrols.js';
import { buildWing, WINGS, circleHitsSolid } from '../game/src/level-gallery.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_CAUGHT } from '../game/src/render-gallery.js';

function stepN(state, n, take = false) {
  for (let i = 0; i < n; i += 1) stepGame(state, take);
}

function freshPlaying() {
  const state = createGameState();
  resetGame(state);
  return state;
}

describe('start', () => {
  it('opens on the title screen and starts clean', () => {
    const state = createGameState();
    expect(state.screen).toBe(SCREEN_TITLE);
    startGame(state);
    expect(state.screen).toBe(SCREEN_PLAY);
    expect(state.score).toBe(0);
    expect(state.wingIndex).toBe(0);
    expect(state.pebblesLeft).toBe(5);
    expect(state.detections).toBe(0);
  });
});

describe('the three wings', () => {
  it('advertises 3 wings, 10 relics, 16 guards', () => {
    expect(WINGS).toHaveLength(3);
    const relics = WINGS.reduce((n, _, i) => n + buildWing(i).relics.length, 0);
    const guards = WINGS.reduce((n, _, i) => n + buildWing(i).guardSpawns.length, 0);
    expect(relics).toBe(10);
    expect(guards).toBe(16);
  });

  it('the WINGS table matches the built levels (title screen source of truth)', () => {
    for (let i = 0; i < WINGS.length; i += 1) {
      const level = buildWing(i);
      expect(WINGS[i].relics).toBe(level.relics.length);
      expect(WINGS[i].guards).toBe(level.guardSpawns.length);
      expect(WINGS[i].patrolSpeedMul).toBe(level.patrolSpeedMul ?? 1);
    }
  });

  it('every relic, exit and guard waypoint is reachable in every wing', () => {
    const GRID_W = 32;
    const GRID_H = 18;
    const key = (x, y) => `${x},${y}`;
    function reachable(level, fx, fy, tx, ty) {
      const walkable = (x, y) => {
        if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
        return !circleHitsSolid(level, x * 40 + 20, y * 40 + 20, 13);
      };
      const start = { tx: Math.floor(fx / 40), ty: Math.floor(fy / 40) };
      let goal = { tx: Math.floor(tx / 40), ty: Math.floor(ty / 40) };
      if (!walkable(goal.tx, goal.ty)) {
        const seen = new Set([key(goal.tx, goal.ty)]);
        const q = [goal];
        let found = null;
        while (q.length && !found) {
          const c = q.shift();
          for (const n of [
            { tx: c.tx + 1, ty: c.ty }, { tx: c.tx - 1, ty: c.ty },
            { tx: c.tx, ty: c.ty + 1 }, { tx: c.tx, ty: c.ty - 1 },
          ]) {
            if (seen.has(key(n.tx, n.ty))) continue;
            seen.add(key(n.tx, n.ty));
            if (walkable(n.tx, n.ty)) { found = n; break; }
            q.push(n);
          }
        }
        if (!found) return false;
        goal = found;
      }
      const seen = new Set([key(start.tx, start.ty)]);
      const q = [start];
      while (q.length) {
        const c = q.shift();
        if (c.tx === goal.tx && c.ty === goal.ty) return true;
        for (const n of [
          { tx: c.tx + 1, ty: c.ty }, { tx: c.tx - 1, ty: c.ty },
          { tx: c.tx, ty: c.ty + 1 }, { tx: c.tx, ty: c.ty - 1 },
        ]) {
          if (!walkable(n.tx, n.ty) || seen.has(key(n.tx, n.ty))) continue;
          seen.add(key(n.tx, n.ty));
          q.push(n);
        }
      }
      return false;
    }
    for (let w = 0; w < WINGS.length; w += 1) {
      const level = buildWing(w);
      const s = level.playerStart;
      for (const r of level.relics) {
        expect(reachable(level, s.x, s.y, r.x, r.y), `wing ${w + 1} relic ${r.name}`).toBe(true);
      }
      const ex = { x: level.exit.x + level.exit.w / 2, y: level.exit.y + level.exit.h / 2 };
      expect(reachable(level, s.x, s.y, ex.x, ex.y), `wing ${w + 1} exit`).toBe(true);
      for (const g of level.guardSpawns) {
        for (const p of g.route) {
          expect(circleHitsSolid(level, p.x, p.y, 14), `wing ${w + 1} ${g.name} waypoint`).toBe(false);
          expect(reachable(level, s.x, s.y, p.x, p.y), `wing ${w + 1} ${g.name} route`).toBe(true);
        }
      }
    }
  });
});

describe('win and lose', () => {
  it('the ghost run wins: 10 relics, 0 detections, score 2250', () => {
    const state = freshPlaying();
    stageShot('ghost', state);
    expect(state.screen).toBe(SCREEN_WIN);
    expect(state.totalRelics).toBe(10);
    expect(state.detections).toBe(0);
    expect(state.score).toBe(2250);
    expect(state.wingIndex).toBe(2);
  });

  it('the ghost run reproduces exactly', () => {
    const snap = (state) => ({
      screen: state.screen,
      score: state.score,
      totalRelics: state.totalRelics,
      detections: state.detections,
      px: Math.round(state.player.x),
      py: Math.round(state.player.y),
      elapsed: +state.elapsed.toFixed(2),
    });
    const a = freshPlaying();
    stageShot('ghost', a);
    const b = freshPlaying();
    stageShot('ghost', b);
    expect(snap(a)).toEqual(snap(b));
  });

  it('freezing inside a cone gets you caught', () => {
    const state = freshPlaying();
    stageShot('cover', state);
    expect(state.screen).toBe(SCREEN_PLAY);
    expect(highestAwareness(state.guards)).toBeGreaterThanOrEqual(0.5);
    stepN(state, 600);
    expect(state.screen).toBe(SCREEN_CAUGHT);
    expect(state.detections).toBeGreaterThanOrEqual(1);
    expect(state.caughtBy).toBe('Bram');
  });

  it('the caught scene stages deterministically: Bram, score 100, 1 relic', () => {
    const snap = (state) => ({
      screen: state.screen,
      caughtBy: state.caughtBy,
      score: state.score,
      relicsTaken: state.player.relicsTaken,
      wing: state.wingIndex,
      detections: state.detections,
      elapsed: +state.elapsed.toFixed(2),
    });
    const a = freshPlaying();
    stageShot('caught', a);
    expect(snap(a).screen).toBe(SCREEN_CAUGHT);
    expect(snap(a).caughtBy).toBe('Bram');
    expect(snap(a).score).toBe(100);
    expect(snap(a).relicsTaken).toBe(1);
    const b = freshPlaying();
    stageShot('caught', b);
    expect(snap(b)).toEqual(snap(a));
  });

  it('the title scene stages the mission briefing screen', () => {
    const state = freshPlaying();
    stageShot('title', state);
    expect(state.screen).toBe(SCREEN_TITLE);
    expect(state.score).toBe(0);
    expect(state.detections).toBe(0);
  });

  it('clearing a wing pays +250 and advances', () => {
    const state = freshPlaying();
    state.level.relics.forEach((r) => { r.taken = true; });
    state.player.relicsTaken = 3;
    state.player.x = state.level.exit.x + 10;
    state.player.y = state.level.exit.y + 10;
    stepGame(state, false);
    expect(state.wingIndex).toBe(1);
    expect(state.totalRelics).toBe(3);
    expect(state.score).toBe(250);
    expect(state.screen).toBe(SCREEN_PLAY);
  });

  it('the last wing pays +250, and the Ghost bonus +500 only when unseen', () => {
    const clean = freshPlaying();
    loadWing(clean, 2);
    clean.level.relics.forEach((r) => { r.taken = true; });
    clean.player.relicsTaken = 3;
    clean.player.x = clean.level.exit.x + 10;
    clean.player.y = clean.level.exit.y + 10;
    stepGame(clean, false);
    expect(clean.screen).toBe(SCREEN_WIN);
    expect(clean.score).toBe(750);

    const spotted = freshPlaying();
    loadWing(spotted, 2);
    spotted.detections = 1;
    spotted.level.relics.forEach((r) => { r.taken = true; });
    spotted.player.relicsTaken = 3;
    spotted.player.x = spotted.level.exit.x + 10;
    spotted.player.y = spotted.level.exit.y + 10;
    stepGame(spotted, false);
    expect(spotted.screen).toBe(SCREEN_WIN);
    expect(spotted.score).toBe(250);
  });
});

describe('guard states', () => {
  it('a glimpse turns a guard suspicious', () => {
    const state = freshPlaying();
    stageShot('cover', state);
    const bram = state.guards.find((g) => g.name === 'Bram');
    expect(bram.state).toBe(STATE_SUSPICIOUS);
    expect(detectionMeter(state)).toBeGreaterThanOrEqual(0.5);
  });

  it('a full sighting raises the alarm, then the guard searches and calms down', () => {
    const state = freshPlaying();
    stageShot('cover', state);
    let alarmed = false;
    for (let i = 0; i < 30 && !alarmed; i += 1) {
      stepN(state, 10);
      alarmed = anyGuardAlert(state.guards);
      expect(state.screen).toBe(SCREEN_PLAY);
    }
    expect(alarmed).toBe(true);
    expect(state.detections).toBeGreaterThanOrEqual(1);
    // Slip away to the spawn corner, far outside every cone.
    state.player.x = state.level.playerStart.x;
    state.player.y = state.level.playerStart.y;
    stepN(state, 720);
    expect(state.guards.every((g) => g.state === STATE_PATROL)).toBe(true);
    expect(highestAwareness(state.guards)).toBeLessThan(0.12);
  });
});

describe('pebble gadget', () => {
  it('a throw spends one pebble and lures every guard in earshot to the spot', () => {
    const state = freshPlaying();
    state.mouse = { x: 700, y: 200 };
    expect(throwPebbleAt(state)).toBe(true);
    expect(state.pebblesLeft).toBe(4);
    expect(state.thrownPebbles).toHaveLength(1);
    const landing = state.thrownPebbles[0];
    // From (92,620) toward (700,200), clamped to the 230 throwing range.
    expect(Math.hypot(landing.x - 281, landing.y - 489)).toBeLessThan(3);
    const odo = state.guards.find((g) => g.name === 'Odo');
    const tarn = state.guards.find((g) => g.name === 'Tarn');
    expect(odo.state).toBe(STATE_SEARCH);
    expect(tarn.state).toBe(STATE_SEARCH);
    expect(odo.lastSeen).toEqual({ x: landing.x, y: landing.y });
    expect(odo.awareness).toBeGreaterThanOrEqual(0.3);
  });

  it('lured guards return to patrol once the search expires', () => {
    const state = freshPlaying();
    state.mouse = { x: 700, y: 200 };
    throwPebbleAt(state);
    state.player.x = state.level.playerStart.x;
    state.player.y = state.level.playerStart.y;
    stepN(state, 300);
    const odo = state.guards.find((g) => g.name === 'Odo');
    expect(odo.state).toBe(STATE_PATROL);
  });

  it('the alarm scene shows the lure working: ring out, 3 pebbles left', () => {
    const state = freshPlaying();
    stageShot('alarm', state);
    expect(state.pebblesLeft).toBe(3);
    expect(state.thrownPebbles.length).toBeGreaterThanOrEqual(1);
    expect(highestAwareness(state.guards)).toBeGreaterThanOrEqual(0.35);
    expect(state.detections).toBe(0);
  });
});

describe('staged scenes', () => {
  it('cover: one relic taken, a guard suspicious, nobody alerted', () => {
    const state = freshPlaying();
    stageShot('cover', state);
    expect(state.screen).toBe(SCREEN_PLAY);
    expect(state.player.relicsTaken).toBe(1);
    expect(state.score).toBe(100);
    expect(highestAwareness(state.guards)).toBeGreaterThanOrEqual(0.5);
    expect(state.detections).toBe(0);
  });

  it('patrol: the player hides in a fern while a guard grows suspicious', () => {
    const state = freshPlaying();
    stageShot('patrol', state);
    expect(state.screen).toBe(SCREEN_PLAY);
    expect(highestAwareness(state.guards)).toBeGreaterThanOrEqual(0.3);
    expect(state.detections).toBe(0);
  });
});
