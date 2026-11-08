// 遮光器土偶（縄文時代晩期）
// 亀ヶ岡遺跡出土の遮光器土偶の特徴をもとに、距離関数でプログラム生成した3Dモデル
// （特定の一点を正確に写したものではありません）

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function smin(a, b, k) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
// 楕円体の近似距離
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}

// 空洞をつくる胴体の主な部分
function core(x, y, z) {
  const ax = Math.abs(x);
  let d = ell(ax, y, z, 0.12, 0.2, 0, 0.11, 0.17, 0.11);           // 脚
  d = smin(d, ell(x, y, z, 0, 0.42, 0, 0.25, 0.15, 0.155), 0.05);   // 腰
  d = smin(d, ell(x, y, z, 0, 0.62, 0, 0.215, 0.2, 0.15), 0.05);    // 胴
  d = smin(d, ell(x, y, z, 0, 0.78, 0, 0.24, 0.13, 0.15), 0.04);    // 胸
  d = smin(d, ell(ax, y, z, 0.27, 0.76, 0, 0.12, 0.14, 0.12), 0.04); // 肩・上腕
  d = smin(d, ell(x, y, z, 0, 0.9, 0, 0.1, 0.06, 0.09), 0.04);      // 首
  d = smin(d, ell(x, y, z, 0, 1.06, -0.01, 0.17, 0.14, 0.14), 0.04); // 頭
  return d;
}

function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  d = smin(d, ell(ax, y, z, 0.11, 0.045, 0.025, 0.075, 0.05, 0.085), 0.03);  // 足
  d = smin(d, ell(ax, y, z, 0.31, 0.6, 0.02, 0.085, 0.105, 0.085), 0.04);    // 前腕
  d = smin(d, ell(ax, y, z, 0.315, 0.5, 0.035, 0.05, 0.045, 0.045), 0.02);   // 手
  d = smin(d, ell(ax, y, z, 0.08, 0.77, 0.14, 0.036, 0.036, 0.03), 0.02);    // 乳房
  // 遮光器のような大きな目
  d = smin(d, ell(ax, y, z, 0.1, 1.07, 0.06, 0.115, 0.088, 0.1), 0.025);
  d = Math.max(d, -ell(ax, y, z, 0.105, 1.07, 0.165, 0.09, 0.008, 0.035)); // 横一文字の切れ目
  // 口
  d = smin(d, ell(x, y, z, 0, 0.965, 0.125, 0.032, 0.022, 0.025), 0.015);
  d = Math.max(d, -ell(x, y, z, 0, 0.965, 0.15, 0.016, 0.009, 0.02));
  // 冠（頭飾り）
  d = smin(d, ell(x, y, z, 0, 1.2, -0.015, 0.165, 0.062, 0.135), 0.03);
  d = smin(d, ell(x, y, z, 0, 1.29, -0.01, 0.095, 0.06, 0.085), 0.03);
  d = smin(d, ell(ax, y, z, 0.07, 1.335, 0.0, 0.04, 0.04, 0.04), 0.015);
  d = smin(d, ell(x, y, z, 0, 1.375, 0.01, 0.045, 0.04, 0.04), 0.015);
  d = Math.max(d, -ell(x, y, z, 0, 1.33, 0.085, 0.022, 0.022, 0.05)); // 冠の正面の穴
  // 耳飾り
  d = smin(d, ell(ax, y, z, 0.2, 1.1, -0.02, 0.035, 0.04, 0.04), 0.015);
  return Math.max(d, -y); // 床で切る
}

// 外面の文様（GLSL）：雲形文の沈線・縄文・点列・目の線
const patternGLSL = `
float dgHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dgCloud(vec3 p) {
  float s = p.z >= 0.0 ? 1.0 : -1.0;
  return sin(p.x * 40.0 * s + 2.8 * sin(p.y * 29.0 + p.z * 9.0)) * cos(p.y * 37.0 + 2.4 * sin(abs(p.x) * 26.0 + p.z * 13.0));
}
float dgDots(vec3 p, float yb) {
  float a = atan(p.x, p.z);
  float rr = length(p.xz);
  float u = fract(a * 70.0 / 6.2831853) - 0.5;
  vec2 q = vec2(u * rr * 6.2831853 / 70.0, p.y - yb);
  return 1.0 - smoothstep(0.004, 0.0075, length(q));
}
float patH(vec3 p) {
  float ax = abs(p.x);
  // 目：ふちどりの溝と、同心のすじ
  vec2 e = vec2((ax - 0.1) / 0.115, (p.y - 1.07) / 0.088);
  float el = length(e);
  if (el < 1.15 && p.z > 0.05) {
    float ring = 1.0 - smoothstep(0.03, 0.09, abs(el - 0.97));
    float lines = 0.35 * smoothstep(0.6, 0.0, abs(fract(e.y * 3.5) - 0.5) * 2.0) * step(el, 0.85);
    return (-ring + lines) * 0.0016;
  }
  // 冠の帯：格子とS字
  if (p.y > 1.15 && p.y < 1.26) {
    float b = sin(atan(p.x, p.z) * 18.0 + 3.0 * sin(p.y * 90.0));
    return -(1.0 - smoothstep(0.0, 0.25, abs(b))) * 0.0012;
  }
  // 点の列（首・腰・腕の付け根）
  float dots = max(max(max(dgDots(p, 0.875), dgDots(p, 0.33)), max(dgDots(p, 1.255), dgDots(p, 0.52))), dgDots(p, 0.905));
  float c = dgCloud(p);
  float groove = max(1.0 - smoothstep(0.0, 0.13, abs(c - 0.3)), 1.0 - smoothstep(0.0, 0.1, abs(c + 0.35)));
  float zone = smoothstep(0.2, 0.36, c);            // 磨かれた面（縄文を消した部分）
  float cord = sin((p.y + 0.55 * p.x + 0.3 * p.z) * 420.0 + 2.0 * sin(p.x * 140.0)) * 0.5 + 0.5;
  float h = -groove + (1.0 - zone) * (cord - 0.5) * 0.35 + zone * 0.15 + dots * 0.9;
  return h * 0.0013;
}
vec3 patC(vec3 p, float h) {
  float g = clamp(-h / 0.0013, 0.0, 1.0);
  float n = dgHash(floor(p * 160.0));
  vec3 c = vec3(1.0) * (0.8 + 0.16 * n);
  c = mix(c, vec3(2.6, 2.45, 2.2), g * 0.8);     // 溝に残る白っぽい土
  c *= 1.0 + clamp(h / 0.0013, 0.0, 1.0) * 0.25;   // 盛り上がりは少し明るく
  return c;
}
`;

export const dogu = {
  id: 'dogu',
  type: 'sdf',
  name: '遮光器土偶',
  ruby: 'しゃこうきどぐう',
  kind: '土偶',
  era: '縄文時代晩期（約3,000〜2,400年前）',
  place: '青森県・亀ヶ岡遺跡など東北地方',
  available: true,
  sdf,
  core,
  thickness: 0.045,
  voxel: 0.0135,
  bounds: { min: [-0.46, -0.02, -0.26], max: [0.46, 1.46, 0.27] },
  height: 1.42,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.19, 0.18, 0.17],
  innerColor: [0.15, 0.14, 0.13],
  fractureColor: [0.55, 0.46, 0.37],
  description: [
    '遮光器土偶（しゃこうきどぐう）は、縄文時代晩期（約3,000〜2,400年前）に東北地方を中心につくられた土偶です。顔の大部分をしめる大きな目が、北方の人びとが雪の照り返しを防ぐために使った「遮光器（雪めがね）」に似ていることから、この名がつきました。',
    'もっとも有名なのは青森県つがる市の亀ヶ岡遺跡で見つかったもの（東京国立博物館所蔵・重要文化財、高さ34.2cm）で、左脚が欠けています。中が空洞の「中空土偶」で、体は雲のような曲線の文様（雲形文）や縄文で飾られ、赤い顔料が残る例もあります。',
    '土偶は、豊かな実りや安産、病気やけがの回復を願う祈りやまじないに使われたと考えられていますが、本当の使い道はまだわかっていません。手足などがばらばらの状態で見つかることが多く、わざと壊したのではないかという説もあります。',
  ],
  note: 'このゲームの3Dモデルは、遮光器土偶の特徴をもとにプログラムで生成したもので、特定の実物を正確に再現したものではありません（左脚もそろった姿にしています）。',
};
