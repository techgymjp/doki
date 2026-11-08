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
// 仮面の面の座標（3Dデータの仮面の面に合わせた向き）
const MC = [0, 1.22, 0.05];
const MN = (() => { const v = [0.015, 0.694, 0.72], l = Math.hypot(...v); return v.map((c) => c / l); })();
const MT = (() => { const v = [0, 0.72, -0.694], l = Math.hypot(...v); return v.map((c) => c / l); })();
function maskUV(x, y, z) {
  const q = [x - MC[0], y - MC[1], z - MC[2]];
  return [q[0], q[0] * MT[0] + q[1] * MT[1] + q[2] * MT[2], q[0] * MN[0] + q[1] * MN[1] + q[2] * MN[2]];
}
const seg2 = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
};
// 仮面の写真：ふちが太く盛り上がり、左上の角から下へ一本の隆起（先に丸いこぶ）、角と先に小さな穴
const MASK_A = [-0.2, 0.1], MASK_B = [0.2, 0.1], MASK_C = [0, -0.232];
function maskRelief(x, y, z) {
  const [u, v, w] = maskUV(x, y, z);
  if (w < -0.06 || w > 0.08 || v < -0.27 || v > 0.14 || Math.abs(u) > 0.24) return 1;
  const W0 = 0.026; // 仮面の表の面の高さ
  const ridge = (d, r) => Math.hypot(d, Math.max(w - W0, 0)) - r;
  // ふち（3辺）
  let e = Math.min(seg2(u, v, ...MASK_A, ...MASK_B), seg2(u, v, ...MASK_B, ...MASK_C), seg2(u, v, ...MASK_C, ...MASK_A));
  let d = ridge(e + 0.004, 0.014);
  // 左上の角から下へのびる隆起と、その先の丸いこぶ
  d = Math.min(d, Math.hypot(seg2(u, v, -0.135, 0.07, -0.005, -0.14), Math.max(w - 0.03, 0)) - 0.011);
  d = Math.min(d, Math.hypot(u, v + 0.15, Math.max(w - 0.03, 0)) - 0.024);
  return d;
}
function maskHoles(x, y, z) {
  const [u, v, w] = maskUV(x, y, z);
  if (w < -0.08 || w > 0.08) return 1;
  let h = 1;
  for (const [hu, hv, r] of [[0.15, 0.072, 0.009], [-0.15, 0.072, 0.009], [0, -0.2, 0.009]]) h = Math.min(h, Math.hypot(u - hu, v - hv) - r);
  return h;
}

function sdf(x, y, z) {
  let d = dataSdf(x, y, z);
  if (y > 1.0) {
    d = smin(d, maskRelief(x, y, z), 0.006);
    d = Math.max(d, -maskHoles(x, y, z));
  }
  // 頭の横の耳の穴（写真）
  if (y > 1.05 && y < 1.15) d = Math.max(d, -Math.max(Math.hypot(y - 1.1, z + 0.04) - 0.017, 0.07 - Math.abs(x)));
  return Math.max(d, -y);
}
const dataCore = (x, y, z) => dataSdf(x, y, z);

const patternGLSL = DETAIL_GLSL + `
float mgHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
// 溝の断面：へらで引いたような丸い U 字（中心がいちばん深い）
float mgLine(float d, float w) { float x = abs(d) / (w * 1.15); return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
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
      // ふちの内側にそった溝
      hg = max(hg, mgLine(e - 0.034, 0.008));
      // 隆起の両わきの細い線
      vec2 A2 = vec2(-0.135, 0.07), B2 = vec2(-0.005, -0.14);
      vec2 P2 = vec2(mu, mv);
      float t2 = clamp(dot(P2 - A2, B2 - A2) / dot(B2 - A2, B2 - A2), 0.0, 1.0);
      float dr = length(P2 - A2 - (B2 - A2) * t2);
      hg = max(hg, mgLine(dr - 0.02, 0.006) * step(0.03, e));
      return -hg * 0.005;
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
    if (p.y > 1.02) return -hg * 0.005 + (mgHash(floor(p * 120.0)) - 0.5) * 0.00012;
    g = max(g, hg);
  }
  // 背中：一対の渦巻とななめの線
  if (p.z < -0.05 && p.y > 0.62 && p.y < 0.95) {
    float b = 0.0;
    b = max(b, mgSpiral(vec2(p.x + 0.06, p.y - 0.85), 0.016, 0.055));
    b = max(b, mgSpiral(vec2(p.x - 0.07, p.y - 0.7), 0.016, 0.055));
    for (int i = 0; i < 3; i++) b = max(b, mgLine(p.y - 0.78 - float(i) * 0.025 - p.x * 0.45, 0.007) * step(abs(p.x), 0.2));
    return -b * 0.005;
  }
  // 点の列（刺突文）：線のすぐ横に小さな丸い穴が並ぶ
  #define DOTS(dist, along) mgLine(length(vec2(dist, fract((along) / 0.011) * 0.011 - 0.0055)), 0.0042)
  if (p.z > 0.0) {
    // お腹の同心円（中心に小さな穴）
    float r = length(vec2(p.x, (p.y - 0.70) * 1.05));
    if (r < 0.125) g = max(g, mgLine(fract(r / 0.026 + 0.5) - 0.5, 0.2) * step(0.02, r));
    g = max(g, 1.0 - smoothstep(0.006, 0.01, r));
    // 両肩から胸の中央へ下がる何本もの線（V字）と、その外側の点の列
    if (p.y > 0.76 && r > 0.12) {
      for (int i = 0; i < 4; i++) {
        float k = float(i) * 0.02;
        float dv = p.y - (0.875 - k) + ax * (0.5 - k * 1.5);
        g = max(g, mgLine(dv, 0.007) * step(ax, 0.26));
        if (i == 0) g = max(g, DOTS(dv - 0.011, ax) * step(ax, 0.26));
      }
    }
    // 同心円を下から囲む弧の線
    float r2 = length(vec2(p.x * 0.85, (p.y - 0.70) * 1.05));
    if (p.y < 0.72) for (int i = 0; i < 2; i++) g = max(g, mgLine(r2 - 0.15 - float(i) * 0.02, 0.007) * step(0.6, p.y));
    // 股のまるいこぶのまわりの弧
    float rk = length(vec2(p.x, (p.y - 0.535) * 1.2));
    if (p.y < 0.6) g = max(g, mgLine(rk - 0.045, 0.007) * step(0.53, p.y));
  }
  // 腕の先：同心円と中心の点（前後とも）
  if (ax > 0.31 && p.y > 0.8) {
    float ra = length(vec2(ax - 0.405, p.y - 0.885));
    if (ra < 0.075) g = max(g, max(mgLine(fract(ra / 0.018 + 0.5) - 0.5, 0.28) * step(0.012, ra), 1.0 - smoothstep(0.005, 0.008, ra)));
  }
  // 腕：上下のふちにそった線と、上のふちの点の列
  if (ax > 0.1 && ax < 0.34 && p.y > 0.84) {
    float yc = 0.93 - (ax - 0.12) * 0.11;
    float dy = abs(p.y - yc) - 0.035;
    g = max(g, mgLine(dy, 0.006));
    g = max(g, DOTS(p.y - yc - 0.022, ax) * 0.9);
  }
  // 腰の帯：ななめの刻み（縄のような帯）と上下の線
  if (abs(p.y - 0.585) < 0.028) {
    float a = atan(p.x, p.z);
    g = max(g, mgLine(sin(a * 45.0 + p.y * 160.0) * 0.012, 0.006) * step(abs(p.y - 0.585), 0.018));
    g = max(g, mgLine(abs(p.y - 0.585) - 0.022, 0.006));
  }
  return -g * 0.005 + (mgHash(floor(p * 120.0)) - 0.5) * 0.00012;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  // 黒く焼けたむらと、茶色いところ
  float n = sin(p.x * 9.0 + 3.0 * sin(p.y * 6.0)) * sin(p.y * 11.0 + p.z * 7.0 + 1.3);
  c *= mix(vec3(0.82), vec3(1.3, 1.15, 1.0), smoothstep(0.2, 0.8, n));
  c *= 1.0 - pow(clamp(-h / 0.005, 0.0, 1.0), 0.7) * 0.55;   // 溝の奥は光が届かず暗い
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
  voxel: 0.0105,
  bounds: { min: [-0.52, -0.02, -0.29], max: [0.52, 1.4, 0.27] },
  clearRadius: 0.75,
  height: 1.38,
  patternGLSL,
  bumpStrength: 1.6,
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
