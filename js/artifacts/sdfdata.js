// 3Dデータ（写真から作った立体を、距離の格子に変換してなめらかにしたもの）を読み込む
//   data/<name>-sdf.json : 格子の範囲・大きさ
//   data/<name>-sdf.bin  : 各格子点の、表面までの距離（Int8、内側が負）
export async function loadSdfGrid(name) {
  const base = new URL('./data/', import.meta.url);
  const h = await (await fetch(new URL(`${name}-sdf.json`, base))).json();
  const D = new Int8Array(await (await fetch(new URL(`${name}-sdf.bin`, base))).arrayBuffer());
  const [NX, NY, NZ] = h.dims;
  const v = h.voxel, q = h.quant, [mx, my, mz] = h.min;
  // なめらかに補間した距離
  return function sample(x, y, z) {
    const fx = (x - mx) / v, fy = (y - my) / v, fz = (z - mz) / v;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= NX - 1 || fy >= NY - 1 || fz >= NZ - 1) return 0.06;
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    const tx = fx - i, ty = fy - j, tz = fz - k;
    const at = (a, b, c) => D[((k + c) * NY + (j + b)) * NX + (i + a)];
    const l = (p, r, t) => p + (r - p) * t;
    return l(l(l(at(0, 0, 0), at(1, 0, 0), tx), l(at(0, 1, 0), at(1, 1, 0), tx), ty),
      l(l(at(0, 0, 1), at(1, 0, 1), tx), l(at(0, 1, 1), at(1, 1, 1), tx), ty), tz) / q;
  };
}
