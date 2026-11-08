// 馬形埴輪（古墳時代後期）
// 飾り馬の特徴をもとに距離関数でプログラム生成した3Dモデル（特定の一点を正確に写したものではありません）

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
// 太さが変わるカプセル
function cone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const h = clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - (ra + (rb - ra) * h);
}
// 平らな楕円（xy平面）を厚み t で押し出した板
function plate(x, y, z, cx, cy, rx, ry, cz, t) {
  const e = (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
  const dz = Math.abs(z - cz) - t;
  return Math.hypot(Math.max(e, 0), Math.max(dz, 0)) + Math.min(Math.max(e, dz), 0);
}
// yz平面の半円板（鞍の前輪・後輪）
function arch(x, y, z, cx, cy, r, t) {
  const e = Math.hypot(y - cy, z) - r;
  const dx = Math.abs(x - cx) - t;
  const d = Math.hypot(Math.max(e, 0), Math.max(dx, 0)) + Math.min(Math.max(e, dx), 0);
  return Math.max(d, cy - y);
}

// 馬の向き：頭が -x 側。全体の中心を原点に寄せる
const OFF = -0.14;
const LEGS = [[-0.27, 0.115], [-0.27, -0.115], [0.27, 0.115], [0.27, -0.115]];

function core(xw, y, z) {
  const x = xw + OFF;
  let d = cone(x, y, z, -0.3, 0.8, 0, 0.3, 0.8, 0, 0.17, 0.16);              // 胴
  d = smin(d, ell(x, y, z, -0.3, 0.84, 0, 0.13, 0.17, 0.15), 0.06);          // 胸
  d = smin(d, ell(x, y, z, 0.31, 0.82, 0, 0.13, 0.16, 0.15), 0.06);          // 尻
  for (const [lx, lz] of LEGS) d = smin(d, cone(x, y, z, lx, -0.3, lz, lx, 0.72, lz, 0.068, 0.062), 0.04); // 脚（筒）
  d = smin(d, cone(x, y, z, -0.33, 0.92, 0, -0.5, 1.19, 0, 0.11, 0.08), 0.05); // 首
  d = smin(d, cone(x, y, z, -0.52, 1.21, 0, -0.74, 1.0, 0, 0.075, 0.055), 0.04); // 頭
  return d;
}

function sdf(xw, y, z) {
  const x = xw + OFF;
  const az = Math.abs(z);
  let d = core(xw, y, z);
  // 脚の先の少しの広がり
  for (const [lx, lz] of LEGS) d = smin(d, cone(x, y, z, lx, 0, lz, lx, 0.1, lz, 0.075, 0.066), 0.02);
  // たてがみ（首の上の扇形の板）
  let mane = plate(x, y, z, -0.33, 1.0, 0.23, 0.34, 0, 0.022);
  mane = Math.max(mane, -plate(x, y, z, -0.44, 0.93, 0.2, 0.25, 0, 0.2));
  mane = Math.max(mane, x - 0.0 - (y - 0.95) * 0.3);
  d = smin(d, mane, 0.02);
  // 耳
  d = smin(d, cone(x, y, az, -0.5, 1.24, 0.045, -0.46, 1.36, 0.05, 0.03, 0.008), 0.02);
  // 目（くぼみ）・鼻の穴
  d = Math.max(d, -ell(x, y, az, -0.6, 1.17, 0.07, 0.022, 0.02, 0.02));
  d = smin(d, cone(x, y, z, -0.74, 1.0, 0, -0.78, 0.99, 0, 0.06, 0.05), 0.02);
  d = Math.max(d, -ell(x, y, z, -0.8, 0.99, 0, 0.012, 0.03, 0.03));
  // おもがい・手綱の輪（口の横の鏡板）
  d = smin(d, plate(x, y, az, -0.7, 1.04, 0.035, 0.035, 0.065, 0.012), 0.008);
  // 鞍：前輪・後輪と座
  d = smin(d, arch(x, y, z, -0.06, 0.92, 0.15, 0.022), 0.02);
  d = smin(d, arch(x, y, z, 0.17, 0.92, 0.12, 0.02), 0.02);
  d = smin(d, ell(x, y, z, 0.055, 0.955, 0, 0.13, 0.03, 0.15), 0.03);
  // 障泥（鞍の下の泥よけ）
  d = smin(d, plate(x, y, az, 0.06, 0.78, 0.15, 0.1, 0.17, 0.014), 0.015);
  // 胸と尻の飾り帯
  const strap = (cx, rr, cy) => {
    const ring = Math.abs(Math.hypot((y - cy) / 1.0, z / 0.92) - rr) - 0.012;
    return Math.max(ring, Math.abs(x - cx) - 0.016);
  };
  d = smin(d, strap(-0.36, 0.165, 0.86), 0.01);
  d = smin(d, strap(0.38, 0.155, 0.84), 0.01);
  // 杏葉（帯から下がる飾り）
  for (const sx of [-0.36, 0.38]) d = smin(d, plate(x, y, az, sx, 0.7, 0.04, 0.055, 0.148, 0.012), 0.015);
  // しっぽ
  d = smin(d, cone(x, y, z, 0.42, 0.9, 0, 0.5, 1.0, 0, 0.04, 0.028), 0.02);
  return Math.max(d, -y);
}

const patternGLSL = `
float umHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float umLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
float patH(vec3 p) {
  float x = p.x - 0.14;
  float h = (umHash(floor(p * 220.0)) - 0.5) * 0.2;
  // 頭の革ひも（おもがい）
  if (x < -0.45) {
    h += umLine(x + 0.56 - (p.y - 1.1) * 0.4, 0.016);
    h += umLine(p.y - 1.06 + (x + 0.6) * 0.5, 0.016) * step(x, -0.5);
  }
  // 胴のヘラ削りのすじ（縦）
  if (x > -0.4 && x < 0.45 && p.y < 0.95) h += 0.25 * sin(x * 140.0 + 2.0 * sin(p.y * 20.0));
  return h * 0.0009;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 11.0 + 3.0 * sin(p.y * 8.0)) * sin(p.y * 13.0 + p.z * 9.0);
  c *= 0.93 + 0.1 * n;
  // 補修のひびのような細い線
  float k = sin(p.x * 31.0 + 5.0 * sin(p.y * 23.0 + p.z * 17.0)) * sin(p.y * 27.0 + 4.0 * sin(p.z * 21.0));
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.04, abs(k))) * 0.18;
  return c;
}
`;

export const uma = {
  id: 'uma',
  type: 'sdf',
  name: '馬形埴輪',
  ruby: 'うまがたはにわ',
  kind: '埴輪',
  era: '古墳時代後期（6世紀ごろ）',
  place: '関東地方の古墳など',
  available: true,
  sdf,
  core,
  thickness: 0.035,
  voxel: 0.0135,
  bounds: { min: [-0.72, -0.02, -0.24], max: [0.72, 1.4, 0.24] },
  height: 1.37,
  clearRadius: 0.82,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.74, 0.44, 0.28],
  innerColor: [0.5, 0.3, 0.19],
  fractureColor: [0.8, 0.55, 0.38],
  description: [
    '馬形（うまがた）埴輪は、古墳に並べられた動物の埴輪のひとつです。くら・あぶみ・手綱などの馬具をつけた「飾り馬」の姿で表されたものが多く、古墳時代後期（6世紀ごろ）の関東地方でとくにさかんにつくられました。',
    '馬は古墳時代の中ごろに朝鮮半島から日本に伝わり、乗り物としてだけでなく、力や身分を示す大切な財産でした。たてがみ、くらの前輪（まえわ）と後輪（しずわ）、泥よけの障泥（あおり）、帯から下がる杏葉（ぎょうよう）などの飾りから、当時の豪華な馬具のようすがわかります。',
    '脚は太い筒のようにつくられていて、中は空洞です。見つかるときにはばらばらに割れていることが多く、破片をつなぎ合わせて復元されたものが博物館に展示されています。',
  ],
  note: 'このゲームの3Dモデルは、馬形埴輪の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
