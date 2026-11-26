import { FLIGHT_VIEWPORT, TERRAIN_PARAMS, ISLAND_PALETTE, SPEED_ENVELOPE } from './config.js';
import { getTerrainHeight } from './terrain.js';
import { getCameraProjection } from './camera.js';
import { drawHUD } from './hud.js';

const DEG2RAD = Math.PI / 180;
const TAN_HALF_FOV = Math.tan((TERRAIN_PARAMS.backgroundFovDeg * Math.PI) / 180);
const PALETTE_RGB = {
  deepWater: hexToRgb(ISLAND_PALETTE.deepWater),
  shallowWater: hexToRgb(ISLAND_PALETTE.shallowWater),
  sand: hexToRgb(ISLAND_PALETTE.sand),
  coastEdge: hexToRgb(ISLAND_PALETTE.coastEdge),
  grass: hexToRgb(ISLAND_PALETTE.grass),
  rock: hexToRgb(ISLAND_PALETTE.rock),
  snow: hexToRgb(ISLAND_PALETTE.snow),
  haze: hexToRgb(ISLAND_PALETTE.haze)
};

export function renderFrame(ctx, world, background) {
  const camera = world.camera;
  const bg = background || createBackground();
  const isLate = world.shotName === 'end' || world.sortieState === 'COMPLETE';
  drawSkyGradient(bg.context, camera, world.tick, isLate);
  drawTerrainBands(bg.context, world.terrain, camera, world.tick, isLate);

  ctx.save();
  const shake = camera.shake || 0;
  if (shake > 0.2) {
    ctx.translate(Math.sin(world.tick * 1.7) * shake, Math.cos(world.tick * 2.3) * shake);
  }
  ctx.drawImage(bg.canvas, 0, 0, FLIGHT_VIEWPORT.width, FLIGHT_VIEWPORT.height);

  const active = activeRunway(world);
  for (const runway of world.terrain.runways) {
    drawRunwayStrip(ctx, runway, camera, world.tick, runway === active, world.aircraft);
  }
  drawPalmClusters(ctx, world.terrain, camera);
  const current = world.missionController && world.missionController.current;
  if (current) {
    if (current.type === 'survey' && current.rings) {
      for (let i = 0; i < current.rings.length; i += 1) {
        drawTargetRing(ctx, current.rings[i], camera, world.tick, i === current.ringIndex);
      }
    } else if (current.ring) {
      drawTargetRing(ctx, current.ring, camera, world.tick, true);
    }
  }
  drawParticles(ctx, world.particles || [], camera);
  drawAircraftSprite(ctx, world.aircraft, camera, world.tick, world.terrain);
  ctx.restore();

  drawHUD(ctx, world);
}

export function drawSkyGradient(ctx, camera, tick, isLate = false) {
  const width = FLIGHT_VIEWPORT.backgroundWidth;
  const height = FLIGHT_VIEWPORT.backgroundHeight;
  const pitchRad = ((camera ? camera.pitch : 0) * DEG2RAD);
  const horizon = clamp(180 + Math.tan(pitchRad) * 350, 40, 320);
  const late = isLate ? 1 : 0;
  const topRgb = mixRgb(hexToRgb(ISLAND_PALETTE.skyTop), [56, 86, 138], late);
  const horizonRgb = mixRgb(hexToRgb(ISLAND_PALETTE.skyHorizon), [244, 188, 128], late);
  const skyTopColor = `rgb(${topRgb[0]},${topRgb[1]},${topRgb[2]})`;
  const skyHorizonColor = `rgb(${horizonRgb[0]},${horizonRgb[1]},${horizonRgb[2]})`;
  const gradient = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
  gradient.addColorStop(0, skyTopColor);
  gradient.addColorStop(1, skyHorizonColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, Math.max(horizon, 1));
  ctx.fillStyle = skyHorizonColor;
  ctx.fillRect(0, Math.max(horizon, 1), width, height - Math.max(horizon, 1));

  const sunX = width * 0.78 + Math.sin((camera ? camera.heading : 0) * DEG2RAD) * 18;
  const sunY = clamp(horizon - (88 - late * 58), 18, horizon - 18);
  const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 70 + late * 25);
  glow.addColorStop(0, late > 0.3 ? 'rgba(255,220,145,0.95)' : 'rgba(255,242,176,0.9)');
  glow.addColorStop(0.35, late > 0.3 ? 'rgba(255,175,95,0.4)' : 'rgba(255,236,150,0.32)');
  glow.addColorStop(1, 'rgba(255,236,150,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ISLAND_PALETTE.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
  ctx.fill();

  drawClouds(ctx, camera, tick, horizon);
}

export function drawTerrainBands(ctx, terrain, camera, tick, isLate = false) {
  const width = FLIGHT_VIEWPORT.backgroundWidth;
  const height = FLIGHT_VIEWPORT.backgroundHeight;
  const camY = camera ? camera.y : 100;
  const camX = camera ? camera.x : 0;
  const camZ = camera ? camera.z : 0;
  const headingRad = (camera ? camera.heading : 0) * DEG2RAD;
  const pitchRad = (camera ? camera.pitch : 0) * DEG2RAD;
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const fwdX = Math.sin(headingRad);
  const fwdZ = -Math.cos(headingRad);
  const rightX = Math.cos(headingRad);
  const rightZ = Math.sin(headingRad);
  const maxDistance = TERRAIN_PARAMS.maxViewDistance;
  const cx = width / 2;
  const cy = height / 2;
  const bgFocal = (camera && camera.focal ? camera.focal : FLIGHT_VIEWPORT.focalLength) * 0.5;
  const hazeRgb = isLate ? mixRgb(PALETTE_RGB.haze, [244, 188, 128], 0.75) : PALETTE_RGB.haze;

  const steps = 150;
  const dMin = 16;
  const dRatio = Math.pow(maxDistance / dMin, 1 / (steps - 1));

  for (let x = 0; x < width; x += 2) {
    const u = (x + 1 - cx) / bgFocal;
    let minY = height;
    let d = dMin;
    let prevWater = true;
    for (let s = 0; s < steps; s += 1) {
      const worldX = camX + fwdX * d + rightX * (u * d);
      const worldZ = camZ + fwdZ * d + rightZ * (u * d);
      const h = getTerrainHeight(terrain, worldX, worldZ);
      const relY = h - camY;
      const depth = d * cosP + relY * sinP;
      if (depth > 4) {
        const vertical = -d * sinP + relY * cosP;
        const sy = Math.floor(cy - (vertical * bgFocal) / depth);
        if (sy < minY) {
          const top = sy < 0 ? 0 : sy;
          const span = minY - top;
          if (span > 0) {
            const haze = clamp((d - 600) / 3400, 0, 0.88);
            const isWater = h < terrain.waterLevel + 0.5;
            const rgb = (isWater && !prevWater) || (!isWater && prevWater && h < 7)
              ? PALETTE_RGB.coastEdge
              : colourForHeight(h);
            const shaded = mixRgb(rgb, hazeRgb, haze);
            ctx.fillStyle = `rgb(${shaded[0]},${shaded[1]},${shaded[2]})`;
            ctx.fillRect(x, top, 2, span);
          }
          minY = top;
          if (minY <= 0) break;
        }
        prevWater = h < terrain.waterLevel + 0.5;
      }
      d *= dRatio;
    }
  }
}

export function drawAircraftSprite(ctx, aircraft, camera, tick, terrain) {
  if (!aircraft) return;
  const ground = getTerrainHeight(terrain, aircraft.x, aircraft.z);
  const shadow = getCameraProjection(camera, aircraft.x, ground + 0.3, aircraft.z);
  if (!shadow.behind) {
    const altitude = Math.max(0, aircraft.agl);
    const fade = clamp(1 - altitude / 520, 0.12, 0.72);
    const size = clamp(70 - altitude * 0.06, 24, 70);
    ctx.save();
    ctx.fillStyle = `rgba(20,26,18,${fade})`;
    ctx.beginPath();
    ctx.ellipse(shadow.sx, shadow.sy, size, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const pitchOffset = -aircraft.pitch * 0.8;
  const scale = 1 + Math.min(Math.abs(aircraft.pitch), 20) * 0.0016;
  ctx.save();
  ctx.translate(FLIGHT_VIEWPORT.width / 2, 430 + pitchOffset);
  ctx.rotate((aircraft.roll * Math.PI) / 180);
  ctx.scale(scale, scale);

  drawWing(ctx, -1, aircraft.roll, aircraft.flaps);
  drawWing(ctx, 1, aircraft.roll, aircraft.flaps);
  drawTailPlanes(ctx);

  const bodyGradient = ctx.createLinearGradient(-18, -90, 18, 70);
  bodyGradient.addColorStop(0, '#eef2f6');
  bodyGradient.addColorStop(0.5, '#d3dae2');
  bodyGradient.addColorStop(1, '#aeb8c2');
  ctx.fillStyle = bodyGradient;
  roundedPath(ctx, -18, -88, 36, 158, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,72,86,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = '#8d98a4';
  roundedPath(ctx, -9, -60, 18, 120, 8);
  ctx.fill();

  ctx.fillStyle = 'rgba(40,52,66,0.85)';
  roundedPath(ctx, -11, -62, 22, 26, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,205,235,0.55)';
  roundedPath(ctx, -8, -58, 16, 16, 5);
  ctx.fill();

  drawPanelLines(ctx);
  drawTailFin(ctx, aircraft);
  drawPropeller(ctx, aircraft);

  ctx.fillStyle = '#e2534b';
  ctx.shadowColor = 'rgba(226,83,75,0.9)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(-99, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#48e07a';
  ctx.shadowColor = 'rgba(72,224,122,0.9)';
  ctx.beginPath();
  ctx.arc(99, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f7fb';
  ctx.shadowColor = 'rgba(244,247,251,0.9)';
  ctx.beginPath();
  ctx.arc(0, 80, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawTargetRing(ctx, ring, camera, tick, isNext) {
  if (!ring) return;
  const projection = getCameraProjection(camera, ring.x, ring.y, ring.z);
  if (projection.behind) return;
  const pulse = 1 + 0.06 * Math.sin(tick * 0.09 + (ring.pulseSeed || 0));
  const radius = Math.max(4, ring.radius * projection.scale * pulse);
  const color = ring.passed ? ISLAND_PALETTE.ringGreen : ISLAND_PALETTE.ringOrange;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = isNext ? 22 : 10;
  ctx.lineWidth = Math.max(3, radius * 0.14);
  ctx.beginPath();
  ctx.arc(projection.sx, projection.sy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, radius * 0.05);
  ctx.beginPath();
  ctx.arc(projection.sx, projection.sy, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawRunwayStrip(ctx, runway, camera, tick, active, aircraft) {
  if (!runway) return;
  const corners = runwayCorners(runway);
  const projected = projectPolygonNearClip(camera, corners);
  if (!projected || projected.length < 3) return;
  const maxDepth = Math.max(...projected.map((point) => point.depth));
  if (maxDepth > TERRAIN_PARAMS.maxViewDistance) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(projected[0].sx, projected[0].sy);
  for (let i = 1; i < projected.length; i += 1) ctx.lineTo(projected[i].sx, projected[i].sy);
  ctx.closePath();
  ctx.fillStyle = ISLAND_PALETTE.runway;
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,236,244,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  drawRunwayCentreline(ctx, runway, camera);
  drawRunwayThresholds(ctx, runway, camera);
  drawRunwayEdgeLights(ctx, runway, camera, tick);
  drawPapiLights(ctx, runway, camera);

  if (active && aircraft) {
    drawApproachPath(ctx, runway, camera, aircraft);
  }
  ctx.restore();
}

export function drawParticles(ctx, particles, camera) {
  if (!particles || particles.length === 0) return;
  for (const particle of particles) {
    const projection = getCameraProjection(camera, particle.x, particle.y, particle.z);
    if (projection.behind) continue;
    const lifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
    const size = Math.max(1, (particle.size || 2) * projection.scale);
    ctx.globalAlpha = lifeRatio * (particle.alpha ?? 0.8);
    ctx.fillStyle = particle.color || '#cfd8e4';
    ctx.beginPath();
    ctx.arc(projection.sx, projection.sy, Math.min(size, 40), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function projectPolygonNearClip(camera, points) {
  if (!camera || !points || points.length < 3) return null;
  const h = camera.heading * DEG2RAD;
  const p = camera.pitch * DEG2RAD;
  const cosP = Math.cos(p);
  const sinP = Math.sin(p);
  const fwdX = Math.sin(h) * cosP;
  const fwdY = sinP;
  const fwdZ = -Math.cos(h) * cosP;
  const rightX = Math.cos(h);
  const rightZ = Math.sin(h);
  const upX = -rightZ * fwdY;
  const upY = rightZ * fwdX - rightX * fwdZ;
  const upZ = rightX * fwdY;
  const camPoints = points.map((pt) => {
    const rx = pt.x - camera.x;
    const ry = pt.y - camera.y;
    const rz = pt.z - camera.z;
    return {
      depth: rx * fwdX + ry * fwdY + rz * fwdZ,
      lateral: rx * rightX + rz * rightZ,
      vertical: rx * upX + ry * upY + rz * upZ
    };
  });
  const near = 2;
  const clipped = [];
  for (let i = 0; i < camPoints.length; i += 1) {
    const a = camPoints[i];
    const b = camPoints[(i + 1) % camPoints.length];
    const aIn = a.depth >= near;
    const bIn = b.depth >= near;
    if (aIn && bIn) {
      clipped.push(b);
    } else if (aIn && !bIn) {
      const t = (near - a.depth) / (b.depth - a.depth);
      clipped.push({
        depth: near,
        lateral: a.lateral + (b.lateral - a.lateral) * t,
        vertical: a.vertical + (b.vertical - a.vertical) * t
      });
    } else if (!aIn && bIn) {
      const t = (near - a.depth) / (b.depth - a.depth);
      clipped.push({
        depth: near,
        lateral: a.lateral + (b.lateral - a.lateral) * t,
        vertical: a.vertical + (b.vertical - a.vertical) * t
      });
      clipped.push(b);
    }
  }
  if (clipped.length < 3) return null;
  const focal = camera.focal || FLIGHT_VIEWPORT.focalLength;
  return clipped.map((pt) => {
    const scale = focal / pt.depth;
    return {
      sx: FLIGHT_VIEWPORT.width / 2 + pt.lateral * scale,
      sy: FLIGHT_VIEWPORT.height / 2 - pt.vertical * scale,
      depth: pt.depth,
      scale
    };
  });
}

function drawPalmClusters(ctx, terrain, camera) {
  if (!terrain || !terrain.islands || !camera) return;
  const offsets = [
    [-160, -140], [180, -130], [-140, 150], [170, 140], [40, -210]
  ];
  for (let idx = 0; idx < terrain.islands.length; idx += 1) {
    const island = terrain.islands[idx];
    if (island.kind !== 'flat') continue;
    for (let k = 0; k < 4; k += 1) {
      const off = offsets[(idx + k) % offsets.length];
      const wx = island.cx + off[0] * (island.radius / 550);
      const wz = island.cz + off[1] * (island.radius / 550);
      const wy = getTerrainHeight(terrain, wx, wz);
      if (wy < 6 || wy > 110) continue;
      const proj = getCameraProjection(camera, wx, wy, wz);
      if (proj.behind || proj.depth > 2200) continue;
      const h = Math.max(4, 15 * proj.scale);
      const r = Math.max(3, 9 * proj.scale);
      ctx.save();
      ctx.strokeStyle = '#6b4e2e';
      ctx.lineWidth = Math.max(1.2, 2.4 * proj.scale);
      ctx.beginPath();
      ctx.moveTo(proj.sx, proj.sy);
      ctx.lineTo(proj.sx + r * 0.15, proj.sy - h);
      ctx.stroke();
      ctx.fillStyle = '#3d8a3e';
      for (let f = -2; f <= 2; f += 1) {
        const ang = -Math.PI / 2 + f * 0.45;
        ctx.beginPath();
        ctx.ellipse(proj.sx + r * 0.15 + Math.cos(ang) * r * 0.55, proj.sy - h + Math.sin(ang) * r * 0.25, r * 0.65, r * 0.24, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function createBackground() {
  const canvas = document.createElement('canvas');
  canvas.width = FLIGHT_VIEWPORT.backgroundWidth;
  canvas.height = FLIGHT_VIEWPORT.backgroundHeight;
  return { canvas, context: canvas.getContext('2d') };
}

function activeRunway(world) {
  const current = world.missionController && world.missionController.current;
  if (!current) return null;
  if (current.type === 'rescue') {
    return current.phase === 'return' ? current.returnRunway : current.runwayTarget;
  }
  return null;
}

function runwayCorners(runway) {
  const halfLength = runway.length / 2;
  const halfWidth = runway.width / 2;
  const y = runway.elevation + 0.35;
  const fx = runway.forward.x;
  const fz = runway.forward.z;
  const rx = runway.right.x;
  const rz = runway.right.z;
  return [
    { x: runway.cx - fx * halfLength - rx * halfWidth, y, z: runway.cz - fz * halfLength - rz * halfWidth },
    { x: runway.cx - fx * halfLength + rx * halfWidth, y, z: runway.cz - fz * halfLength + rz * halfWidth },
    { x: runway.cx + fx * halfLength + rx * halfWidth, y, z: runway.cz + fz * halfLength + rz * halfWidth },
    { x: runway.cx + fx * halfLength - rx * halfWidth, y, z: runway.cz + fz * halfLength - rz * halfWidth }
  ];
}

function drawRunwayCentreline(ctx, runway, camera) {
  ctx.save();
  ctx.strokeStyle = 'rgba(233,237,242,0.85)';
  ctx.lineWidth = 2;
  const segments = Math.max(6, Math.floor(runway.length / 30));
  for (let i = 0; i < segments; i += 2) {
    const t0 = -0.46 + (i / segments) * 0.92;
    const t1 = -0.46 + ((i + 1) / segments) * 0.92;
    const a = getCameraProjection(camera, runway.cx + runway.forward.x * runway.length * t0, runway.elevation + 0.5, runway.cz + runway.forward.z * runway.length * t0);
    const b = getCameraProjection(camera, runway.cx + runway.forward.x * runway.length * t1, runway.elevation + 0.5, runway.cz + runway.forward.z * runway.length * t1);
    if (a.behind || b.behind) continue;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRunwayThresholds(ctx, runway, camera) {
  ctx.save();
  ctx.strokeStyle = 'rgba(233,237,242,0.9)';
  ctx.lineWidth = 3;
  for (const end of [-1, 1]) {
    const along = (runway.length / 2) * end * 0.92;
    for (let i = -2; i <= 2; i += 1) {
      const across = (runway.width / 2) * (i / 3);
      const x = runway.cx + runway.forward.x * along + runway.right.x * across;
      const z = runway.cz + runway.forward.z * along + runway.right.z * across;
      const a = getCameraProjection(camera, x, runway.elevation + 0.5, z);
      const b = getCameraProjection(camera, x + runway.forward.x * 6 * end, runway.elevation + 0.5, z + runway.forward.z * 6 * end);
      if (a.behind || b.behind) continue;
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawRunwayEdgeLights(ctx, runway, camera, tick) {
  ctx.save();
  const count = Math.max(4, Math.floor(runway.length / 40));
  for (let i = 0; i <= count; i += 1) {
    const along = -runway.length / 2 + (i / count) * runway.length;
    for (const side of [-1, 1]) {
      const across = (runway.width / 2 + 1.5) * side;
      const x = runway.cx + runway.forward.x * along + runway.right.x * across;
      const z = runway.cz + runway.forward.z * along + runway.right.z * across;
      const projection = getCameraProjection(camera, x, runway.elevation + 0.8, z);
      if (projection.behind || projection.depth < 6) continue;
      ctx.fillStyle = (i + (side > 0 ? 1 : 0)) % 2 === 0 ? ISLAND_PALETTE.runwayEdgeGreen : ISLAND_PALETTE.runwayEdgeRed;
      ctx.beginPath();
      ctx.arc(projection.sx, projection.sy, Math.min(5, Math.max(1.4, 2.2 * projection.scale)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPapiLights(ctx, runway, camera) {
  ctx.save();
  const thresholdAlong = -runway.length / 2 - 7;
  for (let i = 0; i < 4; i += 1) {
    const across = (runway.width / 2) * (-0.6 + (i / 3) * 1.2);
    const x = runway.cx + runway.forward.x * thresholdAlong + runway.right.x * across;
    const z = runway.cz + runway.forward.z * thresholdAlong + runway.right.z * across;
    const projection = getCameraProjection(camera, x, runway.elevation + 1.2, z);
    if (projection.behind || projection.depth < 6) continue;
    ctx.fillStyle = i < 2 ? ISLAND_PALETTE.papiRed : ISLAND_PALETTE.papiWhite;
    ctx.beginPath();
    ctx.arc(projection.sx, projection.sy, Math.min(6, Math.max(1.6, 3 * projection.scale)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawApproachPath(ctx, runway, camera, aircraft) {
  const thresholdAlong = -runway.length / 2 - 12;
  const tx = runway.cx + runway.forward.x * thresholdAlong;
  const tz = runway.cz + runway.forward.z * thresholdAlong;
  const from = getCameraProjection(camera, aircraft.x, aircraft.y, aircraft.z);
  const to = getCameraProjection(camera, tx, runway.elevation + 1.5, tz);
  if (from.behind || to.behind) return;
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = 0;
  ctx.strokeStyle = 'rgba(255,155,61,0.82)';
  ctx.shadowColor = 'rgba(255,155,61,0.8)';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from.sx, from.sy);
  ctx.lineTo(to.sx, to.sy);
  ctx.stroke();
  ctx.restore();
}

function drawClouds(ctx, camera, tick, horizon) {
  const width = FLIGHT_VIEWPORT.backgroundWidth;
  const drift = ((camera ? camera.heading : 0) * 0.55 + tick * 0.01) % width;
  const clouds = [
    { x: 0.12, y: 0.16, s: 1.0 },
    { x: 0.46, y: 0.11, s: 0.8 },
    { x: 0.8, y: 0.2, s: 1.15 }
  ];
  ctx.save();
  ctx.fillStyle = 'rgba(247,251,255,0.86)';
  for (const cloud of clouds) {
    const baseX = ((cloud.x * width + drift) % (width + 160)) - 80;
    const baseY = Math.max(20, horizon * cloud.y);
    const scale = cloud.s;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, 34 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX + 24 * scale, baseY - 5 * scale, 22 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX - 22 * scale, baseY + 1 * scale, 20 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWing(ctx, side, roll, flaps) {
  const mirror = side;
  ctx.save();
  const gradient = ctx.createLinearGradient(mirror * 10, -20, mirror * 100, 30);
  gradient.addColorStop(0, '#dfe5ec');
  gradient.addColorStop(1, '#aab4bf');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(mirror * 8, -14);
  ctx.lineTo(mirror * 102, 16);
  ctx.lineTo(mirror * 98, 30);
  ctx.lineTo(mirror * 8, 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,70,84,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (flaps) {
    ctx.fillStyle = '#5f6b78';
    ctx.beginPath();
    ctx.moveTo(mirror * 18, 22);
    ctx.lineTo(mirror * 56, 25);
    ctx.lineTo(mirror * 56, 33);
    ctx.lineTo(mirror * 18, 30);
    ctx.closePath();
    ctx.fill();
  }

  const deflection = clamp(roll / 75, -1, 1) * side * 6;
  ctx.fillStyle = '#7d8894';
  ctx.beginPath();
  ctx.moveTo(mirror * 60, 24);
  ctx.lineTo(mirror * 98, 30);
  ctx.lineTo(mirror * 98, 30 + deflection);
  ctx.lineTo(mirror * 60, 24 + deflection * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTailPlanes(ctx) {
  ctx.save();
  ctx.fillStyle = '#c3ccd5';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 6, 54);
    ctx.lineTo(side * 42, 66);
    ctx.lineTo(side * 40, 74);
    ctx.lineTo(side * 6, 68);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,70,84,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTailFin(ctx, aircraft) {
  ctx.save();
  ctx.fillStyle = '#b7c1cb';
  ctx.beginPath();
  ctx.moveTo(-4, 56);
  ctx.lineTo(4, 56);
  ctx.lineTo(7, 84);
  ctx.lineTo(-7, 84);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(58,70,84,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#8e99a5';
  ctx.beginPath();
  ctx.moveTo(-6, 74);
  ctx.lineTo(6, 74);
  ctx.lineTo(7, 84);
  ctx.lineTo(-7, 84);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPanelLines(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(90,102,116,0.45)';
  ctx.lineWidth = 1;
  for (let y = -70; y <= 50; y += 22) {
    ctx.beginPath();
    ctx.moveTo(-17, y);
    ctx.lineTo(17, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,82,96,0.5)';
  for (let y = -66; y <= 46; y += 22) {
    for (const x of [-13, 13]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPropeller(ctx, aircraft) {
  ctx.save();
  ctx.translate(0, -88);
  const speed = 0.35 + (aircraft.throttle / 100) * 0.9;
  ctx.fillStyle = 'rgba(220,230,240,0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d4753';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    const angle = aircraft.propAngle * speed + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * 27, Math.sin(angle) * 27);
    ctx.stroke();
  }
  ctx.fillStyle = '#2d3540';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function colourForHeight(height) {
  if (height < -4) return PALETTE_RGB.deepWater;
  if (height < 2) return PALETTE_RGB.shallowWater;
  if (height < 7) return PALETTE_RGB.sand;
  if (height < 120) return PALETTE_RGB.grass;
  if (height < 300) return PALETTE_RGB.rock;
  return PALETTE_RGB.snow;
}

function mixRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function roundedPath(ctx, x, y, w, h, r) {
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
