export const FLIGHT_VIEWPORT = Object.freeze({
  width: 1280,
  height: 720,
  step: 1 / 60,
  maxCatchUp: 0.25,
  backgroundWidth: 640,
  backgroundHeight: 360,
  focalLength: 700,
  horizonBase: 360,
  horizonPitchScale: 8,
  horizonMin: 120,
  horizonMax: 560
});

export const TERRAIN_PARAMS = Object.freeze({
  seed: 7,
  size: 6000,
  halfSize: 3000,
  gridResolution: 257,
  waterLevel: 0,
  maxViewDistance: 4200,
  backgroundFovDeg: 35,
  sunElevationDeg: 28,
  islands: Object.freeze([
    Object.freeze({ name: 'Ember Caldera', cx: -850, cz: -700, radius: 780, peak: 520, roughness: 70, kind: 'volcanic' }),
    Object.freeze({ name: 'Palm Shoal', cx: 950, cz: -350, radius: 650, peak: 74, roughness: 16, kind: 'flat' }),
    Object.freeze({ name: 'Ridge Crest', cx: 350, cz: 1150, radius: 800, peak: 410, roughness: 130, kind: 'mountain' }),
    Object.freeze({ name: 'Lagoon Atoll', cx: -650, cz: 950, radius: 520, peak: 46, roughness: 12, kind: 'flat' })
  ]),
  runways: Object.freeze([
    Object.freeze({ id: 'palm', name: 'Palm Shoal', cx: 950, cz: -350, heading: 90, length: 700, width: 30, role: 'main' }),
    Object.freeze({ id: 'lagoon', name: 'Lagoon Atoll', cx: -650, cz: 950, heading: 192, length: 200, width: 20, role: 'rescue' }),
    Object.freeze({ id: 'ridge', name: 'Ridge Crest', cx: 350, cz: 1150, heading: 60, length: 300, width: 24, role: 'survey' })
  ])
});

export const SPEED_ENVELOPE = Object.freeze({
  maxLevel: 90,
  cruise: 65,
  stallBase: 28,
  stallFlaps: 24,
  neverExceed: 120,
  knotsPerMetreSecond: 1.94384,
  feetPerMetre: 3.28084,
  liftSpeedFloor: 0.45,
  liftSpeedCeiling: 1.0,
  rotateSpeed: 32,
  touchdownMinSpeed: 24,
  touchdownMaxSpeed: 45,
  softVerticalLimit: -3,
  hardVerticalLimit: -5,
  crashVerticalLimit: -8,
  brakeDecel: 5,
  fuelBurnIdle: 0.08,
  fuelBurnThrottle: 0.12
});

export const HUD_LAYOUT = Object.freeze({
  pills: Object.freeze({
    alt: Object.freeze({ x: 24, y: 16, w: 210, h: 36 }),
    spd: Object.freeze({ x: 246, y: 16, w: 190, h: 36 }),
    hdg: Object.freeze({ x: 448, y: 16, w: 170, h: 36 })
  }),
  missionBrief: Object.freeze({ x: 900, y: 16, w: 356, h: 140 }),
  fuelBar: Object.freeze({ labelX: 24, labelY: 600, x: 24, y: 620, w: 240, h: 14 }),
  healthBar: Object.freeze({ labelX: 24, labelY: 636, x: 24, y: 652, w: 240, h: 14 }),
  cluster: Object.freeze({ x: 500, y: 570, w: 280, h: 130 }),
  gauges: Object.freeze({ radius: 42, centres: Object.freeze([556, 640, 724]), y: 632 }),
  compass: Object.freeze({ x: 460, y: 536, w: 360, h: 30 }),
  score: Object.freeze({ x: 1050, y: 664, w: 206, h: 36 }),
  warnings: Object.freeze({ x: 640, y: 300 }),
  banner: Object.freeze({ x: 340, y: 124, w: 600, h: 90 })
});

export const ISLAND_PALETTE = Object.freeze({
  deepWater: '#0b3d66',
  shallowWater: '#1b6f9e',
  sand: '#d9c27a',
  coastEdge: '#b8a05c',
  grass: '#5da24a',
  rock: '#7a6a58',
  snow: '#eef2f5',
  haze: '#cfe3ee',
  skyTop: '#2f6fb0',
  skyHorizon: '#cfe6f2',
  sun: '#fff2b0',
  cloud: '#f7fbff',
  runway: '#3b3f45',
  runwayLine: '#e9edf2',
  runwayEdgeGreen: '#46d06a',
  runwayEdgeRed: '#e2534b',
  papiRed: '#e2534b',
  papiWhite: '#f4f7fb',
  ringOrange: '#ff9b3d',
  ringGreen: '#48e07a',
  panel: 'rgba(10,14,24,0.72)',
  cluster: 'rgba(10,10,20,0.75)',
  banner: 'rgba(20,16,13,0.86)'
});
