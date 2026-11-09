// ハート形土偶（縄文時代後期・群馬県東吾妻町郷原出土・重要文化財）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）
import { clamp, smin, ell, cone, chain, torusAxis } from './common-sdf.js';

// 顔の面：少し上を向いたハート形の板
const FC = [0, 1.13, 0.035], FA = 0.45;
const FN = [0, Math.sin(FA), Math.cos(FA)], FT = [0, Math.cos(FA), -Math.sin(FA)];
function faceUVW(x, y, z) {
  const qx = x - FC[0], qy = y - FC[1], qz = z - FC[2];
  return [qx, qy * FT[1] + qz * FT[2], qy * FN[1] + qz * FN[2]];
}
function heart2d(u, v) {
  const au = Math.abs(u);
  const lobes = Math.hypot(au - 0.078, v - 0.03) - 0.098;
  // 下へ細くなる（あごがとがる）
  const t = clamp((0.02 - v) / 0.17, 0, 1);
  const tip = Math.max(au - (0.165 * (1 - t) + 0.012 * t), -0.15 - v, v - 0.03);
  return smin(lobes, tip, 0.03);
}

// 平たい胴・脚・腕（ここから内側を空洞にする）
function body(x, y, z) {
  const ax = Math.abs(x);
  const sz = 0.55; // 前後に平たい
  // 胴：肩が広く、腰でくびれ、腰まわりがまた広がる
  const w = y > 0.72 ? 0.13 + 0.06 * clamp((y - 0.72) / 0.14, 0, 1) : 0.118 + 0.05 * clamp((0.72 - y) / 0.22, 0, 1);
  let d = (Math.hypot(x / w, z / (0.085)) - 1) * Math.min(w, 0.085);
  d = Math.max(d, y - 0.9, 0.46 - y);
  // O字形に開いた脚（ガニ股）
  d = smin(d, chain(ax, y, z / sz * 0.75, [[0.09, 0.52, 0], [0.19, 0.36, 0], [0.205, 0.2, 0], [0.165, 0.06, 0]], 0.08, 0.062), 0.05);
  // 肩から左右にのびる短い腕
  d = smin(d, chain(ax, y, z / sz * 0.75, [[0.14, 0.86, 0], [0.27, 0.83, 0], [0.33, 0.78, 0]], 0.058, 0.045), 0.04);
  // 首
  d = smin(d, cone(x, y, z, 0, 0.88, 0, 0, 1.06, 0.01, 0.065, 0.055), 0.03);
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = body(x, y, z);
  // 足（前へ少し出る）
  d = smin(d, ell(ax, y, z, 0.165, 0.035, 0.03, 0.075, 0.035, 0.085), 0.03);
  // 乳房とへそ、腹の中心をとおる隆起線
  d = smin(d, ell(ax, y, z, 0.07, 0.8, 0.058, 0.025, 0.025, 0.02), 0.012);
  d = smin(d, cone(x, y, z, 0, 0.8, 0.07, 0, 0.56, 0.072, 0.009, 0.009), 0.008);
  d = smin(d, ell(x, y, z, 0, 0.6, 0.07, 0.02, 0.02, 0.016), 0.008);
  // ハート形の顔の板
  const [u, v, w] = faceUVW(x, y, z);
  const h2 = heart2d(u, v);
  let face = Math.hypot(Math.max(h2, 0), Math.max(Math.abs(w) - 0.026, 0)) + Math.min(Math.max(h2, Math.abs(w) - 0.026), 0) - 0.006;
  // ハートのふちの盛り上がり（眉からあごへつながる線）
  face = Math.min(face, Math.hypot(h2 + 0.012, Math.max(w - 0.032, 0)) - 0.009 + (w < 0 ? 1 : 0));
  // 鼻すじ
  face = smin(face, Math.hypot(Math.abs(u), Math.max(w - 0.03, 0), Math.max(Math.abs(v + 0.0) - 0.045, 0)) - 0.012, 0.01);
  // まるい目（ふちの輪と、中のくぼみ）
  for (const sx of [-1, 1]) {
    face = Math.min(face, torusAxis(u - sx * 0.07, v - 0.0, w - 0.033, 0.024, 0.008));
    face = Math.max(face, -(Math.hypot(u - sx * 0.07, v, w - 0.04) - 0.016));
  }
  // 小さなまるい口
  face = Math.min(face, torusAxis(u, v + 0.085, w - 0.032, 0.014, 0.006));
  face = Math.max(face, -(Math.hypot(u, v + 0.085, w - 0.04) - 0.01));
  d = smin(d, face, 0.02);
  return Math.max(d, -y);
}
const core = body;

// 外面：縄目の文様と、沈線（へらで引いた線）
const patternGLSL = `
float htHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float htLine(float d, float w) { float x = abs(d) / w; return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
float patH(vec3 p) {
  float ax = abs(p.x);
  float g = 0.0;
  // 胴：肩から腰へ、平行な沈線のV字と、縄目
  if (p.y > 0.47 && p.y < 0.9 && ax < 0.2) {
    for (int i = 0; i < 3; i++) g = max(g, htLine(p.y - 0.74 - float(i) * 0.03 + ax * 0.55, 0.006));
    float cord = sin((p.y * 0.8 + ax * 0.6) * 520.0) * 0.5 + 0.5;
    g = max(g, cord * 0.35 * step(p.y, 0.7));
  }
  // 脚：横の沈線の帯
  if (p.y < 0.46 && ax > 0.1) g = max(g, htLine(fract(p.y / 0.045) - 0.5, 0.12) * 0.8);
  // 腕の先：輪
  if (ax > 0.24 && p.y > 0.74 && p.y < 0.9) g = max(g, htLine(length(vec2(ax - 0.3, p.y - 0.8)) - 0.03, 0.006));
  return -g * 0.0022 + (htHash(floor(p * 150.0)) - 0.5) * 0.00015;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 12.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 14.0 + p.z * 10.0);
  c *= 0.92 + 0.12 * n;
  c *= 1.0 - pow(clamp(-h / 0.0022, 0.0, 1.0), 0.7) * 0.45;
  return c;
}
`;

export const heart = {
  id: 'heart',
  type: 'sdf',
  name: 'ハート形土偶',
  ruby: 'はーとがたどぐう',
  kind: '土偶',
  era: '縄文時代後期（約4,000〜3,000年前）',
  place: '群馬県東吾妻町・郷原',
  available: true,
  sdf,
  core,
  thickness: 0.032,
  voxel: 0.0105,
  bounds: { min: [-0.4, -0.02, -0.14], max: [0.4, 1.32, 0.2] },
  height: 1.3,
  clearRadius: 0.5,
  patternGLSL,
  bumpStrength: 1.4,
  clayColor: [0.46, 0.37, 0.29],
  innerColor: [0.33, 0.26, 0.2],
  fractureColor: [0.66, 0.52, 0.4],
  description: [
    'ハート形土偶は、群馬県東吾妻町の郷原（ごうばら）で見つかった、縄文時代後期の土偶です。高さは約30cmで、ハートのような形の顔が上を向いていることから、この名で呼ばれています。',
    '顔のふちは眉からあごへ盛り上がった線でかこまれ、まるい目と小さな口がついています。肩は広く、短い腕を左右にのばし、脚はO字形に開いて踏んばっています。体には縄目や、へらで引いた線の文様がつけられています。',
    '1941年の鉄道工事の際に偶然見つかり、のちに重要文化財に指定されました。',
  ],
  note: 'このゲームの3Dモデルは、ハート形土偶の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
