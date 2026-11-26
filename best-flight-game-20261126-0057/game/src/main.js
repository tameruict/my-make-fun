import { FLIGHT_VIEWPORT } from './config.js';
import { createRandom } from './random.js';
import { generateIslandTerrain } from './terrain.js';
import { createAircraftState } from './aircraft.js';
import { createMissionController } from './missions.js';
import { createChaseCamera } from './camera.js';
import { drawHUD, drawDockedBanner } from './hud.js';
import {
  createFlightAudio,
  resumeFlightAudio,
  updateEngineDrone,
  playTouchdownSound,
  playStallBuzzer,
  playWindSound,
  playRingChime,
  playMissionFanfare
} from './audio.js';
import { renderFrame } from './render.js';
import { createFlightWorld, stageShot, autopilotStep, stepWorld } from './shots.js';

const STEP = FLIGHT_VIEWPORT.step;
const MAX_CATCH_UP = FLIGHT_VIEWPORT.maxCatchUp;
const BEST_KEY = 'ridgeline-patrol.best';

let canvas = null;
let ctx = null;
let statusEl = null;
let screenTextEl = null;
let background = null;
let world = null;
let audio = null;
let keys = new Set();
let mouse = { active: false, x: 0.5, y: 0.5 };
let lastTime = null;
let accumulator = 0;
let bestScore = 0;
let playSeed = 7;
let shotMode = false;
let audioLastMissionEvent = null;
let titleAttempts = 0;

export function bootRidgelinePatrol() {
  canvas = document.getElementById('flight-canvas');
  ctx = canvas.getContext('2d');
  statusEl = document.getElementById('flight-status');
  screenTextEl = document.getElementById('flight-screen-text');
  background = makeBackground();
  audio = createFlightAudio();
  bestScore = loadBestScore();

  const params = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
  const shotName = params.get('shot');
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  shotMode = !!shotName;

  sizeCanvas(shotMode);
  globalThis.addEventListener('resize', () => sizeCanvas(shotMode));

  if (shotMode) {
    runDeterministicShot(shotName, seed);
    return;
  }

  world = createFlightWorld(seed);
  playSeed = seed + 1;
  prepareTitleScene();
  attachInput();
  setStatus('Ridgeline Patrol ready. Press Space or click to fly.');
  runFixedTimestepLoop(world);
}

export function runFixedTimestepLoop(loopWorld) {
  world = loopWorld;
  lastTime = null;
  accumulator = 0;
  requestAnimationFrame(frame);
}

export function runDeterministicShot(shotName, seed) {
  world = createFlightWorld(seed);
  canvas.width = FLIGHT_VIEWPORT.width;
  canvas.height = FLIGHT_VIEWPORT.height;
  canvas.style.width = `${FLIGHT_VIEWPORT.width}px`;
  canvas.style.height = `${FLIGHT_VIEWPORT.height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  background = makeBackground();
  const result = stageShot(shotName, seed, world);
  world.screen = shotName === 'end' ? (world.sortieState === 'COMPLETE' ? 'OVER' : 'PLAY') : 'PLAY';
  const paint = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, FLIGHT_VIEWPORT.width, FLIGHT_VIEWPORT.height);
    renderFrame(ctx, world, background);
    drawScreenOverlay();
  };
  paint();
  requestAnimationFrame(() => {
    paint();
    requestAnimationFrame(() => {
      paint();
      globalThis.__shotReady = !!result.ok;
      globalThis.__shotResult = result;
    });
  });
  setStatus(`Rendering shot ${shotName}.`);
  return result;
}

export function handleSortieState(sortieWorld) {
  if (!sortieWorld) return 'PLAY';
  if (sortieWorld.sortieState === 'CRASHED') {
    sortieWorld.screen = 'OVER';
    updateBestScore(0);
    setStatus('Patrol lost. Press Space or click for a fresh sortie.');
  } else if (sortieWorld.sortieState === 'COMPLETE') {
    sortieWorld.screen = 'OVER';
    const controller = sortieWorld.missionController;
    updateBestScore(controller ? controller.score : 0);
    setStatus(`Patrol complete. ${controller ? controller.score : 0} points. Press Space for a fresh sortie.`);
  }
  return sortieWorld.sortieState;
}

function frame(timestamp) {
  if (!world) return;
  const now = typeof timestamp === 'number' ? timestamp : 0;
  if (lastTime == null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, MAX_CATCH_UP);
  accumulator += dt;

  let guard = 0;
  if (world.screen === 'PLAY') {
    while (accumulator >= STEP && guard < 30) {
      updatePlay(STEP);
      accumulator -= STEP;
      guard += 1;
      if (world.screen !== 'PLAY') {
        accumulator = 0;
        break;
      }
    }
  } else if (world.screen === 'TITLE') {
    while (accumulator >= STEP && guard < 30) {
      autopilotStep(world);
      accumulator -= STEP;
      guard += 1;
      if (world.sortieState !== 'PLAY') {
        world.reset(7 + (titleAttempts % 3));
        titleAttempts += 1;
        break;
      }
    }
  } else {
    accumulator = 0;
  }

  render();
  requestAnimationFrame(frame);
}

function updatePlay(dt) {
  const input = buildPlayerInput();
  const events = stepWorld(world, dt, input);
  handleAudioEvents(events);
  handleSortieState(world);
}

function handleAudioEvents(events) {
  for (const event of events || []) {
    if (event.type === 'landing') playTouchdownSound(audio, event.quality);
    if (event.type === 'stall' && world.tick % 24 === 0) playStallBuzzer(audio);
  }
  const controller = world.missionController;
  const latest = controller ? controller.lastEvent : null;
  if (latest && latest !== audioLastMissionEvent) {
    audioLastMissionEvent = latest;
    if (latest.type === 'supply-pass' || latest.type === 'survey-ring') playRingChime(audio);
    if (latest.type === 'mission-complete') playMissionFanfare(audio);
  }
  updateEngineDrone(audio, world.aircraft.throttle, world.aircraft.speed, audio.muted);
  playWindSound(audio, world.aircraft.speed);
}

function buildPlayerInput() {
  const input = {
    pitchUp: keys.has('w') || keys.has('arrowup'),
    pitchDown: keys.has('s') || keys.has('arrowdown'),
    rollLeft: keys.has('a') || keys.has('arrowleft'),
    rollRight: keys.has('d') || keys.has('arrowright'),
    yawLeft: keys.has('q'),
    yawRight: keys.has('e'),
    throttleUp: keys.has('shift'),
    throttleDown: keys.has('control'),
    brakes: keys.has('b'),
    flaps: world.aircraft.flaps,
    pitchSet: null,
    rollSet: null,
    throttleSet: null
  };
  if (mouse.active) {
    if (mouse.x < 0.06) input.rollLeft = true;
    if (mouse.x > 0.94) input.rollRight = true;
    if (mouse.y < 0.08) input.pitchUp = true;
    if (mouse.y > 0.92) input.pitchDown = true;
  }
  return input;
}

function render() {
  if (!world) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!shotMode && canvas.width !== FLIGHT_VIEWPORT.width) {
    const scale = canvas.width / FLIGHT_VIEWPORT.width;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  renderFrame(ctx, world, background);
  drawScreenOverlay();
}

function drawScreenOverlay() {
  if (!world) return;
  if (world.screen === 'TITLE') {
    drawDockedBanner(ctx, 'RIDGELINE PATROL', [
      'Kestrel K-7 island patrol',
      'SPACE / click to fly',
      `Best score: ${bestScore}`
    ]);
  } else if (world.screen === 'PAUSED') {
    drawDockedBanner(ctx, 'PAUSED', ['P or Esc to resume', 'M to mute sound']);
  } else if (world.screen === 'OVER') {
    const controller = world.missionController;
    if (world.sortieState === 'COMPLETE') {
      const stars = controller ? controller.stars : 0;
      drawDockedBanner(ctx, 'PATROL COMPLETE', [
        `${stars} STARS  \u00B7  Score ${controller ? controller.score : 0}`,
        `Missions ${controller ? controller.completed : 0}/${controller ? controller.totalMissions : 9}  \u00B7  Fuel ${Math.round(world.aircraft.fuel)}%`,
        'SPACE / click for a fresh sortie'
      ]);
    } else {
      drawDockedBanner(ctx, 'PATROL LOST', [
        `Score ${controller ? controller.score : 0}`,
        `Missions ${controller ? controller.completed : 0}/${controller ? controller.totalMissions : 9}`,
        'SPACE / click for a fresh sortie'
      ]);
    }
  }
}

function attachInput() {
  globalThis.addEventListener('keydown', (event) => {
    const key = normalizeKey(event.key);
    if (['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    keys.add(key);
    resumeFlightAudio(audio);
    if (key === 'space') handleAccept();
    else if (key === 'p' || key === 'escape') togglePause();
    else if (key === 'm') toggleMute();
    else if (key === 'f' && world.screen === 'PLAY') world.aircraft.flaps = !world.aircraft.flaps;
    else if (key === 'g' && world.screen === 'PLAY') world.aircraft.gear = !world.aircraft.gear;
  });
  globalThis.addEventListener('keyup', (event) => {
    keys.delete(normalizeKey(event.key));
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mouse.active = true;
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.active = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    resumeFlightAudio(audio);
    handleAccept();
  });
  globalThis.document.addEventListener('visibilitychange', () => {
    if (globalThis.document.hidden && world && world.screen === 'PLAY') togglePause();
  });
}

function handleAccept() {
  if (!world) return;
  if (world.screen === 'TITLE' || world.screen === 'OVER') {
    startSortie();
  } else if (world.screen === 'PAUSED') {
    togglePause();
  }
}

function startSortie() {
  const seed = playSeed;
  playSeed += 1;
  world.reset(seed);
  world.screen = 'PLAY';
  audioLastMissionEvent = null;
  accumulator = 0;
  lastTime = null;
  setStatus('Sortie started. Supply Drop inbound.');
}

function togglePause() {
  if (!world) return;
  if (world.screen === 'PLAY') {
    world.screen = 'PAUSED';
    setStatus('Paused.');
  } else if (world.screen === 'PAUSED') {
    world.screen = 'PLAY';
    accumulator = 0;
    lastTime = null;
    setStatus('Resumed.');
  }
}

function toggleMute() {
  if (!audio) return;
  audio.muted = !audio.muted;
  updateEngineDrone(audio, world ? world.aircraft.throttle : 0, world ? world.aircraft.speed : 0, audio.muted);
  setStatus(audio.muted ? 'Sound muted.' : 'Sound on.');
}

function prepareTitleScene() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    world.reset(7 + attempt);
    for (let tick = 0; tick < 1600 && world.sortieState === 'PLAY'; tick += 1) {
      autopilotStep(world);
    }
    if (world.sortieState === 'PLAY' && !world.aircraft.onGround) break;
  }
  world.screen = 'TITLE';
  titleAttempts = 0;
}

function sizeCanvas(forShot) {
  if (!canvas) return;
  if (forShot) {
    canvas.width = FLIGHT_VIEWPORT.width;
    canvas.height = FLIGHT_VIEWPORT.height;
    canvas.style.width = `${FLIGHT_VIEWPORT.width}px`;
    canvas.style.height = `${FLIGHT_VIEWPORT.height}px`;
    return;
  }
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  canvas.width = FLIGHT_VIEWPORT.width * dpr;
  canvas.height = FLIGHT_VIEWPORT.height * dpr;
  const viewWidth = globalThis.innerWidth || FLIGHT_VIEWPORT.width;
  const viewHeight = globalThis.innerHeight || FLIGHT_VIEWPORT.height;
  const scale = Math.min(viewWidth / FLIGHT_VIEWPORT.width, viewHeight / FLIGHT_VIEWPORT.height);
  canvas.style.width = `${FLIGHT_VIEWPORT.width * scale}px`;
  canvas.style.height = `${FLIGHT_VIEWPORT.height * scale}px`;
}

function makeBackground() {
  const offscreen = document.createElement('canvas');
  offscreen.width = FLIGHT_VIEWPORT.backgroundWidth;
  offscreen.height = FLIGHT_VIEWPORT.backgroundHeight;
  return { canvas: offscreen, context: offscreen.getContext('2d') };
}

function loadBestScore() {
  try {
    const raw = globalThis.localStorage ? globalThis.localStorage.getItem(BEST_KEY) : null;
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch (err) {
    return 0;
  }
}

function updateBestScore(score) {
  if (!Number.isFinite(score) || score <= bestScore) return;
  bestScore = score;
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(BEST_KEY, String(score));
  } catch (err) {
    bestScore = score;
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
  if (screenTextEl) screenTextEl.textContent = text;
}

function normalizeKey(key) {
  if (key === ' ') return 'space';
  return String(key || '').toLowerCase();
}

bootRidgelinePatrol();
