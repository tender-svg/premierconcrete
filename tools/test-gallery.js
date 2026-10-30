// jsdom test of the photo gallery of a product page in the live editor (js/pc-gallery.js with js/cms.js + js/site.js) on products-bridges.html:
// changing / removing the big photo changes / removes its thumbnail too, and visitors get the saved photos. The backend is a stub that RECORDS writes.
//   node tools/test-gallery.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const PAGE = 'products-bridges';
function load(rows, admin) {
  const html = fs.readFileSync(path.join(ROOT, PAGE + '.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + PAGE + '.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; url = String(url);
    if (/api\/upload/.test(url)) return res({ url: '/images/new-photo.webp' });
    if (o.method === 'POST') { writes.push({ url, body: o.body ? JSON.parse(o.body) : null }); return res({}); }
    if (/admin\/status/.test(url)) return res({ loggedIn: !!admin, role: 'admin', username: 'test' });
    if (new RegExp('page-elements/' + PAGE + '$').test(url)) return res(rows || []);
    return res([]);
  };
  for (const f of ['js/site.js', 'js/pc-dialog.js', 'js/cms.js', 'js/pc-gallery.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { w, d: w.document, errors, writes };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const thumbs = d => [...d.querySelectorAll('[data-gal] button[data-set] img[data-gal-thumb]')];
const mainOf = d => d.querySelector('img[data-gal-main]');
const counter = d => mainOf(d).parentElement.querySelector('span[data-cms-type="text"]').textContent;
(async () => {
  let t = load([]); await wait(250);
  let th = thumbs(t.d); ok(th.length === 4 && th.every(i => /^img-.*-s\d$/.test(i.getAttribute('data-cms'))), 'every thumbnail has its own image key (<big photo key>-s<n>)');
  ok(!!mainOf(t.d) && counter(t.d) === '1 / 4', 'the big photo is marked; counter 1 / 4');

  // admin: go to the 3rd photo and change it with the real "Change image" flow
  t = load([], true); await wait(300); t.d.getElementById('cms-toggle').click(); await wait(80);
  th = thumbs(t.d); const keys = th.map(i => i.getAttribute('data-cms')), old = th.map(i => i.getAttribute('src'));
  ok(!t.w.PCCMS.badges().some(b => th.includes(b.el)), 'no "Change image" badge sits on the thumbnails (only on the big photo)');
  click(t.w, th[2].closest('button')); await wait(40);
  ok(mainOf(t.d).getAttribute('src') === old[2], 'the 3rd thumbnail shows its photo in the big photo');
  const badge = t.w.PCCMS.badges().find(b => b.el === mainOf(t.d) && b.kind === 'img').b; click(t.w, badge); await wait(30);
  const picker = [...t.d.querySelectorAll('input[type=file]')].pop(); Object.defineProperty(picker, 'files', { value: [{ name: 'photo.png' }] });
  picker.dispatchEvent(new t.w.Event('change')); await wait(120);
  click(t.w, t.d.querySelector('#cms-confirm .yes')); await wait(80);
  th = thumbs(t.d);
  ok(th[2].getAttribute('src') === '/images/new-photo.webp' && mainOf(t.d).getAttribute('src') === '/images/new-photo.webp', 'Change image: the 3rd thumbnail AND the big photo show the new photo');
  ok(th[0].getAttribute('src') === old[0] && th[1].getAttribute('src') === old[1] && th[3].getAttribute('src') === old[3], 'the other thumbnails are untouched');
  ok(counter(t.d) === '3 / 4', 'the counter stays at 3 / 4');
  t.d.getElementById('cms-save').click(); await wait(400);
  const W = t.writes.map(x => x.body).filter(Boolean);
  ok(W.some(b => b.element_id === keys[2] && b.content_type === 'image' && b.content_value === '/images/new-photo.webp' && b.page_slug === PAGE), 'SAVE stores the new photo under the key of that thumbnail');
  ok(!W.some(b => b.element_id === mainOf(t.d).getAttribute('data-cms')), 'the big photo\'s own key is not written any more');

  // admin: remove the 2nd photo
  t = load([], true); await wait(300); t.d.getElementById('cms-toggle').click(); await wait(80);
  th = thumbs(t.d); const k2 = th.map(i => i.getAttribute('data-cms'));
  click(t.w, th[1].closest('button')); await wait(40);
  click(t.w, t.w.PCCMS.badges().find(b => b.el === mainOf(t.d) && b.kind === 'imgx').b); await wait(60);
  click(t.w, [...t.d.querySelectorAll('[class*="-yes"]')].pop()); await wait(80);
  ok(th[1].closest('button').hidden && thumbs(t.d).filter(i => !i.closest('button').hidden).length === 3, 'Remove image: the photo leaves the gallery (thumbnail hidden, 3 left)');
  ok(counter(t.d) === '2 / 3', 'the counter is 2 / 3 and the gallery shows the next photo');
  t.d.getElementById('cms-save').click(); await wait(400);
  ok(t.writes.map(x => x.body).filter(Boolean).some(b => b.element_id === k2[1] && b.content_value === '__none__'), 'SAVE stores the removed photo as __none__');

  // visitors
  const vis = load([{ element_id: k2[0], content_type: 'image', content_value: '/images/a.webp' }, { element_id: k2[2], content_type: 'image', content_value: '__none__' }, { element_id: k2[3], content_type: 'image', content_value: '/images/d.webp' }]); await wait(300);
  const vt = thumbs(vis.d), shown = vt.filter(i => !i.closest('button').hidden);
  ok(shown.length === 3 && vt[0].getAttribute('src') === '/images/a.webp' && vt[3].getAttribute('src') === '/images/d.webp' && vt[2].closest('button').hidden, 'visitor: saved photos are in the thumbnails, the removed one is hidden');
  ok(mainOf(vis.d).getAttribute('src') === '/images/a.webp' && counter(vis.d) === '1 / 3', 'visitor: the big photo shows the first (changed) photo, counter 1 / 3');
  click(vis.w, vis.d.querySelector('[data-act="gal-next"]')); click(vis.w, vis.d.querySelector('[data-act="gal-next"]')); await wait(30);
  ok(mainOf(vis.d).getAttribute('src') === '/images/d.webp' && counter(vis.d) === '3 / 3', 'visitor: the arrows skip the removed photo (3rd = last photo)');
  click(vis.w, vis.d.querySelector('[data-act="gal-next"]')); await wait(30);
  ok(mainOf(vis.d).getAttribute('src') === '/images/a.webp', 'visitor: after the last photo the gallery starts again');

  // older change of the big photo itself = the first photo; a newer first-photo change wins over it
  const mk = mainOf(t.d).getAttribute('data-cms');
  let lg = load([{ element_id: mk, content_type: 'image', content_value: '/images/legacy.webp' }]); await wait(300);
  ok(thumbs(lg.d)[0].getAttribute('src') === '/images/legacy.webp' && mainOf(lg.d).getAttribute('src') === '/images/legacy.webp', 'an older change of the big photo is read as the first photo');
  lg = load([{ element_id: mk, content_type: 'image', content_value: '/images/legacy.webp' }, { element_id: k2[0], content_type: 'image', content_value: '/images/newer.webp' }]); await wait(300);
  ok(thumbs(lg.d)[0].getAttribute('src') === '/images/newer.webp' && mainOf(lg.d).getAttribute('src') === '/images/newer.webp', 'a newer change of the first thumbnail wins over the older one');
  ok(![t, vis, lg].some(x => x.errors.length), 'no script errors' + ([t, vis, lg].map(x => x.errors[0]).filter(Boolean)[0] || ''));
  console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
})();
