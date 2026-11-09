// ハート形土偶（縄文時代後期・群馬県東吾妻町郷原出土・重要文化財）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）
import { clamp, smin, ell, cone, chain, torusAxis } from './common-sdf.js';

// 顔の面：大きく上を向いたハート形の板
const FC = [0, 1.12, 0.045], FA = 0.62;
const FN = [0, Math.sin(FA), Math.cos(FA)], FT = [0, Math.cos(FA), -Math.sin(FA)];
function faceUVW(x, y, z) {
  const qx = x - FC[0], qy = y - FC[1], qz = z - FC[2];
  return [qx, qy * FT[1] + qz * FT[2], qy * FN[1] + qz * FN[2]];
}
function heart2d(u, v) {
  const au = Math.abs(u);
  const lobes = Math.hypot(au - 0.085, v - 0.035) - 0.1;
  const t = clamp((0.03 - v) / 0.19, 0, 1);
  const tip = Math.max(au - (0.18 * (1 - t) + 0.015 * t), -0.16 - v, v - 0.04);
  return smin(lobes, tip, 0.03);
}

// 正面から見た体の形（2D）：アーチ形に開いた脚、細い腰、横一文字の肩
function body2d(x, y) {
  const ax = Math.abs(x);
  // 脚：短くどっしりした脚。外側のふちは丸くふくらんで下へ広がり（つり鐘形）、足先でさらに少し張り出す
  const lt = clamp(y / 0.52, 0, 1);
  const lw = 0.07 + 0.215 * Math.sqrt(1 - lt) + 0.02 * clamp(1 - y / 0.06, 0, 1);
  let legs = Math.max(ax - lw, y - 0.52, -y);
  // 脚のあいだ：まるい馬蹄形のアーチ（下の口は少しすぼまり、足先が内側へ向く）
  const open = Math.min(Math.hypot(x, y - 0.165) - 0.1, Math.max(ax - 0.068, y - 0.165));
  legs = Math.max(legs, -open);
  // 腰〜胸：腰で細くくびれ、肩へ広がる
  // 胴：首から腰まで細い柱のような胴（胸でわずかに広がる）
  const tw = 0.05 + 0.03 * clamp((y - 0.7) / 0.18, 0, 1);
  const torso = Math.max(ax - tw, y - 0.92, 0.45 - y);
  // 肩から腕：首の両わきから外へ下がる弓なりの板が、そのまま腕になって垂れる。
  //   胴と腕のあいだ（わきの下）はアーチ形にあく
  const top = 0.955 - 0.08 * Math.pow(ax / 0.3, 2);
  const aw = 0.3 + 0.012 * clamp((0.82 - y) / 0.1, 0, 1);     // 腕の先は少し外へ広がる
  let arms = Math.max(ax - aw, y - top, 0.715 - y);
  const pit = Math.min(
    Math.max(Math.abs(ax - 0.15) - 0.075, y - 0.765),
    Math.hypot((ax - 0.15) / 0.075, (y - 0.765) / 0.075) * 0.075 - 0.075);
  arms = Math.max(arms, -pit);
  // 腕の先は丸く
  arms = Math.max(arms, Math.hypot(Math.max(ax - aw + 0.03, 0), Math.max(0.745 - y, 0)) - 0.03);
  return smin(smin(legs, torso, 0.04), arms, 0.025);
}
function depth(y) { return 0.052 + 0.1 * Math.sqrt(clamp(1 - y / 0.55, 0, 1)); }   // 前後の厚みの半分（すそほど厚い）   // 前後の厚みの半分（脚は厚く、上へなめらかに薄く）

function body(x, y, z) {
  const ax = Math.abs(x);
  const b2 = body2d(x, y);
  const dz = Math.abs(z) - depth(y);
  const R = 0.03;
  let d = Math.hypot(Math.max(b2 + R, 0), Math.max(dz + R, 0)) + Math.min(Math.max(b2 + R, dz + R), 0) - R;
  // 脚：断面がまるい（角のない）脚。各高さで、脚の幅と前後の厚みの楕円にする
  if (y < 0.56) {
    const lw = 0.07 + 0.215 * Math.sqrt(1 - clamp(y / 0.52, 0, 1)) + 0.02 * clamp(1 - y / 0.06, 0, 1);
    const inner = y < 0.165 ? 0.068 : y < 0.265 ? Math.sqrt(Math.max(0, 0.01 - (y - 0.165) * (y - 0.165))) : 0;
    const c = (inner + lw) / 2, hw = (lw - inner) / 2;
    const dep = depth(y);
    let leg = (Math.hypot((ax - c) / hw, z / dep) - 1) * Math.min(hw, dep);
    // アーチの上は左右の脚がひとつにつながる（なめらかに）
    const merged = Math.max((Math.hypot(ax / lw, z / dep) - 1) * Math.min(lw, dep), 0.25 - y);
    leg = smin(leg, merged, 0.035);
    leg = Math.max(leg, -y, y - 0.54);
    d = y < 0.5 ? leg : smin(Math.max(d, 0.5 - y), leg, 0.03);
  }
  // 首
  d = smin(d, cone(x, y, z, 0, 0.92, 0, 0, 1.06, 0.02, 0.05, 0.045), 0.03);
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = body(x, y, z);
  // 足：脚の下端は前へ少し出た、平らで丸い足
  // （足は脚の楕円の断面にふくめる）
  // 乳房とへそ、腹の中心をとおる隆起線
  d = smin(d, ell(ax, y, z, 0.045, 0.82, 0.05, 0.02, 0.02, 0.016), 0.01);
  d = smin(d, cone(x, y, z, 0, 0.8, 0.055, 0, 0.6, 0.058, 0.007, 0.007), 0.006);
  // ハート形の顔の板
  const [u, v, w] = faceUVW(x, y, z);
  const h2 = heart2d(u, v);
  let face = Math.hypot(Math.max(h2, 0), Math.max(Math.abs(w) - 0.024, 0)) + Math.min(Math.max(h2, Math.abs(w) - 0.024), 0) - 0.006;
  // ふちの盛り上がり
  face = Math.min(face, Math.hypot(h2 + 0.012, Math.max(w - 0.03, 0)) - 0.01 + (w < 0 ? 1 : 0));
  // 大きくつき出たまるい目の輪
  for (const sx of [-1, 1]) {
    face = Math.min(face, torusAxis(u - sx * 0.075, v - 0.03, w - 0.04, 0.03, 0.013));
    face = Math.max(face, -(Math.hypot(u - sx * 0.075, v - 0.03, w - 0.05) - 0.018));
  }
  // 高い鼻：顔からぐっと前へつき出た、先の太い鼻（先に2つの鼻の穴）
  face = smin(face, cone(u, v, w, 0, -0.005, 0.03, 0, -0.035, 0.08, 0.026, 0.033), 0.014);
  for (const sx of [-1, 1]) face = Math.max(face, -(Math.hypot(u - sx * 0.014, v + 0.045, w - 0.11) - 0.01));
  // 小さな口
  face = Math.max(face, -(Math.hypot(u, v + 0.1, w - 0.03) - 0.011));
  d = smin(d, face, 0.02);
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
    float lw = 0.07 + 0.215 * sqrt(1.0 - clamp(p.y / 0.52, 0.0, 1.0));
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
  bounds: { min: [-0.36, -0.02, -0.2], max: [0.36, 1.32, 0.22] },
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
