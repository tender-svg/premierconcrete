#!/usr/bin/env node
/*
 * seed-content: puts the content of the design (Products = solutions, Project Highlights, Resources) into the premierconcrete site of the CMS backend,
 * so it can be edited from the dashboard and is drawn on the pages by js/pc-content.js.
 *
 *   PC_TEST_PASSWORD=... node tools/seed-content.js            (logs in as the test admin; PC_USER to use another admin)
 *   node tools/seed-content.js --dry-run                       (shows what would be created, writes nothing)
 *
 * Source of the texts / images: _original/index.original.html (the design) through tools/design-data.js. Images are NOT uploaded: the rows point to the
 * local files of the site (/images/...). Rows that already exist (same title / slug) are skipped, so it can be re-run. Only the backend API is used
 * (never the database directly) and only the premierconcrete site is touched.
 */
const D = require('./design-data');
const API = process.env.PC_API || 'https://cmsapi.qpaix.com/premierconcrete';
const USER = process.env.PC_USER || 'test@premierconcrete.com';
const PASS = process.env.PC_TEST_PASSWORD;
const DRY = process.argv.includes('--dry-run');

const prods = D.products(), projs = D.projects(), ress = D.resources();
let cookie = '';
async function call(method, url, body) {
  const headers = { Cookie: cookie }; let payload;
  if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(API + url, { method, headers, body: payload });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { /* not json */ }
  if (!r.ok) throw new Error(method + ' ' + url + ' -> ' + r.status + ' ' + text.slice(0, 200));
  return json;
}

(async () => {
  console.log('to seed:', prods.length, 'products (solutions),', projs.length, 'project highlights,', ress.length, 'resources');
  if (DRY) { console.log(JSON.stringify({ prods: prods.map(p => p.title), projs: projs.map(p => p.title), ress: ress.map(r => r.type + ' - ' + r.title) }, null, 1)); return; }
  if (!PASS) throw new Error('set PC_TEST_PASSWORD (the password of ' + USER + ')');
  const login = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
  if (!login.ok) throw new Error('login failed ' + login.status);
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('no session cookie');
  console.log('logged in as', USER);
  const have = async p => (await call('GET', p)) || [];

  // Products = solutions. The 9 categories keep their own page (custom_link = products-<id>.html); a solution made later in the Dashboard gets product-detail-<slug>.html
  const haveSol = new Map((await have('/api/v2/solutions')).map(s => [s.slug, s]));
  for (const p of prods) {
    if (haveSol.has(p.slug)) { console.log('skip solution', p.title); continue; }
    const created = await call('POST', '/api/v2/solutions', { title: p.title, slug: p.slug, short_description: p.text, icon_image_url: p.image, category: p.title, product_family: p.key, display_order: p.order });
    const id = created && created.solution && created.solution.id;
    if (id) await call('PATCH', '/api/v2/solutions/' + id, { custom_link: p.file });
    console.log('+ solution', p.title, '->', p.file);
  }
  const sols = new Map((await have('/api/v2/solutions')).map(s => [s.slug, s]));

  // Project highlights = stories (the extras live in result_text as JSON, like the other sites)
  const haveStories = new Set((await have('/api/v2/stories')).map(s => s.slug));
  for (const p of projs) {
    if (haveStories.has(p.slug)) { console.log('skip project', p.title); continue; }
    await call('POST', '/api/v2/stories', {
      title: p.title, slug: p.slug, location: p.location, application: p.owner, products_used: p.products, hero_image_url: p.images[0],
      challenge_text: p.challenge, solution_text: p.solution, project_benefits: '', published_date: new Date(Date.now() - p.order * 86400000).toISOString(),
      related_solution_id: (sols.get(p.product) || {}).id || null,
      result_text: JSON.stringify({ year: p.year, prod: p.product, tag: p.tag, excerpt: p.excerpt, images: p.images }),
    });
    console.log('+ project', p.title);
  }

  // Resources (the type decides the tab of the Resources page; "[product:slug,slug]" = the products it belongs to, none = general)
  const haveRes = new Set((await have('/api/v2/resources?all=true')).map(r => r.title + '|' + r.document_type));
  for (const r of ress) {
    if (haveRes.has(r.title + '|' + r.type)) { console.log('skip resource', r.title); continue; }
    const desc = (r.products.length ? '[product:' + r.products.join(',') + '] ' : '') + r.label;
    await call('POST', '/api/v2/resources', {
      title: r.title, document_type: r.type, description: desc, file_url: r.file, thumbnail_url: r.image,
      is_active: true, published_date: new Date(Date.now() - r.order * 3600000).toISOString(),
    });
    console.log('+ resource', r.type + ' - ' + r.title + (r.products.length ? ' (' + r.products.join(', ') + ')' : ''));
  }
  console.log('done.');
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
