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

// 角の丸い直方体
function rbox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
// 輪（軸の向き：'x' | 'y' | 'z'）
function torus(x, y, z, cx, cy, cz, R, r, axis) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const [a, b, c] = axis === 'x' ? [py, pz, px] : axis === 'y' ? [px, pz, py] : [px, py, pz];
  return Math.hypot(Math.hypot(a, b) - R, c) - r;
}
// 楕円で横幅を細くしたカプセル（首・頭は横から見ると幅広、正面から見ると細い）
function flatCone(x, y, z, ax, ay, bx, by, ra, rb, sz) {
  return cone(x, y, z / sz, ax, ay, 0, bx, by, 0, ra, rb) * Math.min(1, sz);
}

// 馬の向き：頭が -x 側。写真（東京国立博物館の飾り馬）を参考にした比率
const LEGS = [[-0.28, 0.115], [-0.28, -0.115], [0.36, 0.115], [0.36, -0.115]];
const BODY_Y0 = 0.6, BODY_Y1 = 0.93;

function core(x, y, z) {
  // 長い円筒の脚（下は開いている）
  let d = Infinity;
  for (const [lx, lz] of LEGS) d = Math.min(d, cone(x, y, z, lx, -0.3, lz, lx, BODY_Y0 + 0.05, lz, 0.062, 0.072));
  // 箱のような胴と、丸い尻・胸
  d = smin(d, rbox(x, y, z, 0.04, (BODY_Y0 + BODY_Y1) / 2, 0, 0.4, (BODY_Y1 - BODY_Y0) / 2, 0.17, 0.06), 0.05);
  d = smin(d, ell(x, y, z, 0.35, 0.8, 0, 0.17, 0.17, 0.175), 0.05);
  d = smin(d, ell(x, y, z, -0.33, 0.8, 0, 0.12, 0.15, 0.16), 0.05);
  // 太く弓なりの首と、下を向いた長い頭
  d = smin(d, flatCone(x, y, z, -0.25, 0.84, -0.42, 1.15, 0.2, 0.11, 0.72), 0.07);
  d = smin(d, flatCone(x, y, z, -0.45, 1.17, -0.65, 0.98, 0.085, 0.07, 0.9), 0.04);
  return d;
}

function sdf(x, y, z) {
  const az = Math.abs(z);
  let d = core(x, y, z);
  // 脚の先の切れ込み（写真の後ろ脚・前脚の下端）
  for (const [lx, lz] of LEGS) d = Math.max(d, -rbox(x, y, z, lx, 0.0, lz + Math.sign(lz) * 0.065, 0.012, 0.07, 0.03, 0.006));

  // たてがみ：首の上のふちにそって、き甲から耳の後ろまでのびる、うすい帯の板
  {
    const P = [[-0.09, 0.95], [-0.19, 1.12], [-0.31, 1.25], [-0.44, 1.32]];
    let m = Infinity;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      m = Math.min(m, Math.hypot(x - ax - vx * t, y - ay - vy * t) - 0.04);
    }
    d = smin(d, Math.max(m, Math.abs(z) - 0.02), 0.02);
  }
  // 前髪の筒（耳の間につき出た、先の開いた円筒）
  d = smin(d, cone(x, y, z, -0.465, 1.22, 0, -0.5, 1.38, 0, 0.026, 0.03), 0.015);
  d = Math.max(d, -cone(x, y, z, -0.47, 1.3, 0, -0.5, 1.4, 0, 0.015, 0.018));
  // 耳（とがった筒）
  d = smin(d, cone(x, y, az, -0.42, 1.22, 0.055, -0.4, 1.35, 0.06, 0.03, 0.012), 0.015);

  // 目・鼻の穴・口：くり抜き
  d = Math.max(d, -ell(x, y, az, -0.555, 1.12, 0.07, 0.02, 0.02, 0.04));
  d = Math.max(d, -ell(x, y, az, -0.685, 0.98, 0.028, 0.03, 0.013, 0.013));
  d = Math.max(d, -rbox(x, y, z, -0.68, 0.935, 0, 0.03, 0.005, 0.03, 0.004));

  // 面繋（おもがい）：額・頬・鼻の革ひも
  d = Math.min(d, torus(x, y, z, -0.48, 1.18, 0, 0.082, 0.009, 'x'));            // 額のひも（頭をぐるりと）
  d = Math.min(d, cone(x, y, az, -0.48, 1.18, 0.08, -0.6, 1.02, 0.075, 0.009, 0.009));   // 頬のひも
  d = Math.min(d, torus(x, y, z, -0.61, 1.02, 0, 0.078, 0.009, 'x'));            // 鼻のひも
  // 轡（くつわ）の輪と、口のまわりの鈴（丸いこぶ）
  d = Math.min(d, torus(x, y, az, -0.61, 1.0, 0.08, 0.022, 0.007, 'z'));
  for (const [bx, by, bz] of [[-0.64, 1.04, 0.075], [-0.6, 0.96, 0.078], [-0.66, 0.95, 0.06], [-0.56, 0.99, 0.08], [-0.63, 0.995, 0.085]]) {
    d = smin(d, Math.hypot(x - bx, y - by, az - bz) - 0.018, 0.004);
  }
  // 手綱：轡から首の横の面にそって、ゆるやかに曲がりながら鞍の前へ
  {
    const P = [[-0.6, 1.0], [-0.5, 1.03], [-0.4, 1.0], [-0.3, 0.955], [-0.2, 0.935]];
    let r2 = Infinity;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const vx = bx - ax, vy = by - ay, t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      r2 = Math.min(r2, Math.hypot(x - ax - vx * t, y - ay - vy * t));
    }
    // 体の表面から少しだけ浮いた、うすいひも
    const rein = Math.max(Math.abs(core(x, y, z) - 0.006) - 0.007, r2 - 0.011, 0.03 - az);
    d = Math.min(d, rein);
  }
  // 鞍：前輪（まえわ）と後輪（しずわ）の半円の板、その間の座
  d = smin(d, arch(x, y, z, -0.2, 0.92, 0.225, 0.02), 0.012);
  d = smin(d, arch(x, y, z, 0.06, 0.92, 0.235, 0.02), 0.012);
  d = smin(d, rbox(x, y, z, -0.07, 0.94, 0, 0.13, 0.02, 0.17, 0.015), 0.015);
  // 障泥（あおり）：胴の両わきに垂れる四角い板
  d = smin(d, rbox(x, y, az, -0.05, 0.76, 0.178, 0.17, 0.15, 0.012, 0.025), 0.008);
  // 鐙（あぶみ）：鞍から下がるひもと輪
  d = Math.min(d, cone(x, y, az, -0.03, 0.92, 0.192, -0.03, 0.73, 0.195, 0.008, 0.008));
  d = Math.min(d, torus(x, y, az, -0.03, 0.7, 0.198, 0.032, 0.01, 'z'));

  // 胸繋（むながい）と、下がる杏葉（ぎょうよう）
  d = Math.min(d, cone(x, y, az, -0.2, 0.84, 0.18, -0.36, 0.8, 0.15, 0.009, 0.009));
  d = Math.min(d, cone(x, y, az, -0.36, 0.8, 0.15, -0.44, 0.79, 0.0, 0.009, 0.009));
  for (const [px, py, pz, nx] of [[-0.29, 0.72, 0.182, 0], [-0.42, 0.71, 0.11, 1]]) {
    const lx = x - px, ly = y - py, lz = az - pz;
    // 上がせまく下が広い、鈴のような形の板（点の飾りつき）
    const w = 0.022 + 0.022 * clamp((0.05 - ly) / 0.1, 0, 1);
    const u = nx ? lz : lx, t = nx ? lx : lz;
    const bell = Math.max(Math.abs(u) - w, Math.abs(ly) - 0.05, Math.abs(t) - 0.01);
    d = smin(d, bell - 0.004, 0.006);
    // 表面にならぶ点の飾り（小さなこぶ）
    for (let iy = 0; iy < 4; iy++) for (let iu = -1; iu <= 1; iu++) {
      const by = 0.03 - iy * 0.022, bu = iu * (0.014 + 0.005 * iy);
      const du = u - bu, dy = ly - by, dt = t - 0.014;
      d = Math.min(d, Math.hypot(du, dy, dt) - 0.0065);
    }
  }

  // 尻繋（しりがい）：鞍の後ろから尾の付け根へまわるひもと、上に並ぶ鈴
  d = Math.min(d, cone(x, y, az, 0.1, 0.9, 0.18, 0.36, 0.84, 0.185, 0.011, 0.011));
  d = Math.min(d, cone(x, y, az, 0.36, 0.84, 0.185, 0.5, 0.87, 0.07, 0.011, 0.011));
  for (const [bx, by, bz] of [[0.15, 0.96, 0.07], [0.24, 0.965, 0.1], [0.33, 0.95, 0.12], [0.42, 0.93, 0.08], [0.22, 0.975, 0.0], [0.36, 0.965, 0.0], [0.13, 0.92, 0.16], [0.29, 0.9, 0.17]]) {
    d = smin(d, Math.hypot(x - bx, y - by, az - bz) - 0.022, 0.006);
  }
  // 尾の付け根の丸い円盤と、上へ反った短い尾
  d = smin(d, torus(x, y, z, 0.5, 0.87, 0, 0.075, 0.013, 'x'), 0.01);
  d = smin(d, cone(x, y, z, 0.48, 0.88, 0, 0.68, 0.98, 0, 0.042, 0.026), 0.02);
  // 尻の小さな穴
  d = Math.max(d, -ell(x, y, z, 0.52, 0.76, 0, 0.03, 0.012, 0.012));
  return Math.max(d, -y);
}

const patternGLSL = `
float umHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float umLine(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }
float patH(vec3 p) {
  float x = p.x;
  float h = (umHash(floor(p * 220.0)) - 0.5) * 0.2;
  // 胴のハケ目のすじ（縦）
  if (x > -0.4 && x < 0.5 && p.y > 0.55 && p.y < 0.95) h += 0.25 * sin(x * 140.0 + 2.0 * sin(p.y * 20.0));
  // 杏葉・障泥のふちの点の飾り
  if (p.y > 0.62 && p.y < 0.92) h -= (1.0 - smoothstep(0.003, 0.006, length(vec2(fract(p.x / 0.02) - 0.5, fract(p.y / 0.02) - 0.5) * 0.02))) * step(0.165, abs(p.z) - 0.02) * step(abs(p.x + 0.29), 0.05) * 0.8;
  return h * 0.0009;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 11.0 + 3.0 * sin(p.y * 8.0)) * sin(p.y * 13.0 + p.z * 9.0);
  c *= 0.93 + 0.1 * n;
  // 補修のひびのような細い線
  float k = sin(p.x * 31.0 + 5.0 * sin(p.y * 23.0 + p.z * 17.0)) * sin(p.y * 27.0 + 4.0 * sin(p.z * 21.0));
  c *= 1.0 - (1.0 - smoothstep(0.0, 0.04, abs(k))) * 0.18;
  // 脚の下のほうは赤みが強い（写真）
  c = mix(c, c * vec3(1.08, 0.92, 0.85), smoothstep(0.35, 0.2, p.y));
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
  voxel: 0.0115,
  bounds: { min: [-0.74, -0.02, -0.26], max: [0.72, 1.42, 0.26] },
  height: 1.37,
  clearRadius: 0.82,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.72, 0.5, 0.37],
  innerColor: [0.5, 0.3, 0.19],
  fractureColor: [0.8, 0.55, 0.38],
  description: [
    '馬形（うまがた）埴輪は、古墳に並べられた動物の埴輪のひとつです。くら・あぶみ・手綱などの馬具をつけた「飾り馬」の姿で表されたものが多く、古墳時代後期（6世紀ごろ）の関東地方でとくにさかんにつくられました。',
    '馬は古墳時代の中ごろに朝鮮半島から日本に伝わり、乗り物としてだけでなく、力や身分を示す大切な財産でした。たてがみ、くらの前輪（まえわ）と後輪（しずわ）、泥よけの障泥（あおり）、帯から下がる杏葉（ぎょうよう）などの飾りから、当時の豪華な馬具のようすがわかります。',
    '脚は太い筒のようにつくられていて、中は空洞です。見つかるときにはばらばらに割れていることが多く、破片をつなぎ合わせて復元されたものが博物館に展示されています。',
  ],
  note: 'このゲームの3Dモデルは、馬形埴輪の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
