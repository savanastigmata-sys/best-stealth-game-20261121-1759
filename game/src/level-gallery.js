// Nightshade Gallery — the level itself: one hand-built museum floor.
// Walls and display plinths block movement and block a guard's line of sight,
// so they are the cover the player hides behind. Potted shade-ferns are soft
// cover: standing inside one hides the player unless a guard is very close.
// Lamplight pools are bright ground; the dark floor between them is shadow.
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';

function rect(x, y, w, h) {
  return { x, y, w, h };
}

export function buildGalleryLevel() {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const walls = [
    // Outer shell.
    rect(0, 0, W, 40),
    rect(0, H - 40, W, 40),
    rect(0, 0, 40, H),
    rect(W - 40, 0, 40, H),
    // West wing divider: door gap y 300..380.
    rect(420, 40, 36, 260),
    rect(420, 380, 36, 300),
    // East wing divider: door gap y 240..340.
    rect(840, 340, 36, 340),
    rect(840, 40, 36, 200),
    // North hall divider: door gap x 200..280.
    rect(40, 360, 160, 36),
    rect(280, 360, 140, 36),
    // South hall divider: door gap x 1000..1080.
    rect(876, 200, 124, 36),
    rect(1080, 200, 160, 36),
    // Free-standing pillars that split sightlines.
    rect(600, 420, 36, 120),
    rect(1080, 420, 36, 120),
  ];
  // Display plinths: solid cover, waist-high, they stop a lantern cone.
  const plinths = [
    rect(220, 140, 64, 40),
    rect(560, 140, 64, 40),
    rect(980, 300, 64, 40),
    rect(180, 480, 64, 40),
    rect(520, 250, 64, 40),
    rect(700, 480, 64, 40),
    rect(980, 560, 64, 40),
    rect(1120, 440, 64, 40),
    rect(320, 600, 64, 40),
    rect(640, 260, 64, 40),
  ];
  // Shade-ferns: hide inside them and a guard's cone barely notices you.
  const plants = [
    { x: 140, y: 300, r: 30 },
    { x: 350, y: 220, r: 28 },
    { x: 770, y: 130, r: 28 },
    { x: 920, y: 470, r: 30 },
    { x: 560, y: 620, r: 28 },
    { x: 1180, y: 330, r: 26 },
    { x: 120, y: 540, r: 26 },
  ];
  // Wall lamps: warm pools of light where the player is easier to spot.
  const lamps = [
    { x: 300, y: 130, r: 130 },
    { x: 640, y: 540, r: 130 },
    { x: 1060, y: 130, r: 130 },
    { x: 1060, y: 570, r: 120 },
    { x: 200, y: 560, r: 120 },
    { x: 760, y: 330, r: 110 },
  ];
  // The three Moonlit Relics, each on its own pedestal.
  const relics = [
    { id: 'moon-pearl', name: 'Moon Pearl', x: 1150, y: 110, taken: false },
    { id: 'ember-idol', name: 'Ember Idol', x: 640, y: 110, taken: false },
    { id: 'star-locket', name: 'Star Locket', x: 180, y: 180, taken: false },
  ];
  // The green service door: it only opens once all three relics are taken.
  const exit = rect(1150, 635, 80, 40);
  const playerStart = { x: 92, y: 620 };
  // Five guards, each with a named patrol route the player can learn.
  const guardSpawns = [
    {
      name: 'Bram', color: '#e8b23a',
      route: [{ x: 500, y: 120 }, { x: 760, y: 120 }, { x: 760, y: 230 }, { x: 500, y: 230 }],
    },
    {
      name: 'Odo', color: '#e07840',
      route: [{ x: 480, y: 430 }, { x: 480, y: 620 }, { x: 760, y: 620 }, { x: 760, y: 430 }],
    },
    {
      name: 'Mirelle', color: '#d8e84a',
      route: [{ x: 920, y: 120 }, { x: 1180, y: 120 }, { x: 1180, y: 280 }, { x: 920, y: 280 }],
    },
    {
      name: 'Kess', color: '#7ab8ff',
      route: [{ x: 120, y: 110 }, { x: 330, y: 110 }, { x: 330, y: 320 }, { x: 120, y: 320 }],
    },
    {
      name: 'Tarn', color: '#e07ab8',
      route: [{ x: 560, y: 540 }, { x: 1140, y: 540 }, { x: 1120, y: 660 }, { x: 560, y: 660 }],
    },
  ];
  // Faint dotted routes drawn on the floor, so patrols can be learned.
  const guardRoutes = guardSpawns.map((s) => ({ color: s.color, points: s.route }));
  return { walls, plinths, plants, lamps, relics, exit, playerStart, guardSpawns, guardRoutes };
}

export function buildArchiveLevel() {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  const walls = [
    // Outer shell.
    rect(0, 0, W, 40),
    rect(0, H - 40, W, 40),
    rect(0, 0, 40, H),
    rect(W - 40, 0, 40, H),
    // North hall: door gap x 280..360.
    rect(40, 200, 240, 36),
    rect(360, 200, 200, 36),
    // Middle spine: door gaps y 200..280 and y 480..560.
    rect(700, 40, 36, 160),
    rect(700, 280, 36, 200),
    rect(700, 560, 36, 120),
    // East store: door gap y 400..480.
    rect(1040, 200, 36, 200),
    rect(1040, 480, 36, 200),
    // Free-standing pillars.
    rect(300, 420, 36, 120),
    rect(900, 420, 36, 120),
    rect(560, 100, 36, 80),
  ];
  const plinths = [
    rect(220, 120, 64, 40),
    rect(480, 120, 64, 40),
    rect(820, 120, 64, 40),
    rect(1120, 120, 64, 40),
    rect(180, 300, 64, 40),
    rect(480, 300, 64, 40),
    rect(820, 300, 64, 40),
    rect(1120, 300, 64, 40),
    rect(220, 480, 64, 40),
    rect(480, 560, 64, 40),
    rect(820, 560, 64, 40),
    rect(1120, 560, 64, 40),
  ];
  const plants = [
    { x: 140, y: 130, r: 28 },
    { x: 620, y: 260, r: 28 },
    { x: 940, y: 130, r: 28 },
    { x: 140, y: 420, r: 30 },
    { x: 620, y: 460, r: 28 },
    { x: 940, y: 600, r: 28 },
    { x: 1180, y: 420, r: 26 },
  ];
  // The Archive burns brighter: more lamplight, less safe dark.
  const lamps = [
    { x: 300, y: 130, r: 135 },
    { x: 640, y: 130, r: 135 },
    { x: 1060, y: 130, r: 135 },
    { x: 200, y: 420, r: 130 },
    { x: 640, y: 460, r: 130 },
    { x: 1060, y: 460, r: 130 },
    { x: 860, y: 300, r: 120 },
  ];
  const relics = [
    { id: 'ember-ruby', name: 'Ember Ruby', x: 1150, y: 110, taken: false },
    { id: 'cinder-opal', name: 'Cinder Opal', x: 180, y: 110, taken: false },
    { id: 'ash-sapphire', name: 'Ash Sapphire', x: 1150, y: 610, taken: false },
    { id: 'coal-diamond', name: 'Coal Diamond', x: 640, y: 620, taken: false },
  ];
  const exit = rect(1150, 635, 80, 40);
  const playerStart = { x: 92, y: 620 };
  const guardSpawns = [
    {
      name: 'Bram', color: '#e8b23a',
      route: [{ x: 200, y: 90 }, { x: 440, y: 90 }, { x: 440, y: 280 }, { x: 200, y: 280 }],
    },
    {
      name: 'Odo', color: '#e07840',
      route: [{ x: 780, y: 90 }, { x: 1100, y: 90 }, { x: 1100, y: 280 }, { x: 780, y: 280 }],
    },
    {
      name: 'Mirelle', color: '#d8e84a',
      route: [{ x: 200, y: 390 }, { x: 440, y: 390 }, { x: 440, y: 620 }, { x: 200, y: 620 }],
    },
    {
      name: 'Kess', color: '#7ab8ff',
      route: [{ x: 780, y: 390 }, { x: 1100, y: 390 }, { x: 1100, y: 620 }, { x: 780, y: 620 }],
    },
    {
      name: 'Tarn', color: '#e07ab8',
      route: [{ x: 620, y: 120 }, { x: 620, y: 620 }, { x: 760, y: 620 }, { x: 760, y: 120 }],
    },
    {
      name: 'Voss', color: '#9fe870',
      route: [{ x: 120, y: 70 }, { x: 620, y: 70 }, { x: 620, y: 255 }, { x: 120, y: 255 }],
    },
  ];
  const guardRoutes = guardSpawns.map((s) => ({ color: s.color, points: s.route }));
  return { walls, plinths, plants, lamps, relics, exit, playerStart, guardSpawns, guardRoutes, patrolSpeedMul: 1.1 };
}

export function buildVaultLevel() {
  const W = CANVAS_WIDTH;
  const H = CANVAS_HEIGHT;
  // The Vault reuses the Gallery's proven walls — the same floor plan, a
  // darker night: fewer lamps, more ferns, faster patrols, new relics.
  // The shape is familiar; the timing is not.
  const walls = [
    // Outer shell.
    rect(0, 0, W, 40),
    rect(0, H - 40, W, 40),
    rect(0, 0, 40, H),
    rect(W - 40, 0, 40, H),
    // West wing divider: door gap y 300..380.
    rect(420, 40, 36, 260),
    rect(420, 380, 36, 300),
    // East wing divider: door gap y 240..340.
    rect(840, 340, 36, 340),
    rect(840, 40, 36, 200),
    // North hall divider: door gap x 200..280.
    rect(40, 360, 160, 36),
    rect(280, 360, 140, 36),
    // South hall divider: door gap x 1000..1080.
    rect(876, 200, 124, 36),
    rect(1080, 200, 160, 36),
    // Free-standing pillars that split sightlines.
    rect(600, 420, 36, 120),
    rect(1080, 420, 36, 120),
  ];
  const plinths = [
    rect(180, 140, 64, 40),
    rect(520, 140, 64, 40),
    rect(940, 300, 64, 40),
    rect(220, 460, 64, 40),
    rect(480, 260, 64, 40),
    rect(660, 500, 64, 40),
    rect(1020, 560, 64, 40),
    rect(1160, 460, 64, 40),
    rect(360, 580, 64, 40),
    rect(680, 280, 64, 40),
  ];
  const plants = [
    { x: 120, y: 260, r: 30 },
    { x: 340, y: 180, r: 28 },
    { x: 780, y: 120, r: 28 },
    { x: 940, y: 460, r: 30 },
    { x: 580, y: 600, r: 28 },
    { x: 1180, y: 320, r: 26 },
    { x: 140, y: 560, r: 26 },
    { x: 900, y: 620, r: 28 },
  ];
  // The Vault is dark: few lamps, long shadow to work in.
  const lamps = [
    { x: 300, y: 130, r: 120 },
    { x: 640, y: 540, r: 120 },
    { x: 1060, y: 130, r: 120 },
    { x: 1060, y: 570, r: 110 },
    { x: 760, y: 330, r: 110 },
  ];
  // Same pedestals as the Gallery, new relics: the run is the same shape.
  const relics = [
    { id: 'nova-idol', name: 'Nova Idol', x: 1150, y: 110, taken: false },
    { id: 'star-locket', name: 'Star Locket', x: 640, y: 110, taken: false },
    { id: 'comet-pearl', name: 'Comet Pearl', x: 180, y: 180, taken: false },
  ];
  const exit = rect(1150, 635, 80, 40);
  const playerStart = { x: 92, y: 620 };
  const guardSpawns = [
    {
      name: 'Bram', color: '#e8b23a',
      route: [{ x: 500, y: 120 }, { x: 760, y: 120 }, { x: 760, y: 230 }, { x: 500, y: 230 }],
    },
    {
      name: 'Odo', color: '#e07840',
      route: [{ x: 480, y: 430 }, { x: 480, y: 620 }, { x: 760, y: 620 }, { x: 760, y: 430 }],
    },
    {
      name: 'Mirelle', color: '#d8e84a',
      route: [{ x: 920, y: 120 }, { x: 1180, y: 120 }, { x: 1180, y: 280 }, { x: 920, y: 280 }],
    },
    {
      name: 'Kess', color: '#7ab8ff',
      route: [{ x: 120, y: 110 }, { x: 330, y: 110 }, { x: 330, y: 320 }, { x: 120, y: 320 }],
    },
    {
      name: 'Tarn', color: '#e07ab8',
      route: [{ x: 560, y: 540 }, { x: 1140, y: 540 }, { x: 1120, y: 660 }, { x: 560, y: 660 }],
    },
  ];
  const guardRoutes = guardSpawns.map((s) => ({ color: s.color, points: s.route }));
  return { walls, plinths, plants, lamps, relics, exit, playerStart, guardSpawns, guardRoutes, patrolSpeedMul: 1.25 };
}

// The three wings of one heist, in order: 10 relics, 16 guards, one night.
export const WINGS = [
  { id: 'gallery', name: '1 · MOONLIT GALLERY', short: 'Gallery', build: buildGalleryLevel },
  { id: 'archive', name: '2 · EMBER ARCHIVE', short: 'Archive', build: buildArchiveLevel },
  { id: 'vault', name: '3 · STAR VAULT', short: 'Vault', build: buildVaultLevel },
];

export function buildWing(index) {
  return WINGS[index].build();
}

/** Every solid rectangle in the level: walls plus plinths. */
export function solidRects(level) {
  return level.walls.concat(level.plinths);
}

/** True when the point sits inside a solid rectangle. */
export function pointInSolids(level, x, y) {
  const solids = solidRects(level);
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/** True when the circle at (x, y) with radius r touches any solid rectangle. */
export function circleHitsSolid(level, x, y, r) {
  const solids = solidRects(level);
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    const cx = Math.max(s.x, Math.min(x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Move a circle, sliding along solids instead of sticking to them. */
export function moveWithCollision(level, x, y, r, dx, dy) {
  const nx = x + dx;
  if (!circleHitsSolid(level, nx, y, r)) x = nx;
  const ny = y + dy;
  if (!circleHitsSolid(level, x, ny, r)) y = ny;
  return { x, y };
}

/** The plant the point stands inside, or null. */
export function plantAt(level, x, y) {
  for (let i = 0; i < level.plants.length; i += 1) {
    const p = level.plants[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < p.r * p.r) return p;
  }
  return null;
}

/** True when the point stands in a lamplight pool. */
export function inLamplight(level, x, y) {
  for (let i = 0; i < level.lamps.length; i += 1) {
    const lamp = level.lamps[i];
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    if (dx * dx + dy * dy < lamp.r * lamp.r) return true;
  }
  return false;
}
