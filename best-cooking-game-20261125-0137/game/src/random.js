export function createRandom(seed = 1) {
  let state = (seed >>> 0) || 1;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, maxInclusive) {
    return min + Math.floor(next() * (maxInclusive - min + 1));
  }

  function float(min, max) {
    return min + next() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }

  function getState() {
    return state >>> 0;
  }

  function setState(nextState) {
    state = (nextState >>> 0) || 1;
  }

  return { next, int, float, pick, getState, setState };
}

export function pickWeightedIngredient(rng, weightedEntries) {
  let total = 0;
  for (const entry of weightedEntries) {
    total += Math.max(0, entry.weight);
  }
  if (total <= 0) return weightedEntries[0]?.item ?? null;
  let roll = rng.next() * total;
  for (const entry of weightedEntries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.item;
  }
  return weightedEntries[weightedEntries.length - 1].item;
}

export function shuffleRecipeDeck(rng, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
