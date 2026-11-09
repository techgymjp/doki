// 距離関数の部品（土偶・埴輪用）
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export function smin(a, b, k) {
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
export function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
  const k0 = Math.hypot(px, py, pz);
  const k1 = Math.hypot(px / rx, py / ry, pz / rz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
// 太さが変わるカプセル（長さ0でも安全）
export function cone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const px = x - ax, py = y - ay, pz = z - az, vx = bx - ax, vy = by - ay, vz = bz - az;
  const L = vx * vx + vy * vy + vz * vz;
  const h = L > 1e-12 ? clamp((px * vx + py * vy + pz * vz) / L, 0, 1) : 0;
  return Math.hypot(px - vx * h, py - vy * h, pz - vz * h) - (ra + (rb - ra) * h);
}
// 折れ線にそったカプセル（点の列 [x,y,z]、半径は始点→終点で変化）
export function chain(x, y, z, pts, ra, rb) {
  let d = Infinity;
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const r0 = ra + (rb - ra) * (i / n), r1 = ra + (rb - ra) * ((i + 1) / n);
    d = Math.min(d, cone(x, y, z, ...pts[i], ...pts[i + 1], r0, r1));
  }
  return d;
}
// 縦の円すい台（楕円断面：奥行きの比 sz）
export function frustum(x, y, z, y0, y1, r0, r1, sz = 1, round = 0.008) {
  const t = clamp((y - y0) / (y1 - y0), 0, 1);
  const r = r0 + (r1 - r0) * t;
  const dr = (Math.hypot(x, z / sz) - r) * Math.min(1, sz) + round;
  const dy = Math.abs(y - (y0 + y1) / 2) - Math.abs(y1 - y0) / 2 + round;
  return Math.hypot(Math.max(dr, 0), Math.max(dy, 0)) + Math.min(Math.max(dr, dy), 0) - round;
}
export function torusAxis(px, py, pz, R, r) { // 軸はローカルの z
  return Math.hypot(Math.hypot(px, py) - R, pz) - r;
}
