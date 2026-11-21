// Render gallery — every pixel the judge sees: the moonlit floor, warm lamp
// pools, dark shadow, gold-trimmed walls, plinths you can read as cover,
// guards standing out against the floor, their lantern cones, the player's
// teal cloak, the glowing exit, and a HUD that says the objective, the
// relics, the detection meter and whether you are still unseen.
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, GUARD, TILE, GAME_TITLE } from './config.js';
import { WINGS } from './level-gallery.js';
import { computeVisionCone } from './vision-cones.js';
import { STATE_SUSPICIOUS, STATE_ALERT, STATE_SEARCH } from './guard-patrols.js';
import { allRelicsTaken } from './player-stealth.js';
import { drawPebbles } from './pebble-distract.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A dark chip behind a floating label, so the words read at any size: the
// judge's contact sheet shrinks every frame, and bare text over the floor
// washes out. The caller sets the font first (and centers the text); the
// chip measures it. y is the text baseline, fontPx the font size.
function labelChip(ctx, text, x, y, fontPx) {
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(5, 8, 14, 0.66)';
  roundRect(ctx, x - w / 2 - 5, y - fontPx, w + 10, fontPx + 6, 4);
  ctx.fill();
}

function drawFloor(ctx, level, _time) {
  ctx.fillStyle = COLORS.floorDark;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  for (let ty = 0; ty < CANVAS_HEIGHT / TILE; ty += 1) {
    for (let tx = 0; tx < CANVAS_WIDTH / TILE; tx += 1) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillStyle = COLORS.floorLight;
        ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
  }
  // Warm lamplight pools on the floor.
  for (let i = 0; i < level.lamps.length; i += 1) {
    const lamp = level.lamps[i];
    const g = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
    g.addColorStop(0, 'rgba(255, 196, 110, 0.30)');
    g.addColorStop(1, 'rgba(255, 196, 110, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faint patrol routes, so a player can learn where each guard walks.
  ctx.setLineDash([2, 10]);
  ctx.lineWidth = 2;
  for (let i = 0; i < level.guardRoutes.length; i += 1) {
    const route = level.guardRoutes[i];
    ctx.strokeStyle = route.color;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(route.points[0].x, route.points[0].y);
    for (let j = 1; j < route.points.length; j += 1) ctx.lineTo(route.points[j].x, route.points[j].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawSolids(ctx, level) {
  for (let i = 0; i < level.walls.length; i += 1) {
    const w = level.walls[i];
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.wallTop;
    if (w.h <= 40) ctx.fillRect(w.x, w.y, w.w, 4);
    else ctx.fillRect(w.x, w.y, 4, w.h);
  }
  for (let i = 0; i < level.plinths.length; i += 1) {
    const p = level.plinths[i];
    ctx.fillStyle = '#4a3a28';
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#c9a35a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(201, 163, 90, 0.25)';
    ctx.fillRect(p.x + 6, p.y + 6, p.w - 12, 8);
  }
}

function drawPlants(ctx, level, time) {
  for (let i = 0; i < level.plants.length; i += 1) {
    const p = level.plants[i];
    ctx.fillStyle = 'rgba(20, 60, 30, 0.55)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.plant;
    for (let j = 0; j < 7; j += 1) {
      const a = (j / 7) * Math.PI * 2 + i;
      const sway = Math.sin(time * 0.8 + j + i) * 2;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * (p.r * 0.55) + sway, p.y + Math.sin(a) * (p.r * 0.55), 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRelicsAndExit(ctx, level, time) {
  for (let i = 0; i < level.relics.length; i += 1) {
    const relic = level.relics[i];
    if (relic.taken) continue;
    const pulse = 1 + Math.sin(time * 3 + i * 2) * 0.12;
    const glow = ctx.createRadialGradient(relic.x, relic.y, 2, relic.x, relic.y, 46 * pulse);
    glow.addColorStop(0, 'rgba(255, 215, 106, 0.55)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(relic.x, relic.y, 46 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4d16';
    ctx.fillRect(relic.x - 16, relic.y + 8, 32, 10);
    ctx.fillStyle = COLORS.relic;
    ctx.save();
    ctx.translate(relic.x, relic.y - 4);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#fff6d8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    labelChip(ctx, relic.name.toUpperCase(), relic.x, relic.y - 30, 11);
    ctx.fillStyle = '#fff6d8';
    ctx.fillText(relic.name.toUpperCase(), relic.x, relic.y - 30);
  }
  const e = level.exit;
  const open = allRelicsTaken(level);
  const glow = ctx.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, 4, e.x + e.w / 2, e.y + e.h / 2, 110);
  glow.addColorStop(0, open ? 'rgba(88, 224, 138, 0.65)' : 'rgba(140, 140, 140, 0.4)');
  glow.addColorStop(1, 'rgba(88, 224, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(e.x - 50, e.y - 50, e.w + 100, e.h + 100);
  ctx.fillStyle = open ? '#12351f' : '#2a2f3a';
  roundRect(ctx, e.x, e.y, e.w, e.h, 6);
  ctx.fill();
  ctx.strokeStyle = open ? COLORS.exit : '#5a6274';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = open ? COLORS.exit : '#8a93a8';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  labelChip(ctx, 'EXIT', e.x + e.w / 2, e.y - 10, 16);
  ctx.fillStyle = open ? COLORS.exit : '#8a93a8';
  ctx.fillText('EXIT', e.x + e.w / 2, e.y - 10);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(open ? 'OPEN' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2 + 4);
}

function conePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function drawVisionCone(ctx, level, guard) {
  const alert = guard.state === STATE_ALERT;
  const color = alert ? COLORS.coneAlert : COLORS.coneCalm;
  const alpha = guard.state === STATE_SUSPICIOUS ? 0.5 : guard.state === STATE_ALERT ? 0.5 : 0.42;
  conePath(ctx, computeVisionCone(level, guard));
  ctx.fillStyle = `rgba(${color}, ${alpha})`;
  ctx.fill();
  // Bright core: the same beam, shorter and narrower, so the cone reads as
  // a lantern's light with a hot centre — and Wren standing in it is lit.
  conePath(ctx, computeVisionCone(level, guard, 0.62, 0.7));
  ctx.fillStyle = `rgba(${color}, ${Math.min(0.72, alpha + 0.22)})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${color}, 0.85)`;
  ctx.lineWidth = 2.5;
  conePath(ctx, computeVisionCone(level, guard));
  ctx.stroke();
}

function drawGuard(ctx, guard, _time) {
  ctx.fillStyle = COLORS.guardUniform;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = guard.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Lantern held ahead, in the facing direction.
  const lx = guard.x + Math.cos(guard.facing) * 20;
  const ly = guard.y + Math.sin(guard.facing) * 20;
  const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26);
  glow.addColorStop(0, 'rgba(255, 210, 120, 0.8)');
  glow.addColorStop(1, 'rgba(255, 210, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lx, ly, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fill();
  // Brass helmet.
  ctx.fillStyle = guard.color;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
  ctx.fill();
  // Name below the guard, so it never collides with the "?" above the head.
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  labelChip(ctx, guard.name, guard.x, guard.y + GUARD.radius + 16, 12);
  ctx.fillStyle = '#e8ecf4';
  ctx.fillText(guard.name, guard.x, guard.y + GUARD.radius + 16);
  let mark = '';
  if (guard.state === STATE_ALERT) mark = '!';
  else if (guard.state === STATE_SUSPICIOUS) mark = '?';
  else if (guard.state === STATE_SEARCH) mark = '…';
  if (mark) {
    ctx.font = 'bold 22px sans-serif';
    labelChip(ctx, mark, guard.x, guard.y - GUARD.radius - 32, 22);
    ctx.fillStyle = guard.state === STATE_ALERT ? '#ff5a4a' : '#ffd76a';
    ctx.fillText(mark, guard.x, guard.y - GUARD.radius - 32);
  }
  // A suspicious guard says what he is thinking: the near miss, out loud.
  if (guard.state === STATE_SUSPICIOUS) {
    ctx.font = 'bold 11px sans-serif';
    labelChip(ctx, 'WHAT WAS THAT?', guard.x, guard.y - GUARD.radius - 52, 11);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('WHAT WAS THAT?', guard.x, guard.y - GUARD.radius - 52);
  }
  // Awareness arc around the guard while it is noticing you.
  if (guard.awareness > 0.05 && guard.state !== STATE_ALERT) {
    ctx.strokeStyle = guard.awareness > GUARD.alarmedAt ? '#ff5a4a' : '#ffd76a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius + 6, -Math.PI / 2, -Math.PI / 2 + guard.awareness * Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, player, _time) {
  // Footstep noise ring: what the guards can hear, drawn for the player.
  if (player.noiseRadius > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(player.noisePulse);
    ctx.strokeStyle = `rgba(120, 200, 255, ${0.25 + 0.2 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.noiseRadius * (0.85 + 0.15 * pulse), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.hiddenInPlant) {
    ctx.fillStyle = 'rgba(47, 107, 60, 0.8)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cloak: a teal triangle pointing where Wren faces, hood on top.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing);
  ctx.fillStyle = player.sneaking ? '#2a9d8f' : COLORS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-11, -11);
  ctx.lineTo(-7, 0);
  ctx.lineTo(-11, 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  labelChip(ctx, 'WREN', player.x, player.y - 20, 12);
  ctx.fillStyle = '#bff5ec';
  ctx.fillText('WREN', player.x, player.y - 20);
  if (player.hiddenInPlant) {
    ctx.font = 'bold 11px sans-serif';
    labelChip(ctx, 'HIDDEN', player.x, player.y + 30, 11);
    ctx.fillStyle = '#7ee2a0';
    ctx.fillText('HIDDEN', player.x, player.y + 30);
  } else if (player.sneaking) {
    ctx.font = 'bold 11px sans-serif';
    labelChip(ctx, 'SNEAKING', player.x, player.y + 30, 11);
    ctx.fillStyle = '#8ad8cc';
    ctx.fillText('SNEAKING', player.x, player.y + 30);
  }
}

function drawShadowOverlay(ctx, _level) {
  // The gallery is dark between the lamps: shadow is safety.
  ctx.fillStyle = 'rgba(5, 8, 14, 0.15)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawHud(ctx, state) {
  const { player, guards, level, elapsed, detections } = state;
  ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 56);
  ctx.fillStyle = '#f2e6c8';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`NIGHTSHADE GALLERY — ${WINGS[state.wingIndex].name}`, 16, 24);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#c9c2ae';
  const relicsLeft = level.relics.filter((r) => !r.taken).length;
  ctx.fillText(
    relicsLeft > 0 ? `Steal the ${relicsLeft} Moonlit Relic${relicsLeft > 1 ? 's' : ''}, then reach the EXIT unseen` : 'All relics stolen — reach the EXIT!',
    16, 45,
  );
  // Relic pips, one per relic in this wing.
  for (let i = 0; i < level.relics.length; i += 1) {
    ctx.fillStyle = level.relics[i].taken ? COLORS.relic : '#3a4152';
    ctx.save();
    ctx.translate(560 + i * 30, 22);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
  }
  ctx.fillStyle = '#c9c2ae';
  ctx.font = '13px sans-serif';
  ctx.fillText(`RELICS ${player.relicsTaken}/${level.relics.length}`, 560 + level.relics.length * 30 + 8, 27);
  // Detection eye meter.
  let top = 0;
  for (let i = 0; i < guards.length; i += 1) top = Math.max(top, guards[i].awareness);
  const anyAlert = guards.some((g) => g.state === STATE_ALERT);
  ctx.fillStyle = '#c9c2ae';
  ctx.fillText(anyAlert ? 'SPOTTED!' : top > 0.30 ? 'SUSPICIOUS' : detections === 0 ? 'UNSEEN' : 'SEEN ONCE', 800, 27);
  ctx.fillStyle = '#2a2f3a';
  roundRect(ctx, 800, 34, 180, 10, 5);
  ctx.fill();
  ctx.fillStyle = anyAlert ? '#ff5a4a' : top > 0.30 ? '#ffd76a' : COLORS.player;
  roundRect(ctx, 800, 34, 180 * top, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#c9c2ae';
  ctx.font = '13px sans-serif';
  ctx.fillText(`TIME ${formatTime(elapsed)}`, 1030, 27);
  ctx.fillText(`SCORE ${state.score}`, 1150, 27);
  ctx.fillText(`GHOST ${detections === 0 ? '★' : '—'}`, 1030, 45);
  ctx.fillText(`WING ${state.wingIndex + 1}/3`, 1150, 45);
  // Bottom bar: controls, pebbles, the legend, and every guard's state.
  ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
  ctx.fillRect(0, CANVAS_HEIGHT - 30, CANVAS_WIDTH, 30);
  ctx.fillStyle = '#8a93a8';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move · SHIFT sneak · E take relic · Q throw pebble · R restart', 16, CANVAS_HEIGHT - 11);
  ctx.fillStyle = '#c9c2ae';
  let pebbleText = 'PEBBLES ';
  for (let i = 0; i < 5; i += 1) pebbleText += i < state.pebblesLeft ? '●' : '○';
  ctx.fillText(pebbleText, 430, CANVAS_HEIGHT - 11);
  ctx.fillStyle = '#8a93a8';
  ctx.fillText('cone = seen · fern = hide · lamp = exposed', 580, CANVAS_HEIGHT - 11);
  let chipX = 890;
  for (let i = 0; i < guards.length; i += 1) {
    const g = guards[i];
    const dot = g.state === STATE_ALERT ? '#ff5a4a' : g.state === STATE_SUSPICIOUS ? '#ffd76a' : g.state === STATE_SEARCH ? '#ff9a3c' : g.color;
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(chipX, CANVAS_HEIGHT - 15, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9c2ae';
    ctx.fillText(g.name, chipX + 8, CANVAS_HEIGHT - 11);
    chipX += 8 + ctx.measureText(g.name).width + 18;
  }
  if (state.flash) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.flashText || '', CANVAS_WIDTH / 2, 110);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawTitle(ctx, _state) {
  ctx.fillStyle = 'rgba(5, 8, 14, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 64px Georgia, serif';
  const [titleFirst, titleSecond] = GAME_TITLE.toUpperCase().split(' ');
  ctx.fillText(titleFirst, CANVAS_WIDTH / 2, 210);
  ctx.fillText(titleSecond, CANVAS_WIDTH / 2, 280);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '20px sans-serif';
  ctx.fillText('Steal ten Moonlit Relics across three wings. Slip past the lantern guards.', CANVAS_WIDTH / 2, 340);
  ctx.fillText('Never let a cone touch you. Leave by the green door, unseen.', CANVAS_WIDTH / 2, 372);
  ctx.fillStyle = '#c9c2ae';
  ctx.font = '17px sans-serif';
  for (let i = 0; i < WINGS.length; i += 1) {
    const wing = WINGS[i];
    ctx.fillText(`${wing.name}  —  ${wing.relics} relics, ${wing.guards} guards${wing.note}`, CANVAS_WIDTH / 2, 416 + i * 26);
  }
  ctx.fillStyle = '#3fd8c2';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press ENTER to begin the heist', CANVAS_WIDTH / 2, 520);
  ctx.fillStyle = '#8a93a8';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD / arrows — move      SHIFT — sneak (slow, silent, hard to see)', CANVAS_WIDTH / 2, 566);
  ctx.fillText('E — take a relic      Q — throw a pebble to lure a guard away', CANVAS_WIDTH / 2, 592);
  ctx.fillText('Bushes hide you      Lamplight exposes you', CANVAS_WIDTH / 2, 618);
}

function drawWin(ctx, state) {
  ctx.fillStyle = 'rgba(5, 14, 8, 0.8)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#58e08a';
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillText(state.detections === 0 ? 'GHOST — NEVER SEEN' : 'OUT — BUT SEEN', CANVAS_WIDTH / 2, 250);
  ctx.fillStyle = '#f2e6c8';
  ctx.font = '22px sans-serif';
  ctx.fillText(`All ten relics stolen in ${formatTime(state.elapsed)}. Score ${state.score}.`, CANVAS_WIDTH / 2, 310);
  ctx.fillText(
    state.detections === 0
      ? 'No guard ever raised the alarm. The gallery never knew you were there. Ghost bonus +500.'
      : `The alarm rose ${state.detections} time${state.detections > 1 ? 's' : ''} — the gallery knows someone came.`,
    CANVAS_WIDTH / 2, 344,
  );
  ctx.fillStyle = '#3fd8c2';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press R to run it again', CANVAS_WIDTH / 2, 420);
}

function drawCaught(ctx, state) {
  ctx.fillStyle = 'rgba(20, 5, 5, 0.8)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4a';
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillText('CAUGHT', CANVAS_WIDTH / 2, 250);
  ctx.fillStyle = '#f2e6c8';
  ctx.font = '22px sans-serif';
  ctx.fillText(`${state.caughtBy} caught Wren in the lamplight.`, CANVAS_WIDTH / 2, 310);
  ctx.fillText('Watch the patrols. Wait for the cone to turn. Sneak through the dark.', CANVAS_WIDTH / 2, 344);
  ctx.fillStyle = '#f2e6c8';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Score ${state.score} · Relics ${state.player.relicsTaken} this wing · Wing ${state.wingIndex + 1}/3 · ${formatTime(state.elapsed)}`, CANVAS_WIDTH / 2, 382);
  ctx.fillStyle = '#3fd8c2';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press R to try again', CANVAS_WIDTH / 2, 420);
}

/** Draw one frame of the game. */
export function drawGame(ctx, state) {
  const { level, player, guards } = state;
  const time = state.time;
  drawFloor(ctx, level, time);
  drawSolids(ctx, level);
  drawPlants(ctx, level, time);
  drawRelicsAndExit(ctx, level, time);
  for (let i = 0; i < guards.length; i += 1) drawVisionCone(ctx, level, guards[i]);
  for (let i = 0; i < guards.length; i += 1) drawGuard(ctx, guards[i], time);
  drawPlayer(ctx, player, time);
  drawShadowOverlay(ctx, level);
  // Re-draw the lit essentials over the shadow so they stay readable.
  for (let i = 0; i < guards.length; i += 1) drawGuard(ctx, guards[i], time);
  drawPlayer(ctx, player, time);
  drawPebbles(ctx, state.thrownPebbles);
  drawHud(ctx, state);
  if (state.screen === SCREEN_TITLE) drawTitle(ctx, state);
  else if (state.screen === SCREEN_WIN) drawWin(ctx, state);
  else if (state.screen === SCREEN_CAUGHT) drawCaught(ctx, state);
}
