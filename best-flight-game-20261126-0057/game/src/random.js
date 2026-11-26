export function createRandom(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededNoise2D(seed, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = fade(tx);
  const sy = fade(ty);
  const a = hashCorner(seed, x0, y0);
  const b = hashCorner(seed, x0 + 1, y0);
  const c = hashCorner(seed, x0, y0 + 1);
  const d = hashCorner(seed, x0 + 1, y0 + 1);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

export function seededPick(random, items) {
  if (!items || items.length === 0) return null;
  const index = Math.floor(random() * items.length) % items.length;
  return items[index];
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function hashCorner(seed, ix, iy) {
  let h = (seed >>> 0) ^ Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
