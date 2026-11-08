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
function core(x, y, z) {
  const ax = Math.abs(x);
  let d = cap(ax, y, z, 0.12, 0.06, 0.0, 0.125, 0.3, 0.0, 0.088);           // 円柱のような脚
  d = smin(d, ell(ax, y, z, 0.13, 0.46, -0.01, 0.15, 0.16, 0.15), 0.05);    // 左右に張った腰・太もも
  d = smin(d, ell(x, y, z, 0, 0.5, -0.05, 0.2, 0.16, 0.17), 0.05);          // 腰の中心
  d = smin(d, ell(x, y, z, 0, 0.6, 0.06, 0.155, 0.17, 0.15), 0.06);         // 大きなお腹
  d = smin(d, ell(x, y, z, 0, 0.78, 0, 0.12, 0.08, 0.1), 0.06);             // くびれ
  d = smin(d, ell(x, y, z, 0, 0.9, 0, 0.15, 0.08, 0.1), 0.05);              // 胸
  d = smin(d, ecyl(x, y, z, 1.25, 0.168, 0.14, 0.15, -0.025, 0.03), 0.03);    // 頭（ボンネットのような円筒）
  d = Math.max(d, y - (1.36 - 0.3 * z));                                        // 頭の上は平らで、後ろが少し高い
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  d = smin(d, ell(ax, y, z, 0.12, 0.03, 0.01, 0.092, 0.035, 0.1), 0.02);    // 足の裏
  d = smin(d, ell(ax, y, z, 0.08, 0.48, -0.14, 0.12, 0.13, 0.1), 0.05);     // 張り出したお尻
  d = smin(d, ell(ax, y, z, 0.17, 0.935, 0, 0.08, 0.042, 0.055), 0.04);     // 短い腕
  d = smin(d, ell(ax, y, z, 0.055, 0.88, 0.085, 0.03, 0.03, 0.026), 0.02);  // 乳房
  d = Math.max(d, -ell(x, y, z, 0, 0.62, 0.21, 0.012, 0.016, 0.02));       // へそ
  d = smin(d, cap(x, y, z, 0, 0.93, 0, 0, 1.08, 0.0, 0.072), 0.05);           // 首
  // 頭の正面の下側をくりぬき、そこに顔をはめこむ（帽子のつばのようになる）
  d = Math.max(d, -ell(x, y, z, 0, 1.12, 0.2, 0.108, 0.13, 0.14));          // 顔の入る正面の開き
  // 顔：小さなハート形、つり上がった切れ長の目、とがった鼻、口
  // ハート形の平たい顔（上が左右にふくらみ、あごがとがる）
  const h2 = Math.min(
    Math.hypot(ax - 0.043, y - 1.195) - 0.05,
    taper2d(x, y, 0, 1.17, 0, 1.098, 0.07, 0.026),
  );
  const zf = 0.15 - 1.8 * x * x;                      // 正面はゆるやかにふくらむ
  const dz = Math.max(z - zf, 0.02 - z);
  let face = Math.hypot(Math.max(h2, 0), Math.max(dz, 0)) + Math.min(Math.max(h2, dz), 0) - 0.006;
  face = smin(face, ell(x, y, z, 0, 1.165, zf + 0.002, 0.012, 0.015, 0.016), 0.006);                // 小さな鼻
  face = Math.max(face, -cap(ax, y, z, 0.02, 1.178, zf + 0.004, 0.064, 1.2, zf - 0.004, 0.0065));  // つり目
  face = Math.max(face, -ell(x, y, z, 0, 1.112, zf, 0.01, 0.009, 0.02));                          // 口
  d = smin(d, face, 0.015);
  // 耳の穴
  d = Math.max(d, -ell(ax, y, z, 0.16, 1.21, -0.02, 0.02, 0.012, 0.012));
  return Math.max(d, -y);
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
  // 顔：つり上がった切れ長の目と口（細い溝）
  if (p.z > 0.07 && p.y > 1.09 && p.y < 1.23) {
    vec2 a = vec2(0.018, 1.177), b = vec2(0.066, 1.199);
    vec2 q = vec2(abs(p.x), p.y);
    float t = clamp(dot(q - a, b - a) / dot(b - a, b - a), 0.0, 1.0);
    float de = length(q - a - (b - a) * t);
    float eye = 1.0 - smoothstep(0.0025, 0.0055 - t * 0.002, de);
    float mouth = 1.0 - smoothstep(0.004, 0.007, length(vec2(p.x, p.y - 1.115)));
    return -max(eye, mouth) * 2.2 * 0.0011;
  }
  // 頭頂：大きな渦巻ひとつ
  if (p.y > 1.335 - 0.3 * p.z) {
    vec2 q = vec2(p.x, (p.z + 0.025) * 1.15);
    h = max(h, vnSpiral(q, 0.026, 0.15));
  }
  // 頭の側面〜後ろの帯：上下の沈線と、左右一対の渦巻
  if (p.y > 1.16 && p.y < 1.4 && p.z < 0.06) {
    h -= 1.0 - smoothstep(0.003, 0.006, abs(p.y - (1.335 - 0.3 * p.z)));
    h -= 1.0 - smoothstep(0.003, 0.006, abs(p.y - 1.17));
    if (p.z < -0.03) {
      float sx = p.x >= 0.0 ? 1.0 : -1.0;
      vec2 q = vec2((p.x - sx * 0.085) * sx, p.y - 1.255);
      h = max(h, vnSpiral(q, 0.02, 0.055));
    }
  }
  // 磨いた面のわずかなむら
  h += 0.15 * (vnHash(floor(p * 90.0)) - 0.5);
  return h * 0.0011;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  // 黒っぽい焼きむら
  float m = sin(p.x * 13.0 + 2.0 * sin(p.y * 7.0)) * sin(p.y * 9.0 + p.z * 11.0);
  c *= 0.9 + 0.12 * m;
  // 雲母のきらめき
  float s = vnHash(floor(p * 420.0));
  if (s > 0.993) c *= 2.4;
  else if (s > 0.985) c *= 1.5;
  c *= 1.0 - clamp(-h / 0.0011, 0.0, 1.0) * 0.32;
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
  sdf,
  core,
  thickness: 0.055,
  voxel: 0.0135,
  bounds: { min: [-0.32, -0.02, -0.28], max: [0.32, 1.43, 0.25] },
  height: 1.36,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.72, 0.44, 0.3],
  innerColor: [0.48, 0.3, 0.21],
  fractureColor: [0.8, 0.58, 0.42],
  description: [
    '縄文のビーナスは、1986年に長野県茅野市の棚畑（たなばたけ）遺跡で見つかった、縄文時代中期（約5,000年前）の土偶です。高さは27cmあり、ほぼ完全な形のまま、集落の中央の広場の穴に横たえられた状態で出土しました。',
    'ハート形の顔に切れ長のつり上がった目、平らな頭の上には渦巻の文様があります。ふくらんだお腹と大きく張り出したお尻は、子どもを宿した女性の姿を表していると考えられています。表面はていねいに磨かれ、粘土に混じった雲母がきらきらと光ります。',
    '1995年に土偶として初めて国宝に指定され、茅野市尖石（とがりいし）縄文考古館に収蔵されています。',
  ],
  note: 'このゲームの3Dモデルは、縄文のビーナスの特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません。',
};
