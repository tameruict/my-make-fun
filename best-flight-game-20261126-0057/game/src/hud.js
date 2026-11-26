import { HUD_LAYOUT, ISLAND_PALETTE, SPEED_ENVELOPE, FLIGHT_VIEWPORT } from './config.js';

export function drawHUD(ctx, world) {
  const aircraft = world.aircraft;
  const controller = world.missionController;
  if (!aircraft) return;

  const altitudeFt = Math.max(0, aircraft.y * SPEED_ENVELOPE.feetPerMetre);
  const knots = Math.max(0, aircraft.speed * SPEED_ENVELOPE.knotsPerMetreSecond);
  const heading = wrapDegrees360(aircraft.heading);

  drawPill(ctx, HUD_LAYOUT.pills.alt, `ALT ${formatNumber(Math.round(altitudeFt))} ft`);
  drawPill(ctx, HUD_LAYOUT.pills.spd, `SPD ${formatNumber(Math.round(knots))} kn`);
  drawPill(ctx, HUD_LAYOUT.pills.hdg, `HDG ${Math.round(heading)}\u00B0`);

  drawMissionBrief(ctx, controller);
  drawFuelBar(ctx, aircraft.fuel);
  drawHealthBar(ctx, aircraft.hp);
  drawInstrumentCluster(ctx, aircraft, world.tick);
  drawScore(ctx, controller ? controller.score : 0);
  if (world.screen === 'PLAY' || world.screen === 'OVER') {
    drawWarnings(ctx, aircraft, world.tick);
  }
}

export function drawAltimeterGauge(ctx, cx, cy, radius, altitudeFt, tick) {
  drawGaugeFace(ctx, cx, cy, radius);
  ctx.save();
  ctx.translate(cx, cy);
  const start = -Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  for (let i = 0; i <= 10; i += 1) {
    const angle = start + (i / 10) * sweep;
    const inner = radius * (i % 5 === 0 ? 0.66 : 0.76);
    ctx.strokeStyle = i % 5 === 0 ? '#f2f5fa' : '#9aa6b6';
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9);
    ctx.stroke();
  }
  const needleAngle = start + clamp(altitudeFt / 10000, 0, 1) * sweep;
  ctx.strokeStyle = '#ff9b3d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(needleAngle) * radius * 0.18, -Math.sin(needleAngle) * radius * 0.18);
  ctx.lineTo(Math.cos(needleAngle) * radius * 0.74, Math.sin(needleAngle) * radius * 0.74);
  ctx.stroke();
  ctx.fillStyle = '#ff9b3d';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f4f7fb';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatNumber(Math.round(altitudeFt)), cx, cy + radius * 0.42);
  ctx.fillStyle = '#9fb0c4';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText('ALT', cx, cy + radius * 0.68);
}

export function drawAirspeedGauge(ctx, cx, cy, radius, knots, tick) {
  drawGaugeFace(ctx, cx, cy, radius);
  ctx.save();
  ctx.translate(cx, cy);
  const start = -Math.PI * 0.75;
  const sweep = Math.PI * 1.5;
  drawSpeedArc(ctx, start, sweep, radius, 60, 140, '#3fd06a');
  drawSpeedArc(ctx, start, sweep, radius, 140, 160, '#f0c34a');
  drawSpeedArc(ctx, start, sweep, radius, 160, 200, '#e2534b');
  for (let i = 0; i <= 10; i += 1) {
    const angle = start + (i / 10) * sweep;
    ctx.strokeStyle = '#c7d2e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.8, Math.sin(angle) * radius * 0.8);
    ctx.lineTo(Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9);
    ctx.stroke();
  }
  const needleAngle = start + clamp(knots / 200, 0, 1) * sweep;
  ctx.strokeStyle = '#f4f7fb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-Math.cos(needleAngle) * radius * 0.18, -Math.sin(needleAngle) * radius * 0.18);
  ctx.lineTo(Math.cos(needleAngle) * radius * 0.74, Math.sin(needleAngle) * radius * 0.74);
  ctx.stroke();
  ctx.fillStyle = '#f4f7fb';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f4f7fb';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatNumber(Math.round(knots)), cx, cy + radius * 0.42);
  ctx.fillStyle = '#9fb0c4';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText('SPD', cx, cy + radius * 0.68);
}

export function drawArtificialHorizon(ctx, cx, cy, radius, pitch, roll) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2f6fb0';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-roll * Math.PI) / 180);
  const offset = clamp(pitch * 2.4, -radius, radius);
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(-radius * 2, offset, radius * 4, radius * 2);
  ctx.strokeStyle = '#f4f7fb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, offset);
  ctx.lineTo(radius, offset);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#f4f7fb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.42, cy);
  ctx.lineTo(cx - radius * 0.14, cy);
  ctx.lineTo(cx - radius * 0.14, cy + radius * 0.1);
  ctx.moveTo(cx + radius * 0.42, cy);
  ctx.lineTo(cx + radius * 0.14, cy);
  ctx.lineTo(cx + radius * 0.14, cy + radius * 0.1);
  ctx.stroke();
  ctx.fillStyle = '#ffd257';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#c7d2e0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9fb0c4';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AHI', cx, cy + radius * 0.68);
}

export function drawCompassRibbon(ctx, heading, tick) {
  const rect = HUD_LAYOUT.compass;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  const centre = rect.x + rect.w / 2;
  const pixelsPerDegree = rect.w / 120;
  const current = wrapDegrees360(heading);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startOffset = Math.floor(-70 / 5) * 5;
  const baseDeg = Math.floor(current / 5) * 5;
  for (let d = baseDeg + startOffset; d <= baseDeg + 75; d += 5) {
    const offset = d - current;
    if (offset < -65 || offset > 65) continue;
    const deg = wrapDegrees360(d);
    const px = centre + offset * pixelsPerDegree;
    const major = deg % 45 === 0;
    ctx.strokeStyle = major ? '#f4f7fb' : '#7f8ea3';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(px, rect.y + rect.h - 2);
    ctx.lineTo(px, rect.y + rect.h - (major ? 11 : 6));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#f4f7fb';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(cardinalLabel(deg), px, rect.y + 11);
    }
  }
  ctx.fillStyle = '#ff9b3d';
  ctx.beginPath();
  ctx.moveTo(centre - 6, rect.y + 2);
  ctx.lineTo(centre + 6, rect.y + 2);
  ctx.lineTo(centre, rect.y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMissionBrief(ctx, controller) {
  const rect = HUD_LAYOUT.missionBrief;
  const h = Math.min(rect.h, 126);
  roundRect(ctx, rect.x, rect.y, rect.w, h, 10);
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,155,61,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const current = controller ? controller.current : null;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ff9b3d';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(current ? current.title : 'PATROL READY', rect.x + 16, rect.y + 12);
  ctx.fillStyle = '#e8eef6';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(current ? current.objective : 'Awaiting orders', rect.x + 16, rect.y + 40);
  const distanceKm = current ? current.distance / 1000 : 0;
  ctx.fillText(`Dist: ${distanceKm.toFixed(1)} km`, rect.x + 16, rect.y + 66);
  const timer = current ? Math.max(0, current.timer) : 0;
  ctx.fillText(`Timer: ${formatTimer(timer)}`, rect.x + 16, rect.y + 92);
  if (controller) {
    ctx.fillStyle = '#9fb0c4';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`Missions ${controller.completed}/${controller.totalMissions}`, rect.x + 190, rect.y + 94);
  }
}

export function drawFuelBar(ctx, fuel) {
  drawBar(ctx, HUD_LAYOUT.fuelBar, 'FUEL', fuel);
}

export function drawHealthBar(ctx, hp) {
  drawBar(ctx, HUD_LAYOUT.healthBar, 'HP', hp);
}

export function drawDockedBanner(ctx, title, lines) {
  const rect = HUD_LAYOUT.banner;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fillStyle = ISLAND_PALETTE.banner;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,155,61,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd257';
  ctx.font = 'bold 23px system-ui, sans-serif';
  ctx.fillText(title, rect.x + rect.w / 2, rect.y + 20);
  ctx.fillStyle = '#e8eef6';
  ctx.font = '15px system-ui, sans-serif';
  const list = lines || [];
  for (let i = 0; i < list.length; i += 1) {
    ctx.fillText(list[i], rect.x + rect.w / 2, rect.y + 43 + i * 16);
  }
}

function drawInstrumentCluster(ctx, aircraft, tick) {
  const cluster = HUD_LAYOUT.cluster;
  roundRect(ctx, cluster.x, cluster.y, cluster.w, cluster.h, 12);
  ctx.fillStyle = ISLAND_PALETTE.cluster;
  ctx.fill();
  const altitudeFt = Math.max(0, aircraft.y * SPEED_ENVELOPE.feetPerMetre);
  const knots = Math.max(0, aircraft.speed * SPEED_ENVELOPE.knotsPerMetreSecond);
  const [left, middle, right] = HUD_LAYOUT.gauges.centres;
  drawCompassRibbon(ctx, aircraft.heading, tick);
  drawAltimeterGauge(ctx, left, HUD_LAYOUT.gauges.y, HUD_LAYOUT.gauges.radius, altitudeFt, tick);
  drawAirspeedGauge(ctx, middle, HUD_LAYOUT.gauges.y, HUD_LAYOUT.gauges.radius, knots, tick);
  drawArtificialHorizon(ctx, right, HUD_LAYOUT.gauges.y, HUD_LAYOUT.gauges.radius, aircraft.pitch, aircraft.roll);
}

function drawScore(ctx, score) {
  const rect = HUD_LAYOUT.score;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd257';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`SCORE ${formatNumber(Math.round(score))}`, rect.x + rect.w - 12, rect.y + rect.h / 2);
}

function drawWarnings(ctx, aircraft, tick) {
  if (Math.floor(tick / 15) % 2 !== 0) return;
  const warnings = [];
  if (aircraft.stalled) warnings.push({ text: 'STALL', color: '#ff5a52' });
  if (aircraft.agl < 160 && aircraft.vy < -2.5 && !aircraft.onGround) warnings.push({ text: 'PULL UP', color: '#ff5a52' });
  if (aircraft.fuel < 20) warnings.push({ text: 'LOW FUEL', color: '#f0c34a' });
  if (aircraft.overspeed) warnings.push({ text: 'OVERSPEED', color: '#ff5a52' });
  if (aircraft.damageFlash > 0.2) warnings.push({ text: 'DAMAGE', color: '#ff5a52' });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 30px system-ui, sans-serif';
  for (let i = 0; i < Math.min(warnings.length, 2); i += 1) {
    const warning = warnings[i];
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillText(warning.text, HUD_LAYOUT.warnings.x + 2, HUD_LAYOUT.warnings.y + i * 40 + 2);
    ctx.fillStyle = warning.color;
    ctx.fillText(warning.text, HUD_LAYOUT.warnings.x, HUD_LAYOUT.warnings.y + i * 40);
  }
}

function drawPill(ctx, rect, label) {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.fill();
  ctx.fillStyle = '#f4f7fb';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + 12, rect.y + rect.h / 2 + 1);
}

function drawBar(ctx, rect, label, value) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#cfd8e4';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(label, rect.labelX, rect.y - 3);
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 5);
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.fill();
  const ratio = clamp(value / 100, 0, 1);
  const color = ratio > 0.5 ? '#3fd06a' : ratio > 0.2 ? '#f0c34a' : '#e2534b';
  roundRect(ctx, rect.x + 2, rect.y + 2, Math.max(0, (rect.w - 4) * ratio), rect.h - 4, 3);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawGaugeFace(ctx, cx, cy, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#11151f';
  ctx.fill();
  ctx.strokeStyle = '#3a4456';
  ctx.lineWidth = 2;
  ctx.stroke();
  const gradient = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
  gradient.addColorStop(0, 'rgba(70,90,120,0.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpeedArc(ctx, start, sweep, radius, from, to, color) {
  const a0 = start + (from / 200) * sweep;
  const a1 = start + (to / 200) * sweep;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.86, a0, a1);
  ctx.stroke();
}

function cardinalLabel(deg) {
  const normalized = Math.round(wrapDegrees360(deg) / 45) * 45 % 360;
  if (normalized === 0) return 'N';
  if (normalized === 90) return 'E';
  if (normalized === 180) return 'S';
  if (normalized === 270) return 'W';
  return '';
}

function formatTimer(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatNumber(value) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function wrapDegrees360(value) {
  let deg = value % 360;
  if (deg < 0) deg += 360;
  return deg;
}
