import { SPEED_ENVELOPE } from './config.js';
import { getTerrainHeight, findRunwayForPoint } from './terrain.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function createAircraftState(terrain, runway) {
  const strip = runway || (terrain && terrain.runways ? terrain.runways[0] : null);
  const heading = strip ? strip.heading : 90;
  const elevation = strip ? strip.elevation : 20;
  const cx = strip ? strip.cx : 0;
  const cz = strip ? strip.cz : 0;
  const fx = Math.sin((heading * Math.PI) / 180);
  const fz = -Math.cos((heading * Math.PI) / 180);
  const back = strip ? strip.length * 0.34 : 0;
  return {
    x: cx - fx * back,
    y: elevation,
    z: cz - fz * back,
    heading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    hp: 100,
    flaps: false,
    gear: true,
    brakes: false,
    onGround: true,
    crashed: false,
    stalled: false,
    engineOut: false,
    overspeed: false,
    vy: 0,
    agl: 0,
    propAngle: 0,
    damageFlash: 0,
    distance: 0,
    runwayId: strip ? strip.id : null
  };
}

export function stepFlightPhysics(aircraft, input, dt, ctx) {
  const events = (ctx && ctx.events) || [];
  if (!aircraft || aircraft.crashed) return aircraft;
  const controls = input || {};

  if (controls.throttleSet != null) aircraft.throttle = clamp(controls.throttleSet, 0, 100);
  if (controls.throttleUp) aircraft.throttle = clamp(aircraft.throttle + 2, 0, 100);
  if (controls.throttleDown) aircraft.throttle = clamp(aircraft.throttle - 2, 0, 100);
  if (controls.flaps != null) aircraft.flaps = !!controls.flaps;
  if (controls.brakes != null) aircraft.brakes = !!controls.brakes;

  const controlFactor = clamp(aircraft.speed / 65, 0.3, 1.0) * (aircraft.speed > SPEED_ENVELOPE.neverExceed ? 0.5 : 1);
  const pitchRate = 1.5 * controlFactor;
  const rollRate = 60 * controlFactor;
  let rollApplied = 0;

  if (controls.pitchSet != null) {
    const delta = controls.pitchSet - aircraft.pitch;
    aircraft.pitch += clamp(delta, -pitchRate * dt, pitchRate * dt);
  } else {
    if (controls.pitchUp) aircraft.pitch += pitchRate * dt;
    if (controls.pitchDown) aircraft.pitch -= pitchRate * dt;
  }

  if (controls.rollSet != null) {
    const delta = controls.rollSet - aircraft.roll;
    const step = clamp(delta, -rollRate * dt, rollRate * dt);
    aircraft.roll += step;
    rollApplied = step / dt;
  } else {
    if (controls.rollLeft) {
      aircraft.roll -= rollRate * dt;
      rollApplied = -rollRate;
    }
    if (controls.rollRight) {
      aircraft.roll += rollRate * dt;
      rollApplied = rollRate;
    }
    if (!controls.rollLeft && !controls.rollRight) {
      aircraft.roll = approach(aircraft.roll, 0, 10 * dt);
    }
  }

  aircraft.pitch = clamp(aircraft.pitch, -20, 25);
  aircraft.roll = clamp(aircraft.roll, -75, 75);

  const rollRad = aircraft.roll * DEG2RAD;
  let yawDegPerSec = 0;
  if (!aircraft.onGround) {
    yawDegPerSec += (9.81 * Math.tan(rollRad)) / Math.max(aircraft.speed, 15) * RAD2DEG;
  }
  if (controls.yawLeft) yawDegPerSec -= 15;
  if (controls.yawRight) yawDegPerSec += 15;
  yawDegPerSec += rollApplied / 4;
  aircraft.heading = wrapDegrees360(aircraft.heading + yawDegPerSec * dt);

  if (aircraft.onGround) {
    const engineAccel = aircraft.engineOut ? 0 : (aircraft.throttle / 100) * 11;
    const rolling = aircraft.brakes ? SPEED_ENVELOPE.brakeDecel : 0.8;
    aircraft.speed = Math.max(0, aircraft.speed + (engineAccel - rolling) * dt);
  } else if (aircraft.engineOut) {
    aircraft.speed += (35 - aircraft.speed) * 0.03;
  } else {
    let target = (aircraft.throttle / 100) * SPEED_ENVELOPE.maxLevel - (aircraft.flaps ? 10 : 0);
    if (aircraft.hp < 50) target *= 0.7;
    aircraft.speed += (target - aircraft.speed) * 0.02;
    aircraft.speed -= computeDragForce(aircraft);
  }
  aircraft.speed = clamp(aircraft.speed, 0, 140);

  const headingRad = aircraft.heading * DEG2RAD;
  const cosPitch = Math.cos(aircraft.pitch * DEG2RAD);
  const horizontal = aircraft.speed * cosPitch * dt;
  aircraft.x += Math.sin(headingRad) * horizontal + ((ctx && ctx.windSpeed) || 0) * dt;
  aircraft.z += -Math.cos(headingRad) * horizontal;
  aircraft.distance += Math.abs(horizontal);
  aircraft.propAngle += 0.05 + (aircraft.throttle / 100) * 0.62;
  aircraft.damageFlash = Math.max(0, aircraft.damageFlash - dt * 2);

  const ground = getTerrainHeight(ctx && ctx.terrain, aircraft.x, aircraft.z);
  aircraft.agl = aircraft.y - ground;

  if (aircraft.onGround) {
    aircraft.y = ground;
    aircraft.vy = 0;
    if (!aircraft.engineOut && aircraft.speed > SPEED_ENVELOPE.rotateSpeed && aircraft.pitch > 2) {
      aircraft.onGround = false;
      aircraft.vy = aircraft.speed * Math.sin(aircraft.pitch * DEG2RAD) * computeLiftForce(aircraft.speed, aircraft.flaps);
      pushEvent(events, { type: 'liftoff' });
    }
  } else {
    const lift = computeLiftForce(aircraft.speed, aircraft.flaps);
    let vy = aircraft.speed * Math.sin(aircraft.pitch * DEG2RAD) * lift;
    if (Math.abs(aircraft.roll) > 60) vy -= 2;
    if (aircraft.engineOut) vy = -3;
    aircraft.vy = vy;
    aircraft.y += vy * dt;

    const groundNow = getTerrainHeight(ctx && ctx.terrain, aircraft.x, aircraft.z);
    aircraft.agl = aircraft.y - groundNow;
    const runway = findRunwayForPoint(ctx && ctx.terrain, aircraft.x, aircraft.z, 6);
    if (aircraft.agl <= 1.6 && aircraft.vy <= 0.05) {
      handleTouchdown(aircraft, runway, groundNow, events);
    } else if (aircraft.y < groundNow) {
      crashAircraft(aircraft, 'terrain', events);
    } else if (!runway && aircraft.y <= 0.2 && groundNow <= 0.5) {
      crashAircraft(aircraft, 'water', events);
    }
  }

  aircraft.stalled = checkStallCondition(aircraft);
  if (aircraft.stalled) {
    aircraft.pitch = approach(aircraft.pitch, -10, 5 * dt);
    pushEvent(events, { type: 'stall' });
    if (aircraft.agl < 50 && aircraft.speed < 22 && aircraft.pitch < -6) {
      crashAircraft(aircraft, 'stall-spin', events);
    }
  }

  aircraft.overspeed = aircraft.speed > SPEED_ENVELOPE.neverExceed;
  if (aircraft.overspeed) {
    applyDamage(aircraft, 2 * dt, 'overspeed');
    pushEvent(events, { type: 'overspeed' });
  }

  const wasOut = aircraft.engineOut;
  burnFuel(aircraft, dt);
  if (aircraft.engineOut && !wasOut) pushEvent(events, { type: 'engine-out' });

  if (aircraft.hp <= 0 && !aircraft.crashed) crashAircraft(aircraft, 'damage', events);
  return aircraft;
}

export function computeLiftForce(speed, flaps) {
  const stallSpeed = flaps ? SPEED_ENVELOPE.stallFlaps : SPEED_ENVELOPE.stallBase;
  return clamp(speed / stallSpeed, SPEED_ENVELOPE.liftSpeedFloor, SPEED_ENVELOPE.liftSpeedCeiling);
}

export function computeDragForce(aircraft) {
  if (!aircraft || aircraft.pitch <= 10) return 0;
  return 0.05 * ((aircraft.pitch - 10) / 10);
}

export function checkStallCondition(aircraft) {
  if (!aircraft || aircraft.onGround) return false;
  const stallSpeed = aircraft.flaps ? SPEED_ENVELOPE.stallFlaps : SPEED_ENVELOPE.stallBase;
  return aircraft.speed < stallSpeed;
}

export function applyDamage(aircraft, amount, reason) {
  if (!aircraft) return 0;
  aircraft.hp = clamp(aircraft.hp - amount, 0, 100);
  aircraft.damageFlash = 1;
  if (reason) aircraft.lastDamageReason = reason;
  return aircraft.hp;
}

export function burnFuel(aircraft, dt) {
  if (!aircraft) return false;
  const rate = SPEED_ENVELOPE.fuelBurnIdle + (aircraft.throttle / 100) * SPEED_ENVELOPE.fuelBurnThrottle;
  aircraft.fuel = Math.max(0, aircraft.fuel - rate * dt);
  if (aircraft.fuel <= 0) aircraft.engineOut = true;
  return aircraft.engineOut;
}

function handleTouchdown(aircraft, runway, ground, events) {
  if (!runway) {
    crashAircraft(aircraft, 'terrain', events);
    return;
  }
  const headingDiff = Math.abs(angleDifference(aircraft.heading, runway.heading));
  const vertical = aircraft.vy;
  if (vertical < SPEED_ENVELOPE.crashVerticalLimit) {
    crashAircraft(aircraft, 'hard-landing', events);
    return;
  }
  if (
    aircraft.speed < SPEED_ENVELOPE.touchdownMinSpeed ||
    aircraft.speed > SPEED_ENVELOPE.touchdownMaxSpeed ||
    headingDiff > 20
  ) {
    crashAircraft(aircraft, 'runway-envelope', events);
    return;
  }
  if (vertical > SPEED_ENVELOPE.softVerticalLimit) {
    aircraft.onGround = true;
    aircraft.y = ground;
    aircraft.vy = 0;
    aircraft.speed = Math.min(aircraft.speed, SPEED_ENVELOPE.touchdownMaxSpeed);
    aircraft.runwayId = runway.id;
    pushEvent(events, { type: 'landing', quality: 'smooth', runway: runway.id });
  } else {
    applyDamage(aircraft, 10, 'hard-landing');
    aircraft.y = ground + 2.5;
    aircraft.vy = 2.2;
    pushEvent(events, { type: 'landing', quality: 'hard', runway: runway.id });
    if (aircraft.hp <= 0) crashAircraft(aircraft, 'damage', events);
  }
}

function crashAircraft(aircraft, reason, events) {
  if (aircraft.crashed) return;
  aircraft.crashed = true;
  aircraft.onGround = false;
  aircraft.crashReason = reason;
  aircraft.vy = -6;
  pushEvent(events, { type: 'crash', reason });
}

function pushEvent(events, event) {
  if (events && events.length < 64) events.push(event);
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
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

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
