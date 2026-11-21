// Re-shoot the 4 Nightshade Gallery screenshots (the whole game loop) in
// headless Chromium. Serves game/ via serve.ts on :8080, loads each ?shot=
// staging, saves JPEGs to screenshots/. The judge sees these four frames:
// the title briefing, the cover near miss, the loss with its stats, the win.
// Run: node tests/shoot-screenshots.mjs  (spawns its own server on :8080)
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ENTRY = '/home/hatch/workspace/makefun/best-stealth-game-20261121-1759-entry';
const OUT = `${ENTRY}/screenshots`;
const errors = [];
let server = null;

async function waitForServer(url, tries = 30) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not come up on :8080');
}

async function main() {
  server = spawn('node', ['serve.ts'], { cwd: ENTRY, env: { ...process.env, PORT: '8080' }, stdio: 'ignore' });
  await waitForServer('http://127.0.0.1:8080/');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const [name, query] of [
    ['1-cover', '?shot=cover&seed=1'],
    ['2-title', '?shot=title&seed=1'],
    ['3-caught', '?shot=caught&seed=1'],
    ['4-ghost', '?shot=ghost&seed=1'],
  ]) {
    await page.goto('http://127.0.0.1:8080/' + query, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const s = window.__nightshade;
      return { screen: s.screen, score: s.score, caughtBy: s.caughtBy, detections: s.detections };
    });
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 88 });
    console.log(name, JSON.stringify(state), 'errors so far:', JSON.stringify(errors));
    if (errors.length > 0) throw new Error(`console errors while shooting ${name}`);
  }
  await browser.close();
  server.kill();
  console.log('ALL SHOTS DONE');
}

main().catch((e) => {
  console.error('SHOOT FAILED:', e.message);
  if (server) server.kill();
  process.exit(1);
});
