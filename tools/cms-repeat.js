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
    // a list that holds a single accordion row / a single bullet still gets its "Add item" (a group of a product page may have just one item)
    const single = kids.length === 1 && ((kids[0].name === 'div' && $(kids[0]).children('button[data-act="acc"]').length > 0) || ((el.name === 'ul' || el.name === 'ol') && kids[0].name === 'li'));
    if ((kids.length >= 2 || single) && el.name !== 'main' && el.name !== 'body' && !(el.attribs && el.attribs['id'] === '__r')) {
      const groups = {};
      kids.forEach(c => { (groups[shape(c)] = groups[shape(c)] || []).push(c); });
      let best = null;
      Object.keys(groups).forEach(sig => {
        const g = groups[sig], tag = g[0].name;
        const why = r => { if (process.env.PCR_DEBUG && g.length >= 2) console.log('  [' + pageKey + '] rejected', el.name + ' > ' + sig + ' x' + g.length + ': ' + r + ' | ' + $(g[0]).text().replace(/s+/g, ' ').trim().slice(0, 50)); };
        if (g.length < (single ? 1 : 2) || g.length > 80) return why('size');
        if (g.some(c => c.attribs && c.attribs['data-grp-panel'] !== undefined)) return why('group panels (tabs): js/pc-groups.js adds / removes those');
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

  // the groups of a product page that have no dropdown at all get an EMPTY dropdown list + a prototype row (<template>), so "Add dropdown" exists there too
  $('#__r [data-grp-panel]').each((i, p) => {
    const $p = $(p);
    if ($p.find('button[data-act="acc"]').length) return;
    const h3 = $p.find('h3[data-cms]').first().attr('data-cms'); if (!h3) return;
    const base = slug(h3).slice(0, 40), rep = 'rep-dd-' + base, label = $p.find('h3[data-cms]').first().text().trim().replace(/[<>&"]/g, ' ');
    const row = '<div style="border-top:0"><button data-act="acc" aria-expanded="false" style="width:100%;display:flex;align-items:center;gap:16px;padding:26px 28px;background:var(--color-accent-100);border:0;cursor:pointer;font:inherit;text-align:left;color:var(--color-text)" class="hv-6">' +
      '<span style="width:8px;height:8px;border-radius:999px;background:var(--color-accent);flex:none"></span><span style="font-weight:600;font-size:17px;flex:1" data-cms="dd-' + base + '-t" data-cms-type="text">New dropdown</span>' +
      '<span style="color:var(--color-accent);display:flex"><span data-ico="open" hidden><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg></span><span data-ico="closed"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg></span></span></button>' +
      '<div data-acc-body hidden style="display:contents"><div style="padding:24px 40px 48px 48px;display:flex;flex-wrap:wrap;gap:48px;align-items:center;background:#fff">' +
      '<div style="flex:1 1 420px;max-width:520px;aspect-ratio:4/3;position:relative;background:transparent"><img hidden alt="" src="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply" data-cms="dd-' + base + '-i" data-cms-type="image"></div>' +
      '<div style="flex:1 1 380px;display:flex;flex-direction:column;gap:20px;padding-top:8px">' +
      '<span style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--color-neutral-800)" data-keep-text data-cms="dd-' + base + '-l" data-cms-type="text">' + label + '</span>' +
      '<div class="pcp-rte"><p data-cms="dd-' + base + '-x" data-cms-type="text">Describe this dropdown.</p></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding-top:4px">' +
      '<button data-href="contact.html" style="font:inherit;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:transparent;border:1.5px solid var(--color-accent);border-radius:4px;padding:13px 20px;cursor:pointer;color:var(--color-accent-700)" class="hv-6" data-cms="dd-' + base + '-q" data-cms-type="text" data-cms-link="lnk-dd-' + base + '-q">Request a quote</button>' +
      '<a href="#" target="_blank" data-pc-file style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:var(--color-accent);border:1.5px solid var(--color-accent);border-radius:4px;padding:13px 20px;color:#fff;text-decoration:none" class="hv-12" data-cms="dd-' + base + '-d" data-cms-type="text" data-cms-link="lnk-dd-' + base + '-d"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>Download submittal</a></div></div></div></div></div>';
    $p.append('<div data-dd-wrap style="display:flex;flex-direction:column;gap:20px;margin-top:0"><div data-rep="' + rep + '" data-dd-empty style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(22,50,23,.08)"></div><template data-rep-proto="' + rep + '">' + row + '</template></div>');
    lists++;
  });

  // a dropdown row whose text has no bullet list (e.g. Trinity 6 of Pavers) gets an EMPTY bullet list + a prototype bullet, so it can get "Add item" like the other rows
  $('#__r div[data-rep-item]').each((i, row) => {
    const $r = $(row);
    if (!$r.children('button[data-act="acc"]').length) return;
    const rte = $r.find('.pcp-rte').first(); if (!rte.length || rte.find('ul').length) return;
    const k = rte.find('[data-cms]').first().attr('data-cms'); if (!k) return;
    const base = slug(k).slice(0, 40), rep = 'rep-dd-' + base + '-b';
    rte.append('<ul class="pts" data-rep="' + rep + '" data-dd-empty></ul><template data-rep-proto="' + rep + '"><li data-cms="dd-' + base + '-b" data-cms-type="text" data-rep-item="dd-' + base + '-b">New text</li></template>');
    lists++;
  });

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
