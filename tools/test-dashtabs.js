// jsdom test of Dashboard > Products > "Edit tabs and their data" (js/dashboard-tabs.js with js/dashboard.js). The backend is a stub that RECORDS writes (nothing is sent).
//   node tools/test-dashtabs.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SOLS = [
  { id: 's1', slug: 'hardscapes', title: 'Hardscapes', short_description: 'x', icon_image_url: '', display_order: 0, is_active: true, custom_link: 'products-hardscapes.html' },
  { id: 's2', slug: 'new-thing', title: 'New Thing', short_description: 'y', icon_image_url: '', display_order: 1, is_active: true, custom_link: '' }
];
async function run(savedRows) {
  const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/dashboard.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; const m = o.method || 'GET'; url = String(url);
    if (m !== 'GET') { writes.push({ m, url, body: o.body && typeof o.body === 'string' ? JSON.parse(o.body) : null }); return res({ message: 'ok' }); }
    if (/admin\/status/.test(url)) return res({ loggedIn: true, role: 'admin', username: 'test' });
    if (/api\/v2\/solutions/.test(url)) return res(SOLS);
    if (/api\/v2\/stories|api\/v2\/resources/.test(url)) return res([]);
    if (/page-elements\//.test(url)) return res(/products-hardscapes/.test(url) ? (savedRows || []) : []);
    if (/products-hardscapes\.html/.test(url)) return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(fs.readFileSync(path.join(ROOT, 'products-hardscapes.html'), 'utf8')) });
    return res([]);
  };
  w.scrollTo = () => { }; w.Element.prototype.scrollIntoView = () => { };
  for (const f of ['js/pc-dialog.js', 'js/dashboard.js', 'js/dashboard-tabs.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  await wait(300);
  return { w, d, errors, writes };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
(async () => {
  let t = await run([]); const { w, d } = t;
  click(w, d.querySelector('[data-go="solutions"]')); await wait(100);
  click(w, d.querySelector('#main [data-edit]')); await wait(40);
  const btn = d.querySelector('[data-tabs-edit]'); ok(!!btn, 'the product form has "Edit tabs and their data"');
  click(w, btn); await wait(300);
  const groups = [...d.querySelectorAll('#dtGroups > .dt-group[data-gkey]')];
  ok(groups.length >= 5, 'the page file is read: ' + groups.length + ' tabs');
  ok(/Walls/.test(groups[0].querySelector('summary b').textContent), 'tab 1 is "' + groups[0].querySelector('summary b').textContent + '"');
  const titleInput = groups[0].querySelector('.dt-fields > .dt-f input[type=text]'); ok(!!titleInput && /Walls/.test(titleInput.value), 'the title of a tab is a field');
  const linkFields = [...d.querySelectorAll('#dtGroups [data-t="link"]')]; ok(linkFields.length > 0, 'the "Download submittal" links are fields with file upload (' + linkFields.length + ')');
  ok(!!d.querySelector('#dtGroups [data-dtup] input[type=file]'), 'photos / files can be uploaded');
  const lists = [...d.querySelectorAll('#dtGroups .dt-list[data-rep]')]; ok(lists.length >= 5 && lists.some(l => /Dropdowns/.test(l.textContent)), 'dropdowns and bullets of every tab are listed (' + lists.length + ' lists)');
  const pav = groups.find(g => /Permeable Pavers/.test(g.querySelector('summary b').textContent)), pavList = pav && pav.querySelector('.dt-list[data-rep^="rep-dd-"]');
  ok(!!pavList && !!pavList.querySelector('[data-dt-add]'), 'a tab without dropdowns (Permeable Pavers) can get a dropdown');

  // edit: change a title, add a dropdown to the empty tab, remove one tab, add a new tab, SAVE
  const key = titleInput.getAttribute('data-k'); titleInput.value = 'Walls and Retaining';
  click(w, pavList.querySelector('[data-dt-add]')); await wait(30);
  const newItem = pavList.querySelector('.dt-item[data-new]'); ok(!!newItem, 'Add dropdown: a new dropdown form appears');
  const nid = newItem.getAttribute('data-id'); newItem.querySelector('input[type=text]').value = 'Open-cell pavers';
  click(w, groups[1].querySelector('[data-dt-srm]')); ok(groups[1].classList.contains('dt-gone'), 'Remove tab: the tab is marked as removed (can be restored)');
  const removedKey = groups[1].getAttribute('data-gkey');
  click(w, d.querySelector('[data-dt-gadd]')); await wait(30);
  const x = d.querySelector('#dtGroups > .dt-group[data-x]'); ok(!!x, 'Add tab: a new tab form appears');
  x.querySelector('[data-k="name"]').value = 'Caps'; x.querySelector('[data-k="desc"]').value = 'Wall caps.';
  click(w, d.getElementById('dtSave')); await wait(400);
  const W = t.writes.filter(q => q.url.endsWith('/api/v2/page-elements')).map(q => q.body);
  ok(W.some(b => b.page_slug === 'products-hardscapes' && b.element_id === key && b.content_value === 'Walls and Retaining'), 'SAVE writes the changed title under its key');
  const rep = W.find(b => b.element_id === pavList.getAttribute('data-rep')), st = rep && JSON.parse(rep.content_value);
  ok(st && st.order.length === 1 && st.order[0] === nid && st.news[nid], 'SAVE writes the structure of the dropdown list (order + added)');
  ok(W.some(b => /~/.test(b.element_id) && b.content_value === 'Open-cell pavers'), 'SAVE writes the texts of the new dropdown under key~id');
  ok(W.some(b => /~/.test(b.element_id) && b.content_type === 'image' && b.content_value === '__none__'), 'the new dropdown starts without the photo of the first one');
  const gs = W.find(b => b.element_id === 'grp-struct'), gj = gs && JSON.parse(gs.content_value);
  ok(gj && gj.removed.length === 1 && gj.removed[0] === removedKey && gj.extra.length === 1 && gj.extra[0].name === 'Caps', 'SAVE writes the removed tab and the new tab (grp-struct)');
  ok(!!t.writes.find(q => /history/.test(q.url)), 'the change is written to the change history');
  ok(!t.d.getElementById('dtModal'), 'the editor closes after SAVE');

  // saved data comes back: new tab + added dropdown + removed tab
  t = await run([{ element_id: 'grp-struct', content_value: JSON.stringify(gj) }, { element_id: pavList.getAttribute('data-rep'), content_value: JSON.stringify(st) }, { element_id: rep && W.find(b => /~/.test(b.element_id) && b.content_value === 'Open-cell pavers').element_id, content_value: 'Open-cell pavers' }]);
  click(t.w, t.d.querySelector('[data-go="solutions"]')); await wait(100); click(t.w, t.d.querySelector('#main [data-edit]')); await wait(40); click(t.w, t.d.querySelector('[data-tabs-edit]')); await wait(300);
  const g2 = [...t.d.querySelectorAll('#dtGroups > .dt-group[data-gkey]')];
  ok(g2.length === groups.length, 'reopened: static tabs are all listed (removed ones can be restored)');
  ok(g2.filter(g => g.getAttribute('data-removed') === '1').length === 1 && g2.find(g => g.getAttribute('data-removed') === '1').getAttribute('data-gkey') === removedKey && [...t.d.querySelectorAll('#dtGroups > .dt-group[data-x]')].length === 1, 'reopened: the new tab is back');
  ok(/Open-cell pavers/.test(t.d.querySelector('#dtGroups').textContent) || [...t.d.querySelectorAll('#dtGroups input[type=text]')].some(i => i.value === 'Open-cell pavers'), 'reopened: the added dropdown shows its saved text');

  // an automatic page (product-detail-<name>): tabs = tpl-groups
  t = await run([]); click(t.w, t.d.querySelector('[data-go="solutions"]')); await wait(100);
  click(t.w, t.d.querySelectorAll('#main [data-edit]')[1]); await wait(40); click(t.w, t.d.querySelector('[data-tabs-edit]')); await wait(200);
  click(t.w, t.d.querySelector('[data-dt-gadd]')); await wait(30);
  const tx = t.d.querySelector('#dtGroups > .dt-group[data-x]'); tx.querySelector('[data-k="name"]').value = 'Group A';
  click(t.w, t.d.getElementById('dtSave')); await wait(300);
  const tw = t.writes.map(q => q.body).find(b => b && b.element_id === 'tpl-groups'), tj = tw && JSON.parse(tw.content_value);
  ok(tw && tw.page_slug === 'product-detail-new-thing' && tj.length === 1 && tj[0].name === 'Group A', 'a product with an automatic page: SAVE writes tpl-groups');
  ok(!t.errors.length && !t.errors.length, 'no script errors' + (t.errors[0] ? ': ' + t.errors[0] : ''));
  console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
})();
