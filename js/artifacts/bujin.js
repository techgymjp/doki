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
function core(x, y, z) {
  const ax = Math.abs(x);
  let d = frustum(x, y, z, -0.3, 0.18, 0.16, 0.155, 1.0);                     // 円筒の台
  d = smin(d, cone(ax, y, z, 0.085, 0.16, 0.0, 0.088, 0.44, 0.0, 0.07, 0.08), 0.03);  // ゆったりした脚
  d = smin(d, frustum(x, y, z, 0.4, 0.63, 0.225, 0.16, 0.8), 0.03);            // 草摺
  d = smin(d, frustum(x, y, z, 0.6, 0.96, 0.15, 0.155, 0.78), 0.03);           // 胴
  d = smin(d, ell(x, y, z, 0, 1.13, 0.005, 0.085, 0.1, 0.09), 0.03);           // 頭
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  // 台の上下のふちの帯
  d = Math.min(d, torusY(x, y, z, 0, 0.035, 0, 0.158, 0.012));
  d = Math.min(d, torusY(x, y, z, 0, 0.17, 0, 0.152, 0.01));
  // 台の上にのる足、ひざ下のひも（足結）
  d = smin(d, ell(ax, y, z, 0.09, 0.2, 0.04, 0.06, 0.03, 0.085), 0.02);
  d = Math.min(d, torusY(ax, y, z, 0.088, 0.3, 0, 0.083, 0.011));
  d = Math.min(d, torusY(ax, y, z, 0.088, 0.42, 0, 0.088, 0.011));
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
  // 腕：右手は腰の大刀の柄を、左手は弓をにぎる（籠手の段つき）
  d = smin(d, cone(x, y, z, 0.22, 0.86, 0.0, 0.25, 0.7, 0.03, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, 0.25, 0.7, 0.03, 0.08, 0.6, 0.15, 0.042, 0.036), 0.02);
  d = Math.min(d, cone(x, y, z, 0.2, 0.67, 0.07, 0.12, 0.62, 0.12, 0.046, 0.044));
  d = smin(d, ell(x, y, z, 0.065, 0.6, 0.155, 0.035, 0.035, 0.035), 0.015);
  d = smin(d, cone(x, y, z, -0.22, 0.86, 0.0, -0.25, 0.7, 0.04, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, -0.25, 0.7, 0.04, -0.25, 0.64, 0.17, 0.042, 0.036), 0.02);
  d = Math.min(d, cone(x, y, z, -0.25, 0.68, 0.08, -0.25, 0.65, 0.14, 0.046, 0.044));
  d = smin(d, ell(x, y, z, -0.25, 0.64, 0.19, 0.035, 0.038, 0.035), 0.015);
  // 弓
  const bowZ = 0.19 + 0.04 * (1 - Math.pow((y - 0.66) / 0.5, 2));
  d = Math.min(d, Math.max(Math.hypot(x + 0.25, z - bowZ) - 0.018, Math.abs(y - 0.66) - 0.5));
  // 大刀
  d = smin(d, cone(x, y, z, 0.045, 0.6, 0.165, -0.06, 0.56, 0.13, 0.02, 0.022), 0.01);
  d = smin(d, plateRing(x, y, z), 0.005);
  d = smin(d, cone(x, y, z, -0.06, 0.56, 0.13, -0.17, 0.2, 0.06, 0.028, 0.024), 0.015);
  // 靫
  d = smin(d, box(x, y, z, 0.07, 0.83, -0.155, 0.075, 0.13, 0.03, 0.02), 0.02);
  d = smin(d, box(x, y, z, 0.07, 0.99, -0.16, 0.06, 0.04, 0.025, 0.015), 0.02);
  // 腰の帯（角ばった帯）
  d = Math.min(d, frustum(x, y, z, 0.6, 0.645, 0.17, 0.167, 0.8, 0.003));
  // 胸の蝶結び（冑のひもの結び目）
  for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(Math.hypot(x - sx * 0.022, y - 0.905) - 0.016, z - 0.122) - 0.006);
  d = Math.min(d, cone(x, y, z, -0.012, 0.9, 0.122, -0.03, 0.86, 0.122, 0.006, 0.006));
  d = Math.min(d, cone(x, y, z, 0.012, 0.9, 0.122, 0.03, 0.86, 0.122, 0.006, 0.006));
  // 首
  d = smin(d, cone(x, y, z, 0, 0.95, 0, 0, 1.05, 0, 0.065, 0.06), 0.02);
  // 冑：はち＋衝角＋鋲の列
  d = smin(d, ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115), 0.02);
  d = smin(d, cone(x, y, z, 0, 1.235, 0.02, 0, 1.2, 0.15, 0.025, 0.012), 0.02);
  d = Math.max(d, y - 1.29);
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
// 柄頭の輪（環頭）
function plateRing(x, y, z) {
  const e = Math.abs(Math.hypot(x - 0.06, y - 0.605) - 0.022) - 0.008;
  return Math.hypot(Math.max(e, 0), Math.max(Math.abs(z - 0.17) - 0.01, 0)) + Math.min(Math.max(e, Math.abs(z - 0.17) - 0.01), 0);
}

// 外面：小札（よろいの小さな板）を綴じた線、冑の鋲の列
const patternGLSL = `
float bjHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bjLine(float d, float w) { float x = abs(d) / w; return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
float patH(vec3 p) {
  float g = 0.0;
  float ang = atan(p.x, p.z);
  // 小札：草摺・胴・肩甲
  // 胴の小札：横の段（5〜6段）と、段ごとにずれた縦の綴じ目（胴だけ。腕・弓にはつけない）
  bool armor = p.y > 0.65 && p.y < 0.95 && abs(p.x) < 0.16 && !(p.z > 0.15 && abs(p.x + 0.25) < 0.05);
  if (armor) {
    float row = p.y / 0.05;
    g = max(g, bjLine(fract(row) - 0.5, 0.09));
    float col = ang * 8.0 + floor(row) * 0.5;
    g = max(g, bjLine(fract(col) - 0.5, 0.06) * 0.8);
  }
  // 腰の帯は平ら
  if (p.y > 0.6 && p.y < 0.645) g = 0.0;
  // 草摺：縦の小札の線
  if (p.y > 0.4 && p.y < 0.62 && length(p.xz) > 0.15) g = max(g, bjLine(fract(ang * 8.0) - 0.5, 0.07) * 0.8);
  // 頬当の格子
  if (p.y > 1.0 && p.y < 1.18 && abs(p.x) > 0.06 && p.z > -0.06) g = max(g, max(bjLine(fract(p.y / 0.03) - 0.5, 0.15), bjLine(fract(p.z / 0.03) - 0.5, 0.15)) * 0.8);
  return -g * 0.0024 + (bjHash(floor(p * 200.0)) - 0.5) * 0.00012;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 13.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 15.0 + p.z * 11.0);
  c *= 0.92 + 0.1 * n;
  c *= 1.0 - pow(clamp(-h / 0.0024, 0.0, 1.0), 0.7) * 0.45;
  return c;
}
`;

export const bujin = {
  id: 'bujin',
  type: 'sdf',
  name: '埴輪 挂甲の武人',
  ruby: 'はにわ けいこうのぶじん',
  kind: '埴輪',
  era: '古墳時代後期（6世紀）',
  place: '群馬県太田市',
  available: true,
  sdf,
  core,
  thickness: 0.035,
  voxel: 0.0105,
  bounds: { min: [-0.34, -0.02, -0.24], max: [0.34, 1.31, 0.28] },
  height: 1.29,
  clearRadius: 0.5,
  patternGLSL,
  bumpStrength: 1.5,
  clayColor: [0.72, 0.45, 0.3],
  innerColor: [0.5, 0.33, 0.22],
  fractureColor: [0.8, 0.58, 0.42],
  description: [
    '埴輪 挂甲（けいこう）の武人は、群馬県太田市から出土した古墳時代後期（6世紀）の人物埴輪です。高さは130cmをこえ、全身を武装した姿が細かく表されています。1974年に埴輪として初めて国宝に指定され、東京国立博物館に収蔵されています。',
    '小さな鉄の板をひもで綴じ合わせたよろい「挂甲」を着て、前に角のようにつき出た冑（衝角付冑）をかぶっています。左手に弓をもち、右手で腰の大刀の柄をにぎり、背中には矢を入れる靫（ゆぎ）を背負っています。',
    '近年の修理と調査で、もとは赤・白・灰色などで色が塗り分けられていたこともわかりました。当時の武人の装備を知ることができる、とても貴重な資料です。',
  ],
  note: 'このゲームの3Dモデルは、埴輪 挂甲の武人の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
