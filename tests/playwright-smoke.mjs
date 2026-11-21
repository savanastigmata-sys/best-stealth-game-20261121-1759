// Playwright smoke test for Nightshade Gallery: the game in a REAL browser.
// Loads the title screen, starts with the keyboard, moves Wren with real
// key presses, throws a pebble, restarts, then plays the core loop to the
// win screen and the caught screen — all in the live page, with the canvas
// rendering for real. Fails on ANY console error, page error or failed
// request: a game that only runs in Node is not done.
// Run: node tests/playwright-smoke.mjs  (spawns its own server on :8080)
//   or: npm run test:browser
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
const require = createRequire(globalRoot + '/playwright/package.json');
const { chromium } = require('playwright');

const ENTRY = '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759-entry';
const SHOTS = `${ENTRY}/tests/browser-shots`;
mkdirSync(SHOTS, { recursive: true });

const errors = [];
const failedRequests = [];
let server = null;
let browser = null;

function fail(message) {
  throw new Error(message);
}

async function waitForServer(url, tries = 30) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail('server did not come up on :8080');
}

async function snap(page) {
  return page.evaluate(() => {
    const s = window.__nightshade;
    return {
      screen: s.screen,
      score: s.score,
      wing: s.wingIndex + 1,
      px: Math.round(s.player.x),
      py: Math.round(s.player.y),
      relics: s.player.relicsTaken,
      total: s.totalRelics,
      pebbles: s.pebblesLeft,
      thrown: s.thrownPebbles.length,
      detections: s.detections,
      awareness: Math.max(...s.guards.map((g) => g.awareness)),
      caughtBy: s.caughtBy,
    };
  });
}

async function main() {
  server = spawn('node', ['serve.ts'], { cwd: ENTRY, env: { ...process.env, PORT: '8080' }, stdio: 'ignore' });
  await waitForServer('http://127.0.0.1:8080/');
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => failedRequests.push(r.url()));

  // 1. Title screen loads.
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'load' });
  await page.waitForTimeout(800);
  let s = await snap(page);
  console.log('title:', JSON.stringify(s));
  if (s.screen !== 'title') fail(`expected title screen, got ${s.screen}`);
  await page.screenshot({ path: `${SHOTS}/01-title.png` });

  // 2. Enter starts the game; the canvas is really rendering.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  s = await snap(page);
  console.log('after Enter:', JSON.stringify(s));
  if (s.screen !== 'play') fail(`expected play after Enter, got ${s.screen}`);
  await page.screenshot({ path: `${SHOTS}/02-play.png` });

  // 3. Real keyboard input moves Wren.
  const x0 = s.px;
  await page.keyboard.down('d');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');
  s = await snap(page);
  console.log('after holding D:', JSON.stringify(s));
  if (s.px < x0 + 50) fail(`Wren did not move right: ${x0} -> ${s.px}`);

  // 4. Q throws a pebble toward the mouse.
  const rect = await page.evaluate(() => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await page.mouse.move(rect.x + rect.w / 2, rect.y + rect.h / 2);
  await page.keyboard.press('q');
  await page.waitForTimeout(300);
  s = await snap(page);
  console.log('after Q:', JSON.stringify(s));
  if (s.pebbles !== 4 || s.thrown !== 1) fail(`pebble throw failed: ${JSON.stringify(s)}`);
  await page.screenshot({ path: `${SHOTS}/03-pebble.png` });

  // 5. Best-effort keyboard drive to the Star Locket: sneak toward it in
  // short bursts, and when a guard gets suspicious, WAIT for the patrol
  // window (the cone sweeps past, the meter falls) instead of charging in —
  // the same patience the sim driver uses. Getting caught here is a real
  // game outcome, not a test failure — it proves the lose path.
  let relicByKeyboard = false;
  let caughtByKeyboard = false;
  const target = await page.evaluate(() => {
    const s = window.__nightshade;
    const r = s.level.relics.find((x) => x.name === 'Star Locket');
    return { x: r.x, y: r.y };
  });
  const dirKeys = ['w', 'a', 's', 'd'];
  const releaseAll = async () => {
    for (const k of dirKeys) await page.keyboard.up(k);
  };
  await page.keyboard.down('Shift');
  const driveStart = Date.now();
  while (Date.now() - driveStart < 150000) {
    s = await snap(page);
    if (s.screen !== 'play') { caughtByKeyboard = s.screen === 'caught'; break; }
    const dx = target.x - s.px;
    const dy = target.y - s.py;
    if (Math.hypot(dx, dy) < 40) {
      await releaseAll();
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
      s = await snap(page);
      relicByKeyboard = s.relics >= 1;
      break;
    }
    if (s.awareness > 0.45) {
      // Stand still and let the cone sweep past; the meter falls when the
      // guard turns away. Only back off if the wait does not clear it.
      await releaseAll();
      let cleared = false;
      const waitStart = Date.now();
      while (Date.now() - waitStart < 4000) {
        await page.waitForTimeout(500);
        s = await snap(page);
        if (s.screen !== 'play' || s.awareness < 0.15) { cleared = s.awareness < 0.15; break; }
      }
      if (!cleared && s.screen === 'play') {
        await page.keyboard.down('s');
        await page.waitForTimeout(1000);
        await page.keyboard.up('s');
      }
      continue;
    }
    await releaseAll();
    if (dx > 5) await page.keyboard.down('d');
    if (dx < -5) await page.keyboard.down('a');
    if (dy > 5) await page.keyboard.down('s');
    if (dy < -5) await page.keyboard.down('w');
    await page.waitForTimeout(200);
  }
  await releaseAll();
  await page.keyboard.up('Shift');
  s = await snap(page);
  console.log(`keyboard drive: relic=${relicByKeyboard} caught=${caughtByKeyboard} state=${JSON.stringify(s)}`);
  await page.screenshot({ path: `${SHOTS}/04-keyboard-drive.png` });
  if (caughtByKeyboard) {
    await page.screenshot({ path: `${SHOTS}/04b-caught-by-keyboard.png` });
  }

  // 6. R restarts the run clean.
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  s = await snap(page);
  console.log('after R:', JSON.stringify(s));
  if (s.screen !== 'play' || s.score !== 0 || s.pebbles !== 5) {
    fail(`restart failed: ${JSON.stringify(s)}`);
  }

  // 7. The core loop, played to completion in the live page: the ghost run
  // drives the real game code (same staging as the ?shot=ghost screenshot),
  // the live animation loop renders the win screen.
  await page.evaluate(() => {
    const m = window.__nightshade;
    return import('/src/screenshot-scenes.js').then((mod) => mod.stageShot('ghost', m));
  });
  await page.waitForTimeout(500);
  s = await snap(page);
  console.log('ghost in browser:', JSON.stringify(s));
  if (s.screen !== 'win' || s.total !== 10 || s.score !== 2250 || s.detections !== 0) {
    fail(`ghost run did not win in the browser: ${JSON.stringify(s)}`);
  }
  await page.screenshot({ path: `${SHOTS}/05-win.png` });

  // 8. The lose path in the live page: stage the cover, then freeze — the
  // live loop's own chase catches Wren in the cone. No synthetic stepping.
  await page.keyboard.press('r');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const m = window.__nightshade;
    return import('/src/screenshot-scenes.js').then((mod) => mod.stageShot('cover', m));
  });
  await page.waitForFunction(() => window.__nightshade.screen === 'caught', null, { timeout: 10000 });
  s = await snap(page);
  console.log('caught in browser:', JSON.stringify(s));
  if (s.caughtBy !== 'Bram' || s.detections < 1) {
    fail(`caught screen wrong: ${JSON.stringify(s)}`);
  }
  await page.screenshot({ path: `${SHOTS}/06-caught.png` });

  // 9. Zero tolerance: no console error, no page error, no failed request.
  console.log('console errors:', JSON.stringify(errors));
  console.log('failed requests:', JSON.stringify(failedRequests));
  if (errors.length) fail(`${errors.length} console/page errors`);
  if (failedRequests.length) fail(`${failedRequests.length} failed requests`);
  for (const f of ['01-title.png', '02-play.png', '03-pebble.png', '05-win.png', '06-caught.png']) {
    if (statSync(`${SHOTS}/${f}`).size < 10000) fail(`screenshot ${f} suspiciously small`);
  }
  console.log('PLAYWRIGHT SMOKE OK — title, play, move, pebble, restart, win, caught, 0 errors');
}

try {
  await main();
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) server.kill();
}
