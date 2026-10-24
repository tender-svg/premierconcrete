// Backend contract test for the live editor (through the dev server, node tools/dev-server.js must be running on :5181).
// Writes ONE throwaway page ("zz-test-cms") and removes exactly the rows it made (page elements + history of that slug) with the .env key. Nothing else is touched.
const fs = require('fs'), path = require('path');
const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = 'http://127.0.0.1:5181', SLUG = 'zz-test-cms';
const EMAIL = process.env.PC_TEST_EMAIL || 'test@premierconcrete.com', PASS = process.env.PC_TEST_PASSWORD;
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const lr = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: EMAIL, password: PASS }) });
  ok(lr.ok, 'login ' + lr.status);
  const cookie = (lr.headers.getSetCookie ? lr.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  const H = { 'Content-Type': 'application/json', Cookie: cookie };
  const st = await (await fetch(BASE + '/api/admin/status', { headers: H })).json(); ok(st.loggedIn === true, 'status loggedIn');
  const post = await fetch(BASE + '/api/v2/page-elements', { method: 'POST', headers: H, body: JSON.stringify({ page_slug: SLUG, element_id: 'txt-test-0001', content_type: 'text', content_value: '<b>Saved by the test</b>' }) });
  ok(post.ok, 'save element ' + post.status);
  const rows = await (await fetch(BASE + '/api/v2/page-elements/' + SLUG)).json();
  ok(Array.isArray(rows) && rows.some(r => r.element_id === 'txt-test-0001' && /Saved by the test/.test(r.content_value)), 'saved text is public (anonymous GET)');
  const hist = await fetch(BASE + '/api/v2/history', { method: 'POST', headers: H, body: JSON.stringify({ page_slug: SLUG, snapshot: { 'txt-test-0001': { type: 'text', value: 'x' } }, changed_keys: ['txt-test-0001'] }) });
  ok(hist.ok, 'history ' + hist.status);
  await fetch(BASE + '/api/admin/logout', { method: 'POST', headers: H });
  // cleanup: only the rows of the throwaway slug (page row -> its elements and history, found by page_id)
  const R = { apikey: env.NEW_SUPABASE_KEY, Authorization: 'Bearer ' + env.NEW_SUPABASE_KEY };
  const rest = (method, p, extra) => fetch(env.NEW_SUPABASE_URL + '/rest/v1/' + p, { method, headers: Object.assign({}, R, extra || {}) }).then(r => r.json().catch(() => null));
  const pg = (await rest('GET', 'cms_pages?select=id&slug=eq.' + SLUG, { 'Accept-Profile': 'premier_concrete' })) || [];
  for (const p of pg) {
    for (const t of ['cms_page_elements', 'cms_page_history']) { const j = await rest('DELETE', t + '?page_id=eq.' + p.id, { 'Content-Profile': 'premier_concrete', Prefer: 'return=representation' }); console.log('cleanup ' + t + ': ' + (Array.isArray(j) ? j.length : 'error') + ' row(s)'); }
    const j = await rest('DELETE', 'cms_pages?id=eq.' + p.id + '&slug=eq.' + SLUG, { 'Content-Profile': 'premier_concrete', Prefer: 'return=representation' }); console.log('cleanup cms_pages: ' + (Array.isArray(j) ? j.length : 'error') + ' row(s)');
  }
  console.log(fail ? fail + ' failed' : 'all ok'); process.exit(fail ? 1 : 0);
})();
