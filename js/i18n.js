// 日本語と英語の切りかえ。端末の言語が日本語なら日本語、それ以外は英語（タイトル画面のボタンで切りかえ可）。
// 画面の固定の文字は index.html の data-i18n="キー"（innerHTML）と data-i18n-title="キー"（title 属性）で指定する
const KEY = 'fukugen-lang';

const DICT = {
  ja: {
    'doc.title': '復元せよ 土器・土偶・埴輪',
    'logo.title': '復元せよ',
    'logo.sub': '土器・土偶・埴輪',
    'title.toggleOpen': 'ステージを選ぶ ▾',
    'title.toggleClose': 'とじる ▴',
    'title.loading': '読み込み中…',
    'title.start': '復元スタート（割る）',
    'title.howto': 'あそびかた',
    'title.tip': 'ドラッグ・フリックで回して、じっくり観察しよう',
    'title.privacy': 'プライバシーポリシー',
    'title.privacyUrl': 'https://techgym.jp/privacy-policy/',
    'title.adSettings': '広告の設定',
    'title.lang': 'English',
    'stage.label': 'ステージ{n}・{kind}',
    'stage.soon': '準備中',
    'stage.cleared': 'クリア済み',
    'stage.level': '難易度 {stars}｜{n}ピース',
    'hud.pieces': 'ピース',
    'hud.time': '時間',
    'hud.hint': 'ヒント',
    'hud.hintTitle': '次にはめるピースを光らせる',
    'hud.guide': 'ガイド',
    'hud.guideTitle': '完成形のガイドを表示',
    'hud.view': '視点',
    'hud.viewTitle': '視点をもとに戻す',
    'hud.bgmOn': 'BGM ON',
    'hud.bgmOff': 'BGM OFF',
    'hud.soundOn': '音 ON',
    'hud.soundTitle': 'すべての音',
    'hud.soundOff': '音 OFF',
    'hud.auto': 'おまかせ {n}',
    'hud.autoTitle': '広告を見ると、次のピースを自動ではめます',
    'hud.pause': 'ポーズ',
    'hud.help': 'ピースをドラッグして正しい位置に近づけると<b>ピタッ</b>とはまります。<b>底や足のピース</b>から組み上げよう。<br>何もないところをフリックすると回転できます。',
    'toast.bottomFirst': 'まずは底や足のピースから！',
    'toast.connectFirst': 'つながるピースから先にはめよう',
    'toast.noAd': 'いまは広告を読み込めません',
    'toast.copied': 'リンクをコピーしました',
    'prompt.copy': 'コピーしてください',
    'howto.label': 'あそびかた',
    'howto.title': 'こなごなの出土品を復元しよう',
    'howto.body': '<p>「復元スタート」を押すと、出土品がこなごなに割れます。</p><p>ピースをドラッグして、正しい位置に近づけると<b>ピタッ</b>とはまります。<b>底や足のピース</b>から、下から順に組み上げよう。</p><p>何もないところをドラッグ・フリックすると、ぐるっと回して見られます。</p><p><b>ヒント</b>…次にはめるピースの場所が光ります。<br><b>ガイド</b>…完成形がうっすら見えます（難しいステージでは見えにくくなります）。<br><b>視点</b>…見る向きをもとに戻します。</p>',
    'howto.auto': '<b>おまかせ</b>…広告を見ると、次のピースを自動ではめます（1ステージ5回まで）。',
    'howto.unlock': 'ステージをクリアすると、次のステージが遊べるようになります。',
    'howto.close': 'タイトルにもどる',
    'pause.label': 'ポーズ中',
    'pause.resume': 'つづける',
    'pause.title': 'タイトルにもどる',
    'result.label': '復元完了',
    'result.time': 'タイム',
    'result.pieces': 'ピース',
    'result.hints': 'ヒント',
    'result.autos': 'おまかせ',
    'result.times': '{n}回',
    'result.era': 'ステージ{n}｜{era}｜{place}',
    'result.next': '次のステージへ（{name}）',
    'result.noNext': '次のステージは準備中',
    'result.again': 'もう一度',
    'result.view': 'ながめる',
    'result.title': 'タイトルへ',
    'share.label': 'シェア',
    'share.x': 'Xでシェア',
    'share.line': 'LINEで送る',
    'share.fb': 'Facebookでシェア',
    'share.copy': 'リンクをコピー',
    'share.native': 'ほかのアプリ',
    'share.dialog': '結果をシェア',
    'share.auto': '（おまかせ{n}回）',
    'share.text': '「復元せよ 土器・土偶・埴輪」でステージ{n}「{name}」を{time}{auto}で復元しました！ #復元せよ',
    'loading.text': '出土品を準備しています…',
  },
  en: {
    'doc.title': 'Restore It! Jomon & Haniwa',
    'logo.title': 'Restore It!',
    'logo.sub': 'Jomon &amp; Haniwa',
    'title.toggleOpen': 'Choose a stage ▾',
    'title.toggleClose': 'Close ▴',
    'title.loading': 'Loading…',
    'title.start': 'Start (shatter it!)',
    'title.howto': 'How to play',
    'title.tip': 'Drag or flick to spin it around and take a good look',
    'title.privacy': 'Privacy Policy',
    'title.privacyUrl': 'https://techgym.jp/privacy-policy-en/',
    'title.adSettings': 'Ad settings',
    'title.lang': '日本語',
    'stage.label': 'Stage {n} · {kind}',
    'stage.soon': 'Coming soon',
    'stage.cleared': 'Cleared',
    'stage.level': 'Difficulty {stars} | {n} pieces',
    'hud.pieces': 'Pieces',
    'hud.time': 'Time',
    'hud.hint': 'Hint',
    'hud.hintTitle': 'Light up the next piece to place',
    'hud.guide': 'Guide',
    'hud.guideTitle': 'Show a faint outline of the finished shape',
    'hud.view': 'View',
    'hud.viewTitle': 'Reset the view',
    'hud.bgmOn': 'Music ON',
    'hud.bgmOff': 'Music OFF',
    'hud.soundOn': 'Sound ON',
    'hud.soundTitle': 'All sounds',
    'hud.soundOff': 'Sound OFF',
    'hud.auto': 'Auto {n}',
    'hud.autoTitle': 'Watch an ad to snap the next piece into place',
    'hud.pause': 'Pause',
    'hud.help': 'Drag a piece close to the right spot and it <b>snaps</b> into place. Start from the <b>base or the feet</b>.<br>Flick an empty area to spin the view.',
    'toast.bottomFirst': 'Start with the base or the feet!',
    'toast.connectFirst': 'Place a piece that connects first',
    'toast.noAd': 'No ad is available right now',
    'toast.copied': 'Link copied',
    'prompt.copy': 'Copy this text',
    'howto.label': 'How to play',
    'howto.title': 'Restore the shattered treasure',
    'howto.body': '<p>Tap “Start” and the artifact shatters into pieces.</p><p>Drag a piece close to the right spot and it <b>snaps</b> into place. Build from the bottom up, starting with the <b>base or the feet</b>.</p><p>Drag or flick an empty area to spin the view around.</p><p><b>Hint</b>: the spot for the next piece lights up.<br><b>Guide</b>: a faint outline of the finished shape (harder to see in later stages).<br><b>View</b>: resets the view.</p>',
    'howto.auto': '<b>Auto</b>: watch an ad to snap the next piece into place (up to 5 times per stage).',
    'howto.unlock': 'Clear a stage to unlock the next one.',
    'howto.close': 'Back to title',
    'pause.label': 'Paused',
    'pause.resume': 'Resume',
    'pause.title': 'Back to title',
    'result.label': 'Restored!',
    'result.time': 'Time',
    'result.pieces': 'Pieces',
    'result.hints': 'Hints',
    'result.autos': 'Auto',
    'result.times': '{n}',
    'result.era': 'Stage {n} | {era} | {place}',
    'result.next': 'Next stage ({name})',
    'result.noNext': 'Next stage coming soon',
    'result.again': 'Again',
    'result.view': 'Look',
    'result.title': 'Title',
    'share.label': 'Share',
    'share.x': 'Share on X',
    'share.line': 'Send on LINE',
    'share.fb': 'Share on Facebook',
    'share.copy': 'Copy link',
    'share.native': 'More apps',
    'share.dialog': 'Share your result',
    'share.auto': ' (Auto ×{n})',
    'share.text': 'I restored Stage {n} “{name}” in {time}{auto} in “Restore It! Jomon & Haniwa”! #RestoreIt',
    'loading.text': 'Preparing the artifact…',
  },
};

function detect() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ja' || q === 'en') return q;
  try { const s = localStorage.getItem(KEY); if (s === 'ja' || s === 'en') return s; } catch { /* 保存できなくてもよい */ }
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ja'];
  return /^ja\b/i.test(langs[0] || '') ? 'ja' : 'en';
}

export let lang = detect();

export function t(key, vars = {}) {
  const s = DICT[lang][key] ?? DICT.ja[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

// 画面の固定の文字を書きかえる
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-href]').forEach((el) => { el.href = t(el.dataset.i18nHref); });
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* 保存できなくてもよい */ }
  applyStatic();
}
