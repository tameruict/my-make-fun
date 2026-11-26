import { FLIGHT_VIEWPORT } from './config.js';

const DEG2RAD = Math.PI / 180;

export function createChaseCamera(aircraft) {
  const heading = aircraft ? aircraft.heading : 90;
  const rad = heading * DEG2RAD;
  const forwardX = Math.sin(rad);
  const forwardZ = -Math.cos(rad);
  return {
    x: (aircraft ? aircraft.x : 0) - forwardX * 25,
    y: (aircraft ? aircraft.y : 100) + 8,
    z: (aircraft ? aircraft.z : 0) - forwardZ * 25,
    heading,
    pitch: aircraft ? aircraft.pitch : 0,
    roll: aircraft ? aircraft.roll * 0.35 : 0,
    focal: FLIGHT_VIEWPORT.focalLength,
    shake: 0
  };
}

export function updateCameraFollow(camera, aircraft, dt) {
  if (!camera || !aircraft) return camera;
  const rad = aircraft.heading * DEG2RAD;
  const forwardX = Math.sin(rad);
  const forwardZ = -Math.cos(rad);
  const desiredX = aircraft.x - forwardX * 25;
  const desiredY = aircraft.y + 8;
  const desiredZ = aircraft.z - forwardZ * 25;
  const k = 1 - Math.exp(-Math.max(dt, 0) * 6);
  camera.x += (desiredX - camera.x) * k;
  camera.y += (desiredY - camera.y) * k;
  camera.z += (desiredZ - camera.z) * k;

  const headingDelta = angleDifference(aircraft.heading, camera.heading);
  camera.heading = wrapDegrees360(camera.heading + headingDelta * Math.min(1, dt * 5));
  camera.pitch += (aircraft.pitch * 0.92 - camera.pitch) * k;
  camera.roll += (aircraft.roll * 0.35 - camera.roll) * k;

  let shake = 0;
  if (Math.abs(aircraft.roll) > 70) shake += 2.2;
  if (aircraft.stalled) shake += 2.6;
  if (aircraft.overspeed) shake += 1.8;
  if (aircraft.damageFlash > 0) shake += aircraft.damageFlash * 1.4;
  camera.shake += (shake - camera.shake) * k;
  return camera;
}

export function getCameraProjection(camera, x, y, z) {
  if (!camera) return { sx: 0, sy: 0, depth: -1, scale: 0, behind: true };
  const h = camera.heading * DEG2RAD;
  const p = camera.pitch * DEG2RAD;
  const cosP = Math.cos(p);
  const sinP = Math.sin(p);
  const forwardX = Math.sin(h) * cosP;
  const forwardY = sinP;
  const forwardZ = -Math.cos(h) * cosP;
  const rightX = Math.cos(h);
  const rightY = 0;
  const rightZ = Math.sin(h);
  const upX = rightY * forwardZ - rightZ * forwardY;
  const upY = rightZ * forwardX - rightX * forwardZ;
  const upZ = rightX * forwardY - rightY * forwardX;
  const relX = x - camera.x;
  const relY = y - camera.y;
  const relZ = z - camera.z;
  const depth = relX * forwardX + relY * forwardY + relZ * forwardZ;
  const lateral = relX * rightX + relY * rightY + relZ * rightZ;
  const vertical = relX * upX + relY * upY + relZ * upZ;
  if (depth <= 0.5) {
    return { sx: 0, sy: 0, depth, scale: 0, behind: true };
  }
  const focal = camera.focal || FLIGHT_VIEWPORT.focalLength;
  const scale = focal / depth;
  return {
    sx: FLIGHT_VIEWPORT.width / 2 + lateral * scale,
    sy: FLIGHT_VIEWPORT.height / 2 - vertical * scale,
    depth,
    scale,
    behind: false
  };
}

function angleDifference(a, b) {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

function wrapDegrees360(value) {
  let deg = value % 360;
  if (deg < 0) deg += 360;
  return deg;
}
