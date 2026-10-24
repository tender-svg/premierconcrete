// jsdom test of the page loader (inline script of every page) and the data cache (js/pc-cache.js). No network.   node tools/test-cache.js
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function load(storage, nav) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/index.html', runScripts: 'dangerously', pretendToBeVisual: true, beforeParse(w) {
    Object.keys(storage || {}).forEach(k => w.localStorage.setItem(k, storage[k]));
    if (nav) w.performance.getEntriesByType = () => [{ type: nav }];
  } });
  dom.window.fetch = () => Promise.resolve({ ok: false });
  dom.window.eval(fs.readFileSync(path.join(ROOT, 'js/pc-cache.js'), 'utf8'));
  return dom.window;
}
(async () => {
  // first visit: loader shown, no cache
  let w = load();
  ok(w.document.getElementById('pc-loader') && w.document.documentElement.classList.contains('pc-loading') && !w.document.documentElement.classList.contains('pc-cached'), 'first visit: the loader is shown, no cache');
  ok(!w.PCC.usable(), 'first visit: the cache is not usable');
  w.PCL.hold(); w.document.dispatchEvent(new w.Event('DOMContentLoaded')); await wait(450);
  ok(!w.document.getElementById('pc-loader').classList.contains('done'), 'the loader stays while something is held');
  w.PCL.release(); await wait(500);
  ok(!w.document.documentElement.classList.contains('pc-loading') && w.document.getElementById('pc-loader').classList.contains('done'), 'the loader goes when everything is in');
  // the cache fills
  w.PCC.setList('solutions', [{ id: 1 }]); w.PCC.setPage('index', [{ element_id: 'a' }]); await wait(150);
  ok(!!w.localStorage.getItem('pc-cache-v1') && !!w.localStorage.getItem('pc-cache-t'), 'data is kept in the browser (localStorage)');
  const saved = { 'pc-cache-v1': w.localStorage.getItem('pc-cache-v1'), 'pc-cache-t': w.localStorage.getItem('pc-cache-t') };
  // later visit: no loader, drawn from the cache
  w = load(saved);
  ok(w.document.documentElement.classList.contains('pc-cached') && w.PCL.cached, 'next visit: marked as cached (no loader, page kept invisible until drawn)');
  ok(w.PCC.usable() && w.PCC.list('solutions')[0].id === 1 && w.PCC.page('index')[0].element_id === 'a', 'next visit: lists and page texts come from the cache');
  w.document.dispatchEvent(new w.Event('DOMContentLoaded')); await wait(100);
  ok(!w.document.documentElement.classList.contains('pc-cached'), 'next visit: the page is shown at once');
  // reload clears the cache
  w = load(saved, 'reload');
  ok(!w.document.documentElement.classList.contains('pc-cached') && !w.localStorage.getItem('pc-cache-t'), 'a reload (F5) clears the cache: fresh data, loader shown once');
  // a signed-in admin uses the cache too (no loader on every page switch); the cache is cleared only when signing in / out
  w = load(Object.assign({ 'pc-admin': '1' }, saved));
  ok(w.document.documentElement.classList.contains('pc-cached') && w.PCC.usable(), 'a signed-in admin uses the cache (no loader when switching pages)');
  w.PCC.admin(true); ok(!!w.localStorage.getItem('pc-cache-v1'), 'admin(true) on every page keeps the cache');
  w = load(Object.assign({}, saved)); w.PCC.admin(true); ok(!w.localStorage.getItem('pc-cache-v1'), 'signing in (visitor becomes admin) clears the cache');
  // old cache
  w = load({ 'pc-cache-v1': saved['pc-cache-v1'], 'pc-cache-t': String(Date.now() - 25 * 3600e3) });
  ok(!w.document.documentElement.classList.contains('pc-cached'), 'a cache older than 24 h is not used');
  // login page has no loader
  const lg = fs.readFileSync(path.join(ROOT, 'login.html'), 'utf8'); ok(!/pc-loader/.test(lg), 'the login page has no loader');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
