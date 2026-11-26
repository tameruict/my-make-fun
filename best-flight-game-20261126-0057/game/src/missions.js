import { SPEED_ENVELOPE } from './config.js';
import { createRandom, seededPick } from './random.js';
import { placeTargetRing, isOnRunway, getTerrainHeight } from './terrain.js';

export const MISSION_TYPES = Object.freeze([
  Object.freeze({ id: 'supply', name: 'Supply Drop', short: 'SUPPLY DROP', objective: 'Ring ahead' }),
  Object.freeze({ id: 'survey', name: 'Ridge Survey', short: 'RIDGE SURVEY', objective: 'Fly the ridge rings' }),
  Object.freeze({ id: 'rescue', name: 'Rescue Pickup', short: 'RESCUE PICKUP', objective: 'Land at Lagoon Atoll' })
]);

export function createMissionController(terrain, aircraft, seed) {
  return {
    seed,
    index: -1,
    completed: 0,
    score: 0,
    state: 'ACTIVE',
    timer: 0,
    limit: 0,
    current: null,
    nextSpawnIn: 0,
    passengers: 0,
    stoppedTime: 0,
    totalMissions: 9,
    stars: 0,
    finished: false,
    results: [],
    lastEvent: null,
    eventLog: [],
    rng: createRandom((seed >>> 0) ^ 0x51ed270b),
    terrain,
    aircraft
  };
}

export function spawnNextMission(controller, world) {
  if (!controller) return null;
  controller.index += 1;
  if (controller.index >= controller.totalMissions) {
    const aircraft = world && world.aircraft;
    const terrain = world && world.terrain;
    const returnRunway = terrain && terrain.runways
      ? terrain.runways.find((runway) => runway.role === 'main') || terrain.runways[0]
      : null;
    const parkedAtBase =
      aircraft &&
      aircraft.onGround &&
      aircraft.speed < 1 &&
      returnRunway &&
      isOnRunway(returnRunway, aircraft.x, aircraft.z, 4);
    if (controller.completed >= 3 && !parkedAtBase && returnRunway) {
      const rtb = {
        type: 'rescue',
        rtb: true,
        name: 'Return to Base',
        title: 'RETURN TO BASE',
        objective: `Land at ${returnRunway.name}`,
        target: { x: returnRunway.cx, z: returnRunway.cz, y: returnRunway.elevation },
        runwayTarget: returnRunway,
        returnRunway,
        phase: 'return',
        round: 2,
        index: controller.index,
        limit: 360,
        timer: 360,
        distance: 0,
        bearing: 0,
        passed: false,
        completed: false,
        failed: false
      };
      controller.current = rtb;
      controller.state = 'ACTIVE';
      controller.timer = 360;
      controller.limit = 360;
      controller.nextSpawnIn = 0;
      pushMissionEvent(controller, { type: 'mission-spawn', name: rtb.title, index: controller.index });
      return rtb;
    }
    controller.state = 'COMPLETE';
    controller.finished = true;
    controller.stars = controller.completed >= 3 ? computeSortieStarRating(controller.score) : 0;
    controller.current = null;
    pushMissionEvent(controller, { type: 'sortie-complete', score: controller.score, stars: controller.stars });
    return null;
  }

  const terrain = world.terrain;
  const round = Math.floor(controller.index / 3);
  const type = MISSION_TYPES[controller.index % 3];
  const limit = round === 0 ? 120 : round === 1 ? 90 : 60;
  const rng = controller.rng;
  let current = null;

  if (type.id === 'supply') {
    const island = seededPick(rng, terrain.islands);
    const ringX = island.cx + (rng() - 0.5) * island.radius * 0.5;
    const ringZ = island.cz + (rng() - 0.5) * island.radius * 0.5;
    const ringGround = Math.max(0, getTerrainHeight(terrain, ringX, ringZ));
    const ring = placeTargetRing({
      x: ringX,
      z: ringZ,
      altitude: ringGround + 110 + round * 45 + Math.floor(rng() * 40),
      radius: 55 - round * 10,
      pulseSeed: controller.index
    });
    current = {
      type: type.id,
      name: type.name,
      title: type.short,
      objective: 'Ring ahead',
      ring,
      target: ring,
      round,
      index: controller.index,
      limit,
      timer: limit,
      distance: 0,
      bearing: 0,
      passed: false,
      completed: false,
      failed: false
    };
  } else if (type.id === 'survey') {
    const ridge = terrain.islands.find((island) => island.name === 'Ridge Crest') || terrain.islands[0];
    const rings = [];
    const count = 6;
    let ridgeMax = 0;
    for (let s = 0; s <= 16; s += 1) {
      const t = s / 16;
      const sx = ridge.cx - ridge.radius * 0.45 + t * ridge.radius * 0.9;
      const sz = ridge.cz - ridge.radius * 0.35 + t * ridge.radius * 0.7;
      ridgeMax = Math.max(ridgeMax, getTerrainHeight(terrain, sx, sz));
    }
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1);
      const ringX = ridge.cx - ridge.radius * 0.45 + t * ridge.radius * 0.9;
      const ringZ = ridge.cz - ridge.radius * 0.35 + t * ridge.radius * 0.7;
      rings.push(
        placeTargetRing({
          x: ringX,
          z: ringZ,
          altitude: ridgeMax + 80 + t * (120 + round * 30),
          radius: 42 - round * 6,
          pulseSeed: controller.index * 10 + i
        })
      );
    }
    current = {
      type: type.id,
      name: type.name,
      title: type.short,
      objective: 'Ring 1/6',
      ring: rings[0],
      rings,
      ringIndex: 0,
      target: rings[0],
      round,
      index: controller.index,
      limit,
      timer: limit,
      distance: 0,
      bearing: 0,
      passed: false,
      completed: false,
      failed: false
    };
  } else {
    const runwayTarget = terrain.runways.find((runway) => runway.role === 'rescue') || terrain.runways[0];
    const returnRunway = terrain.runways.find((runway) => runway.role === 'main') || terrain.runways[0];
    current = {
      type: type.id,
      name: type.name,
      title: type.short,
      objective: `Land at ${runwayTarget.name}`,
      target: { x: runwayTarget.cx, z: runwayTarget.cz, y: runwayTarget.elevation },
      runwayTarget,
      returnRunway,
      phase: 'landing',
      round,
      index: controller.index,
      limit,
      timer: limit,
      distance: 0,
      bearing: 0,
      passed: false,
      completed: false,
      failed: false
    };
    controller.passengers = 0;
    controller.stoppedTime = 0;
  }

  controller.current = current;
  controller.state = 'ACTIVE';
  controller.timer = limit;
  controller.limit = limit;
  controller.nextSpawnIn = 0;
  pushMissionEvent(controller, { type: 'mission-spawn', name: current.title, index: controller.index + 1 });
  return current;
}

export function checkMissionObjectives(controller, world, dt) {
  if (!controller) return;
  const aircraft = world.aircraft;

  if (controller.state === 'COOLDOWN') {
    controller.nextSpawnIn -= dt;
    if (controller.nextSpawnIn <= 0) spawnNextMission(controller, world);
    return;
  }
  if (controller.state !== 'ACTIVE' || !controller.current) return;

  const current = controller.current;
  current.timer -= dt;
  controller.timer = Math.max(0, current.timer);
  updateDistanceBearing(aircraft, current.target, current);

  if (aircraft && aircraft.crashed) {
    controller.state = 'CRASHED';
    controller.finished = true;
    controller.stars = 0;
    pushMissionEvent(controller, { type: 'sortie-lost', reason: aircraft.crashReason || 'crash' });
    return;
  }

  if (current.timer <= 0) {
    failCurrentMission(controller, 'timeout');
    return;
  }

  if (current.type === 'supply') {
    if (!current.passed && ringContains(aircraft, current.ring)) {
      const horizontal = Math.hypot(aircraft.x - current.ring.x, aircraft.z - current.ring.z);
      const accuracy = clamp(1 - horizontal / current.ring.radius, 0, 1) * 50;
      const speedBonus = aircraft.speed >= 40 && aircraft.speed <= 80 ? 50 : 0;
      const bonus = Math.round(accuracy + speedBonus);
      controller.score += 200 + bonus;
      current.passed = true;
      aircraft.fuel = Math.min(100, aircraft.fuel + 20);
      pushMissionEvent(controller, { type: 'supply-pass', bonus });
      completeCurrentMission(controller, world);
    }
  } else if (current.type === 'survey') {
    const ring = current.rings[current.ringIndex];
    if (ring && !ring.passed && ringContains(aircraft, ring)) {
      const horizontal = Math.hypot(aircraft.x - ring.x, aircraft.z - ring.z);
      const precision = horizontal <= 20 ? Math.round(50 * (1 - horizontal / 20)) : 0;
      controller.score += 100 + precision;
      ring.passed = true;
      current.ringIndex += 1;
      pushMissionEvent(controller, { type: 'survey-ring', index: current.ringIndex, precision });
      if (current.ringIndex >= current.rings.length) {
        controller.score += 200;
        completeCurrentMission(controller, world);
      } else {
        current.ring = current.rings[current.ringIndex];
        current.target = current.ring;
        current.objective = `Ring ${current.ringIndex + 1}/${current.rings.length}`;
      }
    }
  } else if (current.type === 'rescue') {
    checkRescueMission(controller, world, dt, current);
  }
}

export function computeSortieStarRating(score) {
  if (score >= 3500) return 3;
  if (score >= 2000) return 2;
  if (score >= 800) return 1;
  return 0;
}

function checkRescueMission(controller, world, dt, current) {
  const aircraft = world.aircraft;
  if (current.phase === 'landing') {
    if (
      aircraft.onGround &&
      aircraft.speed < 1 &&
      isOnRunway(current.runwayTarget, aircraft.x, aircraft.z, 2)
    ) {
      controller.stoppedTime += dt;
      if (controller.stoppedTime >= 2) {
        controller.passengers = 2;
        current.phase = 'takeoff';
        current.objective = `Return to ${current.returnRunway.name}`;
        current.target = { x: current.returnRunway.cx, z: current.returnRunway.cz, y: current.returnRunway.elevation };
        pushMissionEvent(controller, { type: 'passenger-aboard', passengers: 2 });
      }
    } else if (aircraft.onGround && aircraft.speed >= 1) {
      controller.stoppedTime = 0;
    }
  } else if (current.phase === 'takeoff') {
    if (!aircraft.onGround && aircraft.speed > SPEED_ENVELOPE.rotateSpeed) {
      current.phase = 'return';
    }
  } else if (current.phase === 'return') {
    if (
      aircraft.onGround &&
      aircraft.speed < 1 &&
      isOnRunway(current.returnRunway, aircraft.x, aircraft.z, current.rtb ? 4 : 2)
    ) {
      const landingBonus =
        world.lastLandingQuality === 'smooth' ? 50 : world.lastLandingQuality === 'hard' ? 10 : 0;
      if (current.rtb) {
        controller.score += landingBonus;
        controller.state = 'COMPLETE';
        controller.finished = true;
        controller.stars = computeSortieStarRating(controller.score);
        controller.current = null;
        pushMissionEvent(controller, { type: 'sortie-complete', score: controller.score, stars: controller.stars });
      } else {
        controller.score += 400 + landingBonus;
        completeCurrentMission(controller, world);
      }
    }
  }
}

function completeCurrentMission(controller, world) {
  const current = controller.current;
  const timeBonus = current.limit > 0 ? Math.round(100 * clamp(current.timer / current.limit, 0, 1)) : 0;
  controller.score += timeBonus;
  current.completed = true;
  controller.completed += 1;
  controller.results.push({
    type: current.type,
    index: current.index,
    timeLeft: Math.max(0, current.timer),
    completed: true
  });
  controller.state = 'COOLDOWN';
  controller.nextSpawnIn = 5;
  pushMissionEvent(controller, {
    type: 'mission-complete',
    name: current.title,
    completed: controller.completed,
    score: controller.score
  });
}

function failCurrentMission(controller, reason) {
  const current = controller.current;
  if (current) {
    current.failed = true;
    controller.results.push({ type: current.type, index: current.index, completed: false, reason });
    pushMissionEvent(controller, { type: 'mission-failed', name: current.title, reason });
  }
  controller.state = 'COOLDOWN';
  controller.nextSpawnIn = 5;
}

function ringContains(aircraft, ring) {
  if (!aircraft || !ring) return false;
  const horizontal = Math.hypot(aircraft.x - ring.x, aircraft.z - ring.z);
  return horizontal <= ring.radius && Math.abs(aircraft.y - ring.y) <= ring.radius;
}

function updateDistanceBearing(aircraft, target, current) {
  if (!aircraft || !target) return;
  const dx = target.x - aircraft.x;
  const dz = target.z - aircraft.z;
  current.distance = Math.hypot(dx, dz);
  let bearing = (Math.atan2(dx, -dz) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;
  current.bearing = bearing;
}

function pushMissionEvent(controller, event) {
  controller.lastEvent = event;
  if (controller.eventLog.length < 128) controller.eventLog.push(event);
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
