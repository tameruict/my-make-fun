import {
  GOLDEN_WINDOW,
  HEARTH_PALETTE,
  KITCHEN_VIEWPORT,
  SCORE_RULES,
  STATION_ZONES,
} from './config.js';
import { getGlazeById, getIngredientById } from './recipes.js';
import { getHearthSlotWorldPos } from './kitchen.js';
import { getPhaseConfig } from './orders.js';
import { getPantryBinRect } from './chef.js';

export function createKitchenRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    ctx,
    renderFrame(world, dpr = 1) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawKitchenAndCounters(ctx, world);
      drawIngredientsOnCounter(ctx, world);
      drawChoppingAndHearth(ctx, world);
      drawDishMidAssembly(ctx, world);
      drawPlateReadyToServe(ctx, world);
      drawChefAndParticles(ctx, world);
      drawOrderBoardAndTimer(ctx, world);
      ctx.restore();
    },
  };
}

export function drawKitchenAndCounters(ctx, world) {
  const W = KITCHEN_VIEWPORT.width;
  const H = KITCHEN_VIEWPORT.height;
  const P = HEARTH_PALETTE;
  const z = STATION_ZONES;

  ctx.fillStyle = P.bgNight;
  ctx.fillRect(0, 0, W, H);

  // Subtle nocturnal stone floor tiles in the central kitchen courtyard
  ctx.fillStyle = P.floorStone;
  ctx.fillRect(280, 122, 720, 410);
  ctx.strokeStyle = '#2a221c';
  ctx.lineWidth = 1;
  for (let gx = 300; gx <= 980; gx += 44) {
    ctx.beginPath();
    ctx.moveTo(gx, 122);
    ctx.lineTo(gx, 526);
    ctx.stroke();
  }
  for (let gy = 138; gy <= 520; gy += 44) {
    ctx.beginPath();
    ctx.moveTo(280, gy);
    ctx.lineTo(1000, gy);
    ctx.stroke();
  }

  // Warm ambient firelight pool around central charcoal hearth
  const glow = ctx.createRadialGradient(
    z.hearth.cx,
    z.hearth.cy,
    30,
    z.hearth.cx,
    z.hearth.cy,
    270,
  );
  glow.addColorStop(0, 'rgba(255, 118, 36, 0.24)');
  glow.addColorStop(0.55, 'rgba(235, 86, 20, 0.08)');
  glow.addColorStop(1, 'rgba(18, 15, 13, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(280, 122, 720, 420);

  // Overhead nocturnal street lantern beam on pass counter
  const passGlow = ctx.createRadialGradient(1126, 265, 20, 1126, 265, 180);
  passGlow.addColorStop(0, 'rgba(255, 205, 108, 0.16)');
  passGlow.addColorStop(1, 'rgba(18, 15, 13, 0)');
  ctx.fillStyle = passGlow;
  ctx.fillRect(960, 130, 310, 320);

  // U-shaped counter bases + countertops
  drawCounterBlock(ctx, z.pantry.x, z.pantry.y, z.pantry.w, z.pantry.h);
  drawCounterBlock(ctx, z.chopping.x, z.chopping.y, z.chopping.w, z.chopping.h);
  drawCounterBlock(ctx, z.assembly.x, z.assembly.y, z.assembly.w, z.assembly.h);
  drawCounterBlock(ctx, z.pass.x, z.pass.y, z.pass.w, z.pass.h);
  drawCounterBlock(ctx, z.compost.x, z.compost.y, z.compost.w, z.compost.h);

  // Compost chute detail (lower-right)
  const cc = z.compost;
  ctx.save();
  ctx.fillStyle = cc.flash > 0 ? '#4d3a2c' : '#261e19';
  roundRect(ctx, cc.x + 28, cc.y + 42, cc.w - 56, cc.h - 62, 12);
  ctx.fill();
  ctx.strokeStyle = cc.flash > 0 ? P.amber : '#6e5846';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cc.cx, cc.cy + 4, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#181310';
  ctx.fill();
  ctx.strokeStyle = '#8b6a48';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#b9a38c';
  ctx.font = `700 11px ${P.font}`;
  ctx.textAlign = 'center';
  ctx.fillText('DISCARD [Q]', cc.cx, cc.cy + 46);
  drawStationPlaque(ctx, cc.x + 12, cc.y + 8, cc.label);
  ctx.restore();

  // Dotted planned route preview when chef has click-to-move waypoints
  if (world.chef.waypoints && world.chef.waypoints.length > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 198, 72, 0.72)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(world.chef.x, world.chef.y);
    for (const wp of world.chef.waypoints) {
      ctx.lineTo(wp.x, wp.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const end = world.chef.waypoints[world.chef.waypoints.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = P.flameGold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Peak rush ember vignette during Phase 3
  if (world.phase === 3) {
    const pulse = 0.14 + 0.06 * Math.sin(world.elapsed * 5);
    const vig = ctx.createRadialGradient(W / 2, H / 2, 310, W / 2, H / 2, 720);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(210, 58, 16, ${pulse.toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }
}

export function drawOrderBoardAndTimer(ctx, world) {
  const P = HEARTH_PALETTE;
  const z = STATION_ZONES;
  const board = world.orderBoard;

  // Hanging wooden order rail
  ctx.save();
  ctx.fillStyle = '#3d281a';
  roundRect(ctx, z.orderBoard.x, z.orderBoard.y, z.orderBoard.w, z.orderBoard.h, 10);
  ctx.fill();
  ctx.strokeStyle = '#6d4a2f';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top brass rail bar
  ctx.fillStyle = '#9a7133';
  ctx.fillRect(z.orderBoard.x + 12, z.orderBoard.y + 8, z.orderBoard.w - 24, 5);
  drawStationPlaque(ctx, z.orderBoard.x + 12, z.orderBoard.y + 6, z.orderBoard.label);

  // Ready dish recipe IDs on pass so matching tickets highlight
  const readyIds = new Set(
    world.stations.pass.slots.filter((s) => s.dish?.recipe).map((s) => s.dish.recipe.id),
  );

  // Up to 4 parchment tickets
  const cardW = 176;
  const cardH = 68;
  const startX = z.orderBoard.x + 16;
  const cardY = z.orderBoard.y + 32;

  for (let i = 0; i < 4; i++) {
    const cx = startX + i * (cardW + 8);
    const ticket = board.tickets[i];
    if (!ticket) {
      ctx.strokeStyle = 'rgba(220, 164, 72, 0.18)';
      ctx.setLineDash([4, 4]);
      roundRect(ctx, cx, cardY, cardW, cardH, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }

    const ratio = Math.max(0, Math.min(1, ticket.fuseRemaining / ticket.fuseDuration));
    const isMatched = readyIds.has(ticket.recipe.id);
    const isUrgent = ticket.fuseRemaining <= 8;

    ctx.fillStyle = P.parchment;
    roundRect(ctx, cx, cardY, cardW, cardH, 6);
    ctx.fill();
    ctx.strokeStyle = isMatched ? P.emerald : isUrgent ? P.crimson : ticket.vip ? P.brass : '#8d7354';
    ctx.lineWidth = isMatched || isUrgent ? 2.5 : 1.5;
    ctx.stroke();

    // Brass clip pin
    ctx.fillStyle = P.brass;
    ctx.fillRect(cx + cardW / 2 - 12, cardY - 4, 24, 6);

    // Ticket header
    ctx.fillStyle = P.ink;
    ctx.font = `800 11px ${P.font}`;
    ctx.textAlign = 'left';
    const label = ticket.vip ? `#${ticket.id} VIP` : `#${ticket.id}`;
    ctx.fillText(label, cx + 8, cardY + 14);

    ctx.textAlign = 'right';
    ctx.fillStyle = isUrgent ? P.crimson : '#4f3c2c';
    ctx.fillText(`${Math.ceil(ticket.fuseRemaining)}s`, cx + cardW - 8, cardY + 14);

    // Dish short title
    ctx.textAlign = 'left';
    ctx.fillStyle = P.ink;
    ctx.font = `700 10.5px ${P.font}`;
    ctx.fillText(truncateText(ticket.recipe.title, 24), cx + 8, cardY + 29);

    // 3-part mini-recipe pills: Base + Skewers + Glaze
    const baseShort = ticket.recipe.baseCarb === 'flatbread' ? 'Flatbread' : 'Rice';
    const s1 = getIngredientById(ticket.recipe.skewers[0])?.short ?? '';
    const s2 = getIngredientById(ticket.recipe.skewers[1])?.short ?? '';
    const glazeShort = getGlazeById(ticket.recipe.glaze)?.short ?? '';

    drawMiniChip(ctx, cx + 8, cardY + 35, 50, 18, baseShort, '#d8b779', '#2b1b0e');
    drawMiniChip(ctx, cx + 61, cardY + 35, 62, 18, `${s1.slice(0, 4)}+${s2.slice(0, 4)}`, '#d65b45', '#fff8ef');
    drawMiniChip(
      ctx,
      cx + 126,
      cardY + 35,
      43,
      18,
      glazeShort.slice(0, 6),
      getGlazeById(ticket.recipe.glaze)?.color ?? '#6ec458',
      '#15110d',
    );

    // Patience fuse bar (emerald -> amber -> crimson)
    const barX = cx + 8;
    const barY = cardY + 55;
    const barW = cardW - 16;
    ctx.fillStyle = '#cbbba0';
    roundRect(ctx, barX, barY, barW, 7, 3.5);
    ctx.fill();

    ctx.fillStyle = ratio > 0.5 ? P.emerald : ratio > 0.25 ? P.amber : P.crimson;
    roundRect(ctx, barX, barY, Math.max(4, barW * ratio), 7, 3.5);
    ctx.fill();
  }

  // Brass Radial Shift Clock at x ~870, y 64
  const clk = z.shiftClock;
  const rem = Math.max(0, world.shiftState.remaining);
  const clockRatio = rem / 180;
  const clockUrgent = rem <= 30 && rem > 0;
  const pulseScale = clockUrgent ? 1 + 0.05 * Math.sin(world.elapsed * 10) : 1;

  ctx.save();
  ctx.translate(clk.x, clk.y);
  ctx.scale(pulseScale, pulseScale);

  ctx.beginPath();
  ctx.arc(0, 0, clk.r + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1511';
  ctx.fill();
  ctx.strokeStyle = clockUrgent ? P.crimson : P.brass;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Shrinking arc
  ctx.beginPath();
  ctx.arc(0, 0, clk.r - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clockRatio);
  ctx.strokeStyle = rem > 60 ? P.emerald : rem > 30 ? P.amber : P.crimson;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();

  const mm = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss = String(Math.floor(rem % 60)).padStart(2, '0');
  ctx.fillStyle = clockUrgent ? '#ff9d94' : P.creamText;
  ctx.font = `800 20px ${P.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${mm}:${ss}`, 0, -2);

  const phaseCfg = getPhaseConfig(world.elapsed);
  ctx.fillStyle = P.brass;
  ctx.font = `700 8.5px ${P.font}`;
  ctx.fillText(phaseCfg.name.split(' ')[0], 0, 17);
  ctx.restore();

  // Top-right Score, Combo Flame Banner & 4 Reputation Hearts
  const hp = z.hudPanel;
  ctx.fillStyle = '#241c17';
  roundRect(ctx, hp.x, hp.y, hp.w, hp.h, 10);
  ctx.fill();
  ctx.strokeStyle = P.brassDark;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = P.mutedText;
  ctx.font = `700 11px ${P.font}`;
  ctx.fillText('SCORE', hp.x + 14, hp.y + 22);

  ctx.fillStyle = P.creamText;
  ctx.font = `800 26px ${P.font}`;
  ctx.fillText(world.shiftState.score.toLocaleString('en-US'), hp.x + 14, hp.y + 50);

  ctx.fillStyle = P.mutedText;
  ctx.font = `600 11px ${P.font}`;
  ctx.fillText(`SERVED ${board.servedCount}`, hp.x + 14, hp.y + 70);

  // Combo Flame Banner
  const combo = world.shiftState.combo;
  const comboX = hp.x + 148;
  const comboY = hp.y + 14;
  if (combo >= 2) {
    const cg = ctx.createLinearGradient(comboX, comboY, comboX + 158, comboY + 34);
    cg.addColorStop(0, combo >= 4 ? '#8a320a' : '#5e290c');
    cg.addColorStop(0.5, combo >= 4 ? '#c75912' : '#7a3710');
    cg.addColorStop(1, combo >= 4 ? '#8a320a' : '#5e290c');
    ctx.fillStyle = cg;
  } else {
    ctx.fillStyle = '#2f2620';
  }
  roundRect(ctx, comboX, comboY, 158, 34, 8);
  ctx.fill();
  ctx.strokeStyle = combo >= 3 ? P.flameGold : combo === 2 ? P.amber : '#665241';
  ctx.lineWidth = combo >= 2 ? 2.2 : 1;
  ctx.stroke();

  if (combo >= 2) {
    // Flame emblem left of combo text
    ctx.beginPath();
    ctx.moveTo(comboX + 22, comboY + 25);
    ctx.quadraticCurveTo(comboX + 13, comboY + 17, comboX + 21, comboY + 8);
    ctx.quadraticCurveTo(comboX + 26, comboY + 14, comboX + 29, comboY + 11);
    ctx.quadraticCurveTo(comboX + 32, comboY + 20, comboX + 22, comboY + 25);
    ctx.fillStyle = P.flameGold;
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = combo >= 2 ? '#ffe184' : P.mutedText;
  ctx.font = `800 16px ${P.font}`;
  ctx.fillText(`COMBO ×${combo}`, comboX + (combo >= 2 ? 88 : 79), comboY + 23);

  // 4 Reputation Hearts
  for (let h = 0; h < SCORE_RULES.maxHearts; h++) {
    const alive = h < world.shiftState.hearts;
    drawHeart(ctx, hp.x + 166 + h * 34, hp.y + 72, 11, alive);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = P.mutedText;
  ctx.font = `600 10px ${P.font}`;
  ctx.fillText('[P] Pause  [M] Mute', hp.x + 14, hp.y + 92);

  // Toast feedback pill if active during gameplay
  if (world.shiftState.screen === 'SCREEN_PLAY' && world.shiftState.toastTimer > 0 && world.shiftState.activeToast) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 13, 0.88)';
    roundRect(ctx, 430, 126, 420, 28, 14);
    ctx.fill();
    ctx.strokeStyle = P.brass;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = P.flameGold;
    ctx.font = `700 13px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(world.shiftState.activeToast, 640, 144);
    ctx.restore();
  }

  // Docked Upper-Aisle Banner (NEVER centered modal — x 340..940, y 124..214)
  if (world.shiftState.screen !== 'SCREEN_PLAY') {
    const b = z.dockedBanner;
    ctx.fillStyle = P.bannerBg;
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.strokeStyle = P.brass;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    if (world.shiftState.screen === 'SCREEN_TITLE') {
      ctx.fillStyle = P.flameGold;
      ctx.font = `800 22px ${P.font}`;
      ctx.fillText('HEARTH & SKEWER — NOCTURNAL STREET KITCHEN', b.x + b.w / 2, b.y + 34);
      ctx.fillStyle = P.creamText;
      ctx.font = `600 13.5px ${P.font}`;
      ctx.fillText('Press SPACE or Click to Start Shift · WASD/Click Move · E/Space Cook · R Rotate', b.x + b.w / 2, b.y + 64);
    } else if (world.shiftState.screen === 'SCREEN_PAUSED') {
      ctx.fillStyle = P.flameGold;
      ctx.font = `800 24px ${P.font}`;
      ctx.fillText('SHIFT PAUSED', b.x + b.w / 2, b.y + 38);
      ctx.fillStyle = P.creamText;
      ctx.font = `600 14px ${P.font}`;
      ctx.fillText('Press SPACE or P to Resume · R Rotate Hearth · Q Discard', b.x + b.w / 2, b.y + 66);
    } else if (world.shiftState.screen === 'SCREEN_OVER') {
      const s = world.shiftState;
      const scoreFmt = s.score.toLocaleString('en-US');
      if (s.outcome === 'overwhelmed') {
        ctx.fillStyle = P.crimson;
        ctx.font = `800 20px ${P.font}`;
        ctx.fillText('KITCHEN OVERWHELMED — SHIFT ENDED EARLY', b.x + b.w / 2, b.y + 34);
      } else {
        ctx.fillStyle = P.flameGold;
        ctx.font = `800 15.5px ${P.font}`;
        ctx.fillText(
          `SHIFT COMPLETE — ${s.stars} STARS, Score ${scoreFmt}, Orders Served ${board.servedCount}, Max Combo ×${board.maxCombo}`,
          b.x + b.w / 2,
          b.y + 35,
        );
      }
      ctx.fillStyle = P.creamText;
      ctx.font = `600 13.5px ${P.font}`;
      ctx.fillText(
        `Rating: ${'★'.repeat(s.stars)}${'☆'.repeat(3 - s.stars)} · Press SPACE or Click to Start New Shift`,
        b.x + b.w / 2,
        b.y + 65,
      );
    }
  }
  ctx.restore();
}

export function drawIngredientsOnCounter(ctx, world) {
  const P = HEARTH_PALETTE;
  const z = STATION_ZONES.pantry;
  const pantry = world.stations.pantry;

  drawStationPlaque(ctx, z.x + 12, z.y + 8, z.label);

  const ids = ['lamb', 'mushroom', 'prawn', 'pepper', 'flatbread', 'rice'];
  for (let i = 0; i < 6; i++) {
    const r = getPantryBinRect(i);
    const ing = getIngredientById(ids[i]);
    const selected = pantry.selectedIndex === i;

    ctx.fillStyle = '#4e331f';
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = selected ? P.flameGold : '#7c5334';
    ctx.lineWidth = selected ? 2.5 : 1.5;
    ctx.stroke();

    // Inner crate shadow
    ctx.fillStyle = '#2d1d12';
    roundRect(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 24, 5);
    ctx.fill();

    // Lush ingredient illustration inside crate
    drawIngredientIcon(ctx, r.x + r.w / 2, r.y + 28, ing.id, 1.0);

    // Key badge
    ctx.fillStyle = selected ? P.flameGold : '#201812';
    roundRect(ctx, r.x + 6, r.y + 6, 18, 16, 4);
    ctx.fill();
    ctx.fillStyle = selected ? P.ink : P.creamText;
    ctx.font = `800 10px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(ing.key, r.x + 15, r.y + 18);

    // Crate label
    ctx.fillStyle = P.creamText;
    ctx.font = `700 11px ${P.font}`;
    ctx.fillText(ing.short, r.x + r.w / 2, r.y + r.h - 5);
  }
}

export function drawChoppingAndHearth(ctx, world) {
  const P = HEARTH_PALETTE;
  const cz = STATION_ZONES.chopping;
  const chop = world.stations.chopping;

  // Cedar Chopping Block
  drawStationPlaque(ctx, cz.x + 12, cz.y + 8, cz.label);
  ctx.fillStyle = P.cedar;
  roundRect(ctx, cz.x + 20, cz.y + 40, cz.w - 40, 114, 10);
  ctx.fill();
  ctx.strokeStyle = P.cedarDark;
  ctx.lineWidth = 3;
  ctx.stroke();

  // End-grain wood stripes
  ctx.strokeStyle = 'rgba(65, 36, 16, 0.35)';
  ctx.lineWidth = 1.5;
  for (let wx = cz.x + 34; wx < cz.x + cz.w - 28; wx += 22) {
    ctx.beginPath();
    ctx.moveTo(wx, cz.y + 46);
    ctx.lineTo(wx, cz.y + 148);
    ctx.stroke();
  }

  if (chop.item) {
    const pieces = 1 + chop.chops;
    for (let k = 0; k < pieces; k++) {
      const offX = (k - (pieces - 1) / 2) * 11;
      const offY = (k % 2 === 0 ? -4 : 5);
      drawIngredientIcon(ctx, cz.blockX + offX, cz.blockY + offY, chop.item.id, Math.max(0.55, 1.05 - chop.chops * 0.1));
    }

    // Progress gauge
    const pct = Math.round((chop.chops / chop.maxChops) * 100);
    ctx.fillStyle = '#1b1410';
    roundRect(ctx, cz.x + 38, cz.y + 132, cz.w - 76, 16, 8);
    ctx.fill();
    ctx.fillStyle = chop.chops >= chop.maxChops ? P.emerald : P.flameGold;
    roundRect(ctx, cz.x + 40, cz.y + 134, Math.max(8, ((cz.w - 80) * chop.chops) / chop.maxChops), 12, 6);
    ctx.fill();

    ctx.fillStyle = P.creamText;
    ctx.font = `800 11px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(chop.chops >= chop.maxChops ? '100% READY!' : `CHOP ${pct}%`, cz.blockX, cz.y + 170);
  } else {
    ctx.fillStyle = 'rgba(246, 239, 227, 0.52)';
    ctx.font = `600 11.5px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText('Place protein / veg [Space]', cz.blockX, cz.y + 168);
  }

  // Chef's Cleaver (animated drop on chop)
  ctx.save();
  ctx.translate(cz.blockX + 44, cz.blockY - 22);
  ctx.rotate(-0.45 + chop.knifeAnim * 0.85);
  ctx.fillStyle = '#dce2e8';
  roundRect(ctx, -38, -12, 38, 18, 3);
  ctx.fill();
  ctx.strokeStyle = '#8b959e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#4a2a16';
  roundRect(ctx, 0, -9, 22, 8, 3);
  ctx.fill();
  ctx.restore();

  // Octagonal Charcoal Hearth
  const hz = STATION_ZONES.hearth;
  const hearth = world.stations.hearth;

  // Outer octagon brazier
  ctx.save();
  traceOctagon(ctx, hz.cx, hz.cy, hz.outerR + 8);
  ctx.fillStyle = '#2d241f';
  ctx.fill();
  ctx.strokeStyle = '#6f5540';
  ctx.lineWidth = 4;
  ctx.stroke();

  traceOctagon(ctx, hz.cx, hz.cy, hz.outerR - 6);
  const bedGrad = ctx.createRadialGradient(hz.cx, hz.cy, 12, hz.cx, hz.cy, hz.outerR);
  bedGrad.addColorStop(0, '#ff8e2b');
  bedGrad.addColorStop(0.5, '#c9340e');
  bedGrad.addColorStop(1, '#3b180e');
  ctx.fillStyle = bedGrad;
  ctx.fill();

  // Charcoal chunks inside bed
  for (let c = 0; c < 14; c++) {
    const a = (c * 2.39996);
    const cr = 18 + (c * 5.2);
    const ex = hz.cx + Math.cos(a) * cr * 0.72;
    const ey = hz.cy + Math.sin(a) * cr * 0.72;
    ctx.beginPath();
    ctx.arc(ex, ey, 8, 0, Math.PI * 2);
    ctx.fillStyle = c % 2 === 0 ? '#2b120b' : '#4a1b0f';
    ctx.fill();
  }

  // Front Fast-Sear vs Back Warm Holding zone indicator arc + clear flank badges
  ctx.beginPath();
  ctx.arc(hz.cx, hz.cy, hz.outerR - 2, 0, Math.PI);
  ctx.strokeStyle = 'rgba(255, 190, 61, 0.85)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(hz.cx, hz.cy, hz.outerR - 2, Math.PI, Math.PI * 2);
  ctx.strokeStyle = 'rgba(196, 132, 92, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = `800 9.5px ${P.font}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(229, 184, 135, 0.88)';
  ctx.fillText('WARM HOLD 0.5×', hz.cx - hz.outerR - 14, hz.cy - 44);
  ctx.fillStyle = P.flameGold;
  ctx.fillText('FAST SEAR 1.25×', hz.cx - hz.outerR - 14, hz.cy + 52);

  // Rotating brass grate spokes
  ctx.save();
  ctx.translate(hz.cx, hz.cy);
  ctx.rotate((hearth.angleDeg * Math.PI) / 180);
  ctx.strokeStyle = hearth.snapAnim > 0 ? P.flameGold : '#8e6b43';
  ctx.lineWidth = 4;
  for (let s = 0; s < 4; s++) {
    const sa = (s * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sa) * (hz.slotR + 12), Math.sin(sa) * (hz.slotR + 12));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#473629';
  ctx.fill();
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = P.creamText;
  ctx.font = `800 10px ${P.font}`;
  ctx.textAlign = 'center';
  ctx.fillText('[R] +90°', hz.cx, hz.cy + 3);

  // 4 Skewer Slots
  for (const slot of hearth.slots) {
    const pos = getHearthSlotWorldPos(hearth, slot.index);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = slot.item ? 'rgba(28, 19, 14, 0.92)' : 'rgba(24, 18, 14, 0.72)';
    ctx.fill();
    ctx.strokeStyle = slot.zone === 'fast' ? P.amber : '#82644a';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (slot.item) {
      // Progress ring
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, slot.progress));
      const inGold = slot.progress >= GOLDEN_WINDOW.min && slot.progress <= GOLDEN_WINDOW.max;
      ctx.strokeStyle = slot.burned
        ? '#5b534f'
        : slot.flipped
          ? P.emerald
          : inGold
            ? P.flameGold
            : P.ember;
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Skewer stick + seared food pieces
      drawSkewerOnSlot(ctx, pos.x, pos.y, slot);

      // FLIP! badge in golden window
      if (!slot.burned && !slot.flipped && slot.progress >= GOLDEN_WINDOW.min) {
        ctx.fillStyle = P.flameGold;
        roundRect(ctx, pos.x - 24, pos.y - 40, 48, 17, 5);
        ctx.fill();
        ctx.fillStyle = P.ink;
        ctx.font = `900 11px ${P.font}`;
        ctx.textAlign = 'center';
        ctx.fillText('FLIP!', pos.x, pos.y - 28);
      } else if (!slot.burned && slot.flipped) {
        ctx.fillStyle = P.emerald;
        roundRect(ctx, pos.x - 26, pos.y - 40, 52, 16, 5);
        ctx.fill();
        ctx.fillStyle = '#0d1c12';
        ctx.font = `800 9.5px ${P.font}`;
        ctx.textAlign = 'center';
        ctx.fillText('SEARED ✓', pos.x, pos.y - 29);
      } else if (slot.burned) {
        ctx.fillStyle = P.crimson;
        roundRect(ctx, pos.x - 26, pos.y - 40, 52, 16, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `800 9.5px ${P.font}`;
        ctx.textAlign = 'center';
        ctx.fillText('BURNED', pos.x, pos.y - 29);
      }
    }
  }

  drawStationPlaque(ctx, hz.cx - 72, hz.cy - hz.outerR - 26, hz.label);
  ctx.restore();
}

export function drawDishMidAssembly(ctx, world) {
  const P = HEARTH_PALETTE;
  const az = STATION_ZONES.assembly;
  const mats = world.stations.assembly.mats;

  drawStationPlaque(ctx, az.x + 12, az.y + 8, az.label);

  for (let i = 0; i < mats.length; i++) {
    const mat = mats[i];
    const m = az.mats[i];

    // Ceramic prep mat with recessed dark stoneware plating oval for high food contrast
    ctx.fillStyle = P.ceramic;
    roundRect(ctx, m.x - m.w / 2, m.y - m.h / 2, m.w, m.h, 12);
    ctx.fill();
    ctx.strokeStyle = mat.stage === 2 ? P.flameGold : P.ceramicRim;
    ctx.lineWidth = mat.stage === 2 ? 3 : 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(m.x - 4, m.y + 8, 52, 27, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#362c24';
    ctx.fill();
    ctx.strokeStyle = '#8e7b63';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#6c5a48';
    ctx.font = `800 10.5px ${P.font}`;
    ctx.textAlign = 'left';
    ctx.fillText(`PREP MAT ${mat.id}`, m.x - m.w / 2 + 10, m.y - m.h / 2 + 16);

    // Radial completion ring in top-right corner of mat
    const ringX = m.x + m.w / 2 - 24;
    const ringY = m.y - m.h / 2 + 24;
    const pct = mat.stage === 0 ? 0 : mat.stage === 1 ? (mat.skewers.length === 1 ? 0.5 : 0.33) : mat.stage === 2 ? 0.66 : 1.0;

    ctx.beginPath();
    ctx.arc(ringX, ringY, 15, 0, Math.PI * 2);
    ctx.strokeStyle = '#d3c6b2';
    ctx.lineWidth = 4;
    ctx.stroke();

    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(ringX, ringY, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
      ctx.strokeStyle = mat.stage === 3 ? P.emerald : mat.stage === 2 ? P.amber : '#4f8ee8';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.fillStyle = P.ink;
    ctx.font = `800 9.5px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(pct * 100)}%`, ringX, ringY + 3.5);

    // Draw plated contents step-by-step
    if (mat.stage === 0) {
      ctx.strokeStyle = '#b9aa93';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(m.x, m.y + 8, 42, 26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#8b7963';
      ctx.font = `600 10.5px ${P.font}`;
      ctx.fillText('1. Base Carb', m.x, m.y + 12);
    } else {
      drawPlatterContents(ctx, m.x - 10, m.y + 8, mat.baseCarb, mat.skewers, mat.glaze, 0.95);

      // Dashed outline for next missing component
      if (mat.stage === 1) {
        ctx.strokeStyle = '#b95c24';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        roundRect(ctx, m.x + 12, m.y - 10, 44, 22, 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#8c4516';
        ctx.font = `700 9.5px ${P.font}`;
        ctx.fillText(mat.skewers.length === 0 ? '+2 Skewers' : '+2nd Skewer', m.x + 4, m.y + 44);
      } else if (mat.stage === 2) {
        ctx.strokeStyle = '#8b3048';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x + 36, m.y + 10, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Required label: MID-ASSEMBLY (2/3)
        ctx.fillStyle = P.ink;
        roundRect(ctx, m.x - 68, m.y + 32, 136, 19, 6);
        ctx.fill();
        ctx.fillStyle = P.flameGold;
        ctx.font = `800 10.5px ${P.font}`;
        ctx.fillText('MID-ASSEMBLY (2/3)', m.x, m.y + 45);
      } else if (mat.stage === 3) {
        ctx.fillStyle = P.emerald;
        roundRect(ctx, m.x - 56, m.y + 32, 112, 19, 6);
        ctx.fill();
        ctx.fillStyle = '#0f2416';
        ctx.font = `800 10.5px ${P.font}`;
        ctx.fillText('3/3 COMPLETE → PASS', m.x, m.y + 45);
      }
    }
  }

  // 3 Glaze Bowls
  for (const gz of az.glazes) {
    const glazeInfo = getGlazeById(gz.id);
    ctx.beginPath();
    ctx.arc(gz.x, gz.y - 4, 25, 0, Math.PI * 2);
    ctx.fillStyle = '#ded5c5';
    ctx.fill();
    ctx.strokeStyle = '#998973';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(gz.x, gz.y - 4, 18, 0, Math.PI * 2);
    ctx.fillStyle = glazeInfo.color;
    ctx.fill();

    // Specular glaze highlight + brush handle
    ctx.beginPath();
    ctx.arc(gz.x - 5, gz.y - 9, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.strokeStyle = '#6f4222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gz.x + 6, gz.y - 8);
    ctx.lineTo(gz.x + 22, gz.y - 24);
    ctx.stroke();

    ctx.fillStyle = P.creamText;
    ctx.font = `700 10.5px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(glazeInfo.short, gz.x, gz.y + 36);
  }
}

export function drawPlateReadyToServe(ctx, world) {
  const P = HEARTH_PALETTE;
  const pz = STATION_ZONES.pass;
  const pass = world.stations.pass;

  drawStationPlaque(ctx, pz.x + 12, pz.y + 8, pz.label);

  // Clean Plate Stack visual on right side of pass counter
  const stack = pz.plateStack;
  for (let p = 0; p < Math.min(5, pass.cleanPlates); p++) {
    ctx.beginPath();
    ctx.ellipse(stack.x, stack.y - p * 4, 22, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = p === Math.min(5, pass.cleanPlates) - 1 ? '#f7f3eb' : '#d5ccbe';
    ctx.fill();
    ctx.strokeStyle = '#a49580';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = P.mutedText;
  ctx.font = `700 9.5px ${P.font}`;
  ctx.textAlign = 'center';
  ctx.fillText('CLEAN PLATES', stack.x, stack.y + 28);

  // Two Pass Trivets: PASS SLOT 1 & PASS SLOT 2
  for (let i = 0; i < pz.slots.length; i++) {
    const slotCfg = pz.slots[i];
    const slotData = pass.slots[i];

    // Warm heat lamp glow cone
    const lamp = ctx.createRadialGradient(slotCfg.x, slotCfg.y, 8, slotCfg.x, slotCfg.y, 48);
    lamp.addColorStop(0, 'rgba(255, 198, 72, 0.35)');
    lamp.addColorStop(1, 'rgba(255, 198, 72, 0)');
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(slotCfg.x, slotCfg.y, 48, 0, Math.PI * 2);
    ctx.fill();

    // Heated brass trivet
    ctx.beginPath();
    ctx.arc(slotCfg.x, slotCfg.y, 35, 0, Math.PI * 2);
    ctx.fillStyle = '#29201a';
    ctx.fill();
    ctx.strokeStyle = slotData.dish ? P.flameGold : P.brassDark;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = P.mutedText;
    ctx.font = `800 9.5px ${P.font}`;
    ctx.fillText(`PASS SLOT ${i + 1}`, slotCfg.x, slotCfg.y + 44);

    if (slotData.dish) {
      // Glazed stoneware pass plate for high contrast
      ctx.beginPath();
      ctx.arc(slotCfg.x, slotCfg.y, 31, 0, Math.PI * 2);
      ctx.fillStyle = '#faf6ee';
      ctx.fill();
      ctx.strokeStyle = '#cabba3';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(slotCfg.x, slotCfg.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#382d24';
      ctx.fill();

      drawPlatterContents(
        ctx,
        slotCfg.x,
        slotCfg.y,
        slotData.dish.baseCarb,
        slotData.dish.skewers,
        slotData.dish.glaze,
        0.74,
      );

      // Glowing READY TO SERVE badge
      ctx.fillStyle = P.emerald;
      roundRect(ctx, slotCfg.x - 48, slotCfg.y - 44, 96, 17, 6);
      ctx.fill();
      ctx.fillStyle = '#092113';
      ctx.font = `900 9.5px ${P.font}`;
      ctx.fillText('READY TO SERVE', slotCfg.x, slotCfg.y - 32);
    }
  }

  // Service Bell
  const bell = pz.bell;
  const bellScale = 1 + pass.bellPulse * 0.14;
  ctx.save();
  ctx.translate(bell.x, bell.y);
  ctx.scale(bellScale, bellScale);

  ctx.beginPath();
  ctx.ellipse(0, 8, 25, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3b2b1d';
  ctx.fill();
  ctx.strokeStyle = P.brassDark;
  ctx.lineWidth = 2;
  ctx.stroke();

  const bellGrad = ctx.createRadialGradient(-6, -8, 2, 0, 0, 22);
  bellGrad.addColorStop(0, '#fff0b3');
  bellGrad.addColorStop(0.5, P.brass);
  bellGrad.addColorStop(1, '#855818');
  ctx.beginPath();
  ctx.arc(0, 4, 18, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = bellGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, -15, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#f6d27a';
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = P.flameGold;
  ctx.font = `800 10px ${P.font}`;
  ctx.textAlign = 'center';
  ctx.fillText('SERVICE BELL (2× +50)', bell.x, bell.y + 26);
}

function drawChefAndParticles(ctx, world) {
  const chef = world.chef;
  const P = HEARTH_PALETTE;

  // Chef drop shadow
  ctx.beginPath();
  ctx.ellipse(chef.x, chef.y + 12, 18, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();

  // Chef body + toque blanche
  ctx.save();
  ctx.translate(chef.x, chef.y);
  const bob = Math.sin(chef.walkCycle) * 1.6;
  ctx.rotate(chef.facingAngle);

  // Shoulders / coat
  ctx.fillStyle = '#ede5d8';
  roundRect(ctx, -14, -17, 26, 34, 11);
  ctx.fill();
  ctx.strokeStyle = '#998976';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Terracotta apron
  ctx.fillStyle = '#b4482a';
  roundRect(ctx, -2, -14, 14, 28, 6);
  ctx.fill();

  // Hands extending forward
  ctx.fillStyle = '#f0c7a4';
  ctx.beginPath();
  ctx.arc(16, -11 + bob, 5, 0, Math.PI * 2);
  ctx.arc(16, 11 - bob, 5, 0, Math.PI * 2);
  ctx.fill();

  // Toque blanche hat
  ctx.beginPath();
  ctx.arc(-1, 0, 12.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#c4bab0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Held item rendered visibly in front of chef
  if (chef.heldItem) {
    const hx = chef.x + Math.cos(chef.facingAngle) * 26;
    const hy = chef.y + Math.sin(chef.facingAngle) * 26;
    ctx.save();
    ctx.beginPath();
    ctx.arc(hx, hy, 15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20, 16, 13, 0.8)';
    ctx.fill();
    ctx.strokeStyle = P.flameGold;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (chef.heldItem.kind === 'glaze') {
      const g = getGlazeById(chef.heldItem.id);
      ctx.beginPath();
      ctx.arc(hx, hy, 8, 0, Math.PI * 2);
      ctx.fillStyle = g?.color ?? '#6ec458';
      ctx.fill();
    } else if (chef.heldItem.kind === 'platter') {
      ctx.beginPath();
      ctx.arc(hx, hy, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#faf5eb';
      ctx.fill();
      drawPlatterContents(ctx, hx, hy, chef.heldItem.baseCarb, chef.heldItem.skewers, chef.heldItem.glaze, 0.36);
    } else {
      drawIngredientIcon(ctx, hx, hy, chef.heldItem.id, 0.68);
    }
    ctx.restore();
  }

  // Deterministic particles
  for (const pt of world.particles) {
    const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Floating score/feedback popups
  for (const pop of world.popups) {
    const alpha = Math.max(0, Math.min(1, pop.life / pop.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 13px ${P.font}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#120e0b';
    ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

function drawCounterBlock(ctx, x, y, w, h) {
  const P = HEARTH_PALETTE;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x + 4, y + 6, w, h, 12);
  ctx.fill();

  ctx.fillStyle = P.counterTop;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = P.counterEdge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawStationPlaque(ctx, x, y, text) {
  const P = HEARTH_PALETTE;
  ctx.save();
  ctx.font = `800 10.5px ${P.font}`;
  const width = Math.ceil(ctx.measureText(text).width) + 16;
  ctx.fillStyle = P.plaqueBg;
  roundRect(ctx, x, y, width, 20, 5);
  ctx.fill();
  ctx.strokeStyle = P.brass;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = P.brass;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 8, y + 13.5);
  ctx.restore();
}

function drawIngredientIcon(ctx, x, y, id, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (id === 'lamb') {
    ctx.fillStyle = '#b93c36';
    roundRect(ctx, -16, -9, 15, 13, 4);
    ctx.fill();
    roundRect(ctx, 1, -7, 15, 13, 4);
    ctx.fill();
    ctx.strokeStyle = '#f2cdc1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-4, 0);
    ctx.moveTo(4, -2);
    ctx.lineTo(12, 2);
    ctx.stroke();
  } else if (id === 'mushroom') {
    ctx.fillStyle = '#e5d4b7';
    roundRect(ctx, -6, -1, 12, 12, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -3, 16, 9, 0, Math.PI, 0);
    ctx.fillStyle = '#8b6340';
    ctx.fill();
  } else if (id === 'prawn') {
    ctx.strokeStyle = '#f2784b';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 1, 10, 0.3, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(8, -5, 5, 0, Math.PI);
    ctx.fill();
  } else if (id === 'pepper') {
    ctx.fillStyle = '#e6422c';
    roundRect(ctx, -15, -9, 14, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#f2b629';
    roundRect(ctx, 1, -8, 14, 15, 5);
    ctx.fill();
    ctx.fillStyle = '#4f9c3d';
    ctx.fillRect(-3, -12, 6, 4);
  } else if (id === 'flatbread') {
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e1bd7c';
    ctx.fill();
    ctx.strokeStyle = '#9a652d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#8f5924';
    ctx.beginPath();
    ctx.arc(-6, -2, 2, 0, Math.PI * 2);
    ctx.arc(5, 3, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'rice') {
    ctx.fillStyle = '#f4edd8';
    roundRect(ctx, -15, -10, 14, 14, 3);
    ctx.fill();
    roundRect(ctx, 1, -6, 14, 14, 3);
    ctx.fill();
    ctx.strokeStyle = '#ce963c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkewerOnSlot(ctx, x, y, slot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.45);
  ctx.strokeStyle = '#c8cfd6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();

  const ing = getIngredientById(slot.item.id);
  const baseColor = slot.burned
    ? '#2b2523'
    : slot.progress > 0.65
      ? '#c95a2b'
      : ing?.color ?? '#d9693d';

  for (let k = -10; k <= 8; k += 9) {
    ctx.fillStyle = baseColor;
    roundRect(ctx, k - 3.5, -5, 7, 10, 2);
    ctx.fill();
    if (!slot.burned && slot.progress > 0.5) {
      ctx.fillStyle = 'rgba(40, 18, 8, 0.55)';
      ctx.fillRect(k - 2, -4, 4, 2);
    }
  }
  ctx.restore();
}

function drawPlatterContents(ctx, x, y, baseCarb, skewers, glaze, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (baseCarb === 'flatbread') {
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#dfc084';
    ctx.fill();
    ctx.strokeStyle = '#99642c';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (baseCarb === 'rice') {
    ctx.fillStyle = '#f5eed8';
    roundRect(ctx, -28, -18, 26, 20, 4);
    ctx.fill();
    roundRect(ctx, 2, -12, 26, 20, 4);
    ctx.fill();
    ctx.strokeStyle = '#c98e38';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  for (let s = 0; s < (skewers?.length ?? 0); s++) {
    const sy = s === 0 ? -6 : 7;
    const ing = getIngredientById(skewers[s]);
    ctx.strokeStyle = '#b4bcc4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, sy);
    ctx.lineTo(24, sy);
    ctx.stroke();

    for (let k = -14; k <= 12; k += 9) {
      ctx.fillStyle = ing?.color ?? '#c84b44';
      roundRect(ctx, k - 3.5, sy - 4, 7, 8, 2);
      ctx.fill();
    }
  }

  if (glaze) {
    const g = getGlazeById(glaze);
    ctx.strokeStyle = g?.color ?? '#6ec458';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.bezierCurveTo(-6, 12, 8, -12, 18, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMiniChip(ctx, x, y, w, h, label, bg, fg) {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `700 9px ${HEARTH_PALETTE.font}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 12.5);
}

function drawHeart(ctx, x, y, r, alive) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.85, -r * 1.1, 0, -r * 0.35);
  ctx.bezierCurveTo(r * 0.85, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.75);
  ctx.fillStyle = alive ? HEARTH_PALETTE.crimson : '#3a2d28';
  ctx.fill();
  ctx.strokeStyle = alive ? '#ff9d94' : '#57463e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function traceOctagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function truncateText(text, maxChars) {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}
