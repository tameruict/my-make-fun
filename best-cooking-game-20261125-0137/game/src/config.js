export const KITCHEN_VIEWPORT = {
  width: 1280,
  height: 720,
  step: 1 / 60,
  maxCatchup: 0.25,
  chefSpeed: 340,
  interactRange: 102,
};

export const SHIFT_TIMER_SECONDS = 180;

export const HEARTH_PALETTE = {
  bgNight: '#120f0d',
  floorStone: '#1e1915',
  floorTile: '#27201b',
  counterBase: '#2d241e',
  counterTop: '#3e3127',
  counterEdge: '#594638',
  cedar: '#7e4e2d',
  cedarDark: '#5b361d',
  ceramic: '#efe8da',
  ceramicRim: '#c9bba3',
  brass: '#dca448',
  brassDark: '#9a6b24',
  parchment: '#f5ebd6',
  parchmentShadow: '#d8c7a8',
  ink: '#211812',
  creamText: '#f6efe3',
  mutedText: '#bcae9a',
  ember: '#ff5c1a',
  emberDeep: '#b8250b',
  flameGold: '#ffbe3d',
  emerald: '#32c478',
  amber: '#f0a024',
  crimson: '#e04338',
  bannerBg: 'rgba(20, 16, 13, 0.86)',
  plaqueBg: 'rgba(20, 16, 13, 0.92)',
  font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const STATION_ZONES = {
  orderBoard: { x: 28, y: 12, w: 748, h: 106, label: 'ORDER BOARD' },
  shiftClock: { x: 870, y: 64, r: 44 },
  hudPanel: { x: 930, y: 12, w: 322, h: 106 },
  dockedBanner: { x: 340, y: 124, w: 600, h: 90 },
  pantry: {
    x: 28,
    y: 140,
    w: 250,
    h: 280,
    label: 'PANTRY INGREDIENTS',
    accessX: 306,
    accessY: 280,
  },
  chopping: {
    x: 28,
    y: 440,
    w: 250,
    h: 180,
    label: 'CHOPPING BLOCK',
    blockX: 153,
    blockY: 536,
    accessX: 306,
    accessY: 530,
  },
  hearth: {
    x: 470,
    y: 210,
    w: 340,
    h: 270,
    cx: 640,
    cy: 346,
    outerR: 102,
    slotR: 72,
    avoidR: 124,
    label: 'CHARCOAL HEARTH',
  },
  assembly: {
    x: 310,
    y: 525,
    w: 660,
    h: 170,
    label: 'MID-ASSEMBLY PREP',
    mats: [
      { id: 'A', x: 406, y: 616, w: 156, h: 112, accessX: 406, accessY: 492 },
      { id: 'B', x: 594, y: 616, w: 156, h: 112, accessX: 594, accessY: 492 },
    ],
    glazes: [
      { id: 'herb', name: 'Garlic Herb Oil', short: 'Herb Oil', x: 742, y: 618, accessX: 742, accessY: 492 },
      { id: 'pomegranate', name: 'Pomegranate Reduction', short: 'Pomegranate', x: 828, y: 618, accessX: 828, accessY: 492 },
      { id: 'sesame', name: 'Toasted Sesame Soy', short: 'Sesame Soy', x: 914, y: 618, accessX: 914, accessY: 492 },
    ],
  },
  pass: {
    x: 1002,
    y: 140,
    w: 250,
    h: 298,
    label: 'READY TO SERVE',
    slots: [
      { index: 0, x: 1084, y: 222, accessX: 972, accessY: 222 },
      { index: 1, x: 1084, y: 326, accessX: 972, accessY: 326 },
    ],
    plateStack: { x: 1198, y: 266 },
    bell: { x: 1126, y: 400, accessX: 972, accessY: 400 },
  },
  compost: {
    x: 1002,
    y: 454,
    w: 250,
    h: 166,
    cx: 1127,
    cy: 540,
    accessX: 972,
    accessY: 540,
    label: 'COMPOST CHUTE',
  },
};

export const FLOOR_BOUNDS = {
  minX: 298,
  maxX: 982,
  minY: 136,
  maxY: 504,
};

export const CHOP_STROKES = 4;
export const HEARTH_ROTATION_DEG_PER_SEC = 15;
export const BASE_COOK_RATE = 1 / 8.75;
export const GOLDEN_WINDOW = { min: 0.65, max: 0.90 };

export const SCORE_RULES = {
  baseDish: 120,
  maxSpeedTip: 80,
  goldenFlipBonus: 30,
  doubleBellBonus: 50,
  vipBonus: 40,
  penalty: 40,
  maxCombo: 4,
  maxHearts: 4,
};

export const STAR_THRESHOLDS = [600, 1400, 2400];

export const DIFFICULTY_PHASES = [
  { phase: 1, start: 0, end: 45, name: 'EARLY PREP', maxTickets: 2, fuse: 38, hearthMult: 1.0, frontBonus: 1.0 },
  { phase: 2, start: 45, end: 120, name: 'MID-SHIFT SERVICE', maxTickets: 3, fuse: 32, hearthMult: 1.0, frontBonus: 1.2 },
  { phase: 3, start: 120, end: 180, name: 'PEAK DINNER RUSH', maxTickets: 4, fuse: 26, hearthMult: 1.35, frontBonus: 1.0 },
];
