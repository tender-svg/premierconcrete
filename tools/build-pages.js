#!/usr/bin/env node
/*
 * build-pages: turns the single-file design (_original/index.original.html - an "x-dc" component with state-driven
 * screens) into ONE STATIC HTML FILE PER PAGE, same look, no framework at run time.
 *
 *   node tools/build-pages.js
 *
 * How: the original component logic + template are run here in Node; every page is rendered once for its default
 * state. What the original switched by state is rendered so that js/site.js can switch it in the browser:
 *   - tabs / gallery / hover list / sliders: [data-vgroup][data-vstate] blocks (one per state) or small data-* hooks
 *   - product items and dimension tables: rendered open and hidden by default ([data-acc] ... [data-acc-body])
 * Images: "assets/<dir>/<name>.jpg" in the design is "images/<dir>/<name>.webp" here (see tools/convert-images.js).
 * Hover rules (style-hover) become CSS in css/site.css.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, '_original', 'index.original.html'), 'utf8');

// ------------------------------------------------------------------ pull the template and the logic out of the original
const tpl = SRC.slice(SRC.indexOf('<x-dc>') + 6, SRC.indexOf('</x-dc>'));
const scriptStart = SRC.indexOf('>', SRC.indexOf('data-dc-script')) + 1;
const script = SRC.slice(scriptStart, SRC.lastIndexOf('</script>'));
class DCLogic { }
const React = { createRef: () => ({ current: null }), createElement: (tag, p) => '<' + tag + ' class="' + p.className + '">' + p.dangerouslySetInnerHTML.__html + '</' + tag + '>' };
const win = { scrollTo() { }, ResizeObserver: undefined };
const Component = new Function('DCLogic', 'React', 'window', 'requestAnimationFrame', 'setInterval', 'clearInterval', 'clearTimeout', 'setTimeout',
  script + '\nreturn {Component, CATS, PROJECTS, CR_SECTIONS, TEAM};')(DCLogic, React, win, f => f(), () => 0, () => { }, () => { }, () => 0);
const { CATS, PROJECTS } = Component;
const Cmp = Component.Component;

const $tpl = cheerio.load(tpl, { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
const rootNodes = $tpl.root()[0].children;

// ------------------------------------------------------------------ pages
const NAME = 'Premier Concrete Products';
const PAGES = {
  home:     { file: 'index.html',               title: NAME + ' | Precast Concrete, Masonry & Erosion Control, Louisiana', desc: 'Premier Concrete Products manufactures precast concrete pipe, box culverts, drainage structures, masonry, hardscapes, bridges, pipeline mats and erosion control in Denham Springs, Louisiana.' },
  products: { file: 'products.html',            title: 'Products | ' + NAME, desc: 'Pipe culverts, box culverts, drainage and site solutions, utility structures, precast bridges, erosion control, pipeline, masonry and hardscapes from Premier Concrete Products.' },
  about:    { file: 'about.html',               title: 'About Us | ' + NAME, desc: 'Manufacturing concrete products in Louisiana since 1996.' },
  team:     { file: 'our-team.html',            title: 'Our Team | ' + NAME, desc: 'The people behind Premier Concrete Products.' },
  projects: { file: 'project-highlights.html',  title: 'Project Highlights | ' + NAME, desc: 'Premier Concrete Products projects: culverts, pipeline protection, hardscapes and more.' },
  resources:{ file: 'resources.html',           title: 'Resources | ' + NAME, desc: 'Brochures, technical datasheets, videos and downloads from Premier Concrete Products.' },
  lunch:    { file: 'lunch-learn.html',         title: 'Lunch & Learn | ' + NAME, desc: 'Request a Premier Concrete Products Lunch & Learn session for your team.' },
  credit:   { file: 'credit-application.html',  title: 'Apply for Credit | ' + NAME, desc: 'Apply for a credit account with Premier Concrete Products.' },
  contact:  { file: 'contact.html',             title: 'Contact Us | ' + NAME, desc: 'Contact Premier Concrete Products for pricing, availability, spec sheets or delivery.' },
};
const catFile = i => 'products-' + CATS[i].id + '.html';
const projFile = id => { const p = PROJECTS.find(x => x.id === id); return 'project-highlight-' + require('./design-data').slugify(p ? p.t : id) + '.html'; };   // the project page made from the template (same slug as the seeded story)
const VIEW_FILE = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.file]));

// ------------------------------------------------------------------ render helpers
const UNITLESS = new Set(['opacity', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'zIndex', 'lineHeight', 'order', 'aspectRatio', 'orphans', 'widows', 'zoom']);
const kebab = k => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
const styleStr = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => kebab(k) + ':' + (typeof v === 'number' && !UNITLESS.has(k) && v !== 0 ? v + 'px' : v)).join(';');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => esc(s).replace(/"/g, '&quot;');
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source']);
const getPath = (scope, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
const exprOf = s => { const m = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/.exec(s || ''); return m ? m[1] : null; };
const RAW_TAG = { 'sc-raw-table': 'table', 'sc-raw-thead': 'thead', 'sc-raw-tbody': 'tbody', 'sc-raw-tr': 'tr', 'sc-raw-th': 'th', 'sc-raw-td': 'td', 'sc-raw-select': 'select' };
const RAW_HTML_PATHS = /(^|\.)body$/;   // values that already are HTML (item body of the product pages)

// image paths: design "assets/x/y.jpg" -> "images/x/y.webp"; remote images are mapped by tools/convert-images.js (images/ext/<name>.webp)
const REMOTE = fs.existsSync(path.join(__dirname, 'remote-images.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'remote-images.json'), 'utf8')) : {};
const REMOTE_KEYS = Object.keys(REMOTE).sort((a, b) => b.length - a.length);
const imgPath = s => {
  s = String(s).replace(/&amp;/g, '&');
  if (/https?:\/\//.test(s)) for (const u of REMOTE_KEYS) if (s.includes(u)) s = s.split(u).join(REMOTE[u]);   // images of other sites -> the local copy (tools/convert-images.js)
  s = s.replace(/images\/ext\/premiere-concrete-logo-green-gray-standa-\w+\.webp/g, 'images/logo.webp')   // the logo files given by the client
    .replace(/images\/ext\/premiere-concrete-logo-white-retina-\w+\.webp/g, 'images/logo-white.webp');
  return s.replace(/assets\/([\w-]+\/[\w.-]+?)\.(?:jpe?g|png)\b/g, 'images/$1.webp').replace(/&/g, '&amp;');
};

const hoverRules = new Map(); // style-hover text -> class name
const hoverClass = css => { if (!hoverRules.has(css)) hoverRules.set(css, 'hv-' + (hoverRules.size + 1)); return hoverRules.get(css); };

function makeInstance(view, patch) {
  const inst = new Cmp();
  inst.props = { grayscalePhotos: false, quoteTray: false };
  inst.state = Object.assign({}, inst.state, { view }, patch || {});
  inst.__rec = null;
  inst.nav = (v, extra) => { inst.__rec = { show: v, extra: extra || {} }; };
  inst.setState = p => { const v = typeof p === 'function' ? p(inst.state) : p; if (inst.__rec && inst.__rec.show) inst.__rec.then = v; else inst.__rec = { set: v }; };   // goCat(i) followed by setState({grp}) = a link to that group tab
  return inst;
}
function descriptorOf(inst, fn) {
  inst.__rec = null;
  try { fn({ preventDefault() { }, stopPropagation() { }, target: { value: '', checked: false, type: 'text' } }); } catch (e) { /* ignore */ }
  return inst.__rec;
}
function targetOf(rec) {
  const x = rec.extra || {};
  if (rec.show === 'products') return x.cat == null ? PAGES.products.file : catFile(x.cat);
  return VIEW_FILE[rec.show] || null;
}

const VIEW_FLAGS = new Set(['isHome', 'isProducts', 'isAbout', 'isTeam', 'isProjects', 'isResources', 'isLunch', 'isCredit', 'isContact']);
const unhandled = new Set();
const BOOL_ATTRS = new Set(['required', 'disabled', 'readonly', 'multiple', 'selected', 'autofocus']);
// lists of the design that the CMS fills (solutions, project highlights, resources): the first element of every item is marked data-dyn-item="<list>[:header|footer]"
const DYN_LISTS = { cats: 'cats', hProdRows: 'hrows', phFilters: 'pfilters', phCards: 'pcards', resDocs: 'rdocs', resVideos: 'rvideos', resFilters: 'rfilters', contactProducts: 'cprods' };
// parts the design shows only while "open" (accordion rows, tables, filter groups): always rendered, hidden until js/site.js opens them
const OPENERS = new Set(['it.open', 'g.dOpen', 'c.ctOpen', 'ac.open', 'rf.open']);
const ALWAYS = new Set(['it.closed', 'ac.open', 'rf.open', 'sent', 'llSent', 'crSent', 'resEmpty']);   // + the "sent" screens of the forms and the "nothing matches" line
// handlers whose behaviour js/site.js implements by name (the last part of the {{ path }} in the design)
const ACTS = {
  galPrev: 'gal-prev', galNext: 'gal-next', phPrev: 'gal-prev', phNext: 'gal-next', toggleOpen: 'acc', toggleDims: 'acc-dims', toggleCatTable: 'acc-dims',
  hmPrev: 'hm-prev', hmNext: 'hm-next', closeMega: 'noop', stopProp: 'noop',
  resetForm: 'form-reset', llReset: 'form-reset', crReset: 'form-reset', crPrev: 'cr-prev', crNext: 'cr-next', resClear: 'res-clear',
};
const ACTS_FULL = { 'ac.toggle': 'acc', 'rf.toggle': 'acc' };

function renderAttrs(el, scope, inst, ctx) {
  const out = []; const tag = el.name;
  for (let [name, raw] of Object.entries(el.attribs)) {
    if (name.startsWith('hint-placeholder')) continue;
    if (name === 'sc-camel-no-validate') { out.push('novalidate'); continue; }
    if (name === 'sc-camel-view-box') name = 'viewBox';
    if (name === 'style-hover') { out.push('class-hv:' + hoverClass(raw)); continue; }
    if (name === 'ref') { if (/hmRef/.test(raw)) out.push('data-hm'); continue; }   // the markets slider on the home page
    const evt = /^sc-camel-on-(click|change|focus|submit|mouse-enter|mouse-leave)$/.exec(name);
    if (evt) {
      const e = exprOf(raw); const last = e ? e.split('.').pop() : '';
      if (evt[1] === 'click') {
        if (ACTS_FULL[e] || ACTS[last]) { out.push('data-act="' + (ACTS_FULL[e] || ACTS[last]) + '"'); continue; }
        const fn = e ? getPath(scope, e) : null; if (typeof fn !== 'function') continue;
        const rec = descriptorOf(inst, fn); if (!rec) { unhandled.add(e); continue; }
        if (rec.show) { const t = targetOf(rec); if (t) out.push('data-href="' + t + (rec.then && rec.then.grp ? '?grp=' + rec.then.grp : '') + '"'); else unhandled.add(e + ' -> ' + rec.show); }
        else if (rec.set) {
          const keys = Object.keys(rec.set);
          if (keys.includes('phOpen') && rec.set.phOpen) out.push('data-href="' + projFile(rec.set.phOpen) + '"');
          else if (keys.length === 1 && keys[0] === 'phOpen') out.push('data-href="' + PAGES.projects.file + '"');   // "back to all project highlights"
          else out.push("data-set='" + JSON.stringify(rec.set).replace(/'/g, '&#39;') + "'");
        }
        continue;
      }
      if (evt[1] === 'submit') { out.push('data-submit="' + (ctx.view || '') + '"'); continue; }
      if (evt[1] === 'change') { const e2 = exprOf(raw) || ''; out.push('data-change="' + escAttr(e2) + '"'); continue; }
      if (evt[1] === 'mouse-enter' || evt[1] === 'focus') {
        const fn = e ? getPath(scope, e) : null;
        if (typeof fn === 'function') { const rec = descriptorOf(inst, fn); if (rec && rec.set && (rec.set.hprod !== undefined)) out.push("data-hover-set='" + JSON.stringify(rec.set) + "'"); else if (rec && rec.set && rec.set.hmPaused) out.push('data-hm-pause'); else if (rec && rec.set && rec.set.megaOpen) out.push('data-mega-open'); else if (rec && rec.set && (rec.set.aboutOpen || rec.set.supportOpen)) out.push("data-dd-open='" + JSON.stringify(rec.set) + "'"); }
        continue;
      }
      continue;
    }
    if (BOOL_ATTRS.has(name)) { const e = exprOf(raw); const v = e ? getPath(scope, e) : raw; if (v && v !== 'false') out.push(name); continue; }   // required="{{ f.req }}" must not stay as an empty (= true) attribute
    if (name === 'checked') { const e = exprOf(raw); const v = e ? getPath(scope, e) : raw; if (v) out.push('checked'); continue; }
    if (name === 'value' && (tag === 'select' || tag === 'textarea')) continue;
    if (name === 'style' && exprOf(raw)) {
      const v = getPath(scope, exprOf(raw));
      if (v && typeof v === 'object') out.push('style="' + escAttr(styleStr(v)) + '"'); else if (typeof v === 'string') out.push('style="' + escAttr(v) + '"');
      continue;
    }
    const val = raw.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => { const v = getPath(scope, p); return v == null || v === false ? '' : escAttr(v); });
    out.push(name + '="' + imgPath(val) + '"');
  }
  return out.filter(Boolean);
}

function joinAttrs(parts) {
  // merge hover classes into one class attribute
  const hv = parts.filter(p => p.startsWith('class-hv:')).map(p => p.slice(9));
  const rest = parts.filter(p => !p.startsWith('class-hv:'));
  if (hv.length) {
    const i = rest.findIndex(p => p.startsWith('class="'));
    if (i >= 0) rest[i] = rest[i].replace(/"$/, ' ' + hv.join(' ') + '"'); else rest.push('class="' + hv.join(' ') + '"');
  }
  return rest.length ? ' ' + rest.join(' ') : '';
}

function renderNodes(nodes, scope, inst, ctx) { return nodes.map(n => renderNode(n, scope, inst, ctx)).join(''); }

function renderNode(n, scope, inst, ctx) {
  if (n.type === 'comment') return '';
  if (n.type === 'text') {
    return n.data.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => {
      const v = getPath(scope, p); if (v == null || v === false) return '';
      return RAW_HTML_PATHS.test(p) ? String(v) : esc(v);
    });
  }
  if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return '';
  let tag = n.name;
  if (tag === 'helmet') return '';   // design-tool head block (fonts + design-system css): the page head has its own links
  if (tag === 'x-dc') return renderNodes(n.children || [], scope, inst, ctx);
  if (tag === 'sc-if') {
    const p = exprOf(n.attribs.value); const v = p ? getPath(scope, p) : false;
    if (!v && !ALWAYS.has(p)) return '';
    if (VIEW_FLAGS.has(p)) {
      let idx = 0;
      return (n.children || []).map(c => {
        if (c.type !== 'tag') return renderNode(c, scope, inst, ctx);
        const html = renderNode(c, scope, inst, ctx); const i = idx++;
        return html.replace(/^<([a-zA-Z0-9]+)/, '<$1 data-sec="' + i + '"');
      }).join('');
    }
    let html = renderNodes(n.children || [], scope, inst, ctx);
    // parts the design shows only while open: rendered open here, hidden until js/site.js opens them
    if (p === 'megaOpen') html = html.replace(/^(\s*<div)/, '$1 data-mega hidden');
    else if (p === 'l.dropOpen') html = html.replace(/^(\s*<div)/, '$1 data-dd hidden');
    else if (OPENERS.has(p) && /^\s*<(div|p)[ >]/.test(html)) html = '<div data-acc-body hidden style="display:contents">' + html + '</div>';
    else if (p === 'sent' || p === 'llSent' || p === 'crSent') html = html.replace(/^(\s*<[a-z]+)/, '$1 data-sent hidden');       // thank-you screen of a form
    else if (p === 'notSent' || p === 'llNotSent' || p === 'crNotSent') html = html.replace(/^(\s*<[a-z]+)/, '$1 data-notsent');   // the form itself
    else if (p === 'resEmpty') html = html.replace(/^(\s*<[a-z]+)/, '$1 data-empty hidden');                                       // "no resources match the filters"
    else if (p === 'it.open') html = '<span data-ico="open" hidden>' + html + '</span>';   // minus icon of an open row
    else if (p === 'it.closed') html = '<span data-ico="closed">' + html + '</span>';      // plus icon of a closed row
    return html;
  }
  if (tag === 'sc-for') {
    const p = exprOf(n.attribs.list); const list = p ? getPath(scope, p) : [];
    const as = n.attribs.as || 'item';
    return (Array.isArray(list) ? list : []).map((item, i) => {
      let h = renderNodes(n.children || [], Object.assign({}, scope, { [as]: item, $index: i }), inst, ctx);
      if (DYN_LISTS[p] && !/^\s*<article/.test(h)) h = h.replace(/^(\s*<[a-zA-Z0-9]+)/, '$1 data-dyn-item="' + DYN_LISTS[p] + (ctx.in ? ':' + ctx.in : '') + '"');   // items drawn from the CMS by js/pc-content.js
      if (p === 'c.groups') h = h.replace(/^(\s*<div)(?![^>]*role=)/, '$1 data-grp-panel="' + i + '"');   // a group of a category page (tab panel)
      return h;
    }).join('');
  }
  if (tag === 'image-slot') {
    const g = k => (n.attribs[k] || '').replace(/\{\{\s*([\w.$]+)\s*\}\}/g, (m, p) => { const v = getPath(scope, p); return v == null ? '' : v; });
    const fit = g('fit') === 'contain' ? 'contain' : 'cover';
    return '<img src="' + escAttr(imgPath(g('src'))) + '" alt="' + escAttr(g('placeholder')) + '" loading="lazy" style="display:block;width:100%;height:100%;object-fit:' + fit + '">';
  }
  if (RAW_TAG[tag]) tag = RAW_TAG[tag];
  const attrs = joinAttrs(renderAttrs(n, scope, inst, ctx));
  if (VOID.has(tag)) return '<' + tag + attrs + '>';
  const cctx = (tag === 'header' || tag === 'footer') ? Object.assign({}, ctx, { in: tag }) : ctx;
  return '<' + tag + attrs + '>' + renderNodes(n.children || [], scope, inst, cctx) + '</' + tag + '>';
}

// ------------------------------------------------------------------ one page = one render of the view with the "everything open" state
function renderView(view, patch) {
  const inst = makeInstance(view, patch);
  const vals = inst.renderVals();
  const html = renderNodes(rootNodes, vals, inst, { view });
  return { html, inst };
}

const allItemIds = () => CATS.flatMap(c => c.groups.flatMap(g => g.items.filter(x => !x.heading).map(it => c.id + ':' + it.n)));
const allDimIds = () => CATS.flatMap(c => ['cat-' + c.id].concat(c.groups.map((g, gi) => c.id + '-' + gi)));
const OPEN_ALL = { aboutOpen: true, supportOpen: true, megaOpen: true };

const parse = html => cheerio.load('<div id="__root">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });

// the Lunch & Learn and Credit Application fields have no names in the design: js/site.js sends the forms to /api/contact by name
const slugName = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
function formNames($p, view) {
  if (view === 'lunch') {
    $p('form .field').each((i, el) => { const lab = $p(el).children('label').first().text().trim(), inp = $p(el).find('input,textarea').first(); if (lab && !inp.attr('name')) inp.attr('name', slugName(lab)); });
    $p('form label:has(input[type=checkbox])').each((i, el) => { const t = $p(el).text().trim(); $p(el).find('input').attr('name', 'topics').attr('value', t); });
  } else {
    const AGREE = [[/Terms &(?:amp;)? Conditions above/i, 'agreeTerms'], [/Guaranty above/i, 'agreeGuaranty'], [/Terms &(?:amp;)? General Conditions of Sale/i, 'agreeSale'], [/refunded/i, 'taxAck']];
    $p('form input[type=checkbox]').each((i, el) => { const t = $p(el).parent().text(); const a = AGREE.filter(x => x[0].test(t))[0]; if (a) $p(el).attr('name', a[1]); });
    // a file cannot be sent with the form: the design's own text asks to email the tax exempt certificate
    $p('form input[type=file]').each((i, el) => { $p(el).replaceWith('<span style="font-size:14px;line-height:1.5;color:var(--color-neutral-800)">Please email your signed Tax Exempt Certificate to <a href="mailto:credit@premier-concrete.com" style="font-weight:600">credit@premier-concrete.com</a> after you submit this application.</span>'); });
  }
}

function assemble(view, patch) {
  const r = renderView(view, Object.assign({}, OPEN_ALL, patch || {}));
  const $p = parse(r.html);
  $p('[data-sec]').each((i, el) => { delete el.attribs['data-sec']; });
  $p('[data-act="gal-prev"]').each((i, el) => { const w = $p(el).parent().parent(); if (w.length) w.attr('data-gal', ''); });   // the photo gallery of a category page: its thumbnails go below the photo on phones (css/site.css)
  if (view === 'lunch' || view === 'credit') formNames($p, view);
  // the title band of the team page had only the title: one intro line (made only of what the site itself says: the four groups of the page, Louisiana, since 1996); editable like every text
  if (view === 'team') $p('main h1').first().after('<p style="font-size:18px;line-height:1.6;margin:14px 0 0;max-width:1000px;color:var(--color-neutral-800)">Meet the people behind Premier Concrete Products. Our leadership, management, engineering and business development, and operations and administration teams work together to design, manufacture and deliver concrete products from Louisiana, the way we have since 1996.</p>');
  $p('article[data-screen-label]').filter((i, el) => /display:none/.test(el.attribs.style || '')).remove();   // category page: only the selected category
  return { html: chrome($p('#__root').html()).replace(/ class(?=[ >])/g, ''), inst: r.inst };
}

// header: mobile menu button in front of the main navigation (shown by css/site.css below 1100px)
function chrome(html) {
  // footer: "CMS Login" link in the bottom bar (before the social links)
  const link = 'color:#fff;text-decoration:none';
  html = html.replace('<a href="https://www.facebook.com/', '<a href="login.html" rel="nofollow" style="' + link + '">CMS Login</a>\n      <a href="https://www.facebook.com/');
  return html.replace('<nav style=', '<button class="pc-burger" aria-label="Open menu" aria-expanded="false" aria-controls="pc-nav"><span></span><span></span><span></span></button><nav id="pc-nav" style=');
}

// Resources page: one right-hand column per tab (vgroup "res"); every item carries the filters (Dashboard "sub" names) it belongs to,
// so js/site.js can apply the checkbox filters. Items without data-subs are "General" and always shown.
const RES_TABS = ['downloads', 'sheets', 'webinars', 'videos', 'blog', 'notes'];
function assembleResources() {
  const def = RES_TABS[0];
  const vals = (tab, subs) => makeInstance('resources', Object.assign({}, OPEN_ALL, { resTab: tab, resSubs: subs || [] })).renderVals();
  const titles = v => (v.resDocs || []).concat(v.resVideos || []).map(i => i.t);
  const subNames = vals(def).resFilters.flatMap(f => f.subs.map(s => s.t));
  let $base; const blocks = [];
  for (const tab of RES_TABS) {
    const $v = parse(renderView('resources', Object.assign({}, OPEN_ALL, { resTab: tab })).html);
    if (tab === def) $base = $v;
    const col = $v('main > div').eq(1).children('div').last();
    const keep = {};
    subNames.forEach(sn => titles(vals(tab, [sn])).forEach(t => { (keep[t] = keep[t] || []).push(sn); }));
    const els = col.find('a[href]').length ? col.find('a[href]').toArray() : col.find('img').toArray().map(e => e.parent.parent);
    titles(vals(tab)).forEach((t, i) => { const ks = keep[t] || []; if (els[i] && ks.length < subNames.length) els[i].attribs['data-subs'] = ks.join('|'); });
    col.attr('data-vgroup', 'res').attr('data-vstate', JSON.stringify({ resTab: tab }));
    if (tab !== def) col.attr('hidden', '');
    blocks.push($v.html(col));
  }
  $base('main > div').eq(1).children('div').last().replaceWith(blocks.join('\n'));
  return { html: chrome($base('#__root').html()).replace(/ class(?=[ >])/g, '') };
}

// page-specific data the scripts need (search / filter of the project cards)
function projectCards($p) {
  $p('button[data-dyn-item="pcards"]').each((i, el) => {
    const pr = PROJECTS[i]; if (!pr) return;
    el.attribs['data-cat'] = pr.cat; el.attribs['data-q'] = [pr.t, pr.tag, pr.loc, pr.owner, pr.products].join(' ').toLowerCase();
  });
  $p('span').filter((i, el) => /^\d+ projects?$/.test($p(el).text().trim()) && !$p(el).children().length).attr('data-ph-count', '');
}

// the data the scripts of a page start from (js/site.js: choice groups, tabs ...)
const STATE = { home: { hprod: 0 }, projects: { phCat: 'all' }, project: { phImg: 0 }, 'project-highlight': { phImg: 0 }, resources: { resTab: 'downloads' }, credit: { crStep: 0 } };

// stable CMS keys (see tools/cms-tag.js); the registry file keeps every key that was ever handed out
const { tagPage } = require('./cms-tag');
const { markSlots, markRepeaters } = require('./cms-repeat');   // lists + empty photo frames the live editor can add / remove
const { LOADER_HEAD, LOADER_BODY } = require('./loader');
// hero / banner titles are held invisible from the first paint until js/pc-motion.js starts their entrance animation (html.pcm-pre; lifted there and by a timeout)
const PRE_HOLD = '<script>(function(){var d=document.documentElement;if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("pcm-pre");setTimeout(function(){d.classList.remove("pcm-pre")},9000)})();</script>\n';   // page loader (first visit only, see js/pc-cache.js)
const REG_FILE = path.join(__dirname, 'cms-keys.json');
const registry = fs.existsSync(REG_FILE) ? JSON.parse(fs.readFileSync(REG_FILE, 'utf8')) : {};
const tagStats = {};

function page(file, title, desc, bodyHtml, bodyClass) {
  const editor = bodyClass !== 'login';
  // the logos are the backend's global keys; every other text / image / link gets its stable key here
  bodyHtml = bodyHtml.replace('<img src="images/logo.webp"', '<img data-cms="site-logo" data-cms-type="image" src="images/logo.webp"').replace('<img src="images/logo-white.webp"', '<img data-cms="footer-logo" data-cms-type="image" src="images/logo-white.webp"');
  if (editor) bodyHtml = markSlots(bodyHtml).html;
  const tagged = tagPage(bodyHtml, bodyClass, registry); bodyHtml = tagged.html;
  const rep = editor ? markRepeaters(bodyHtml, bodyClass) : { html: bodyHtml, lists: 0, slots: 0 }; bodyHtml = rep.html;
  tagStats[file] = tagged.tagged + (tagged.created ? ' (' + tagged.created + ' new keys)' : '') + (rep.lists || rep.slots ? ' [' + rep.lists + ' lists' + (rep.slots ? ', ' + rep.slots + ' photo slots' : '') + ']' : '');
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n<meta name="description" content="' + escAttr(desc) + '">\n' +
    '<link rel="icon" type="image/png" sizes="64x64" href="images/favicon.png">\n<link rel="apple-touch-icon" href="images/apple-touch-icon.png">\n' + (editor ? LOADER_HEAD + PRE_HOLD : '') +
    '<link rel="stylesheet" href="css/styles.css">\n<link rel="stylesheet" href="css/design.css">\n<link rel="stylesheet" href="css/site.css">\n<link rel="stylesheet" href="css/hover.css">\n<link rel="stylesheet" href="css/pages.css">\n' + (editor ? '<link rel="stylesheet" href="css/pc-motion.css">\n<link rel="stylesheet" href="css/cms.css">\n' : '') + '</head>\n' +
    '<body data-page="' + escAttr(bodyClass) + '" data-state=\'' + JSON.stringify(Object.assign({ grp: 0, gal: 0 }, STATE[bodyClass.replace(/^products-.*/, 'products')] || {})) + '\'>\n' + (editor ? LOADER_BODY : '') + bodyHtml + '\n' +
    (/^products/.test(bodyClass) ? '<script src="js/search-index.js" defer></script>\n' : '') + '<script src="js/site.js" defer></script>\n<script src="js/pc-static.js" defer></script>\n<script src="js/pc-dialog.js" defer></script>\n<script src="js/pc-edit.js" defer></script>\n<script src="js/pc-cache.js" defer></script>\n<script src="js/pc-motion.js" defer></script>\n<script src="js/pc-content.js" defer></script>\n' + (editor ? '<script src="js/cms.js" defer></script>\n<script src="js/pc-repeat.js" defer></script>\n<script src="js/pc-toolbar.js" defer></script>\n' : '') + '</body>\n</html>\n';
}

// ------------------------------------------------------------------ build
const out = [];
function write(file, html) { fs.writeFileSync(path.join(ROOT, file), html); out.push(file); }

const patchAll = { open: allItemIds(), dims: allDimIds() };
for (const [key, p] of Object.entries(PAGES)) {
  if (key === 'products') {
    const a = assemble('products', Object.assign({ cat: null }, patchAll));
    write(p.file, page(p.file, p.title, p.desc, a.html, 'products'));
    CATS.forEach((c, i) => {
      const b = assemble('products', Object.assign({ cat: i }, patchAll));
      write(catFile(i), page(catFile(i), c.name + ' | ' + NAME, (c.blurb || p.desc).slice(0, 200), b.html, 'products-' + c.id));
    });
    continue;
  }
  if (key === 'resources') { write(p.file, page(p.file, p.title, p.desc, assembleResources().html, key)); continue; }
  if (key === 'projects') {
    const a = assemble('projects', {});
    const $a = parse(a.html); projectCards($a);
    write(p.file, page(p.file, p.title, p.desc, $a('#__root').html(), key));
    // one template page for every project highlight (/project-highlight-<slug>.html -> project-highlight.html, see vercel.json); js/pc-content.js draws it from the story
    const d = parse(assemble('projects', { phOpen: PROJECTS[0].id }).html);
    d('main > div').eq(1).html('<div data-pdetail data-dyn="pj" style="display:contents"><p style="font-size:16px;margin:24px 0">Loading…</p></div>');
    write('project-highlight.html', page('project-highlight.html', 'Project Highlight | ' + NAME, p.desc, d('#__root').html(), 'project-highlight'));
    // the other template pages drawn from CMS rows: solution (/product-detail-<slug>.html), blog (/blog-<slug>.html), webinar (/webinar-<slug>.html); routes in vercel.json
    // the shell is the Project Highlights page: its menu item is the "selected" one; a blog / webinar page selects Resources, a product page Products
    const ACTIVE = /border-bottom:2px solid var\(--color-accent\)/;
    const shell = (inner, menu) => {
      const e = parse(assemble('projects', {}).html); e('main').html(inner);
      if (menu) {
        const btns = e('header nav > div > button'), act = btns.filter((i, b) => ACTIVE.test(e(b).attr('style') || '')).first();
        const target = btns.filter((i, b) => e(b).text().trim() === menu).first(), plain = btns.filter((i, b) => !ACTIVE.test(e(b).attr('style') || '') && e(b).attr('data-href')).first();
        if (act.length && target.length && plain.length) { const a = act.attr('style'), p = plain.attr('style'); target.attr('style', a); act.attr('style', p); }
      }
      return e('#__root').html();
    };
    const band = (crumb, h1) => { const b = parse(assemble('projects', {}).html)('main > div').eq(0); b.find('span').first().html('Home › <span style="color:var(--color-accent-700);font-weight:600">' + crumb + '</span>'); b.find('h1').text(h1); return parse('').html && b.toString(); };
    const wrapStyle = 'max-width:1440px;margin:0 auto;padding:40px clamp(20px,3vw,48px) 96px';
    write('solution-reference.html', page('solution-reference.html', 'Product | ' + NAME, PAGES.products.desc, shell(band('Products', 'Products') + '<div data-soltpl data-dyn="cat" style="' + wrapStyle + '"><p style="font-size:16px;margin:24px 0">Loading…</p></div>', 'Products'), 'ref-solution'));
    write('blog-details.html', page('blog-details.html', 'Blog Post | ' + NAME, 'Premier Concrete Products blog.', shell('<div data-article="blog" data-dyn="res"><p style="font-size:16px;margin:40px clamp(20px,3vw,48px)">Loading…</p></div>', 'Resources'), 'ref-blog'));
    write('webinar-details.html', page('webinar-details.html', 'Webinar | ' + NAME, 'Premier Concrete Products webinars.', shell('<div data-article="webinar" data-dyn="res"><p style="font-size:16px;margin:40px clamp(20px,3vw,48px)">Loading…</p></div>', 'Resources'), 'ref-webinar'));
    continue;
  }
  const a = assemble(key, key === 'credit' ? { crStep: 0 } : {});
  write(p.file, page(p.file, p.title, p.desc, a.html, key));
}

// what the CMS lists do not carry: the group names of every product (mega menu links, products page cards)
{
  const slugify = require('./design-data').slugify, groups = {};
  CATS.forEach(c => { groups[slugify(c.name)] = c.groups.map(g => g.name || '').filter(Boolean); });
  fs.writeFileSync(path.join(ROOT, 'js', 'pc-static.js'), '/* generated by tools/build-pages.js: what the CMS lists do not carry */\nwindow.PC_STATIC = ' + JSON.stringify({ groups }) + ';\n');
}

// product search index (js/search-index.js): every item of every group, with the page + tab it lives on
{
  const idx = [];
  CATS.forEach((c, ci) => c.groups.forEach((g, gi) => g.items.forEach(it => {
    if (it.heading) return;
    idx.push({ n: it.n, g: g.name || '', c: c.name, f: catFile(ci) + (gi ? '?grp=' + gi : ''), h: [it.n, g.name, c.name, it.d || '', ...(it.subs || [])].join(' ').toLowerCase(), s: (it.subs || []).filter(x => x).join(' | ').toLowerCase() });
  })));
  fs.writeFileSync(path.join(ROOT, 'js', 'search-index.js'), '/* generated by tools/build-pages.js: the product search of products.html */\nwindow.PCP_SEARCH = ' + JSON.stringify(idx) + ';\n');
}

// hover rules
fs.writeFileSync(path.join(ROOT, 'css', 'hover.css'), '/* generated by tools/build-pages.js (style-hover rules of the design) */\n' +
  [...hoverRules].map(([css, cls]) => '.' + cls + ':hover{' + css.split(';').filter(Boolean).map(d => d.trim() + ' !important').join(';') + '}').join('\n') + '\n');

fs.writeFileSync(REG_FILE, JSON.stringify(registry, null, 1) + '\n');
console.log('CMS keys per page: ' + Object.entries(tagStats).map(([f, n]) => f.replace('.html', '') + '=' + n).join(', '));
console.log(out.length + ' pages written: ' + out.join(', '));
if (unhandled.size) console.log('handlers without a hook (' + unhandled.size + '):\n  ' + [...unhandled].join('\n  '));
