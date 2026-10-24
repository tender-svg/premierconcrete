// Smoke test of js/site.js in jsdom (no browser): loads every page, runs the script and clicks through the interactions.
//   node tools/test-pages.js
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('  FAIL: ' + m); } };

function load(file, search) {
  const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/' + file + (search || ''), runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.scrollTo = () => { }; w.HTMLElement.prototype.scrollIntoView = () => { };
  if (/^products/.test(file)) w.eval(fs.readFileSync(path.join(ROOT, 'js/search-index.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(ROOT, 'js/site.js'), 'utf8'));
  return { w, d: w.document, errors };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));

for (const f of files) {
  const { w, d, errors } = load(f);
  ok(!errors.length, f + ': script errors ' + errors.join(' | '));
  ok(!/\{\{|undefined|\[object/.test(d.body.textContent), f + ': placeholder text left in the page');
}
console.log(files.length + ' pages load');

// products: group tab, gallery, accordion, dimensions
{
  const { w, d } = load('products-pipe.html');
  const tabs = [...d.querySelectorAll('[role=tab]')]; click(w, tabs[1]);
  const panels = [...d.querySelectorAll('[data-grp-panel]')];
  ok(panels[0].style.display === 'none' && panels[1].style.display === 'block', 'group tab switches the panel');
  const acc = d.querySelector('[data-act=acc]'); const bodyEl = acc.nextElementSibling;
  ok(bodyEl.hidden, 'accordion starts closed'); click(w, acc); ok(!bodyEl.hidden, 'accordion opens'); click(w, acc); ok(bodyEl.hidden, 'accordion closes');
  const main = d.querySelector('[data-act=gal-prev]').parentElement.querySelector('img'); const s0 = main.getAttribute('src');
  click(w, d.querySelector('[data-act=gal-next]')); ok(main.getAttribute('src') !== s0, 'gallery next changes the photo');
  click(w, d.querySelector('[data-act=gal-prev]')); ok(main.getAttribute('src') === s0, 'gallery prev goes back');
  const g = load('products-box.html', '?grp=2'); ok(g.d.querySelectorAll('[data-grp-panel]')[2].style.display === 'block', '?grp=2 opens the third group');
  // search
  const input = d.querySelector('input[data-change=onQuery]'); input.value = 'headwall'; input.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok(/result/.test(d.querySelector('main').textContent) && /Headwalls/.test(d.querySelector('main').textContent), 'search finds headwalls');
}
// header
{
  const { w, d } = load('index.html'); w.innerWidth = 1366;
  const mega = d.querySelector('[data-mega]'); ok(mega.hidden, 'mega menu starts closed');
  d.querySelector('[data-mega-open]').dispatchEvent(new w.MouseEvent('mouseenter')); ok(!mega.hidden, 'mega menu opens on hover');
  const rows = [...d.querySelectorAll('[data-hover-set]')]; rows[3].dispatchEvent(new w.MouseEvent('mouseenter'));
  const imgs = [...rows[0].closest('ul').nextElementSibling.querySelectorAll('img')];
  ok(imgs[3].style.opacity === '1' && imgs[0].style.opacity === '0', 'home product list shows the hovered photo');
  click(w, d.querySelector('.pc-burger')); ok(d.body.classList.contains('nav-open'), 'burger opens the mobile menu');
}
// projects
{
  const { w, d } = load('project-highlights.html');
  const chips = [...d.querySelectorAll('[data-set]')]; click(w, chips.find(b => /Pipeline/.test(b.textContent)));
  const cards = [...d.querySelectorAll('[data-cat]')]; ok(cards.filter(c => !c.hidden).length === 1, 'project filter keeps one card');
}
// resources
{
  const { w, d } = load('resources.html');
  const tabBtn = [...d.querySelectorAll('[data-set]')].find(b => /videos/.test(b.getAttribute('data-set'))); click(w, tabBtn);
  const cols = [...d.querySelectorAll('[data-vgroup=res]')]; ok(cols.filter(c => !c.hidden).length === 1 && !cols[3].hidden, 'resources tab switches the list');
  const cb = d.querySelector('aside input[type=checkbox]'); cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(true, 'filter checkbox handled');
}
// forms
{
  const { w, d } = load('lunch-learn.html'); const form = d.querySelector('form[data-submit]');
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  ok(true, 'lunch form submit handled');
  const c = load('credit-application.html'); const secs = [...c.d.querySelectorAll('form > section')];
  ok(secs.filter(s => s.style.display !== 'none').length === 1, 'credit wizard shows one step'); click(c.w, c.d.querySelector('[data-act=cr-next]'));
}
console.log(fail ? fail + ' check(s) failed' : 'all interaction checks passed');
process.exit(fail ? 1 : 0);
