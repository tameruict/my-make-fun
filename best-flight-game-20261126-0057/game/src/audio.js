import { createRandom } from './random.js';

export function createFlightAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    engineFilter: null,
    windGain: null,
    windFilter: null,
    noiseSource: null,
    muted: false,
    ready: false
  };
}

export function updateEngineDrone(audio, throttle, speed, muted) {
  if (!audio) return;
  audio.muted = !!muted;
  if (!audio.ready || !audio.ctx) return;
  try {
    const now = audio.ctx.currentTime;
    if (audio.master) {
      audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.5, now, 0.05);
    }
    if (audio.engineOsc && audio.engineGain) {
      const level = audio.muted ? 0 : 0.03 + (throttle / 100) * 0.07;
      audio.engineOsc.frequency.setTargetAtTime(52 + (throttle / 100) * 120, now, 0.08);
      audio.engineGain.gain.setTargetAtTime(level, now, 0.08);
    }
    if (audio.windFilter) {
      audio.windFilter.frequency.setTargetAtTime(300 + Math.min(speed, 120) * 9, now, 0.1);
    }
  } catch (err) {
    audio.ready = false;
  }
}

export function playTouchdownSound(audio, quality) {
  if (!audio || !audio.ready || !audio.ctx || audio.muted) return;
  try {
    const ctx = audio.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(quality === 'hard' ? 90 : 120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
    gain.gain.setValueAtTime(quality === 'hard' ? 0.5 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(audio.master || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  } catch (err) {
    audio.ready = false;
  }
}

export function playStallBuzzer(audio) {
  if (!audio || !audio.ready || !audio.ctx || audio.muted) return;
  try {
    const ctx = audio.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(audio.master || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (err) {
    audio.ready = false;
  }
}

export function playWindSound(audio, speed) {
  if (!audio || !audio.ready || !audio.ctx) return;
  try {
    const now = audio.ctx.currentTime;
    const level = audio.muted ? 0 : Math.min(0.09, 0.005 + Math.max(0, speed) * 0.0009);
    if (audio.windGain) audio.windGain.gain.setTargetAtTime(level, now, 0.12);
  } catch (err) {
    audio.ready = false;
  }
}

export function playRingChime(audio) {
  if (!audio || !audio.ready || !audio.ctx || audio.muted) return;
  playTone(audio, 660, 0.12, 'sine', 0.16);
  playTone(audio, 990, 0.16, 'sine', 0.12, 0.1);
}

export function playMissionFanfare(audio) {
  if (!audio || !audio.ready || !audio.ctx || audio.muted) return;
  playTone(audio, 523, 0.16, 'triangle', 0.16, 0);
  playTone(audio, 659, 0.16, 'triangle', 0.16, 0.14);
  playTone(audio, 784, 0.24, 'triangle', 0.18, 0.28);
}

export function resumeFlightAudio(audio) {
  if (!audio) return audio;
  try {
    if (!audio.ctx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return audio;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      const engineOsc = ctx.createOscillator();
      const engineFilter = ctx.createBiquadFilter();
      const engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      const windGain = ctx.createGain();
      const windFilter = ctx.createBiquadFilter();
      windGain.gain.value = 0;
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 600;
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = makeNoiseBuffer(ctx);
      noiseSource.loop = true;
      noiseSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      noiseSource.start();

      audio.ctx = ctx;
      audio.master = master;
      audio.engineOsc = engineOsc;
      audio.engineFilter = engineFilter;
      audio.engineGain = engineGain;
      audio.windGain = windGain;
      audio.windFilter = windFilter;
      audio.noiseSource = noiseSource;
      audio.ready = true;
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  } catch (err) {
    audio.ready = false;
  }
  return audio;
}

function makeNoiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 1.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const random = createRandom(0x1f2e3d4c);
  for (let i = 0; i < length; i += 1) data[i] = random() * 2 - 1;
  return buffer;
}

function playTone(audio, frequency, duration, type, volume, delay = 0) {
  try {
    const ctx = audio.ctx;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.master || ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch (err) {
    audio.ready = false;
  }
}
