// Game main — the world step: one frame of Nightshade Gallery.
// Owns the game state (level, player, guards, screen, timer, detections),
// runs the player, the guards and the relic/exit rules, turns their events
// into sounds and messages, and offers click-to-move for the mouse.
import { STEP } from './config.js';
import { buildGalleryLevel } from './level-gallery.js';
import { createPlayer, updatePlayer, relicInReach, playerAtExit, allRelicsTaken } from './player-stealth.js';
import { createGuard, updateGuard, highestAwareness } from './guard-patrols.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_CAUGHT } from './render-gallery.js';
import {
  ensureAudio, playFootstep, playAlarmSting, playSuspicionBlip,
  playRelicChime, playGhostArpeggio, playCaughtThud,
} from './sound-footsteps.js';

export function createGameState() {
  const level = buildGalleryLevel();
  return {
    level,
    player: createPlayer(level.playerStart),
    guards: level.guardSpawns.map((spawn) => createGuard(spawn)),
    screen: SCREEN_TITLE,
    time: 0,
    elapsed: 0,
    detections: 0,
    caughtBy: '',
    flash: null,
    flashText: '',
    flashTimer: 0,
    moveTarget: null,
    lastStepSoundAt: 0,
    keys: { up: false, down: false, left: false, right: false, sneak: false, run: false },
  };
}

export function resetGame(state) {
  const fresh = createGameState();
  fresh.screen = SCREEN_PLAY;
  Object.assign(state, fresh);
}

export function startGame(state) {
  ensureAudio();
  resetGame(state);
}

function setFlash(state, text, seconds) {
  state.flash = true;
  state.flashText = text;
  state.flashTimer = seconds;
}

/** Handle one event the guards or the player raised this frame. */
function handleEvent(state, event) {
  if (event.type === 'alarm') {
    state.detections += 1;
    playAlarmSting();
    setFlash(state, `${event.guard.toUpperCase()} SPOTTED YOU — RUN!`, 1.6);
  } else if (event.type === 'heard') {
    playSuspicionBlip();
  } else if (event.type === 'caught') {
    state.screen = SCREEN_CAUGHT;
    state.caughtBy = event.guard;
    playCaughtThud();
  }
}

/** Steer the player toward a clicked point when no keys are held. */
function keysFromMoveTarget(state) {
  const keys = state.keys;
  const target = state.moveTarget;
  if (!target) return keys;
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  if (Math.hypot(dx, dy) < 10) {
    state.moveTarget = null;
    return keys;
  }
  return {
    up: dy < -2,
    down: dy > 2,
    left: dx < -2,
    right: dx > 2,
    sneak: keys.sneak,
    run: keys.run,
  };
}

function playStepsSounds(state) {
  const player = state.player;
  if (!player.moving) return;
  const stride = player.running ? 46 : player.sneaking ? 22 : 34;
  if (player.stepsTaken - state.lastStepSoundAt >= stride) {
    state.lastStepSoundAt = player.stepsTaken;
    playFootstep(player.sneaking, player.running);
  }
}

/** Advance the world one fixed step. `takeRelic` is the E key, edge-triggered. */
export function stepGame(state, takeRelic, dt) {
  const step = dt || STEP;
  state.time += step;
  if (state.flashTimer > 0) {
    state.flashTimer -= step;
    if (state.flashTimer <= 0) state.flash = null;
  }
  if (state.screen !== SCREEN_PLAY) return;
  state.elapsed += step;

  const keys = keysFromMoveTarget(state);
  updatePlayer(state.level, state.player, keys, step);
  playStepsSounds(state);

  const events = [];
  for (let i = 0; i < state.guards.length; i += 1) {
    updateGuard(state.level, state.guards[i], state.player, step, events);
  }
  for (let i = 0; i < events.length; i += 1) {
    handleEvent(state, events[i]);
    if (state.screen === SCREEN_CAUGHT) return;
  }

  if (takeRelic) {
    const relic = relicInReach(state.level, state.player);
    if (relic) {
      relic.taken = true;
      state.player.relicsTaken += 1;
      playRelicChime();
      if (allRelicsTaken(state.level)) {
        setFlash(state, 'ALL RELICS STOLEN — THE EXIT IS OPEN', 2.2);
      } else {
        setFlash(state, `${relic.name.toUpperCase()} TAKEN — ${3 - state.player.relicsTaken} TO GO`, 1.6);
      }
    }
  }

  if (allRelicsTaken(state.level) && playerAtExit(state.level, state.player)) {
    state.screen = SCREEN_WIN;
    playGhostArpeggio();
  }
}

/** The detection meter the HUD shows: the most suspicious guard, 0..1. */
export function detectionMeter(state) {
  return highestAwareness(state.guards);
}
