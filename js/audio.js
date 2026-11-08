// WebAudio で合成する効果音（音声ファイル不要）
let ctx = null;
let master = null;   // 効果音
let bgmBus = null;   // BGM
let tickBus = null;  // 時計の音
let echo = null;     // BGM用の残響
let muted = false;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const out = ctx.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 1; master.connect(out);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0; bgmBus.connect(out);
    tickBus = ctx.createGain(); tickBus.gain.value = 0.9; tickBus.connect(out);
    // 簡単なこだま（ディレイ）で広がりを出す
    const d = ctx.createDelay(1.5); d.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    echo = ctx.createGain(); echo.gain.value = 0.5;
    echo.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(bgmBus);
    ctx._out = out;
    setInterval(schedule, 100);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export function setMuted(m) {
  muted = m;
  if (ctx) ctx._out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
}
export function isMuted() { return muted; }

// ---------------- BGM（陽音階のおだやかな曲） ----------------
// 陽音階：レ ミ ソ ラ シ
const YO = [146.83, 164.81, 196.0, 220.0, 246.94];
const note = (deg, oct = 0) => YO[((deg % 5) + 5) % 5] * Math.pow(2, Math.floor(deg / 5) + oct);
const CHORDS = [[0, 3, 6], [2, 4, 7], [1, 4, 6], [3, 5, 8]]; // 4小節ごとに変わる和音（音階の度数）
const BEAT = 60 / 66;
let bgmOn = false, nextBeat = 0, beatNo = 0, lastMel = 7;
let ticking = false, nextTick = 0, tickNo = 0;

export function startBgm() {
  if (!ctx) return;
  if (!bgmOn) { bgmOn = true; nextBeat = ctx.currentTime + 0.1; beatNo = 0; }
  bgmBus.gain.cancelScheduledValues(ctx.currentTime);
  bgmBus.gain.setTargetAtTime(bgmMuted ? 0 : bgmLevel, ctx.currentTime, 1.2);
}
let bgmMuted = false;
let bgmLevel = 0.55;
export function setBgmMuted(m) {
  bgmMuted = m;
  if (ctx) bgmBus.gain.setTargetAtTime(m ? 0 : bgmLevel, ctx.currentTime, 0.3);
}
export function isBgmMuted() { return bgmMuted; }
// 画面が隠れている間は止め、戻ったら続きから
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume().then(() => { nextBeat = ctx.currentTime + 0.1; nextTick = ctx.currentTime + 0.1; });
});
export function setBgmVolume(v) {
  bgmLevel = v;
  if (bgmMuted) return;
  if (!ctx) return;
  bgmBus.gain.setTargetAtTime(v, ctx.currentTime, 0.6);
}
export function setTicking(on) {
  if (!ctx) return;
  if (on && !ticking) { nextTick = ctx.currentTime + 0.05; tickNo = 0; }
  ticking = on;
}

function pad(t, freqs, dur) {
  for (const f of freqs) {
    for (const det of [-4, 4]) {
      const o = ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 1.8);
      g.gain.setValueAtTime(0.022, t + dur - 1.6);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      o.connect(lp).connect(g).connect(bgmBus);
      o.start(t); o.stop(t + dur + 0.5);
    }
  }
}
// 琴のようなはじく音
function pluck(t, f, vol) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator();
  o.type = 'triangle'; o.frequency.value = f;
  o2.type = 'sine'; o2.frequency.value = f * 2;
  const g = ctx.createGain(), g2 = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  g2.gain.value = 0.25;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.2);
  o.connect(lp); o2.connect(g2).connect(lp);
  lp.connect(g);
  g.connect(bgmBus); g.connect(echo);
  o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
}
function bass(t, f, dur) {
  const o = ctx.createOscillator();
  o.type = 'sine'; o.frequency.value = f;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bgmBus);
  o.start(t); o.stop(t + dur + 0.1);
}
// 時計の「カチ」「コチ」
function tick(t, high) {
  const n = Math.floor(ctx.sampleRate * 0.03);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12));
  const src = ctx.createBufferSource(); src.buffer = b;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = high ? 3400 : 2500; bp.Q.value = 6;
  const g = ctx.createGain(); g.gain.value = 0.32;
  src.connect(bp).connect(g).connect(tickBus);
  src.start(t);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = high ? 1900 : 1500;
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.05, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  o.connect(og).connect(tickBus); o.start(t); o.stop(t + 0.05);
}

function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  const ahead = ctx.currentTime + 0.3;
  while (bgmOn && nextBeat < ahead) {
    const t = nextBeat;
    const bar = Math.floor(beatNo / 4), beat = beatNo % 4;
    const chord = CHORDS[Math.floor(bar / 4) % CHORDS.length];
    if (beatNo % 16 === 0) {
      pad(t, chord.map((dg) => note(dg, 1)), BEAT * 16);
      bass(t, note(chord[0], 0) / 2, BEAT * 8);
    }
    if (beatNo % 16 === 8) bass(t, note(chord[0], 0) / 2, BEAT * 8);
    // ぽつりぽつりと旋律
    const p = beat === 0 ? 0.75 : beat === 2 ? 0.5 : 0.18;
    if (Math.random() < p) {
      lastMel = Math.max(5, Math.min(13, lastMel + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      pluck(t + (Math.random() < 0.3 ? BEAT / 2 : 0), note(lastMel, 1), 0.07);
      if (Math.random() < 0.15) pluck(t + BEAT * 0.25, note(lastMel + 2, 1), 0.04);
    }
    nextBeat += BEAT;
    beatNo++;
  }
  while (ticking && nextTick < ahead) {
    tick(nextTick, tickNo % 2 === 0);
    nextTick += 1;
    tickNo++;
  }
}

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
  src.connect(bp).connect(g).connect(master);
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
  o.connect(g).connect(master);
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
    o.connect(g).connect(master);
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
  src.connect(lp).connect(g).connect(master);
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
    o.connect(g).connect(master);
    o.start(st); o.stop(st + 1);
  });
}
