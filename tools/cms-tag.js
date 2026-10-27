/*
 * cms-tag: gives every editable text block, image and link of a page a STABLE, readable CMS key (data-cms="..." / data-cms-link="...") in the HTML itself.
 * Nothing is ever numbered at run time: the live editor (js/cms.js) only edits elements that already carry a key here.
 *
 * Stability rules
 *  - A key comes from WHAT the element is: its kind + its default text / image file, never from its position on the page.
 *    Adding, removing or moving other elements therefore never changes an existing key.
 *  - Every key ever handed out is remembered in tools/cms-keys.json ("registry", commit it). A rebuild re-uses the key of a known element
 *    and only creates keys for new ones. Keys are never renumbered or deleted, so saved content can never end up on the wrong element.
 *  - The same element repeated in the state variants of a page (resources tabs) shares one key; two identical texts inside one block get -2, -3 ...
 *  - The header and the footer are the same on every page: their keys start with "g-" (links "lnk-g-"); the editor stores them once (with the home page)
 *    and shows them everywhere.
 *  - Parts that come from the CMS lists (products, project highlights, resources) are marked data-dyn and are not tagged; they are managed in the dashboard.
 *  - Elements that already have a data-cms in the source (header / footer logo) are left untouched.
 */
const crypto = require('crypto');
const cheerio = require('cheerio');

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'select', 'option', 'textarea', 'input', 'head', 'template', 'iframe', 'canvas']);
const INLINE = new Set(['span', 'b', 'i', 'em', 'strong', 'br', 'a', 'sup', 'sub', 'small', 'u', 'abbr', 'mark', 's', 'wbr', 'svg']);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'span', 'div', 'a', 'button', 'strong', 'em', 'label', 'td', 'th', 'address', 'b', 'i', 'small', 'figcaption', 'blockquote', 'dt', 'dd', 'summary']);
const DYNAMIC_GROUPS = new Set([]);                       // vgroups filled from the CMS lists
const UNTAGGED_PAGES = new Set(['login', 'project-highlight', 'ref-solution', 'ref-blog', 'ref-webinar']);   // pages drawn from CMS rows

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const norm = s => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 4);

function makeKey(kind, n, chrome) {
  const words = slug(n).split('-').slice(0, 5).join('-').slice(0, 30).replace(/-+$/, '');
  return (chrome ? 'g-' : '') + (kind === 'image' ? 'img-' : 'txt-') + (words || 'item') + '-' + hash(n);
}

/**
 * @param {string} html      body markup of one page
 * @param {string} pageKey   page identifier ("home", "products-pipe" ...)
 * @param {object} registry  { [pageKey]: { [signature]: key } }  (mutated: new keys are added; "_chrome" holds the header / footer keys)
 * @returns {{html:string, tagged:number, created:number}}
 */
function tagPage(html, pageKey, registry) {
  if (UNTAGGED_PAGES.has(pageKey)) return { html, tagged: 0, created: 0 };
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
  const reg = registry[pageKey] = registry[pageKey] || {};
  const chromeReg = registry._chrome = registry._chrome || {};
  const used = new Set(Object.values(reg)), usedChrome = new Set(Object.values(chromeReg));
  let tagged = 0, created = 0;

  function keyFor(kind, n, counters, chrome) {
    const r = chrome ? chromeReg : reg, u = chrome ? usedChrome : used;
    const base = kind + '|' + n;
    const occ = counters[base] = (counters[base] || 0) + 1;
    const sig = base + '|' + occ;
    if (r[sig]) return r[sig];
    let key = makeKey(kind, n, chrome) + (occ > 1 ? '-' + occ : '');
    while (u.has(key)) key += 'x';
    r[sig] = key; u.add(key); created++;
    return key;
  }

  const isTextBlock = el => {
    if (!TEXT_TAGS.has(el.name)) return false;
    const kids = el.children || [];
    let direct = false;
    for (const c of kids) {
      if (c.type === 'text') { if (/\S/.test(c.data)) direct = true; }
      else if (c.type === 'tag') { if (!INLINE.has(c.name)) return false; }
      else if (c.type !== 'comment') return false;
    }
    if (!direct) return false;
    const t = norm($.html(el.children));
    return t.length > 0 && /[a-z0-9]/i.test(t);
  };

  // parts that are not page content: filled from the CMS lists, menus that list the products, the mobile menu button
  const skipEl = (el, chrome) => {
    const a = el.attribs || {};
    if (a['data-dyn'] !== undefined || a['data-mega'] !== undefined || a['data-dyn-item'] !== undefined || a['data-pdetail'] !== undefined || a['data-slot-text'] !== undefined) return true;   // (data-slot-text = the "Photo coming soon" text of an empty photo frame)
    if ((a.class || '').split(/\s+/).includes('pc-burger')) return true;
    if (chrome && /^products-/.test(a['data-href'] || '')) return true;   // product names in the footer / menus come from the product list
    return false;
  };

  function walk(el, counters, chrome) {
    if (el.type !== 'tag') return;
    const a = el.attribs || {};
    if (SKIP_TAGS.has(el.name)) return;
    if (el.name === 'header' || el.name === 'footer') chrome = true;
    if ('data-cms' in a) return;                                   // explicit key in the source: respect it, do not look inside
    if (a['data-tpl'] !== undefined) return;                       // add / remove lists: saved as one list, not as keyed texts
    if (skipEl(el, chrome)) return;
    if (a['data-vgroup']) {                                        // a state variant: its own occurrence counters
      if (DYNAMIC_GROUPS.has(a['data-vgroup'])) return;
      counters = {};
    }
    if (el.name === 'img') {
      const src = String(a.src || '').split('?')[0]; if (!src) return;
      el.attribs['data-cms'] = keyFor('image', src, counters, chrome); el.attribs['data-cms-type'] = 'image'; tagged++; return;
    }
    if ((a['data-set'] !== undefined || a['data-act'] !== undefined || a['data-scroll'] !== undefined || a['data-hover-set'] !== undefined) && el.name === 'button' && a['data-edit-label'] === undefined) {   // tabs / controls keep their function; the title of an accordion row (a button) is a text of the page
      if (a['data-act'] === 'acc') for (const c of el.children || []) walk(c, counters, chrome);
      return;
    }
    if (isTextBlock(el)) {
      el.attribs['data-cms'] = keyFor('text', norm($.html(el.children)), counters, chrome); el.attribs['data-cms-type'] = 'text'; tagged++; return;
    }
    for (const c of el.children || []) walk(c, counters, chrome);
  }
  for (const c of $('#__r')[0].children) walk(c, {}, false);

  // ---- links: every link / link button gets a stable data-cms-link key (the live editor opens its link editor on it; the saved URL is stored under this key).
  // The key comes from the link's label + original address, never from its position. Links of the header / footer are shared by all pages ("lnk-g-...", stored once).
  const usedChromeLinks = new Set(Object.values(chromeReg));
  let linked = 0;
  function linkKey(chromeScope, label, href, counters) {
    const base = 'link|' + label + '|' + href, reg2 = chromeScope ? chromeReg : reg, used2 = chromeScope ? usedChromeLinks : used;
    const occ = chromeScope ? 1 : (counters[base] = (counters[base] || 0) + 1);
    const sig = base + '|' + occ;
    if (reg2[sig]) return reg2[sig];
    const words = slug(label || 'link').split('-').slice(0, 4).join('-').slice(0, 26).replace(/-+$/, '') || 'link';
    let key = (chromeScope ? 'lnk-g-' : 'lnk-') + words + '-' + hash(label + '|' + href) + (occ > 1 ? '-' + occ : '');
    while (used2.has(key)) key += 'x';
    reg2[sig] = key; used2.add(key); created++;
    return key;
  }
  const SKIP_LINK_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'template', 'head', 'select', 'option', 'textarea', 'form']);
  function walkLinks(el, counters, chromeScope) {
    if (el.type !== 'tag') return;
    const a = el.attribs || {};
    if (SKIP_LINK_TAGS.has(el.name) && !(el.name === 'form')) return;
    if (el.name === 'header' || el.name === 'footer') chromeScope = true;
    if (skipEl(el, chromeScope)) return;
    if (a['data-vgroup']) { if (DYNAMIC_GROUPS.has(a['data-vgroup'])) return; counters = {}; }
    // a placeholder file link ("Download submittal": href="#" target="_blank") is editable too: the admin attaches a file / address; visitors do not see it until it has one
    const placeholder = el.name === 'a' && a.href === '#' && a.target === '_blank';
    const isA = el.name === 'a' && a.href && (placeholder || !/^\s*(#|javascript:|mailto:|tel:)/i.test(a.href));
    const isBtn = a['data-href'] !== undefined && a['data-set'] === undefined && a['data-act'] === undefined;
    if (isA || isBtn) {
      const label = norm($.html(el.children)).replace(/\s+/g, ' ');
      el.attribs['data-cms-link'] = linkKey(chromeScope, label, isA ? a.href : a['data-href'], counters); linked++;
      if (placeholder && !chromeScope) el.attribs['data-pc-file'] = '';
      return;
    }
    for (const c of el.children || []) walkLinks(c, counters, chromeScope);
  }
  for (const c of $('#__r')[0].children) walkLinks(c, {}, false);
  return { html: $('#__r').html(), tagged: tagged + linked, created };
}

module.exports = { tagPage };
