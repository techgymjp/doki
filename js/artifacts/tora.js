// 寅さん埴輪（古墳時代後期・東京都葛飾区 柴又八幡神社古墳出土の人物埴輪の頭部）
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
// 縦向きの円柱（半径は高さで変えられる）
function vcyl(x, y, z, y0, y1, r, round = 0.01) {
  const dr = Math.hypot(x, z) - r + round;
  const dy = Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + round;
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0) - round;
}
function box(x, y, z, cx, cy, cz, hx, hy, hz, r = 0.004) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

const BRIM_Y = 1.07;

// 埴輪は中が空洞。下は開いていて、頭のてっぺんにも穴がある
function core(x, y, z) {
  const r = 0.225 + 0.02 * clamp((0.3 - y) / 0.3, 0, 1);
  let d = vcyl(x, y, z, -0.2, 1.0, r, 0.03);
  d = smin(d, ell(x, y, z, 0, 1.12, 0, 0.17, 0.17, 0.17), 0.04);
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  // 頭（下に向かって少し広がる円柱）と、すその広がり
  const rr = 0.235 + 0.06 * Math.pow(clamp((0.26 - y) / 0.26, 0, 1), 1.6);
  let d = vcyl(x, y, z, 0, BRIM_Y - 0.02, rr, 0.02);
  // 額の段（髪の生えぎわ／帽子の下のふち）
  d = smin(d, vcyl(x, y, z, 0.8, BRIM_Y - 0.02, 0.243, 0.012), 0.008);
  // 帽子：つば＋丸いクラウン
  d = Math.min(d, vcyl(x, y, z, BRIM_Y - 0.03, BRIM_Y + 0.01, 0.305, 0.018));
  d = smin(d, ell(x, y, z, 0, BRIM_Y + 0.04, 0, 0.205, 0.26, 0.205), 0.02);
  d = Math.max(d, y - 1.32);
  // 顔：長いU字の輪郭が少し盛り上がる
  d = smin(d, ell(x, y, z, 0, 0.6, 0.16, 0.165, 0.27, 0.09), 0.03);
  // 長い鼻
  d = smin(d, box(x, y, z, 0, 0.62, 0.255, 0.032, 0.12, 0.03, 0.02), 0.02);
  d = smin(d, ell(x, y, z, 0, 0.51, 0.27, 0.042, 0.03, 0.035), 0.02);
  // 耳（側面の板）
  d = smin(d, box(ax, y, z, 0.245, 0.62, 0.02, 0.022, 0.1, 0.05, 0.02), 0.015);
  // 首飾りの玉
  for (let k = -5; k <= 5; k++) {
    const a = k * 0.27;
    d = Math.min(d, ell(x, y, z, Math.sin(a) * 0.3, 0.045, Math.cos(a) * 0.3, 0.038, 0.04, 0.03));
  }
  // 目と口：中の空洞まで突き抜けるくり抜き
  d = Math.max(d, -box(ax, y, z, 0.095, 0.705, 0.25, 0.058, 0.009, 0.2, 0.008));
  d = Math.max(d, -box(x, y, z, 0, 0.41, 0.25, 0.05, 0.009, 0.2, 0.008));
  // 頭のてっぺんの穴
  d = Math.max(d, -(Math.hypot(x, z) - 0.075 + Math.max(0, 1.22 - y) * 10));
  return Math.max(d, -y);
}

const patternGLSL = `
float trHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float patH(vec3 p) {
  // 素焼きのざらつきと、ヘラでなでた跡
  float h = (trHash(floor(p * 260.0)) - 0.5) * 0.25;
  h += 0.25 * sin(p.y * 160.0 + 3.0 * sin(atan(p.x, p.z) * 5.0));
  return h * 0.0005;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  // 白っぽく土が残ったところ（おでこ〜帽子の下）
  float n = sin(p.x * 23.0 + 4.0 * sin(p.y * 17.0)) * sin(p.y * 31.0 + p.z * 19.0);
  float band = smoothstep(0.75, 0.85, p.y) * (1.0 - smoothstep(1.02, 1.07, p.y));
  c = mix(c, vec3(1.35, 1.3, 1.25), smoothstep(0.35, 0.8, n) * band * 0.8);
  // 小さな穴や粒
  float s = trHash(floor(p * 300.0));
  if (s > 0.992) c *= 0.55;
  return c;
}
`;

export const tora = {
  id: 'tora',
  type: 'sdf',
  name: '寅さん埴輪',
  ruby: 'とらさんはにわ',
  kind: '埴輪',
  era: '古墳時代後期（6世紀ごろ）',
  place: '東京都葛飾区・柴又八幡神社古墳',
  available: true,
  sdf,
  core,
  thickness: 0.04,
  voxel: 0.0135,
  bounds: { min: [-0.36, -0.02, -0.34], max: [0.36, 1.34, 0.34] },
  height: 1.32,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.86, 0.46, 0.24],
  innerColor: [0.55, 0.28, 0.15],
  fractureColor: [0.86, 0.55, 0.36],
  description: [
    '寅さん埴輪は、東京都葛飾区柴又の柴又八幡神社古墳から見つかった、古墳時代後期（6世紀ごろ）の人物埴輪の頭部です。つばのある帽子をかぶった顔が、柴又を舞台にした映画の主人公「寅さん」に似ていることから、この愛称で親しまれています。',
    '埴輪は古墳のまわりや上に並べられた素焼きの焼き物で、中は空洞です。目と口は粘土をくり抜いてつくられ、長い鼻や耳、首飾りの玉は粘土を貼りつけて表しています。',
    '人物埴輪は、亡くなった人をまつる儀式のようすや、当時の人びとの服装・髪型・装身具を今に伝えてくれる貴重な資料です。',
  ],
  note: 'このゲームの3Dモデルは、寅さん埴輪の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
