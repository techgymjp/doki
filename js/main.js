import { Game } from './game.js';
import { STAGES } from './artifacts/index.js';
import * as sfx from './audio.js';
import { EN } from './artifacts/en.js';
import { t, lang, applyStatic, setLang } from './i18n.js';

applyStatic();
// 言語に合わせたステージの名前・説明
// 名前とよみ（日本語はルビ、英語は名前の上に小さくローマ字）
const nameHTML = (c) => (lang === 'en' ? `<span class="romaji">${c.ruby}</span>${c.name}` : `<ruby>${c.name}<rt>${c.ruby}</rt></ruby>`);
const S = (i) => (lang === 'en' ? { ...STAGES[i], ...EN[STAGES[i].id] } : STAGES[i]);

const $ = (id) => document.getElementById(id);

// ---- アプリ版（Android）のネイティブ機能。Web 版では window.Capacitor がないので何もしない ----
const cap = window.Capacitor;
const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const plugin = (name) => (native && cap.Plugins ? cap.Plugins[name] : null);
const Ads = window.Ads;
window.AppAudio = { suspend: () => sfx.suspendAll(), resume: () => sfx.resumeAll() };
if (native) document.body.classList.add('app');
// アプリでは外部のページ（シェア先・プライバシーポリシー）を端末のブラウザで開く
const openExternal = (u) => {
  if (native) location.href = u;
  else window.open(u, '_blank', 'noopener,noreferrer,width=600,height=520');
};
const AUTO_MAX = 5;   // おまかせ（リワード広告）は 1 ステージ 5 回まで
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
  onStart: () => { if (!game.paused) sfx.setTicking(true); },
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
// スマホでは一覧をたたみ、「ステージを選ぶ」で開く（完成した出土品が隠れないように）
const titleBottom = document.querySelector('.title-bottom');
const toggleBtn = $('stage-toggle');
function setListOpen(on) {
  titleBottom.classList.toggle('open', on);
  toggleBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  toggleBtn.textContent = on ? t('title.toggleClose') : t('title.toggleOpen');
}
toggleBtn.addEventListener('click', () => setListOpen(!titleBottom.classList.contains('open')));

function renderList() {
  ui.list.innerHTML = '';
  STAGES.forEach((a0, i) => {
    const a = S(i);
    const open = isUnlocked(i);
    const cleared = loadCleared().has(a.id);
    const b = document.createElement('button');
    b.className = 'artifact' + (i === stageIndex ? ' selected' : '') + (open ? '' : ' soon');
    b.disabled = !open;
    const tag = !a.available ? t('stage.soon') : !open ? '🔒' : cleared ? t('stage.cleared') : '';
    b.innerHTML = `<span class="kind">${t('stage.label', { n: i + 1, kind: a.kind })}</span><span class="nm">${a.name}</span>${tag ? `<span class="soon-tag">${tag}</span>` : ''}`;
    b.addEventListener('click', () => { setListOpen(false); selectStage(i); });
    ui.list.appendChild(b);
  });
  const cur = S(stageIndex);
  const maxLv = Math.max(...STAGES.map((st) => st.level || 1));
  const stars = '★'.repeat(cur.level || 1) + '☆'.repeat(maxLv - (cur.level || 1));
  ui.info.innerHTML = `${nameHTML(cur)}<span>${cur.era}${lang === 'en' ? ' | ' : '｜'}${cur.place}</span><span class="level">${t('stage.level', { stars, n: cur.pieces })}</span>`;
}

async function selectStage(i) {
  stageIndex = i;
  renderList();
  if (loadedIndex === i) return;
  ui.start.disabled = true;
  ui.start.textContent = t('title.loading');
  ui.loading.hidden = false;
  ui.loading.classList.remove('hide');
  await game.load(STAGES[i], (p) => { $('load-bar').style.width = `${Math.round(p * 100)}%`; });
  loadedIndex = i;
  game.showPreview();
  previewShift();
  ui.loading.classList.add('hide');
  setTimeout(() => { ui.loading.hidden = true; }, 500);
  ui.start.disabled = false;
  ui.start.textContent = t('title.start');
}

function startStage() {
  const cur = S(stageIndex);
  ui.result.hidden = true;
  ui.hud.hidden = false;
  $('hud-kind').textContent = t('stage.label', { n: stageIndex + 1, kind: cur.kind });
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
  updateAutoBtn();
}

// 最初にどこかを触ったら音を準備してBGMを流す（ブラウザの決まりで、操作の前は音を出せない）
function wakeAudio() {
  sfx.initAudio();
  sfx.startBgm();
}
addEventListener('pointerdown', wakeAudio, { once: true });
addEventListener('keydown', wakeAudio, { once: true });

ui.start.addEventListener('click', async () => {
  wakeAudio();
  await Ads.showInterstitial(3000);
  ui.title.classList.add('hide');
  setTimeout(() => { ui.title.hidden = true; }, 400);
  startStage();
});

$('btn-hint').addEventListener('click', () => game.hint());
$('btn-ghost').addEventListener('click', (e) => e.currentTarget.classList.toggle('on', game.toggleGhost()));
$('btn-view').addEventListener('click', () => game.resetView(true));
$('btn-sound').addEventListener('click', (e) => {
  sfx.setMuted(!sfx.isMuted());
  e.currentTarget.textContent = sfx.isMuted() ? t('hud.soundOff') : t('hud.soundOn');
});
$('btn-bgm').addEventListener('click', (e) => {
  sfx.setBgmMuted(!sfx.isBgmMuted());
  e.currentTarget.textContent = sfx.isBgmMuted() ? t('hud.bgmOff') : t('hud.bgmOn');
});
$('btn-menu').addEventListener('click', openPause);

// ---- ポーズ ----
const inPlay = () => !ui.hud.hidden && (game.state === 'playing' || game.state === 'breaking');
function openPause() {
  if (!$('pause').hidden) return;
  if (!inPlay()) { goTitle(); return; }   // 完成後に「ながめる」中ならタイトルへ
  game.setPaused(true);
  sfx.setTicking(false);
  $('pause-title').textContent = S(stageIndex).name;
  $('pause').hidden = false;
}
async function resumePlay() {
  $('pause').hidden = true;
  await Ads.showInterstitial(3000);
  if (!$('pause').hidden) return;
  game.setPaused(false);
  if (game.state === 'playing') sfx.setTicking(true);
}
$('pause-resume').addEventListener('click', resumePlay);
$('pause-title-btn').addEventListener('click', () => { $('pause').hidden = true; game.setPaused(false); goTitle(); });
// 別のアプリに切り替えたら、自動でポーズ
document.addEventListener('visibilitychange', () => { if (document.hidden && inPlay()) openPause(); });

// ---- あそびかた ----
$('howto-btn').addEventListener('click', () => { $('howto').hidden = false; });
$('howto-close').addEventListener('click', async () => { $('howto').hidden = true; await Ads.showInterstitial(3000); });

// ---- おまかせ（アプリ版：リワード広告を最後まで見ると、次のピースを自動ではめる） ----
const autoBtn = $('btn-auto');
function updateAutoBtn() {
  const on = Ads.canReward;
  autoBtn.hidden = !on;
  $('howto-auto').hidden = !on;
  autoBtn.textContent = t('hud.auto', { n: AUTO_MAX - game.autos });
  autoBtn.disabled = game.autos >= AUTO_MAX;
}
autoBtn.addEventListener('click', async () => {
  if (game.state !== 'playing' || game.autos >= AUTO_MAX || Ads.showing) return;
  game.setPaused(true);
  const r = await Ads.showRewarded();
  game.setPaused(false);
  if (r === 'rewarded') game.autoPlace();
  else if (r === 'unavailable') toast(t('toast.noAd'));
  updateAutoBtn();
});

// ---- 広告バナー：タイトル・あそびかた・ポーズ・結果画面だけ（プレイ中は出さない） ----
setInterval(() => {
  Ads.setBanner(!ui.title.hidden || !$('howto').hidden || !$('pause').hidden || !ui.result.hidden);
}, 300);

// ---- 戻るボタン（Android） ----
const App = plugin('App');
if (App) {
  App.addListener('backButton', () => {
    if (Ads.showing) return;
    if (!$('howto').hidden) { $('howto-close').click(); return; }
    if (!$('pause').hidden) { resumePlay(); return; }
    if (inPlay()) { openPause(); return; }
    if (!ui.hud.hidden && ui.result.hidden && game.state === 'complete') { ui.result.hidden = false; return; }   // 「ながめる」から結果へ
    App.exitApp();
  });
}

// ---- タイトル画面のバージョンと広告の設定 ----
if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('build-info').textContent = window.APP_VERSION;
Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('ad-privacy').hidden = false; updateAutoBtn(); });
// 言語の切りかえ（タイトル画面）
function refreshTexts() {
  renderList();
  setListOpen(titleBottom.classList.contains('open'));
  ui.start.textContent = ui.start.disabled ? t('title.loading') : t('title.start');
  $('btn-sound').textContent = sfx.isMuted() ? t('hud.soundOff') : t('hud.soundOn');
  $('btn-bgm').textContent = sfx.isBgmMuted() ? t('hud.bgmOff') : t('hud.bgmOn');
  nativeShareLabel();
  updateAutoBtn();
}
$('lang-btn').addEventListener('click', (e) => {
  e.preventDefault();
  setLang(lang === 'ja' ? 'en' : 'ja');
  refreshTexts();
});
$('ad-privacy-link').addEventListener('click', (e) => { e.preventDefault(); Ads.showPrivacyOptions(); });
document.querySelector('.legal a[target=_blank]').addEventListener('click', (e) => {
  if (!native) return;
  e.preventDefault();
  openExternal(e.currentTarget.href);
});

function previewShift() {
  const wide = innerWidth >= 900 && innerWidth > innerHeight;
  game.setViewShift(wide ? 0.17 : 0, wide ? -0.03 : (innerHeight / innerWidth < 1.7 ? 0.02 : 0.1));
}
addEventListener('resize', () => { if (!ui.title.hidden) previewShift(); });

// トップ画面にもどる（ポーズ・結果画面から）：全画面広告をはさむ
async function goTitle() {
  await Ads.showInterstitial(3000);
  backToTitle();
}
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
  lastResult = r;
  const cur = S(stageIndex);
  saveCleared(cur.id);
  $('result-title').innerHTML = nameHTML(cur);
  $('result-era').textContent = t('result.era', { n: stageIndex + 1, era: cur.era, place: cur.place });
  $('result-time').textContent = fmt(r.time);
  $('result-pieces').textContent = `${r.pieces}`;
  $('result-hints').textContent = t('result.times', { n: r.hints });
  $('result-autos').textContent = t('result.times', { n: r.autos || 0 });
  $('result-autos-box').hidden = !(Ads.canReward || r.autos);
  $('result-desc').innerHTML = cur.description.map((t) => `<p>${t}</p>`).join('') + `<p class="note">${cur.note}</p>`;
  const next = nextPlayable();
  const nb = $('btn-next');
  nb.hidden = false;
  nb.disabled = next < 0;
  nb.textContent = next < 0 ? t('result.noNext') : t('result.next', { name: S(next).name });
  ui.result.hidden = false;
  const wide = innerWidth >= 1000 && innerWidth > innerHeight;
  game.setViewShift(wide ? 0.17 : 0, wide ? 0 : 0.18);
}

// ---- シェア ----
const SHARE_URL = 'https://techgym.jp/column/claude-code-game-doki/';
let lastResult = null;
function shareText() {
  const cur = S(stageIndex);
  const time = lastResult ? fmt(lastResult.time) : '';
  const auto = lastResult && lastResult.autos ? t('share.auto', { n: lastResult.autos }) : '';
  return t('share.text', { n: stageIndex + 1, name: cur.name, time, auto });
}
const openShare = openExternal;
$('share-x').addEventListener('click', () => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(SHARE_URL)}`));
$('share-line').addEventListener('click', () => openShare(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(shareText())}`));
$('share-fb').addEventListener('click', () => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`));
// アプリでは「リンクをコピー」の代わりに、Android の共有メニューを出す
const NativeShare = plugin('Share');
const nativeShareLabel = () => { if (NativeShare) $('share-copy').textContent = t('share.native'); };
nativeShareLabel();
$('share-copy').addEventListener('click', async () => {
  const text = `${shareText()} ${SHARE_URL}`;
  if (NativeShare) {
    try { await NativeShare.share({ title: t('doc.title'), text: shareText(), url: SHARE_URL, dialogTitle: t('share.dialog') }); } catch (e) { /* キャンセル */ }
    return;
  }
  try {
    if (navigator.share) { await navigator.share({ text: shareText(), url: SHARE_URL }); return; }
    await navigator.clipboard.writeText(text);
    toast(t('toast.copied'));
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    window.prompt(t('prompt.copy'), text);
  }
});

$('btn-next').addEventListener('click', async () => {
  const next = nextPlayable();
  if (next < 0) return;
  await Ads.showInterstitial(3000);
  ui.result.hidden = true;
  ui.hud.hidden = true;
  await selectStage(next);
  ui.title.hidden = false;
  ui.title.classList.remove('hide');
});
$('btn-again').addEventListener('click', async () => { await Ads.showInterstitial(3000); startStage(); });
$('btn-view-pot').addEventListener('click', () => { ui.result.hidden = true; game.setViewShift(0, 0); });
$('btn-title').addEventListener('click', goTitle);

// ---- 起動 ----
const startIdx = Math.max(0, Math.min(STAGES.length - 1, (parseInt(params.get('stage'), 10) || 1) - 1));
refreshTexts();
selectStage(isUnlocked(startIdx) ? startIdx : 0);
