import { pickWeightedIngredient } from './random.js';

export const INGREDIENTS_ON_COUNTER = [
  { id: 'lamb', name: 'Lamb', short: 'Lamb', kind: 'raw', key: '1', color: '#c84b44', accent: '#f3b7a4', bin: 0 },
  { id: 'mushroom', name: 'King Mushroom', short: 'Mushroom', kind: 'raw', key: '2', color: '#d7c3a1', accent: '#7a5a3a', bin: 1 },
  { id: 'prawn', name: 'Citrus Prawn', short: 'Prawn', kind: 'raw', key: '3', color: '#f28258', accent: '#ffd36b', bin: 2 },
  { id: 'pepper', name: 'Bell Pepper', short: 'Pepper', kind: 'raw', key: '4', color: '#e34832', accent: '#f5b836', bin: 3 },
  { id: 'flatbread', name: 'Flatbread', short: 'Flatbread', kind: 'base', key: '5', color: '#dfba7c', accent: '#91602c', bin: 4 },
  { id: 'rice', name: 'Crisped Rice Cake', short: 'Rice Cake', kind: 'base', key: '6', color: '#f3ebd3', accent: '#cf9b44', bin: 5 },
];

export const GLAZE_CATALOG = [
  { id: 'herb', name: 'Garlic Herb Oil', short: 'Herb Oil', color: '#6ec458', rim: '#c7f09b' },
  { id: 'pomegranate', name: 'Pomegranate Reduction', short: 'Pomegranate', color: '#b52245', rim: '#f0718d' },
  { id: 'sesame', name: 'Toasted Sesame Soy', short: 'Sesame Soy', color: '#9c5c26', rim: '#e6b267' },
];

export const HEARTH_RECIPES = buildAllHearthRecipes();

export function composePlatterRecipe(baseCarb, skewerPair, glaze) {
  const pair = skewerPair.slice().sort();
  return (
    HEARTH_RECIPES.find(
      (r) => r.baseCarb === baseCarb && r.glaze === glaze && r.skewers[0] === pair[0] && r.skewers[1] === pair[1],
    ) ?? null
  );
}

export function matchDishToTicket(dish, tickets) {
  if (!dish || !tickets || tickets.length === 0) return null;
  const pair = (dish.skewers ?? []).slice().sort();
  let best = null;
  let bestIndex = -1;
  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    const r = t.recipe;
    const match =
      r.baseCarb === dish.baseCarb &&
      r.glaze === dish.glaze &&
      r.skewers[0] === pair[0] &&
      r.skewers[1] === pair[1];
    if (match && (best === null || t.fuseRemaining < best.fuseRemaining)) {
      best = t;
      bestIndex = i;
    }
  }
  return best ? { ticket: best, index: bestIndex } : null;
}

export function getIngredientById(id) {
  return INGREDIENTS_ON_COUNTER.find((entry) => entry.id === id) ?? null;
}

export function getGlazeById(id) {
  return GLAZE_CATALOG.find((entry) => entry.id === id) ?? null;
}

export function pickTicketRecipe(rng, phase) {
  const baseCarb = rng.next() < 0.55 ? 'flatbread' : 'rice';
  const weights =
    phase === 1
      ? [
          { item: 'lamb', weight: 3 },
          { item: 'pepper', weight: 3 },
          { item: 'mushroom', weight: 2 },
          { item: 'prawn', weight: 2 },
        ]
      : [
          { item: 'lamb', weight: 2.5 },
          { item: 'mushroom', weight: 2.5 },
          { item: 'prawn', weight: 2.5 },
          { item: 'pepper', weight: 2.5 },
        ];
  const first = pickWeightedIngredient(rng, weights);
  const remaining = weights.filter((w) => w.item !== first);
  const second = pickWeightedIngredient(rng, remaining);
  const glaze = rng.pick(GLAZE_CATALOG).id;
  return composePlatterRecipe(baseCarb, [first, second], glaze);
}

function buildAllHearthRecipes() {
  const bases = ['flatbread', 'rice'];
  const toppings = ['lamb', 'mushroom', 'prawn', 'pepper'];
  const pairs = [];
  for (let i = 0; i < toppings.length; i++) {
    for (let j = i + 1; j < toppings.length; j++) {
      pairs.push([toppings[i], toppings[j]].sort());
    }
  }
  const recipes = [];
  for (const baseCarb of bases) {
    for (const pair of pairs) {
      for (const glazeObj of GLAZE_CATALOG) {
        const title = nameForCombination(baseCarb, pair, glazeObj.id);
        recipes.push({
          id: `${baseCarb}_${pair[0]}_${pair[1]}_${glazeObj.id}`,
          title,
          baseCarb,
          skewers: pair,
          glaze: glazeObj.id,
          glazeName: glazeObj.name,
        });
      }
    }
  }
  return recipes;
}

function nameForCombination(baseCarb, pair, glaze) {
  const key = `${baseCarb}:${pair.join('+')}`;
  const glazeTag = glaze === 'herb' ? 'Herb' : glaze === 'pomegranate' ? 'Pomegranate' : 'Sesame';
  if (key === 'flatbread:lamb+pepper') return 'Charred Pepper & Lamb Flatbread';
  if (key === 'flatbread:lamb+mushroom') return 'Ember Lamb Skewer Platter';
  if (key === 'flatbread:lamb+prawn') return `Ember Lamb & Prawn Platter`;
  if (key === 'rice:mushroom+prawn') return 'Glazed King Mushroom & Prawn Rice';
  if (key === 'rice:lamb+pepper') return `${glazeTag} Lamb & Pepper Rice`;
  if (key === 'rice:lamb+mushroom') return `Ember Lamb & Mushroom Rice`;
  if (key === 'rice:lamb+prawn') return `${glazeTag} Lamb & Prawn Rice`;
  if (key === 'flatbread:mushroom+prawn') return `${glazeTag} Mushroom & Prawn Flatbread`;
  if (key === 'flatbread:mushroom+pepper') return `${glazeTag} Mushroom & Pepper Flatbread`;
  if (key === 'flatbread:pepper+prawn') return `${glazeTag} Prawn & Pepper Flatbread`;
  if (key === 'rice:mushroom+pepper') return `${glazeTag} Mushroom & Pepper Rice`;
  return `${glazeTag} Prawn & Pepper Rice`;
}
