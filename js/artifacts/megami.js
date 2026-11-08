// 仮面の女神（縄文時代後期・長野県茅野市 中ッ原遺跡出土・国宝）
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
function cap(x, y, z, ax, ay, az, bx, by, bz, r) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const h = clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - r;
}
// 2Dの三角形の距離（iq）
function sdTri(px, py, ax, ay, bx, by, cx, cy) {
  const e0x = bx - ax, e0y = by - ay, e1x = cx - bx, e1y = cy - by, e2x = ax - cx, e2y = ay - cy;
  const v0x = px - ax, v0y = py - ay, v1x = px - bx, v1y = py - by, v2x = px - cx, v2y = py - cy;
  const seg = (vx, vy, ex, ey) => {
    const t = clamp((vx * ex + vy * ey) / (ex * ex + ey * ey), 0, 1);
    return [vx - ex * t, vy - ey * t];
  };
  const q0 = seg(v0x, v0y, e0x, e0y), q1 = seg(v1x, v1y, e1x, e1y), q2 = seg(v2x, v2y, e2x, e2y);
  const s = Math.sign(e0x * e2y - e0y * e2x);
  const d0 = [q0[0] * q0[0] + q0[1] * q0[1], s * (v0x * e0y - v0y * e0x)];
  const d1 = [q1[0] * q1[0] + q1[1] * q1[1], s * (v1x * e1y - v1y * e1x)];
  const d2 = [q2[0] * q2[0] + q2[1] * q2[1], s * (v2x * e2y - v2y * e2x)];
  const dd = Math.min(d0[0], d1[0], d2[0]);
  const ss = Math.min(d0[1], d1[1], d2[1]);
  return -Math.sqrt(dd) * Math.sign(ss);
}

// 仮面：斜め上を向いた逆三角形の板（上のふちが後ろ、下のとがりが前）
const MASK = { cy: 1.19, cz: 0.12, a: -0.55 };
function maskLocal(x, y, z) {
  const dy = y - MASK.cy, dz = z - MASK.cz, c = Math.cos(MASK.a), s = Math.sin(MASK.a);
  return [x, dy * c + dz * s, -dy * s + dz * c];
}
function maskSdf(x, y, z) {
  const [u, v, w] = maskLocal(x, y, z);
  const tri = sdTri(u, v, -0.205, 0.16, 0.205, 0.16, 0, -0.17) + 0.012;
  const dw = Math.abs(w) - 0.035;
  return Math.hypot(Math.max(tri, 0), Math.max(dw, 0)) + Math.min(Math.max(tri, dw), 0) - 0.012;
}

// 空洞をつくる胴体
function core(x, y, z) {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0.225, 0.27, 0, 0.2, 0.25, 0.18);                 // ふくらんだ脚
  d = smin(d, ell(x, y, z, 0, 0.56, 0, 0.27, 0.085, 0.16), 0.05);         // 腰
  d = smin(d, ell(x, y, z, 0, 0.76, 0, 0.245, 0.21, 0.145), 0.06);        // 胴
  d = smin(d, ell(x, y, z, 0, 1.15, -0.01, 0.085, 0.085, 0.075), 0.04);  // 仮面のすぐ後ろの頭
  return d;
}

function procSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  d = smin(d, ell(ax, y, z, 0.225, 0.04, 0.0, 0.17, 0.045, 0.15), 0.04);   // 脚の台
  d = smin(d, ell(x, y, z, 0, 0.585, 0, 0.262, 0.02, 0.158), 0.02);       // 腰の帯
  // 水平にのばした腕（先がやや下がる）と、渦巻のある手先
  d = smin(d, cap(ax, y, z, 0.12, 0.93, 0, 0.39, 0.9, 0.0, 0.055), 0.05);
  d = smin(d, ell(ax, y, z, 0.405, 0.875, 0.0, 0.055, 0.085, 0.05), 0.03);
  d = smin(d, cap(x, y, z, 0, 0.94, -0.01, 0, 1.08, 0.0, 0.078), 0.04);   // 太く短い首
  // 頭の後ろ：かぶとのように丸い頭（仮面の下半分ほどの幅）と、前から後ろへ通る筋
  d = smin(d, ell(x, y, z, 0, 1.2, -0.02, 0.11, 0.13, 0.1), 0.03);
  d = smin(d, cap(x, y, z, 0, 1.335, 0.0, 0, 1.13, -0.118, 0.016), 0.015);
  d = Math.max(d, -ell(ax, y, z, 0.108, 1.17, -0.01, 0.03, 0.02, 0.02));    // 頭の横の穴
  // 頭の横から、あごの下へまわる帯（仮面をとめるひものような輪）
  d = smin(d, cap(ax, y, z, 0.1, 1.26, -0.02, 0.105, 1.1, 0.0, 0.022), 0.012);
  d = smin(d, cap(ax, y, z, 0.105, 1.1, 0.0, 0.03, 1.035, 0.06, 0.022), 0.012);
  // 背中：頭から下がるV字の飾りと、腰の小さなふくらみ
  d = smin(d, cap(ax, y, z, 0.065, 1.04, -0.095, 0.0, 0.86, -0.142, 0.018), 0.02);
  d = smin(d, ell(ax, y, z, 0.075, 0.6, -0.152, 0.035, 0.03, 0.025), 0.015);
  d = smin(d, maskSdf(x, y, z), 0.02);                                    // 仮面
  // おへそ（同心円の中心）
  d = smin(d, ell(x, y, z, 0, 0.72, 0.148, 0.018, 0.018, 0.012), 0.008);
  return Math.max(d, -y);
}

// 形はご提供の3Dデータ（写真から作った立体）をなめらかにしたものを使う
import { loadSdfGrid, loadDetailTexture, makeDetailUniforms, DETAIL_GLSL } from './sdfdata.js';
const detailUniforms = makeDetailUniforms();
let dataSdf = null;
async function prepare() {
  if (!dataSdf) dataSdf = await loadSdfGrid('megami');
  if (!detailUniforms.uDetail.value) await loadDetailTexture('megami', detailUniforms);
}
function sdf(x, y, z) {
  let d = dataSdf(x, y, z);
  // 頭の横の耳の穴（写真）
  if (y > 1.05 && y < 1.15) d = Math.max(d, -Math.max(Math.hypot(y - 1.1, z + 0.04) - 0.017, 0.07 - Math.abs(x)));
  return Math.max(d, -y);
}
const dataCore = (x, y, z) => dataSdf(x, y, z);

const patternGLSL = DETAIL_GLSL + `
float mgHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float mgLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
float mgSpiral(vec2 q, float pitch, float rmax) {
  float r = length(q);
  if (r > rmax) return 0.0;
  float t = r / pitch - atan(q.y, q.x) / 6.2831853;
  return mgLine((t - floor(t + 0.5)) * pitch, 0.006);
}
float patH(vec3 p) {
  float ax = abs(p.x);
  float g = 0.0;
  // ---- 頭部（写真をもとに、3Dデータの形の上に刻む）----
  if (p.y > 0.98) {
    float hg = 0.0;
    // 仮面：面の座標（3Dデータの仮面の面に合わせた向き）
    vec3 mc = vec3(0.0, 1.22, 0.05);
    vec3 mn = normalize(vec3(0.015, 0.694, 0.72));
    vec3 mt = normalize(vec3(0.0, 0.72, -0.694));
    vec3 q = p - mc;
    float mu = q.x, mv = dot(q, mt), mw = dot(q, mn);
    // 逆三角形の3辺からの距離（内側が正）
    vec2 P = vec2(mu, mv);
    float eTop = 0.1 - mv;
    float eL = dot(P - vec2(-0.2, 0.1), normalize(vec2(0.335, 0.2)));
    float eR = dot(P - vec2(0.2, 0.1), normalize(vec2(-0.335, 0.2)));
    bool onMask = mw > -0.03 && min(eTop, min(eL, eR)) > -0.004;
    if (onMask) {
      float e = min(eTop, min(eL, eR));
      // 3辺にそった2本の溝（V字の線）
      hg = max(hg, mgLine(e - 0.022, 0.009));
      hg = max(hg, mgLine(e - 0.042, 0.007));
      // 小さな目の穴・鼻の穴・口
      hg = max(hg, 1.0 - smoothstep(0.006, 0.01, length(vec2(abs(mu) - 0.055, mv - 0.02))));
      hg = max(hg, (1.0 - smoothstep(0.003, 0.006, length(vec2(abs(mu) - 0.012, mv + 0.09)))) * 0.8);
      hg = max(hg, 1.0 - smoothstep(0.005, 0.009, length(vec2(mu, mv + 0.165))));
      return -hg * 0.0024;
    }
    // 後頭部：かぶとのような丸い頭に、点の列のついた筋（中央と左右）と、下のふちの帯
    if (p.z < 0.02 && p.y > 1.12) {
      float ang = atan(p.x, -(p.z + 0.06));
      for (int i = -1; i <= 1; i++) {
        float a0 = float(i) * 0.75;
        float d = abs(ang - a0) * length(vec2(p.x, p.z + 0.06));
        float line = mgLine(d, 0.009);
        float dots = 1.0 - smoothstep(0.0025, 0.0045, length(vec2(d - 0.009, fract(p.y / 0.014) * 0.014 - 0.007)));
        hg = max(hg, max(line, dots));
      }
      float band = abs(p.y - 1.165 - 0.12 * max(p.z + 0.02, 0.0));
      hg = max(hg, mgLine(band, 0.009));
      hg = max(hg, 1.0 - smoothstep(0.0025, 0.0045, length(vec2(band - 0.011, fract(atan(p.x, p.z + 0.04) * 40.0 / 6.2831853) * 0.012 - 0.006))));
    }
    // 耳の穴のまわりの同心円（頭の横）
    float er = length(vec2(p.y - 1.1, p.z + 0.04));
    if (abs(p.x) > 0.07 && er < 0.075) hg = max(hg, mgLine(fract(er / 0.017 + 0.5) - 0.5, 0.3) * step(0.022, er));
    // 3Dデータの写真から取り出した線も重ねる
    hg = max(hg, headDetail(p) * smoothstep(1.02, 1.06, p.y) * 0.8);
    if (p.y > 1.02) return -hg * 0.0022 + (mgHash(floor(p * 120.0)) - 0.5) * 0.00012;
    g = max(g, hg);
  }
  // 背中：一対の渦巻とななめの線
  if (p.z < -0.05 && p.y > 0.62 && p.y < 0.95) {
    float b = 0.0;
    b = max(b, mgSpiral(vec2(p.x + 0.06, p.y - 0.85), 0.016, 0.055));
    b = max(b, mgSpiral(vec2(p.x - 0.07, p.y - 0.7), 0.016, 0.055));
    for (int i = 0; i < 3; i++) b = max(b, mgLine(p.y - 0.78 - float(i) * 0.025 - p.x * 0.45, 0.007) * step(abs(p.x), 0.2));
    return -b * 0.0022;
  }
  if (p.z > 0.0) {
    // お腹の同心円
    float r = length(vec2(p.x, (p.y - 0.72) * 1.05));
    if (r < 0.16) g = max(g, mgLine(fract(r / 0.026 + 0.5) - 0.5, 0.18) * smoothstep(0.03, 0.04, r));
    // 胸から肩への弧（V字に重なる線）
    for (int i = 0; i < 4; i++) {
      float k = float(i) * 0.024;
      g = max(g, mgLine(p.y - (0.9 - k) + ax * (0.55 - k * 2.0), 0.007) * step(ax, 0.24) * step(0.78, p.y));
    }
  }
  // 腕の先の渦巻（前後とも）
  if (ax > 0.31 && p.y > 0.8) g = max(g, mgSpiral(vec2(ax - 0.4, p.y - 0.89), 0.017, 0.07));
  // 腕の縁取りの線
  if (ax > 0.1 && ax < 0.36 && p.y > 0.85) {
    float yc = 0.93 - (ax - 0.12) * 0.11;
    g = max(g, mgLine(abs(p.y - yc) - 0.035, 0.006));
  }
  // 腰の帯：刻み
  if (abs(p.y - 0.585) < 0.03) g = max(g, mgLine(sin(atan(p.x, p.z) * 60.0) * 0.012, 0.006));
  return -g * 0.0022 + (mgHash(floor(p * 120.0)) - 0.5) * 0.00012;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  // 黒く焼けたむらと、茶色いところ
  float n = sin(p.x * 9.0 + 3.0 * sin(p.y * 6.0)) * sin(p.y * 11.0 + p.z * 7.0 + 1.3);
  c *= mix(vec3(0.82), vec3(1.3, 1.15, 1.0), smoothstep(0.2, 0.8, n));
  c *= 1.0 - clamp(-h / 0.0018, 0.0, 1.0) * 0.5;   // 溝は影で暗く
  return c;
}
`;

export const megami = {
  id: 'megami',
  type: 'sdf',
  name: '仮面の女神',
  ruby: 'かめんのめがみ',
  kind: '土偶',
  era: '縄文時代後期前半（約4,000年前）',
  place: '長野県茅野市・中ッ原遺跡',
  available: true,
  prepare,
  patternUniforms: detailUniforms,
  sdf,
  core: dataCore,
  thickness: 0.045,
  voxel: 0.0135,
  bounds: { min: [-0.52, -0.02, -0.29], max: [0.52, 1.4, 0.27] },
  clearRadius: 0.75,
  height: 1.38,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.3, 0.235, 0.18],
  innerColor: [0.28, 0.22, 0.16],
  fractureColor: [0.62, 0.47, 0.34],
  description: [
    '仮面の女神は、2000年に長野県茅野市の中ッ原（なかっぱら）遺跡で見つかった、縄文時代後期前半（約4,000年前）の土偶です。高さは34cmあり、顔に逆三角形の仮面をつけた姿をしています。',
    '中が空洞の「中空土偶」で、お腹の同心円や腕の先の渦巻など、体には細い線の文様がていねいに刻まれています。大きくふくらんだ脚は、ズボンをはいているようにも見えます。',
    '集落の墓とみられる穴の中から、右脚が外れた状態で見つかりました。2014年に国宝に指定され、縄文のビーナスとともに茅野市尖石縄文考古館に収蔵されています。',
  ],
  note: 'このステージの形は、実物の写真から作られた3Dデータをもとにしています（文様は写真を参考に描いたもの）。正確な実測データではありません。',
};
