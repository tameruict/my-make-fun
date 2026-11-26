import { KITCHEN_VIEWPORT, STATION_ZONES } from './config.js';
import { createRandom } from './random.js';
import { INGREDIENTS_ON_COUNTER } from './recipes.js';
import { createKitchenWorld, rotateCharcoalHearth, stepGrillSkewers } from './kitchen.js';
import { spawnOrderTicket, tickOrderTimers } from './orders.js';
import {
  discardHeldItem,
  getPantryBinRect,
  interactWithNearestStation,
  planKitchenRoute,
  resolveClickTarget,
  stepChefMovement,
} from './chef.js';
import {
  createKitchenAudio,
  playFlipChimeSound,
  playGrillSizzleSound,
  playKnifeChopSound,
  playOrderDingSound,
  playServiceBellSound,
  playTimerAlarmTick,
} from './audio.js';
import { createKitchenRenderer } from './render.js';
import { stageShot, verifyShotCriteria } from './shots.js';

const BEST_SCORE_STORAGE_KEY = 'hearth-and-skewer.best';

export function bootCookingGame() {
  const canvas = document.getElementById('kitchen-canvas');
  const statusEl = document.getElementById('kitchen-status');
  if (!canvas || !statusEl) return null;

  const params = new URLSearchParams(window.location.search);
  const shotParam = params.get('shot');
  const seedParam = Number(params.get('seed') ?? '7') || 7;
  const isShotMode = Boolean(shotParam);

  const world = createKitchenWorld(seedParam);
  world.shiftState.bestScore = loadBestScore();

  const audio = createKitchenAudio();
  const renderer = createKitchenRenderer(canvas);

  if (isShotMode) {
    canvas.width = KITCHEN_VIEWPORT.width;
    canvas.height = KITCHEN_VIEWPORT.height;
    return runDeterministicShot(shotParam, seedParam, world, renderer, statusEl);
  }

  const dpr = configureResponsiveCanvas(canvas);
  populateTitleTableau(world);
  handleShiftState(world, 'SCREEN_TITLE', statusEl);
  attachControls(canvas, world, audio, statusEl, dpr);
  runFixedTimestepLoop(world, renderer, audio, statusEl, dpr);
  return world;
}

export function runFixedTimestepLoop(world, renderer, audio, statusEl, dpr = 1) {
  let lastMs = performance.now();
  let accumulator = 0;
  let lastScreen = world.shiftState.screen;
  let lastTicketCount = world.orderBoard.tickets.length;

  function frame(nowMs) {
    const rawDt = Math.max(0, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    const clampedDt = Math.min(KITCHEN_VIEWPORT.maxCatchup, rawDt);

    if (world.shiftState.screen === 'SCREEN_PLAY') {
      accumulator += clampedDt;
      while (accumulator >= KITCHEN_VIEWPORT.step) {
        world.tick += 1;
        const actionResult = stepChefMovement(world, KITCHEN_VIEWPORT.step);
        if (actionResult) triggerActionAudio(audio, actionResult);

        const occupied = stepGrillSkewers(world, KITCHEN_VIEWPORT.step);
        playGrillSizzleSound(audio, occupied, false);

        tickOrderTimers(world, KITCHEN_VIEWPORT.step);
        playTimerAlarmTick(audio, world.shiftState.remaining);

        if (world.orderBoard.tickets.length > lastTicketCount) {
          playOrderDingSound(audio);
        }
        lastTicketCount = world.orderBoard.tickets.length;

        accumulator -= KITCHEN_VIEWPORT.step;
        if (world.shiftState.screen !== 'SCREEN_PLAY') break;
      }
    } else {
      accumulator = 0;
    }

    if (world.shiftState.screen !== lastScreen) {
      lastScreen = world.shiftState.screen;
      handleShiftState(world, lastScreen, statusEl);
    }

    renderer.renderFrame(world, dpr);
    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

export function runDeterministicShot(shotName, seed, world, renderer, statusEl) {
  window.__shotReady = false;
  stageShot(shotName, seed, world);
  const verification = verifyShotCriteria(world, shotName);

  handleShiftState(world, world.shiftState.screen, statusEl);
  renderer.renderFrame(world, 1);

  if (!verification.ok) {
    console.error(`Shot "${shotName}" failed verifyShotCriteria:`, verification.issues.join('; '));
    return { world, verification };
  }

  window.requestAnimationFrame(() => {
    renderer.renderFrame(world, 1);
    window.requestAnimationFrame(() => {
      renderer.renderFrame(world, 1);
      window.__shotReady = true;
    });
  });
  return { world, verification };
}

export function handleShiftState(world, nextScreen, statusEl) {
  world.shiftState.screen = nextScreen;
  if (nextScreen === 'SCREEN_OVER') {
    world.shiftState.bestScore = Math.max(world.shiftState.bestScore, world.shiftState.score);
    saveBestScore(world.shiftState.bestScore);
  }
  const s = world.shiftState;
  let liveText = 'Hearth & Skewer ready.';
  if (nextScreen === 'SCREEN_TITLE') {
    liveText = 'Hearth & Skewer — Nocturnal Street Kitchen. Press Space or click to start your 180-second shift.';
  } else if (nextScreen === 'SCREEN_PAUSED') {
    liveText = `Shift paused with ${Math.ceil(s.remaining)} seconds left. Press Space or P to resume.`;
  } else if (nextScreen === 'SCREEN_PLAY') {
    liveText = `Dinner service underway. Score ${s.score}, ${s.hearts} hearts remaining.`;
  } else if (nextScreen === 'SCREEN_OVER') {
    liveText =
      s.outcome === 'overwhelmed'
        ? `Kitchen overwhelmed. Final score ${s.score}, orders served ${world.orderBoard.servedCount}.`
        : `Shift complete! ${s.stars} stars, score ${s.score}, orders served ${world.orderBoard.servedCount}, max combo x${world.orderBoard.maxCombo}.`;
  }
  statusEl.textContent = liveText;
}

function startFreshShift(world, statusEl) {
  const nextSeed = ((world.seed * 1664525 + 1013904223) >>> 0) || 1;
  world.reset(nextSeed);
  world.shiftState.bestScore = loadBestScore();
  world.shiftState.screen = 'SCREEN_PLAY';
  spawnOrderTicket(world, true);
  spawnOrderTicket(world, true);
  handleShiftState(world, 'SCREEN_PLAY', statusEl);
}

function populateTitleTableau(world) {
  world.rng = createRandom(world.seed);
  world.shiftState.screen = 'SCREEN_TITLE';
  spawnOrderTicket(world, true);
  spawnOrderTicket(world, true);
  world.stations.hearth.slots[0].item = { kind: 'skewer', id: 'lamb', name: 'Lamb', state: 'searing' };
  world.stations.hearth.slots[0].progress = 0.72;
  world.stations.assembly.mats[0].stage = 2;
  world.stations.assembly.mats[0].baseCarb = 'flatbread';
  world.stations.assembly.mats[0].skewers = ['lamb', 'pepper'];
  world.stations.pass.slots[0].dish = {
    recipe: world.orderBoard.tickets[0]?.recipe ?? null,
    baseCarb: 'flatbread',
    skewers: ['lamb', 'pepper'],
    glaze: 'herb',
    goldenFlips: 2,
  };
}

function attachControls(canvas, world, audio, statusEl, dpr) {
  void dpr;
  window.addEventListener('resize', () => {
    configureResponsiveCanvas(canvas);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.shiftState.screen === 'SCREEN_PLAY') {
      handleShiftState(world, 'SCREEN_PAUSED', statusEl);
    }
  });

  window.addEventListener('keydown', (ev) => {
    audio.unlock();
    const key = ev.key.toLowerCase();

    if (key === 'm') {
      const muted = audio.toggleMute();
      world.shiftState.activeToast = muted ? 'Audio Muted' : 'Audio On';
      world.shiftState.toastTimer = 1.5;
      return;
    }

    if (world.shiftState.screen === 'SCREEN_TITLE') {
      if (key === ' ' || key === 'enter') {
        ev.preventDefault();
        startFreshShift(world, statusEl);
      }
      return;
    }

    if (world.shiftState.screen === 'SCREEN_OVER') {
      if (key === ' ' || key === 'enter') {
        ev.preventDefault();
        startFreshShift(world, statusEl);
      }
      return;
    }

    if (key === 'p' || key === 'escape') {
      ev.preventDefault();
      const next = world.shiftState.screen === 'SCREEN_PLAY' ? 'SCREEN_PAUSED' : 'SCREEN_PLAY';
      handleShiftState(world, next, statusEl);
      return;
    }

    if (world.shiftState.screen === 'SCREEN_PAUSED') {
      if (key === ' ') {
        ev.preventDefault();
        handleShiftState(world, 'SCREEN_PLAY', statusEl);
      }
      return;
    }

    if (key === 'w' || key === 'arrowup') world.chef.input.up = true;
    if (key === 's' || key === 'arrowdown') world.chef.input.down = true;
    if (key === 'a' || key === 'arrowleft') world.chef.input.left = true;
    if (key === 'd' || key === 'arrowright') world.chef.input.right = true;

    if (key >= '1' && key <= '6') {
      const idx = Number(key) - 1;
      world.stations.pantry.selectedIndex = idx;
      world.stations.pantry.bins[idx].pulse = 1;
      const distPantry = Math.hypot(
        STATION_ZONES.pantry.accessX - world.chef.x,
        STATION_ZONES.pantry.accessY - world.chef.y,
      );
      if (distPantry <= KITCHEN_VIEWPORT.interactRange + 40 && !world.chef.heldItem) {
        const ing = INGREDIENTS_ON_COUNTER[idx];
        world.chef.heldItem = {
          kind: ing.kind,
          id: ing.id,
          name: ing.name,
          state: ing.kind === 'base' ? 'ready' : 'raw',
        };
      } else {
        const rect = getPantryBinRect(idx);
        world.chef.waypoints = planKitchenRoute(world.chef, {
          x: STATION_ZONES.pantry.accessX,
          y: rect.y + rect.h / 2,
        });
        world.chef.pendingAction = { type: 'pantry', index: idx };
      }
      return;
    }

    if (key === 'r') {
      rotateCharcoalHearth(world, 90);
      playGrillSizzleSound(audio, world.stations.hearth.slots.filter((s) => s.item).length, true);
      return;
    }

    if (key === 'q') {
      discardHeldItem(world);
      return;
    }

    if (key === ' ' || key === 'e') {
      ev.preventDefault();
      const res = interactWithNearestStation(world);
      if (res) triggerActionAudio(audio, res);
    }
  });

  window.addEventListener('keyup', (ev) => {
    const key = ev.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') world.chef.input.up = false;
    if (key === 's' || key === 'arrowdown') world.chef.input.down = false;
    if (key === 'a' || key === 'arrowleft') world.chef.input.left = false;
    if (key === 'd' || key === 'arrowright') world.chef.input.right = false;
  });

  canvas.addEventListener('pointerdown', (ev) => {
    audio.unlock();
    if (world.shiftState.screen === 'SCREEN_TITLE' || world.shiftState.screen === 'SCREEN_OVER') {
      startFreshShift(world, statusEl);
      return;
    }
    if (world.shiftState.screen === 'SCREEN_PAUSED') {
      handleShiftState(world, 'SCREEN_PLAY', statusEl);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * KITCHEN_VIEWPORT.width;
    const py = ((ev.clientY - rect.top) / rect.height) * KITCHEN_VIEWPORT.height;
    const target = resolveClickTarget(world, px, py);

    if (target.immediate) {
      const res = interactWithNearestStation(world, target);
      if (res) triggerActionAudio(audio, res);
      return;
    }

    const dist = Math.hypot(target.access.x - world.chef.x, target.access.y - world.chef.y);
    if (target.type !== 'walk' && dist <= 46) {
      const res = interactWithNearestStation(world, target);
      if (res) triggerActionAudio(audio, res);
      return;
    }

    world.chef.waypoints = planKitchenRoute(world.chef, target.access);
    world.chef.pendingAction = target.type === 'walk' ? null : target;
  });
}

function triggerActionAudio(audio, result) {
  if (result.action === 'chop') playKnifeChopSound(audio);
  if (result.action === 'flip_skewer') playFlipChimeSound(audio, result.golden);
  if (result.action === 'place_skewer' || result.action === 'rotate_hearth') {
    playGrillSizzleSound(audio, 2, true);
  }
  if (result.action === 'bell' && result.served > 0) {
    playServiceBellSound(audio, result.doubleRush);
  }
}

function configureResponsiveCanvas(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(KITCHEN_VIEWPORT.width * dpr);
  canvas.height = Math.round(KITCHEN_VIEWPORT.height * dpr);
  return dpr;
}

function loadBestScore() {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const num = Number(raw ?? '0');
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.floor(score)));
  } catch {
    // Ignore storage restriction in private browsing windows.
  }
}

bootCookingGame();
