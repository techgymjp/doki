// アプリに同梱する Web ファイルを www/ にコピーし、広告のモードとバージョンのファイルを作る
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const item of ['index.html', 'css', 'js', 'vendor']) {
  const src = path.join(root, item);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, item), { recursive: true });
}
// Web 版だけの部分（Google Play へのリンクなど）はアプリに入れない。
// HTML は <!-- web-only --> … <!-- /web-only -->、JS は // web-only:start … // web-only:end で囲んでおく
function stripWebOnly(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out2 = src
    .replace(/[ \t]*<!-- web-only -->[\s\S]*?<!-- \/web-only -->[ \t]*\n?/g, '')
    .replace(/[ \t]*\/\/ web-only:start[\s\S]*?\/\/ web-only:end[ \t]*\n?/g, '');
  if (out2 !== src) fs.writeFileSync(file, out2);
}
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'vendor') walk(f); }
    else if (/\.(html|js|css)$/.test(e.name)) stripWebOnly(f);
  }
})(out);
// 取り残しがあればビルドを止める（他社ストアへのリンクがアプリに入らないように）
(function check(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) check(f);
    else if (/\.(html|js|css)$/.test(e.name) && /play\.google\.com|web-only/.test(fs.readFileSync(f, 'utf8'))) {
      console.error(`Web 版だけの部分がアプリに残っています: ${path.relative(root, f)}`);
      process.exit(1);
    }
  }
})(out);
// Google Play 用のビルドでは本番の広告を使う
const mode = process.env.ADMOB_MODE === 'production' ? 'production' : 'test';
fs.writeFileSync(path.join(out, 'js', 'ads-config.js'), `// ビルド時に生成\nwindow.AD_MODE = '${mode}';\n`);
// タイトル画面に出すバージョン（CI では VERSION_NAME / VERSION_CODE を使う）
const version = process.env.VERSION_CODE
  ? `v${process.env.VERSION_NAME || require('../package.json').version} (build ${process.env.VERSION_CODE})`
  : 'dev';
fs.writeFileSync(path.join(out, 'js', 'build-info.js'), `// ビルド時に生成\nwindow.APP_VERSION = '${version}';\n`);
console.log(`built web assets into www/ (ads: ${mode}, version: ${version})`);
