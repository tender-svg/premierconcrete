// Builds the deployable site into dist/: every page (*.html), css/, js/, fonts/, images/ and vercel.json (headers, rewrites, /api and /admin proxy).
// The pages are copied as they are (they are already generated and committed); this script does NOT run tools/build-pages.js.
//   node tools/make-dist.js        (npm run dist)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
const DIRS = ['css', 'js', 'fonts', 'images'], FILES = ['vercel.json'];
fs.rmSync(DIST, { recursive: true, force: true }); fs.mkdirSync(DIST);
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const e of fs.readdirSync(from, { withFileTypes: true })) { const a = path.join(from, e.name), b = path.join(to, e.name); if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b); } };
const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
pages.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f)));
DIRS.forEach(d => copyDir(path.join(ROOT, d), path.join(DIST, d)));
FILES.forEach(f => fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f)));
// the dist must hold every file a page refers to
const missing = [];
for (const f of pages) {
  const html = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="((?:css|js|fonts|images)\/[^"?#]+)/g)) if (!fs.existsSync(path.join(DIST, m[1]))) missing.push(f + ' -> ' + m[1]);
}
const size = d => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log('dist/ ready: ' + pages.length + ' pages, ' + DIRS.join(', ') + ', ' + FILES.join(', ') + ' (' + (size(DIST) / 1048576).toFixed(1) + ' MB)');
if (missing.length) { console.log('MISSING files referenced by pages:\n  ' + [...new Set(missing)].join('\n  ')); process.exit(1); }
console.log('every file referenced by the pages is in dist/');
