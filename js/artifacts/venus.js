// 縄文のビーナス（縄文時代中期・長野県茅野市 棚畑遺跡出土・国宝）
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
// 角の丸い楕円柱（頭）
function ecyl(x, y, z, cy, rx, rz, hy, cz, round) {
  const dxz = (Math.hypot(x / rx, (z - cz) / rz) - 1) * Math.min(rx, rz) + round;
  const dy = Math.abs(y - cy) - hy + round;
  return Math.hypot(Math.max(dxz, 0), Math.max(dy, 0)) + Math.min(Math.max(dxz, dy), 0) - round;
}
// 2Dの先細りのカプセル（xy平面）
function taper2d(x, y, ax, ay, bx, by, ra, rb) {
  const px = x - ax, py = y - ay, vx = bx - ax, vy = by - ay;
  const h = clamp((px * vx + py * vy) / (vx * vx + vy * vy), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h) - (ra + (rb - ra) * h);
}
function cap(x, y, z, ax, ay, az, bx, by, bz, r) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const h = clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - r;
}

// 胴体の主な部分（ここから内側を空洞にする）
const HZ = 0.06;                              // 頭は首より少し前に出る
const TOP = (zh) => 1.295 + 0.22 * zh;         // 帽子の上の面（前が高く、後ろが低い）
// 胴の輪郭（正面の半幅 w・奥行きの半分 d・前後の中心 zc）を高さごとに
const PROF = [
  [0.2, 0.2, 0.15, -0.015],
  [0.34, 0.27, 0.19, -0.03],   // 腰〜太ももがいちばん広い
  [0.46, 0.26, 0.19, -0.03],
  [0.58, 0.2, 0.16, -0.015],
  [0.68, 0.145, 0.14, -0.01],
  [0.76, 0.13, 0.12, -0.005],   // くびれ
  [0.86, 0.19, 0.1, 0.0],
  [0.93, 0.215, 0.095, 0.0],   // 肩
  [0.985, 0.12, 0.08, 0.01],
  [1.04, 0.09, 0.085, 0.035],  // 太く短い首（前へ傾く）
  [1.1, 0.09, 0.08, 0.06],
];
function torso(x, y, z) {
  const yc = clamp(y, PROF[0][0], PROF[PROF.length - 1][0]);
  let k = 0;
  while (k < PROF.length - 2 && PROF[k + 1][0] < yc) k++;
  const A = PROF[k], B = PROF[k + 1], t = (yc - A[0]) / (B[0] - A[0]);
  const s = t * t * (3 - 2 * t);
  const w = A[1] + (B[1] - A[1]) * s, dd = A[2] + (B[2] - A[2]) * s, zc = A[3] + (B[3] - A[3]) * s;
  const e = (Math.hypot(x / w, (z - zc) / dd) - 1) * Math.min(w, dd);
  const dy = Math.abs(y - yc);
  return e > 0 ? Math.hypot(e, dy) : Math.max(e, dy > 0 ? dy : -1);
}
function procCore(x, y, z) {
  const ax = Math.abs(x);
  const zh = z - HZ;
  let d = cap(ax, y, z, 0.125, 0.06, 0.0, 0.13, 0.28, -0.01, 0.112);        // 太く短い脚
  d = smin(d, torso(x, y, z), 0.04);
  d = smin(d, ell(ax, y, z, 0.12, 0.37, 0.035, 0.14, 0.13, 0.15), 0.05);   // 前にふくらむ太もも
  d = smin(d, ell(ax, y, z, 0.08, 0.42, -0.12, 0.13, 0.15, 0.12), 0.06);   // 後ろへ張り出したお尻
  d = smin(d, ecyl(x, y, zh, 1.225, 0.185, 0.175, 0.125, -0.03, 0.05), 0.03);  // 帽子（3Dデータの幅・奥行きに合わせる）
  d = Math.max(d, y - TOP(zh));
  d = Math.max(d, -ell(x, y, zh, 0, 1.15, 0.17, 0.118, 0.145, 0.17));       // 正面の丸いくぼみ（内側の壁もそれに沿う）
  return d;
}

function procSdf(x, y, z) {
  const ax = Math.abs(x);
  const zh = z - HZ;
  let d = procCore(x, y, z);
  d = smin(d, ell(ax, y, z, 0.125, 0.03, 0.0, 0.118, 0.035, 0.115), 0.02);  // 足の裏
  d = smin(d, ell(ax, y, z, 0.225, 0.915, 0.0, 0.05, 0.06, 0.055), 0.05);   // 短い腕
  d = smin(d, ell(ax, y, z, 0.055, 0.87, 0.097, 0.028, 0.028, 0.026), 0.015); // 乳房
  // 前に垂れ下がる大きなお腹と、その下のへその穴
  d = smin(d, ell(x, y, z, 0, 0.62, 0.1, 0.11, 0.13, 0.1), 0.05);
  d = smin(d, ell(x, y, z, 0, 0.54, 0.15, 0.065, 0.06, 0.06), 0.04);
  d = Math.max(d, -ell(x, y, z, 0, 0.53, 0.21, 0.012, 0.012, 0.03));
  // 太ももの間のみぞ（お腹の下）
  d = Math.max(d, -Math.max(ax - 0.006, Math.abs(y - 0.4) - 0.1, 0.12 - z)); // 前側だけ浅く
  // 帽子の正面を、顔をかこむアーチ形にくぼませ、ふちを少し盛り上げる（写真のつば）
  {
    const open = Math.max(ell(x, y, zh, 0, 1.15, 0.17, 0.118, 0.145, 0.17), 1.09 - y);
    d = Math.max(d, -open);
    if (zh > 0.08 && y > 1.1) d = smin(d, Math.max(Math.abs(open + 0.012) - 0.011, Math.abs(zh - 0.14) - 0.03, 1.1 - y), 0.01);
  }
  {
  // 顔は大きく、帽子のつばより前にせり出す（元の形を FS 倍に拡大して前へ）
  const FS = 1.05;
  const fx = x / FS, fy = 1.19 + (y - 1.19) / FS, fz = 0.05 + (zh - 0.05 - 0.035) / FS;
  const fax = Math.abs(fx);
  // 顔：丸みをおびて前にせり出したハート形（上が左右にふくらみ、あごが少しとがる）
  let face = ell(fax, fy, fz, 0.036, 1.215, 0.05, 0.072, 0.066, 0.11);
  face = smin(face, ell(fx, fy, fz, 0, 1.16, 0.05, 0.065, 0.062, 0.105), 0.02);
  face = smin(face, cap(fx, fy, fz, 0, 1.23, 0.13, 0, 1.19, 0.18, 0.016), 0.012);   // とがった鼻
  // つり目（細い切れ込み）と口
  const slit = (ax0, ay0, bx0, by0, r) => {
    const px = fax - ax0, py = fy - ay0, vx = bx0 - ax0, vy = by0 - ay0;
    const t = clamp((px * vx + py * vy) / (vx * vx + vy * vy), 0, 1);
    return Math.max(Math.hypot(px - vx * t, py - vy * t) - r, 0.11 - fz);
  };
  // 目は表面の細い溝として描く（下の patternGLSL）
  face = Math.max(face, -slit(0, 1.142, 0, 1.144, 0.009));
  d = smin(d, face * FS, 0.014);
  }
  // 耳（丸い耳たぶと穴）
  d = smin(d, ell(ax, y, zh, 0.185, 1.12, 0.02, 0.035, 0.038, 0.032), 0.01);
  d = Math.max(d, -ell(ax, y, zh, 0.21, 1.12, 0.02, 0.013, 0.015, 0.013));
  // 頭のてっぺん：渦巻の溝と、まん中の穴
  const top = TOP(zh);
  if (y > top - 0.04) {
    const qx = x, qz = (zh + 0.02) * 1.1;
    const r = Math.hypot(qx, qz);
    if (r < 0.175) {
      const pitch = 0.038;
      const t = r / pitch - Math.atan2(qz, qx) / (Math.PI * 2);
      const ds = Math.abs(t - Math.round(t)) * pitch;
      const groove = Math.max(ds - 0.0095, top - 0.016 - y, r - 0.17);
      d = Math.max(d, -groove);
    }
    d = Math.max(d, -Math.max(r - 0.02, top - 0.03 - y));
  }
  return Math.max(d, -y);
}


// ---- 体の形はご提供の3Dデータ（実物の写真から作られたもの）を使う ----
//   data/venus-sdf.json / .bin : 3Dデータを距離の格子に変換したもの（Int8）
//   首から上（帽子・顔・渦巻）は、細部をはっきりさせるため形を作り込んだものにつなぐ
import { loadSdfGrid } from './sdfdata.js';
let dataSdf = null;
async function prepare() {
  if (!dataSdf) dataSdf = await loadSdfGrid('venus');
}
// 両足：3Dデータでは左右がくっついているので、データの太さ・奥行きに合わせて2本に分けて作り直す
function legs(x, y, z) {
  const ax = Math.abs(x), t = clamp(y / 0.24, 0, 1);
  const rx = 0.124 - 0.01 * t, rz = 0.165 - 0.015 * t;
  const e = (Math.hypot((ax - 0.134) / rx, (z - 0.015) / rz) - 1) * Math.min(rx, rz);
  return e;
}
function body(x, y, z) {
  if (y > 0.31) return dataSdf(x, y, z);
  const t = clamp((y - 0.2) / 0.11, 0, 1), s = t * t * (3 - 2 * t);
  let d = legs(x, y, z) * (1 - s) + dataSdf(x, y, z) * s;
  // 脚の付け根まで左右を分ける
  const gap = 0.013 * (1 - s);
  if (gap > 0) d = Math.max(d, gap - Math.abs(x));
  return d;
}
const mixHead = (y) => { const t = clamp((y - 1.0) / 0.08, 0, 1); return t * t * (3 - 2 * t); };
function sdf(x, y, z) {
  const t = mixHead(y);
  let d;
  if (t <= 0) d = body(x, y, z);
  else if (t >= 1) d = procSdf(x, y, z);
  else d = body(x, y, z) * (1 - t) + procSdf(x, y, z) * t;
  // 写真から：小さな乳房と、垂れたお腹の先のへその穴
  const ax = Math.abs(x);
  if (y > 0.75 && y < 0.98) d = smin(d, ell(ax, y, z, 0.06, 0.865, 0.118, 0.026, 0.026, 0.024), 0.012);
  if (y > 0.45 && y < 0.62) d = Math.max(d, -ell(x, y, z, 0, 0.545, 0.235, 0.011, 0.011, 0.04));
  // 写真から：お尻の割れ目、お尻と脚の境目、前の太ももの間のくぼみ（なめらかな溝）
  const g = (v, w) => Math.exp(-(v / w) * (v / w));
  if (y > 0.22 && y < 0.5) {
    const band = (lo, hi) => clamp((y - lo) / 0.03, 0, 1) * clamp((hi - y) / 0.03, 0, 1);
    if (z < -0.05) {
      d += 0.016 * g(ax, 0.014) * band(0.24, 0.47);
      d += 0.012 * g(y - 0.268 - 0.05 * (ax / 0.22) * (ax / 0.22), 0.011) * clamp((0.24 - ax) / 0.04, 0, 1);
    }
    if (z > 0.05) d += 0.012 * g(ax, 0.016) * band(0.24, 0.4);
  }
  return Math.max(d, -y);
}
function core(x, y, z) {
  const t = mixHead(y);
  if (t <= 0) return body(x, y, z);
  if (t >= 1) return procCore(x, y, z);
  return body(x, y, z) * (1 - t) + procCore(x, y, z) * t;
}

// 外面：よく磨かれた肌と、きらきら光る雲母、頭頂の渦巻文
const patternGLSL = `
float vnHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vnSpiral(vec2 q, float pitch, float rmax) {
  float r = length(q);
  if (r > rmax) return 0.0;
  float a = atan(q.y, q.x);
  float t = r / pitch - a / 6.2831853;
  float d = abs(t - floor(t + 0.5)) * pitch;
  return 1.0 - smoothstep(0.004, 0.008, d);
}
float patH(vec3 p) {
  float h = 0.0;
  // 顔：つり上がった細い目（溝）
  if (p.z > 0.1 && abs(p.x) < 0.09 && p.y > 1.15 && p.y < 1.26) {
    vec2 a = vec2(0.022, 1.203), b = vec2(0.07, 1.226);
    vec2 q = vec2(abs(p.x), p.y);
    float t = clamp(dot(q - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
    float de = length(q - a - (b - a) * t);
    h -= (1.0 - smoothstep(0.0035, 0.0065 - t * 0.0025, de)) * 3.0;
  }
  // 顔：つり上がった切れ長の目と口（細い溝）
  // 頭頂：大きな渦巻ひとつ
  if (p.y > 1.27 + 0.22 * (p.z - 0.06)) {
    vec2 q = vec2(p.x, (p.z - 0.045 + 0.02) * 1.1);
    h -= vnSpiral(q, 0.038, 0.145) * 1.5;   // 形の溝と同じ位置をくっきりさせる
  }
  // 頭の側面〜後ろの帯：上下の沈線と、左右一対の渦巻
  if (p.y > 1.16 && p.y < 1.4 && p.z < 0.06) {
    h -= 1.0 - smoothstep(0.003, 0.006, abs(p.y - (1.27 + 0.22 * (p.z - 0.06))));
    h -= 1.0 - smoothstep(0.003, 0.006, abs(p.y - 1.17));
    // 写真：帽子の側面、耳の後ろ上に渦巻。そのまわりを前から後ろへ回りこむ弧の線
    if (abs(p.x) > 0.1) {
      vec2 q = vec2(p.z + 0.06, p.y - 1.255);
      if (p.x < 0.0) q.x = -q.x;
      h = max(h, vnSpiral(q, 0.019, 0.05));
      // 写真：渦巻を囲むように何本もの曲線が前へ流れる
      for (int i = 0; i < 3; i++) {
        float rr = 0.07 + float(i) * 0.022;
        float arc = abs(length(vec2(p.z + 0.06, (p.y - 1.255) * 1.25)) - rr);
        h -= (1.0 - smoothstep(0.003, 0.006, arc)) * step(p.z, 0.04 - float(i) * 0.02) * step(1.13, p.y) * step(p.y, 1.36);
      }
      // つばに沿った前のふちの線
      float rim = abs(length(vec2(abs(p.x) - 0.0, (p.y - 1.19) * 1.0)) - 0.16);
      h -= (1.0 - smoothstep(0.003, 0.006, rim)) * step(0.06, p.z);
    }
  }
  // 磨いた面のわずかなむら
  h += 0.15 * (vnHash(floor(p * 90.0)) - 0.5);
  return h * 0.0011;
}
vec3 patC(vec3 p, float h) {
  // 写真の色：赤みのある素焼きの茶色がほぼ一様に広がり、ところどころ少し暗い焼きむらがある
  float n1 = sin(p.x * 13.0 + 3.0 * sin(p.y * 9.0 + p.z * 7.0)) * sin(p.y * 11.0 + p.z * 15.0 + 1.7);
  float n2 = vnHash(floor(p * 45.0)) - 0.5;
  vec3 c = vec3(1.0) * (0.95 + 0.07 * n1 + 0.05 * n2);
  // 写真：表面に細かい黒っぽい斑点（焼きむら・小さなくぼみ）
  float sp = vnHash(floor(p * 320.0));
  if (sp > 0.95) c *= 0.75;
  float soot = smoothstep(0.7, 0.95, n1 * 0.8 + sin(p.x * 31.0 + p.y * 23.0) * 0.3);
  c = mix(c, vec3(0.72, 0.68, 0.7), soot * 0.5);
  // 粘土にまじる雲母のきらめきと白い砂粒
  float s = vnHash(floor(p * 420.0));
  if (s > 0.994) c *= 1.9; else if (s > 0.984) c *= 1.3; else if (s < 0.01) c *= 0.75;
  c *= 1.0 - clamp(-h / 0.0011, 0.0, 1.0) * 0.3;
  return c;
}
`;

export const venus = {
  id: 'venus',
  type: 'sdf',
  name: '縄文のビーナス',
  ruby: 'じょうもんのびーなす',
  kind: '土偶',
  era: '縄文時代中期（約5,000年前）',
  place: '長野県茅野市・棚畑遺跡',
  available: true,
  prepare,
  sdf,
  core,
  thickness: 0.055,
  voxel: 0.0105,
  bounds: { min: [-0.36, -0.02, -0.32], max: [0.36, 1.43, 0.4] },
  height: 1.36,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.58, 0.33, 0.21],
  innerColor: [0.36, 0.21, 0.14],
  fractureColor: [0.68, 0.45, 0.31],
  description: [
    '縄文のビーナスは、1986年に長野県茅野市の棚畑（たなばたけ）遺跡で見つかった、縄文時代中期（約5,000年前）の土偶です。高さは27cmあり、ほぼ完全な形のまま、集落の中央の広場の穴に横たえられた状態で出土しました。',
    'ハート形の顔に切れ長のつり上がった目、平らな頭の上には渦巻の文様があります。ふくらんだお腹と大きく張り出したお尻は、子どもを宿した女性の姿を表していると考えられています。表面はていねいに磨かれ、粘土に混じった雲母がきらきらと光ります。',
    '1995年に土偶として初めて国宝に指定され、茅野市尖石（とがりいし）縄文考古館に収蔵されています。',
  ],
  note: 'このステージの体の形は、実物の写真から作られた3Dデータをもとにしています（頭部は特徴をもとに作り込んだもの）。正確な実測データではありません。',
};
