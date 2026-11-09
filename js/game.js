import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildShell, paintShellTextures, makeProfile } from './shell.js';
import { buildSdfPieces, makePatternMaterial } from './sdfbuild.js';
import { mulberry32 } from './noise.js';
import * as sfx from './audio.js';

const ease = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ステージが進むほど難しくする（難易度は選ばせない）
//   level が上がるほど、はまる判定がきびしくなり、完成形のガイドがうすく→最初は非表示になる
export function levelSettings(level = 1) {
  const lv = Math.max(1, Math.min(10, level));
  return {
    snap: Math.max(0.08, 0.16 - 0.012 * (lv - 1)),
    ghost: lv <= 5,
    ghostStrength: lv <= 3 ? 1 : 0.5,
    slotHint: false,
  };
}

export class Game {
  constructor(container, events = {}) {
    this.container = container;
    this.ev = events;
    this.state = 'idle';
    this.pieces = [];
    this.anims = [];
    this.particles = [];
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.hints = 0;
    this._initScene();
    this._initInput();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  // ---------------- シーン ----------------
  _initScene() {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(r.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x17110d);
    scene.fog = new THREE.Fog(0x17110d, 7, 16);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.06; // フリックで慣性回転
    c.rotateSpeed = 0.9;
    c.enablePan = false;
    c.minDistance = 1.6;
    c.maxDistance = 9;
    c.minPolarAngle = 0.02; // 真上近くまで見下ろせる
    c.maxPolarAngle = Math.PI * 0.49;
    c.target.set(0, 0.62, 0);
    c.autoRotateSpeed = 1.2;

    scene.add(new THREE.HemisphereLight(0xfff0dc, 0x2a1d14, 0.75));
    const key = new THREE.DirectionalLight(0xffe2c0, 2.4);
    key.position.set(2.6, 5, 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 14;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7);
    rim.position.set(-3, 2.5, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffd6a8, 0.35);
    fill.position.set(-2, 1, 3);
    scene.add(fill);

    // 作業台
    const tcv = document.createElement('canvas');
    tcv.width = tcv.height = 512;
    const g = tcv.getContext('2d');
    const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, '#5a4a3a'); grd.addColorStop(0.55, '#3e3127'); grd.addColorStop(1, '#241b15');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,220' : '0,0,0'},${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    g.strokeStyle = 'rgba(230,200,150,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.arc(256, 256, 62, 0, Math.PI * 2); g.stroke();
    g.setLineDash([6, 8]);
    g.beginPath(); g.arc(256, 256, 70, 0, Math.PI * 2); g.stroke();
    const ttex = new THREE.CanvasTexture(tcv);
    ttex.colorSpace = THREE.SRGBColorSpace;
    ttex.anisotropy = 8;
    const table = new THREE.Mesh(new THREE.CircleGeometry(5.5, 96),
      new THREE.MeshStandardMaterial({ map: ttex, roughness: 0.95 }));
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    scene.add(table);

    // はまった時に光らせるライト（数が変わるとシェーダーが作り直されて止まるので、最初から置いておく）
    this.snapLight = new THREE.PointLight(0xffc870, 0, 2.5, 1.5);
    scene.add(this.snapLight);

    this.potGroup = new THREE.Group();
    scene.add(this.potGroup);
    this.ghostGroup = new THREE.Group();
    scene.add(this.ghostGroup);

    this.raycaster = new THREE.Raycaster();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this._applyViewShift();
  }

  // タイトル画面では器をパネルと重ならない位置に寄せて見せる
  setViewShift(x, y) {
    this.viewShift = { x, y };
    this._applyViewShift();
  }
  _applyViewShift() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const vs = this.viewShift || { x: 0, y: 0 };
    if (vs.x || vs.y) this.camera.setViewOffset(w, h, vs.x * w, vs.y * h, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  // 視点の位置（縦長画面ほど遠く・高くして机の上を広く見せる）
  _viewPose(preview) {
    const aspect = this.camera.aspect;
    const k = Math.min(1, Math.max(0.5, aspect * 1.25));
    const dist = (preview ? 3.9 : 4.6) / k;
    const dir = new THREE.Vector3(0, preview ? 0.46 : 0.46 + (1 - k) * 0.7, 1).normalize();
    return new THREE.Vector3(0, 0.62, 0).addScaledVector(dir, dist);
  }

  resetView(animate = true) {
    const to = this._viewPose(this.state === 'preview');
    if (!animate) { this.camera.position.copy(to); this.controls.target.set(0, 0.62, 0); return; }
    const from = this.camera.position.clone();
    const tFrom = this.controls.target.clone();
    this._camAnim = { from, to, tFrom, tTo: new THREE.Vector3(0, 0.62, 0), t: 0 };
  }

  // ---------------- 出土品の読み込み ----------------
  async load(def, onProgress = () => {}) {
    this.def = def;
    await nextFrame();
    if (def.prepare) await def.prepare();
    if (def.type === 'sdf') {
      this.materials = [makePatternMaterial(def)];
    } else {
      const tex = paintShellTextures(def, makeProfile(def).prof);
      const colorTex = new THREE.CanvasTexture(tex.colorCanvas);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      const bumpTex = new THREE.CanvasTexture(tex.bumpCanvas);
      for (const t of [colorTex, bumpTex]) {
        t.wrapS = THREE.RepeatWrapping;
        t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }
      this.materials = [
        new THREE.MeshStandardMaterial({ map: colorTex, bumpMap: bumpTex, bumpScale: 2.2, roughness: 0.9, metalness: 0 }),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
      ];
    }
    onProgress(0.4);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x6e5a44, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    if (def.type === 'sdf') this.ghostMat.opacity = 0.1;
    this.ghostBaseOpacity = this.ghostMat.opacity;
    this.slotMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.35, depthWrite: false });
    await nextFrame();
    if (this.wholeMesh) { this.potGroup.remove(this.wholeMesh); this.wholeMesh.geometry.dispose(); this.wholeMesh = null; }
    this._build(def.pieces || 12, (Math.random() * 1e9) | 0, (p) => onProgress(0.4 + 0.6 * p));
  }

  _build(count, seed, onProgress = () => {}) {
    for (const p of this.pieces) { this.potGroup.remove(p.mesh); p.mesh.geometry.dispose(); }
    this.ghostGroup.clear();
    this.pieceCount = count;
    this.seed = seed;
    const builder = this.def.type === 'sdf' ? buildSdfPieces : buildShell;
    const { pieces, whole } = builder(this.def, { pieceCount: count, seed, onProgress, withWhole: !this.wholeMesh });
    if (whole) {
      // 割れ目のない完成形（タイトル画面と完成後に使う）
      const m0 = this.materials[0], m = m0.clone();
      m.onBeforeCompile = m0.onBeforeCompile;
      m.customProgramCacheKey = m0.customProgramCacheKey;
      this.wholeMesh = new THREE.Mesh(whole, m);
      this.wholeMesh.castShadow = true;
      this.wholeMesh.receiveShadow = true;
      this.potGroup.add(this.wholeMesh);
    }
    const rng = mulberry32(seed ^ 0x5bd1e995);
    this.pieces = pieces.map((pc) => {
      const mats = this.materials.map((m) => {
        const c = m.clone();
        c.onBeforeCompile = m.onBeforeCompile;
        c.customProgramCacheKey = m.customProgramCacheKey;
        return c;
      });
      const mesh = new THREE.Mesh(pc.geometry, mats.length === 1 ? mats[0] : mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.copy(pc.center);
      mesh.userData.pieceId = pc.id;
      this.potGroup.add(mesh);
      const ghost = new THREE.Mesh(pc.geometry, this.ghostMat);
      ghost.position.copy(pc.center);
      this.ghostGroup.add(ghost);
      // 地面に接するピースか（足・底など）
      const pa = pc.geometry.attributes.position;
      let minY = Infinity;
      for (let q = 1; q < pa.array.length; q += 3) if (pa.array[q] < minY) minY = pa.array[q];
      const grounded = pc.center.y + minY < 0.02;
      return { ...pc, mesh, mats, placed: true, rest: null, rng, grounded };
    });
    this._computeRestPoses(rng);
    this.ghostGroup.visible = false;
  }

  _computeRestPoses(rng) {
    const placedSpots = [];
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion(), qy = new THREE.Quaternion(), v = new THREE.Vector3();
    // 大きいピースから置く
    // プレイ中の視点（resetView と同じ）
    const cam = this.camera.clone();
    cam.clearViewOffset();
    cam.position.copy(this._viewPose(false));
    cam.lookAt(0, 0.62, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const order = [...this.pieces].sort((a, b) => b.geometry.boundingSphere.radius - a.geometry.boundingSphere.radius);
    for (const p of order) {
      // 外面を上にして寝かせる（底のピースはそのまま立てる）
      if (p.id === 0) q.identity();
      else q.setFromUnitVectors(p.avgNormal, up);
      qy.setFromAxisAngle(up, rng() * Math.PI * 2);
      const rot = qy.clone().multiply(q);
      const pos = p.geometry.attributes.position;
      let minY = Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyQuaternion(rot);
        if (v.y < minY) minY = v.y;
      }
      const rad = p.geometry.boundingSphere.radius * 0.85;
      let best = null;
      for (let tries = 0; tries < 800; tries++) {
        const ang = (rng() * 2 - 1) * Math.PI * (tries < 200 ? 0.7 : 1);
        const R = (this.def.clearRadius ?? 0.65) + 0.3 + rad + rng() * (0.9 + tries * 0.003);
        const x = Math.sin(ang) * R, z = Math.cos(ang) * R;
        // プレイ中の視点で画面内（ボタンにかからない範囲）に見えること
        const gap = tries < 300 ? 1 : Math.max(0.55, 1 - (tries - 300) / 500);
        if (tries < 780) {
          v.set(x, 0.05, z).project(cam);
          const portrait = cam.aspect < 0.9;
          const mx = portrait ? 0.8 - rad * 0.6 : Math.min(0.92, 0.92 - rad * 0.25), top = portrait ? 0.45 : 0.55;
          if (Math.abs(v.x) > mx || v.y < (portrait ? -0.6 : -0.78) || v.y > top) continue;
        }
        if (placedSpots.every((s) => Math.hypot(s.x - x, s.z - z) > (s.r + rad) * gap)) { best = { x, z }; break; }
      }
      if (!best) { const a = rng() * Math.PI * 2; best = { x: Math.sin(a) * 3.2, z: Math.cos(a) * 3.2 }; }
      placedSpots.push({ ...best, r: rad });
      p.rest = { pos: new THREE.Vector3(best.x, -minY + 0.003, best.z), quat: rot };
    }
  }

  // ---------------- 状態遷移 ----------------
  // 完成形を見せる（true）か、ピースを見せる（false）か
  _setWhole(on) {
    if (!this.wholeMesh) return;
    this.wholeMesh.visible = on;
    for (const p of this.pieces) p.mesh.visible = !on;
  }

  showPreview() {
    this.state = 'preview';
    this._setWhole(true);
    this._clearAnims();
    this.potGroup.rotation.set(0, 0, 0);
    for (const p of this.pieces) {
      p.placed = true;
      p.mesh.position.copy(p.center);
      p.mesh.quaternion.identity();
      this._setGlow(p, 0x000000);
    }
    this.ghostGroup.visible = false;
    this.controls.autoRotate = true;
    this.resetView(false);
  }

  start() {
    this.diff = levelSettings(this.def.level);
    this.ghostMat.opacity = this.ghostBaseOpacity * this.diff.ghostStrength;
    const seed = (Math.random() * 1e9) | 0;
    this._build(this.def.pieces || 12, seed);
    this._setWhole(true);
    for (const p of this.pieces) { p.mesh.position.copy(p.center); p.mesh.quaternion.identity(); }
    this.controls.autoRotate = false;
    this.state = 'breaking';
    this.elapsed = 0;
    this.hints = 0;
    this._shatter();
  }

  _shatter() {
    const t0 = performance.now();
    // ひび → 割れる
    this._shake = { t0, dur: 650 };
    setTimeout(() => {
      sfx.playBreak();
      this._setWhole(false);
      this._dust(new THREE.Vector3(0, 0.6, 0), 120, 0xd9c2a0, 1.8);
      for (const p of this.pieces) {
        p.placed = false;
        const out = p.center.clone().setY(0).normalize().multiplyScalar(0.6 + p.rng() * 0.6);
        const axis = new THREE.Vector3(p.rng() - 0.5, p.rng() - 0.5, p.rng() - 0.5).normalize();
        this._animate(p, {
          toPos: p.rest.pos, toQuat: p.rest.quat,
          dur: 1100 + p.rng() * 700, delay: p.rng() * 120,
          arc: 0.5 + p.rng() * 0.9, bulge: out, spinAxis: axis, spin: (p.rng() * 2 - 1) * 9,
          easing: (t) => 1 - Math.pow(1 - t, 2),
        });
      }
      setTimeout(() => {
        this.state = 'playing';
        this.ghostGroup.visible = this.diff.ghost;
        this.ev.onGhost?.(this.ghostGroup.visible);
        this.clock.getDelta();
        this.ev.onStart?.();
        this._emitCount();
      }, 1900);
    }, 650);
    this.ev.onBreaking?.();
  }

  // ---------------- 入力 ----------------
  _initInput() {
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    this.pointer = new THREE.Vector2();
    el.addEventListener('pointerdown', (e) => this._down(e), { capture: true });
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointercancel', (e) => this._up(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _ray(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray;
  }

  _down(e) {
    if (this.state !== 'playing' || this.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cand = this.pieces.filter((p) => !p.placed).map((p) => p.mesh);
    // 指でも掴みやすいよう、少し外れた所も探す
    const tol = e.pointerType === 'mouse' ? 8 : 18;
    let hit = null;
    for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      this._ray({ clientX: e.clientX + ox * tol, clientY: e.clientY + oy * tol });
      hit = this.raycaster.intersectObjects(cand, false)[0];
      if (hit) break;
    }
    if (!hit) return;
    const p = this.pieces[hit.object.userData.pieceId];
    this.controls.enabled = false;
    this._clearAnim(p);
    const normal = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
    this.drag = {
      p, plane, pointerId: e.pointerId,
      offset: p.mesh.position.clone().sub(hit.point).multiplyScalar(0.4),
      q0: p.mesh.quaternion.clone(), t0: performance.now(), magnet: false,
      goal: p.mesh.position.clone(),
    };
    try { this.renderer.domElement.setPointerCapture(e.pointerId); } catch { /* noop */ }
    sfx.playPick();
    this._setGlow(p, 0x2a1c0c);
    if (this.diff.slotHint) this._showSlot(p);
    this.ev.onDrag?.(true);
  }

  _move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const ray = this._ray(e);
    const hit = ray.intersectPlane(d.plane, new THREE.Vector3());
    if (!hit) return;
    const pos = hit.add(d.offset);
    // カメラからピースへの視線が、正しい位置の近くを通っているか
    const C = this.camera.position;
    const dir = pos.clone().sub(C).normalize();
    const v = d.p.center.clone().sub(C);
    const along = v.dot(dir);
    const lineDist = v.clone().addScaledVector(dir, -along).length();
    const snap = this.diff.snap;
    const wasMagnet = d.magnet;
    d.magnet = along > 0 && lineDist < (wasMagnet ? snap * 1.25 : snap);
    if (d.magnet) {
      d.goal.copy(d.p.center);
      if (!wasMagnet) {
        const ok = this._placeable(d.p);
        this._setGlow(d.p, ok ? 0x1d6a2a : 0x6a1d12);
      }
    } else {
      d.goal.copy(pos);
      if (wasMagnet) this._setGlow(d.p, 0x2a1c0c);
    }
  }

  _up(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    this.controls.enabled = true;
    this._hideSlot();
    this.ev.onDrag?.(false);
    const p = d.p;
    if (d.magnet && this._placeable(p)) {
      this._place(p);
      return;
    }
    if (d.magnet) {
      sfx.playDeny();
      this.ev.onToast?.(this._placedCount() === 0
        ? 'まずは底や足のピースから！'
        : 'つながるピースから先にはめよう');
    }
    this._setGlow(p, 0x000000);
    // 机の上に置く。器の上や遠すぎる所で離したときは元の場所に戻す
    const ray = this._ray(e);
    const tp = new THREE.Vector3();
    if (ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tp)) {
      const r = Math.hypot(tp.x, tp.z);
      const minR = (this.def.clearRadius ?? 0.65) + 0.25 + p.geometry.boundingSphere.radius * 0.6;
      // 器のうしろに隠れる場所かどうか（視線が器の円柱を通るか）
      let hidden = false;
      const q = new THREE.Vector3();
      for (let k = 1; k < 40; k++) {
        q.lerpVectors(ray.origin, tp, k / 40);
        if (q.y < 1.45 && Math.hypot(q.x, q.z) < (this.def.clearRadius ?? 0.65)) { hidden = true; break; }
      }
      if (!hidden && r > minR && r < 4.2) p.rest.pos.set(tp.x, p.rest.pos.y, tp.z);
    }
    this._animate(p, { toPos: p.rest.pos, toQuat: p.rest.quat, dur: 420, arc: 0.15, easing: easeInOut });
  }

  _placedCount() { return this.pieces.filter((p) => p.placed).length; }

  // 一番下から順に：地面に接するピース（底・足）はいつでも置ける。
  // それ以外は、すでにはまったピースと接しているものだけ
  _placeable(p) {
    if (p.grounded) return true;
    // どのピースともつながらない離れた欠片は、いつでも置ける（手詰まり防止）
    if (!p.adj || p.adj.size === 0) return true;
    for (const a of p.adj) if (this.pieces[a].placed) return true;
    return false;
  }

  _place(p) {
    p.placed = true;
    this._animate(p, { toPos: p.center, toQuat: new THREE.Quaternion(), dur: 160, easing: ease, onDone: () => {
      sfx.playSnap(this._placedCount() / this.pieces.length);
      this._dust(p.center.clone(), 28, 0xe8d4b0, 0.6);
      this._dust(p.center.clone(), 40, 0xffd772, 0.9, { additive: true, size: 0.045, gravity: 0.6, life: 1.1 });
      this._burst(p.center.clone());
      this._flash(p);
      this._emitCount();
      if (this.pieces.every((q) => q.placed)) this._complete();
    } });
  }

  _complete() {
    this.state = 'complete';
    this.ev.onFinish?.();
    this.ghostGroup.visible = false;
    setTimeout(() => {
      // つなぎ目を消して、割れ目のない姿に
      this._setWhole(true);
      this._burst(new THREE.Vector3(0, 0.7, 0));
      sfx.playComplete();
      this._dust(new THREE.Vector3(0, 0.8, 0), 160, 0xffd77a, 2.2);
      this.controls.autoRotate = true;
      this.resetView(true);
    }, 300);
    setTimeout(() => this.ev.onComplete?.({ time: this.elapsed, hints: this.hints, pieces: this.pieces.length }), 1700);
  }

  _emitCount() {
    this.ev.onCount?.(this._placedCount(), this.pieces.length);
  }

  // ---------------- 補助 ----------------
  toggleGhost() {
    if (this.state !== 'playing') return this.ghostGroup.visible;
    this.ghostGroup.visible = !this.ghostGroup.visible;
    return this.ghostGroup.visible;
  }

  hint() {
    if (this.state !== 'playing') return;
    const cands = this.pieces.filter((p) => !p.placed && this._placeable(p));
    if (!cands.length) return;
    cands.sort((a, b) => a.center.y - b.center.y);
    const p = cands[0];
    this.hints++;
    this._showSlot(p);
    p.hintUntil = performance.now() + 2600;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => { if (!this.drag) this._hideSlot(); }, 2600);
  }

  _showSlot(p) {
    this._hideSlot();
    const m = new THREE.Mesh(p.geometry, this.slotMat);
    m.position.copy(p.center);
    m.renderOrder = 2;
    this.scene.add(m);
    this._slot = m;
  }
  _hideSlot() {
    if (this._slot) { this.scene.remove(this._slot); this._slot = null; }
  }

  _setGlow(p, hex) {
    p.glow = hex;
    for (const m of p.mats) m.emissive.setHex(hex);
  }

  _flash(p) {
    p.flashT = performance.now();
  }

  // はまった場所がパッと光る（光の玉＋周りを照らす光）
  _burst(at) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
    }));
    sp.position.copy(at);
    sp.renderOrder = 10;
    this.scene.add(sp);
    this.snapLight.position.copy(at);
    this.bursts = this.bursts || [];
    this.bursts.push({ sp, t0: performance.now() });
  }

  _clearAnim(p) { this.anims = this.anims.filter((a) => a.p !== p); }
  _clearAnims() { this.anims = []; }

  _animate(p, o) {
    this._clearAnim(p);
    this.anims.push({
      p, t0: performance.now() + (o.delay || 0), dur: o.dur,
      fromPos: p.mesh.position.clone(), fromQuat: p.mesh.quaternion.clone(),
      toPos: o.toPos.clone(), toQuat: o.toQuat.clone(),
      arc: o.arc || 0, bulge: o.bulge || null, spinAxis: o.spinAxis, spin: o.spin || 0,
      easing: o.easing || ease, onDone: o.onDone,
    });
  }

  _dust(at, n, color, spread, opt = {}) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize()
        .multiplyScalar(spread * (0.3 + Math.random() * 0.7));
      vel.push(v);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size: opt.size || 0.03, transparent: true, opacity: 0.9, depthWrite: false,
      map: opt.additive ? glowTexture() : null,
      blending: opt.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    if (opt.additive) pts.renderOrder = 5;
    this.scene.add(pts);
    this.particles.push({ pts, vel, t: 0, gravity: opt.gravity ?? 2.2, life: opt.life ?? 1.6 });
  }

  // ---------------- 毎フレーム ----------------
  _tick() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();
    if (this.state === 'playing') { this.elapsed += dt; this.ev.onTime?.(this.elapsed); }

    if (this._camAnim) {
      const a = this._camAnim;
      a.t = Math.min(1, a.t + dt / 1.0);
      const e = easeInOut(a.t);
      this.camera.position.lerpVectors(a.from, a.to, e);
      this.controls.target.lerpVectors(a.tFrom, a.tTo, e);
      if (a.t >= 1) this._camAnim = null;
    }

    // ひびの揺れ
    if (this._shake) {
      const k = (now - this._shake.t0) / this._shake.dur;
      if (k >= 1) { this.potGroup.position.set(0, 0, 0); this._shake = null; }
      else { const s = 0.012 * k; this.potGroup.position.set((Math.random() - 0.5) * s, 0, (Math.random() - 0.5) * s); }
    }


    // ドラッグ中のピース
    if (this.drag) {
      const d = this.drag;
      const k = Math.min(1, (now - d.t0) / 350);
      d.p.mesh.quaternion.slerpQuaternions(d.q0, new THREE.Quaternion(), ease(k));
      d.p.mesh.position.lerp(d.goal, 1 - Math.pow(0.0005, Math.min(0.1, dt)));
    }

    // アニメーション
    const tmpQ = new THREE.Quaternion();
    this.anims = this.anims.filter((a) => {
      const k = (now - a.t0) / a.dur;
      if (k < 0) return true;
      const t = Math.min(1, k);
      const e = a.easing(t);
      const m = a.p.mesh;
      m.position.lerpVectors(a.fromPos, a.toPos, e);
      m.position.y += a.arc * 4 * t * (1 - t);
      if (a.bulge) m.position.addScaledVector(a.bulge, Math.sin(Math.PI * t) * 0.5);
      m.quaternion.slerpQuaternions(a.fromQuat, a.toQuat, e);
      if (a.spin && a.spinAxis) {
        tmpQ.setFromAxisAngle(a.spinAxis, a.spin * e * (1 - e));
        m.quaternion.premultiply(tmpQ);
      }
      if (t >= 1) { a.onDone?.(); return false; }
      return true;
    });

    // 光る演出
    for (const p of this.pieces) {
      if (p.flashT) {
        const k = (now - p.flashT) / 900;
        if (k >= 1) { p.flashT = 0; this._setGlow(p, 0x000000); }
        else {
          // 白く光ってから金色に、ゆっくり消える
          const c = new THREE.Color(0xfff4d6).lerp(new THREE.Color(0xffa733), Math.min(1, k * 3)).multiplyScalar(0.85 * Math.pow(1 - k, 1.6));
          for (const m of p.mats) m.emissive.copy(c);
        }
      } else if (p.hintUntil && !p.placed) {
        if (now > p.hintUntil) { p.hintUntil = 0; if (this.drag?.p !== p) this._setGlow(p, 0x000000); }
        else if (this.drag?.p !== p) { const s = 0.5 + 0.5 * Math.sin(now / 120); for (const m of p.mats) m.emissive.setRGB(0.45 * s, 0.33 * s, 0.05 * s); }
      }
    }
    if (this._slot) this.slotMat.opacity = 0.22 + 0.18 * Math.sin(now / 160);

    // はまった時の光
    if (this.bursts) {
      this.bursts = this.bursts.filter((b) => {
        const k = (now - b.t0) / 700;
        if (k >= 1) {
          this.scene.remove(b.sp); b.sp.material.dispose();
          return false;
        }
        const s = 0.25 + 1.1 * ease(k);
        b.sp.scale.set(s, s, s);
        b.sp.material.opacity = Math.pow(1 - k, 1.5);
        return true;
      });
      const last = this.bursts[this.bursts.length - 1];
      this.snapLight.intensity = last ? 6 * Math.pow(1 - Math.min(1, (now - last.t0) / 700), 2) : 0;
    }

    // 粒子
    this.particles = this.particles.filter((pa) => {
      pa.t += dt;
      const a = pa.pts.geometry.attributes.position;
      for (let i = 0; i < pa.vel.length; i++) {
        pa.vel[i].y -= pa.gravity * dt;
        pa.vel[i].multiplyScalar(1 - 1.5 * dt);
        a.array[i * 3] += pa.vel[i].x * dt;
        a.array[i * 3 + 1] = Math.max(0.005, a.array[i * 3 + 1] + pa.vel[i].y * dt);
        a.array[i * 3 + 2] += pa.vel[i].z * dt;
      }
      a.needsUpdate = true;
      pa.pts.material.opacity = Math.max(0, 0.9 * (1 - pa.t / pa.life));
      if (pa.t > pa.life) { this.scene.remove(pa.pts); pa.pts.geometry.dispose(); pa.pts.material.dispose(); return false; }
      return true;
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,230,170,0.75)');
  grd.addColorStop(0.6, 'rgba(255,170,60,0.18)');
  grd.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
}
