// jsdom test: the Applications of the Utility Structures groups are lists with Add item / Remove, and a saved text stays (js/pc-repeat.js with js/cms.js).
//   node tools/test-utility.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const PAGE = 'products-utility';
function load(rows, admin) {
  const html = fs.readFileSync(path.join(ROOT, PAGE + '.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + PAGE + '.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, configurable: true });
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; url = String(url);
    if (o.method === 'POST') { writes.push({ url, body: o.body ? JSON.parse(o.body) : null }); return res({}); }
    if (/admin\/status/.test(url)) return res({ loggedIn: !!admin, role: 'admin', username: 'test' });
    if (new RegExp('page-elements/' + PAGE + '$').test(url)) return res(rows || []);
    return res([]);
  };
  for (const f of ['js/site.js', 'js/pc-dialog.js', 'js/cms.js', 'js/pc-repeat.js', 'js/pc-groups.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { w, d: w.document, errors, writes };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
(async () => {
  let t = load([]); await wait(250);
  const lists = [...t.d.querySelectorAll('[data-grp-panel] ul[data-rep]')];
  ok(lists.length === 5 && lists.every(l => l.querySelectorAll(':scope > [data-rep-item]').length === 1), 'every one of the 5 groups has its Applications as a list with one item (' + lists.length + ')');
  const key = lists[0].querySelector('[data-cms]').getAttribute('data-cms');
  ok(key === 'txt-applications-to-be-added-476c', 'the text keeps its key, so a saved text stays');
  const v = load([{ element_id: key, content_type: 'text', content_value: 'Underground power distribution' }]); await wait(250);
  ok(/Underground power distribution/.test(v.d.querySelector('[data-grp-panel] ul[data-rep]').textContent), 'visitor: the saved text is the first bullet');
  t = load([], true); await wait(300); t.d.getElementById('cms-toggle').click(); await wait(80);
  const l0 = t.d.querySelector('[data-grp-panel="0"] ul[data-rep]');
  ok(!!l0.querySelector('[data-pcr-add]') && !!l0.querySelector('.pcr-x'), 'edit mode: the Applications list has Add item and Remove');
  click(t.w, l0.querySelector('[data-pcr-add]')); await wait(40); click(t.w, l0.querySelector('[data-pcr-add]')); await wait(40);
  ok(l0.querySelectorAll(':scope > [data-rep-new]').length === 2, 'Add item: two new applications (bullets) appear');
  t.d.getElementById('cms-save').click(); await wait(400);
  const st = t.writes.map(x => x.body).filter(Boolean).find(b => b.element_id === l0.getAttribute('data-rep'));
  ok(st && JSON.parse(st.content_value).order.length === 3, 'SAVE stores the list structure (3 items)');
  ok(![t, v].some(x => x.errors.length), 'no script errors');
  console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
})();
