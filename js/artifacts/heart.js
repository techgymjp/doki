// ハート形土偶（縄文時代後期・群馬県東吾妻町郷原出土・重要文化財）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）
import { clamp, smin, ell, cone, chain, torusAxis } from './common-sdf.js';

// 顔の面：大きく上を向いたハート形の板
const FC = [0, 1.14, 0.05], FA = 0.8;    // 顔は大きく上を向く
const FN = [0, Math.sin(FA), Math.cos(FA)], FT = [0, Math.cos(FA), -Math.sin(FA)];
function faceUVW(x, y, z) {
  const qx = x - FC[0], qy = y - FC[1], qz = z - FC[2];
  return [qx, qy * FT[1] + qz * FT[2], qy * FN[1] + qz * FN[2]];
}
function heart2d(u, v) {
  const au = Math.abs(u);
  const lobes = Math.hypot(au - 0.085, v - 0.035) - 0.1;
  const t = clamp((0.03 - v) / 0.19, 0, 1);
  // 下半分（ほお〜あご）は外へふくらんだ曲線で、あごへ丸くすぼまる
  const tip = Math.max((au - (0.015 + 0.165 * (1 - Math.pow(t, 1.7)))) * 0.8, -0.16 - v, v - 0.04);
  return smin(lobes, tip, 0.03);
}

// 正面から見た体の形（2D）：アーチ形に開いた脚、細い腰、横一文字の肩
function body2d(x, y) {
  const ax = Math.abs(x);
  // ---- 写真の正面フォルム（直線を使わず、なめらかな曲線だけで）----
  // 脚と腰：腰のくびれから、Cの字を描いて大きく張り出し、すそでわずかに広がる
  const hw = 0.06 + 0.195 * smooth(0.62, 0.38, y) + 0.022 * Math.sin(Math.PI * clamp(y / 0.4, 0, 1));   // 外側のふちはゆるくふくらむ
  let d = Math.max(ax - hw, y - 0.86, -y);
  // 股：Oの字のあき（下の口は小さくすぼまる）
  const o = Math.hypot(x / 0.125, (y - 0.21) / 0.19) - 1;
  d = Math.max(d, -Math.min(o * 0.125, Math.max(ax - 0.045, y - 0.08)));   // 下の口はあいている
  // 胴：腰から胸へ少しだけ広がる細い柱
  const tw = 0.06 + 0.02 * smooth(0.62, 0.84, y);
  d = Math.min(d, Math.max(ax - tw, y - 0.95, 0.5 - y));
  // 肩と腕：上のふちはゆるい弧。腕は肩から下へ垂れ、先は丸くとがる
  const top = 0.955 - 0.045 * (ax / 0.34) * (ax / 0.34);
  // 肩の下のふち：胴と腕のあいだはアーチ形（半だ円）に高くえぐれる
  const q = clamp((ax - 0.172) / 0.1, -1, 1);
  const yb = ax < 0.072 ? 0.7 : ax > 0.272 ? 0.82 : 0.7 + 0.13 * Math.sqrt(1 - q * q);
  let sh = Math.max(ax - 0.34, y - top, (yb - y) * 0.7);
  // 腕（肩の両はし）：太さが先へ向かって細くなる、わずかに外へ反った垂れ
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, cy = 0.87 - 0.2 * t, cx = 0.29 + 0.012 * t * t, r = 0.05 - 0.03 * t;
    sh = Math.min(sh, Math.hypot(ax - cx, y - cy) - r);
  }
  d = smin(d, sh, 0.03);
  return d;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function depth(y) { return 0.052 + 0.1 * Math.sqrt(clamp(1 - y / 0.55, 0, 1)); }   // 前後の厚みの半分（すそほど厚い）   // 前後の厚みの半分（脚は厚く、上へなめらかに薄く）

function body(x, y, z) {
  const ax = Math.abs(x);
  const b2 = body2d(x, y);
  const dz = Math.abs(z) - depth(y);
  const R = y < 0.62 ? 0.055 : 0.035;   // 角のない、まるい断面
  let d = Math.hypot(Math.max(b2 + R, 0), Math.max(dz + R, 0)) + Math.min(Math.max(b2 + R, dz + R), 0) - R;
  // 首
  d = smin(d, cone(x, y, z, 0, 0.92, 0, 0, 1.06, 0.02, 0.05, 0.045), 0.03);
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = body(x, y, z);
  // 足：脚の下端は前へ少し出た、平らで丸い足
  // （足は脚の楕円の断面にふくめる）
  // 胴のまん中の縦のみぞ（胸から腰まで、前と後ろ）
  if (y > 0.5 && y < 0.93) {
    const fade = clamp((y - 0.5) / 0.04, 0, 1) * clamp((0.93 - y) / 0.04, 0, 1);
    const dep = depth(y);
    d = Math.max(d, -(Math.hypot(x * 1.2, Math.abs(z) - dep + 0.004) - 0.018 * fade));
  }
  // 乳房とへそ
  d = smin(d, ell(ax, y, z, 0.045, 0.82, 0.05, 0.02, 0.02, 0.016), 0.01);
  d = smin(d, cone(x, y, z, 0, 0.8, 0.055, 0, 0.6, 0.058, 0.007, 0.007), 0.006);
  // ハート形の顔の板
  const FSC = 1.15;   // 顔を大きく
  const [u0, v0, w] = faceUVW(x, y, z);
  const u = u0 / FSC, v = v0 / FSC;
  const h2 = heart2d(u, v) * FSC;
  let face = Math.hypot(Math.max(h2, 0), Math.max(Math.abs(w) - 0.024, 0)) + Math.min(Math.max(h2, Math.abs(w) - 0.024), 0) - 0.006;
  // ふちの盛り上がり
  face = Math.min(face, Math.hypot(h2 + 0.012, Math.max(w - 0.03, 0)) - 0.01 + (w < 0 ? 1 : 0));
  // 大きくつき出たまるい目の輪
  for (const sx of [-1, 1]) {
    face = Math.min(face, torusAxis(u - sx * 0.075, v - 0.03, w - 0.04, 0.03, 0.013));
    face = Math.max(face, -(Math.hypot(u - sx * 0.075, v - 0.03, w - 0.05) - 0.018));
  }
  // ふっくらとふくらんだほお
  for (const sx of [-1, 1]) face = smin(face, ell(u, v, w, sx * 0.075, -0.045, 0.02, 0.06, 0.055, 0.03), 0.02);
  // 人の鼻のような形：目のあいだから鼻すじが下へ前へ出て、先は丸くふくらみ、小鼻が両わきにはる。
  //   鼻の穴は先の下側に2つ
  face = smin(face, cone(u, v, w, 0, 0.03, 0.022, 0, -0.025, 0.068, 0.013, 0.02), 0.012);       // 鼻すじ
  face = smin(face, ell(u, v, w, 0, -0.038, 0.07, 0.034, 0.028, 0.03), 0.012);                  // 鼻先
  for (const sx of [-1, 1]) face = smin(face, ell(u, v, w, sx * 0.03, -0.047, 0.052, 0.018, 0.017, 0.022), 0.01); // 小鼻
  for (const sx of [-1, 1]) face = Math.max(face, -ell(u, v, w, sx * 0.014, -0.066, 0.068, 0.009, 0.014, 0.01)); // 鼻の穴
  // 小さな口
  face = Math.max(face, -(Math.hypot(u, v + 0.1, w - 0.03) - 0.011));
  d = smin(d, face, 0.02);
  // 顔のうしろ（後頭部）に立つ板：まるい穴があいている
  {
    const py = y - 1.15, pz = z + 0.035;
    const pa = Math.atan2(py, pz);
    const jag = 1 - 0.13 * Math.pow(Math.max(0, Math.sin(pa * 7)), 0.6);   // ふちのギザギザ
    let plate = Math.max((Math.hypot(py / 0.09, pz / 0.07) * (1 / jag) - 1) * 0.07 * jag, Math.abs(x) - 0.026);
    plate = Math.max(plate, -(Math.hypot(py - 0.03, pz + 0.005) - 0.032));
    d = smin(d, plate, 0.012);
  }
  return Math.max(d, -y);
}
const core = body;

// 外面：へらで引いた細い平行線（脚・腰）、肩と腰の渦巻、ふちの点の列
const patternGLSL = `
float htHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float htLine(float d, float w) { float x = abs(d) / w; return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
float htSpiral(vec2 q, float pitch, float rmax) {
  float r = length(q);
  if (r > rmax) return 0.0;
  float t = r / pitch - atan(q.y, q.x) / 6.2831853;
  return htLine((t - floor(t + 0.5)) * pitch, 0.0045);
}
float patH(vec3 p) {
  float ax = abs(p.x);
  float g = 0.0;
  if (p.y > 0.98) return (htHash(floor(p * 150.0)) - 0.5) * 0.00015;
  // 肩の渦巻と、肩の上のふちの点の列
  if (p.y > 0.84) {
    g = max(g, htSpiral(vec2(ax - 0.17, p.y - 0.905), 0.011, 0.035));
    g = max(g, htLine(length(vec2(fract(ax / 0.016) - 0.5, (p.y - 0.935 + 0.03 * (ax / 0.27) * (ax / 0.27)) / 0.016)), 0.3) * step(0.06, ax));
    g = max(g, htLine(fract(ax / 0.012) - 0.5, 0.12) * 0.5 * step(0.06, ax) * step(abs(ax - 0.17), 0.04) * 0.0);
  }
  // 腰：横へまわる平行線と、腰の渦巻
  else if (p.y > 0.5) {
    g = max(g, htLine(fract(p.y / 0.02) - 0.5, 0.13) * 0.85 * step(p.y, 0.8));
    g = max(g, htLine(ax, 0.005) * step(0.6, p.y));
    g = max(g, htSpiral(vec2(ax - 0.12, p.y - 0.52), 0.011, 0.035));
  }
  // 脚：横の細い平行線の帯と、ふちの点の列
  else {
    g = max(g, htLine(fract(p.y / 0.02) - 0.5, 0.13) * 0.85);
    float lw = 0.06 + 0.195 * smoothstep(0.62, 0.38, p.y) + 0.022 * sin(3.14159 * clamp(p.y / 0.4, 0.0, 1.0));
    g = max(g, htLine(length(vec2((ax - lw + 0.014) / 0.016, fract(p.y / 0.018) - 0.5)), 0.35));
  }
  return -g * 0.0022 + (htHash(floor(p * 150.0)) - 0.5) * 0.00015;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 12.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 14.0 + p.z * 10.0);
  c *= 0.93 + 0.1 * n;
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
  bounds: { min: [-0.36, -0.02, -0.2], max: [0.36, 1.36, 0.26] },
  height: 1.3,
  clearRadius: 0.45,
  patternGLSL,
  bumpStrength: 1.4,
  clayColor: [0.72, 0.55, 0.4],
  innerColor: [0.5, 0.38, 0.28],
  fractureColor: [0.66, 0.52, 0.4],
  description: [
    'ハート形土偶は、群馬県東吾妻町の郷原（ごうばら）で見つかった、縄文時代後期の土偶です。高さは約30cmで、ハートのような形の顔が上を向いていることから、この名で呼ばれています。',
    '顔のふちは眉からあごへ盛り上がった線でかこまれ、まるい目と小さな口がついています。肩から腕は弓なりのアーチになって垂れ下がり、太い脚もアーチ形に開いて踏んばっています。体には縄目や、へらで引いた線の文様がつけられています。',
    '1941年の鉄道工事の際に偶然見つかり、のちに重要文化財に指定されました。',
  ],
  note: 'このゲームの3Dモデルは、ハート形土偶の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
