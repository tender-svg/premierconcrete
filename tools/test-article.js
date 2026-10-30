// jsdom test: the blog and webinar pages are editable in the live editor (real js/cms.js: sign in -> "Switch to edit"): title, text blocks, photos in the text
// (a real image with Change image, not "[image: ...]" text), card photo + banner photo (two images), and a template for a new blog post / webinar.
// The backend is a stub that RECORDS writes.
//   node tools/test-article.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const BODY = 'Intro heading\nFirst paragraph.\n\n[image: /images/pcp/pipe-handler.webp | A caption]\n\nSecond paragraph.\n\n[image: | ]';
const RES = [
  { id: 'b1', title: 'Test Blog', document_type: 'Blog Post', description: '[product:pipe-culverts] Short blog text\n\n[page]\n\n' + BODY, thumbnail_url: '/images/pcp/pipe-stack.webp', file_url: '', is_active: true, published_date: '2026-10-01T00:00:00Z' },
  { id: 'w1', title: 'Test Webinar', document_type: 'Webinar', description: '[product:pipe-culverts] Short webinar text\n\n[page]\n\n[meta: Duration | 30 minutes]\n\n' + BODY, thumbnail_url: '/images/pcp/pipe-stack.webp', file_url: '', is_active: true, published_date: '2026-10-02T00:00:00Z' }
];
const SOLS = [{ id: 's1', slug: 'pipe-culverts', title: 'Pipe Culverts', short_description: 'x', icon_image_url: '', display_order: 0, is_active: true, custom_link: 'products-pipe.html' }];
function load(file, route, admin) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/' + route, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; w.scrollTo = () => { };
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true });
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; url = String(url); const m = o.method || 'GET';
    if (m !== 'GET') { writes.push({ m, url: url.replace(/^.*\/api\/v2\//, ''), body: o.body && typeof o.body === 'string' ? JSON.parse(o.body) : null }); return res({}); }
    if (/admin\/status/.test(url)) return res({ loggedIn: !!admin, role: 'admin', username: 'test' });
    if (/api\/v2\/resources/.test(url)) return res(RES);
    if (/api\/v2\/solutions/.test(url)) return res(SOLS);
    return res([]);
  };
  for (const f of ['js/pc-static.js', 'js/site.js', 'js/pc-dialog.js', 'js/pc-edit.js', 'js/pc-content.js', 'js/cms.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  w.PCE.pickFile = () => Promise.resolve({ name: 'a.png' }); w.PCE.upload = () => Promise.resolve('/images/changed.webp');
  return { w, d: w.document, errors, writes };
}
const input = (w, el, text) => { el.textContent = text; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
(async () => {
  for (const [kind, file, route, title] of [['blog', 'blog-details.html', 'blog-test-blog.html', 'Test Blog'], ['webinar', 'webinar-details.html', 'webinar-test-webinar.html', 'Test Webinar']]) {
    // visitors: the empty photo block of a template is not shown, the real photo is
    let t = load(file, route, false); await wait(300);
    ok(!t.d.querySelector('[contenteditable="true"]') && t.d.querySelectorAll('.ar-content img').length === 1 && !/\[image:/.test(t.d.querySelector('.ar-content').textContent), kind + ': a visitor sees the text with its photo, no raw [image: ...] text, nothing editable');
    t = load(file, route, true); await wait(400);
    ok(!t.d.querySelector('[data-article] [contenteditable="true"]'), kind + ': preview mode: nothing editable yet');
    t.d.getElementById('cms-toggle').click(); await wait(200);
    const ti = t.d.querySelector('.ar-title[contenteditable="true"]'), bo = [...t.d.querySelectorAll('.seg-text[contenteditable="true"]')];
    ok(!!ti && bo.length === 2, kind + ': after "Switch to edit" the title and the text blocks are editable');
    ok(!/\[meta:/.test(t.d.querySelector('.ar-content').textContent), kind + ': no raw [meta: ...] text in the blocks');
    if (kind === 'webinar') {
      const mv = t.d.querySelector('[data-metav]'); ok(!!mv && !!t.d.querySelector('[data-metak]') && !!t.d.querySelector('[data-metaadd]'), 'webinar: the facts (Duration ...) are editable in the facts grid, with ＋ Fact');
      input(t.w, mv, '45 minutes');
    }
    ok(t.d.querySelectorAll('.seg-bar-last').length === 1, kind + ': one "＋ Text / ＋ Image" bar is always visible (the others show on hover)');
    ok(!t.d.querySelector('.art-short') && !t.d.querySelector('[data-ins-img]'), kind + ': the "Short text" and "Insert image in the text" boxes are gone');
    ok(!!t.d.querySelector('[data-eact="photo"]') && !!t.d.querySelector('[data-seg-banner]') && !!t.d.querySelector('[data-eact="del"]'), kind + ': card photo, banner photo and delete page are there (two images)');
    ok(!/\[image:/.test(t.d.querySelector('.ar-content').textContent), kind + ': no raw [image: ...] text in edit mode');
    let figs = [...t.d.querySelectorAll('.seg-img')];
    ok(figs.length === 2 && figs[0].querySelector('img') && /Change image/.test(figs[0].textContent) && !figs[1].querySelector('img') && /Add image/.test(figs[1].textContent), kind + ': photos of the text are real images with "Change image" (an empty block has "Add image")');
    figs[0].querySelector('[data-seg-photo]').click(); await wait(80);
    ok(/changed\.webp/.test(t.d.querySelector('.seg-img img').getAttribute('src')), kind + ': Change image shows the new photo in the text');
    t.d.querySelector('[data-seg-banner]').click(); await wait(80);
    ok(/changed\.webp/.test(t.d.querySelector('.wb-hero > img').getAttribute('src')) && /pipe-stack/.test((t.d.querySelector('.ar-thumb') || t.d.querySelector('.ar-img img')).getAttribute('src')), kind + ': Change banner photo changes the top band, the card photo stays (two images)');
    t.d.querySelector('.seg-bar [data-seg-addimg]').click(); await wait(80);
    ok(t.d.querySelectorAll('.seg-img').length === 3, kind + ': "＋ Image" adds a photo block');
    input(t.w, t.d.querySelector('.ar-title[contenteditable="true"]'), title + ' EDITED'); input(t.w, t.d.querySelector('.seg-text[contenteditable="true"]'), 'Changed body text.');
    t.d.getElementById('cms-save').click(); await wait(500);
    const p = t.writes.find(x => x.m === 'PATCH' && /^resources\//.test(x.url)), dsc = p ? p.body.description : '';
    ok(p && p.body.title === title + ' EDITED' && /Changed body text\./.test(dsc) && /\[page\]/.test(dsc) && /\[image: \/images\/changed\.webp \| A caption\]/.test(dsc) && /\[banner: \/images\/changed\.webp\]/.test(dsc) && (kind === 'blog' || /\[meta: Duration \| 45 minutes\]/.test(dsc)), kind + ': SAVE patches the title, the text, the photos and the banner in one resource');
    ok(!t.errors.length, kind + ': no script errors' + (t.errors[0] ? ': ' + t.errors[0] : ''));
  }
  // a new webinar / blog post starts with a template (text + an empty photo block); visitors do not see empty photo blocks
  for (const [tab, label] of [['webinars', 'About the session'], ['blog', 'Heading of the first section']]) {
    const t = load('resources.html', 'resources.html', true); await wait(500); t.d.getElementById('cms-toggle').click(); await wait(300);
    const add = [...t.d.querySelectorAll('[data-eact="add"]')].find(b => b.getAttribute('data-tab') === tab); ok(!!add, tab + ': "New" button');
    add.click(); await wait(100); t.d.getElementById('cms-save').click(); await wait(600);
    const post = t.writes.find(x => x.m === 'POST' && /^resources$/.test(x.url));
    ok(post && post.body.description.indexOf(label) >= 0 && post.body.description.indexOf('[image: | ]') >= 0, tab + ': a new item starts with the template (' + label + ' ... + an empty photo block)');
  }
  console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
})();
