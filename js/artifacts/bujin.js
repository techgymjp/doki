// 埴輪 挂甲の武人（古墳時代後期・群馬県太田市出土・国宝）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function smin(a, b, k) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
function cone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const h = clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - (ra + (rb - ra) * h);
}
// 縦向きの円すい台（楕円断面）。y0で半径r0、y1で半径r1。sz は奥行きの比
function frustum(x, y, z, y0, y1, r0, r1, sz = 1, round = 0.008) {
  const t = clamp((y - y0) / (y1 - y0), 0, 1);
  const r = r0 + (r1 - r0) * t;
  const dr = (Math.hypot(x, z / sz) - r) * Math.min(1, sz) + round;
  const dy = Math.abs(y - (y0 + y1) / 2) - Math.abs(y1 - y0) / 2 + round;
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0) - round;
}
function box(x, y, z, cx, cy, cz, hx, hy, hz, r = 0.006) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

function torusY(x, y, z, cx, cy, cz, R, r) {
  return Math.hypot(Math.hypot(x - cx, z - cz) - R, y - cy) - r;
}
// 写真：円筒の台の上に立つ。下からズボン状の脚、段になった草摺、小札の胴、肩甲、頬当つきの冑
function procCore(x, y, z) {
  const ax = Math.abs(x);
  let d = frustum(x, y, z, -0.3, 0.18, 0.16, 0.155, 1.0);                     // 円筒の台
  d = smin(d, cone(ax, y, z, 0.085, 0.16, 0.0, 0.088, 0.44, 0.0, 0.07, 0.08), 0.03);  // ゆったりした脚
  d = smin(d, frustum(x, y, z, 0.4, 0.63, 0.225, 0.16, 0.8), 0.03);            // 草摺
  d = smin(d, frustum(x, y, z, 0.6, 0.96, 0.15, 0.155, 0.78), 0.03);           // 胴
  d = smin(d, ell(x, y, z, 0, 1.13, 0.005, 0.085, 0.1, 0.09), 0.03);           // 頭
  return d;
}

function procSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  // 台の上下のふちの帯
  d = Math.min(d, torusY(x, y, z, 0, 0.035, 0, 0.158, 0.012));
  d = Math.min(d, torusY(x, y, z, 0, 0.17, 0, 0.152, 0.01));
  // 台の上にのる足
  d = smin(d, ell(ax, y, z, 0.09, 0.2, 0.04, 0.06, 0.03, 0.085), 0.02);
  // 臑当（すねあて）：すねを包む広い筒、縦の合わせ目
  d = Math.min(d, cone(ax, y, z, 0.09, 0.2, 0.0, 0.09, 0.32, 0.0, 0.088, 0.09));
  // 膝甲（ひざよろい）：草摺の下から広がるひざの防具
  d = Math.min(d, cone(ax, y, z, 0.092, 0.33, 0.0, 0.095, 0.43, 0.0, 0.1, 0.092));
  d = Math.min(d, torusY(ax, y, z, 0.09, 0.325, 0, 0.096, 0.01));
  // 草摺：3段に重なり、段ごとにくっきりした段差
  for (const [y0, y1, r0, r1] of [[0.4, 0.475, 0.232, 0.215], [0.47, 0.55, 0.212, 0.195], [0.545, 0.62, 0.192, 0.172]]) {
    d = Math.min(d, frustum(x, y, z, y0, y1, r0, r1, 0.8, 0.004));
  }
  // 肩甲：肩をおおう板が3枚重なる（下の板ほど外へ広がる）
  for (let k = 0; k < 3; k++) {
    const sh = cone(ax, y, z, 0.12, 0.96 - k * 0.035, 0, 0.225 + k * 0.012, 0.86 - k * 0.04, 0, 0.07 + k * 0.006, 0.088 + k * 0.008);
    d = Math.min(d, Math.max(sh, -(sh + 0.016), 0.9 - k * 0.035 - y + (ax - 0.12) * 0.6));
  }
  d = smin(d, cone(ax, y, z, 0.12, 0.95, 0, 0.215, 0.83, 0, 0.07, 0.08), 0.03);
  // 腕と籠手：右腕（-x）は曲げて体の前で大刀の柄をにぎり、左腕（+x）は下げて弓と大刀を持つ
  d = smin(d, cone(x, y, z, -0.22, 0.86, 0.0, -0.24, 0.7, 0.04, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, -0.24, 0.7, 0.04, -0.06, 0.62, 0.16, 0.04, 0.034), 0.02);
  d = Math.min(d, cone(x, y, z, -0.2, 0.68, 0.08, -0.1, 0.635, 0.135, 0.047, 0.044));   // 籠手
  d = smin(d, ell(x, y, z, -0.05, 0.615, 0.17, 0.035, 0.035, 0.035), 0.015);            // 右手
  d = smin(d, cone(x, y, z, 0.22, 0.86, 0.0, 0.25, 0.7, 0.04, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, 0.25, 0.7, 0.04, 0.2, 0.58, 0.13, 0.04, 0.034), 0.02);
  d = Math.min(d, cone(x, y, z, 0.245, 0.68, 0.06, 0.215, 0.61, 0.11, 0.047, 0.044));  // 籠手
  d = Math.min(d, cone(x, y, z, 0.212, 0.6, 0.118, 0.205, 0.585, 0.125, 0.045, 0.045)); // 鞆（とも：手首のまるい防具）
  d = smin(d, ell(x, y, z, 0.195, 0.565, 0.14, 0.035, 0.035, 0.035), 0.015);           // 左手
  // 弓：左手で持ち、体の左わきに縦に立てる（腕のうしろ）
  const bowZ = 0.06 + 0.04 * (1 - Math.pow((y - 0.66) / 0.55, 2));
  d = Math.min(d, Math.max(Math.hypot(x - 0.29, z - bowZ) - 0.017, Math.abs(y - 0.66) - 0.55));
  // 大刀：右手で柄を、左手でさやを持ち、腰の前に横たえる（柄頭に輪）
  d = Math.min(d, cone(x, y, z, -0.1, 0.625, 0.17, -0.02, 0.61, 0.175, 0.021, 0.022));  // 柄
  d = Math.min(d, Math.hypot(Math.hypot(x + 0.125, y - 0.63) - 0.022, z - 0.17) - 0.008);   // 環頭
  d = Math.min(d, cone(x, y, z, -0.02, 0.61, 0.175, 0.0, 0.607, 0.176, 0.032, 0.032));   // つば
  d = Math.min(d, cone(x, y, z, 0.0, 0.607, 0.176, 0.27, 0.55, 0.15, 0.026, 0.023));     // さや
  // 靫
  d = smin(d, box(x, y, z, 0.07, 0.83, -0.155, 0.075, 0.13, 0.03, 0.02), 0.02);
  d = smin(d, box(x, y, z, 0.07, 0.99, -0.16, 0.06, 0.04, 0.025, 0.015), 0.02);
  // 腰の帯（角ばった帯）
  d = Math.min(d, frustum(x, y, z, 0.6, 0.645, 0.17, 0.167, 0.8, 0.003));
  // 胸の蝶結び（冑のひもの結び目）
  for (const [kx, ky, kz] of [[0, 0.905, 0.122], [-0.02, 0.78, 0.15]]) {
    for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(Math.hypot(x - kx - sx * 0.022, y - ky) - 0.016, z - kz) - 0.006);
    d = Math.min(d, cone(x, y, z, kx - 0.012, ky - 0.005, kz, kx - 0.03, ky - 0.045, kz, 0.006, 0.006));
    d = Math.min(d, cone(x, y, z, kx + 0.012, ky - 0.005, kz, kx + 0.03, ky - 0.045, kz, 0.006, 0.006));
  }
  // 首
  d = smin(d, cone(x, y, z, 0, 0.95, 0, 0, 1.05, 0, 0.065, 0.06), 0.02);
  // 冑：はち＋衝角＋鋲の列
  d = smin(d, ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115), 0.02);
  d = smin(d, cone(x, y, z, 0, 1.235, 0.02, 0, 1.2, 0.15, 0.025, 0.012), 0.02);
  d = Math.max(d, y - 1.29);
  // 冑の縦の帯（前・左右）と、下のふちの帯
  for (const ang of [0, -1.0, 1.0]) {
    const cx = Math.sin(ang), cz = Math.cos(ang);
    const along = x * cx + z * cz, side = x * cz - z * cx;
    const band = Math.max(Math.abs(side) - 0.013, Math.abs(ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115)) - 0.007, 1.17 - y, -along);
    d = Math.min(d, band);
  }
  d = Math.min(d, Math.max(Math.abs(ell(x, y, z, 0, 1.19, -0.005, 0.112, 0.09, 0.122)) - 0.006, Math.abs(y - 1.17) - 0.012));
  for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, Math.PI]) {
    for (let k = 0; k < 4; k++) {
      const el = 0.25 + k * 0.33;                                // 下から上へ
      const px = Math.sin(ang) * Math.cos(el) * 0.105, py = 1.19 + Math.sin(el) * 0.085, pz = -0.005 + Math.cos(ang) * Math.cos(el) * 0.115;
      d = Math.min(d, Math.hypot(x - px, y - py, z - pz) - 0.011);
    }
  }
  // 頬当：顔の両わきに長く垂れ、あごの下まで回りこむ板（格子の段つき）
  let ho = frustum(x, y, z, 1.18, 1.0, 0.113, 0.13, 0.95, 0.01);
  ho = Math.max(ho, -frustum(x, y, z, 1.2, 0.98, 0.095, 0.112, 0.95, 0.01));
  ho = Math.max(ho, -box(x, y, z, 0, 1.08, 0.16, 0.062, 0.12, 0.1, 0.02));     // 顔の前はあける
  d = Math.min(d, ho);
  // 目と口：くり抜き、鼻
  d = Math.max(d, -box(ax, y, z, 0.033, 1.125, 0.1, 0.02, 0.006, 0.06, 0.005));
  d = Math.max(d, -box(x, y, z, 0, 1.065, 0.095, 0.018, 0.005, 0.06, 0.004));
  d = smin(d, ell(x, y, z, 0, 1.095, 0.09, 0.013, 0.025, 0.018), 0.008);
  return Math.max(d, -y);
}
// 形はご提供の3Dデータ（写真から作った立体）をなめらかにしたもの
import { loadSdfGrid } from './sdfdata.js';
let dataSdf = null;
async function prepare() {
  if (!dataSdf) dataSdf = await loadSdfGrid('bujin');
}
// 3Dデータの表面にそって浮き出る細い帯（よろいの段など）
function rib(dd, along, w, h) { return Math.max(Math.abs(dd - h) - h, Math.abs(along) - w); }

// 頭部（写真をもとに作り込む）：衝角付冑・鋲・頬当と錣・顔（3Dデータの頭の位置と大きさに合わせる）
function head(x, y, z) {
  const hx = x + 0.01, ax = Math.abs(hx);
  // 顔：まるく平らな顔（フードの奥に少し引っこむ）
  let d = ell(hx, y, z, 0, 1.185, 0.035, 0.056, 0.072, 0.056);
  // 冑と頬当：頭をすっぽりおおうフードのような形。正面だけ顔の形にあく
  const outer = ell(hx, y, z, 0, 1.2, 0.0, 0.098, 0.135, 0.1);
  const inner = ell(hx, y, z, 0, 1.2, 0.0, 0.076, 0.115, 0.08);
  let hood = Math.max(outer, -inner, 1.075 - y);
  const win = Math.hypot(hx / 0.058, (y - 1.17) / 0.085) - 1;            // 顔の窓（たまご形）
  hood = Math.max(hood, -Math.max(win * 0.058, -z));
  d = Math.min(d, hood);
  // はちの下のふちの帯（ひさし）と、顔の窓のふち
  d = Math.min(d, Math.max(Math.abs(ell(hx, y, z, 0, 1.2, 0.0, 0.104, 0.14, 0.106)) - 0.006, Math.abs(y - 1.255) - 0.01));
  d = Math.min(d, Math.max(Math.abs(win * 0.058) - 0.006, Math.abs(outer) - 0.009, 0.0 - z, y - 1.255));
  // 衝角
  d = smin(d, cone(hx, y, z, 0, 1.33, 0.015, 0, 1.27, 0.09, 0.014, 0.009), 0.012);
  // 鋲（はちの上のこぶ）
  for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, Math.PI - 0.6, Math.PI, Math.PI + 0.6]) {
    for (let k = 0; k < 3; k++) {
      const el = 0.55 + k * 0.32;                                          // はちの表面の上に並べる
      const px = Math.sin(ang) * Math.cos(el) * 0.098, py = 1.2 + Math.sin(el) * 0.135, pz = Math.cos(ang) * Math.cos(el) * 0.1;
      d = Math.min(d, Math.hypot(hx - px, y - py, z - pz) - 0.0085);
    }
  }
  // 顔：細い目のくり抜き、長い鼻、口、あごの下の結び目
  d = Math.max(d, -box(ax, y, z, 0.023, 1.2, 0.085, 0.016, 0.005, 0.03, 0.003));
  d = smin(d, cone(hx, y, z, 0, 1.2, 0.088, 0, 1.162, 0.1, 0.008, 0.013), 0.008);
  d = Math.max(d, -box(hx, y, z, 0, 1.138, 0.085, 0.015, 0.0045, 0.03, 0.003));
  for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(Math.hypot(hx - sx * 0.016, y - 1.09) - 0.012, z - 0.075) - 0.005);
  return d;
}

function sdf(x, y, z) {
  const dd = dataSdf(x, y, z);
  let d = smin(Math.max(dd, y - 1.1), head(x, y, z), 0.012);              // 首から上は作り込んだ頭
  const ax = Math.abs(x + 0.005);
  if (y > 0.59 && y < 0.78) for (const yb of [0.628, 0.678, 0.728]) d = Math.min(d, rib(dd, y - yb, 0.011, 0.007));   // 草摺の段
  if (y > 0.94 && y < 1.11 && ax > 0.1) for (const yb of [0.97, 1.0, 1.03, 1.06]) d = Math.min(d, rib(dd, y - yb - (ax - 0.1) * 0.3, 0.007, 0.006)); // 肩甲
  if (y > 0.33 && y < 0.5) for (const yb of [0.355, 0.48]) d = Math.min(d, rib(dd, y - yb, 0.014, 0.008));   // ひざ下・足首の帯
  // 胸の2つの結び目（引合せ）
  for (const yk of [1.0, 0.865]) {
    const kx = x + 0.005, ky = y - yk;
    let k2 = Math.min(Math.abs(Math.hypot(Math.abs(kx) - 0.016, ky) - 0.011) - 0.004, Math.hypot(kx, ky) - 0.007);
    k2 = Math.min(k2, Math.max(Math.abs(Math.abs(kx) - 0.01 - (-ky) * 0.3) - 0.004, ky, -ky - 0.03));
    if (z > 0) d = Math.min(d, Math.max(Math.abs(dd - 0.005) - 0.005, k2));
  }
  // 弓：左手でにぎり、顔の横までまっすぐ立てる
  d = Math.min(d, cone(x, y, z, 0.11, 0.7, 0.165, 0.125, 1.3, 0.11, 0.016, 0.013));
  return Math.max(d, -y);
}
const core = (x, y, z) => Math.min(Math.max(dataSdf(x, y, z), y - 1.1), ell(x + 0.01, y, z, 0, 1.185, 0.03, 0.05, 0.065, 0.05));

// 柄頭の輪（環頭）
function plateRing(x, y, z) {
  const e = Math.abs(Math.hypot(x - 0.06, y - 0.605) - 0.022) - 0.008;
  return Math.hypot(Math.max(e, 0), Math.max(Math.abs(z - 0.17) - 0.01, 0)) + Math.min(Math.max(e, Math.abs(z - 0.17) - 0.01), 0);
}

// 外面：小札（よろいの小さな板）を綴じた線、冑の鋲の列
// 文様は3Dデータの比率（台 0〜0.3、脚 0.33〜0.58、草摺 0.6〜0.77、胴 0.77〜1.11、冑 1.12〜）に合わせて、写真をもとに刻む
const patternGLSL = `
float bjHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bjLine(float d, float w) { float x = abs(d) / w; return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
float bjDot(vec2 q, float r) { return bjLine(length(q), r); }
float bjNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bjHash(i), bjHash(i + vec3(1,0,0)), f.x), mix(bjHash(i + vec3(0,1,0)), bjHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bjHash(i + vec3(0,0,1)), bjHash(i + vec3(1,0,1)), f.x), mix(bjHash(i + vec3(0,1,1)), bjHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float patH(vec3 p) {
  // 素焼きの土の肌：なめらかなむら（点々にならないよう、ぼかしたノイズ）
  float h = (bjNoise(p * 70.0) - 0.5) * 0.35;
  vec2 c = vec2(p.x + 0.005, p.z - 0.04);
  float ang = atan(c.x, c.y);
  // 胴と草摺：縦に長い板の合わせ目（太めでやわらかい溝）
  if (p.y > 0.6 && p.y < 1.02 && abs(c.x) < 0.14 && c.y > -0.02) h -= bjLine(fract(ang * 4.0) - 0.5, 0.11) * 1.4;
  // 頬当（顔の両わき）の格子
  if (p.y > 1.08 && p.y < 1.25 && (abs(p.x + 0.01) > 0.06 || p.z < -0.02)) h -= max(bjLine(fract(p.y / 0.03) - 0.5, 0.14), bjLine(fract(p.z / 0.03) - 0.5, 0.14)) * 1.6;
  return h * 0.0011;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 13.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 15.0 + p.z * 11.0);
  c *= 0.92 + 0.1 * n;
  c *= 1.0 - clamp(-h / 0.0016, 0.0, 1.0) * 0.25;
  return c;
}
`;

export const bujin = {
  id: 'bujin',
  type: 'sdf',
  name: '挂甲の武人',
  ruby: 'けいこうのぶじん',
  kind: '埴輪',
  era: '古墳時代後期（6世紀）',
  place: '群馬県太田市',
  available: true,
  prepare,
  sdf,
  core,
  thickness: 0.035,
  voxel: 0.009,
  bounds: { min: [-0.26, -0.02, -0.24], max: [0.24, 1.38, 0.23] },
  height: 1.36,
  clearRadius: 0.5,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.72, 0.45, 0.3],
  innerColor: [0.5, 0.33, 0.22],
  fractureColor: [0.8, 0.58, 0.42],
  description: [
    '埴輪 挂甲（けいこう）の武人は、群馬県太田市から出土した古墳時代後期（6世紀）の人物埴輪です。高さは130cmをこえ、全身を武装した姿が細かく表されています。1974年に埴輪として初めて国宝に指定され、東京国立博物館に収蔵されています。',
    '小さな鉄の板をひもで綴じ合わせたよろい「挂甲」を着て、前に角のようにつき出た冑（衝角付冑）をかぶっています。左手に弓をもち、右手で腰の大刀の柄をにぎり、背中には矢を入れる靫（ゆぎ）を背負っています。',
    '近年の修理と調査で、もとは赤・白・灰色などで色が塗り分けられていたこともわかりました。当時の武人の装備を知ることができる、とても貴重な資料です。',
  ],
  note: 'このステージの形は、実物の写真から作られた3Dデータをもとにしています（文様は写真を参考に刻んだもの）。正確な実測データではありません。',
};
