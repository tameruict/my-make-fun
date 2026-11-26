import { GOLDEN_WINDOW, KITCHEN_VIEWPORT, SHIFT_TIMER_SECONDS, STATION_ZONES } from './config.js';
import { composePlatterRecipe } from './recipes.js';
import { getHearthSlotWorldPos, spawnBurstParticles, stepGrillSkewers } from './kitchen.js';
import { computeShiftStarRating, spawnOrderTicket, tickOrderTimers } from './orders.js';
import { getPantryBinRect, interactWithNearestStation, planKitchenRoute, stepChefMovement } from './chef.js';

export const SHOT_PRESETS = {
  rush: { file: '1-service-rush.jpg', seed: 7, ticks: 6360 },
  chop: { file: '2-prep-chop.jpg', seed: 11, ticks: 2520 },
  combo: { file: '3-combo-rush.jpg', seed: 19, ticks: 9120 },
  end: { file: '4-shift-end.jpg', seed: 23, ticks: 10800 },
};

export function stageShot(shotName, seed, world) {
  const preset = SHOT_PRESETS[shotName] ?? SHOT_PRESETS.rush;
  const useSeed = Number.isFinite(seed) ? seed : preset.seed;

  world.reset(useSeed);
  world.shiftState.screen = 'SCREEN_PLAY';
  spawnOrderTicket(world, true);
  spawnOrderTicket(world, true);

  const dt = KITCHEN_VIEWPORT.step;
  for (let t = 0; t < preset.ticks; t++) {
    world.tick = t;
    if (world.shiftState.screen !== 'SCREEN_PLAY') break;
    autopilotStep(world, dt);
    stepChefMovement(world, dt);
    stepGrillSkewers(world, dt);
    tickOrderTimers(world, dt);
  }

  applyFinalWindowStaging(shotName, world);
  return world;
}

export function autopilotStep(world, dt) {
  const st = world.stations;
  const chef = world.chef;

  // 1. Flip any golden-window skewer on hearth immediately (interrupt pantry walks!)
  for (const slot of st.hearth.slots) {
    if (slot.item && !slot.burned && !slot.flipped && slot.progress >= GOLDEN_WINDOW.min) {
      const pos = getHearthSlotWorldPos(st.hearth, slot.index);
      const access = radialAccess(pos.x, pos.y);
      routeAndAct(world, access, { type: 'hearth_slot', index: slot.index });
      return;
    }
  }

  if (chef.waypoints.length > 0) return;

  // 2. Clear any burned skewer
  if (!chef.heldItem) {
    const burned = st.hearth.slots.find((s) => s.item && s.burned);
    if (burned) {
      const pos = getHearthSlotWorldPos(st.hearth, burned.index);
      routeAndAct(world, radialAccess(pos.x, pos.y), { type: 'hearth_slot', index: burned.index });
      return;
    }
  }

  // 3. Dispatch ready plates on pass
  const readyCount = st.pass.slots.filter((s) => s.dish !== null).length;
  if (!chef.heldItem && readyCount > 0) {
    routeAndAct(world, { x: STATION_ZONES.pass.bell.accessX, y: STATION_ZONES.pass.bell.accessY }, { type: 'bell' });
    return;
  }

  // 4. Deliver what chef currently holds
  if (chef.heldItem) {
    const held = chef.heldItem;
    if (held.kind === 'burned') {
      routeAndAct(world, { x: STATION_ZONES.compost.accessX, y: STATION_ZONES.compost.accessY }, { type: 'compost' });
      return;
    }
    if (held.kind === 'platter') {
      const freeSlot = st.pass.slots.find((s) => s.dish === null);
      if (freeSlot) {
        const z = STATION_ZONES.pass.slots[freeSlot.index];
        routeAndAct(world, { x: z.accessX, y: z.accessY }, { type: 'pass_slot', index: freeSlot.index });
        return;
      }
    }
    if (held.kind === 'glaze') {
      const matIdx = st.assembly.mats.findIndex((m) => m.stage === 2);
      if (matIdx >= 0) {
        const mz = STATION_ZONES.assembly.mats[matIdx];
        routeAndAct(world, { x: mz.accessX, y: mz.accessY }, { type: 'mat', index: matIdx });
        return;
      }
    }
    if (held.kind === 'skewer' && held.state === 'seared') {
      const matIdx = st.assembly.mats.findIndex(
        (m) => m.stage === 1 && m.skewers.length < 2 && !m.skewers.includes(held.id),
      );
      if (matIdx >= 0) {
        const mz = STATION_ZONES.assembly.mats[matIdx];
        routeAndAct(world, { x: mz.accessX, y: mz.accessY }, { type: 'mat', index: matIdx });
        return;
      }
    }
    if (held.kind === 'skewer' && held.state === 'chopped') {
      const openSlot =
        st.hearth.slots.find((s) => !s.item && s.zone === 'fast') ??
        st.hearth.slots.find((s) => !s.item);
      if (openSlot) {
        const pos = getHearthSlotWorldPos(st.hearth, openSlot.index);
        routeAndAct(world, radialAccess(pos.x, pos.y), { type: 'hearth_slot', index: openSlot.index });
        return;
      }
    }
    if (held.kind === 'raw') {
      if (!st.chopping.item) {
        routeAndAct(world, { x: STATION_ZONES.chopping.accessX, y: STATION_ZONES.chopping.accessY }, { type: 'chop' });
        return;
      }
    }
    if (held.kind === 'base') {
      const matIdx = st.assembly.mats.findIndex((m) => m.stage === 0);
      if (matIdx >= 0) {
        const mz = STATION_ZONES.assembly.mats[matIdx];
        routeAndAct(world, { x: mz.accessX, y: mz.accessY }, { type: 'mat', index: matIdx });
        return;
      }
    }
    routeAndAct(world, { x: STATION_ZONES.compost.accessX, y: STATION_ZONES.compost.accessY }, { type: 'compost' });
    return;
  }

  // 5. Empty hands: finish chopping, move 3/3 mat, pull seared skewer, glaze 2/3 mat, or grab next ingredient
  if (st.chopping.item) {
    routeAndAct(world, { x: STATION_ZONES.chopping.accessX, y: STATION_ZONES.chopping.accessY }, { type: 'chop' });
    return;
  }

  const readyMatIdx = st.assembly.mats.findIndex((m) => m.stage === 3);
  if (readyMatIdx >= 0 && st.pass.slots.some((s) => s.dish === null)) {
    const mz = STATION_ZONES.assembly.mats[readyMatIdx];
    routeAndAct(world, { x: mz.accessX, y: mz.accessY }, { type: 'mat', index: readyMatIdx });
    return;
  }

  const targetTicket = pickPriorityTicket(world);
  const glazeMatIdx = st.assembly.mats.findIndex((m) => m.stage === 2);
  if (glazeMatIdx >= 0 && targetTicket) {
    const glazeCfg =
      STATION_ZONES.assembly.glazes.find((g) => g.id === targetTicket.recipe.glaze) ??
      STATION_ZONES.assembly.glazes[0];
    routeAndAct(world, { x: glazeCfg.accessX, y: glazeCfg.accessY }, { type: 'glaze', id: glazeCfg.id });
    return;
  }

  const searedSlot = st.hearth.slots.find((s) => s.item && !s.burned && s.flipped);
  if (searedSlot && st.assembly.mats.some((m) => m.stage === 1 && !m.skewers.includes(searedSlot.item.id))) {
    const pos = getHearthSlotWorldPos(st.hearth, searedSlot.index);
    routeAndAct(world, radialAccess(pos.x, pos.y), { type: 'hearth_slot', index: searedSlot.index });
    return;
  }

  if (targetTicket) {
    const matA = st.assembly.mats[0];
    if (matA.stage === 0) {
      grabIngredientFromPantry(world, targetTicket.recipe.baseCarb);
      return;
    }
    if (matA.stage === 1) {
      const needed = targetTicket.recipe.skewers.find(
        (id) => !matA.skewers.includes(id) && !st.hearth.slots.some((s) => s.item?.id === id),
      );
      if (needed) {
        grabIngredientFromPantry(world, needed);
        return;
      }
    }
  }
  void dt;
}

export function verifyShotCriteria(world, shotName = 'rush') {
  const issues = [];
  const ticketsLive = world.orderBoard.tickets.length >= 1;
  if (!ticketsLive) issues.push('orderBoard.tickets < 1');

  const pantryStocked = world.stations.pantry.bins.length === 6;
  if (!pantryStocked) issues.push('pantry not stocked with 6 crates');

  const matAtTwoThirds = world.stations.assembly.mats.some((m) => m.stage === 2);
  if (!matAtTwoThirds) issues.push('no assembly mat at stage 2/3');

  const hasLiveFuses = world.orderBoard.tickets.some((t) => t.fuseRemaining > 0);
  const timersActive = shotName === 'end' ? hasLiveFuses : world.shiftState.remaining > 0 && hasLiveFuses;
  if (!timersActive) issues.push('timers not active');

  const passHoldingPlate = world.stations.pass.slots.some((s) => s.dish !== null);
  if (!passHoldingPlate) issues.push('no pass trivet holding ready plate');

  return {
    ok: issues.length === 0,
    issues,
  };
}

function applyFinalWindowStaging(shotName, world) {
  const st = world.stations;
  const board = world.orderBoard;
  world.popups = [];
  world.shiftState.activeToast = '';
  world.shiftState.toastTimer = 0;

  if (shotName === 'rush') {
    world.elapsed = 106;
    world.phase = 2;
    world.shiftState.remaining = 74; // 01:14
    world.shiftState.screen = 'SCREEN_PLAY';
    world.shiftState.hearts = 4;
    world.shiftState.combo = Math.max(3, world.shiftState.combo);
    world.shiftState.score = Math.max(1680, world.shiftState.score);
    board.servedCount = Math.max(7, board.servedCount);
    board.tickets = [
      makeTicket(11, 'flatbread', ['lamb', 'pepper'], 'herb', 32, 24, false),
      makeTicket(12, 'rice', ['mushroom', 'prawn'], 'sesame', 32, 19, false),
      makeTicket(13, 'flatbread', ['lamb', 'mushroom'], 'pomegranate', 32, 13, false),
    ];
    st.chopping.item = { kind: 'raw', id: 'mushroom', name: 'King Mushroom', state: 'raw' };
    st.chopping.chops = 2;
    st.chopping.knifeAnim = 0.15;

    setHearthSlot(st.hearth, 0, 'lamb', 0.78, false, false);
    setHearthSlot(st.hearth, 1, 'prawn', 0.84, true, true);
    setHearthSlot(st.hearth, 2, 'pepper', 0.44, false, false);
    clearHearthSlot(st.hearth, 3);

    setPrepMat(st.assembly.mats[0], 2, 'flatbread', ['lamb', 'pepper'], null, 2);
    setPrepMat(st.assembly.mats[1], 1, 'rice', ['mushroom'], null, 1);

    setPassSlot(st.pass, 0, 'rice', ['mushroom', 'prawn'], 'sesame');
    clearPassSlot(st.pass, 1);

    world.chef.x = 505;
    world.chef.y = 472;
    world.chef.facingAngle = 2.4;
    world.chef.heldItem = { kind: 'glaze', id: 'herb', name: 'Garlic Herb Oil' };
    world.chef.waypoints = [{ x: 406, y: 492 }];
  } else if (shotName === 'chop') {
    world.elapsed = 42;
    world.phase = 1;
    world.shiftState.remaining = 138; // 02:18
    world.shiftState.screen = 'SCREEN_PLAY';
    world.shiftState.hearts = 4;
    world.shiftState.combo = Math.max(2, world.shiftState.combo);
    world.shiftState.score = Math.max(760, world.shiftState.score);
    board.servedCount = Math.max(3, board.servedCount);
    board.tickets = [
      makeTicket(4, 'rice', ['mushroom', 'prawn'], 'sesame', 38, 29, false),
      makeTicket(5, 'flatbread', ['lamb', 'pepper'], 'herb', 38, 21, false),
    ];
    st.chopping.item = { kind: 'raw', id: 'mushroom', name: 'King Mushroom', state: 'raw' };
    st.chopping.chops = 3; // 75% meter
    st.chopping.knifeAnim = 0.78;
    spawnBurstParticles(world, STATION_ZONES.chopping.blockX, STATION_ZONES.chopping.blockY, 10, {
      color: '#e5d4b7',
      kind: 'slice',
      speedMin: 45,
      speedMax: 115,
      life: 0.4,
      size: 4.5,
    });

    setHearthSlot(st.hearth, 0, 'prawn', 0.74, false, false);
    setHearthSlot(st.hearth, 1, 'lamb', 0.41, false, false);
    clearHearthSlot(st.hearth, 2);
    clearHearthSlot(st.hearth, 3);

    setPrepMat(st.assembly.mats[0], 1, 'flatbread', [], null, 0);
    setPrepMat(st.assembly.mats[1], 2, 'rice', ['mushroom', 'prawn'], null, 2);

    setPassSlot(st.pass, 0, 'flatbread', ['lamb', 'mushroom'], 'pomegranate');
    clearPassSlot(st.pass, 1);

    world.chef.x = STATION_ZONES.chopping.accessX;
    world.chef.y = STATION_ZONES.chopping.accessY;
    world.chef.facingAngle = Math.PI;
    world.chef.heldItem = null;
    world.chef.waypoints = [];
  } else if (shotName === 'combo') {
    world.elapsed = 152;
    world.phase = 3;
    world.shiftState.remaining = 28; // 00:28 pulsing
    world.shiftState.screen = 'SCREEN_PLAY';
    world.shiftState.hearts = 3;
    world.shiftState.combo = 4;
    board.maxCombo = 4;
    world.shiftState.score = Math.max(2360, world.shiftState.score);
    board.servedCount = Math.max(11, board.servedCount);
    world.shiftState.activeToast = 'PEAK DINNER RUSH · DOUBLE BELL READY (+50)';
    world.shiftState.toastTimer = 2.0;
    board.tickets = [
      makeTicket(16, 'flatbread', ['lamb', 'pepper'], 'pomegranate', 26, 6, true),
      makeTicket(17, 'rice', ['mushroom', 'prawn'], 'sesame', 26, 15, false),
      makeTicket(18, 'flatbread', ['lamb', 'mushroom'], 'herb', 26, 20, true),
      makeTicket(19, 'rice', ['lamb', 'prawn'], 'pomegranate', 26, 24, false),
    ];

    st.chopping.item = { kind: 'raw', id: 'pepper', name: 'Bell Pepper', state: 'raw' };
    st.chopping.chops = 1;

    setHearthSlot(st.hearth, 0, 'lamb', 0.79, false, false);
    setHearthSlot(st.hearth, 1, 'prawn', 0.85, false, false);
    setHearthSlot(st.hearth, 2, 'mushroom', 0.88, true, true);
    setHearthSlot(st.hearth, 3, 'pepper', 0.54, false, false);

    setPrepMat(st.assembly.mats[0], 1, 'flatbread', ['lamb'], null, 1);
    setPrepMat(st.assembly.mats[1], 2, 'flatbread', ['lamb', 'pepper'], null, 2);
    st.assembly.mats[1].brushAnim = 0.85;

    setPassSlot(st.pass, 0, 'rice', ['mushroom', 'prawn'], 'sesame');
    setPassSlot(st.pass, 1, 'flatbread', ['lamb', 'mushroom'], 'herb');

    world.chef.x = STATION_ZONES.assembly.mats[1].accessX + 46;
    world.chef.y = STATION_ZONES.assembly.mats[1].accessY;
    world.chef.facingAngle = Math.PI * 0.6;
    world.chef.heldItem = { kind: 'glaze', id: 'pomegranate', name: 'Pomegranate Reduction' };
    world.chef.waypoints = [];
  } else if (shotName === 'end') {
    world.elapsed = SHIFT_TIMER_SECONDS;
    world.phase = 3;
    world.shiftState.remaining = 0; // 00:00
    world.shiftState.screen = 'SCREEN_OVER';
    world.shiftState.outcome = 'complete';
    world.shiftState.hearts = Math.max(3, world.shiftState.hearts);
    world.shiftState.score = Math.max(2840, world.shiftState.score);
    world.shiftState.stars = computeShiftStarRating(world.shiftState.score);
    board.servedCount = Math.max(14, board.servedCount);
    board.maxCombo = 4;
    world.shiftState.combo = 4;

    board.tickets = [
      makeTicket(21, 'flatbread', ['lamb', 'pepper'], 'herb', 26, 17, false),
      makeTicket(22, 'rice', ['mushroom', 'prawn'], 'sesame', 26, 22, true),
    ];

    setHearthSlot(st.hearth, 0, 'lamb', 0.82, true, true);
    setHearthSlot(st.hearth, 1, 'mushroom', 0.72, false, false);
    clearHearthSlot(st.hearth, 2);
    clearHearthSlot(st.hearth, 3);

    setPrepMat(st.assembly.mats[0], 2, 'flatbread', ['lamb', 'pepper'], null, 2);
    setPrepMat(st.assembly.mats[1], 0, null, [], null, 0);

    setPassSlot(st.pass, 0, 'rice', ['mushroom', 'prawn'], 'sesame');
    clearPassSlot(st.pass, 1);

    world.chef.x = 845;
    world.chef.y = 335;
    world.chef.facingAngle = 0;
    world.chef.heldItem = null;
    world.chef.waypoints = [];
  }
}

function makeTicket(id, baseCarb, skewers, glaze, fuseDuration, fuseRemaining, vip) {
  return {
    id,
    recipe: composePlatterRecipe(baseCarb, skewers, glaze),
    fuseDuration,
    fuseRemaining,
    vip,
    arrivalFlash: 0,
  };
}

function setHearthSlot(hearth, idx, ingId, progress, flipped, goldenFlip) {
  const slot = hearth.slots[idx];
  slot.item = { kind: 'skewer', id: ingId, name: ingId, state: flipped ? 'seared' : 'searing' };
  slot.progress = progress;
  slot.flipped = flipped;
  slot.goldenFlip = goldenFlip;
  slot.burned = false;
  slot.flipFlash = 0;
}

function clearHearthSlot(hearth, idx) {
  const slot = hearth.slots[idx];
  slot.item = null;
  slot.progress = 0;
  slot.flipped = false;
  slot.goldenFlip = false;
  slot.burned = false;
}

function setPrepMat(mat, stage, baseCarb, skewers, glaze, goldenFlips) {
  mat.stage = stage;
  mat.baseCarb = baseCarb;
  mat.skewers = skewers.slice();
  mat.glaze = glaze;
  mat.goldenFlips = goldenFlips;
  mat.recipe = stage === 3 ? composePlatterRecipe(baseCarb, skewers, glaze) : null;
}

function setPassSlot(pass, idx, baseCarb, skewers, glaze) {
  pass.slots[idx].dish = {
    recipe: composePlatterRecipe(baseCarb, skewers, glaze),
    baseCarb,
    skewers: skewers.slice(),
    glaze,
    goldenFlips: 2,
  };
  pass.slots[idx].steamTimer = 1.2;
}

function clearPassSlot(pass, idx) {
  pass.slots[idx].dish = null;
  pass.slots[idx].steamTimer = 0;
}

function grabIngredientFromPantry(world, id) {
  const order = ['lamb', 'mushroom', 'prawn', 'pepper', 'flatbread', 'rice'];
  const idx = order.indexOf(id);
  if (idx < 0) return;
  const r = getPantryBinRect(idx);
  routeAndAct(world, { x: STATION_ZONES.pantry.accessX, y: r.y + r.h / 2 }, { type: 'pantry', index: idx });
}

function pickPriorityTicket(world) {
  const tickets = world.orderBoard.tickets;
  if (tickets.length === 0) return null;
  const matA = world.stations.assembly.mats[0];
  if (matA.stage >= 1) {
    const compat = tickets
      .filter(
        (t) =>
          t.recipe.baseCarb === matA.baseCarb &&
          matA.skewers.every((s) => t.recipe.skewers.includes(s)),
      )
      .sort((a, b) => a.fuseRemaining - b.fuseRemaining);
    if (compat.length > 0) return compat[0];
  }
  return tickets.slice().sort((a, b) => a.fuseRemaining - b.fuseRemaining)[0];
}

function routeAndAct(world, access, pendingAction) {
  const chef = world.chef;
  const dist = Math.hypot(access.x - chef.x, access.y - chef.y);
  if (dist <= 16) {
    chef.waypoints = [];
    chef.pendingAction = null;
    interactWithNearestStation(world, pendingAction);
    return;
  }
  chef.waypoints = planKitchenRoute(chef, access);
  chef.pendingAction = pendingAction;
}

function radialAccess(x, y) {
  const cx = STATION_ZONES.hearth.cx;
  const cy = STATION_ZONES.hearth.cy;
  const dx = x - cx;
  const dy = y - cy;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: cx + (dx / len) * (STATION_ZONES.hearth.avoidR + 8),
    y: cy + (dy / len) * (STATION_ZONES.hearth.avoidR + 8),
  };
}
