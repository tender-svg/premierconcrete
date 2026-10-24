// jsdom test of js/pc-content.js with the REAL lists of the CMS (public GET only): the pages must show what the CMS holds.
//   node tools/test-content.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const API = process.env.PC_API || 'https://cmsapi.qpaix.com/premierconcrete';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
let DATA;
function load(file, search) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + file + (search || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  w.fetch = url => { const k = /api\/v2\/(solutions|stories|resources)/.exec(url); return k ? Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DATA[k[1]]) }) : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve([]) }); };
  for (const f of ['js/pc-static.js', 'js/site.js', 'js/pc-dialog.js', 'js/pc-edit.js', 'js/pc-content.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { w, d: w.document, errors };
}
(async () => {
  DATA = {}; for (const k of ['solutions', 'stories', 'resources']) DATA[k] = await (await fetch(API + '/api/v2/' + k)).json();
  console.log('CMS: ' + DATA.solutions.length + ' solutions, ' + DATA.stories.length + ' stories, ' + DATA.resources.length + ' resources');
  const titles = DATA.solutions.slice().sort((a, b) => a.display_order - b.display_order).map(s => s.title);

  let t = load('index.html'); await wait(150);
  ok(!t.errors.length, 'home: no script errors ' + t.errors.join('|'));
  const rows = [...t.d.querySelectorAll('li[data-dyn-item="hrows"]')];
  ok(rows.length === titles.length && rows.every((r, i) => r.textContent.includes(titles[i])), 'home list = the solutions of the CMS (' + rows.length + ')');
  ok([...t.d.querySelectorAll('[data-dyn-item="cats:footer"]')].map(x => x.textContent.trim()).join('|') === titles.join('|'), 'footer product list = solutions');
  ok([...t.d.querySelectorAll('[data-dyn-item="cats:header"]')].length === titles.length, 'mega menu has a column per solution');
  const sty0 = () => ''; const sty = i => rows[i].querySelector('button').getAttribute('style');
  ok(sty(0) !== sty(1) && sty(1) === sty(2) && sty(0).includes('color:var(--color-accent-700)'), 'home list: only the first row is highlighted at first');
  rows[2].querySelector('button').dispatchEvent(new t.w.MouseEvent('mouseenter'));
  ok(sty(2) === sty0(0) || sty(2) !== sty(1), 'home list: hovering a row moves the highlight to it');
  const imgs = [...rows[0].closest('ul').nextElementSibling.querySelectorAll('img')]; ok(imgs[2].style.opacity === '1', 'home hover list works after the redraw');

  t = load('products.html'); await wait(150);
  const cards = [...t.d.querySelectorAll('div[data-dyn-item="cats"]')]; ok(cards.length === titles.length && cards[1].textContent.includes(titles[1]), 'products page cards = solutions');
  ok(cards[0].querySelector('button').getAttribute('data-href') === 'products-pipe.html', 'card links to the category page (custom_link)');

  t = load('products-box.html'); await wait(150);
  const tabs = [...t.d.querySelectorAll('button[data-dyn-item="cats"]')]; ok(tabs.length === titles.length, 'category tabs = solutions');
  ok(tabs.filter(b => /color:var\(--color-accent-700\)/.test(b.getAttribute('style'))).length === 1, 'exactly one tab is active');

  t = load('contact.html'); await wait(150);
  ok([...t.d.querySelectorAll('option[data-dyn-item="cprods"]')].map(o => o.value).join('|') === titles.join('|'), 'contact form products = solutions');

  t = load('project-highlights.html'); await wait(150);
  const pc = [...t.d.querySelectorAll('button[data-dyn-item="pcards"]')]; ok(pc.length === DATA.stories.length, 'project cards = stories (' + pc.length + ')');
  ok(pc.every(c => /^project-highlight-.+\.html$/.test(c.getAttribute('data-href'))), 'cards link to project-highlight-<slug>.html');
  const chips = [...t.d.querySelectorAll('button[data-dyn-item="pfilters"]')]; ok(chips.length >= 2 && chips[0].textContent === 'All', 'filter chips: All + products that have a project');
  chips[1].click(); ok(pc.filter(c => !c.hidden).length >= 1 && pc.filter(c => !c.hidden).length < pc.length, 'a chip filters the cards');

  const slug = DATA.stories[0].slug; t = load('project-highlight.html', '?slug=' + slug); await wait(150);
  ok(t.d.querySelector('[data-pdetail] h2') && t.d.querySelector('[data-pdetail] h2').textContent === DATA.stories[0].title, 'project page shows the story');
  ok(t.d.querySelectorAll('[data-pdetail] [data-set]').length >= 2, 'project page has the photo thumbnails');
  t.d.querySelector('[data-act="pacc"]').click(); ok(true, 'project accordion handled');
  t = load('project-highlight.html', '?slug=nope'); await wait(100); ok(/not found/.test(t.d.querySelector('[data-pdetail]').textContent), 'unknown slug: not found message');

  t = load('resources.html'); await wait(250);
  ok(!t.errors.length, 'resources: no script errors ' + t.errors.join('|'));
  const col = n => [...t.d.querySelectorAll('[data-vgroup="res"]')].find(c => JSON.parse(c.getAttribute('data-vstate')).resTab === n);
  const count = n => col(n).querySelectorAll('[data-dyn-item]').length;
  const exp = f => DATA.resources.filter(r => f(r.document_type)).length;
  ok(count('sheets') === exp(x => x === 'Data Sheet'), 'datasheets tab = ' + exp(x => x === 'Data Sheet') + ' resources of the CMS');
  ok(count('downloads') === exp(x => !['Data Sheet', 'Webinar', 'Video', 'Blog Post', 'Technical Note'].includes(x)), 'downloads tab = brochures + forms');
  ok(count('videos') === exp(x => x === 'Video'), 'videos tab = videos');
  const boxes = [...t.d.querySelectorAll('aside input[type=checkbox]')]; ok(boxes.length === titles.length, 'filter = one checkbox per solution');
  boxes[0].checked = true; boxes[0].dispatchEvent(new t.w.Event('change', { bubbles: true }));
  const shown = [...col('sheets').querySelectorAll('[data-dyn-item]')].filter(e => !e.hidden).length; ok(shown > 0 && shown < count('sheets'), 'a product checkbox filters the list (' + shown + ' of ' + count('sheets') + ')');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
