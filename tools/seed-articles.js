#!/usr/bin/env node
/*
 * seed-articles: one Blog Post and one Webinar-type page for the Resources section, written ONLY from real Premier Concrete material:
 *   - Blog Post "Precast Bridges ...": the client's own text "Precast Bridges.docx" (editor notes in brackets left out) and the facts of the client's case study
 *     "CaseStudy PCP__Cypress Bayou.pdf" (LA 148 over Cypress Bayou Tributary, Jackson Parish, Louisiana).
 *   - Webinar-type page "Lunch & Learn ...": the text of the site's own Lunch & Learn page (what the program is, how it works, the topics = the products).
 *     The real website has no online webinars, so this is the program that exists; its button opens the request form (lunch-learn.html).
 * Created through the backend API exactly like Dashboard > Resources does (description = [product:slug] short text + a line [page] + the page text).
 * Page text format: a block = lines without a blank line; a short first line followed by text in the same block = a sub-heading; lines starting with
 * "•" in one block = a list (shown as numbered cards); [image: /images/x.webp | caption] = a picture. Re-running updates the two items (no duplicates).
 *
 *   PC_TEST_PASSWORD=... node tools/seed-articles.js
 */
const API = process.env.PC_API || 'https://cmsapi.qpaix.com/premierconcrete';
const USER = process.env.PC_USER || 'test@premierconcrete.com';
const PASS = process.env.PC_TEST_PASSWORD;
const text = blocks => blocks.map(b => Array.isArray(b) ? b.join('\n') : b).join('\n\n');

const BLOG = {
  title: 'Precast Bridges: Faster Replacement from a Controlled Plant Environment',
  type: 'Blog Post',
  product: 'precast-bridges',
  thumb: '/images/bridges/cypress-bayou-side.webp',
  short: 'How off-site fabrication of deck panels, bent caps and approach slabs shortens road closures, with the LA 148 bridge over Cypress Bayou as a Premier Concrete project example.',
  body: text([
    ['Why precast for bridges', 'Precast bridges are among the most cost-effective and time-saving methods used in accelerated bridge construction. Manufacturing bridge elements in the controlled environment of a precast concrete plant provides numerous advantages to bridge owners, contractors, and the traveling public. The controlled environment enhances quality control during production using fabricated forms, resulting in improved geometry and more accurate dimensions.'],
    'Off-site fabrication of precast bridge components reduces roadway closure time when an existing structure must be removed and replaced. This is often a priority for bridge owners and users because it minimizes traffic disruptions and reduces user costs. In many cases, site preparation and pile driving can proceed while bridge superstructures and bent caps are being fabricated, allowing for timely delivery and accelerated project completion.',
    '[image: /images/bridges/deck-panels.webp | Precast bridge components]',
    ['Louisiana bridges', 'Louisiana has approximately 13,000 bridges statewide and is considered to have one of the highest bridge densities in the nation, with nearly 20 bridges per 100 miles of public roadway. Approximately 50% of Louisiana\'s bridges are owned by parishes and municipalities. Since many of these structures are short-span bridges, precast bridge systems are gaining increased interest among owners and contractors due to their ease of construction, reduced project duration, and overall cost savings.'],
    ['What can be precast',
      '• Bridge deck panels: Short-span bridges often use longitudinal, full-depth deck panels joined to form the complete bridge width and span length. These bridges may be surfaced with asphalt, although many designs do not require an overlay, and the railing may be cast integrally with the exterior panel or on site. Partial-depth deck panels, supported by girders, reduce the cast-in-place concrete required and serve as stay-in-place forms for the deck topping.',
      '• Bent caps: Precast bent caps minimize field forming of both large and small cap sections. Intermediate bent caps and abutment caps, with or without wingwalls, can be precast and delivered directly to the construction site. Extra-long caps may be fabricated in segments and joined in the field through closure pours.',
      '• Approach slabs: Bridge approach slabs can be fabricated as precast segments like precast deck spans and in accordance with LADOTD standards.',
      '• Wharves: Many wharves and elevated dock structures share design and detailing characteristics with bridge structures. Owners and designers frequently specify precast deck panels and caps, including heavily reinforced members for industrial loading conditions.',
      '• Movable concrete barriers: Premier Concrete maintains a substantial inventory of precast concrete barriers, enabling prompt delivery to meet customer needs and project schedules.'],
    '[image: /images/bridges/cypress-bayou-bent-caps.webp | Precast bridge elements]',
    ['Project example: LA 148 over Cypress Bayou', 'This project replaced an old bridge at LA 148 over the Cypress Bayou Tributary in Jackson Parish, Louisiana. The new bridge consisted of three 20-foot-long precast deck panels, 24 feet wide, with precast caps and steel pipe piles. It was designed by Volkert, Inc. and constructed by Boh Bros. Construction for the Office of Louisiana Highway Construction. It was Premier Concrete Products\' first bridge production, made of LADOTD precast deck panels and caps.'],
    'Premier Concrete Products fabricated all of the precast panels and caps and transported them to the job site, where the contractor erected the caps over the piles and then installed the panels before completing the project by casting the approach slabs in place.',
    ['• Challenge: The caps had transverse and longitudinal slopes on their tops, which made them harder to cast. The abutment caps required wingwalls cast as a secondary pour, and the wait for the concrete to reach strength delayed shipment.',
      '• Innovation: Delays were kept to a minimum through communication with the LADOTD inspectors and their collaboration in granting a conditional acceptance, so that one of the caps could be shipped as soon as possible.'],
    'Talk to us about precast bridge components, bent caps and deck panels: +1 225.667.4545, or use the contact form of this website.',
  ]),
};

const WEBINAR = {
  title: 'Lunch & Learn: Have Lunch on Us and Learn About Premier Concrete Products',
  type: 'Webinar',
  product: '',
  file: 'lunch-learn.html',
  thumb: '/images/pcp/pipe-stack.webp',
  short: 'Our team comes to your office, brings lunch, and walks your group through the products you work with.',
  body: text([
    ['About the program', 'Have lunch on us and learn more about Premier Concrete Products at our Lunch & Learn program. Our team comes to your office, brings lunch, and walks your group through the products you work with.'],
    ['How it works',
      '• Request a date: Fill out the form with your group size and preferred dates.',
      '• We confirm: Our team contacts you to confirm the date and topics.',
      '• Lunch is on us: We bring lunch and present the products most relevant to your work.'],
    '[image: /images/pcp/pipe-handler.webp | Premier Concrete Products]',
    ['Topics you can choose from', '• Pipe Culverts', '• Box Culverts', '• Drainage & Site Solutions', '• Utility Structures', '• Precast Bridges', '• Erosion Control', '• Pipeline', '• Masonry', '• Hardscapes'],
    'Prefer to call? Reach the Louisiana plant office at +1 225.667.4545 or +1 800.575.7293, or the Texas sales office at +1 713.424.4642. To book a session, use the button on this page.',
  ]),
};

let cookie = '';
async function call(method, url, body) {
  const headers = { Cookie: cookie }; let payload;
  if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(API + url, { method, headers, body: payload });
  const t = await r.text(); let json = null; try { json = JSON.parse(t); } catch (e) { /* not json */ }
  if (!r.ok) throw new Error(method + ' ' + url + ' -> ' + r.status + ' ' + t.slice(0, 200));
  return json;
}
(async () => {
  if (!PASS) throw new Error('set PC_TEST_PASSWORD');
  const login = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: USER, password: PASS }) });
  if (!login.ok) throw new Error('login failed ' + login.status);
  cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const have = new Map(((await call('GET', '/api/v2/resources?all=true')) || []).map(r => [r.title + '|' + r.document_type, r]));
  for (const a of [BLOG, WEBINAR]) {
    const body = { title: a.title, document_type: a.type, description: (a.product ? '[product:' + a.product + '] ' : '') + a.short + '\n\n[page]\n\n' + a.body, file_url: a.file || '', thumbnail_url: a.thumb, is_active: true };
    const old = have.get(a.title + '|' + a.type);
    if (old) { await call('PATCH', '/api/v2/resources/' + old.id, body); console.log('updated', a.type, '-', a.title); continue; }
    await call('POST', '/api/v2/resources', Object.assign({ published_date: new Date().toISOString() }, body));
    console.log('+', a.type, '-', a.title);
  }
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
