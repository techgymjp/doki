// 回転体（ろくろ成形の器）を厚みのある殻として生成し、ジグソーパズル状のピースに割る。
//
// 器の表面は (u, s) のパラメータ格子で表す。
//   u: 周方向 0..1、s: 断面曲線の弧長 0..1（底の中心 → 口縁 → 突起の先端）
// 格子のセルごとに「土がある／ない」(def.sdf) と「どのピースか」を決め、
// ピースごとに外面・内面・割れ口（側面）のポリゴンを作る。
import * as THREE from 'three';
import { mulberry32, hash3i, fbm3, clamp } from './noise.js';

const TAU = Math.PI * 2;

export function makeProfile(def) {
  // ---------- 断面曲線 ----------
  const curve = new THREE.CatmullRomCurve3(
    def.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
  const LUT = 4000;
  const pts = curve.getSpacedPoints(LUT);
  const PR = new Float32Array(LUT + 1), PY = new Float32Array(LUT + 1);
  const NR = new Float32Array(LUT + 1), NY = new Float32Array(LUT + 1);
  for (let k = 0; k <= LUT; k++) { PR[k] = Math.max(0, pts[k].x); PY[k] = pts[k].y; }
  for (let k = 0; k <= LUT; k++) {
    const a = Math.max(0, k - 1), b = Math.min(LUT, k + 1);
    let tx = PR[b] - PR[a], ty = PY[b] - PY[a];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    NR[k] = ty; NY[k] = -tx; // 外向き法線
  }
  NR[0] = 0; NY[0] = -1;
  function prof(s) {
    const f = clamp(s, 0, 1) * LUT;
    const k = Math.min(LUT - 1, Math.floor(f)), t = f - k;
    const nr = NR[k] + (NR[k + 1] - NR[k]) * t, ny = NY[k] + (NY[k + 1] - NY[k]) * t;
    const nl = Math.hypot(nr, ny) || 1;
    return {
      r: PR[k] + (PR[k + 1] - PR[k]) * t,
      y: PY[k] + (PY[k + 1] - PY[k]) * t,
      nr: nr / nl, ny: ny / nl,
    };
  }
  function sAt(cond) {
    for (let k = 0; k <= LUT; k++) if (cond(PR[k], PY[k])) return k / LUT;
    return 1;
  }

  return { prof, sAt };
}

export function buildShell(def, { pieceCount, seed, onProgress = () => {} }) {
  const rng = mulberry32(seed);

  const { prof, sAt } = makeProfile(def);

  // ---------- 行（s 方向）の分割 ----------
  const sRows = [0];
  let sPrev = 0;
  const zoneStartRow = [];
  for (const z of def.rows) {
    const sEnd = z.until === 'end' ? 1 : sAt(z.until);
    zoneStartRow.push(sRows.length - 1);
    for (let j = 1; j <= z.rows; j++) sRows.push(sPrev + (sEnd - sPrev) * (j / z.rows));
    sPrev = sEnd;
  }
  const NU = def.NU, NS = sRows.length - 1, NU1 = NU + 1;
  const bottomRows = def.rows[0].rows;

  const sdfUS = def.sdf ? (u, s) => { const p = prof(s); return def.sdf(u, p.y, p.r); } : null;

  // ---------- セル：土の有無 ----------
  const nCells = NU * NS;
  const solid = new Uint8Array(nCells);
  for (let j = 0; j < NS; j++) {
    const sc = (sRows[j] + sRows[j + 1]) / 2;
    for (let i = 0; i < NU; i++) {
      const d = sdfUS ? sdfUS((i + 0.5) / NU, sc) : -1;
      solid[j * NU + i] = d < 0 ? 1 : 0;
    }
  }
  const cellSolid = (i, j) => {
    if (j < 0 || j >= NS) return false;
    i = ((i % NU) + NU) % NU;
    return solid[j * NU + i] === 1;
  };

  // ---------- 頂点パラメータ（揺らぎ＋輪郭への吸着） ----------
  const nV = NU1 * (NS + 1);
  const VU = new Float32Array(nV), VS = new Float32Array(nV);
  for (let j = 0; j <= NS; j++) {
    const ds = j > 0 && j < NS ? Math.min(sRows[j + 1] - sRows[j], sRows[j] - sRows[j - 1]) : 0;
    for (let i = 0; i <= NU; i++) {
      const iw = i % NU;
      let u = i / NU, s = sRows[j];
      if (j > 0 && j < NS) {
        u += (hash3i(iw, j, 11) - 0.5) * 0.55 / NU;
        s += (hash3i(iw, j, 23) - 0.5) * 0.55 * ds;
      }
      VU[j * NU1 + i] = u; VS[j * NU1 + i] = s;
    }
  }
  if (sdfUS) {
    for (let j = 1; j < NS; j++) {
      const dsRow = sRows[j + 1] - sRows[j];
      for (let i = 0; i < NU; i++) {
        let anyS = false, anyE = false;
        for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          if (cellSolid(i + di, j + dj)) anyS = true; else anyE = true;
        }
        if (!(anyS && anyE)) continue;
        const idx = j * NU1 + i;
        let u = VU[idx], s = VS[idx];
        const eu = 0.25 / NU, es = 0.25 * dsRow;
        for (let it = 0; it < 3; it++) {
          const f = sdfUS(u, s);
          const gu = (sdfUS(u + eu, s) - sdfUS(u - eu, s)) / (2 * eu);
          const gs = (sdfUS(u, s + es) - sdfUS(u, s - es)) / (2 * es);
          const g2 = gu * gu + gs * gs;
          if (g2 < 1e-12) break;
          u -= f * gu / g2; s -= f * gs / g2;
        }
        u = clamp(u, i / NU - 0.6 / NU, i / NU + 0.6 / NU);
        s = clamp(s, sRows[j] - 0.6 * dsRow, sRows[j] + 0.6 * dsRow);
        VU[idx] = u; VS[idx] = s;
        if (i === 0) { VU[j * NU1 + NU] = u + 1; VS[j * NU1 + NU] = s; }
      }
    }
  }
  onProgress(0.15);

  // ---------- 頂点位置 ----------
  const PO = new Float32Array(nV * 3), PI = new Float32Array(nV * 3), PN = new Float32Array(nV * 3);
  for (let idx = 0; idx < nV; idx++) {
    const u = VU[idx], s = VS[idx];
    const p = prof(s);
    const th = TAU * u, sx = Math.sin(th), cz = Math.cos(th);
    const bx = p.r * sx, by = p.y, bz = p.r * cz;
    const nx = p.nr * sx, ny = p.ny, nz = p.nr * cz;
    const h = p.r > 1e-4 ? def.relief(u, p.y, p.r, true) : 0;
    const t = def.thickness(u, p.y, p.r);
    PO[idx * 3] = bx + nx * h; PO[idx * 3 + 1] = by + ny * h; PO[idx * 3 + 2] = bz + nz * h;
    PI[idx * 3] = bx - nx * t; PI[idx * 3 + 1] = by - ny * t; PI[idx * 3 + 2] = bz - nz * t;
    PN[idx * 3] = nx; PN[idx * 3 + 1] = ny; PN[idx * 3 + 2] = nz;
  }
  // 法線（格子の差分。全体で計算するので組み上げると継ぎ目が見えない）
  function gridNormals(P, sign) {
    const N = new Float32Array(nV * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const get = (i, j, v) => {
      if (i < 0) i += NU; if (i > NU) i -= NU;
      const k = (j * NU1 + i) * 3; return v.set(P[k], P[k + 1], P[k + 2]);
    };
    const tmp1 = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    for (let j = 0; j <= NS; j++) for (let i = 0; i <= NU; i++) {
      const idx = j * NU1 + i;
      if (j === 0) { N[idx * 3 + 1] = -sign; continue; }
      get(i + 1, j, tmp1); get(i - 1, j, tmp2); a.subVectors(tmp1, tmp2);
      get(i, Math.min(NS, j + 1), tmp1); get(i, j - 1, tmp2); b.subVectors(tmp1, tmp2);
      c.crossVectors(a, b);
      if (c.lengthSq() < 1e-14) c.set(PN[idx * 3], PN[idx * 3 + 1], PN[idx * 3 + 2]);
      c.normalize();
      const d = c.x * PN[idx * 3] + c.y * PN[idx * 3 + 1] + c.z * PN[idx * 3 + 2];
      if (d * sign < 0) c.negate();
      N[idx * 3] = c.x; N[idx * 3 + 1] = c.y; N[idx * 3 + 2] = c.z;
    }
    return N;
  }
  const NO = gridNormals(PO, 1), NI = gridNormals(PI, -1);
  onProgress(0.3);

  // ---------- ピース分け ----------
  const label = new Int16Array(nCells).fill(-1);
  const cpos = new Float32Array(nCells * 3);
  for (let j = 0; j < NS; j++) for (let i = 0; i < NU; i++) {
    const c = j * NU + i;
    if (!solid[c]) continue;
    let x = 0, y = 0, z = 0;
    for (const k of [j * NU1 + i, j * NU1 + i + 1, (j + 1) * NU1 + i, (j + 1) * NU1 + i + 1]) {
      x += PO[k * 3]; y += PO[k * 3 + 1]; z += PO[k * 3 + 2];
    }
    x /= 4; y /= 4; z /= 4;
    // 割れ線をギザギザにするための領域ゆがみ
    const f = 3.2, A = 0.07, o = seed % 1000;
    cpos[c * 3] = x + A * fbm3(x * f + o, y * f, z * f, 3);
    cpos[c * 3 + 1] = y + A * fbm3(x * f, y * f + o + 17, z * f, 3);
    cpos[c * 3 + 2] = z + A * fbm3(x * f + 31, y * f, z * f + o, 3);
  }
  // 底部ピース（ラベル0）：底と胴のいちばん下
  const baseH = def.baseHeight ?? 0.08;
  for (let j = 0; j < NS; j++) for (let i = 0; i < NU; i++) {
    const c = j * NU + i;
    if (!solid[c]) continue;
    if (j < bottomRows || cpos[c * 3 + 1] < baseH) label[c] = 0;
  }
  const free = [];
  for (let c = 0; c < nCells; c++) if (solid[c] && label[c] < 0) free.push(c);
  const K = pieceCount - 1;
  // 最遠点サンプリングで種を置く
  const seeds = [];
  const minD = new Float32Array(free.length).fill(1e9);
  let pick = free[Math.floor(rng() * free.length)];
  for (let k = 0; k < K; k++) {
    seeds.push([cpos[pick * 3], cpos[pick * 3 + 1], cpos[pick * 3 + 2]]);
    let best = -1, bi = 0;
    const [sx, sy, sz] = seeds[k];
    for (let n = 0; n < free.length; n++) {
      const c = free[n];
      const d = (cpos[c * 3] - sx) ** 2 + (cpos[c * 3 + 1] - sy) ** 2 + (cpos[c * 3 + 2] - sz) ** 2;
      if (d < minD[n]) minD[n] = d;
      if (minD[n] > best) { best = minD[n]; bi = c; }
    }
    pick = bi;
  }
  // ロイド緩和でピースの大きさをそろえる
  for (let iter = 0; iter < 5; iter++) {
    const acc = seeds.map(() => [0, 0, 0, 0]);
    for (const c of free) {
      const x = cpos[c * 3], y = cpos[c * 3 + 1], z = cpos[c * 3 + 2];
      let bd = 1e9, bk = 0;
      for (let k = 0; k < K; k++) {
        const s = seeds[k];
        const d = (x - s[0]) ** 2 + (y - s[1]) ** 2 + (z - s[2]) ** 2;
        if (d < bd) { bd = d; bk = k; }
      }
      label[c] = bk + 1;
      const a = acc[bk]; a[0] += x; a[1] += y; a[2] += z; a[3]++;
    }
    if (iter < 4) acc.forEach((a, k) => { if (a[3]) seeds[k] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
  }
  onProgress(0.45);

  // 連結でない欠片は隣のピースへ吸収
  const neighbors = (c) => {
    const i = c % NU, j = (c - i) / NU;
    const out = [j * NU + (i + 1) % NU, j * NU + (i + NU - 1) % NU];
    if (j > 0) out.push(c - NU);
    if (j < NS - 1) out.push(c + NU);
    return out;
  };
  for (let pass = 0; pass < 3; pass++) {
    const comp = new Int32Array(nCells).fill(-1);
    const compSize = [], compLabel = [];
    for (let c = 0; c < nCells; c++) {
      if (!solid[c] || comp[c] >= 0) continue;
      const id = compSize.length, L = label[c];
      let size = 0; const stack = [c]; comp[c] = id;
      while (stack.length) {
        const x = stack.pop(); size++;
        for (const n of neighbors(x)) if (solid[n] && comp[n] < 0 && label[n] === L) { comp[n] = id; stack.push(n); }
      }
      compSize.push(size); compLabel.push(L);
    }
    const bestComp = new Map();
    compSize.forEach((sz, id) => {
      const L = compLabel[id];
      if (!bestComp.has(L) || compSize[bestComp.get(L)] < sz) bestComp.set(L, id);
    });
    let changed = 0;
    for (let c = 0; c < nCells; c++) if (solid[c] && bestComp.get(label[c]) !== comp[c]) { label[c] = -2; changed++; }
    if (!changed) break;
    let left = changed;
    while (left > 0) {
      let progress = 0;
      for (let c = 0; c < nCells; c++) {
        if (label[c] !== -2) continue;
        for (const n of neighbors(c)) if (solid[n] && label[n] >= 0) { label[c] = label[n]; progress++; left--; break; }
      }
      if (!progress) { for (let c = 0; c < nCells; c++) if (label[c] === -2) label[c] = 0; break; }
    }
  }
  onProgress(0.55);

  // ---------- ピースのジオメトリ ----------
  const nP = K + 1;
  const cellsOf = Array.from({ length: nP }, () => []);
  for (let c = 0; c < nCells; c++) if (solid[c] && label[c] >= 0) cellsOf[label[c]].push(c);
  const adj = Array.from({ length: nP }, () => new Set());

  const vmapO = new Int32Array(nV).fill(-1), vmapI = new Int32Array(nV).fill(-1);
  const pieces = [];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();

  for (let p = 0; p < nP; p++) {
    const cells = cellsOf[p];
    if (!cells.length) continue;
    const pos = [], nor = [], uv = [], col = [];
    const idxO = [], idxI = [];
    const touched = [];
    const avgN = new THREE.Vector3();
    const vColInner = def.innerColor, vColFrac = def.fractureColor, vColEdge = def.edgeColor;
    const addGridVert = (k, inner) => {
      const map = inner ? vmapI : vmapO;
      if (map[k] >= 0) return map[k];
      const P = inner ? PI : PO, N = inner ? NI : NO;
      const id = pos.length / 3;
      pos.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
      nor.push(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]);
      uv.push(VU[k], VS[k]);
      const v = 0.85 + 0.3 * hash3i(k, 3, 7);
      const cc = inner ? vColInner : [1, 1, 1];
      col.push(cc[0] * v, cc[1] * v, cc[2] * v);
      map[k] = id; touched.push(k);
      if (!inner) { avgN.x += N[k * 3]; avgN.y += N[k * 3 + 1]; avgN.z += N[k * 3 + 2]; }
      return id;
    };
    const wallPos = [], wallNor = [], wallCol = [];
    const addWall = (ka, kb, cellCenter, isFracture) => {
      const oa = [PO[ka * 3], PO[ka * 3 + 1], PO[ka * 3 + 2]];
      const ob = [PO[kb * 3], PO[kb * 3 + 1], PO[kb * 3 + 2]];
      const ia = [PI[ka * 3], PI[ka * 3 + 1], PI[ka * 3 + 2]];
      const ib = [PI[kb * 3], PI[kb * 3 + 1], PI[kb * 3 + 2]];
      vA.fromArray(oa); vB.fromArray(ob); vC.fromArray(ib);
      e1.subVectors(vB, vA); e2.subVectors(vC, vA); nrm.crossVectors(e1, e2);
      if (nrm.lengthSq() < 1e-16) { vC.fromArray(ia); e2.subVectors(vC, vA); nrm.crossVectors(e1, e2); }
      if (nrm.lengthSq() < 1e-16) return;
      const mid = vA.clone().add(vB).multiplyScalar(0.5).sub(cellCenter);
      let quad = [oa, ob, ib, ia];
      if (nrm.dot(mid) < 0) { quad = [ob, oa, ia, ib]; nrm.negate(); }
      nrm.normalize();
      const cc = isFracture ? vColFrac : vColEdge;
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const q of t) {
        wallPos.push(...quad[q]); wallNor.push(nrm.x, nrm.y, nrm.z);
        const v = isFracture ? 0.85 + 0.3 * hash3i(Math.floor(quad[q][0] * 900), Math.floor(quad[q][1] * 900), Math.floor(quad[q][2] * 900)) : 1;
        wallCol.push(cc[0] * v, cc[1] * v, cc[2] * v);
      }
    };
    const center = new THREE.Vector3();
    for (const c of cells) {
      const i = c % NU, j = (c - i) / NU;
      const k00 = j * NU1 + i, k10 = k00 + 1, k01 = k00 + NU1, k11 = k01 + 1;
      const o00 = addGridVert(k00, false), o10 = addGridVert(k10, false), o01 = addGridVert(k01, false), o11 = addGridVert(k11, false);
      const i00 = addGridVert(k00, true), i10 = addGridVert(k10, true), i01 = addGridVert(k01, true), i11 = addGridVert(k11, true);
      if (j > 0) { idxO.push(o00, o10, o11); idxI.push(i00, i11, i10); }
      idxO.push(o00, o11, o01); idxI.push(i00, i01, i11);
      const cc = new THREE.Vector3(
        (PO[k00 * 3] + PO[k11 * 3]) / 2, (PO[k00 * 3 + 1] + PO[k11 * 3 + 1]) / 2, (PO[k00 * 3 + 2] + PO[k11 * 3 + 2]) / 2);
      center.add(cc);
      const edges = [
        [(i + NU - 1) % NU, j, k00, k01],
        [(i + 1) % NU, j, k10, k11],
        [i, j - 1, k00, k10],
        [i, j + 1, k01, k11],
      ];
      for (const [ni, nj, ka, kb] of edges) {
        if (nj < 0) continue;
        const nc = nj * NU + ni;
        const nSolid = nj < NS && solid[nc];
        if (nSolid && label[nc] === p) continue;
        if (nSolid) adj[p].add(label[nc]);
        addWall(ka, kb, cc, nSolid);
      }
    }
    center.divideScalar(cells.length);
    for (const k of touched) { vmapO[k] = -1; vmapI[k] = -1; }

    // まとめる：グループ0=外面, グループ1=内面＋割れ口
    const nGrid = pos.length / 3;
    const allPos = new Float32Array(pos.length + wallPos.length);
    allPos.set(pos); allPos.set(wallPos, pos.length);
    for (let q = 0; q < allPos.length; q += 3) { allPos[q] -= center.x; allPos[q + 1] -= center.y; allPos[q + 2] -= center.z; }
    const allNor = new Float32Array(nor.length + wallNor.length); allNor.set(nor); allNor.set(wallNor, nor.length);
    const allCol = new Float32Array(col.length + wallCol.length); allCol.set(col); allCol.set(wallCol, col.length);
    const allUv = new Float32Array(allPos.length / 3 * 2); allUv.set(uv);
    const nWall = wallPos.length / 3;
    const index = new Uint32Array(idxO.length + idxI.length + nWall);
    index.set(idxO); index.set(idxI, idxO.length);
    for (let w = 0; w < nWall; w++) index[idxO.length + idxI.length + w] = nGrid + w;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(allNor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(allUv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(allCol, 3));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.addGroup(0, idxO.length, 0);
    g.addGroup(idxO.length, idxI.length + nWall, 1);
    g.computeBoundingSphere();
    if (avgN.lengthSq() < 1e-8) avgN.set(0, -1, 0);
    avgN.normalize();
    pieces.push({ id: p, geometry: g, center, avgNormal: avgN, cellCount: cells.length, adj: adj[p] });
    onProgress(0.55 + 0.3 * (p + 1) / nP);
  }
  // 再番号付け（空のピースがあった場合に備えて）
  const remap = new Map(pieces.map((pc, n) => [pc.id, n]));
  pieces.forEach((pc, n) => { pc.adj = new Set([...pc.adj].filter((a) => remap.has(a)).map((a) => remap.get(a))); pc.id = n; });

  return { pieces, prof };
}

// 外面のテクスチャ（色＋凹凸）を (u, s) 空間に描く
export function paintShellTextures(def, prof, { width = 2048, height = 1024 } = {}) {
  const colorCv = document.createElement('canvas');
  const bumpCv = document.createElement('canvas');
  colorCv.width = bumpCv.width = width; colorCv.height = bumpCv.height = height;
  const cimg = colorCv.getContext('2d').createImageData(width, height);
  const bimg = bumpCv.getContext('2d').createImageData(width, height);
  // 低解像度の周期ノイズ
  const NW = 256, NH = 128;
  const noise = [new Float32Array(NW * NH), new Float32Array(NW * NH), new Float32Array(NW * NH)];
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
    const a = (x / NW) * TAU, s = y / NH;
    const cx = Math.cos(a) * 1.6, cz = Math.sin(a) * 1.6;
    noise[0][y * NW + x] = fbm3(cx * 1.4, s * 9, cz * 1.4, 4);
    noise[1][y * NW + x] = fbm3(cx * 0.8 + 9, s * 4, cz * 0.8, 3);
    noise[2][y * NW + x] = fbm3(cx * 4 + 3, s * 26, cz * 4, 2);
  }
  const ns = [0, 0, 0];
  const sampleNoise = (u, s) => {
    const fx = u * NW, fy = clamp(s, 0, 0.9999) * (NH - 1);
    const x0 = Math.floor(fx) % NW, x1 = (x0 + 1) % NW, y0 = Math.floor(fy), y1 = Math.min(NH - 1, y0 + 1);
    const tx = fx - Math.floor(fx), ty = fy - y0;
    for (let n = 0; n < 3; n++) {
      const N = noise[n];
      const a = N[y0 * NW + x0] + (N[y0 * NW + x1] - N[y0 * NW + x0]) * tx;
      const b = N[y1 * NW + x0] + (N[y1 * NW + x1] - N[y1 * NW + x0]) * tx;
      ns[n] = a + (b - a) * ty;
    }
    return ns;
  };
  const out = [0, 0, 0];
  for (let ty = 0; ty < height; ty++) {
    const s = 1 - (ty + 0.5) / height;
    const p = prof(s);
    for (let tx = 0; tx < width; tx++) {
      const u = (tx + 0.5) / width;
      const h = p.r > 1e-3 ? def.relief(u, p.y, p.r, false) : 0;
      def.color(u, p.y, p.r, h, sampleNoise(u, s), hash3i(tx, ty, 5), out);
      const o = (ty * width + tx) * 4;
      cimg.data[o] = clamp(out[0], 0, 1) * 255;
      cimg.data[o + 1] = clamp(out[1], 0, 1) * 255;
      cimg.data[o + 2] = clamp(out[2], 0, 1) * 255;
      cimg.data[o + 3] = 255;
      const b = clamp(0.5 + 0.5 * h / def.reliefMax, 0, 1) * 255;
      bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = b; bimg.data[o + 3] = 255;
    }
  }
  colorCv.getContext('2d').putImageData(cimg, 0, 0);
  bumpCv.getContext('2d').putImageData(bimg, 0, 0);
  return { colorCanvas: colorCv, bumpCanvas: bumpCv };
}
