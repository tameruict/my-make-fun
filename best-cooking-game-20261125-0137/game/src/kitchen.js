import {
  BASE_COOK_RATE,
  CHOP_STROKES,
  DIFFICULTY_PHASES,
  GOLDEN_WINDOW,
  HEARTH_ROTATION_DEG_PER_SEC,
  SCORE_RULES,
  SHIFT_TIMER_SECONDS,
  STATION_ZONES,
} from './config.js';
import { createRandom } from './random.js';
import { composePlatterRecipe, getIngredientById } from './recipes.js';

export function createKitchenWorld(seed = 1) {
  const world = {
    seed,
    rng: createRandom(seed),
    tick: 0,
    elapsed: 0,
    phase: 1,
    stations: createKitchenStations(),
    orderBoard: {
      nextTicketNum: 1,
      tickets: [],
      spawnCooldown: 0.4,
      servedCount: 0,
      expiredCount: 0,
      burnedCount: 0,
      maxCombo: 1,
    },
    chef: {
      x: 380,
      y: 360,
      vx: 0,
      vy: 0,
      radius: 18,
      facingAngle: 0,
      walkCycle: 0,
      heldItem: null,
      waypoints: [],
      pendingAction: null,
      input: { up: false, down: false, left: false, right: false },
    },
    shiftState: {
      screen: 'SCREEN_TITLE',
      outcome: null,
      remaining: SHIFT_TIMER_SECONDS,
      score: 0,
      bestScore: 0,
      combo: 1,
      hearts: SCORE_RULES.maxHearts,
      stars: 0,
      statusMessage: 'Hearth lit and counters stocked. Ready for dinner service.',
      activeToast: '',
      toastTimer: 0,
    },
    particles: [],
    popups: [],
    reset(nextSeed = seed) {
      world.seed = nextSeed;
      world.rng = createRandom(nextSeed);
      world.tick = 0;
      world.elapsed = 0;
      world.phase = 1;
      world.stations = createKitchenStations();
      world.orderBoard = {
        nextTicketNum: 1,
        tickets: [],
        spawnCooldown: 0.4,
        servedCount: 0,
        expiredCount: 0,
        burnedCount: 0,
        maxCombo: 1,
      };
      world.chef.x = 380;
      world.chef.y = 360;
      world.chef.vx = 0;
      world.chef.vy = 0;
      world.chef.facingAngle = 0;
      world.chef.walkCycle = 0;
      world.chef.heldItem = null;
      world.chef.waypoints = [];
      world.chef.pendingAction = null;
      world.shiftState.outcome = null;
      world.shiftState.remaining = SHIFT_TIMER_SECONDS;
      world.shiftState.score = 0;
      world.shiftState.combo = 1;
      world.shiftState.hearts = SCORE_RULES.maxHearts;
      world.shiftState.stars = 0;
      world.shiftState.activeToast = '';
      world.shiftState.toastTimer = 0;
      world.particles = [];
      world.popups = [];
    },
  };
  return world;
}

export function createKitchenStations() {
  return {
    pantry: {
      selectedIndex: 0,
      bins: [0, 1, 2, 3, 4, 5].map((i) => ({ index: i, pulse: 0 })),
    },
    chopping: {
      item: null,
      chops: 0,
      maxChops: CHOP_STROKES,
      knifeAnim: 0,
    },
    hearth: {
      angleDeg: 42,
      snapAnim: 0,
      slots: [0, 1, 2, 3].map((index) => ({
        index,
        item: null,
        progress: 0,
        flipped: false,
        goldenFlip: false,
        burned: false,
        flipFlash: 0,
        zone: index < 2 ? 'fast' : 'hold',
      })),
    },
    assembly: {
      mats: [createPrepMat('A'), createPrepMat('B')],
      glazes: ['herb', 'pomegranate', 'sesame'],
    },
    pass: {
      cleanPlates: 12,
      bellPulse: 0,
      slots: [
        { index: 0, dish: null, steamTimer: 0 },
        { index: 1, dish: null, steamTimer: 0 },
      ],
    },
    compost: {
      flash: 0,
      discarded: 0,
    },
  };
}

export function chopIngredientOnBoard(world) {
  const chop = world.stations.chopping;
  if (!chop.item || chop.chops >= chop.maxChops) {
    return { chopped: false, progress: chop.chops / chop.maxChops, finished: false };
  }
  chop.chops += 1;
  chop.knifeAnim = 1;
  const info = getIngredientById(chop.item.id);
  spawnBurstParticles(world, STATION_ZONES.chopping.blockX, STATION_ZONES.chopping.blockY, 8, {
    color: info?.accent ?? '#f3d18c',
    kind: 'slice',
    speedMin: 40,
    speedMax: 120,
    life: 0.42,
    size: 4.5,
  });
  if (chop.chops >= chop.maxChops) {
    chop.item.state = 'chopped';
    return { chopped: true, progress: 1, finished: true, item: chop.item };
  }
  return { chopped: true, progress: chop.chops / chop.maxChops, finished: false, item: chop.item };
}

export function rotateCharcoalHearth(world, deltaDeg = 90) {
  const hearth = world.stations.hearth;
  hearth.angleDeg = (hearth.angleDeg + deltaDeg) % 360;
  hearth.snapAnim = 1;
  spawnBurstParticles(world, STATION_ZONES.hearth.cx, STATION_ZONES.hearth.cy, 12, {
    color: '#ff9c38',
    kind: 'ember',
    speedMin: 35,
    speedMax: 105,
    life: 0.55,
    size: 3.2,
  });
}

export function stepGrillSkewers(world, dt) {
  const hearth = world.stations.hearth;
  const phaseCfg = DIFFICULTY_PHASES[Math.min(2, Math.max(0, world.phase - 1))];
  hearth.angleDeg = (hearth.angleDeg + HEARTH_ROTATION_DEG_PER_SEC * dt) % 360;
  hearth.snapAnim = Math.max(0, hearth.snapAnim - dt * 3.5);

  const chopping = world.stations.chopping;
  chopping.knifeAnim = Math.max(0, chopping.knifeAnim - dt * 5.0);
  world.stations.pass.bellPulse = Math.max(0, world.stations.pass.bellPulse - dt * 3.0);
  world.stations.compost.flash = Math.max(0, world.stations.compost.flash - dt * 3.0);
  for (const bin of world.stations.pantry.bins) {
    bin.pulse = Math.max(0, bin.pulse - dt * 3.0);
  }
  for (const mat of world.stations.assembly.mats) {
    mat.brushAnim = Math.max(0, mat.brushAnim - dt * 2.8);
  }

  let occupiedCount = 0;
  for (const slot of hearth.slots) {
    slot.flipFlash = Math.max(0, slot.flipFlash - dt * 2.5);
    const rad = ((hearth.angleDeg + slot.index * 90) * Math.PI) / 180;
    const isFront = Math.sin(rad) >= 0;
    slot.zone = isFront ? 'fast' : 'hold';

    if (!slot.item) continue;
    occupiedCount += 1;

    if (!slot.burned) {
      const zoneMult = isFront ? 1.25 * phaseCfg.frontBonus : 0.5;
      slot.progress += BASE_COOK_RATE * zoneMult * phaseCfg.hearthMult * dt;
      if (slot.progress >= 1.0) {
        slot.progress = 1.0;
        slot.burned = true;
        slot.item.state = 'burned';
        world.orderBoard.burnedCount += 1;
        world.shiftState.combo = 1;
        world.shiftState.score = Math.max(0, world.shiftState.score - SCORE_RULES.penalty);
        world.shiftState.hearts = Math.max(0, world.shiftState.hearts - 1);
        world.shiftState.activeToast = `Skewer burned! -${SCORE_RULES.penalty} pts · -1 Heart`;
        world.shiftState.toastTimer = 2.4;
        const pos = getHearthSlotWorldPos(hearth, slot.index);
        spawnPopup(world, pos.x, pos.y - 16, `-${SCORE_RULES.penalty} BURNED`, '#e04338');
        spawnBurstParticles(world, pos.x, pos.y, 12, {
          color: '#554942',
          kind: 'smoke',
          speedMin: 20,
          speedMax: 60,
          life: 0.7,
          size: 6,
        });
      }
    }

    if (world.rng.next() < 0.25) {
      const pos = getHearthSlotWorldPos(hearth, slot.index);
      spawnBurstParticles(world, pos.x, pos.y, 1, {
        color: slot.burned ? '#615853' : slot.progress >= GOLDEN_WINDOW.min ? '#ffd05c' : '#ff7b29',
        kind: slot.burned ? 'smoke' : 'ember',
        speedMin: 14,
        speedMax: 42,
        life: 0.45,
        size: slot.burned ? 4.5 : 2.6,
      });
    }
  }

  for (const passSlot of world.stations.pass.slots) {
    if (passSlot.dish) {
      passSlot.steamTimer += dt;
      if (world.rng.next() < 0.28) {
        const z = STATION_ZONES.pass.slots[passSlot.index];
        spawnBurstParticles(world, z.x + world.rng.float(-12, 12), z.y - 10, 1, {
          color: 'rgba(255, 245, 224, 0.72)',
          kind: 'steam',
          speedMin: 16,
          speedMax: 32,
          life: 0.85,
          size: 6.5,
        });
      }
    }
  }

  if (world.rng.next() < 0.35) {
    spawnBurstParticles(
      world,
      STATION_ZONES.hearth.cx + world.rng.float(-42, 42),
      STATION_ZONES.hearth.cy + world.rng.float(-36, 36),
      1,
      {
        color: world.rng.next() < 0.5 ? '#ff7c2b' : '#ffc247',
        kind: 'ember',
        speedMin: 18,
        speedMax: 52,
        life: 0.65,
        size: 2.4,
      },
    );
  }

  stepParticlesAndPopups(world, dt);
  if (world.shiftState.toastTimer > 0) {
    world.shiftState.toastTimer = Math.max(0, world.shiftState.toastTimer - dt);
  }
  return occupiedCount;
}

export function assembleDishOnCounter(world, matIndex, item) {
  const mat = world.stations.assembly.mats[matIndex];
  if (!mat || !item) return { ok: false, reason: 'invalid' };
  const matZone = STATION_ZONES.assembly.mats[matIndex];

  if (mat.stage === 0 && item.kind === 'base') {
    mat.baseCarb = item.id;
    mat.stage = 1;
    spawnBurstParticles(world, matZone.x, matZone.y, 6, {
      color: '#f2dfb8',
      kind: 'spark',
      speedMin: 20,
      speedMax: 60,
      life: 0.35,
      size: 3,
    });
    return { ok: true, stage: 1 };
  }

  if (mat.stage === 1 && item.kind === 'skewer' && item.state === 'seared' && mat.skewers.length < 2) {
    if (mat.skewers.includes(item.id)) {
      return { ok: false, reason: 'duplicate_topping' };
    }
    mat.skewers.push(item.id);
    if (item.goldenFlip) mat.goldenFlips += 1;
    if (mat.skewers.length === 2) {
      mat.stage = 2;
    }
    spawnBurstParticles(world, matZone.x, matZone.y, 8, {
      color: '#ffba42',
      kind: 'spark',
      speedMin: 25,
      speedMax: 70,
      life: 0.4,
      size: 3.2,
    });
    return { ok: true, stage: mat.stage };
  }

  if (mat.stage === 2 && item.kind === 'glaze') {
    mat.glaze = item.id;
    mat.stage = 3;
    mat.brushAnim = 1;
    mat.recipe = composePlatterRecipe(mat.baseCarb, mat.skewers, mat.glaze);
    spawnBurstParticles(world, matZone.x, matZone.y, 10, {
      color: item.id === 'herb' ? '#7fd667' : item.id === 'pomegranate' ? '#d43358' : '#c97b32',
      kind: 'glaze',
      speedMin: 25,
      speedMax: 75,
      life: 0.45,
      size: 3.8,
    });
    return { ok: true, stage: 3, recipe: mat.recipe };
  }

  return { ok: false, reason: 'mismatch_stage' };
}

export function stagePlateReadyToServe(world, dish, passSlotIndex = -1) {
  const pass = world.stations.pass;
  const slotIdx =
    passSlotIndex >= 0
      ? passSlotIndex
      : pass.slots.findIndex((s) => s.dish === null);
  if (slotIdx < 0 || slotIdx >= pass.slots.length) return { ok: false };
  const slot = pass.slots[slotIdx];
  if (slot.dish !== null) return { ok: false };

  pass.cleanPlates = Math.max(1, pass.cleanPlates - 1);
  if (pass.cleanPlates <= 2) pass.cleanPlates = 12;
  slot.dish = {
    recipe: dish.recipe,
    baseCarb: dish.baseCarb,
    skewers: dish.skewers.slice(),
    glaze: dish.glaze,
    goldenFlips: dish.goldenFlips ?? 0,
  };
  slot.steamTimer = 0;
  const z = STATION_ZONES.pass.slots[slotIdx];
  spawnBurstParticles(world, z.x, z.y, 8, {
    color: '#ffe29c',
    kind: 'spark',
    speedMin: 20,
    speedMax: 65,
    life: 0.45,
    size: 3,
  });
  return { ok: true, slotIndex: slotIdx };
}

export function getHearthSlotWorldPos(hearth, slotIndex) {
  const rad = ((hearth.angleDeg + slotIndex * 90) * Math.PI) / 180;
  return {
    x: STATION_ZONES.hearth.cx + Math.cos(rad) * STATION_ZONES.hearth.slotR,
    y: STATION_ZONES.hearth.cy + Math.sin(rad) * STATION_ZONES.hearth.slotR,
    rad,
    isFront: Math.sin(rad) >= 0,
  };
}

export function spawnBurstParticles(world, x, y, count, opts) {
  for (let i = 0; i < count; i++) {
    const angle =
      opts.kind === 'steam' || opts.kind === 'smoke'
        ? -Math.PI / 2 + world.rng.float(-0.45, 0.45)
        : world.rng.float(0, Math.PI * 2);
    const spd = world.rng.float(opts.speedMin, opts.speedMax);
    world.particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - (opts.kind === 'ember' ? 24 : 0),
      life: opts.life,
      maxLife: opts.life,
      color: opts.color,
      size: opts.size,
      kind: opts.kind,
    });
  }
  if (world.particles.length > 180) {
    world.particles.splice(0, world.particles.length - 180);
  }
}

export function spawnPopup(world, x, y, text, color) {
  world.popups.push({ x, y, text, color, life: 1.3, maxLife: 1.3 });
}

function createPrepMat(id) {
  return {
    id,
    stage: 0,
    baseCarb: null,
    skewers: [],
    goldenFlips: 0,
    glaze: null,
    recipe: null,
    brushAnim: 0,
  };
}

function stepParticlesAndPopups(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === 'slice') p.vy += 260 * dt;
    if (p.kind === 'ember' || p.kind === 'steam' || p.kind === 'smoke') p.vy -= 26 * dt;
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.popups.length - 1; i >= 0; i--) {
    const pop = world.popups[i];
    pop.y -= 28 * dt;
    pop.life -= dt;
    if (pop.life <= 0) world.popups.splice(i, 1);
  }
}
