// 埴輪 踊る人々（古墳時代後期・埼玉県熊谷市 野原古墳出土）
// 特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）
import { smin, ell, cone, chain, frustum } from './common-sdf.js';

// 1体ぶん（足元が原点、上を y、正面を +z）。写真：下半分は太い円筒の台、腰に突帯、首のない細長い頭へ続く
function figure(x, y, z, o, isCore) {
  const ax = Math.abs(x);
  let d = frustum(x, y, z, isCore ? -0.3 : 0, 0.56, 0.13, 0.122, 1, 0.006);       // 円筒の台（すそ）
  // 上半身：腰から上へ細くなり、そのまま細長い頭へ（首はない）
  d = smin(d, frustum(x, y, z, 0.54, 0.95, 0.098, 0.08, 0.92, 0.01), 0.03);
  d = smin(d, ell(x, y, z, 0, 1.1, 0.0, 0.082, 0.17, 0.075), 0.05);
  if (isCore) return d;
  // 台と上半身のさかいの突帯（つば状に張り出す）と、腰の細い帯
  d = Math.min(d, Math.hypot(Math.hypot(x, z) - 0.128, y - 0.555) - 0.016);
  d = Math.min(d, Math.hypot(Math.hypot(x, z / 0.92) - 0.1, y - (o.belt || 0.63)) - 0.009);
  // 腕
  for (const pts of o.arms) d = smin(d, chain(x, y, z, pts, 0.028, 0.022), 0.025);
  // 顔：まるい目と口の穴、小さな鼻
  d = Math.max(d, -ell(ax, y, z, 0.03, 1.15, 0.07, 0.017, 0.017, 0.05));
  d = Math.max(d, -ell(x, y, z, 0, 1.055, 0.07, 0.018, 0.019, 0.05));
  d = smin(d, ell(x, y, z, 0, 1.1, 0.07, 0.011, 0.02, 0.014), 0.008);
  if (o.crown) {
    // 頭の上の帽子のふちと、頭頂・耳のあたりの小さな突起（髪かざり）
    d = Math.min(d, Math.hypot(Math.hypot(x, z / 0.92) - 0.07, y - 1.2) - 0.009);
    for (const [px, py, pz] of [[0, 1.27, 0], [-0.04, 1.25, 0.01], [0.04, 1.25, 0.01], [0.085, 1.16, -0.005], [-0.085, 1.16, -0.005]]) {
      d = smin(d, ell(x, y, z, px, py, pz, 0.02, 0.022, 0.018), 0.008);
    }
  }
  if (o.tassel) d = smin(d, cone(x, y, z, 0.09, 0.62, 0.04, 0.1, 0.55, 0.05, 0.015, 0.012), 0.006);   // 腰に下げた飾り
  if (o.hole) d = Math.max(d, -ell(x, y, z, -0.125, 0.4, 0.02, 0.05, 0.02, 0.02));               // 台の横の穴
  return d;
}

// 大きい人：右手（向かって左）を腰に下げ、左手を高く上げて先を内へ曲げる
const OA = {
  arms: [
    [[0.07, 0.86, 0], [0.14, 0.96, 0.01], [0.155, 1.12, 0.02], [0.12, 1.2, 0.03]],
    [[-0.07, 0.86, 0], [-0.13, 0.8, 0.02], [-0.11, 0.72, 0.07]],
  ],
  belt: 0.63, hole: true,
};
// 小さい人：右手を上げて頭のそばへ、左手を前へ曲げる。頭に帽子と飾り、腰に下げ飾り
const OB = {
  arms: [
    [[0.07, 0.86, 0], [0.14, 0.95, 0.01], [0.13, 1.08, 0.03], [0.09, 1.13, 0.03]],
    [[-0.07, 0.86, 0], [-0.14, 0.8, 0.03], [-0.13, 0.72, 0.12]],
  ],
  belt: 0.63, crown: true, tassel: true,
};
const A = { x: -0.21, s: 1.08 }, B = { x: 0.23, s: 0.96 };
const place = (P, o, x, y, z, isCore) => figure((x - P.x) / P.s, y / P.s, z / P.s, o, isCore) * P.s;

function sdf(x, y, z) {
  const d = Math.min(place(A, OA, x, y, z, false), place(B, OB, x, y, z, false));
  return Math.max(d, -y);
}
function core(x, y, z) {
  return Math.min(place(A, OA, x, y, z, true), place(B, OB, x, y, z, true));
}

const patternGLSL = `
float odHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float patH(vec3 p) {
  // 素焼きのざらつきと、体の縦のハケ目
  float h = (odHash(floor(p * 240.0)) - 0.5) * 0.25;
  if (p.y < 0.6) h += 0.3 * sin(atan(p.x - (p.x < 0.01 ? -0.21 : 0.23), p.z) * 110.0 + p.y * 8.0);
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
  bounds: { min: [-0.4, -0.02, -0.16], max: [0.4, 1.4, 0.22] },
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
