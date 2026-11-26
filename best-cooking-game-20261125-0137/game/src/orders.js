import {
  DIFFICULTY_PHASES,
  SCORE_RULES,
  SHIFT_TIMER_SECONDS,
  STAR_THRESHOLDS,
  STATION_ZONES,
} from './config.js';
import { matchDishToTicket, pickTicketRecipe } from './recipes.js';
import { spawnBurstParticles, spawnPopup } from './kitchen.js';

export function createOrderBoard(seed = 1) {
  return {
    seed,
    nextTicketNum: 1,
    tickets: [],
    spawnCooldown: 0.4,
    servedCount: 0,
    expiredCount: 0,
    burnedCount: 0,
    maxCombo: 1,
  };
}

export function spawnOrderTicket(world, force = false) {
  const board = world.orderBoard;
  const phaseCfg = getPhaseConfig(world.elapsed);
  if (!force && board.tickets.length >= phaseCfg.maxTickets) return null;
  if (board.tickets.length >= 4) return null;

  const recipe = pickTicketRecipe(world.rng, phaseCfg.phase);
  if (!recipe) return null;
  const ticket = {
    id: board.nextTicketNum,
    recipe,
    fuseDuration: phaseCfg.fuse,
    fuseRemaining: phaseCfg.fuse,
    vip: phaseCfg.phase === 3 && board.nextTicketNum % 2 === 0,
    arrivalFlash: 1,
  };
  board.nextTicketNum += 1;
  board.tickets.push(ticket);
  board.spawnCooldown = phaseCfg.phase === 3 ? 3.2 : phaseCfg.phase === 2 ? 4.4 : 5.5;
  return ticket;
}

export function tickOrderTimers(world, dt) {
  const board = world.orderBoard;
  world.elapsed = Math.min(SHIFT_TIMER_SECONDS, world.elapsed + dt);
  world.shiftState.remaining = Math.max(0, SHIFT_TIMER_SECONDS - world.elapsed);

  const phaseCfg = getPhaseConfig(world.elapsed);
  world.phase = phaseCfg.phase;

  for (let i = board.tickets.length - 1; i >= 0; i--) {
    const t = board.tickets[i];
    t.arrivalFlash = Math.max(0, t.arrivalFlash - dt * 2.5);
    t.fuseRemaining -= dt;
    if (t.fuseRemaining <= 0) {
      board.tickets.splice(i, 1);
      board.expiredCount += 1;
      world.shiftState.combo = 1;
      world.shiftState.score = Math.max(0, world.shiftState.score - SCORE_RULES.penalty);
      world.shiftState.hearts = Math.max(0, world.shiftState.hearts - 1);
      world.shiftState.activeToast = `Ticket #${t.id} expired! -${SCORE_RULES.penalty} pts · -1 Heart`;
      world.shiftState.toastTimer = 2.4;
      spawnPopup(world, 220 + i * 160, 128, `-${SCORE_RULES.penalty} EXPIRED`, '#e04338');
    }
  }

  board.spawnCooldown -= dt;
  if (board.tickets.length === 0 || (board.tickets.length < phaseCfg.maxTickets && board.spawnCooldown <= 0)) {
    spawnOrderTicket(world);
  }

  if (world.shiftState.hearts <= 0) {
    world.shiftState.screen = 'SCREEN_OVER';
    world.shiftState.outcome = 'overwhelmed';
    world.shiftState.stars = 0;
    world.shiftState.statusMessage = `Kitchen overwhelmed at ${world.shiftState.score} pts.`;
  } else if (world.shiftState.remaining <= 0) {
    world.shiftState.screen = 'SCREEN_OVER';
    world.shiftState.outcome = 'complete';
    world.shiftState.stars = computeShiftStarRating(world.shiftState.score);
    world.shiftState.statusMessage = `Shift complete! ${world.shiftState.stars} Stars, ${world.shiftState.score} pts.`;
  }
}

export function serveReadyPlateToTicket(world) {
  const pass = world.stations.pass;
  const board = world.orderBoard;
  pass.bellPulse = 1;

  const matches = [];
  const usedTickets = new Set();

  for (const slot of pass.slots) {
    if (!slot.dish) continue;
    const candidates = board.tickets.filter((t) => !usedTickets.has(t.id));
    const found = matchDishToTicket(slot.dish, candidates);
    if (found) {
      usedTickets.add(found.ticket.id);
      matches.push({ slot, ticket: found.ticket });
    }
  }

  if (matches.length === 0) {
    const hasPlate = pass.slots.some((s) => s.dish !== null);
    if (hasPlate) {
      world.shiftState.activeToast = 'Plate does not match an active ticket!';
      world.shiftState.toastTimer = 2.0;
    }
    return { served: 0, points: 0, doubleRush: false };
  }

  let totalPoints = 0;
  for (const { slot, ticket } of matches) {
    const fuseRatio = Math.max(0, Math.min(1, ticket.fuseRemaining / ticket.fuseDuration));
    const speedTip = Math.round(SCORE_RULES.maxSpeedTip * fuseRatio);
    const goldenBonus = slot.dish.goldenFlips >= 2 ? SCORE_RULES.goldenFlipBonus : 0;
    const vipBonus = ticket.vip ? SCORE_RULES.vipBonus : 0;
    const combo = world.shiftState.combo;
    const dishPts = SCORE_RULES.baseDish * combo + speedTip + goldenBonus + vipBonus;
    totalPoints += dishPts;

    const idx = board.tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) board.tickets.splice(idx, 1);

    const z = STATION_ZONES.pass.slots[slot.index];
    spawnBurstParticles(world, z.x, z.y, 12, {
      color: '#ffd05c',
      kind: 'spark',
      speedMin: 40,
      speedMax: 110,
      life: 0.65,
      size: 3.6,
    });
    spawnPopup(world, z.x - 40, z.y - 18, `+${dishPts}`, '#ffbe3d');

    slot.dish = null;
    slot.steamTimer = 0;
    board.servedCount += 1;
    world.shiftState.combo = Math.min(SCORE_RULES.maxCombo, combo + 1);
    board.maxCombo = Math.max(board.maxCombo, world.shiftState.combo);
  }

  const doubleRush = matches.length >= 2;
  if (doubleRush) {
    totalPoints += SCORE_RULES.doubleBellBonus;
    spawnPopup(
      world,
      STATION_ZONES.pass.bell.x - 64,
      STATION_ZONES.pass.bell.y - 24,
      `DOUBLE BELL +${SCORE_RULES.doubleBellBonus}!`,
      '#32c478',
    );
  }

  world.shiftState.score += totalPoints;
  world.shiftState.bestScore = Math.max(world.shiftState.bestScore, world.shiftState.score);
  world.shiftState.activeToast = doubleRush
    ? `Double-Bell Rush! +${totalPoints} pts`
    : `Served ${matches[0].ticket.recipe.title} +${totalPoints} pts`;
  world.shiftState.toastTimer = 2.2;
  world.shiftState.statusMessage = world.shiftState.activeToast;

  return { served: matches.length, points: totalPoints, doubleRush };
}

export function computeShiftStarRating(score) {
  if (score >= STAR_THRESHOLDS[2]) return 3;
  if (score >= STAR_THRESHOLDS[1]) return 2;
  if (score >= STAR_THRESHOLDS[0]) return 1;
  return 0;
}

export function getPhaseConfig(elapsed) {
  for (const cfg of DIFFICULTY_PHASES) {
    if (elapsed < cfg.end) return cfg;
  }
  return DIFFICULTY_PHASES[DIFFICULTY_PHASES.length - 1];
}
