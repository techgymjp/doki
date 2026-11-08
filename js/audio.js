// WebAudio で合成する効果音（音声ファイル不要）
let ctx = null;
let muted = false;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function noiseBuffer(sec) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function clack(t, freq = 1800, vol = 0.5, dur = 0.07) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);
}
function thump(t, freq = 150, vol = 0.5, dur = 0.15) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur);
}

function bell(t, freq, vol, dur) {
  for (const [mul, v] of [[1, 1], [2.01, 0.35], [3.02, 0.12]]) {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = freq * mul;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

// ピースがはまった音：「カチッ」＋「キラーン」。進むほど音が高くなる
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];
export function playSnap(progress = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  clack(t, 2400, 0.55, 0.045);
  clack(t + 0.012, 1200, 0.3, 0.06);
  thump(t, 200, 0.45, 0.14);
  const i = Math.min(SCALE.length - 2, Math.floor(progress * (SCALE.length - 2)));
  bell(t + 0.05, SCALE[i], 0.22, 0.9);
  bell(t + 0.13, SCALE[i + 1] * 1.5, 0.13, 0.8);
}
export function playPick() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  clack(t, 3200, 0.15, 0.03);
}
export function playDeny() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 120, 0.25, 0.18);
}
export function playBreak() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 90, 0.8, 0.4);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(6000, t);
  lp.frequency.exponentialRampToValueAtTime(400, t + 1.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start(t);
  for (let i = 0; i < 14; i++) {
    const tt = t + 0.25 + Math.random() * 1.1;
    clack(tt, 1500 + Math.random() * 2500, 0.15 + Math.random() * 0.2, 0.04);
  }
}
export function playComplete() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  [392, 440, 523.25, 587.33, 659.25, 783.99].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain();
    const st = t + i * 0.12;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.25, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, st + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(st); o.stop(st + 1);
  });
}
