// jsdom test of dashboard.html + js/dashboard.js. The backend is a stub that only RECORDS writes (nothing is sent); the lists are the real ones of the CMS (GET once).
//   node tools/test-dashboard.js
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const API = process.env.PC_API || 'https://cmsapi.qpaix.com/premierconcrete';
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const D = {}; for (const [k, u] of [['solutions', 'solutions'], ['stories', 'stories'], ['resources', 'resources?all=true']]) D[k] = await (await fetch(API + '/api/v2/' + u)).json();
  const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8').replace(/<link[^>]*>/g, '').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
  const errors = [], writes = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: 'http://localhost/dashboard.html', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window, d = w.document;
  const res = b => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(b), text: () => Promise.resolve(JSON.stringify(b)) });
  w.fetch = (url, o) => {
    o = o || {}; const m = o.method || 'GET'; url = String(url);
    if (m !== 'GET') { writes.push({ m, url, body: o.body && typeof o.body === 'string' ? JSON.parse(o.body) : null }); return res({ solution: { id: 'new-sol', slug: 'x' }, message: 'ok' }); }
    if (/admin\/status/.test(url)) return res({ loggedIn: true, role: 'admin', username: 'test' });
    if (/api\/v2\/solutions/.test(url)) return res(D.solutions);
    if (/api\/v2\/stories/.test(url)) return res(D.stories);
    if (/api\/v2\/resources/.test(url)) return res(D.resources);
    if (/email-config/.test(url)) return res({ smtp_host: '', cc_emails: [] });
    return res([]);
  };
  w.scrollTo = () => { };
  for (const f of ['js/pc-dialog.js', 'js/dashboard.js']) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  await wait(300);
  const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const go = k => click(d.querySelector('[data-go="' + k + '"]'));
  ok(!errors.length, 'no script errors ' + errors.join('|'));
  const side = [...d.querySelectorAll('#side button')].map(b => b.textContent.replace(/\d+$/, '').trim());
  ok(['Products', 'Project Highlights', 'Resources', 'Change History', 'Email Configuration', 'Pending Approvals', 'Team & Access'].every(x => side.some(s => s.startsWith(x))) && !side.some(s => /Application/.test(s)), 'sidebar: Products, Project Highlights, Resources, settings; no Applications  [' + side.join(' | ') + ']');

  go('solutions'); await wait(100);
  ok(d.querySelectorAll('#main tbody tr').length === D.solutions.length, 'Products list shows the ' + D.solutions.length + ' solutions');
  click(d.querySelector('#main [data-edit]')); await wait(30);
  const f = d.querySelector('#editor [name=title]'); ok(f && f.value === 'Pipe Culverts', 'edit form is filled (title)');
  ok(!!d.querySelector('#editor [name=custom_link]') && d.querySelector('#editor [name=custom_link]').value === 'products-pipe.html', 'edit form shows the page it opens');
  f.value = 'Pipe Culverts X'; d.getElementById('editor').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(100);
  const pw = writes.find(x => x.m === 'PATCH' && /api\/v2\/solutions\//.test(x.url));
  ok(pw && pw.body.title === 'Pipe Culverts X' && pw.body.custom_link === 'products-pipe.html' && !/\[Images/.test(pw.body.short_description), 'Save patches the solution (title, link, clean description)');
  click(d.querySelector('#main [data-add]')); await wait(30);
  d.querySelector('#editor [name=title]').value = 'Test Product'; d.getElementById('editor').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(100);
  const ps = writes.find(x => x.m === 'POST' && /api\/v2\/solutions$/.test(x.url)); ok(ps && ps.body.title === 'Test Product' && ps.body.slug === 'test-product', 'Add creates a solution with its slug');

  go('stories'); await wait(100);
  ok(d.querySelectorAll('#main tbody tr').length === D.stories.length, 'Project Highlights list shows the stories');
  click(d.querySelector('#main [data-edit]')); await wait(30);
  ok(d.querySelector('#editor [name=excerpt]') && d.querySelector('#editor [name=year]').value === '2024' && d.querySelector('#editor [name=images__0]').value.length > 0, 'story form has the short text, year and photos');
  d.getElementById('editor').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(100);
  const st = writes.find(x => x.m === 'PATCH' && /api\/v2\/stories\//.test(x.url)); const x = st && JSON.parse(st.body.result_text);
  ok(x && x.year === '2024' && x.prod === 'box-culverts' && x.images.length === 4 && x.excerpt, 'story saved in the same format as the website (result_text json)');

  go('resources'); await wait(100);
  const tabs = [...d.querySelectorAll('[data-rtab]')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); ok(tabs.length === 7, 'Resources tabs: ' + tabs.join(', '));
  click(d.querySelector('[data-rtab="datasheets"]')); await wait(30);
  ok(d.querySelectorAll('#main tbody tr').length === D.resources.filter(r => r.document_type === 'Data Sheet').length, 'Technical Datasheets tab lists the data sheets');
  click(d.querySelector('[data-rtab="videos"]')); await wait(30); click(d.querySelector('#main [data-add]')); await wait(30);
  ok(d.querySelector('#editor [name=document_type]').value === 'Video', '+ Add in the Videos tab starts with type Video');
  d.querySelector('#editor [name=title]').value = 'Test video'; d.getElementById('editor').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(100);
  const pr = writes.find(x => x.m === 'POST' && /api\/v2\/resources$/.test(x.url)); ok(pr && pr.body.document_type === 'Video' && !/\[product:/.test(pr.body.description), 'new resource: type Video, general (no product marker)');
  click(d.querySelector('[data-rtab="all"]')); await wait(30);
  const sel = d.querySelector('[data-rprodsel]'); sel.value = 'box-culverts'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(30);
  ok(d.querySelectorAll('#main tbody tr').length > 0 && d.querySelectorAll('#main tbody tr').length < D.resources.length, 'product filter narrows the resources');
  const row = D.resources.find(r => /^\[product:pipe-culverts,box-culverts\]/.test(r.description || ''));
  if (row) { sel.value = 'all'; sel.dispatchEvent(new w.Event('change', { bubbles: true })); await wait(30); const q = d.getElementById('q'); q.value = row.title; q.dispatchEvent(new w.Event('input', { bubbles: true })); await wait(30);
    click(d.querySelector('#main [data-edit]')); await wait(30); const ps2 = d.querySelector('#editor [name=product]'); ok(ps2 && ps2.value === 'pipe-culverts,box-culverts', 'a resource of several products keeps its value in the form');
    d.getElementById('editor').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(100);
    const pu = writes.filter(x => x.m === 'PATCH' && /api\/v2\/resources\//.test(x.url)).pop(); ok(pu && /^\[product:pipe-culverts,box-culverts\]/.test(pu.body.description), 'saving it does not lose the second product'); }
  w.document.querySelector('#modal').hidden = true;
  go('email'); await wait(100);
  const recInput = d.getElementById('smtp-recipient-email');
  ok(recInput, 'Email Configuration: Recipient Email input (#smtp-recipient-email) exists');
  ok(d.body.textContent.includes('Recipient Email (Inquiry Inbox)'), 'Email Configuration: Recipient Email label is rendered');
  recInput.value = 'inquiry@premier-concrete.com';
  d.getElementById('emailForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); await wait(100);
  const pe = writes.filter(x => x.m === 'PUT' && /api\/v2\/email-config/.test(x.url)).pop();
  ok(pe && pe.body.recipient_email === 'inquiry@premier-concrete.com' && pe.body.from_email === 'inquiry@premier-concrete.com', 'Save sends recipient_email and from_email in PUT payload');
  ok(typeof w.renderSmtpConfigFields === 'function' && typeof w.loadEmailConfig === 'function', 'renderSmtpConfigFields and loadEmailConfig exported');
  const cc = [...d.querySelectorAll('[data-ccadd]')]; click(cc[0]); await wait(30);
  ok([...d.querySelectorAll('.db-checks input[data-cc="prod"]')].map(i => i.value).join('|') === D.solutions.sort((a, b) => a.display_order - b.display_order).map(s => s.title).join('|'), 'Email Configuration: CC products = the products of the site');
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
