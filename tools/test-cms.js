// jsdom test of js/cms.js with a stubbed backend (no network, no DB): saved texts are applied for visitors, the admin bar / edit mode / save / link editor work.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
function load(admin) {
  const html = fs.readFileSync(path.join(ROOT, 'about.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/about.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; w.scrollTo = () => { }; const posts = [];
  const h1 = w.document.querySelector('h1[data-cms]'), key = h1.getAttribute('data-cms');
  w.fetch = (url, o) => {
    o = o || {}; const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
    if (o.method === 'POST') { posts.push({ url, body: o.body && JSON.parse(o.body) }); return res({}); }
    if (/page-elements\/about$/.test(url)) return res([{ element_id: key, content_type: 'text', content_value: 'Saved headline' }]);
    if (/page-elements/.test(url)) return res([]);
    if (/admin\/status/.test(url)) return res({ loggedIn: admin });
    return res({});
  };
  w.eval(fs.readFileSync(path.join(ROOT, 'js/cms.js'), 'utf8')); w.eval(fs.readFileSync(path.join(ROOT, 'js/pc-toolbar.js'), 'utf8'));
  return { w, d: w.document, key, posts };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let t = load(false); await wait(80);
  ok(t.d.querySelector('[data-cms="' + t.key + '"]').textContent === 'Saved headline', 'visitor sees the saved text');
  ok(!t.d.getElementById('cms-admin-bar'), 'visitor has no admin bar');
  t = load(true); await wait(120);
  ok(!!t.d.getElementById('cms-admin-bar'), 'admin bar shown for a signed-in admin');
  t.d.getElementById('cms-toggle').click();
  const el = t.d.querySelector('[data-cms="' + t.key + '"]');
  ok(el.getAttribute('contenteditable') === 'true', 'edit mode makes the text editable');
  el.textContent = 'New headline'; el.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  ok(t.d.querySelector('#cms-save .cms-count').textContent === '1', 'one unsaved change counted');
  t.d.getElementById('cms-save').click(); await wait(150);
  const p = t.posts.find(x => /page-elements$/.test(x.url));
  ok(p && p.body.page_slug === 'about' && p.body.element_id === t.key && /New headline/.test(p.body.content_value), 'SAVE posts the page element');
  // a header text is a global key: stored with the home page
  const g = t.d.querySelector('header [data-cms^="g-"]'); g.textContent = 'Changed nav'; g.dispatchEvent(new t.w.Event('input', { bubbles: true }));
  t.d.getElementById('cms-save').click(); await wait(150);
  ok(t.posts.some(x => x.body && x.body.page_slug === 'index' && x.body.element_id === g.getAttribute('data-cms')), 'header / footer texts are saved with the home page');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
