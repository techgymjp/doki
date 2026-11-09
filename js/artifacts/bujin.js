// 埴輪 挂甲の武人（古墳時代後期・群馬県太田市出土・国宝）
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
function cone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const h = clamp((px * vx + py * vy + pz * vz) / (vx * vx + vy * vy + vz * vz), 0, 1);
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - (ra + (rb - ra) * h);
}
// 縦向きの円すい台（楕円断面）。y0で半径r0、y1で半径r1。sz は奥行きの比
function frustum(x, y, z, y0, y1, r0, r1, sz = 1, round = 0.008) {
  const t = clamp((y - y0) / (y1 - y0), 0, 1);
  const r = r0 + (r1 - r0) * t;
  const dr = (Math.hypot(x, z / sz) - r) * Math.min(1, sz) + round;
  const dy = Math.abs(y - (y0 + y1) / 2) - Math.abs(y1 - y0) / 2 + round;
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0) - round;
}
function box(x, y, z, cx, cy, cz, hx, hy, hz, r = 0.006) {
  const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}

function torusY(x, y, z, cx, cy, cz, R, r) {
  return Math.hypot(Math.hypot(x - cx, z - cz) - R, y - cy) - r;
}
// 写真：円筒の台の上に立つ。下からズボン状の脚、段になった草摺、小札の胴、肩甲、頬当つきの冑
function procCore(x, y, z) {
  const ax = Math.abs(x);
  let d = frustum(x, y, z, -0.3, 0.18, 0.16, 0.155, 1.0);                     // 円筒の台
  d = smin(d, cone(ax, y, z, 0.085, 0.16, 0.0, 0.088, 0.44, 0.0, 0.07, 0.08), 0.03);  // ゆったりした脚
  d = smin(d, frustum(x, y, z, 0.4, 0.63, 0.225, 0.16, 0.8), 0.03);            // 草摺
  d = smin(d, frustum(x, y, z, 0.6, 0.96, 0.15, 0.155, 0.78), 0.03);           // 胴
  d = smin(d, ell(x, y, z, 0, 1.13, 0.005, 0.085, 0.1, 0.09), 0.03);           // 頭
  return d;
}

function procSdf(x, y, z) {
  const ax = Math.abs(x);
  let d = core(x, y, z);
  // 台の上下のふちの帯
  d = Math.min(d, torusY(x, y, z, 0, 0.035, 0, 0.158, 0.012));
  d = Math.min(d, torusY(x, y, z, 0, 0.17, 0, 0.152, 0.01));
  // 台の上にのる足
  d = smin(d, ell(ax, y, z, 0.09, 0.2, 0.04, 0.06, 0.03, 0.085), 0.02);
  // 臑当（すねあて）：すねを包む広い筒、縦の合わせ目
  d = Math.min(d, cone(ax, y, z, 0.09, 0.2, 0.0, 0.09, 0.32, 0.0, 0.088, 0.09));
  // 膝甲（ひざよろい）：草摺の下から広がるひざの防具
  d = Math.min(d, cone(ax, y, z, 0.092, 0.33, 0.0, 0.095, 0.43, 0.0, 0.1, 0.092));
  d = Math.min(d, torusY(ax, y, z, 0.09, 0.325, 0, 0.096, 0.01));
  // 草摺：3段に重なり、段ごとにくっきりした段差
  for (const [y0, y1, r0, r1] of [[0.4, 0.475, 0.232, 0.215], [0.47, 0.55, 0.212, 0.195], [0.545, 0.62, 0.192, 0.172]]) {
    d = Math.min(d, frustum(x, y, z, y0, y1, r0, r1, 0.8, 0.004));
  }
  // 肩甲：肩をおおう板が3枚重なる（下の板ほど外へ広がる）
  for (let k = 0; k < 3; k++) {
    const sh = cone(ax, y, z, 0.12, 0.96 - k * 0.035, 0, 0.225 + k * 0.012, 0.86 - k * 0.04, 0, 0.07 + k * 0.006, 0.088 + k * 0.008);
    d = Math.min(d, Math.max(sh, -(sh + 0.016), 0.9 - k * 0.035 - y + (ax - 0.12) * 0.6));
  }
  d = smin(d, cone(ax, y, z, 0.12, 0.95, 0, 0.215, 0.83, 0, 0.07, 0.08), 0.03);
  // 腕と籠手：右腕（-x）は曲げて体の前で大刀の柄をにぎり、左腕（+x）は下げて弓と大刀を持つ
  d = smin(d, cone(x, y, z, -0.22, 0.86, 0.0, -0.24, 0.7, 0.04, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, -0.24, 0.7, 0.04, -0.06, 0.62, 0.16, 0.04, 0.034), 0.02);
  d = Math.min(d, cone(x, y, z, -0.2, 0.68, 0.08, -0.1, 0.635, 0.135, 0.047, 0.044));   // 籠手
  d = smin(d, ell(x, y, z, -0.05, 0.615, 0.17, 0.035, 0.035, 0.035), 0.015);            // 右手
  d = smin(d, cone(x, y, z, 0.22, 0.86, 0.0, 0.25, 0.7, 0.04, 0.045, 0.04), 0.03);
  d = smin(d, cone(x, y, z, 0.25, 0.7, 0.04, 0.2, 0.58, 0.13, 0.04, 0.034), 0.02);
  d = Math.min(d, cone(x, y, z, 0.245, 0.68, 0.06, 0.215, 0.61, 0.11, 0.047, 0.044));  // 籠手
  d = Math.min(d, cone(x, y, z, 0.212, 0.6, 0.118, 0.205, 0.585, 0.125, 0.045, 0.045)); // 鞆（とも：手首のまるい防具）
  d = smin(d, ell(x, y, z, 0.195, 0.565, 0.14, 0.035, 0.035, 0.035), 0.015);           // 左手
  // 弓：左手で持ち、体の左わきに縦に立てる（腕のうしろ）
  const bowZ = 0.06 + 0.04 * (1 - Math.pow((y - 0.66) / 0.55, 2));
  d = Math.min(d, Math.max(Math.hypot(x - 0.29, z - bowZ) - 0.017, Math.abs(y - 0.66) - 0.55));
  // 大刀：右手で柄を、左手でさやを持ち、腰の前に横たえる（柄頭に輪）
  d = Math.min(d, cone(x, y, z, -0.1, 0.625, 0.17, -0.02, 0.61, 0.175, 0.021, 0.022));  // 柄
  d = Math.min(d, Math.hypot(Math.hypot(x + 0.125, y - 0.63) - 0.022, z - 0.17) - 0.008);   // 環頭
  d = Math.min(d, cone(x, y, z, -0.02, 0.61, 0.175, 0.0, 0.607, 0.176, 0.032, 0.032));   // つば
  d = Math.min(d, cone(x, y, z, 0.0, 0.607, 0.176, 0.27, 0.55, 0.15, 0.026, 0.023));     // さや
  // 靫
  d = smin(d, box(x, y, z, 0.07, 0.83, -0.155, 0.075, 0.13, 0.03, 0.02), 0.02);
  d = smin(d, box(x, y, z, 0.07, 0.99, -0.16, 0.06, 0.04, 0.025, 0.015), 0.02);
  // 腰の帯（角ばった帯）
  d = Math.min(d, frustum(x, y, z, 0.6, 0.645, 0.17, 0.167, 0.8, 0.003));
  // 胸の蝶結び（冑のひもの結び目）
  for (const [kx, ky, kz] of [[0, 0.905, 0.122], [-0.02, 0.78, 0.15]]) {
    for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(Math.hypot(x - kx - sx * 0.022, y - ky) - 0.016, z - kz) - 0.006);
    d = Math.min(d, cone(x, y, z, kx - 0.012, ky - 0.005, kz, kx - 0.03, ky - 0.045, kz, 0.006, 0.006));
    d = Math.min(d, cone(x, y, z, kx + 0.012, ky - 0.005, kz, kx + 0.03, ky - 0.045, kz, 0.006, 0.006));
  }
  // 首
  d = smin(d, cone(x, y, z, 0, 0.95, 0, 0, 1.05, 0, 0.065, 0.06), 0.02);
  // 冑：はち＋衝角＋鋲の列
  d = smin(d, ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115), 0.02);
  d = smin(d, cone(x, y, z, 0, 1.235, 0.02, 0, 1.2, 0.15, 0.025, 0.012), 0.02);
  d = Math.max(d, y - 1.29);
  // 冑の縦の帯（前・左右）と、下のふちの帯
  for (const ang of [0, -1.0, 1.0]) {
    const cx = Math.sin(ang), cz = Math.cos(ang);
    const along = x * cx + z * cz, side = x * cz - z * cx;
    const band = Math.max(Math.abs(side) - 0.013, Math.abs(ell(x, y, z, 0, 1.19, -0.005, 0.105, 0.085, 0.115)) - 0.007, 1.17 - y, -along);
    d = Math.min(d, band);
  }
  d = Math.min(d, Math.max(Math.abs(ell(x, y, z, 0, 1.19, -0.005, 0.112, 0.09, 0.122)) - 0.006, Math.abs(y - 1.17) - 0.012));
  for (const ang of [-1.2, -0.6, 0, 0.6, 1.2, Math.PI]) {
    for (let k = 0; k < 4; k++) {
      const el = 0.25 + k * 0.33;                                // 下から上へ
      const px = Math.sin(ang) * Math.cos(el) * 0.105, py = 1.19 + Math.sin(el) * 0.085, pz = -0.005 + Math.cos(ang) * Math.cos(el) * 0.115;
      d = Math.min(d, Math.hypot(x - px, y - py, z - pz) - 0.011);
    }
  }
  // 頬当：顔の両わきに長く垂れ、あごの下まで回りこむ板（格子の段つき）
  let ho = frustum(x, y, z, 1.18, 1.0, 0.113, 0.13, 0.95, 0.01);
  ho = Math.max(ho, -frustum(x, y, z, 1.2, 0.98, 0.095, 0.112, 0.95, 0.01));
  ho = Math.max(ho, -box(x, y, z, 0, 1.08, 0.16, 0.062, 0.12, 0.1, 0.02));     // 顔の前はあける
  d = Math.min(d, ho);
  // 目と口：くり抜き、鼻
  d = Math.max(d, -box(ax, y, z, 0.033, 1.125, 0.1, 0.02, 0.006, 0.06, 0.005));
  d = Math.max(d, -box(x, y, z, 0, 1.065, 0.095, 0.018, 0.005, 0.06, 0.004));
  d = smin(d, ell(x, y, z, 0, 1.095, 0.09, 0.013, 0.025, 0.018), 0.008);
  return Math.max(d, -y);
}
// 形はご提供の3Dデータ（写真から作った立体）をなめらかにしたもの
import { loadSdfGrid } from './sdfdata.js';
let dataSdf = null;
async function prepare() {
  /* 形は写真をもとに作るので、3Dデータは読み込まない */
}
// 3Dデータの表面にそって浮き出る細い帯（よろいの段など）
function rib(dd, along, w, h) { return Math.max(Math.abs(dd - h) - h, Math.abs(along) - w); }

// 頭部（写真をもとに作り込む）：衝角付冑・鋲・頬当と錣・顔（3Dデータの頭の位置と大きさに合わせる）
function head(x, y, z) {
  const hx = x + 0.01, ax = Math.abs(hx);
  // 顔：幅広で平らな、角の丸い顔（頬当の内側に少し引っこむ）
  // 丸みのある卵形の顔（正面は少し平ら）
  let d = Math.max(ell(hx, y, z, 0, 1.165, 0.035, 0.056, 0.078, 0.06), z - 0.088 - 0.25 * (hx * hx) / 0.003 * 0.003);
  // 細い目（つり上がらない、ほぼ水平の切れ目）
  // 鼻：眉間から下へのび、先ほど高く前に出る鼻（稜線は丸い）
  d = smin(d, cone(hx, y, z, 0, 1.205, 0.082, 0, 1.152, 0.112, 0.008, 0.016), 0.008);
  d = smin(d, ell(hx, y, z, 0, 1.152, 0.1, 0.02, 0.012, 0.016), 0.006);
  // 口：短い横の切れ目
  // 冑のはち：上半分の丸いはちと、下のふちのひさし
  const bowlE = ell(hx, y, z, 0, 1.235, 0.0, 0.09, 0.088, 0.098);
  d = Math.min(d, Math.max(bowlE, 1.235 - y));
  d = Math.min(d, Math.hypot(Math.hypot(hx / 0.094, z / 0.102) * 0.098 - 0.098, y - 1.238) - 0.009);
  // 縦の帯（前の中央）と衝角
  d = Math.min(d, Math.max(Math.abs(bowlE) - 0.006, ax - 0.012, 1.24 - y, -z));
  d = smin(d, cone(hx, y, z, 0, 1.31, 0.055, 0, 1.25, 0.1, 0.012, 0.009), 0.01);
  // 鋲：はちの表面に小さな丸いこぶを等間隔に（縦の帯の上と、ひさしの上の一列）
  for (const ang of [-1.15, 0, 1.15, Math.PI]) {
    for (let k = 0; k < 4; k++) {
      const el = 0.25 + k * 0.33;
      const px = Math.sin(ang) * Math.cos(el) * 0.092, py = 1.235 + Math.sin(el) * 0.09, pz = Math.cos(ang) * Math.cos(el) * 0.1;
      d = Math.min(d, Math.hypot(hx - px, y - py, z - pz) - 0.0055);
    }
  }
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    d = Math.min(d, Math.hypot(hx - Math.sin(ang) * 0.1, y - 1.247, z - Math.cos(ang) * 0.108) - 0.0048);
  }
  // 頬当：はちのふちから顔の両わきに垂れ、前へ回りこむ板。前のふちは太く丸め、外側に格子の桟（さん）
  {
    const sh = ell(hx, y, z, 0, 1.16, 0.015, 0.108, 0.125, 0.102);
    const inGuard = Math.max(y - 1.236, 1.06 - y, 0.058 - ax);
    let g = Math.max(Math.abs(sh + 0.007) - 0.007, inGuard);
    d = Math.min(d, g);
    // 前のふち（太く丸いへり）：板の前の切り口に沿って
    const edge = Math.max(Math.abs(ax - 0.064) - 0.009, Math.abs(sh + 0.006) - 0.012, y - 1.236, 1.06 - y, -z);
    d = Math.min(d, edge);
    // すそのへり
    d = Math.min(d, Math.max(Math.abs(y - 1.066) - 0.008, Math.abs(sh + 0.006) - 0.012, 0.058 - ax));
    // 格子の桟：横4本・縦2本（板の外側に浮き出る）
    // 桟は丸い断面のひも（表面にそって浮かせ、なめらかに）
    const surf = Math.abs(sh + 0.0005);
    for (const yb of [1.115, 1.155, 1.195]) d = smin(d, Math.max(Math.hypot(surf, y - yb) - 0.0055, inGuard + 0.008), 0.004);
    for (const zb of [0.05, -0.005]) d = smin(d, Math.max(Math.hypot(surf, z - zb) - 0.0055, inGuard + 0.008), 0.004);
  }
  // 錣：後ろから首を守る広がった板
  {
    const sh = frustum(hx, y, z, 1.13, 1.06, 0.096, 0.116, 0.98, 0.004);
    d = Math.min(d, Math.max(sh, -(sh + 0.01), z + 0.02));
  }
  // 目と口（最後にくり抜く）
  for (const sx of [-1, 1]) d = Math.max(d, -Math.max(Math.hypot((hx - sx * 0.027) / 2.6, y - 1.2) - 0.006, 0.065 - z));
  d = Math.max(d, -Math.max(Math.hypot(hx / 3.4, y - 1.128) - 0.0055, 0.065 - z));

  return d;
}

// ---- 体：写真の比率に合わせて作る（台 0〜0.29、臑当 0.32〜0.54、もも 0.53〜0.63、草摺 0.62〜0.87、胴 0.86〜1.06、頭 1.07〜1.34）----
const torus = (x, y, z, cy, R, r, sz = 1) => Math.hypot(Math.hypot(x, z / sz) - R, y - cy) - r;
function body(x, y, z, hollow) {
  const ax = Math.abs(x);
  let d = frustum(x, y, z, hollow ? -0.3 : 0, 0.29, 0.132, 0.126, 1, 0.012);          // 円筒の台
  d = Math.min(d, cone(ax, y, z, 0.08, 0.3, 0.005, 0.08, 0.545, 0.0, 0.066, 0.07));     // 臑当（すね）
  d = smin(d, ell(ax, y, z, 0.088, 0.58, 0.0, 0.098, 0.078, 0.092), 0.03);              // 膝甲（ふくらんだもも）
  d = smin(d, frustum(x, y, z, 0.62, 0.875, 0.185, 0.112, 0.82, 0.01), 0.02);           // 草摺
  d = smin(d, frustum(x, y, z, 0.86, 1.06, 0.105, 0.112, 0.68, 0.02), 0.03);            // 胴
  d = smin(d, cone(x, y, z, 0, 1.04, 0, 0, 1.1, 0.005, 0.048, 0.045), 0.02);             // 首
  return d;
}
function sdf(x, y, z) {
  const ax = Math.abs(x);
  let d = smin(body(x, y, z, false), head(x, y, z), 0.012);
  // 足（台の上の平たいくつ）
  d = smin(d, ell(ax, y, z, 0.08, 0.305, 0.03, 0.055, 0.025, 0.08), 0.015);
  // 台のふち、臑当の上下の帯、もものすその帯
  d = Math.min(d, torus(x, y, z, 0.285, 0.128, 0.012), torus(x, y, z, 0.02, 0.134, 0.012));
  for (const yb of [0.33, 0.535]) d = Math.min(d, torus(ax - 0.08, y, z, yb, 0.07, 0.009));
  // 草摺のすその帯と、腰の帯
  d = Math.min(d, torus(x, y, z, 0.635, 0.18, 0.012, 0.82), torus(x, y, z, 0.67, 0.172, 0.008, 0.82));
  d = Math.min(d, torus(x, y, z, 0.87, 0.112, 0.012, 0.7));
  // 肩甲：肩から上腕をおおう丸い板（横の段は表面の溝で表す）
  d = smin(d, ell(ax, y, z, 0.135, 0.995, 0.0, 0.062, 0.075, 0.062), 0.03);
  d = Math.min(d, Math.max(Math.abs(ell(ax, y, z, 0.135, 0.995, 0.0, 0.066, 0.079, 0.066)) - 0.004, Math.abs(y - 0.935) - 0.008));
  // ---- 腕・手・大刀・弓：それぞれ独立した部品として組み立てる（写真）----
  // 右腕（向かって左）：上腕 → 籠手（前腕）→ 柄をにぎるこぶし
  d = smin(d, cone(x, y, z, -0.14, 1.0, 0.0, -0.155, 0.93, 0.02, 0.04, 0.037), 0.02);          // 上腕
  d = Math.min(d, cone(x, y, z, -0.156, 0.925, 0.022, -0.135, 0.865, 0.075, 0.041, 0.037));      // 籠手
  d = Math.min(d, cone(x, y, z, -0.157, 0.93, 0.02, -0.155, 0.915, 0.026, 0.046, 0.046));        // 籠手の上の帯
  d = Math.min(d, ell(x, y, z, -0.128, 0.842, 0.098, 0.031, 0.03, 0.034));                      // こぶし
  for (let k = 0; k < 4; k++) d = Math.min(d, cone(x, y, z, -0.15 + k * 0.013, 0.843, 0.128, -0.15 + k * 0.013, 0.82, 0.127, 0.007, 0.007)); // 指
  d = Math.min(d, cone(x, y, z, -0.155, 0.858, 0.115, -0.135, 0.848, 0.13, 0.0075, 0.0065));     // 親指
  // 左腕（向かって右）：上腕 → 籠手 → 鞆 → 腰の上に置いた手
  d = smin(d, cone(x, y, z, 0.14, 1.0, 0.0, 0.16, 0.93, 0.02, 0.04, 0.037), 0.02);             // 上腕
  d = Math.min(d, cone(x, y, z, 0.16, 0.925, 0.025, 0.1, 0.875, 0.1, 0.041, 0.036));           // 籠手
  d = Math.min(d, Math.hypot(Math.hypot(x - 0.105, z - 0.095) - 0.03, (y - 0.878) * 1.3) - 0.016); // 鞆（手首のまるい防具）
  d = Math.min(d, box(x, y, z, 0.062, 0.862, 0.122, 0.036, 0.013, 0.028, 0.009));               // 手の甲
  for (let k = 0; k < 4; k++) d = Math.min(d, cone(x, y, z, 0.03, 0.86 - 0.002 * k, 0.105 + k * 0.011, 0.012, 0.852, 0.105 + k * 0.011, 0.006, 0.0055)); // 指
  // 大刀：柄（こぶしの中を通る）・柄頭の輪・つば・四角いさや（帯つき）。腰の前を向かって右下へ
  const T0 = [-0.175, 0.846, 0.09], T1 = [-0.09, 0.838, 0.118], T2 = [0.19, 0.795, 0.11];
  d = Math.min(d, cone(x, y, z, ...T0, ...T1, 0.015, 0.016));
  d = Math.min(d, Math.hypot(Math.hypot(x + 0.192, y - 0.848) - 0.016, z - 0.087) - 0.006);
  d = Math.min(d, cone(x, y, z, ...T1, -0.081, 0.837, 0.119, 0.03, 0.03));
  {
    const vx = T2[0] - T1[0], vy = T2[1] - T1[1], vz = T2[2] - T1[2], L = Math.hypot(vx, vy, vz);
    const ux = vx / L, uy = vy / L, uz = vz / L;
    const px = x - T1[0], py = y - T1[1], pz = z - T1[2];
    const t = px * ux + py * uy + pz * uz;
    const qx = px - ux * t, qy = py - uy * t, qz = pz - uz * t;
    const along = Math.abs(t - L / 2) - L / 2, hgt = Math.abs(qy) - 0.024, thk = Math.hypot(qx, qz) - 0.013;
    d = Math.min(d, Math.hypot(Math.max(along, 0), Math.max(hgt, 0), Math.max(thk, 0)) + Math.min(Math.max(along, hgt, thk), 0) - 0.004);
    for (const tt of [0.1, 0.42, 0.78]) d = Math.min(d, Math.max(Math.abs(t - L * tt) - 0.006, Math.abs(qy) - 0.028, Math.hypot(qx, qz) - 0.017));
  }
  // 弓：左腕のうしろに立てた平たい板（腰から頭の横まで）
  d = Math.min(d, box(x, y, z, 0.105, 1.04, 0.07, 0.011, 0.3, 0.008, 0.004));
  // 胸の2つの結び目（引合せ）
  for (const yk of [1.02, 0.94]) {
    const zf = 0.078 + 0.004;
    for (const sx of [-1, 1]) d = Math.min(d, Math.hypot(Math.hypot(x - sx * 0.015, y - yk) - 0.01, z - zf) - 0.004);
    d = Math.min(d, cone(x, y, z, -0.008, yk - 0.005, zf, -0.02, yk - 0.03, zf, 0.004, 0.004));
    d = Math.min(d, cone(x, y, z, 0.008, yk - 0.005, zf, 0.02, yk - 0.03, zf, 0.004, 0.004));
  }
  return Math.max(d, -y);
}
const core = (x, y, z) => Math.min(body(x, y, z, true), ell(x + 0.01, y, z, 0, 1.17, 0.0, 0.07, 0.08, 0.07));

// 柄頭の輪（環頭）
function plateRing(x, y, z) {
  const e = Math.abs(Math.hypot(x - 0.06, y - 0.605) - 0.022) - 0.008;
  return Math.hypot(Math.max(e, 0), Math.max(Math.abs(z - 0.17) - 0.01, 0)) + Math.min(Math.max(e, Math.abs(z - 0.17) - 0.01), 0);
}

// 外面：小札（よろいの小さな板）を綴じた線、冑の鋲の列
// 文様は3Dデータの比率（台 0〜0.3、脚 0.33〜0.58、草摺 0.6〜0.77、胴 0.77〜1.11、冑 1.12〜）に合わせて、写真をもとに刻む
const patternGLSL = `
float bjHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bjLine(float d, float w) { float x = abs(d) / w; return x < 1.0 ? 0.5 + 0.5 * cos(3.14159265 * x) : 0.0; }
float bjDot(vec2 q, float r) { return bjLine(length(q), r); }
float bjNoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bjHash(i), bjHash(i + vec3(1,0,0)), f.x), mix(bjHash(i + vec3(0,1,0)), bjHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bjHash(i + vec3(0,0,1)), bjHash(i + vec3(1,0,1)), f.x), mix(bjHash(i + vec3(0,1,1)), bjHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float patH(vec3 p) {
  float h = (bjNoise(p * 60.0) - 0.5) * (p.y > 1.07 ? 0.05 : 0.18);
  float ang = atan(p.x, p.z);
  // 胴・草摺：縦に長い板（小札）の合わせ目と、段の線
  if (p.y > 0.64 && p.y < 1.06 && abs(p.x) < (p.y > 0.88 ? 0.1 : 0.2)) {
    h -= bjLine(fract(ang * 5.0) - 0.5, 0.08) * 1.4;
    if (p.y > 0.88) h -= bjLine(fract((p.y - 0.88) / 0.045) - 0.5, 0.06) * 1.1;
    else h -= bjLine(fract((p.y - 0.68) / 0.05) - 0.5, 0.06) * 1.1;
  }
  // 肩甲：横の段
  if (p.y > 0.93 && p.y < 1.07 && abs(p.x) > 0.09 && abs(p.x) < 0.21) h -= bjLine(fract((p.y - 0.93) / 0.03) - 0.5, 0.1) * 1.4;
  // 臑当：縦の板の合わせ目
  if (p.y > 0.33 && p.y < 0.53) h -= bjLine(fract(atan(abs(p.x) - 0.08, p.z) * 1.4) - 0.5, 0.06) * 1.3;
  return h * 0.0011;
}
vec3 patC(vec3 p, float h) {
  vec3 c = vec3(1.0);
  float n = sin(p.x * 13.0 + 3.0 * sin(p.y * 9.0)) * sin(p.y * 15.0 + p.z * 11.0);
  c *= 0.92 + 0.1 * n;
  c *= 1.0 - clamp(-h / 0.0016, 0.0, 1.0) * 0.25;
  return c;
}
`;

export const bujin = {
  id: 'bujin',
  type: 'sdf',
  name: '挂甲の武人',
  ruby: 'けいこうのぶじん',
  kind: '埴輪',
  era: '古墳時代後期（6世紀）',
  place: '群馬県太田市',
  available: true,
  prepare,
  sdf,
  core,
  thickness: 0.035,
  voxel: 0.0075,
  bounds: { min: [-0.24, -0.02, -0.18], max: [0.24, 1.37, 0.2] },
  height: 1.36,
  clearRadius: 0.5,
  patternGLSL,
  bumpStrength: 1.0,
  clayColor: [0.72, 0.45, 0.3],
  innerColor: [0.5, 0.33, 0.22],
  fractureColor: [0.8, 0.58, 0.42],
  description: [
    '埴輪 挂甲（けいこう）の武人は、群馬県太田市から出土した古墳時代後期（6世紀）の人物埴輪です。高さは130cmをこえ、全身を武装した姿が細かく表されています。1974年に埴輪として初めて国宝に指定され、東京国立博物館に収蔵されています。',
    '小さな鉄の板をひもで綴じ合わせたよろい「挂甲」を着て、前に角のようにつき出た冑（衝角付冑）をかぶっています。左手に弓をもち、右手で腰の大刀の柄をにぎり、背中には矢を入れる靫（ゆぎ）を背負っています。',
    '近年の修理と調査で、もとは赤・白・灰色などで色が塗り分けられていたこともわかりました。当時の武人の装備を知ることができる、とても貴重な資料です。',
  ],
  note: 'このステージの形は、実物の写真から作られた3Dデータをもとにしています（文様は写真を参考に刻んだもの）。正確な実測データではありません。',
};
