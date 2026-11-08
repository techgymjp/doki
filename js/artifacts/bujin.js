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

function core(x, y, z) {
  const ax = Math.abs(x);
  let d = cone(ax, y, z, 0.085, -0.3, 0.0, 0.09, 0.42, 0.0, 0.062, 0.07);        // 脚（筒）
  d = smin(d, frustum(x, y, z, 0.4, 0.63, 0.215, 0.155, 0.8), 0.03);            // 草摺（よろいのすそ）
  d = smin(d, frustum(x, y, z, 0.6, 0.96, 0.15, 0.155, 0.78), 0.03);            // 胴
  d = smin(d, ell(x, y, z, 0, 1.12, 0.005, 0.085, 0.1, 0.09), 0.03);            // 頭
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  // 足と、ひざ下のひも（足結）
  d = smin(d, ell(ax, y, z, 0.09, 0.035, 0.03, 0.065, 0.04, 0.09), 0.03);
  d = smin(d, cone(ax, y, z, 0.088, 0.29, 0, 0.088, 0.31, 0, 0.078, 0.078), 0.01);
  // 肩甲（肩をおおう板）
  d = smin(d, cone(ax, y, z, 0.12, 0.95, 0, 0.215, 0.83, 0, 0.075, 0.09), 0.03);
  // 腕：右手は腰の大刀の柄を、左手は弓をにぎる
  d = smin(d, cone(x, y, z, 0.22, 0.88, 0.0, 0.25, 0.7, 0.03, 0.045, 0.04), 0.03);   // 右上腕
  d = smin(d, cone(x, y, z, 0.25, 0.7, 0.03, 0.08, 0.6, 0.15, 0.04, 0.035), 0.03);   // 右前腕（体の前へ）
  d = smin(d, ell(x, y, z, 0.065, 0.6, 0.155, 0.035, 0.035, 0.035), 0.015);           // 右手
  d = smin(d, cone(x, y, z, -0.22, 0.88, 0.0, -0.25, 0.7, 0.04, 0.045, 0.04), 0.03); // 左上腕
  d = smin(d, cone(x, y, z, -0.25, 0.7, 0.04, -0.25, 0.64, 0.17, 0.04, 0.035), 0.03); // 左前腕（前へ）
  d = smin(d, ell(x, y, z, -0.25, 0.64, 0.19, 0.035, 0.038, 0.035), 0.015);          // 左手
  // 弓（左手で縦に持つ、少し反った長い棒）
  const bowZ = 0.19 + 0.04 * (1 - Math.pow((y - 0.66) / 0.5, 2));
  d = Math.min(d, Math.max(Math.hypot(x + 0.25, z - bowZ) - 0.018, Math.abs(y - 0.66) - 0.5));
  // 大刀：左の腰に下げ、柄を右手でにぎる
  d = smin(d, cone(x, y, z, 0.045, 0.6, 0.165, -0.06, 0.56, 0.13, 0.02, 0.022), 0.01);  // 柄
  d = smin(d, plateRing(x, y, z), 0.005);                                               // 環頭（柄頭の輪）
  d = smin(d, cone(x, y, z, -0.06, 0.56, 0.13, -0.17, 0.2, 0.06, 0.028, 0.024), 0.015);  // さや
  // 靫（矢入れ）を背中に
  d = smin(d, box(x, y, z, 0.07, 0.83, -0.155, 0.075, 0.13, 0.03, 0.02), 0.02);
  d = smin(d, box(x, y, z, 0.07, 0.99, -0.16, 0.06, 0.04, 0.025, 0.015), 0.02);
  // 腰の帯
  d = smin(d, frustum(x, y, z, 0.6, 0.64, 0.166, 0.163, 0.8), 0.01);
  // 首
  d = smin(d, cone(x, y, z, 0, 0.95, 0, 0, 1.05, 0, 0.065, 0.06), 0.02);
  // 冑：はち＋前につき出た衝角＋しころ（首を守る広がり）＋頬当
  d = smin(d, ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115), 0.02);
  d = smin(d, cone(x, y, z, 0, 1.235, 0.02, 0, 1.2, 0.15, 0.025, 0.012), 0.02);
  d = Math.max(d, y - 1.29);
  let shikoro = frustum(x, y, z, 1.16, 1.07, 0.112, 0.165, 0.95, 0.01);
  shikoro = Math.max(shikoro, -frustum(x, y, z, 1.18, 1.05, 0.092, 0.145, 0.95, 0.01));
  shikoro = Math.max(shikoro, -box(x, y, z, 0, 1.1, 0.16, 0.075, 0.1, 0.1, 0.02)); // 顔の前はあける
  d = Math.min(d, shikoro);
  // 目と口：くり抜き
  d = Math.max(d, -box(ax, y, z, 0.035, 1.125, 0.1, 0.022, 0.006, 0.06, 0.005));
  d = Math.max(d, -box(x, y, z, 0, 1.065, 0.095, 0.02, 0.006, 0.06, 0.005));
  // 鼻
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
float bjLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
float patH(vec3 p) {
  float g = 0.0;
  float ang = atan(p.x, p.z);
  // 小札：草摺・胴・肩甲
  bool armor = (p.y > 0.4 && p.y < 0.96) || (p.y > 0.8 && p.y < 0.98 && abs(p.x) > 0.13 && abs(p.x) < 0.3);
  if (armor) {
    float row = p.y / 0.03;
    float rowf = fract(row);
    g = max(g, bjLine(rowf - 0.5, 0.12) * 0.9);
    float col = ang * 9.0 + floor(row) * 0.5;
    g = max(g, bjLine(fract(col) - 0.5, 0.08) * 0.6);
  }
  // 腰の帯は平ら
  if (p.y > 0.6 && p.y < 0.645) g = 0.0;
  // 冑の鋲の列
  if (p.y > 1.15 && p.y < 1.29) {
    float rv = fract(p.y / 0.035);
    float cv = fract(ang * 7.0);
    g = max(g, -(1.0 - smoothstep(0.12, 0.22, length(vec2(rv - 0.5, cv - 0.5)))) * 0.8);
  }
  return -g * 0.0011 + (bjHash(floor(p * 200.0)) - 0.5) * 0.00012;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 13.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 15.0 + p.z * 11.0);
  c *= 0.92 + 0.1 * n;
  c *= 1.0 - clamp(-h / 0.0011, 0.0, 1.0) * 0.25;
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
  voxel: 0.0125,
  bounds: { min: [-0.33, -0.02, -0.22], max: [0.33, 1.3, 0.28] },
  height: 1.29,
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
  note: 'このゲームの3Dモデルは、埴輪 挂甲の武人の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
