export function createKitchenAudio() {
  const audio = {
    ctx: null,
    muted: false,
    sizzleGain: null,
    sizzleStarted: false,
    lastAlarmSecond: -1,
    unlock() {
      if (audio.muted) return;
      try {
        if (!audio.ctx) {
          const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
          if (!Ctx) return;
          audio.ctx = new Ctx();
        }
        if (audio.ctx.state === 'suspended') {
          audio.ctx.resume().catch(() => {});
        }
        ensureSizzleLoop(audio);
      } catch {
        // Audio stays silent if browser policy or headless context blocks it.
      }
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.sizzleGain && audio.ctx) {
        audio.sizzleGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.04);
      }
      return audio.muted;
    },
  };
  return audio;
}

export function playKnifeChopSound(audio) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(68, now + 0.075);
  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);

  playNoiseBurst(ctx, now, 0.055, 1600, 0.14);
}

export function playGrillSizzleSound(audio, occupiedSlots = 0, burst = false) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  ensureSizzleLoop(audio);
  if (audio.sizzleGain) {
    const target = occupiedSlots > 0 ? Math.min(0.08, 0.02 + occupiedSlots * 0.015) : 0;
    audio.sizzleGain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
  }
  if (burst) {
    playNoiseBurst(ctx, ctx.currentTime, 0.14, 3400, 0.12);
  }
}

export function playServiceBellSound(audio, doubleRush = false) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const tones = doubleRush ? [1174.66, 1567.98, 2093.0] : [1318.5, 1975.5];
  tones.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
    gain.gain.setValueAtTime(0.16, now + idx * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.05);
    osc.stop(now + idx * 0.05 + 0.45);
  });
}

export function playFlipChimeSound(audio, golden = true) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const freqs = golden ? [659.25, 987.77] : [440];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now + i * 0.04);
    gain.gain.setValueAtTime(0.12, now + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.04);
    osc.stop(now + i * 0.04 + 0.2);
  });
}

export function playOrderDingSound(audio) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

export function playTimerAlarmTick(audio, remainingSeconds) {
  if (!audio?.ctx || audio.muted || audio.ctx.state !== 'running') return;
  const sec = Math.ceil(remainingSeconds);
  if (sec > 30 || sec <= 0 || sec === audio.lastAlarmSecond) return;
  audio.lastAlarmSecond = sec;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(sec <= 10 ? 920 : 740, now);
  gain.gain.setValueAtTime(0.035, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

function ensureSizzleLoop(audio) {
  if (audio.sizzleStarted || !audio.ctx) return;
  const ctx = audio.ctx;
  const len = ctx.sampleRate * 1.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 1337;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = ((seed / 4294967296) * 2 - 1) * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  audio.sizzleGain = gain;
  audio.sizzleStarted = true;
}

function playNoiseBurst(ctx, startTime, duration, freq, peakGain) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let s = 918273;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 4294967296) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(startTime);
  src.stop(startTime + duration + 0.01);
}
