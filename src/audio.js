/** Soft ASMR-ish procedural collision sounds (no asset files). */

let ctx = null;
let master = null;
let enabled = true;
let lastPlayAt = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  return ctx;
}

export function setSoundEnabled(on) {
  enabled = on;
}

export async function resumeAudio() {
  const c = ensure();
  if (c?.state === 'suspended') await c.resume();
}

function noiseBuffer(duration) {
  const c = ensure();
  const length = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return buffer;
}

function playWood(intensity = 0.5) {
  const c = ensure();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const g = Math.min(1, Math.max(0.08, intensity));

  // soft body thump
  const osc = c.createOscillator();
  const oscGain = c.createGain();
  const filter = c.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110 + g * 40, t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(0.22 * g, t + 0.008);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(filter);
  filter.connect(oscGain);
  oscGain.connect(master);
  osc.start(t);
  osc.stop(t + 0.3);

  // gentle wood grain noise
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.22);
  const nGain = c.createGain();
  const nFilter = c.createBiquadFilter();
  nFilter.type = 'bandpass';
  nFilter.frequency.value = 650 + g * 200;
  nFilter.Q.value = 0.8;
  nGain.gain.setValueAtTime(0.0001, t);
  nGain.gain.exponentialRampToValueAtTime(0.16 * g, t + 0.004);
  nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  src.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(master);
  src.start(t);
}

function playMarble(intensity = 0.5) {
  const c = ensure();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const g = Math.min(1, Math.max(0.08, intensity));

  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc2.type = 'triangle';
  osc.frequency.setValueAtTime(1400 + g * 600, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.12);
  osc2.frequency.setValueAtTime(2100 + g * 400, t);
  osc2.frequency.exponentialRampToValueAtTime(900, t + 0.1);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.14 * g, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(gain);
  osc2.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc2.start(t);
  osc.stop(t + 0.18);
  osc2.stop(t + 0.18);

  // tiny glass tick noise
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.05);
  const nGain = c.createGain();
  const nFilter = c.createBiquadFilter();
  nFilter.type = 'highpass';
  nFilter.frequency.value = 1800;
  nGain.gain.setValueAtTime(0.08 * g, t);
  nGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(master);
  src.start(t);
}

function playMarbleWood(intensity = 0.5) {
  const c = ensure();
  if (!c || !enabled) return;
  const t = c.currentTime;
  const g = Math.min(1, Math.max(0.08, intensity));

  playWood(g * 0.55);

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900 + g * 300, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.14);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1 * g, t + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}

/**
 * @param {'wood'|'marble'|'marble-wood'} type
 * @param {number} intensity 0..1
 */
export function playImpact(type, intensity) {
  const now = performance.now();
  if (now - lastPlayAt < 40) return; // avoid harsh machine-gun
  lastPlayAt = now;

  if (type === 'marble') playMarble(intensity);
  else if (type === 'marble-wood') playMarbleWood(intensity);
  else playWood(intensity);
}
