import { Game } from './game.js';
import { STAGES } from './artifacts/index.js';
import * as sfx from './audio.js';

const $ = (id) => document.getElementById(id);
const ui = {
  title: $('title'), hud: $('hud'), result: $('result'), loading: $('loading'), toast: $('toast'),
  start: $('start-btn'), list: $('artifact-list'), info: $('artifact-info'),
};

let stageIndex = 0;
let loadedIndex = -1;
let toastTimer = 0;
let helpTimer = 0;

// クリア済みステージ（このブラウザだけに保存）
const SAVE_KEY = 'fukugen-cleared';
function loadCleared() {
  try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || '[]')); } catch { return new Set(); }
}
function saveCleared(id) {
  const s = loadCleared(); s.add(id);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify([...s])); } catch { /* 保存できなくても遊べる */ }
}
// 前のステージをクリアすると次が遊べる
const params = new URLSearchParams(location.search);
function isUnlocked(i) {
  if (!STAGES[i].available) return false;
  if (i === 0 || params.has('all')) return true;
  return loadCleared().has(STAGES[i - 1].id);
}
const nextPlayable = () => (stageIndex + 1 < STAGES.length && STAGES[stageIndex + 1].available ? stageIndex + 1 : -1);

const fmt = (t) => {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function toast(msg, ms = 2600) {
  ui.toast.textContent = msg;
  ui.toast.hidden = false;
  ui.toast.classList.remove('show');
  void ui.toast.offsetWidth;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.hidden = true; }, ms);
}

const game = new Game($('stage'), {
  onCount: (n, total) => { $('hud-count').textContent = `${n} / ${total}`; },
  onTime: (t) => { $('hud-time').textContent = fmt(t); },
  onToast: (m) => toast(m),
  onGhost: (v) => $('btn-ghost').classList.toggle('on', v),
  onStart: () => { toast('地面につくピース（底や足）から組み上げよう！'); sfx.setTicking(true); },
  onDrag: (on) => { if (on) $('hud-help').classList.add('gone'); },
  onComplete: (r) => showResult(r),
  onFinish: () => {
    // 完成の瞬間：時計を止め、BGMを少し下げてファンファーレを聞かせる
    sfx.setTicking(false);
    sfx.setBgmVolume(0.18);
    setTimeout(() => sfx.setBgmVolume(0.55), 3200);
  },
});
if (location.search.includes('debug')) window.__game = game;

// ---- ステージ一覧 ----
function renderList() {
  ui.list.innerHTML = '';
  STAGES.forEach((a, i) => {
    const open = isUnlocked(i);
    const cleared = loadCleared().has(a.id);
    const b = document.createElement('button');
    b.className = 'artifact' + (i === stageIndex ? ' selected' : '') + (open ? '' : ' soon');
    b.disabled = !open;
    const tag = !a.available ? '準備中' : !open ? '前のステージをクリア' : cleared ? 'クリア済み' : '';
    b.innerHTML = `<span class="kind">ステージ${i + 1}・${a.kind}</span><span class="nm">${a.name}</span>${tag ? `<span class="soon-tag">${tag}</span>` : ''}`;
    b.addEventListener('click', () => selectStage(i));
    ui.list.appendChild(b);
  });
  const cur = STAGES[stageIndex];
  const maxLv = Math.max(...STAGES.map((st) => st.level || 1));
  const stars = '★'.repeat(cur.level || 1) + '☆'.repeat(maxLv - (cur.level || 1));
  ui.info.innerHTML = `<ruby>${cur.name}<rt>${cur.ruby}</rt></ruby><span>${cur.era}｜${cur.place}</span><span class="level">難易度 ${stars}｜${cur.pieces}ピース</span>`;
}

async function selectStage(i) {
  stageIndex = i;
  renderList();
  if (loadedIndex === i) return;
  ui.start.disabled = true;
  ui.start.textContent = '読み込み中…';
  ui.loading.hidden = false;
  ui.loading.classList.remove('hide');
  await game.load(STAGES[i], (p) => { $('load-bar').style.width = `${Math.round(p * 100)}%`; });
  loadedIndex = i;
  game.showPreview();
  previewShift();
  ui.loading.classList.add('hide');
  setTimeout(() => { ui.loading.hidden = true; }, 500);
  ui.start.disabled = false;
  ui.start.textContent = '復元スタート（割る）';
}

function startStage() {
  const cur = STAGES[stageIndex];
  ui.result.hidden = true;
  ui.hud.hidden = false;
  $('hud-kind').textContent = `ステージ${stageIndex + 1}・${cur.kind}`;
  $('hud-title').textContent = cur.name;
  $('hud-count').textContent = `0 / ${cur.pieces}`;
  $('hud-time').textContent = '0:00';
  const help = $('hud-help');
  help.classList.remove('gone');
  clearTimeout(helpTimer);
  helpTimer = setTimeout(() => help.classList.add('gone'), 9000);
  sfx.setTicking(false);
  game.setViewShift(0, 0);
  game.start();
  game.resetView(true);
}

// 最初にどこかを触ったら音を準備してBGMを流す（ブラウザの決まりで、操作の前は音を出せない）
function wakeAudio() {
  sfx.initAudio();
  sfx.startBgm();
}
addEventListener('pointerdown', wakeAudio, { once: true });
addEventListener('keydown', wakeAudio, { once: true });

ui.start.addEventListener('click', () => {
  wakeAudio();
  ui.title.classList.add('hide');
  setTimeout(() => { ui.title.hidden = true; }, 400);
  startStage();
});

$('btn-hint').addEventListener('click', () => game.hint());
$('btn-ghost').addEventListener('click', (e) => e.currentTarget.classList.toggle('on', game.toggleGhost()));
$('btn-view').addEventListener('click', () => game.resetView(true));
$('btn-sound').addEventListener('click', (e) => {
  sfx.setMuted(!sfx.isMuted());
  e.currentTarget.textContent = sfx.isMuted() ? '音 OFF' : '音 ON';
});
$('btn-bgm').addEventListener('click', (e) => {
  sfx.setBgmMuted(!sfx.isBgmMuted());
  e.currentTarget.textContent = sfx.isBgmMuted() ? 'BGM OFF' : 'BGM ON';
});
$('btn-menu').addEventListener('click', () => {
  if (game.state === 'playing' && !confirm('タイトルにもどりますか？（進行中の復元は失われます）')) return;
  backToTitle();
});

function previewShift() {
  const wide = innerWidth >= 900 && innerWidth > innerHeight;
  game.setViewShift(wide ? 0.17 : 0, wide ? -0.03 : 0.2);
}
addEventListener('resize', () => { if (!ui.title.hidden) previewShift(); });

function backToTitle() {
  sfx.setTicking(false);
  ui.result.hidden = true;
  ui.hud.hidden = true;
  ui.title.hidden = false;
  ui.title.classList.remove('hide');
  renderList();
  game.showPreview();
  previewShift();
}

function showResult(r) {
  const cur = STAGES[stageIndex];
  saveCleared(cur.id);
  $('result-title').innerHTML = `<ruby>${cur.name}<rt>${cur.ruby}</rt></ruby>`;
  $('result-era').textContent = `ステージ${stageIndex + 1}｜${cur.era}｜${cur.place}`;
  $('result-time').textContent = fmt(r.time);
  $('result-pieces').textContent = `${r.pieces}`;
  $('result-hints').textContent = `${r.hints}回`;
  $('result-desc').innerHTML = cur.description.map((t) => `<p>${t}</p>`).join('') + `<p class="note">${cur.note}</p>`;
  const next = nextPlayable();
  const nb = $('btn-next');
  nb.hidden = false;
  nb.disabled = next < 0;
  nb.textContent = next < 0 ? '次のステージは準備中' : `次のステージへ（${STAGES[next].name}）`;
  ui.result.hidden = false;
  const wide = innerWidth >= 1000 && innerWidth > innerHeight;
  game.setViewShift(wide ? 0.17 : 0, wide ? 0 : 0.18);
}

$('btn-next').addEventListener('click', async () => {
  const next = nextPlayable();
  if (next < 0) return;
  ui.result.hidden = true;
  ui.hud.hidden = true;
  await selectStage(next);
  ui.title.hidden = false;
  ui.title.classList.remove('hide');
});
$('btn-again').addEventListener('click', startStage);
$('btn-view-pot').addEventListener('click', () => { ui.result.hidden = true; game.setViewShift(0, 0); });
$('btn-title').addEventListener('click', backToTitle);

// ---- 起動 ----
const startIdx = Math.max(0, Math.min(STAGES.length - 1, (parseInt(params.get('stage'), 10) || 1) - 1));
renderList();
selectStage(isUnlocked(startIdx) ? startIdx : 0);
