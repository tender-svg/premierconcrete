/*
 * cms-repeat: marks the repeating parts of a page so that the live editor (js/pc-repeat.js) can ADD and REMOVE items in edit mode, and the photo frames
 * that have no photo ("Photo coming soon") so that a photo can be added there. Runs after tools/cms-tag.js (it needs the stable data-cms keys).
 *
 *   data-rep="rep-<key>"        a list: the parent of several items of the same kind (the values grid, the people of a team, the rows of a table ...)
 *   data-rep-item="<key>"       one item of the list; <key> = the key of the first text / photo / link inside the item (stable, from cms-tag), so the saved
 *                               structure (page element "rep-<key>") keeps pointing at the right item whatever is added or removed around it
 *   data-slot                   an <img> placed in an empty photo frame (hidden until a photo is added); its key is  slot-<item key>-<n>
 *
 * A list is: >= 2 siblings with the same tag and the same shape (tag + the tags of their children), every one with at least one keyed element inside,
 * block-like (not menu / tab buttons, table cells, bare spans, headings of a section). Header, footer, forms and the parts that come from the CMS are left out.
 */
const cheerio = require('cheerio');

const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'select', 'option', 'textarea', 'input', 'head', 'template', 'iframe', 'canvas', 'header', 'footer', 'nav', 'form', 'button']);
const NO_ITEM_TAGS = new Set(['td', 'th', 'option', 'button', 'img', 'br', 'input', 'select', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'script', 'style']);   // (bare spans / links / paragraphs are items only when they hold other elements, or are a list item)
const NO_ITEM_CONTENT = 'h1, h2, section, article[data-screen-label], form, [data-dyn-item], [data-dyn], [data-set], [data-hover-set], [data-vgroup], [data-grp-panel], select, textarea';
const PLACEHOLDER = /^\s*(?:photo|image|picture)\s+coming\s+soon\s*$/i;
const UNTAGGED_PAGES = new Set(['login', 'project-highlight', 'ref-solution', 'ref-blog', 'ref-webinar']);

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** the empty photo frames come BEFORE tagging (cms-tag must not make "Photo coming soon" an editable text) */
function markSlots(html) {
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
  let n = 0;
  $('#__r div').each((i, el) => {
    const $el = $(el);
    if ($el.children().length || !PLACEHOLDER.test($el.text())) return;
    $el.attr('data-slot-text', '');
    const frame = $el.parent();
    frame.attr('data-slot-frame', '');
    $el.before('<img data-slot hidden alt="" src="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">');
    n++;
  });
  return { html: $('#__r').html(), slots: n };
}

/** after tagging: lists + keys of the slots */
function markRepeaters(html, pageKey) {
  if (UNTAGGED_PAGES.has(pageKey)) return { html, lists: 0, slots: 0 };
  const $ = cheerio.load('<div id="__r">' + html + '</div>', { _useHtmlParser2: true, decodeEntities: false, lowerCaseAttributeNames: true });
  const usedReps = new Set();
  let lists = 0;
  const firstKey = el => {
    const k = $(el).find('[data-cms], [data-cms-link]').addBack('[data-cms], [data-cms-link]').first();
    return k.length ? (k.attr('data-cms') || k.attr('data-cms-link')) : null;
  };
  const shape = c => c.name + '>' + (c.children || []).filter(x => x.type === 'tag').map(x => x.name).join(',');
  const skipParent = el => {
    const a = el.attribs || {};
    return SKIP_TAGS.has(el.name) || a['data-dyn-item'] !== undefined || a['data-dyn'] !== undefined || a['data-vgroup'] !== undefined || a['data-mega'] !== undefined ||
      a['data-pdetail'] !== undefined || a['data-soltpl'] !== undefined || a['data-article'] !== undefined || a['data-rep'] !== undefined;
  };

  function walk(el) {
    if (el.type !== 'tag' || skipParent(el)) return;
    const kids = (el.children || []).filter(c => c.type === 'tag');
    if (kids.length >= 2 && el.name !== 'main' && el.name !== 'body' && !(el.attribs && el.attribs['id'] === '__r')) {
      const groups = {};
      kids.forEach(c => { (groups[shape(c)] = groups[shape(c)] || []).push(c); });
      let best = null;
      Object.keys(groups).forEach(sig => {
        const g = groups[sig], tag = g[0].name;
        const why = r => { if (process.env.PCR_DEBUG && g.length >= 2) console.log('  [' + pageKey + '] rejected', el.name + ' > ' + sig + ' x' + g.length + ': ' + r + ' | ' + $(g[0]).text().replace(/s+/g, ' ').trim().slice(0, 50)); };
        if (g.length < 2 || g.length > 80) return why('size');
        const leaf = !(g[0].children || []).some(x => x.type === 'tag');
        if (NO_ITEM_TAGS.has(tag) && !(tag === 'li' && leaf)) return why('tag');
        if (leaf && tag !== 'li') return why('leaf');
        if (!g.every(c => firstKey(c) && !$(c).find(NO_ITEM_CONTENT).length && $(c).text().length < 2500 && !(c.attribs && (c.attribs['data-set'] !== undefined || c.attribs['data-act'] !== undefined)))) return why(g.every(c => firstKey(c)) ? 'content/size' : 'not all keyed');
        if (!best || g.length > best.length) best = g;
      });
      if (best) {
        const ids = best.map(firstKey);
        if (new Set(ids).size === ids.length) {
          let rep = 'rep-' + slug(ids[0]).slice(0, 44); while (usedReps.has(rep)) rep += 'x'; usedReps.add(rep);
          el.attribs['data-rep'] = rep;
          best.forEach((c, i) => { c.attribs['data-rep-item'] = ids[i]; });
          lists++;
        }
      }
    }
    kids.forEach(walk);
  }
  $('#__r').children().each((i, c) => walk(c));

  // keys of the photo slots: slot-<item key>-<n> (the item = the list item the frame sits in), else slot-<page>-<n>
  let slots = 0; const perItem = {};
  $('#__r img[data-slot]').each((i, el) => {
    const item = $(el).closest('[data-rep-item]'), base = item.length ? item.attr('data-rep-item') : 'pg';
    perItem[base] = (perItem[base] || 0) + 1;
    el.attribs['data-cms'] = 'slot-' + base + '-' + perItem[base]; el.attribs['data-cms-type'] = 'image'; slots++;
  });
  return { html: $('#__r').html(), lists, slots };
}

module.exports = { markSlots, markRepeaters };
