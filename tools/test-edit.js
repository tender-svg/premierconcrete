// jsdom test of the inline editing (js/pc-edit.js + js/pc-content.js) in EDIT MODE. The backend is a stub: every write is only RECORDED, nothing is sent anywhere.
// The lists are the real ones of the CMS (read with GET once).
//   node tools/test-edit.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const API = process.env.PC_API || 'https://cmsapi.qpaix.com/premierconcrete';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
let DATA;
function load(file, search) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [], hooks = {};
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + file + (search || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, configurable: true });   // (jsdom has no innerText)
  w.PCCMS = { editing: true, admin: true, registerHook: (id, h) => { hooks[id] = h; }, refresh() { }, reapply() { } };
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; const m = o.method || 'GET', k = /api\/v2\/(solutions|stories|resources)/.exec(url);
    if (m !== 'GET') { writes.push({ m, url: String(url).replace(/^.*\/api\/v2\//, ''), body: o.body ? JSON.parse(o.body) : null }); return res({ solution: { id: 'new-id' } }); }
    if (/page-elements/.test(url)) return res([]);
    return k ? res(DATA[k[1]]) : res([]);
  };
  for (const f of ['js/pc-static.js', 'js/site.js', 'js/pc-dialog.js', 'js/pc-edit.js', 'js/pc-content.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { w, d: w.document, errors, writes, hooks };
}
const input = (w, el, text) => { el.textContent = text; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const saveAll = async t => { for (const h of Object.values(t.hooks)) if (h.count() > 0) await h.run(); };
const confirmYes = async t => { await wait(30); const y = t.d.querySelector('#rgd-ov .rgd-yes'); if (y) y.click(); await wait(30); };
(async () => {
  DATA = {}; for (const k of ['solutions', 'stories', 'resources']) DATA[k] = await (await fetch(API + '/api/v2/' + k)).json();
  DATA.resources = DATA.resources.concat([{ id: 'blog-1', title: 'Test Blog', document_type: 'Blog Post', description: '[product:pipe-culverts] Short text\n\n[page]\n\nFirst paragraph.\n\n- Point one: details', file_url: '', thumbnail_url: '', published_date: '2026-10-01T00:00:00Z', is_active: true, is_deleted: false }]);
  const s0 = DATA.solutions.slice().sort((a, b) => a.display_order - b.display_order)[0];

  // ---- products page
  let t = load('products.html'); await wait(200);
  ok(!t.errors.length, 'products: no script errors ' + t.errors.join('|'));
  const cards = [...t.d.querySelectorAll('div[data-dyn-item="cats"]')];
  const title = cards[0].querySelector('[data-e="title"]'); ok(title && title.getAttribute('contenteditable') === 'true', 'product title is editable in edit mode');
  input(t.w, title, 'Pipe Culverts EDITED'); await saveAll(t);
  const p = t.writes.find(x => x.m === 'PATCH' && x.url === 'solutions/' + s0.id);
  ok(p && p.body.title === 'Pipe Culverts EDITED' && p.body.custom_link === 'products-pipe.html', 'SAVE patches the solution (title + keeps its page link)');
  t = load('products.html'); await wait(200);
  click(t.w, t.d.querySelector('[data-addhost="sol"] [data-eact="add"]')); await wait(30);
  ok(t.d.querySelectorAll('div[data-dyn-item="cats"]').length === DATA.solutions.length + 1, 'a new product card appears');
  await saveAll(t); const post = t.writes.find(x => x.m === 'POST' && x.url === 'solutions');
  ok(post && post.body.title === 'New product' && post.body.slug && post.body.display_order > 0, 'SAVE creates the new solution');
  t = load('products.html'); await wait(200);
  click(t.w, t.d.querySelectorAll('div[data-dyn-item="cats"]')[1].querySelector('[data-eact="del"]')); await confirmYes(t); await saveAll(t);
  ok(t.writes.some(x => x.m === 'DELETE' && x.url === 'solutions/' + DATA.solutions.slice().sort((a, b) => a.display_order - b.display_order)[1].id), 'delete asks for confirmation, SAVE deletes the solution');

  // ---- project highlights: list + page
  t = load('project-highlights.html'); await wait(200);
  const pc = [...t.d.querySelectorAll('div[data-dyn-item="pcards"]')]; ok(pc.length === DATA.stories.length, 'project cards are editable divs');
  input(t.w, pc[0].querySelector('[data-e="title"]'), 'Edited project'); await saveAll(t);
  ok(t.writes.some(x => x.m === 'PATCH' && /^stories\//.test(x.url) && x.body.title === 'Edited project' && /"images"/.test(x.body.result_text)), 'SAVE patches the story (images kept)');
  t = load('project-highlight.html', '?slug=' + DATA.stories[0].slug); await wait(200);
  const h2 = t.d.querySelector('[data-pdetail] h2[data-e="title"]'); ok(!!h2, 'project page title is editable');
  input(t.w, t.d.querySelector('[data-e="challenge"]'), 'New challenge text'); await saveAll(t);
  ok(t.writes.some(x => x.m === 'PATCH' && x.body.challenge_text === 'New challenge text'), 'project page: challenge text saved');
  click(t.w, t.d.querySelector('[data-eact="rmarr"]')); await wait(20); await saveAll(t);
  ok(t.writes.some(x => x.m === 'PATCH' && JSON.parse(x.body.result_text).images.length === DATA.stories[0].result_text.split('/images/').length - 2), 'removing a photo is saved');

  // ---- resources
  t = load('resources.html'); await wait(250);
  const col = [...t.d.querySelectorAll('[data-vgroup="res"]')].find(c => JSON.parse(c.getAttribute('data-vstate')).resTab === 'sheets');
  const first = col.querySelector('[data-dyn-item]'); const rt = first.querySelector('[data-e="title"]'); ok(!!rt, 'resource title is editable');
  input(t.w, rt, 'Edited sheet'); await saveAll(t);
  const rp = t.writes.find(x => x.m === 'PATCH' && /^resources\//.test(x.url));
  ok(rp && rp.body.title === 'Edited sheet' && rp.body.document_type === 'Data Sheet' && /^\[product:/.test(rp.body.description), 'SAVE patches the resource (type + product kept)');
  t = load('resources.html'); await wait(250);
  const col2 = [...t.d.querySelectorAll('[data-vgroup="res"]')].find(c => JSON.parse(c.getAttribute('data-vstate')).resTab === 'videos');
  click(t.w, col2.querySelector('[data-eact="add"]')); await wait(30); await saveAll(t);
  const rn = t.writes.find(x => x.m === 'POST' && x.url === 'resources'); ok(rn && rn.body.document_type === 'Video', 'a new video resource is created with the type of its tab');

  // ---- blog page
  t = load('blog-details.html', '?slug=test-blog'); await wait(250);
  ok(!!t.d.querySelector('[data-article] h2[data-e="title"]'), 'blog page: title editable');
  input(t.w, t.d.querySelector('[data-e="body"]'), 'Edited text of the page'); await saveAll(t);
  const bp = t.writes.find(x => x.m === 'PATCH' && x.url === 'resources/blog-1'); ok(bp && /\[page\]\s*Edited text of the page/.test(bp.body.description) && /^\[product:pipe-culverts\] Short text/.test(bp.body.description), 'blog page: short text + [page] text saved in one description');

  // ---- solution page (groups are page elements)
  t = load('solution-reference.html', '?slug=' + s0.slug); await wait(250);
  ok(!!t.d.querySelector('[data-soltpl] h2[data-e="title"]'), 'solution page: title editable');
  click(t.w, t.d.querySelector('[data-tgroup]')); await wait(20);
  click(t.w, t.d.querySelector('[data-tadd]')); await wait(20);
  ok(t.hooks.soltpl && t.hooks.soltpl.count() === 1, 'solution page: add group / item is an unsaved change');
  await t.hooks.soltpl.run();
  const pe = t.writes.find(x => x.m === 'POST' && x.url === 'page-elements'); const g = pe && JSON.parse(pe.body.content_value);
  ok(pe && pe.body.page_slug === 'product-detail-' + s0.slug && pe.body.element_id === 'tpl-groups' && g[0].items.length === 1, 'solution page: groups saved as page element tpl-groups');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
