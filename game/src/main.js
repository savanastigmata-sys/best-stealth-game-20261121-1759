// Browser wiring for Nightshade Gallery: keyboard and mouse input, the
// animation loop, and the ?shot= staging that renders one fixed scene for a
// screenshot. No network, no libraries: the canvas and these modules are all.
import { CANVAS_WIDTH, CANVAS_HEIGHT, STEP } from './config.js';
import { createGameState, startGame, resetGame, stepGame, throwPebbleAt } from './game-main.js';
import { drawGame, SCREEN_TITLE, SCREEN_PLAY } from './render-gallery.js';
import { stageShot } from './screenshot-scenes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const state = createGameState();

// Test hook for the Playwright smoke test (tests/playwright-smoke.mjs):
// the live game state, so the browser test can assert screens, score and
// positions instead of guessing from pixels. Harmless in normal play.
window.__nightshade = state;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  // A staged screenshot: play the real game to the scene, then hold the frame.
  stageShot(shotName, state);
  drawGame(ctx, state);
  document.title = `Nightshade Gallery — ${shotName}`;
} else {
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
    KeyX: 'run',
  };
  let takeQueued = false;

  window.addEventListener('keydown', (event) => {
    const key = KEYMAP[event.code];
    if (key) {
      state.keys[key] = true;
      state.moveTarget = null;
      event.preventDefault();
    }
    if (event.code === 'Enter' && state.screen === SCREEN_TITLE) startGame(state);
    if (event.code === 'KeyE') takeQueued = true;
    if (event.code === 'KeyQ' && state.screen === SCREEN_PLAY) throwPebbleAt(state);
    if (event.code === 'KeyR' && state.screen !== SCREEN_TITLE) resetGame(state);
  });
  window.addEventListener('keyup', (event) => {
    const key = KEYMAP[event.code];
    if (key) state.keys[key] = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouse = {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    if (state.screen === SCREEN_TITLE) {
      startGame(state);
      return;
    }
    if (state.screen === SCREEN_PLAY) state.moveTarget = { x, y };
  });

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepGame(state, takeQueued);
      takeQueued = false;
      accumulator -= STEP;
    }
    drawGame(ctx, state);
    requestAnimationFrame(frame);
  }
  drawGame(ctx, state);
  requestAnimationFrame(frame);
}
