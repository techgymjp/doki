// 火焔型土器（縄文時代中期）
// 形・文様の特徴をもとに手続き的に作った3Dモデル（特定の一点を正確に写したものではありません）
import { smoothstep, clamp } from '../noise.js';

const TAU = Math.PI * 2;
const RIM_Y = 1.0;

// ---- 2D 距離関数 ----
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
function sdRoundBox(x, y, cx, cy, hx, hy, rr) {
  const qx = Math.abs(x - cx) - hx + rr, qy = Math.abs(y - cy) - hy + rr;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
}
function sdCapsule(x, y, ax, ay, bx, by, r) {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = clamp((px * vx + py * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h) - r;
}
function smin(a, b, k) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

// 正面・背面の突起：鶏のとさかのような「鶏頭冠（けいとうかん）突起」
function crestBlock(X, Y) {
  let d = sdRoundBox(X, Y, -0.015, 0.13, 0.165, 0.13, 0.045);
  for (const cx of [-0.14, -0.088, -0.036]) {
    d = smin(d, sdCircle(X, Y, cx, 0.255, 0.04), 0.015);
    d = smin(d, sdCapsule(X, Y, cx, 0.27, cx - 0.022, 0.33, 0.016), 0.01);
  }
  d = smin(d, sdRoundBox(X, Y, 0.09, 0.27, 0.065, 0.15, 0.055), 0.02);
  d = smin(d, sdCapsule(X, Y, 0.14, 0.16, 0.205, 0.25, 0.026), 0.015);
  let hole = sdCircle(X, Y, -0.065, 0.12, 0.048);
  hole = Math.min(hole, sdRoundBox(X, Y, 0.09, 0.3, 0.017, 0.065, 0.016));
  hole = Math.min(hole, sdCircle(X, Y, -0.13, 0.19, 0.02));
  return Math.max(d, -hole);
}

// 左右の突起：大きく弧を描いて外へ張り出す輪状の把手
function crestLoop(X, Y) {
  let d = sdRoundBox(X, Y, 0, 0.04, 0.2, 0.05, 0.025);
  let ring = Math.abs(Math.hypot(X - 0.035, Y - 0.215) - 0.16) - 0.042;
  ring = Math.max(ring, -sdRoundBox(X, Y, 0.215, 0.17, 0.08, 0.04, 0.012));
  d = smin(d, ring, 0.025);
  d = smin(d, sdCircle(X, Y, 0.205, 0.245, 0.04), 0.012);
  // 内側の小さな像（とさか状の飾り）
  d = smin(d, sdCapsule(X, Y, -0.04, 0.06, -0.025, 0.19, 0.038), 0.02);
  let head = sdCircle(X, Y, -0.025, 0.225, 0.058);
  for (const [cx, cy] of [[-0.07, 0.28], [-0.03, 0.295], [0.01, 0.28]]) head = smin(head, sdCapsule(X, Y, cx, cy - 0.02, cx, cy + 0.025, 0.015), 0.01);
  d = smin(d, head, 0.012);
  d = Math.max(d, -sdCircle(X, Y, -0.025, 0.23, 0.019));
  return d;
}

// 口縁部全体の形（負＝土がある）
function crownSdf(u, y, r) {
  const Y = y - RIM_Y;
  if (Y < -0.01) return -1;
  const circ = TAU * r;
  // 鋸歯状の小突起
  const t = (u * 32 + 0.5) % 1;
  const tooth = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, 1.25))), 0.75);
  let d = (Y - (0.045 + 0.06 * tooth)) * 0.5;
  const k = Math.round(u * 4);
  const du = u - k / 4;
  let X = du * circ;
  const kk = ((k % 4) + 4) % 4;
  if (Math.abs(X) < 0.3) {
    if (kk === 1 || kk === 3) {
      if (kk === 3) X = -X;
      d = smin(d, crestLoop(X, Y), 0.02);
    } else {
      if (kk === 2) X = -X;
      d = smin(d, crestBlock(X, Y), 0.02);
    }
  }
  return d;
}

// ---- 文様（隆線・渦巻） ----
function ridge(d, w) {
  const t = d / w;
  return t >= 1 ? 0 : Math.pow(1 - t * t, 0.6);
}
function spiral(x, y, cx, cy, R, p, dir, w) {
  const dx = (x - cx) * dir, dy = y - cy;
  const rho = Math.hypot(dx, dy);
  if (rho > R + w) return 0;
  const phi = Math.atan2(dy, dx);
  const t = rho / p - phi / TAU;
  let d = Math.abs(t - Math.round(t)) * p;
  if (rho < p * 0.4) d = Math.min(d, Math.max(0, rho - p * 0.15));
  return ridge(d, w) * (1 - smoothstep(R - w, R + w, rho));
}
const wrapU = (u) => u - Math.round(u);

function relief(u, y, r, low) {
  const W = low ? 1.7 : 1;
  const circ = TAU * r;
  let h = 0;
  if (y < 0.02) return 0;

  // 胴下部：縦に流れる沈線・隆線と、上部の渦巻文
  if (y < 0.575) {
    const xc = wrapU(u * 4) / 4 * circ; // 突起の真下を0とした横位置
    const xm = wrapU(u * 4 + 0.5) / 4 * circ; // 突起と突起の中間を0とした横位置
    // 渦巻（左右一対）
    let sp = 0, spMask = 1;
    if (y > 0.36) {
      const R = 0.068;
      for (const s of [-1, 1]) {
        const cx = s * 0.078;
        sp = Math.max(sp, spiral(xm, y, cx, 0.468, R, 0.022, s, 0.0075 * W));
        spMask = Math.min(spMask, smoothstep(R, R + 0.012, Math.hypot(xm - cx, y - 0.468)));
      }
      // 突起の下の「I」字の柱
      const inPillar = Math.abs(xc) < 0.05 && y > 0.37;
      if (inPillar) {
        const pd = Math.min(Math.abs(Math.abs(xc) - 0.024), Math.abs(y - 0.375) + Math.max(0, Math.abs(xc) - 0.024));
        sp = Math.max(sp, ridge(pd, 0.007 * W));
        spMask = Math.min(spMask, smoothstep(0.035, 0.05, Math.abs(xc)));
      }
    }
    // 縦の隆線
    const n = 72;
    const uw = u + 0.0018 * Math.sin(y * 34 + Math.floor(u * 9) * 2.1);
    const f = (uw * n) % 1 - 0.5;
    const period = circ / n;
    const lines = ridge(Math.abs(f) * period, 0.36 * period * (low ? 1.2 : 1)) * (low ? 0.5 : 0.85);
    const fadeLow = smoothstep(0.02, 0.06, y);
    h = Math.max(lines * spMask * fadeLow, sp);
  } else if (y < 0.665) {
    // 肩の横帯
    for (const yy of [0.588, 0.618, 0.648]) h = Math.max(h, ridge(Math.abs(y - yy), 0.0085 * W));
  } else if (y < 0.945) {
    // 胴上部：S字・渦巻文の帯
    const xm = wrapU(u * 4 + 0.5) / 4 * circ;
    const xc = wrapU(u * 4) / 4 * circ;
    for (const s of [-1, 1]) {
      h = Math.max(h, spiral(xm, y, s * 0.16, 0.8, 0.125, 0.031, -s, 0.0095 * W));
      h = Math.max(h, spiral(xc, y, s * 0.075, 0.74, 0.055, 0.022, s, 0.0075 * W));
    }
    // 突起の下の目のような楕円
    const e = Math.hypot(xc / 0.04, (y - 0.85) / 0.075);
    h = Math.max(h, ridge(Math.abs(e - 1) * 0.04, 0.009 * W));
    if (e < 0.85) h = Math.min(h, -0.6);
    // 渦と渦をつなぐ横の隆線
    h = Math.max(h, ridge(Math.abs(y - 0.672), 0.007 * W), ridge(Math.abs(y - 0.935), 0.007 * W) * 0.8);
  } else if (y < RIM_Y + 0.005) {
    for (const yy of [0.958, 0.986]) h = Math.max(h, ridge(Math.abs(y - yy), 0.0085 * W));
  }
  // 口縁の突起：輪郭に沿った隆線
  if (y > RIM_Y - 0.005) {
    const sd = crownSdf(u, y, r);
    h = Math.max(h, ridge(Math.abs(sd + 0.016), 0.0065 * W), ridge(Math.abs(sd + 0.042), 0.006 * W) * 0.7);
  }
  return h * 0.011;
}

function color(u, y, r, h, n, rnd, out) {
  const hn = h / 0.011;
  // 明るい灰褐色の素地
  let cr = 0.68, cg = 0.62, cb = 0.53;
  const v = 1 + 0.13 * n[0];
  cr *= v; cg *= v; cb *= v;
  // 赤みのむら
  const red = smoothstep(0.15, 0.5, n[2]) * 0.06;
  cr += red; cg += red * 0.4;
  // 隆線は明るく、くぼみは暗い
  const shade = hn < 0 ? 0.62 : 0.8 + 0.28 * hn;
  cr *= shade; cg *= shade; cb *= shade;
  // すす（黒い焼きむら）
  const soot = smoothstep(0.05, 0.45, n[1] + (y > 0.55 ? 0.12 : -0.08)) * 0.55;
  cr += (0.2 - cr) * soot; cg += (0.18 - cg) * soot; cb += (0.16 - cb) * soot;
  // 砂粒
  if (rnd > 0.985) { cr *= 1.25; cg *= 1.22; cb *= 1.18; }
  else if (rnd < 0.012) { cr *= 0.6; cg *= 0.6; cb *= 0.6; }
  out[0] = cr; out[1] = cg; out[2] = cb;
}

export const kaen = {
  id: 'kaen',
  name: '火焔型土器',
  ruby: 'かえんがたどき',
  kind: '土器',
  era: '縄文時代中期（約5,300〜4,800年前）',
  place: '新潟県・信濃川流域',
  available: true,
  profile: [
    [0, 0], [0.1, 0], [0.215, 0], [0.232, 0.02], [0.26, 0.12], [0.3, 0.3], [0.34, 0.45],
    [0.375, 0.545], [0.44, 0.585], [0.51, 0.63], [0.545, 0.7], [0.56, 0.8], [0.555, 0.9],
    [0.545, 0.97], [0.545, 1.0], [0.56, 1.12], [0.6, 1.28], [0.64, 1.44],
  ],
  NU: 384,
  rows: [
    { until: (r) => r >= 0.214, rows: 10 },
    { until: (r, y) => y >= RIM_Y, rows: 112 },
    { until: 'end', rows: 92 },
  ],
  baseHeight: 0.1,
  height: 1.44,
  thickness: (u, y) => (y < 0.01 ? 0.032 : y > RIM_Y ? 0.022 + 0.022 * smoothstep(RIM_Y, RIM_Y + 0.08, y) : 0.022),
  relief,
  reliefMax: 0.011,
  sdf: crownSdf,
  color,
  innerColor: [0.4, 0.35, 0.29],
  fractureColor: [0.74, 0.6, 0.48],
  edgeColor: [0.58, 0.52, 0.44],
  description: [
    '火焔型土器（かえんがたどき）は、縄文時代中期（約5,300〜4,800年前）に、現在の新潟県の信濃川流域を中心につくられた深鉢形の土器です。',
    '口縁部に燃え上がる炎のような大きな突起が4つ付き、粘土ひもを貼りつけた隆線や渦巻の文様で器の全面が飾られています。縄目の文様（縄文）をほとんど使わないのも特徴です。',
    '1936年に長岡市の馬高（うまたか）遺跡で見つかった一点が「火焔土器」と呼ばれたことから、この名がつきました。十日町市の笹山遺跡から出土した火焔型土器などは、縄文土器として唯一の国宝に指定されています。',
    '内側にお焦げが残るものもあり、煮炊きに使われたと考えられています。',
  ],
  note: 'このゲームの3Dモデルは、火焔型土器の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
