import { TERRAIN_PARAMS } from './config.js';
import { seededNoise2D } from './random.js';

export function generateIslandTerrain(seed) {
  const params = TERRAIN_PARAMS;
  const res = params.gridResolution;
  const size = params.size;
  const half = params.halfSize;
  const cell = size / (res - 1);
  const heights = new Float32Array(res * res);

  for (let iz = 0; iz < res; iz += 1) {
    const z = -half + iz * cell;
    for (let ix = 0; ix < res; ix += 1) {
      const x = -half + ix * cell;
      heights[iz * res + ix] = rawHeightAt(seed, x, z);
    }
  }

  const terrain = {
    seed,
    size,
    halfSize: half,
    resolution: res,
    cell,
    heights,
    waterLevel: params.waterLevel,
    islands: params.islands.map((island) => ({ ...island })),
    runways: []
  };

  for (const spec of params.runways) {
    const sampled = sampleHeightGrid(terrain, spec.cx, spec.cz);
    const elevation = Math.max(8, sampled);
    const runway = createRunwayStrip({ ...spec, elevation });
    terrain.runways.push(runway);
    flattenRunway(terrain, runway);
  }

  return terrain;
}

export function getTerrainHeight(terrain, x, z) {
  if (!terrain || !terrain.heights) return -20;
  const half = terrain.halfSize;
  if (x < -half || x > half || z < -half || z > half) return -20;
  return sampleHeightGrid(terrain, x, z);
}

export function createRunwayStrip(spec) {
  const heading = wrapDegrees(spec.heading || 0);
  const rad = (heading * Math.PI) / 180;
  return {
    id: spec.id || 'runway',
    name: spec.name || 'Runway',
    role: spec.role || 'main',
    cx: spec.cx,
    cz: spec.cz,
    heading,
    length: spec.length,
    width: spec.width,
    elevation: spec.elevation ?? 20,
    forward: { x: Math.sin(rad), z: -Math.cos(rad) },
    right: { x: Math.cos(rad), z: Math.sin(rad) }
  };
}

export function placeTargetRing(spec) {
  return {
    x: spec.x,
    z: spec.z,
    y: spec.altitude ?? spec.y ?? 150,
    radius: spec.radius ?? 40,
    passed: false,
    pulseSeed: spec.pulseSeed ?? 0
  };
}

export function runwayLocalCoordinates(runway, x, z) {
  const dx = x - runway.cx;
  const dz = z - runway.cz;
  return {
    along: dx * runway.forward.x + dz * runway.forward.z,
    across: dx * runway.right.x + dz * runway.right.z
  };
}

export function isOnRunway(runway, x, z, pad = 0) {
  const local = runwayLocalCoordinates(runway, x, z);
  return (
    Math.abs(local.along) <= runway.length / 2 + pad &&
    Math.abs(local.across) <= runway.width / 2 + pad
  );
}

export function findRunwayForPoint(terrain, x, z, pad = 4) {
  if (!terrain || !terrain.runways) return null;
  for (const runway of terrain.runways) {
    if (isOnRunway(runway, x, z, pad)) return runway;
  }
  return null;
}

export function sampleHeightGrid(terrain, x, z) {
  const res = terrain.resolution;
  const half = terrain.halfSize;
  const cell = terrain.cell;
  const gx = clampNumber((x + half) / cell, 0, res - 1.000001);
  const gz = clampNumber((z + half) / cell, 0, res - 1.000001);
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const i0 = iz * res + ix;
  const i1 = i0 + 1;
  const i2 = i0 + res;
  const i3 = i2 + 1;
  const h = terrain.heights;
  const top = h[i0] + (h[i1] - h[i0]) * fx;
  const bottom = h[i2] + (h[i3] - h[i2]) * fx;
  return top + (bottom - top) * fz;
}

function rawHeightAt(seed, x, z) {
  const originDistance = Math.hypot(x, z);
  const lagoonMask = clampNumber((originDistance - 260) / 520, 0, 1);
  const seabed = -32 + (seededNoise2D(seed + 7, x / 480, z / 480) - 0.5) * 12;
  let land = 0;
  let islandCover = 0;
  for (let i = 0; i < TERRAIN_PARAMS.islands.length; i += 1) {
    const island = TERRAIN_PARAMS.islands[i];
    const dx = x - island.cx;
    const dz = z - island.cz;
    const dist = Math.hypot(dx, dz);
    if (dist >= island.radius) continue;
    const t = 1 - dist / island.radius;
    const smooth = t * t * (3 - 2 * t);
    islandCover = Math.max(islandCover, clampNumber(smooth * 1.35, 0, 1));
    let profile;
    if (island.kind === 'volcanic') profile = Math.pow(t, 2.05) + 0.16 * Math.pow(t, 8);
    else if (island.kind === 'mountain') profile = Math.pow(t, 1.55);
    else profile = Math.pow(t, 1.2) * 0.82;
    const ridge = (seededNoise2D(seed + 101 + i * 37, x / 190, z / 190) - 0.5) * 2;
    const detail = (seededNoise2D(seed + 211 + i * 53, x / 70, z / 70) - 0.5) * 2;
    land += island.peak * profile * smooth + ridge * island.roughness * smooth + detail * island.roughness * 0.22 * smooth;
  }
  const height = (seabed * (1 - islandCover) + land) * lagoonMask;
  return height;
}

function flattenRunway(terrain, runway) {
  const res = terrain.resolution;
  const half = terrain.halfSize;
  const cell = terrain.cell;
  const pad = 28;
  const blend = 45;
  const alongMax = runway.length / 2 + pad;
  const acrossMax = runway.width / 2 + pad;
  for (let iz = 0; iz < res; iz += 1) {
    const z = -half + iz * cell;
    for (let ix = 0; ix < res; ix += 1) {
      const x = -half + ix * cell;
      const local = runwayLocalCoordinates(runway, x, z);
      const da = Math.abs(local.along) - alongMax;
      const dc = Math.abs(local.across) - acrossMax;
      if (da > blend || dc > blend) continue;
      const index = iz * res + ix;
      if (da <= 0 && dc <= 0) {
        terrain.heights[index] = runway.elevation;
      } else {
        const edge = Math.max(da, dc, 0) / blend;
        const w = edge * edge * (3 - 2 * edge);
        terrain.heights[index] = runway.elevation * (1 - w) + terrain.heights[index] * w;
      }
    }
  }
}

function clampNumber(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function wrapDegrees(value) {
  let deg = value % 360;
  if (deg < 0) deg += 360;
  return deg;
}
