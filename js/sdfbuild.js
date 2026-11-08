// 距離関数（SDF）で表した立体（土偶・埴輪など回転体でない形）を、
// 中空の殻として格子にサンプリングし、ジグソーパズル状のピースに割る。
//   ・def.sdf(x,y,z)  : 外形の距離関数（負＝内側）
//   ・def.core(x,y,z) : 空洞をつくる部分の距離関数（ここから thickness だけ内側が空洞）
// ピースごとに「殻」と「そのピースの領域」の交わりを Marching Tetrahedra で面にする。
// 隣り合うピースの割れ口は同じ面になるので、組み上げるとぴったり合う。
import * as THREE from 'three';
import { mulberry32, fbm3, hash3i } from './noise.js';

const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];

export function buildSdfPieces(def, { pieceCount, seed, onProgress = () => {}, withWhole = false }) {
  const rng = mulberry32(seed);
  const h = def.voxel;
  const [x0, y0, z0] = def.bounds.min, [x1, y1, z1] = def.bounds.max;
  const NX = Math.ceil((x1 - x0) / h) + 1, NY = Math.ceil((y1 - y0) / h) + 1, NZ = Math.ceil((z1 - z0) / h) + 1;
  const N = NX * NY * NZ;
  const id = (i, j, k) => (k * NY + j) * NX + i;
  const t = def.thickness;

  // ---------- サンプリング ----------
  const S = new Float32Array(N);   // 外形
  const SH = new Float32Array(N);  // 殻（負＝土がある）
  const outerDom = new Uint8Array(N);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const x = x0 + i * h, y = y0 + j * h, z = z0 + k * h;
    const n = id(i, j, k);
    const s = def.sdf(x, y, z);
    S[n] = s;
    if (s > 3 * h) { SH[n] = s; outerDom[n] = 1; continue; }
    const inner = -(def.core(x, y, z) + t);
    SH[n] = Math.max(s, inner);
    outerDom[n] = s >= inner ? 1 : 0;
  }
  onProgress(0.3);

  // ---------- ピース分け（ゆがませたボロノイ） ----------
  const solid = [];
  for (let n = 0; n < N; n++) if (SH[n] < 0) solid.push(n);
  const nS = solid.length;
  const wp = new Float32Array(nS * 3);
  const o = seed % 997;
  for (let q = 0; q < nS; q++) {
    const n = solid[q];
    const i = n % NX, j = ((n - i) / NX) % NY, k = Math.floor(n / (NX * NY));
    const x = x0 + i * h, y = y0 + j * h, z = z0 + k * h;
    const f = 3.5, A = 0.06;
    wp[q * 3] = x + A * fbm3(x * f + o, y * f, z * f, 3);
    wp[q * 3 + 1] = y + A * fbm3(x * f, y * f + o + 17, z * f, 3);
    wp[q * 3 + 2] = z + A * fbm3(x * f + 31, y * f, z * f + o, 3);
  }
  const K = pieceCount;
  const seeds = [];
  const minD = new Float32Array(nS).fill(1e9);
  let pick = Math.floor(rng() * nS);
  for (let s = 0; s < K; s++) {
    seeds.push([wp[pick * 3], wp[pick * 3 + 1], wp[pick * 3 + 2]]);
    const [sx, sy, sz] = seeds[s];
    let best = -1, bi = 0;
    for (let q = 0; q < nS; q++) {
      const d = (wp[q * 3] - sx) ** 2 + (wp[q * 3 + 1] - sy) ** 2 + (wp[q * 3 + 2] - sz) ** 2;
      if (d < minD[q]) minD[q] = d;
      if (minD[q] > best) { best = minD[q]; bi = q; }
    }
    pick = bi;
  }
  const label = new Int16Array(N).fill(-1);
  for (let iter = 0; iter < 6; iter++) {
    const acc = seeds.map(() => [0, 0, 0, 0]);
    for (let q = 0; q < nS; q++) {
      const x = wp[q * 3], y = wp[q * 3 + 1], z = wp[q * 3 + 2];
      let bd = 1e9, bk = 0;
      for (let s = 0; s < K; s++) {
        const sd = seeds[s];
        const d = (x - sd[0]) ** 2 + (y - sd[1]) ** 2 + (z - sd[2]) ** 2;
        if (d < bd) { bd = d; bk = s; }
      }
      label[solid[q]] = bk;
      const a = acc[bk]; a[0] += x; a[1] += y; a[2] += z; a[3]++;
    }
    if (iter < 5) acc.forEach((a, s) => { if (a[3]) seeds[s] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  onProgress(0.45);

  // 6近傍
  const nb = (n, out) => {
    out.length = 0;
    const i = n % NX, j = ((n - i) / NX) % NY, k = Math.floor(n / (NX * NY));
    if (i > 0) out.push(n - 1); if (i < NX - 1) out.push(n + 1);
    if (j > 0) out.push(n - NX); if (j < NY - 1) out.push(n + NX);
    if (k > 0) out.push(n - NX * NY); if (k < NZ - 1) out.push(n + NX * NY);
    return out;
  };
  // 離れ小島になった欠片は隣のピースへ
  const tmp = [];
  for (let pass = 0; pass < 3; pass++) {
    const comp = new Int32Array(N).fill(-1);
    const size = [], lab = [];
    for (const n0 of solid) {
      if (comp[n0] >= 0) continue;
      const c = size.length, L = label[n0];
      let sz = 0; const st = [n0]; comp[n0] = c;
      while (st.length) {
        const x = st.pop(); sz++;
        for (const m of nb(x, tmp)) if (SH[m] < 0 && comp[m] < 0 && label[m] === L) { comp[m] = c; st.push(m); }
      }
      size.push(sz); lab.push(L);
    }
    const best = new Map();
    size.forEach((sz, c) => { const L = lab[c]; if (!best.has(L) || size[best.get(L)] < sz) best.set(L, c); });
    let changed = 0;
    for (const n of solid) if (best.get(label[n]) !== comp[n]) { label[n] = -2; changed++; }
    if (!changed) break;
    for (let guard = 0; guard < 200 && changed > 0; guard++) {
      let prog = 0;
      for (const n of solid) {
        if (label[n] !== -2) continue;
        for (const m of nb(n, tmp)) if (SH[m] < 0 && label[m] >= 0) { label[n] = label[m]; prog++; changed--; break; }
      }
      if (!prog) break;
    }
    for (const n of solid) if (label[n] === -2) label[n] = 0;
  }
  // 殻の外側の格子点にも、いちばん近い土のラベルを広げる（割れ口の補間用）
  let front = solid.slice();
  for (let r = 0; r < 3; r++) {
    const next = [];
    for (const n of front) for (const m of nb(n, tmp)) if (label[m] === -1) { label[m] = label[n]; next.push(m); }
    front = next;
  }
  onProgress(0.55);

  // ---------- ピースごとの面 ----------
  const used = [...new Set(solid.map((n) => label[n]))].sort((a, b) => a - b);
  const adjRaw = new Map(used.map((L) => [L, new Set()]));
  for (const n of solid) for (const m of nb(n, tmp)) if (SH[m] < 0 && label[m] !== label[n]) adjRaw.get(label[n]).add(label[m]);

  const pieces = [];
  const gradSH = (n, out, a) => {
    const i = n % NX, j = ((n - i) / NX) % NY, k = Math.floor(n / (NX * NY));
    const g = (d, lo, hi) => (lo && hi ? (SH[n + d] - SH[n - d]) / (2 * h) : hi ? (SH[n + d] - SH[n]) / h : (SH[n] - SH[n - d]) / h);
    out[0] += a * g(1, i > 0, i < NX - 1);
    out[1] += a * g(NX, j > 0, j < NY - 1);
    out[2] += a * g(NX * NY, k > 0, k < NZ - 1);
  };

  used.forEach((L, pi) => {
    // 範囲
    let bi0 = NX, bj0 = NY, bk0 = NZ, bi1 = 0, bj1 = 0, bk1 = 0;
    for (const n of solid) {
      if (label[n] !== L) continue;
      const i = n % NX, j = ((n - i) / NX) % NY, k = Math.floor(n / (NX * NY));
      if (i < bi0) bi0 = i; if (i > bi1) bi1 = i; if (j < bj0) bj0 = j; if (j > bj1) bj1 = j; if (k < bk0) bk0 = k; if (k > bk1) bk1 = k;
    }
    const pad = 3;
    bi0 = Math.max(0, bi0 - pad); bj0 = Math.max(0, bj0 - pad); bk0 = Math.max(0, bk0 - pad);
    bi1 = Math.min(NX - 1, bi1 + pad); bj1 = Math.min(NY - 1, bj1 + pad); bk1 = Math.min(NZ - 1, bk1 + pad);
    const LX = bi1 - bi0 + 1, LY = bj1 - bj0 + 1, LZ = bk1 - bk0 + 1, LN = LX * LY * LZ;
    const lid = (i, j, k) => (k * LY + j) * LX + i;
    // 所属の指標をぼかして、なめらかな割れ口にする
    let A = new Float32Array(LN), B = new Float32Array(LN);
    for (let k = 0; k < LZ; k++) for (let j = 0; j < LY; j++) for (let i = 0; i < LX; i++) {
      A[lid(i, j, k)] = label[id(i + bi0, j + bj0, k + bk0)] === L ? 1 : 0;
    }
    for (let rep = 0; rep < 2; rep++) {
      for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        for (let k = 0; k < LZ; k++) for (let j = 0; j < LY; j++) for (let i = 0; i < LX; i++) {
          const c = lid(i, j, k);
          const ia = i - di, ja = j - dj, ka = k - dk, ib = i + di, jb = j + dj, kb = k + dk;
          const a = ia >= 0 && ja >= 0 && ka >= 0 ? A[lid(ia, ja, ka)] : A[c];
          const b = ib < LX && jb < LY && kb < LZ ? A[lid(ib, jb, kb)] : A[c];
          B[c] = (a + A[c] + b) / 3;
        }
        [A, B] = [B, A];
      }
    }
    const F = new Float32Array(LN);
    for (let c = 0; c < LN; c++) F[c] = (0.5 - A[c]) * h * 3;
    const field = (i, j, k) => {
      const f = F[lid(i - bi0, j - bj0, k - bk0)];
      const s = SH[id(i, j, k)];
      return f > s ? f : s;
    };
    const gradF = (i, j, k, out, a) => {
      const li = i - bi0, lj = j - bj0, lk = k - bk0, c = lid(li, lj, lk);
      const g = (d, lo, hi) => (lo && hi ? (F[c + d] - F[c - d]) / (2 * h) : hi ? (F[c + d] - F[c]) / h : (F[c] - F[c - d]) / h);
      out[0] += a * g(1, li > 0, li < LX - 1);
      out[1] += a * g(LX, lj > 0, lj < LY - 1);
      out[2] += a * g(LX * LY, lk > 0, lk < LZ - 1);
    };

    const pos = [], nor = [], col = [], msk = [];
    const avgN = new THREE.Vector3();
    const vals = new Float32Array(8), gi = new Int32Array(8), gj = new Int32Array(8), gk = new Int32Array(8);
    const vtx = (ca, cb, outP, outN, info) => {
      const va = vals[ca], vb = vals[cb];
      const tt = va / (va - vb);
      const ia = gi[ca], ja = gj[ca], ka = gk[ca], ib = gi[cb], jb = gj[cb], kb = gk[cb];
      outP[0] = x0 + (ia + (ib - ia) * tt) * h;
      outP[1] = y0 + (ja + (jb - ja) * tt) * h;
      outP[2] = z0 + (ka + (kb - ka) * tt) * h;
      const na = id(ia, ja, ka), nbb = id(ib, jb, kb);
      const fa = F[lid(ia - bi0, ja - bj0, ka - bk0)], fb = F[lid(ib - bi0, jb - bj0, kb - bk0)];
      const fI = fa + (fb - fa) * tt, sI = SH[na] + (SH[nbb] - SH[na]) * tt;
      outN[0] = outN[1] = outN[2] = 0;
      if (fI > sI) { gradF(ia, ja, ka, outN, 1 - tt); gradF(ib, jb, kb, outN, tt); info.type = 2; }
      else {
        gradSH(na, outN, 1 - tt); gradSH(nbb, outN, tt);
        info.type = (tt < 0.5 ? outerDom[na] : outerDom[nbb]) ? 0 : 1;
      }
      const l = Math.hypot(outN[0], outN[1], outN[2]) || 1;
      outN[0] /= l; outN[1] /= l; outN[2] /= l;
    };
    const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], Nn = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const info = [{ type: 0 }, { type: 0 }, { type: 0 }, { type: 0 }];
    const emit = (a, b, c) => {
      const pa = P[a], pb = P[b], pc = P[c];
      const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
      const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-18) return;
      const sx = Nn[a][0] + Nn[b][0] + Nn[c][0], sy = Nn[a][1] + Nn[b][1] + Nn[c][1], sz = Nn[a][2] + Nn[b][2] + Nn[c][2];
      const order = cx * sx + cy * sy + cz * sz >= 0 ? [a, b, c] : [a, c, b];
      // 三角形の種類（外面・内面・割れ口）は多数決
      const ty = [info[a].type, info[b].type, info[c].type];
      // 割れ口は3頂点とも割れ口のときだけ（外面との境目に明るい線が出ないように）
      const surf = ty.filter((v) => v !== 2);
      const tri = surf.length === 0 ? 2 : surf.filter((v) => v === 0).length >= surf.length / 2 ? 0 : 1;
      const cc = tri === 0 ? def.clayColor : tri === 1 ? def.innerColor : def.fractureColor;
      for (const v of order) {
        pos.push(P[v][0], P[v][1], P[v][2]);
        nor.push(Nn[v][0], Nn[v][1], Nn[v][2]);
        const jit = 0.9 + 0.2 * hash3i(Math.floor(P[v][0] * 300), Math.floor(P[v][1] * 300), Math.floor(P[v][2] * 300));
        col.push(cc[0] * jit, cc[1] * jit, cc[2] * jit);
        msk.push(tri === 0 ? 1 : 0);
        if (tri === 0) { avgN.x += Nn[v][0]; avgN.y += Nn[v][1]; avgN.z += Nn[v][2]; }
      }
    };
    for (let k = bk0; k < bk1; k++) for (let j = bj0; j < bj1; j++) for (let i = bi0; i < bi1; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) {
        const ii = i + CORNER[c][0], jj = j + CORNER[c][1], kk = k + CORNER[c][2];
        gi[c] = ii; gj[c] = jj; gk[c] = kk;
        const v = field(ii, jj, kk);
        vals[c] = v === 0 ? 1e-7 : v;
        if (vals[c] < 0) neg++;
      }
      if (neg === 0 || neg === 8) continue;
      for (const tet of TETS) {
        const ins = [], outs = [];
        for (const c of tet) (vals[c] < 0 ? ins : outs).push(c);
        if (ins.length === 0 || ins.length === 4) continue;
        if (ins.length === 1 || ins.length === 3) {
          const lone = ins.length === 1 ? ins[0] : outs[0];
          const others = ins.length === 1 ? outs : ins;
          for (let q = 0; q < 3; q++) vtx(lone, others[q], P[q], Nn[q], info[q]);
          emit(0, 1, 2);
        } else {
          const [a, b] = ins, [c, d] = outs;
          vtx(a, c, P[0], Nn[0], info[0]); vtx(a, d, P[1], Nn[1], info[1]);
          vtx(b, d, P[2], Nn[2], info[2]); vtx(b, c, P[3], Nn[3], info[3]);
          emit(0, 1, 2); emit(0, 2, 3);
        }
      }
    }
    if (!pos.length) return;
    // 中心
    const center = new THREE.Vector3();
    let cnt = 0;
    for (const n of solid) if (label[n] === L) {
      const i = n % NX, j = ((n - i) / NX) % NY, k = Math.floor(n / (NX * NY));
      center.x += x0 + i * h; center.y += y0 + j * h; center.z += z0 + k * h; cnt++;
    }
    center.divideScalar(cnt);
    const P32 = new Float32Array(pos), O32 = new Float32Array(pos);
    for (let q = 0; q < P32.length; q += 3) { P32[q] -= center.x; P32[q + 1] -= center.y; P32[q + 2] -= center.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P32, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    g.setAttribute('opos', new THREE.BufferAttribute(O32, 3));
    g.setAttribute('pmask', new THREE.BufferAttribute(new Float32Array(msk), 1));
    g.computeBoundingSphere();
    if (avgN.lengthSq() < 1e-8) avgN.set(0, 0, 1);
    avgN.normalize();
    let minY = Infinity;
    for (let q = 1; q < pos.length; q += 3) if (pos[q] < minY) minY = pos[q];
    pieces.push({ label: L, geometry: g, center, avgNormal: avgN, cellCount: cnt, minY });
    onProgress(0.55 + 0.45 * (pi + 1) / used.length);
  });

  // ---------- 割れていない完成形（タイトル画面と完成後に見せる） ----------
  let whole = null;
  if (withWhole) {
    const pos = [], nor = [], col = [], msk = [];
    const vals = new Float32Array(8), gi = new Int32Array(8), gj = new Int32Array(8), gk = new Int32Array(8);
    const P = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], Nn = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], ty = [0, 0, 0, 0];
    const vtx = (ca, cb, q) => {
      const va = vals[ca], vb = vals[cb], tt = va / (va - vb);
      const ia = gi[ca], ja = gj[ca], ka = gk[ca], ib = gi[cb], jb = gj[cb], kb = gk[cb];
      P[q][0] = x0 + (ia + (ib - ia) * tt) * h;
      P[q][1] = y0 + (ja + (jb - ja) * tt) * h;
      P[q][2] = z0 + (ka + (kb - ka) * tt) * h;
      const na = id(ia, ja, ka), nbb = id(ib, jb, kb);
      const g = [0, 0, 0];
      gradSH(na, g, 1 - tt); gradSH(nbb, g, tt);
      const l = Math.hypot(g[0], g[1], g[2]) || 1;
      Nn[q][0] = g[0] / l; Nn[q][1] = g[1] / l; Nn[q][2] = g[2] / l;
      ty[q] = (tt < 0.5 ? outerDom[na] : outerDom[nbb]) ? 0 : 1;
    };
    const emit = (a, b, c) => {
      const pa = P[a], pb = P[b], pc = P[c];
      const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2];
      const vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = pc[2] - pa[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * cx + cy * cy + cz * cz < 1e-18) return;
      const sx = Nn[a][0] + Nn[b][0] + Nn[c][0], sy = Nn[a][1] + Nn[b][1] + Nn[c][1], sz = Nn[a][2] + Nn[b][2] + Nn[c][2];
      const order = cx * sx + cy * sy + cz * sz >= 0 ? [a, b, c] : [a, c, b];
      const tri = ty[a] + ty[b] + ty[c] <= 1 ? 0 : 1;
      const cc = tri === 0 ? def.clayColor : def.innerColor;
      for (const v of order) {
        pos.push(P[v][0], P[v][1], P[v][2]);
        nor.push(Nn[v][0], Nn[v][1], Nn[v][2]);
        const jit = 0.9 + 0.2 * hash3i(Math.floor(P[v][0] * 300), Math.floor(P[v][1] * 300), Math.floor(P[v][2] * 300));
        col.push(cc[0] * jit, cc[1] * jit, cc[2] * jit);
        msk.push(tri === 0 ? 1 : 0);
      }
    };
    for (let k = 0; k < NZ - 1; k++) for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) {
        const ii = i + CORNER[c][0], jj = j + CORNER[c][1], kk = k + CORNER[c][2];
        gi[c] = ii; gj[c] = jj; gk[c] = kk;
        const v = SH[id(ii, jj, kk)];
        vals[c] = v === 0 ? 1e-7 : v;
        if (vals[c] < 0) neg++;
      }
      if (neg === 0 || neg === 8) continue;
      for (const tet of TETS) {
        const ins = [], outs = [];
        for (const c of tet) (vals[c] < 0 ? ins : outs).push(c);
        if (ins.length === 0 || ins.length === 4) continue;
        if (ins.length === 1 || ins.length === 3) {
          const lone = ins.length === 1 ? ins[0] : outs[0];
          const others = ins.length === 1 ? outs : ins;
          for (let q = 0; q < 3; q++) vtx(lone, others[q], q);
          emit(0, 1, 2);
        } else {
          const [a, b] = ins, [c, d] = outs;
          vtx(a, c, 0); vtx(a, d, 1); vtx(b, d, 2); vtx(b, c, 3);
          emit(0, 1, 2); emit(0, 2, 3);
        }
      }
    }
    whole = new THREE.BufferGeometry();
    whole.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    whole.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
    whole.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    whole.setAttribute('opos', new THREE.BufferAttribute(new Float32Array(pos), 3));
    whole.setAttribute('pmask', new THREE.BufferAttribute(new Float32Array(msk), 1));
    whole.computeBoundingSphere();
  }

  // いちばん下（足）のピースを 0 番に
  pieces.sort((a, b) => a.minY - b.minY);
  const remap = new Map(pieces.map((p, n) => [p.label, n]));
  pieces.forEach((p, n) => {
    p.id = n;
    p.adj = new Set([...adjRaw.get(p.label)].filter((a) => remap.has(a)).map((a) => remap.get(a)));
  });
  return { pieces, whole };
}

// 外面に文様（凹凸と色）を描くマテリアル。文様は def.patternGLSL で定義する。
//   float patH(vec3 p) : 高さ（ワールド単位の小さな値）
//   vec3 patC(vec3 p, float h) : 色の倍率
export function makePatternMaterial(def) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    if (def.patternUniforms) Object.assign(sh.uniforms, def.patternUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 opos;\nattribute float pmask;\nvarying vec3 vOpos;\nvarying float vPmask;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOpos = opos;\nvPmask = pmask;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vOpos;\nvarying float vPmask;\n${def.patternGLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float patHeight = patH(vOpos) * vPmask;
        diffuseColor.rgb *= mix(vec3(1.0), patC(vOpos, patHeight), vPmask);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float dhx = dFdx(patHeight), dhy = dFdy(patHeight);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * ${(def.bumpStrength ?? 1).toFixed(3)});
        }`);
  };
  m.customProgramCacheKey = () => `pattern-${def.id}`;
  return m;
}
