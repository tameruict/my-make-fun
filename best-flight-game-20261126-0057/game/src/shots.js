import { FLIGHT_VIEWPORT, SPEED_ENVELOPE } from './config.js';
import { createRandom } from './random.js';
import { generateIslandTerrain, getTerrainHeight, runwayLocalCoordinates } from './terrain.js';
import { createAircraftState, stepFlightPhysics } from './aircraft.js';
import { createMissionController, spawnNextMission, checkMissionObjectives } from './missions.js';
import { createChaseCamera, updateCameraFollow, getCameraProjection } from './camera.js';

export const SHOT_PRESETS = Object.freeze({
  patrol: Object.freeze({ seed: 7, ticks: 3600, screen: 'PLAY', label: 'SUPPLY DROP' }),
  survey: Object.freeze({ seed: 11, ticks: 6000, screen: 'PLAY', label: 'RIDGE SURVEY' }),
  rescue: Object.freeze({ seed: 19, ticks: 8400, screen: 'PLAY', label: 'RESCUE PICKUP' }),
  end: Object.freeze({ seed: 23, ticks: 10800, screen: 'OVER', label: 'PATROL COMPLETE', maxTicks: 54000 })
});

export function createFlightWorld(seed) {
  const world = {
    seed,
    shotName: null,
    rng: createRandom((seed >>> 0) ^ 0xabc),
    terrain: null,
    aircraft: null,
    missionController: null,
    camera: null,
    particles: [],
    sortieState: 'PLAY',
    screen: 'PLAY',
    tick: 0,
    windSpeed: 0,
    lastLandingQuality: null,
    lastMissionEvent: null,
    events: [],
    audio: null,
    muted: false
  };
  world.reset = function resetWorld(nextSeed) {
    const actualSeed = nextSeed == null ? world.seed : nextSeed;
    world.seed = actualSeed;
    world.shotName = null;
    world.rng = createRandom((actualSeed >>> 0) ^ 0xabc);
    world.terrain = generateIslandTerrain(actualSeed);
    world.aircraft = createAircraftState(world.terrain, world.terrain.runways[0]);
    world.missionController = createMissionController(world.terrain, world.aircraft, actualSeed);
    world.camera = createChaseCamera(world.aircraft);
    world.particles = [];
    world.sortieState = 'PLAY';
    world.screen = 'PLAY';
    world.tick = 0;
    world.windSpeed = 0;
    world.lastLandingQuality = null;
    world.lastMissionEvent = null;
    world.events = [];
    spawnNextMission(world.missionController, world);
    return world;
  };
  world.reset(seed);
  return world;
}

export function stageShot(shotName, seed, world) {
  const target = world || createFlightWorld(seed);
  const preset = SHOT_PRESETS[shotName] || SHOT_PRESETS.patrol;
  target.reset(seed == null ? preset.seed : seed);
  target.shotName = shotName;

  const limit = shotName === 'end' ? preset.maxTicks || 54000 : 60000;

  for (let tick = 0; tick < limit; tick += 1) {
    if (target.sortieState !== 'PLAY') break;
    if (shotName === 'end') {
      autopilotStep(target);
      continue;
    }
    const current = target.missionController.current;
    const airborne = !target.aircraft.onGround;
    if (shotName === 'patrol' && airborne && current && current.type === 'supply' && current.target) {
      const proj = getCameraProjection(target.camera, current.target.x, current.target.y, current.target.z);
      const inFrame = !proj.behind && proj.sx >= 240 && proj.sx <= 1040 && proj.sy >= 120 && proj.sy <= 475;
      if (
        target.missionController.completed >= 1 &&
        target.aircraft.agl > 110 &&
        current.distance >= 450 &&
        current.distance <= 880 &&
        Math.abs(target.aircraft.roll) < 38 &&
        inFrame
      ) {
        break;
      }
    }
    if (shotName === 'survey' && airborne && current && current.type === 'survey' && current.ringIndex >= 2 && current.distance >= 180 && current.distance <= 850) break;
    if (
      shotName === 'rescue' &&
      airborne &&
      current &&
      current.type === 'rescue' &&
      current.phase === 'landing' &&
      current.distance >= 260 &&
      current.distance <= 620 &&
      target.aircraft.agl >= 18 &&
      target.aircraft.agl <= 85 &&
      target.aircraft.flaps &&
      Math.abs(angleDifference(target.aircraft.heading, current.runwayTarget.heading)) < 12
    ) {
      break;
    }
    autopilotStep(target);
  }

  if (shotName !== 'end') {
    const windowTicks = shotName === 'patrol' ? 45 : shotName === 'survey' ? 30 : 20;
    for (let tick = 0; tick < windowTicks; tick += 1) {
      stageFinalWindow(target, shotName);
      if (target.sortieState !== 'PLAY') break;
    }
  }

  if (shotName === 'end') {
    target.screen = target.sortieState === 'COMPLETE' ? 'OVER' : 'PLAY';
  } else {
    target.screen = 'PLAY';
  }
  const result = verifyShotCriteria(target);
  target.shotReady = result.ok;
  return result;
}

export function autopilotStep(world) {
  const aircraft = world.aircraft;
  const controller = world.missionController;
  const current = controller ? controller.current : null;
  const input = {
    pitchSet: null,
    rollSet: null,
    throttleSet: null,
    brakes: false,
    flaps: aircraft.flaps,
    yawLeft: false,
    yawRight: false
  };

  if (!aircraft || aircraft.crashed) {
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
    return input;
  }

  if (aircraft.onGround) {
    const holdingRescue =
      current && current.type === 'rescue' && (current.phase === 'landing' || current.phase === 'return');
    const holdingCooldown = controller && controller.state === 'COOLDOWN';
    const sortieDone = world.sortieState !== 'PLAY' || aircraft.fuel <= 0;
    if (holdingRescue || holdingCooldown || sortieDone) {
      input.throttleSet = 0;
      input.brakes = true;
      input.pitchSet = 3;
      input.rollSet = 0;
      input.flaps = !!holdingRescue;
    } else {
      input.throttleSet = 100;
      input.brakes = false;
      input.pitchSet = 10;
      input.rollSet = 0;
      input.flaps = false;
    }
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
    return input;
  }

  if (current && current.type === 'rescue') {
    if (current.phase === 'landing' || current.phase === 'return') {
      const runway = current.phase === 'return' ? current.returnRunway : current.runwayTarget;
      flyApproach(world, input, runway);
      return input;
    }
    input.throttleSet = 100;
    input.pitchSet = 10;
    input.rollSet = 0;
    input.flaps = false;
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
    return input;
  }

  flyCruise(world, input, current);
  return input;
}

export function verifyShotCriteria(world) {
  const missing = [];
  const aircraft = world && world.aircraft;
  const controller = world && world.missionController;
  const camera = world && world.camera;
  const shotName = (world && world.shotName) || 'patrol';

  if (!aircraft) missing.push('aircraft');
  if (!controller) missing.push('mission-controller');
  if (!camera) missing.push('camera');
  if (!world || !world.terrain) missing.push('terrain');

  if (aircraft) {
    if (shotName === 'end') {
      if (world.sortieState !== 'COMPLETE' || !aircraft.onGround || aircraft.crashed) missing.push('parked-or-complete');
    } else if (aircraft.onGround || aircraft.crashed) {
      missing.push('aircraft-airborne');
    }
  }

  if (controller) {
    const current = controller.current;
    if (!current && !(shotName === 'end' && world.sortieState === 'COMPLETE')) {
      missing.push('active-mission');
    }
    if (current) {
      const target = current.target;
      if (target) {
        const distance = Math.hypot(target.x - aircraft.x, target.z - aircraft.z);
        if (distance > 2000) missing.push('target-within-2km');
        const projection = getCameraProjection(camera, target.x, target.y || aircraft.y, target.z);
        if (
          projection.behind ||
          projection.sx < 20 ||
          projection.sx > FLIGHT_VIEWPORT.width - 20 ||
          projection.sy < 20 ||
          projection.sy > FLIGHT_VIEWPORT.height - 20
        ) {
          missing.push('target-in-front');
        }
      }
    }
  }

  if (world && world.terrain && camera) {
    const islandVisible = world.terrain.islands.some((island) => {
      const r = island.radius * 0.4;
      const samples = [
        [island.cx, island.cz],
        [island.cx + r, island.cz],
        [island.cx - r, island.cz],
        [island.cx, island.cz + r],
        [island.cx, island.cz - r]
      ];
      return samples.some(([sx, sz]) => {
        const projection = getCameraProjection(camera, sx, Math.max(10, getTerrainHeight(world.terrain, sx, sz) + 20), sz);
        return !projection.behind && projection.sx >= -120 && projection.sx <= FLIGHT_VIEWPORT.width + 120 && projection.sy >= -120 && projection.sy <= FLIGHT_VIEWPORT.height + 120;
      });
    });
    if (!islandVisible) missing.push('island-in-view');
  }

  if (aircraft && (!Number.isFinite(aircraft.y) || !Number.isFinite(aircraft.speed))) {
    missing.push('instruments-reading');
  }

  if (missing.length > 0) {
    console.warn('[ridgeline-shot] missing:', missing.join(', '));
  }
  return { ok: missing.length === 0, missing };
}

export function stepWorld(world, dt, input) {
  const aircraft = world.aircraft;
  const controller = world.missionController;
  world.events = [];
  world.windSpeed = computeWind(controller);
  stepFlightPhysics(aircraft, input, dt, {
    terrain: world.terrain,
    tick: world.tick,
    windSpeed: world.windSpeed,
    events: world.events,
    rng: world.rng
  });

  for (const event of world.events) {
    if (event.type === 'landing') {
      world.lastLandingQuality = event.quality;
      spawnDust(world, aircraft);
    } else if (event.type === 'crash') {
      world.sortieState = 'CRASHED';
      spawnWreckage(world, aircraft);
    }
  }

  checkMissionObjectives(controller, world, dt);
  if (controller.state === 'COMPLETE') world.sortieState = 'COMPLETE';
  if (controller.state === 'CRASHED' || aircraft.crashed) world.sortieState = 'CRASHED';
  if (
    world.sortieState === 'PLAY' &&
    aircraft.fuel <= 0 &&
    aircraft.onGround &&
    aircraft.speed < 1 &&
    !aircraft.crashed &&
    controller.completed >= 3
  ) {
    controller.score += 100;
    world.sortieState = 'COMPLETE';
    controller.state = 'COMPLETE';
    controller.finished = true;
    controller.current = null;
    controller.stars = controller.score >= 3500 ? 3 : controller.score >= 2000 ? 2 : 1;
  }

  const latest = controller.lastEvent;
  if (latest && latest !== world.lastMissionEvent) {
    world.lastMissionEvent = latest;
    if (latest.type === 'supply-pass') spawnCrate(world, aircraft);
    if (latest.type === 'survey-ring') spawnCrate(world, aircraft);
  }

  updateCameraFollow(world.camera, aircraft, dt);
  updateParticles(world, dt);
  world.tick += 1;
  return world.events;
}

export function updateParticles(world, dt) {
  if (!world) return;
  const particles = world.particles;
  const terrain = world.terrain;
  if (world.tick % 8 === 0 && particles.length < 240) {
    const volcano = terrain.islands.find((island) => island.kind === 'volcanic');
    if (volcano) {
      const x = volcano.cx + (world.rng() - 0.5) * 36;
      const z = volcano.cz + (world.rng() - 0.5) * 36;
      const base = getTerrainHeight(terrain, x, z);
      particles.push({
        x,
        y: base + 12,
        z,
        vx: 0.4 + world.windSpeed * 0.2 + (world.rng() - 0.5),
        vy: 7 + world.rng() * 3,
        vz: (world.rng() - 0.5) * 1.2,
        life: 6,
        maxLife: 6,
        size: 9 + world.rng() * 7,
        kind: 'smoke',
        color: '#9aa3ad',
        alpha: 0.32,
        gravity: 0
      });
    }
  }
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    if (particle.gravity) particle.vy -= particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    if (particle.kind === 'smoke') {
      particle.size += dt * 3;
      particle.alpha = Math.max(0, particle.alpha - dt * 0.04);
    }
  }
}

function flyCruise(world, input, current) {
  const aircraft = world.aircraft;
  const controller = world.missionController;
  if (!current || !current.target || (controller && controller.state === 'COOLDOWN')) {
    const headingRad = (aircraft.heading * Math.PI) / 180;
    const groundHere = getTerrainHeight(world.terrain, aircraft.x, aircraft.z);
    const ahead = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad, [250, 600, 1000, 1500]);
    const safeAlt = Math.max(240, ahead > 15 ? ahead + 170 : 200, groundHere > 15 ? groundHere + 100 : 160);
    const desiredHeading = bearingTo(aircraft.x, aircraft.z, 0, 0);
    const headingError = angleDifference(desiredHeading, aircraft.heading);
    input.throttleSet = safeAlt > aircraft.y + 30 ? 90 : 62;
    input.pitchSet = clamp(((safeAlt - aircraft.y) * 0.25 / Math.max(aircraft.speed, 25)) * (180 / Math.PI), -10, 18);
    input.rollSet = aircraft.agl < 65 ? 0 : clamp(headingError * 1.8, -32, 32);
    input.flaps = false;
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
    return;
  }
  const isSurvey = current.type === 'survey' && current.rings && current.rings.length > 1;
  const isSupply = current.type === 'supply';
  let target = current.target;
  let targetAltitude = target.y != null ? target.y : aircraft.y;

  if (isSurvey) {
    const rings = current.rings;
    const first = rings[0];
    const last = rings[rings.length - 1];
    const lineX = last.x - first.x;
    const lineZ = last.z - first.z;
    const lineLength = Math.hypot(lineX, lineZ);
    if (lineLength > 1) {
      const ux = lineX / lineLength;
      const uz = lineZ / lineLength;
      const rx = -uz;
      const rz = ux;
      const relX = aircraft.x - first.x;
      const relZ = aircraft.z - first.z;
      const along = relX * ux + relZ * uz;
      const across = relX * rx + relZ * rz;
      const entryAlong = -850;
      if (current.ringIndex === 0) {
        if (along > -80 && Math.abs(across) > 90) {
          target = { x: first.x + ux * entryAlong, z: first.z + uz * entryAlong, y: first.y };
          targetAltitude = first.y;
        } else if (along > 35) {
          target = { x: first.x + ux * entryAlong, z: first.z + uz * entryAlong, y: first.y };
          targetAltitude = first.y;
        } else {
          const aimAlong = Math.min(0, Math.max(entryAlong, along + 340));
          target = { x: first.x + ux * aimAlong, z: first.z + uz * aimAlong, y: first.y };
          targetAltitude = first.y;
        }
      } else {
        const ring = rings[Math.min(current.ringIndex, rings.length - 1)];
        const ringAlong = (ring.x - first.x) * ux + (ring.z - first.z) * uz;
        const ringDistance = Math.hypot(ring.x - aircraft.x, ring.z - aircraft.z);
        if (along > ringAlong + 35) {
          const backAlong = ringAlong - 550;
          target = { x: first.x + ux * backAlong, z: first.z + uz * backAlong, y: ring.y };
          targetAltitude = ring.y;
        } else if (ringDistance < 180) {
          target = ring;
          targetAltitude = ring.y;
        } else {
          const lookahead = Math.min(lineLength, Math.max(0, along) + 280);
          target = { x: first.x + ux * lookahead, z: first.z + uz * lookahead, y: ring.y };
          targetAltitude = ring.y;
        }
      }
    }
  }

  const distance = Math.hypot(target.x - aircraft.x, target.z - aircraft.z);
  const timeToTarget = distance / Math.max(aircraft.speed, 20);
  const aimX = target.x - world.windSpeed * timeToTarget;
  const aimZ = target.z;
  const desiredHeading = bearingTo(aircraft.x, aircraft.z, aimX, aimZ);
  const headingError = angleDifference(desiredHeading, aircraft.heading);
  const insideOrbit = !isSurvey && distance < 420 && Math.abs(headingError) > 50;
  const turnTight = !insideOrbit && Math.abs(headingError) > 25;
  const headingRad = (aircraft.heading * Math.PI) / 180;
  const groundHere = getTerrainHeight(world.terrain, aircraft.x, aircraft.z);
  const lowTakeoff = aircraft.agl < 50 && groundHere < 80 && aircraft.y < 110;
  const bankLimit = lowTakeoff ? 18 : isSurvey ? 52 : turnTight ? 48 : 34;
  let rollCmd = insideOrbit ? 0 : clamp(headingError * 2.4, -bankLimit, bankLimit);

  const lookDistances = [150, 350, 600, 900, 1300, 1700, 2100].filter((d) => distance > 1600 || d < Math.max(450, distance - 40));
  const ahead = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad, lookDistances);
  let desiredAltitude = targetAltitude;
  const aheadClearance = ahead > 15 ? (isSurvey ? 50 : distance > 900 ? 170 : distance > 400 ? 110 : 55) : 30;
  const groundClearance = groundHere > 15 ? (isSurvey ? 40 : distance > 900 ? 100 : distance > 400 ? 65 : 40) : 25;
  desiredAltitude = Math.max(desiredAltitude, ahead + aheadClearance, groundHere + groundClearance);
  const altitudeError = desiredAltitude - aircraft.y;
  const terrainUrgent = (ahead > 15 && ahead + (isSurvey ? 50 : distance > 600 ? 165 : 80) > aircraft.y) || groundHere + 60 > aircraft.y;

  if (terrainUrgent && !isSurvey && !lowTakeoff && (distance > 350 || ahead > aircraft.y + 5)) {
    const leftH = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad - 0.65, [350, 750, 1200]);
    const rightH = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad + 0.65, [350, 750, 1200]);
    if (ahead > aircraft.y - 30) {
      rollCmd = leftH <= rightH ? -48 : 48;
    }
  }
  input.rollSet = rollCmd;

  const desiredVy = clamp(altitudeError * 0.28, -12, 14);
  let desiredPitch = clamp((desiredVy / Math.max(aircraft.speed, 25)) * (180 / Math.PI), -16, 20);
  if (lowTakeoff) desiredPitch = Math.max(desiredPitch, 12);
  if (terrainUrgent) desiredPitch = Math.max(desiredPitch, 18);
  input.pitchSet = desiredPitch;

  if (terrainUrgent) input.throttleSet = aircraft.speed < 50 ? 100 : 62;
  else if (insideOrbit) input.throttleSet = 62;
  else if (turnTight) input.throttleSet = aircraft.speed < 50 ? 90 : aircraft.speed > 58 ? 40 : 60;
  else if (isSurvey) {
    if (altitudeError > 80) input.throttleSet = 100;
    else if (aircraft.speed < 52) input.throttleSet = 90;
    else if (aircraft.speed > 64) input.throttleSet = 42;
    else input.throttleSet = 64;
  } else if (altitudeError > 60) input.throttleSet = 100;
  else if (distance > 1100) input.throttleSet = aircraft.speed < 75 ? 95 : 78;
  else if (aircraft.speed < 52) input.throttleSet = 100;
  else if (aircraft.speed > 74) input.throttleSet = 40;
  else input.throttleSet = 66;
  input.flaps = false;
  input.brakes = false;
  stepWorld(world, FLIGHT_VIEWPORT.step, input);
}

function flyApproach(world, input, runway) {
  const aircraft = world.aircraft;
  if (!runway) {
    flyCruise(world, input, world.missionController.current);
    return;
  }
  const local = runwayLocalCoordinates(runway, aircraft.x, aircraft.z);
  const thresholdAlong = -runway.length / 2;
  const aimTouchAlong = thresholdAlong + Math.min(25, runway.length * 0.12);
  const distToAim = aimTouchAlong - local.along;
  const distToEnd = runway.length / 2 - local.along;
  const lateral = local.across;
  const headingErrorToRunway = Math.abs(angleDifference(aircraft.heading, runway.heading));
  const tooHighForFinal = aircraft.y - runway.elevation > Math.max(105, distToAim * 0.115);
  const onFinal =
    !tooHighForFinal &&
    distToEnd > -80 &&
    distToAim < 1400 &&
    Math.abs(lateral) < 120 &&
    headingErrorToRunway < 28;
  const offCenterNear = distToAim < 120 && distToEnd > 20 && Math.abs(lateral) > runway.width / 2 + 5;
  const overshot = distToEnd <= -80 || (distToEnd <= 10 && aircraft.agl > 18);

  if (!onFinal || offCenterNear || overshot) {
    const headingRad = (aircraft.heading * Math.PI) / 180;
    const gateBack = runway.id === 'palm' ? 480 : 750;
    const entryAlong = thresholdAlong - gateBack;
    const fafPoint = {
      x: runway.cx + runway.forward.x * entryAlong,
      z: runway.cz + runway.forward.z * entryAlong
    };
    const basePoint =
      runway.id === 'palm'
        ? { x: 40, z: 150 }
        : { x: 180, z: 120 };

    let aim = fafPoint;
    if (aircraft.agl < 80 && getTerrainHeight(world.terrain, aircraft.x, aircraft.z) > 15) {
      aim = runway.id === 'lagoon' ? { x: -750, z: 250 } : { x: 250, z: 120 };
    } else if (runway.id === 'palm' && aircraft.x < -120) {
      aim = { x: 250, z: 120 };
    } else if (tooHighForFinal && Math.hypot(aircraft.x - basePoint.x, aircraft.z - basePoint.z) > 350) {
      aim = basePoint;
    } else if (tooHighForFinal) {
      aim = runway.id === 'palm' ? { x: 250, z: 250 } : { x: 0, z: 0 };
    } else if (local.along > entryAlong + 150) {
      aim = runway.id === 'lagoon' && aircraft.z > 600 ? { x: -750, z: 250 } : basePoint;
    } else if (Math.abs(lateral) < 260 && local.along > entryAlong - 350) {
      const aimAlong = Math.min(thresholdAlong - 120, local.along + 350);
      aim = {
        x: runway.cx + runway.forward.x * aimAlong,
        z: runway.cz + runway.forward.z * aimAlong
      };
    }

    const distGate = Math.hypot(aim.x - aircraft.x, aim.z - aircraft.z);
    const lookDistances = [250, 550, 900, 1400, 1900].filter((d) => distGate > 1500 || d <= Math.max(350, distGate));
    const ahead = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad, lookDistances);
    const groundHere = getTerrainHeight(world.terrain, aircraft.x, aircraft.z);
    const crabX = aim.x - world.windSpeed * (distGate / Math.max(aircraft.speed, 25));
    const desiredHeading = bearingTo(aircraft.x, aircraft.z, crabX, aim.z);
    const headingError = angleDifference(desiredHeading, aircraft.heading);
    const maxBank = aircraft.agl < 45 ? 0 : aircraft.agl < 65 ? 18 : 48;
    let rollCmd = clamp(headingError * 2.4, -maxBank, maxBank);
    const aheadMin = ahead > 15 ? ahead + 150 : 45;
    const groundMin = groundHere > 15 ? groundHere + 80 : 35;
    const terrainUrgent = (ahead > 15 && ahead + 150 > aircraft.y) || groundHere + 70 > aircraft.y;
    if (terrainUrgent && ahead > aircraft.y - 40 && aircraft.agl >= 55) {
      const leftH = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad - 0.65, [450, 900, 1400]);
      const rightH = maxTerrainAhead(world.terrain, aircraft.x, aircraft.z, headingRad + 0.65, [450, 900, 1400]);
      rollCmd = leftH <= rightH ? -45 : 45;
    }
    input.rollSet = rollCmd;

    const alongFromGate = Math.max(0, aimTouchAlong - local.along);
    const gateAltitude = runway.elevation + clamp(alongFromGate * 0.052, 42, 85);
    const desiredAltitude = Math.max(gateAltitude, aheadMin, groundMin);
    const altitudeError = desiredAltitude - aircraft.y;
    const desiredVy = clamp(altitudeError * 0.28, -11, 14);
    const heightAboveRunway = aircraft.y - runway.elevation;
    const approachMinPitch = heightAboveRunway > 130 ? -14 : heightAboveRunway > 75 ? -7 : -4.5;
    let desiredPitch = clamp((desiredVy / Math.max(aircraft.speed, 25)) * (180 / Math.PI), approachMinPitch, 18);
    if (aircraft.agl < 55 || terrainUrgent) desiredPitch = Math.max(desiredPitch, 18);
    input.pitchSet = desiredPitch;
    if (terrainUrgent || aircraft.agl < 55) input.throttleSet = aircraft.speed < 50 ? 100 : 62;
    else if (altitudeError > 80) input.throttleSet = 100;
    else if (distGate < 1100) input.throttleSet = aircraft.speed < 40 ? 75 : aircraft.speed > 48 ? 36 : 50;
    else if (distGate > 1500) input.throttleSet = aircraft.speed < 75 ? 95 : 78;
    else input.throttleSet = aircraft.speed < 55 ? 90 : aircraft.speed > 68 ? 45 : 68;
    input.flaps = false;
    input.brakes = false;
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
    return;
  }

  const look = Math.max(30, Math.min(distToEnd, 280));
  const targetAlong = local.along + look;
  const targetX = runway.cx + runway.forward.x * targetAlong;
  const targetZ = runway.cz + runway.forward.z * targetAlong;
  const timeToLook = Math.max(look, 30) / Math.max(aircraft.speed, 25);
  const crabX = targetX - world.windSpeed * timeToLook;
  const desiredHeading = bearingTo(aircraft.x, aircraft.z, crabX, targetZ);
  const headingError = angleDifference(desiredHeading, aircraft.heading);
  input.rollSet = clamp(headingError * 2.2, -25, 25);
  const headingRad = (aircraft.heading * Math.PI) / 180;
  const groundHere = getTerrainHeight(world.terrain, aircraft.x, aircraft.z);
  const preThreshold = local.along < thresholdAlong - 2;
  const aheadShort = preThreshold
    ? Math.max(
        groundHere,
        getTerrainHeight(world.terrain, aircraft.x + Math.sin(headingRad) * 90, aircraft.z - Math.cos(headingRad) * 90),
        getTerrainHeight(world.terrain, aircraft.x + Math.sin(headingRad) * 180, aircraft.z - Math.cos(headingRad) * 180),
        getTerrainHeight(world.terrain, aircraft.x + Math.sin(headingRad) * 320, aircraft.z - Math.cos(headingRad) * 320),
        getTerrainHeight(world.terrain, aircraft.x + Math.sin(headingRad) * 480, aircraft.z - Math.cos(headingRad) * 480)
      )
    : groundHere;
  const glideBase = runway.elevation + (preThreshold ? 4.0 : 0) + Math.max(0, distToAim) * 0.052;
  const glideAltitude = preThreshold ? Math.max(glideBase, aheadShort + 4.8) : glideBase;
  const altitudeError = glideAltitude - aircraft.y;
  input.flaps = aircraft.agl < 260;
  input.brakes = false;
  input.throttleSet =
    aircraft.speed < 29 ? 85 : aircraft.agl < 7 && !preThreshold ? 41 : aircraft.speed < 32 ? 52 : aircraft.speed > 36 ? 40 : 47;

  const heightAboveRunway = aircraft.y - runway.elevation;
  const minPitch = heightAboveRunway > 45 ? -9 : heightAboveRunway > 14 ? -5.5 : -4.0;
  let desiredVy = clamp(-aircraft.speed * 0.055 + altitudeError * 0.3, -6.5, 4.0);
  if (aircraft.agl < 8 && !preThreshold) {
    desiredVy = clamp(-2.2, -2.5, -1.6);
  }
  input.pitchSet = clamp((desiredVy / Math.max(aircraft.speed, 24)) * (180 / Math.PI), minPitch, 6);
  stepWorld(world, FLIGHT_VIEWPORT.step, input);
}

function maxTerrainAhead(terrain, x, z, headingRad, distances) {
  let maxH = -999;
  for (const offset of [0, -0.24, 0.24]) {
    const rad = headingRad + offset;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    for (const d of distances) {
      if (offset !== 0 && d < 600) continue;
      const h = getTerrainHeight(terrain, x + sin * d, z - cos * d);
      if (h > maxH) maxH = h;
    }
  }
  return maxH;
}

function stageFinalWindow(world, shotName) {
  const input = { pitchSet: 0, rollSet: 0, throttleSet: 60, flaps: false, brakes: false };
  if (shotName === 'patrol') {
    input.rollSet = -20;
    input.pitchSet = 0;
    input.throttleSet = 60;
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
  } else if (shotName === 'survey') {
    input.rollSet = 0;
    input.pitchSet = 0;
    input.throttleSet = 65;
    stepWorld(world, FLIGHT_VIEWPORT.step, input);
  } else {
    autopilotStep(world);
  }
}

function computeWind(controller) {
  if (!controller) return 0;
  const round = Math.floor(Math.max(0, controller.index) / 3);
  if (round <= 0) return 0;
  if (round === 1) return 3;
  return 6;
}

function spawnDust(world, aircraft) {
  for (let i = 0; i < 10; i += 1) {
    world.particles.push({
      x: aircraft.x + (world.rng() - 0.5) * 6,
      y: aircraft.y + 1,
      z: aircraft.z + (world.rng() - 0.5) * 6,
      vx: (world.rng() - 0.5) * 4,
      vy: 1 + world.rng() * 2,
      vz: (world.rng() - 0.5) * 4,
      life: 0.9,
      maxLife: 0.9,
      size: 2 + world.rng() * 3,
      color: '#cbb98c',
      alpha: 0.7,
      gravity: 2
    });
  }
}

function spawnCrate(world, aircraft) {
  for (let i = 0; i < 14; i += 1) {
    world.particles.push({
      x: aircraft.x + (world.rng() - 0.5) * 4,
      y: aircraft.y - 2,
      z: aircraft.z + (world.rng() - 0.5) * 4,
      vx: (world.rng() - 0.5) * 3,
      vy: -2 - world.rng() * 3,
      vz: (world.rng() - 0.5) * 3,
      life: 1.6,
      maxLife: 1.6,
      size: 2 + world.rng() * 2,
      color: '#ffb35c',
      alpha: 0.9,
      gravity: 9
    });
  }
}

function spawnWreckage(world, aircraft) {
  for (let i = 0; i < 32; i += 1) {
    world.particles.push({
      x: aircraft.x,
      y: aircraft.y + 2,
      z: aircraft.z,
      vx: (world.rng() - 0.5) * 16,
      vy: 4 + world.rng() * 10,
      vz: (world.rng() - 0.5) * 16,
      life: 2.2,
      maxLife: 2.2,
      size: 2 + world.rng() * 4,
      color: i % 3 === 0 ? '#ff7a45' : '#4a4f57',
      alpha: 0.9,
      gravity: 12
    });
  }
}

function bearingTo(fromX, fromZ, toX, toZ) {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  let bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}

function angleDifference(a, b) {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
