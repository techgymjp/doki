// 埴輪 踊る人々（古墳時代後期・埼玉県熊谷市 野原古墳出土）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）
import { smin, ell, cone, chain, frustum } from './common-sdf.js';

// 1体ぶん（足元が原点、上を y、正面を +z）。arms で腕の形を変える
function figure(x, y, z, arms, isCore) {
  const ax = Math.abs(x);
  // 下がすその広がった円筒の体
  let d = frustum(x, y, z, isCore ? -0.3 : 0, 0.14, 0.135, 0.105, 0.92, 0.01);
  d = smin(d, frustum(x, y, z, 0.12, 0.8, 0.105, 0.088, 0.92, 0.01), 0.03);
  d = smin(d, ell(x, y, z, 0, 0.72, 0, 0.1, 0.12, 0.085), 0.04);              // 胸
  d = smin(d, cone(x, y, z, 0, 0.8, 0, 0, 0.9, 0, 0.05, 0.045), 0.03);        // 首
  d = smin(d, ell(x, y, z, 0, 0.99, 0.005, 0.09, 0.105, 0.088), 0.03);        // まるい頭
  if (isCore) return d;
  // 頭のうしろの髪のふくらみ（みずら風の小さなまげ）
  d = smin(d, ell(x, y, z, 0, 1.07, -0.035, 0.05, 0.04, 0.045), 0.02);
  // 腕（細い棒）
  for (const pts of arms) d = smin(d, chain(x, y, z, pts, 0.03, 0.026), 0.02);
  // 目と口：くり抜き（口は丸くあいている）
  d = Math.max(d, -ell(ax, y, z, 0.035, 1.0, 0.09, 0.02, 0.011, 0.05));
  d = Math.max(d, -ell(x, y, z, 0, 0.93, 0.085, 0.017, 0.02, 0.05));
  // 鼻
  d = smin(d, ell(x, y, z, 0, 0.965, 0.088, 0.012, 0.018, 0.014), 0.008);
  return d;
}

// 大きい人：左手を高く上げ、右手を前へ曲げる
const ARMS_A = [
  [[0.075, 0.76, 0], [0.16, 0.86, 0.01], [0.2, 1.02, 0.02], [0.17, 1.16, 0.03]],
  [[-0.075, 0.76, 0], [-0.14, 0.66, 0.03], [-0.1, 0.62, 0.14]],
];
// 小さい人：右手を上げ、左手を下へ
const ARMS_B = [
  [[-0.075, 0.76, 0], [-0.16, 0.86, 0.0], [-0.19, 1.0, 0.02], [-0.16, 1.12, 0.03]],
  [[0.075, 0.76, 0], [0.13, 0.64, 0.02], [0.13, 0.54, 0.06]],
];
const A = { x: -0.22, s: 1.18 }, B = { x: 0.26, s: 1.04 };
const place = (f, P, x, y, z, arms, isCore) => f((x - P.x) / P.s, y / P.s, z / P.s, arms, isCore) * P.s;

function sdf(x, y, z) {
  const d = Math.min(place(figure, A, x, y, z, ARMS_A, false), place(figure, B, x, y, z, ARMS_B, false));
  return Math.max(d, -y);
}
function core(x, y, z) {
  return Math.min(place(figure, A, x, y, z, null, true), place(figure, B, x, y, z, null, true));
}

const patternGLSL = `
float odHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float patH(vec3 p) {
  // 素焼きのざらつきと、体の縦のハケ目
  float h = (odHash(floor(p * 240.0)) - 0.5) * 0.25;
  if (p.y < 0.95) h += 0.3 * sin(atan(p.x - (p.x < 0.02 ? -0.22 : 0.26), p.z) * 90.0 + p.y * 12.0);
  return h * 0.0006;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 17.0 + 4.0 * sin(p.y * 13.0)) * sin(p.y * 23.0 + p.z * 15.0);
  c *= 0.93 + 0.1 * n;
  // 白っぽく土が残ったところ
  c = mix(c, vec3(1.25, 1.2, 1.15), smoothstep(0.55, 0.9, n) * 0.6);
  return c;
}
`;

export const odoru = {
  id: 'odoru',
  type: 'sdf',
  name: '埴輪 踊る人々',
  ruby: 'はにわ おどるひとびと',
  kind: '埴輪',
  era: '古墳時代後期（6世紀）',
  place: '埼玉県熊谷市・野原古墳',
  available: true,
  sdf,
  core,
  thickness: 0.03,
  voxel: 0.0105,
  bounds: { min: [-0.48, -0.02, -0.16], max: [0.5, 1.4, 0.24] },
  height: 1.38,
  clearRadius: 0.62,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.84, 0.5, 0.31],
  innerColor: [0.55, 0.32, 0.2],
  fractureColor: [0.86, 0.58, 0.4],
  description: [
    '埴輪 踊る人々は、埼玉県熊谷市の野原（のばら）古墳から出土した、古墳時代後期（6世紀）の人物埴輪です。片手を高く上げ、口をまるくあけた姿が歌い踊っているように見えることから、この名で親しまれ、教科書などでもよく知られています。',
    '大きいほうと小さいほうの2体が並んで展示されています。目と口は粘土をくり抜いた穴で、体は円筒形の中空です。',
    '近年の調査では、上げた手で馬の手綱を引く「馬をひく人」を表したものではないかという説も出されています。',
  ],
  note: 'このゲームの3Dモデルは、踊る人々の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
