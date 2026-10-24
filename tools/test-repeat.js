// jsdom test of "add / remove the items of a list" + photo slots (js/pc-repeat.js with js/cms.js) on the team page. The backend is a stub that RECORDS writes.
//   node tools/test-repeat.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function load(file, rows, admin) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + file, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, configurable: true });
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; url = String(url);
    if (o.method === 'POST') { writes.push({ url, body: o.body ? JSON.parse(o.body) : null }); return res({}); }
    if (/admin\/status/.test(url)) return res({ loggedIn: !!admin, role: 'admin', username: 'test' });
    if (/page-elements\/our-team$/.test(url)) return res(rows || []);
    return res([]);
  };
  for (const f of ['js/pc-dialog.js', 'js/cms.js', 'js/pc-repeat.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { w, d: w.document, errors, writes };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
(async () => {
  // what the build marked
  let t = load('our-team.html'); await wait(150);
  const lists = [...t.d.querySelectorAll('[data-rep]')]; ok(lists.length >= 3, 'the team page has ' + lists.length + ' lists marked for add / remove');
  const team = lists.find(l => /Cody Colvin/.test(l.textContent) && l.querySelectorAll(':scope > [data-rep-item]').length >= 3); ok(!!team, 'the people list is marked');
  const key = team.getAttribute('data-rep'), ids = [...team.querySelectorAll(':scope > [data-rep-item]')].map(e => e.getAttribute('data-rep-item'));
  const slotImg = t.d.querySelector('img[data-slot]'); ok(slotImg && /^slot-/.test(slotImg.getAttribute('data-cms')) && slotImg.hidden, 'the empty photo frame ("Photo coming soon") has a hidden photo slot with its own key');
  ok(!/Photo coming soon/.test([...t.d.querySelectorAll('[data-cms]')].map(e => e.textContent).join('|')), '"Photo coming soon" is not an editable text any more');

  // visitors: saved structure (remove the 2nd person, add a copy) + the texts of the new one
  const nid = 'nabc1';
  const nameKey = [...team.querySelector(':scope > [data-rep-item]').querySelectorAll('[data-cms]')].find(e => /Cody/.test(e.textContent)).getAttribute('data-cms');
  const rows = [{ element_id: key, content_type: 'text', content_value: JSON.stringify({ order: [ids[0], nid, ids[2]], news: { [nid]: ids[0] } }) }, { element_id: nameKey + '~' + nid, content_type: 'text', content_value: 'New Person' }];
  t = load('our-team.html', rows); await wait(200);
  const team2 = t.d.querySelector('[data-rep="' + key + '"]'), items2 = [...team2.querySelectorAll(':scope > [data-rep-item], :scope > [data-rep-new]')];
  ok(items2.length === 3 && items2[1].getAttribute('data-rep-new') === nid && !items2.some(e => e.getAttribute('data-rep-item') === ids[1]), 'visitor: the removed person is gone and the added one is in its place');
  ok(items2[1].textContent.includes('New Person') && !items2[1].textContent.includes('Cody'), 'visitor: the added person shows its own saved text');
  ok(items2[0].textContent.includes('Cody') && items2[0].querySelector('[data-cms="' + nameKey + '"]'), 'visitor: the other people are untouched');

  // admin: edit mode, remove + add + SAVE
  t = load('our-team.html', [], true); await wait(250);
  t.d.getElementById('cms-toggle').click(); await wait(60);
  const team3 = t.d.querySelector('[data-rep="' + key + '"]');
  ok(team3.querySelectorAll(':scope > [data-rep-item] > .pcr-x').length === ids.length && !!team3.querySelector('[data-pcr-add]'), 'edit mode: every person has a Remove button and the list an Add button');
  click(t.w, team3.querySelectorAll(':scope > [data-rep-item]')[1].querySelector('.pcr-x')); await wait(40);
  const yes = t.d.querySelector('#rgd-ov .rgd-yes, #pcd-ov .pcd-yes, [class*="-yes"]'); ok(!!yes, 'removing asks for confirmation'); yes.click(); await wait(40);
  ok(team3.querySelectorAll(':scope > [data-rep-item]').length === ids.length - 1, 'the person is removed from the page');
  click(t.w, team3.querySelector('[data-pcr-add]')); await wait(40);
  const added = team3.querySelector(':scope > [data-rep-new]'); ok(!!added && /New text/.test(added.textContent), 'a new person (copy of the first one, placeholder texts) is added');
  ok(added.querySelector('[data-cms]').getAttribute('data-cms').indexOf('~') > 0, 'the texts of the new person have their own keys (<key>~<id>)');
  ok(added.querySelector('img[data-cms]') ? added.querySelector('img[data-cms]').hidden : true, 'the new person has no photo yet (Add image)');
  t.d.getElementById('cms-save').click(); await wait(300);
  const rep = t.writes.find(x => x.body && x.body.element_id === key); const st = rep && JSON.parse(rep.body.content_value);
  ok(st && st.order.length === ids.length && st.order.indexOf(ids[1]) < 0 && Object.keys(st.news).length === 1 && rep.body.page_slug === 'our-team', 'SAVE stores the structure of the list (order, removed, added) as one page element');
  ok(t.writes.some(x => x.body && /~/.test(x.body.element_id) && x.body.content_value === 'New text'), 'SAVE stores the texts of the new person');

  // photos: remove + add
  t = load('our-team.html', [], true); await wait(250); t.d.getElementById('cms-toggle').click(); await wait(60);
  const badges = [...t.d.querySelectorAll('.cms-img-badge')].map(b => b.textContent); ok(badges.some(x => /Remove image/.test(x)) && badges.some(x => /Add image/.test(x)), 'photos have "Remove image"; the empty frame has "Add image"  [' + [...new Set(badges)].join(' | ') + ']');
  const rm = [...t.d.querySelectorAll('.cms-img-x')].find(b => true); click(t.w, rm); await wait(40);
  t.d.getElementById('cms-save').click(); await wait(300);
  ok(t.writes.some(x => x.body && x.body.content_type === 'image' && x.body.content_value === '__none__'), 'a removed photo is saved as "__none__"');
  // visitors: a removed photo is hidden, a slot with a saved photo shows it
  const ph = [...load('our-team.html').d.querySelectorAll('img[data-cms]')].find(i => !i.hasAttribute('data-slot')).getAttribute('data-cms');
  t = load('our-team.html', [{ element_id: ph, content_type: 'image', content_value: '__none__' }, { element_id: slotImg.getAttribute('data-cms'), content_type: 'image', content_value: 'images/client/jumbo-v-block-1.webp' }]); await wait(200);
  ok(t.d.querySelector('img[data-cms="' + ph + '"]').hidden, 'visitor: a removed photo is hidden');
  const s2 = t.d.querySelector('img[data-slot]'); ok(!s2.hidden && s2.getAttribute('src') === 'images/client/jumbo-v-block-1.webp' && s2.parentElement.classList.contains('pcr-has-img'), 'visitor: a photo added to an empty frame shows (the "coming soon" text is hidden)');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
