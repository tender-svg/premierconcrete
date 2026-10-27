// jsdom test of "add / remove the group tabs of a product page" (js/pc-groups.js with js/cms.js + js/site.js) on products-hardscapes.html. The backend is a stub that RECORDS writes.
//   node tools/test-groups.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const PAGE = 'products-hardscapes';
function load(rows, admin) {
  const html = fs.readFileSync(path.join(ROOT, PAGE + '.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + PAGE + '.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { }; w.HTMLElement.prototype.scrollIntoView = () => { };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true });
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
const tabsOf = d => [...d.querySelectorAll('[role="tablist"] > [role="tab"]')];
const panelsOf = d => [...d.querySelectorAll('[data-grp-panel]')];
(async () => {
  let t = load([]); await wait(200);
  const tabs0 = tabsOf(t.d), panels0 = panelsOf(t.d); ok(tabs0.length === panels0.length && tabs0.length >= 3, 'the page has ' + tabs0.length + ' groups (tab + panel)');
  const keys = panels0.map(p => p.querySelector('h3[data-cms]').getAttribute('data-cms'));

  // visitors: the saved structure removes the 2nd group and adds a new one
  const extra = { id: 'nx1', name: 'Brick Walls', desc: 'Walls made of brick.', image: '', items: [{ name: 'Item A', text: 'Text of item A', image: '' }] };
  t = load([{ element_id: 'grp-struct', content_type: 'text', content_value: JSON.stringify({ removed: [keys[1]], extra: [extra] }) }]); await wait(250);
  const tabs1 = tabsOf(t.d), panels1 = panelsOf(t.d);
  ok(tabs1.length === tabs0.length && panels1.length === tabs0.length, 'visitor: one group removed, one added (' + tabs1.length + ' groups)');
  ok(!panels1.some(p => (p.querySelector('h3') || {}).textContent === panels0[1].querySelector('h3').textContent), 'visitor: the removed group is gone');
  ok(tabs1[tabs1.length - 1].textContent.trim() === 'Brick Walls' && /Brick Walls/.test(panels1[panels1.length - 1].querySelector('h3').textContent) && /Text of item A/.test(panels1[panels1.length - 1].textContent), 'visitor: the new group shows its tab, title, text and item');
  ok(tabs1.every((b, i) => JSON.parse(b.getAttribute('data-set')).grp === i) && panels1.every((p, i) => p.getAttribute('data-grp-panel') === String(i)), 'visitor: tabs and panels are numbered again');
  ok(panels1.filter(p => p.style.display !== 'none').length === 1 && panels1[0].style.display === 'block', 'visitor: only the first group is shown');
  click(t.w, tabs1[tabs1.length - 1]); await wait(30);
  ok(panelsOf(t.d)[panels1.length - 1].style.display === 'block' && panelsOf(t.d)[0].style.display === 'none', 'visitor: clicking the new tab shows the new group');

  // admin: Add group / Remove group / SAVE
  t = load([], true); await wait(300);
  t.d.getElementById('cms-toggle').click(); await wait(80);
  ok(t.d.querySelectorAll('.pcg-x').length === tabs0.length && !!t.d.querySelector('.pcg-add'), 'edit mode: every tab has a Remove (x) and the tabs have an "Add group" button');
  click(t.w, t.d.querySelector('.pcg-add')); await wait(60);
  ok(tabsOf(t.d).length === tabs0.length + 1 && !!t.d.querySelector('[data-pcg-extra][data-grp-panel] h3[contenteditable="true"]'), 'Add group: a new tab and an editable panel appear');
  const h3 = t.d.querySelector('[data-pcg-extra][data-grp-panel] h3'); h3.textContent = 'Retaining Walls'; h3.dispatchEvent(new t.w.Event('input', { bubbles: true })); await wait(20);
  ok(/Retaining Walls/.test(tabsOf(t.d)[tabsOf(t.d).length - 1].textContent), 'editing the title of the new group renames its tab');
  click(t.w, t.d.querySelector('[data-pcga]')); await wait(40);
  ok(t.d.querySelectorAll('[data-pcg-extra] [data-act="acc"]').length === 2, 'Add item: the new group gets a second item');
  const xs = [...t.d.querySelectorAll('.pcg-x')]; click(t.w, xs[1]); await wait(40);
  const yes = t.d.querySelector('#rgd-ov .rgd-yes, #pcd-ov .pcd-yes, [class*="-yes"]'); ok(!!yes, 'removing a group asks for confirmation'); yes.click(); await wait(60);
  ok(tabsOf(t.d).length === tabs0.length && !panelsOf(t.d).some(p => p.querySelector('h3[data-cms="' + keys[1] + '"]')), 'Remove group: the tab and its panel are gone');
  t.d.getElementById('cms-save').click(); await wait(400);
  const w1 = t.writes.find(x => x.body && x.body.element_id === 'grp-struct'), st = w1 && JSON.parse(w1.body.content_value);
  ok(st && w1.body.page_slug === PAGE && st.removed.length === 1 && st.removed[0] === keys[1] && st.extra.length === 1 && st.extra[0].name === 'Retaining Walls' && st.extra[0].items.length === 2, 'SAVE stores the structure (removed groups + new groups) as one page element');

  // a list with a single accordion row (Pavers: "Trinity 6") now has its own Add item
  const pav = panelsOf(load([]).d).find(p => /^Pavers/.test(p.querySelector('h3').textContent.trim()));
  ok(!!pav && !!pav.querySelector('[data-rep] > [data-rep-item] > button[data-act="acc"]'), 'a group with a single accordion item is a list too (Add item / Remove)');
  // dropdown lines + groups that have no dropdown at all + the file link of "Download submittal"
  t = load([], true); await wait(300); t.d.getElementById('cms-toggle').click(); await wait(80);
  const pp = panelsOf(t.d).find(p => /Permeable Pavers/.test(p.querySelector('h3').textContent)), dd = pp.querySelector('[data-dd-empty]');
  ok(!!dd && !!dd.querySelector('[data-pcr-add]') && /Add dropdown/.test(dd.textContent), 'a group with no dropdown has "Add dropdown" in edit mode');
  click(t.w, dd.querySelector('[data-pcr-add]')); await wait(40); click(t.w, dd.querySelector('[data-pcr-add]')); await wait(40);
  const rows = [...dd.querySelectorAll(':scope > [data-rep-new]')];
  ok(rows.length === 2 && /^0/.test(rows[0].style.borderTop) && /1px solid/.test(rows[1].style.borderTop), 'new dropdowns: no line above the first one, a thin line above the next ones');
  ok(rows.every(r => !r.querySelector('[data-acc-body]').hidden), 'new dropdowns are open in edit mode');
  const rk = dd.getAttribute('data-rep'); t.d.getElementById('cms-save').click(); await wait(400);
  const w2 = t.writes.find(x => x.body && x.body.element_id === rk), st2 = w2 && JSON.parse(w2.body.content_value);
  ok(st2 && st2.order.length === 2 && Object.keys(st2.news).length === 2, 'SAVE stores the new dropdowns of an empty list');
  const nid = st2.order[0], tKey = [...rows[0].querySelectorAll('[data-cms]')][0].getAttribute('data-cms');
  const vis = load([{ element_id: rk, content_type: 'text', content_value: JSON.stringify(st2) }, { element_id: tKey, content_type: 'text', content_value: 'Saved dropdown title' }]); await wait(250);
  const vdd = panelsOf(vis.d).find(p => /Permeable Pavers/.test(p.querySelector('h3').textContent)).querySelector('[data-dd-empty]');
  ok(vdd.querySelectorAll(':scope > [data-rep-new]').length === 2 && /Saved dropdown title/.test(vdd.textContent), 'visitor: the saved dropdowns appear in the group');
  const dl = t.d.querySelector('a[data-pc-file][data-cms-link]'); ok(!!dl, 'the "Download submittal" link has its own link key');
  click(t.w, dl); await wait(40); ok(!!t.d.querySelector('#cms-linked #cl-up') && !!t.d.querySelector('#cms-linked #cl-url'), 'clicking it in edit mode opens the link editor with "upload a file"');
  // edit mode shows only the tab you are on (not all tabs one under the other), and it keeps the tab you were on
  const ed2 = load([], true); await wait(300); click(ed2.w, tabsOf(ed2.d)[1]); await wait(40); ed2.d.getElementById('cms-toggle').click(); await wait(100);
  const shown = panelsOf(ed2.d).filter(p => p.style.display !== 'none');
  ok(shown.length === 1 && shown[0].getAttribute('data-grp-panel') === '1', 'edit mode: only the tab you were on (Pavers) is shown, the others are hidden');
  click(ed2.w, tabsOf(ed2.d)[3]); await wait(40);
  ok(panelsOf(ed2.d).filter(p => p.style.display !== 'none').length === 1 && panelsOf(ed2.d)[3].style.display === 'block', 'edit mode: switching tabs shows only that tab');
  // regression: the tabs of a page are NOT a list of the generic add / remove (an old saved list of tab panels, "New text" copies, must not appear)
  const bad = { element_id: 'rep-txt-permeable-pavers-f9fe', content_value: JSON.stringify({ order: [keys[3], keys[4], 'n9cv43'], news: { n9cv43: keys[3] } }) };
  const badTxt = { element_id: keys[3] + '~n9cv43', content_value: 'New text' };
  const rg = load([bad, badTxt], true); await wait(300); rg.d.getElementById('cms-toggle').click(); await wait(80);
  ok(panelsOf(rg.d).length === tabs0.length && panelsOf(rg.d)[0].querySelector('h3').textContent.trim() === 'Walls' && !/New text/.test(panelsOf(rg.d).map(p => p.textContent).join('|')), 'edit mode: the first tab still shows its own content (no "New text" copy of a tab panel)');
  ok(!rg.d.querySelector('[data-grp-panel] ~ .pcr-addhost') && !panelsOf(rg.d).some(p => p.querySelector(':scope > .pcr-x')), 'tab panels have no generic Remove / Add item buttons');
  ok(t.errors.length === 0, 'no script errors' + (t.errors.length ? ': ' + t.errors[0] : ''));
  console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
})();
