import { FLOOR_BOUNDS, GOLDEN_WINDOW, KITCHEN_VIEWPORT, STATION_ZONES } from './config.js';
import { getIngredientById } from './recipes.js';
import {
  assembleDishOnCounter,
  chopIngredientOnBoard,
  getHearthSlotWorldPos,
  rotateCharcoalHearth,
  spawnBurstParticles,
  spawnPopup,
  stagePlateReadyToServe,
} from './kitchen.js';
import { serveReadyPlateToTicket } from './orders.js';

export function createChefController() {
  return {
    x: 380,
    y: 360,
    radius: 18,
    facingAngle: 0,
    walkCycle: 0,
    waypoints: [],
    pendingAction: null,
  };
}

export function planKitchenRoute(from, to, hearthZone = STATION_ZONES.hearth) {
  const clamped = clampToFloor(to.x, to.y);
  const cx = hearthZone.cx;
  const cy = hearthZone.cy;
  const r = hearthZone.avoidR;

  if (!segmentIntersectsCircle(from.x, from.y, clamped.x, clamped.y, cx, cy, r - 4)) {
    return [clamped];
  }

  const ringR = r + 14;
  const nodes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const pt = clampToFloor(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
    nodes.push(pt);
  }

  const cw = buildRingPath(from, clamped, nodes, cx, cy, 1);
  const ccw = buildRingPath(from, clamped, nodes, cx, cy, -1);
  return pathLength(from, cw) <= pathLength(from, ccw) ? cw : ccw;
}

export function stepChefMovement(world, dt) {
  const chef = world.chef;
  const inp = chef.input;
  const dxIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const dyIn = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);

  let vx = 0;
  let vy = 0;

  if (dxIn !== 0 || dyIn !== 0) {
    chef.waypoints = [];
    chef.pendingAction = null;
    const len = Math.hypot(dxIn, dyIn);
    vx = (dxIn / len) * KITCHEN_VIEWPORT.chefSpeed;
    vy = (dyIn / len) * KITCHEN_VIEWPORT.chefSpeed;
  } else if (chef.waypoints.length > 0) {
    const target = chef.waypoints[0];
    const dx = target.x - chef.x;
    const dy = target.y - chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 8) {
      chef.x = target.x;
      chef.y = target.y;
      chef.waypoints.shift();
      if (chef.waypoints.length === 0 && chef.pendingAction) {
        const act = chef.pendingAction;
        chef.pendingAction = null;
        return interactWithNearestStation(world, act);
      }
    } else {
      vx = (dx / dist) * KITCHEN_VIEWPORT.chefSpeed;
      vy = (dy / dist) * KITCHEN_VIEWPORT.chefSpeed;
    }
  }

  chef.vx = vx;
  chef.vy = vy;

  if (vx !== 0 || vy !== 0) {
    chef.x += vx * dt;
    chef.y += vy * dt;
    chef.facingAngle = Math.atan2(vy, vx);
    chef.walkCycle += dt * 11;
    resolveChefCollisions(chef);
  }
  return null;
}

export function interactWithNearestStation(world, explicitTarget = null) {
  const chef = world.chef;
  const st = world.stations;

  if (explicitTarget) {
    return executeTargetAction(world, explicitTarget);
  }

  const candidates = collectStationTargets(world);
  let nearest = null;
  let bestDist = KITCHEN_VIEWPORT.interactRange;

  for (const c of candidates) {
    const d = Math.hypot(c.x - chef.x, c.y - chef.y);
    if (d < bestDist) {
      bestDist = d;
      nearest = c;
    }
  }
  if (!nearest) return { action: 'none' };
  return executeTargetAction(world, nearest);
}

export function resolveClickTarget(world, px, py) {
  const z = STATION_ZONES;

  for (let i = 0; i < 6; i++) {
    const rect = getPantryBinRect(i);
    if (pointInRect(px, py, rect.x, rect.y, rect.w, rect.h)) {
      return {
        type: 'pantry',
        index: i,
        access: { x: z.pantry.accessX, y: rect.y + rect.h / 2 },
      };
    }
  }

  if (pointInRect(px, py, z.chopping.x, z.chopping.y, z.chopping.w, z.chopping.h)) {
    return {
      type: 'chop',
      access: { x: z.chopping.accessX, y: z.chopping.accessY },
    };
  }

  for (const slot of world.stations.hearth.slots) {
    const pos = getHearthSlotWorldPos(world.stations.hearth, slot.index);
    if (Math.hypot(px - pos.x, py - pos.y) <= 30) {
      return {
        type: 'hearth_slot',
        index: slot.index,
        access: nearestFloorPoint(pos.x, pos.y),
      };
    }
  }

  if (Math.hypot(px - z.hearth.cx, py - z.hearth.cy) <= z.hearth.outerR + 8) {
    return { type: 'hearth_rotate', immediate: true };
  }

  for (let i = 0; i < z.assembly.mats.length; i++) {
    const m = z.assembly.mats[i];
    if (pointInRect(px, py, m.x - m.w / 2, m.y - m.h / 2, m.w, m.h)) {
      return {
        type: 'mat',
        index: i,
        access: { x: m.accessX, y: m.accessY },
      };
    }
  }

  for (const g of z.assembly.glazes) {
    if (Math.hypot(px - g.x, py - g.y) <= 34) {
      return {
        type: 'glaze',
        id: g.id,
        access: { x: g.accessX, y: g.accessY },
      };
    }
  }

  if (Math.hypot(px - z.pass.bell.x, py - z.pass.bell.y) <= 38) {
    return {
      type: 'bell',
      access: { x: z.pass.bell.accessX, y: z.pass.bell.accessY },
    };
  }

  for (const ps of z.pass.slots) {
    if (Math.hypot(px - ps.x, py - ps.y) <= 44) {
      return {
        type: 'pass_slot',
        index: ps.index,
        access: { x: ps.accessX, y: ps.accessY },
      };
    }
  }

  if (pointInRect(px, py, z.compost.x, z.compost.y, z.compost.w, z.compost.h)) {
    return {
      type: 'compost',
      access: { x: z.compost.accessX, y: z.compost.accessY },
    };
  }

  return { type: 'walk', access: clampToFloor(px, py) };
}

export function discardHeldItem(world) {
  if (!world.chef.heldItem) return false;
  world.chef.heldItem = null;
  world.stations.compost.flash = 1;
  world.stations.compost.discarded += 1;
  spawnBurstParticles(world, STATION_ZONES.compost.cx, STATION_ZONES.compost.cy, 8, {
    color: '#8e847b',
    kind: 'smoke',
    speedMin: 20,
    speedMax: 55,
    life: 0.45,
    size: 4.5,
  });
  return true;
}

export function getPantryBinRect(index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 40 + col * 116,
    y: 176 + row * 78,
    w: 108,
    h: 70,
  };
}

function executeTargetAction(world, target) {
  const chef = world.chef;
  const st = world.stations;

  if (target.type === 'pantry') {
    st.pantry.selectedIndex = target.index;
    st.pantry.bins[target.index].pulse = 1;
    if (!chef.heldItem) {
      const ing = getIngredientById(
        ['lamb', 'mushroom', 'prawn', 'pepper', 'flatbread', 'rice'][target.index],
      );
      chef.heldItem = {
        kind: ing.kind,
        id: ing.id,
        name: ing.name,
        state: ing.kind === 'base' ? 'ready' : 'raw',
      };
      return { action: 'pickup_pantry', id: ing.id };
    }
    return { action: 'select_pantry', id: target.index };
  }

  if (target.type === 'chop') {
    const chop = st.chopping;
    if (!chop.item && chef.heldItem?.kind === 'raw') {
      chop.item = { ...chef.heldItem };
      chop.chops = 0;
      chef.heldItem = null;
      return { action: 'place_chop' };
    }
    if (chop.item && chop.chops < chop.maxChops) {
      const res = chopIngredientOnBoard(world);
      return { action: 'chop', finished: res.finished };
    }
    if (chop.item && chop.chops >= chop.maxChops && !chef.heldItem) {
      chef.heldItem = {
        kind: 'skewer',
        id: chop.item.id,
        name: chop.item.name,
        state: 'chopped',
        goldenFlip: false,
      };
      chop.item = null;
      chop.chops = 0;
      return { action: 'pickup_chopped' };
    }
    return { action: 'none' };
  }

  if (target.type === 'hearth_rotate') {
    rotateCharcoalHearth(world, 90);
    return { action: 'rotate_hearth' };
  }

  if (target.type === 'hearth_slot') {
    const slot = st.hearth.slots[target.index];
    if (!slot.item && chef.heldItem?.kind === 'skewer' && chef.heldItem.state === 'chopped') {
      slot.item = { ...chef.heldItem, state: 'searing' };
      slot.progress = 0;
      slot.flipped = false;
      slot.goldenFlip = false;
      slot.burned = false;
      chef.heldItem = null;
      return { action: 'place_skewer', slot: target.index };
    }
    if (slot.item && slot.burned && !chef.heldItem) {
      chef.heldItem = { ...slot.item, state: 'burned' };
      slot.item = null;
      slot.progress = 0;
      slot.flipped = false;
      slot.goldenFlip = false;
      slot.burned = false;
      return { action: 'pickup_burned', slot: target.index };
    }
    if (slot.item && !slot.burned && !slot.flipped && slot.progress >= GOLDEN_WINDOW.min) {
      slot.flipped = true;
      slot.goldenFlip = slot.progress <= GOLDEN_WINDOW.max;
      slot.flipFlash = 1;
      const pos = getHearthSlotWorldPos(st.hearth, slot.index);
      if (slot.goldenFlip) {
        spawnPopup(world, pos.x - 16, pos.y - 16, 'GOLDEN FLIP!', '#ffbe3d');
      }
      spawnBurstParticles(world, pos.x, pos.y, 10, {
        color: slot.goldenFlip ? '#ffda59' : '#ff8c38',
        kind: 'spark',
        speedMin: 30,
        speedMax: 95,
        life: 0.45,
        size: 3.4,
      });
      return { action: 'flip_skewer', golden: slot.goldenFlip, slot: target.index };
    }
    if (slot.item && !slot.burned && slot.flipped && !chef.heldItem) {
      chef.heldItem = {
        kind: 'skewer',
        id: slot.item.id,
        name: slot.item.name,
        state: 'seared',
        goldenFlip: slot.goldenFlip,
      };
      slot.item = null;
      slot.progress = 0;
      slot.flipped = false;
      slot.goldenFlip = false;
      return { action: 'pickup_seared', slot: target.index };
    }
    return { action: 'none' };
  }

  if (target.type === 'glaze') {
    if (!chef.heldItem || chef.heldItem.kind === 'glaze') {
      chef.heldItem = { kind: 'glaze', id: target.id, name: target.id };
      return { action: 'pickup_glaze', id: target.id };
    }
    return { action: 'none' };
  }

  if (target.type === 'mat') {
    const mat = st.assembly.mats[target.index];
    if (mat.stage === 3 && !chef.heldItem) {
      chef.heldItem = {
        kind: 'platter',
        recipe: mat.recipe,
        baseCarb: mat.baseCarb,
        skewers: mat.skewers.slice(),
        glaze: mat.glaze,
        goldenFlips: mat.goldenFlips,
      };
      mat.stage = 0;
      mat.baseCarb = null;
      mat.skewers = [];
      mat.goldenFlips = 0;
      mat.glaze = null;
      mat.recipe = null;
      return { action: 'pickup_platter', mat: target.index };
    }
    if (chef.heldItem) {
      const res = assembleDishOnCounter(world, target.index, chef.heldItem);
      if (res.ok) {
        chef.heldItem = null;
        return { action: 'assemble', stage: res.stage, mat: target.index };
      }
    }
    return { action: 'none' };
  }

  if (target.type === 'pass_slot') {
    const slot = st.pass.slots[target.index];
    if (chef.heldItem?.kind === 'platter' && !slot.dish) {
      const res = stagePlateReadyToServe(world, chef.heldItem, target.index);
      if (res.ok) {
        chef.heldItem = null;
        return { action: 'stage_pass', slot: target.index };
      }
    }
    if (!chef.heldItem && slot.dish) {
      const res = serveReadyPlateToTicket(world);
      return { action: 'bell', ...res };
    }
    return { action: 'none' };
  }

  if (target.type === 'bell') {
    const res = serveReadyPlateToTicket(world);
    return { action: 'bell', ...res };
  }

  if (target.type === 'compost') {
    if (discardHeldItem(world)) return { action: 'compost' };
    return { action: 'none' };
  }

  return { action: 'none' };
}

function collectStationTargets(world) {
  const z = STATION_ZONES;
  const chef = world.chef;
  const st = world.stations;
  const list = [];

  if (!chef.heldItem) {
    const sel = st.pantry.selectedIndex;
    const rect = getPantryBinRect(sel);
    list.push({ type: 'pantry', index: sel, x: z.pantry.accessX, y: rect.y + rect.h / 2 });
  }

  list.push({ type: 'chop', x: z.chopping.accessX, y: z.chopping.accessY });

  for (const slot of st.hearth.slots) {
    const pos = getHearthSlotWorldPos(st.hearth, slot.index);
    const priority =
      slot.item && !slot.burned && (!slot.flipped ? slot.progress >= GOLDEN_WINDOW.min : !chef.heldItem)
        ? 0
        : 8;
    list.push({ type: 'hearth_slot', index: slot.index, x: pos.x, y: pos.y + priority * 0.01 });
  }

  for (let i = 0; i < z.assembly.mats.length; i++) {
    const m = z.assembly.mats[i];
    list.push({ type: 'mat', index: i, x: m.x, y: m.y - 68 });
  }

  for (const g of z.assembly.glazes) {
    list.push({ type: 'glaze', id: g.id, x: g.x, y: g.y - 68 });
  }

  for (const ps of z.pass.slots) {
    list.push({ type: 'pass_slot', index: ps.index, x: ps.x - 42, y: ps.y });
  }

  list.push({ type: 'bell', x: z.pass.bell.x - 42, y: z.pass.bell.y });
  list.push({ type: 'compost', x: z.compost.accessX, y: z.compost.accessY });
  return list;
}

function clampToFloor(x, y) {
  return {
    x: Math.max(FLOOR_BOUNDS.minX, Math.min(FLOOR_BOUNDS.maxX, x)),
    y: Math.max(FLOOR_BOUNDS.minY, Math.min(FLOOR_BOUNDS.maxY, y)),
  };
}

function resolveChefCollisions(chef) {
  const clamped = clampToFloor(chef.x, chef.y);
  chef.x = clamped.x;
  chef.y = clamped.y;

  const cx = STATION_ZONES.hearth.cx;
  const cy = STATION_ZONES.hearth.cy;
  const minDist = STATION_ZONES.hearth.avoidR;
  const dx = chef.x - cx;
  const dy = chef.y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < minDist) {
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : 1;
    chef.x = cx + nx * minDist;
    chef.y = cy + ny * minDist;
  }
}

function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) < r;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  return Math.hypot(x1 + t * dx - cx, y1 + t * dy - cy) < r;
}

function buildRingPath(from, to, nodes, cx, cy, dir) {
  const aStart = Math.atan2(from.y - cy, from.x - cx);
  const aEnd = Math.atan2(to.y - cy, to.x - cx);
  let startIdx = Math.round(((aStart + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  const endIdx = Math.round(((aEnd + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  const pts = [nodes[startIdx]];
  let guard = 0;
  while (startIdx !== endIdx && guard < 8) {
    startIdx = (startIdx + dir + 8) % 8;
    pts.push(nodes[startIdx]);
    guard += 1;
  }
  pts.push(to);
  return pts;
}

function pathLength(from, pts) {
  let total = 0;
  let prev = from;
  for (const p of pts) {
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return total;
}

function nearestFloorPoint(x, y) {
  const cx = STATION_ZONES.hearth.cx;
  const cy = STATION_ZONES.hearth.cy;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy) || 1;
  return clampToFloor(cx + (dx / d) * (STATION_ZONES.hearth.avoidR + 6), cy + (dy / d) * (STATION_ZONES.hearth.avoidR + 6));
}

function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
