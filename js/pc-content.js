/* Premier Concrete: the lists of the pages are read from the CMS (what is added / edited in the dashboard OR directly on the page shows up).
 * Pages are shipped with the same content already written in (tools/build-pages.js); this script replaces it with the live CMS data as soon as
 * the API answers. If the API cannot be reached (or answers an empty list) the shipped content simply stays.
 *   - Products = the solutions (/api/v2/solutions): home list, products page, menus, footer, category tabs, contact form, filters, solution page
 *   - Project Highlights = the stories (/api/v2/stories): list, filter chips, project page (project-highlight.html)
 *   - Resources (/api/v2/resources): the six tabs, the product filter, blog / webinar pages
 * The elements that are drawn from the CMS carry data-dyn-item="<list>" in the shipped HTML (the first element of every item): the first one is kept as
 * the prototype of the others, so the design (inline styles, hover classes) stays as it is.
 * An admin in EDIT MODE (js/cms.js) changes the items right on the page (js/pc-edit.js does the editing + saving, this file draws the HTML):
 * the products page, the project highlights (list + page), the resources lists, the solution page, the blog / webinar pages.
 */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-page') || '';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var STATIC = window.PC_STATIC || { groups: {} };
  var PCE = window.PCE;
  var here = (location.pathname.split('/').pop() || 'index.html').replace(/^$/, 'index.html');
  var editing = function () { return !!(PCE && PCE.editing()); };
  var refresh = function () { if (window.PC && window.PC.refresh) window.PC.refresh(); };
  var reapply = function () { if (window.PCCMS && window.PCCMS.reapply) window.PCCMS.reapply(); };

  var PCC = window.PCC || { usable: function () { return false; }, list: function () { return null; }, setList: function () { } };   // data cache (js/pc-cache.js)
  function get(path) {
    var fresh = fetch('/api/v2/' + path, { credentials: 'include', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (!Array.isArray(j)) throw new Error('bad data'); PCC.setList(path, j); return j; });
    var cached = PCC.usable() ? PCC.list(path) : null;
    if (cached) { if (window.PCL) PCL.cachedUsed = true; fresh.catch(function () { }); return Promise.resolve(cached); }   // drawn from the cache at once; the newer data is kept for the next page
    if (window.PCL && PCL.miss) PCL.miss();   // not cached yet: the page loader stays until the lists are drawn
    return fresh;
  }
  var live = function (r) { return r.is_active !== false && r.is_deleted !== true; };
  var byOrder = function (a, b) { return (a.display_order || 0) - (b.display_order || 0); };
  var slugOf = PCE ? PCE.slugify : function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var uniqueSlug = function (base, taken) { var s = slugOf(base) || 'item'; if (taken.indexOf(s) >= 0) s += '-' + Date.now().toString(36).slice(-4); return s; };
  var maxOrder = function (st) { return st.rows.reduce(function (mx, x) { return Math.max(mx, x.order || 0); }, 0) + 1; };

  /* ---------- how the CMS rows are read / written (the dashboard uses the same formats) ---------- */
  var cleanDesc = function (s) { return String(s || '').replace(/\s*\[Images:\d+\]/g, '').trim(); };
  var PROD_RE = /^\[product:([a-z0-9,\-]+)\]\s*/;
  var prodsOf = function (d) { var m = PROD_RE.exec(d || ''); return m ? m[1].split(',').filter(Boolean) : []; };
  var textOf = function (d) { return String(d || '').replace(PROD_RE, '').trim(); };
  var isArt = function (t) { return t === 'Blog Post' || t === 'Webinar'; };
  // the description holds two texts: the short one (the card on the Resources page) and, for a blog post / webinar, the text of its own page after a line "[page]"
  var splitDesc = function (text, type) {
    text = String(text || ''); var m = /(^|\n)[ \t]*\[page\][ \t]*(\n|$)/.exec(text);
    if (m) return { desc: text.slice(0, m.index).trim(), body: text.slice(m.index + m[0].length).trim() };
    return isArt(type) ? { desc: '', body: text.trim() } : { desc: text.trim(), body: '' };
  };
  var storyX = function (r) { try { var j = JSON.parse(r.result_text || '{}'); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } };
  var TAB_TYPE = { downloads: 'Brochure', sheets: 'Data Sheet', webinars: 'Webinar', videos: 'Video', blog: 'Blog Post', notes: 'Technical Note' };
  var TYPES = ['Brochure', 'Form', 'Data Sheet', 'Technical Note', 'Webinar', 'Video', 'Blog Post'];
  var TABS = { downloads: function (t) { return ['Data Sheet', 'Webinar', 'Video', 'Blog Post', 'Technical Note'].indexOf(t) < 0; }, sheets: function (t) { return t === 'Data Sheet'; }, webinars: function (t) { return t === 'Webinar'; }, videos: function (t) { return t === 'Video'; }, blog: function (t) { return t === 'Blog Post'; }, notes: function (t) { return t === 'Technical Note'; } };
  var clean = function (a) { return a.map(function (s) { return String(s).trim(); }).filter(Boolean); };

  /* ---------- the three lists (in memory, edited on the page, saved with SAVE) ---------- */
  var sols, stories, ress;
  if (PCE) {
    sols = PCE.store({
      name: 'solutions', path: 'solutions', sort: byOrder, live: live,
      toModel: function (r) { return { id: r.id, slug: r.slug, title: r.title || '', text: cleanDesc(r.short_description), image: r.icon_image_url || '', link: r.custom_link || '', family: r.product_family || '', order: r.display_order || 0 }; },
      toBody: function (m, isNew, st) {
        var b = { title: m.title || 'Untitled', short_description: m.text, icon_image_url: m.image, category: m.title || 'Untitled', product_family: m.family || '', display_order: m.order, is_active: true };
        if (isNew) b.slug = uniqueSlug(m.title, st.rows.map(function (x) { return x.slug; })); else b.custom_link = m.link;
        return b;
      },
      afterCreate: function (m, res) { var id = res && res.solution && res.solution.id; return id && m.link ? PCE.api('PATCH', 'solutions/' + id, { custom_link: m.link }) : null; },
      defaults: function (st) { return { title: 'New product', text: '', image: '', link: '', family: '', order: maxOrder(st) }; },
    });
    stories = PCE.store({
      name: 'stories', path: 'stories', live: live,
      toModel: function (r) {
        var x = storyX(r); return { id: r.id, slug: r.slug, title: r.title || '', tag: x.tag || '', prod: x.prod || '', location: r.location || '', year: x.year || '', owner: r.application || '', products: r.products_used || '', excerpt: x.excerpt || '',
          challenge: r.challenge_text || '', solution: r.solution_text || '', images: (x.images && x.images.length ? x.images : (r.hero_image_url ? [r.hero_image_url] : [])).slice(), date: r.published_date || r.created_at || '' };
      },
      toBody: function (m, isNew, st) {
        var imgs = m.images.filter(Boolean);
        var b = { title: m.title || 'Untitled', location: m.location, application: m.owner, products_used: m.products, hero_image_url: imgs[0] || '', challenge_text: m.challenge, solution_text: m.solution, result_text: JSON.stringify({ year: m.year, prod: m.prod, tag: m.tag, excerpt: m.excerpt, images: imgs }) };
        if (isNew) { b.slug = uniqueSlug(m.title, st.rows.map(function (x) { return x.slug; })); b.project_benefits = ''; }
        return b;
      },
      defaults: function () { return { title: 'New project highlight', tag: '', prod: '', location: '', year: '', owner: '', products: '', excerpt: '', challenge: '', solution: '', images: [] }; },
      sort: function (a, b) { return String(b.published_date || b.created_at || '').localeCompare(String(a.published_date || a.created_at || '')); },
    });
    ress = PCE.store({
      name: 'resources', path: 'resources', live: live,
      toModel: function (r) {
        var t = textOf(r.description), sp = splitDesc(t, r.document_type), ps = prodsOf(r.description);
        return { id: r.id, title: r.title || '', slug: slugOf(r.title), type: r.document_type || 'Brochure', prods: ps, prod: ps[0] || '', label: sp.desc, body: sp.body, file: r.file_url || '', thumb: r.thumbnail_url || '', date: r.published_date || r.created_at || '' };
      },
      toBody: function (m, isNew) {
        var ps = m.prod && m.prods.indexOf(m.prod) >= 0 ? m.prods : (m.prod ? [m.prod] : []);
        var b = { title: m.title || 'Untitled', document_type: m.type, description: (ps.length ? '[product:' + ps.join(',') + '] ' : '') + m.label + (m.body && isArt(m.type) ? '\n\n[page]\n\n' + m.body : ''), file_url: m.file, thumbnail_url: m.thumb, is_active: true };
        if (isNew) b.published_date = new Date().toISOString();
        return b;
      },
      defaults: function () { return { title: 'New resource', type: 'Brochure', prods: [], prod: '', label: '', body: '', file: '', thumb: '' }; },
      sort: function (a, b) { return String(b.published_date || b.created_at || '').localeCompare(String(a.published_date || a.created_at || '')); },
    });
  }

  /* ---------- products as the pages need them ---------- */
  var prodTitle = function (slug) { var p = productsList().filter(function (x) { return x.slug === slug; })[0]; return p ? p.title : ''; };
  function productsList() {
    return sols ? sols.rows.map(function (m) {
      var url = String(m.link || '').replace(/^\//, '') || ('product-detail-' + m.slug + '.html');
      return { id: m.id, m: m, slug: m.slug, title: m.title, text: m.text, image: m.image, url: url, groups: STATIC.groups[m.slug] || [] };
    }) : [];
  }

  /* ---------- helpers: prototypes, clones, edit attributes ---------- */
  var PROTO = {};
  // a prototype is cloned from an element that may already carry the scroll-animation classes (js/pc-motion.js): the clones start clean
  function plain(el) { [el].concat([].slice.call(el.querySelectorAll('*'))).forEach(function (e) { [].slice.call(e.classList).forEach(function (c) { if (/^pcm/.test(c)) e.classList.remove(c); }); e.style.removeProperty('--pcm-d'); }); return el; }
  function swap(name, els, list, fill) {
    els = els.filter(function (e) { return e.parentNode; });
    if (!PROTO[name] && els.length) PROTO[name] = plain(els[0].cloneNode(true));
    if (!PROTO[name] || !els.length || !list.length) return false;
    var parent = els[0].parentNode, ref = els[els.length - 1].nextSibling;
    els.forEach(function (e) { e.remove(); });
    list.forEach(function (it, i) { var c = PROTO[name].cloneNode(true); var r = fill(c, it, i) || c; parent.insertBefore(r, ref); });
    return parent;
  }
  var items = function (name, tag, root) { return $$('[data-dyn-item="' + name + '"]', root).filter(function (e) { return !tag || e.tagName === tag; }); };
  function setText(el, t) {   // the text of an element that may also hold an icon: change its first text node only
    var n = [].slice.call(el.childNodes).filter(function (x) { return x.nodeType === 3 && /\S/.test(x.nodeValue); })[0];
    if (n) n.nodeValue = t; else el.insertBefore(document.createTextNode(t), el.firstChild);
  }
  var href = function (el, u) { if (el.tagName === 'A') el.setAttribute('href', u); else el.setAttribute('data-href', u); };
  function asDiv(el) {   // a button / link cannot hold editable texts: the same element as a div
    var d = document.createElement('div');
    [].slice.call(el.attributes).forEach(function (a) { if (a.name !== 'href' && a.name !== 'target' && a.name !== 'type') d.setAttribute(a.name, a.value); });
    while (el.firstChild) d.appendChild(el.firstChild); return d;
  }
  function ed(el, m, f, multi) {
    if (!editing()) return el;
    el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); el.setAttribute('data-e', f); el.setAttribute('data-id', m.id); if (multi) el.setAttribute('data-multi', '1'); return el;
  }
  function mk(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function photoBtn(parent, m, f, folder, label, i) {
    if (!editing()) return;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.appendChild(mk('<button type="button" class="dyn-photo" data-eact="photo" data-id="' + esc(m.id) + '" data-field="' + f + '"' + (i != null ? ' data-i="' + i + '"' : '') + ' data-folder="' + folder + '">📷 ' + (label || 'Change photo') + '</button>'));
  }
  var delBtn = function (m, label) { return editing() ? '<button type="button" class="dyn-del" data-eact="del" data-id="' + esc(m.id) + '">🗑 ' + (label || 'Delete') + '</button>' : ''; };
  var addBtn = function (label, extra) { return editing() ? '<button type="button" class="dyn-add" data-eact="add"' + (extra || '') + '>＋ ' + label + '</button>' : ''; };
  var inputF = function (m, f, type, ph) { return '<input data-e="' + f + '" data-id="' + esc(m.id) + '" type="' + (type || 'text') + '" value="' + esc(m[f]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>'; };
  var selectF = function (m, f, opts) { return '<select data-e="' + f + '" data-id="' + esc(m.id) + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(m[f]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
  var prodSel = function (noneLabel) { return [['', noneLabel]].concat(productsList().map(function (p) { return [p.slug, p.title]; })); };
  function strip(inner) { var s = document.createElement('div'); s.className = 'app-strip'; s.style.flexBasis = '100%'; s.style.margin = '0'; s.innerHTML = inner; return s; }
  function addHost(host, id, html) {   // one "add" button after a list
    var old = $('[data-addhost="' + id + '"]', host); if (old) old.remove();
    if (!editing()) return; var d = document.createElement('div'); d.setAttribute('data-addhost', id); d.style.cssText = 'grid-column:1/-1;margin-top:14px'; d.innerHTML = html; host.appendChild(d);
  }
  var bound = [];
  function bindOnce(host, st, o) { if (bound.indexOf(host) >= 0) return; bound.push(host); PCE.bind(host, st, o); }
  function focusEnd(host, sel) { if (!sel) return; var f = $(sel, host); if (!f) return; f.focus(); try { var r = document.createRange(); r.selectNodeContents(f); r.collapse(false); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* ignore */ } }

  /* ================================================================= products */
  function drawProducts(focus) {
    var products = productsList(); if (!products.length) return;
    // mega menu: one column per product with the links to its groups (the group names of the shipped pages)
    var cols = swap('mega', items('cats:header'), products, function (c, p) {
      var title = c.children[0], links = c.children[1], lproto = links.children[0] ? plain(links.children[0].cloneNode(true)) : null;
      href(title, p.url); setText(title, p.title); links.innerHTML = '';
      if (lproto) p.groups.forEach(function (g, gi) { var l = lproto.cloneNode(true); href(l, p.url + (gi ? '?grp=' + gi : '')); l.textContent = g; links.appendChild(l); });
    });
    if (cols) cols.setAttribute('data-dyn', 'cat');
    swap('foot', items('cats:footer'), products, function (b, p) { href(b, p.url); b.textContent = p.title; });
    // category tabs of the products pages
    var tabs = items('cats', 'BUTTON');
    if (tabs.length) {
      var on = tabs.filter(function (b) { return b.getAttribute('data-href') === here; })[0], off = tabs.filter(function (b) { return b !== on; })[0];
      if (!PROTO.tabs) { PROTO.tabsOn = on && on.getAttribute('style'); PROTO.tabsOff = off && off.getAttribute('style'); }
      swap('tabs', tabs, products, function (b, p) { href(b, p.url); b.textContent = p.title; if (PROTO.tabsOn && PROTO.tabsOff) b.setAttribute('style', p.url === here ? PROTO.tabsOn : PROTO.tabsOff); });
    }
    // products page: the grid of cards (editable)
    var grid = swap('pcat', items('cats', 'DIV'), products, function (c, p) {
      var btns = $$('button', c), img = $('img', c), spans = $$('button:last-of-type > span', c);
      btns.forEach(function (b) { b.setAttribute('data-href', p.url); });
      if (img) { img.setAttribute('src', p.image || img.getAttribute('src')); img.setAttribute('alt', p.title); }
      if (spans[0]) setText(spans[0], p.title);
      if (spans[1]) spans[1].textContent = p.groups.length ? p.groups.join(' · ') : p.text;
      if (editing()) {
        var m = p.m, last = btns[btns.length - 1], d = asDiv(last); last.parentNode.replaceChild(d, last);
        var sp = $$(':scope > span', d); if (sp[0]) { var t = sp[0]; var tn = [].slice.call(t.childNodes).filter(function (x) { return x.nodeType === 3; })[0]; if (tn) { var s2 = document.createElement('span'); s2.textContent = tn.nodeValue; t.replaceChild(s2, tn); ed(s2, m, 'title'); } }
        if (sp[1]) { sp[1].textContent = m.text || p.groups.join(' · '); ed(sp[1], m, 'text'); }
        var ib = btns[0]; var holder = ib.parentNode; var dd = asDiv(ib); holder.replaceChild(dd, ib); photoBtn(holder, m, 'image', 'solutions');
        c.appendChild(strip('<label>Page it opens ' + inputF(m, 'link', 'text', 'products-pipe.html') + '</label><label>Order ' + inputF(m, 'order', 'number') + '</label>' + delBtn(m, 'Delete this product')));
      }
    });
    if (grid) { grid.setAttribute('data-dyn', 'cat'); addHost(grid, 'sol', addBtn('New product')); bindOnce(grid, sols, { redraw: drawProducts }); reapply(); focusEnd(grid, focus); }
    // home: the list with the photo
    var rows = items('hrows', 'LI'), imgs = items('hrows', 'IMG');
    if (rows.length) {
      var ul = rows[0].parentNode;
      if (!PROTO.hrowOn && rows.length > 1) { var bt = function (r) { var b = $('button', r); return { b: b.getAttribute('style'), arrow: b.lastElementChild.getAttribute('style') }; }; PROTO.hrowOn = bt(rows[0]); PROTO.hrowOff = bt(rows[1]); }   // the first row looks selected, the others plain: hovering moves the highlight
      swap('hrow', rows, products, function (li, p, i) {
        var b = $('button', li), sp = $$('span', b);
        if (PROTO.hrowOn) { var st = i === 0 ? PROTO.hrowOn : PROTO.hrowOff; b.setAttribute('style', st.b); b.lastElementChild.setAttribute('style', st.arrow); }
        b.setAttribute('data-href', p.url); b.setAttribute('data-hover-set', JSON.stringify({ hprod: i }));
        sp[0].textContent = String(i + 1).padStart(2, '0'); sp[1].textContent = p.title;
      });
      ul.setAttribute('data-dyn', 'cat');
      swap('himg', imgs, products, function (im, p) { im.setAttribute('src', p.image || im.getAttribute('src')); im.setAttribute('alt', p.title); im.style.opacity = 0; });
    }
    // contact form: the product select
    swap('cprod', items('cprods'), products, function (o, p) { o.value = p.title; o.textContent = p.title; });
    refresh();
  }

  /* ================================================================= project highlights */
  var storyUrl = function (s) { return 'project-highlight-' + s.slug + '.html'; };
  var storyProdTitle = function (s) { return s.tag || prodTitle(s.prod) || ''; };
  function drawStories(focus) {
    if (!stories || !$('[data-dyn-item="pcards"]')) return;
    var rows = stories.rows; if (!rows.length && !editing()) return;
    var host = swap('pcard', items('pcards'), rows, function (c, s) {
      c.setAttribute('data-href', storyUrl(s)); c.setAttribute('data-cat', s.prod); c.setAttribute('data-q', [s.title, storyProdTitle(s), s.location, s.owner, s.products].join(' ').toLowerCase());
      var img = $('img', c); if (img) { img.setAttribute('src', s.images[0] || img.getAttribute('src')); img.setAttribute('alt', s.title); }
      var sp = $$('span', c);   // tag, place, title, text, "Read more"
      if (sp.length >= 4) { sp[0].textContent = storyProdTitle(s); setText(sp[1], s.location); sp[2].textContent = s.title; sp[3].textContent = s.excerpt; }
      if (editing()) {
        var d = asDiv(c); d.removeAttribute('data-href');
        var sd = $$('span', d), pin = $('svg', sd[1]);
        sd[0].textContent = storyProdTitle(s);
        sd[1].innerHTML = (pin ? pin.outerHTML : '') + '<span>' + esc(s.location) + '</span>'; ed($('span', sd[1]), s, 'location');
        ed(sd[2], s, 'title'); ed(sd[3], s, 'excerpt', true);
        var ph = $('div', d); if (ph) photoBtn(ph, s, 'images', 'projects', 'Change photo', 0);
        d.appendChild(strip(selectF(s, 'prod', prodSel('— product —')).replace('<select', '<select title="Product (filter)"') + delBtn(s, 'Delete')));
        return d;
      }
    }, { fixEmpty: true });
    if (!host && editing()) { var g = $('[data-dyn-item="pcards"]'); host = g && g.parentNode; }
    if (host) { host.setAttribute('data-dyn', 'pf'); addHost(host, 'story', addBtn('New project highlight')); bindOnce(host, stories, { redraw: drawStories }); reapply(); focusEnd(host, focus); }
    // filter chips: All + one per product that has a project
    var chips = items('pfilters'); if (chips.length > 1) {
      if (!PROTO.chipOn) { PROTO.chipOn = chips[0].getAttribute('style'); PROTO.chipOff = chips[1].getAttribute('style'); }
      var used = []; rows.forEach(function (s) { if (s.prod && used.indexOf(s.prod) < 0) used.push(s.prod); });
      var list = [{ slug: 'all', title: 'All' }].concat(used.map(function (k) { return { slug: k, title: prodTitle(k) || k }; }));
      swap('chip', chips, list, function (b, c, i) { b.setAttribute('data-set', JSON.stringify({ phCat: c.slug })); b.textContent = c.title; b.setAttribute('style', i === 0 ? PROTO.chipOn : PROTO.chipOff); });
    }
    refresh();
  }

  /* project page (project-highlight.html?slug= / project-highlight-<slug>.html) */
  function routeSlug(prefix) {
    var q = /[?&]slug=([^&]+)/.exec(location.search); if (q) return decodeURIComponent(q[1]);
    var m = new RegExp(prefix + '-(.+)\\.html$').exec(location.pathname); return m ? decodeURIComponent(m[1]) : '';
  }
  function notFound(host, what, back, label) { host.innerHTML = '<p style="font-size:18px;margin:40px 0">This ' + what + ' was not found. <a href="' + back + '" style="color:var(--color-accent-700);font-weight:600">' + label + '</a></p>'; }
  function drawProject(focus) {
    var host = $('[data-pdetail]'); if (!host || !stories) return;
    var pid = host._pid;
    if (!pid) { var f = stories.rows.filter(function (x) { return x.slug === routeSlug('project-highlight'); })[0]; if (!f) { notFound(host, 'project highlight', 'project-highlights.html', 'See all project highlights'); return; } pid = host._pid = f.id; }
    var s = stories.by(pid); if (!s) { location.href = 'project-highlights.html'; return; }
    document.title = s.title + ' | Premier Concrete Products';
    var E = function (m, f, multi) { return editing() ? ' contenteditable="true" spellcheck="false" data-e="' + f + '" data-id="' + esc(m.id) + '"' + (multi ? ' data-multi="1"' : '') : ''; };
    var arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    var chev = function (d) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"></path></svg>'; };
    var pin = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>';
    var arrBtn = function (act, side, d) { return '<button data-act="' + act + '" aria-label="' + (act === 'gal-prev' ? 'Previous' : 'Next') + ' photo" style="position:absolute;' + side + ':14px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:0;background:rgba(255,255,255,.9);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--color-accent-800)">' + chev(d) + '</button>'; };
    var thumbs = s.images.map(function (u, i) { return '<div style="position:relative"><button data-set=\'{"phImg":' + i + '}\' aria-label="Show photo" style="padding:0;border:2px solid ' + (i ? 'transparent' : 'var(--color-accent)') + ';border-radius:10px;overflow:hidden;aspect-ratio:4/3;cursor:pointer;background:var(--color-surface);position:relative;display:block;width:100%"><img src="' + esc(u) + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></button>' +
      (editing() ? '<button type="button" class="dyn-del thumb-x" data-eact="rmarr" data-id="' + esc(s.id) + '" data-field="images" data-i="' + i + '" title="Remove photo">×</button><button type="button" class="dyn-photo" style="top:auto;bottom:4px;right:4px;padding:3px 8px;font-size:12px" data-eact="photo" data-id="' + esc(s.id) + '" data-field="images" data-i="' + i + '" data-folder="projects">📷</button>' : '') + '</div>'; }).join('');
    var facts = [['Year', 'year'], ['Owner', 'owner'], ['Products Used', 'products']].filter(function (f) { return s[f[1]] || editing(); }).map(function (f) { return '<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-neutral-800)">' + f[0] + '</span><span style="font-size:16px;font-weight:700"' + E(s, f[1]) + '>' + esc(s[f[1]]) + '</span></div>'; }).join('');
    var acc = function (title, f, open) { var body = s[f]; if (!body && !editing()) return ''; open = open || editing(); return '<div data-pacc style="border-radius:12px;overflow:hidden;border:1px solid ' + (open ? 'var(--color-accent-800)' : 'var(--color-divider)') + '"><button data-act="pacc" style="width:100%;font:inherit;text-align:left;border:0;cursor:pointer;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:17px;font-weight:700;background:' + (open ? 'var(--color-accent-800);color:#fff' : '#fff;color:var(--color-text)') + '">' + title + '<span style="flex:none;width:28px;height:28px;border-radius:999px;background:' + (open ? '#fff;color:var(--color-accent-800)' : 'var(--color-accent-100);color:var(--color-accent-800)') + ';display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1">' + (open ? '−' : '+') + '</span></button><p style="margin:0;padding:18px 20px 22px;font-size:15px;line-height:1.65;background:#fff;white-space:pre-line"' + E(s, f, true) + (open ? '' : ' hidden') + '>' + esc(body) + '</p></div>'; };
    host.innerHTML =
      '<button data-href="project-highlights.html" style="align-self:flex-start;font:inherit;font-size:14px;font-weight:600;border:0;background:none;cursor:pointer;color:var(--color-accent-700);padding:0">← All project highlights</button>' +
      '<div style="display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start"><div style="flex:1 1 420px;max-width:600px;min-width:0;display:flex;flex-direction:column;gap:12px">' +
      '<div style="position:relative;aspect-ratio:3/2;max-height:400px;border-radius:14px;overflow:hidden;background:var(--color-surface)"><img src="' + esc(s.images[0] || '') + '" alt="' + esc(s.title) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' + (s.images.length > 1 ? arrBtn('gal-prev', 'left', 'm15 18-6-6 6-6') + arrBtn('gal-next', 'right', 'm9 18 6-6-6-6') : '') + '</div>' +
      (s.images.length > 1 || editing() ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">' + thumbs + '</div>' : '') +
      (editing() ? '<div><button type="button" class="dyn-add" data-eact="photo-add" data-id="' + esc(s.id) + '" data-field="images" data-folder="projects">＋ Add photo</button></div>' : '') + '</div>' +
      '<div style="flex:1 1 400px;display:flex;flex-direction:column;gap:22px"><div style="display:flex;flex-direction:column;gap:10px;padding-bottom:22px;border-bottom:1px solid var(--color-divider)">' +
      '<span style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--color-accent-700)">Project highlights' + (editing() ? '' : (storyProdTitle(s) ? ' · ' + esc(storyProdTitle(s)) : '')) + '</span>' +
      (editing() ? '<div class="app-strip" style="margin:0">' + '<label>Product ' + selectF(s, 'prod', prodSel('— product —')) + '</label><label>Label ' + inputF(s, 'tag', 'text', 'e.g. Box Culverts') + '</label>' + delBtn(s, 'Delete this project') + '</div>' : '') +
      '<h2 style="font-size:clamp(30px,3.4vw,42px);letter-spacing:-.03em;line-height:1.08;margin:0;font-weight:700"' + E(s, 'title') + '>' + esc(s.title) + '</h2>' +
      (s.location || editing() ? '<span style="font-size:14px;font-weight:600;color:var(--color-neutral-800);display:flex;gap:6px;align-items:center">' + pin + '<span' + E(s, 'location') + '>' + esc(s.location) + '</span></span>' : '') + '</div>' +
      (facts ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px">' + facts + '</div>' : '') +
      '<div style="display:flex;flex-direction:column;gap:10px">' + acc('Client’s challenge', 'challenge', true) + acc('Premier engineered solution', 'solution', !s.challenge) + '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-primary" data-href="contact.html" style="border-radius:999px;padding:13px 22px">Discuss a similar project' + arrow + '</button></div></div></div>';
    bindOnce(host, stories, { redraw: drawProject, afterDelete: function () { stories.deleted = true; } });
    refresh(); focusEnd(host, focus);
  }
  document.addEventListener('click', function (e) {   // the accordion of the project page
    var b = e.target.closest && e.target.closest('[data-act="pacc"]'); if (!b || document.body.classList.contains('cms-editing')) return;
    var box = b.parentNode, p = $('p', box), open = p.hidden, dot = $('span', b);
    p.hidden = !open; box.style.borderColor = open ? 'var(--color-accent-800)' : 'var(--color-divider)';
    b.style.background = open ? 'var(--color-accent-800)' : '#fff'; b.style.color = open ? '#fff' : 'var(--color-text)';
    dot.style.background = open ? '#fff' : 'var(--color-accent-100)'; dot.textContent = open ? '−' : '+';
  });

  /* ================================================================= resources */
  var ext = function (u) { var m = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(u || ''); return m ? m[1].toUpperCase() : ''; };
  var articleUrl = function (r) { return (r.type === 'Blog Post' ? 'blog-' : 'webinar-') + r.slug + '.html'; };
  function drawResources(focus) {
    if (!ress || !$$('[data-vgroup="res"]').length) return;
    var products = productsList();
    // the product filter (checkboxes): one row per product
    var rf = items('rfilters');
    if (rf.length && products.length) {
      var cb = $('input[type=checkbox]', rf[0]); if (cb && !PROTO.cbStyle) PROTO.cbStyle = cb.getAttribute('style');
      var checked = $$('aside input[type=checkbox]').filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-prod'); });
      swap('rfilter', rf, products, function (d, p) {
        d.innerHTML = '<label style="display:flex;align-items:center;gap:10px;font-size:16px;font-weight:700;padding:22px 0;cursor:pointer;color:var(--color-text)"><input type="checkbox" data-prod="' + esc(p.slug) + '" style="' + PROTO.cbStyle + '"' + (checked.indexOf(p.slug) >= 0 ? ' checked' : '') + '><span>' + esc(p.title) + '</span></label>';
      });
    }
    var protoDoc = PROTO.rdoc || (PROTO.rdoc = $('[data-dyn-item="rdocs"]') && plain($('[data-dyn-item="rdocs"]').cloneNode(true)));
    var protoVid = PROTO.rvid || (PROTO.rvid = $('[data-dyn-item="rvideos"]') && plain($('[data-dyn-item="rvideos"]').cloneNode(true)));
    $$('[data-vgroup="res"]').forEach(function (col) {
      var tab = (JSON.parse(col.getAttribute('data-vstate') || '{}')).resTab, inTab = TABS[tab]; if (!inTab) return;
      var list = ress.rows.filter(function (r) { return inTab(r.type); });
      var vid = tab === 'videos' || tab === 'webinars', proto = vid ? protoVid : protoDoc;
      var grid = $('div[style*="display:grid"]', col); if (!grid || !proto) return;
      grid.innerHTML = '';
      list.forEach(function (r) {
        var c = proto.cloneNode(true), names = r.prods.map(prodTitle).filter(Boolean), art = isArt(r.type) && r.slug;
        if (r.prods.length) c.setAttribute('data-subs', r.prods.join('|')); else c.removeAttribute('data-subs');
        var link = art ? articleUrl(r) : r.file;
        if (vid) {
          var img = $('img', c); if (img) { img.setAttribute('src', r.thumb || (videoOf(link) || {}).thumb || img.getAttribute('src')); img.setAttribute('alt', r.title); }
          var sp = $$(':scope > span', c); if (sp[0]) sp[0].textContent = names.join(' · ') || 'General'; if (sp[1]) sp[1].textContent = r.title;
          if (art && !editing() && sp[0]) sp[0].remove();   // a webinar card shows only its title
          if (link && !editing()) { c.style.cursor = 'pointer'; c.setAttribute('data-open', link); }
          if (editing()) {
            if (sp[1]) { ed(sp[1], r, 'title'); }
            var box = $('div', c); if (box) photoBtn(box, r, 'thumb', 'resources', 'Change photo');
            c.appendChild(strip(selectF(r, 'prod', prodSel('General')) + '<button type="button" class="dyn-add" data-eact="filelink" data-id="' + esc(r.id) + '" data-field="file" data-title="Link of the ' + esc(r.type.toLowerCase()) + '" data-folder="resources">🔗 ' + (r.file ? 'Change link' : 'Add link') + '</button>' + delBtn(r, 'Delete')));
          }
        } else {
          var el = c; href(c, link || '#'); if (!link) c.removeAttribute('target'); else if (art) c.removeAttribute('target');
          var s2 = $$('span', c);   // type, [title, label], icon
          s2[0].textContent = (ext(r.file) || ({ 'Brochure': 'PDF', 'Data Sheet': 'PDF', 'Technical Note': 'PDF', 'Form': 'DOC' }[r.type]) || (r.type || 'DOC').slice(0, 4)).toUpperCase(); s2[2].textContent = r.title; s2[3].textContent = r.label || names.join(' · ') || 'General';
          if (art && !editing()) s2[3].remove();   // a blog post / webinar card shows only its title (the text is on its own page); in edit mode the short text stays editable
          if (editing()) {
            el = asDiv(c); el.style.flexWrap = 'wrap'; var t = $$('span', el); ed(t[2], r, 'title'); ed(t[3], r, 'label');
            el.appendChild(strip(selectF(r, 'prod', prodSel('General')) + '<button type="button" class="dyn-add" data-eact="filelink" data-id="' + esc(r.id) + '" data-field="file" data-title="Link / file of the resource" data-folder="resources">🔗 ' + (r.file ? 'Change file / link' : 'Add file / link') + '</button>' + delBtn(r, 'Delete')));
          }
          c = el;
        }
        grid.appendChild(c);
      });
      grid.setAttribute('data-dyn', 'res');
      addHost(grid, 'res-' + tab, addBtn('New ' + (tab === 'sheets' ? 'data sheet' : tab === 'downloads' ? 'download' : tab === 'videos' ? 'video' : tab === 'webinars' ? 'webinar' : tab === 'blog' ? 'blog post' : 'technical note'), ' data-tab="' + tab + '"'));
      bindOnce(col, ress, { add: function () { var m = ress.add({ type: TAB_TYPE[tab] }); return m; }, redraw: drawResources });
    });
    refresh();
  }
  /* videos play inside the website: a YouTube / Vimeo link (or a direct video file) opens in a pop-up player, everything else opens as before */
  function videoOf(u) {
    var m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i.exec(u || ''); if (m) return { kind: 'frame', src: 'https://www.youtube-nocookie.com/embed/' + m[1] + '?autoplay=1&rel=0&modestbranding=1', thumb: 'https://i.ytimg.com/vi/' + m[1] + '/hqdefault.jpg' };
    m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u || ''); if (m) return { kind: 'frame', src: 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1' };
    if (/\.(mp4|webm|ogg)(\?|#|$)/i.test(u || '')) return { kind: 'file', src: u };
    return null;
  }
  function playVideo(v) {
    var o = document.createElement('div'); o.className = 'pc-vid'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Video');
    o.innerHTML = '<div class="pc-vid-box"><button type="button" class="pc-vid-x" aria-label="Close video">&times;</button>' + (v.kind === 'file' ? '<video src="' + esc(v.src) + '" controls autoplay playsinline></video>' : '<iframe src="' + esc(v.src) + '" title="Video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>') + '</div>';
    function close() { document.removeEventListener('keydown', key); o.remove(); document.documentElement.classList.remove('pc-vid-open'); }
    function key(e) { if (e.key === 'Escape') close(); }
    o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('.pc-vid-x')) close(); });
    document.addEventListener('keydown', key); document.body.appendChild(o); document.documentElement.classList.add('pc-vid-open');
  }
  document.addEventListener('click', function (e) { var v = e.target.closest && e.target.closest('[data-open]'); if (v && !document.body.classList.contains('cms-editing')) { var u = v.getAttribute('data-open'), pv = videoOf(u); if (pv) playVideo(pv); else if (/^https?:/i.test(u)) window.open(u, '_blank', 'noopener'); else location.href = u; } });

  /* ================================================================= blog / webinar page */
  var fmtArticle = function (t, cards) {
    return String(t || '').split(/\n\s*\n/).map(function (blk) {
      var ls = blk.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return l.trim(); }), out = '';
      if (!ls.length) return '';
      if (ls.length > 1 && ls[0].length <= 70 && !/[.:;!?]$/.test(ls[0].trim()) && !/^\s*([•\-*]|\d+[.)])\s/.test(ls[0]) && !/^\s*\[image:/i.test(ls[0])) out += '<h3 class="art-h">' + esc(ls.shift().trim()) + '</h3>';
      var para = [], list = [], flush = function () { if (para.length) out += '<p>' + para.join('<br>') + '</p>'; if (list.length) out += '<ul>' + list.join('') + '</ul>'; para = []; list = []; };
      ls.forEach(function (l) {
        var im = /^\s*\[image:\s*([^\]|]+?)\s*(?:\|\s*([^\]]*?)\s*)?\]\s*$/i.exec(l);
        if (im) { if (!/^(\/?images\/|\/|https:\/\/)/i.test(im[1]) || /^\s*javascript:/i.test(im[1])) return; flush(); out += '<figure class="art-fig"><img src="' + esc(im[1]) + '" alt="' + esc(im[2] || '') + '" loading="lazy">' + (im[2] ? '<figcaption>' + esc(im[2]) + '</figcaption>' : '') + '</figure>'; return; }
        var m = /^\s*(?:[•\-*]|\d+[.)])\s+(.*)$/.exec(l);
        if (m) { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } var tx = m[1], k = cards ? tx.indexOf(':') : -1; list.push('<li>' + (k > 0 && k <= 48 ? '<strong>' + esc(tx.slice(0, k)) + '</strong> ' + esc(tx.slice(k + 1).trim().replace(/^./, function (c) { return c.toUpperCase(); })) : esc(tx)) + '</li>'); }
        else { if (list.length) { out += '<ul>' + list.join('') + '</ul>'; list = []; } para.push(esc(l.trim())); }
      });
      flush(); return out;
    }).join('');
  };
  function articlePage(kind) {
    var host = $('[data-article]'); if (!host || !ress) return;
    var type = kind === 'blog' ? 'Blog Post' : 'Webinar', pid = null;
    var m0 = ress.rows.filter(function (x) { return x.type === type && x.slug === routeSlug(kind); })[0];
    if (!m0) { notFound(host, kind === 'blog' ? 'blog post' : 'webinar', 'resources.html', 'See all resources'); return; } pid = m0.id;
    function draw(focus) {
      var r = ress.by(pid); if (!r) { location.href = 'resources.html'; return; }
      document.title = r.title + ' | Premier Concrete Products';
      var d = r.date ? new Date(r.date) : null, when = d && !isNaN(d) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      var cover = r.thumb || 'images/pcp/pipe-handler.webp', words = String(r.body || '').split(/\s+/).filter(Boolean).length, mins = Math.max(1, Math.round(words / 200));
      var E = function (f, multi) { return editing() ? ' contenteditable="true" spellcheck="false" data-e="' + f + '" data-id="' + esc(r.id) + '"' + (multi ? ' data-multi="1"' : '') : ''; };
      var photo = editing() ? '<button type="button" class="dyn-photo" data-eact="photo" data-id="' + esc(r.id) + '" data-field="thumb" data-folder="resources">📷 Change photo</button>' : '';
      var facts = [['Product', r.prods.map(prodTitle).filter(Boolean).join(', ') || 'General'], ['Posted', when]].concat(kind === 'blog' ? [['Reading time', mins + ' min']] : [['Questions?', '<a href="tel:+12256674545">+1 225.667.4545</a>']]).filter(function (x) { return x[1]; })
        .map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + (x[0] === 'Questions?' ? x[1] : esc(x[1])) + '</dd></div>'; }).join('');
      var cta = kind === 'webinar' ? (r.file && !/^https?:/i.test(r.file) ? '<a href="' + esc(r.file) + '" class="wb-cta">Request this session →</a>' : r.file ? '<a href="' + esc(r.file) + '" target="_blank" rel="noopener" class="wb-cta">Watch / Register →</a>' : '<a href="contact.html" class="wb-cta">Contact us to register →</a>') : '<a href="resources.html" class="wb-cta">More resources →</a>';
      var strip2 = editing() ? '<div class="app-strip"><label>Product ' + selectF(r, 'prod', prodSel('General')) + '</label><button type="button" class="dyn-add" data-eact="filelink" data-id="' + esc(r.id) + '" data-field="file" data-title="Link of the ' + kind + '" data-folder="resources">🔗 ' + (r.file ? 'Change link' : 'Add link') + '</button>' + delBtn(r, 'Delete this page') + '</div>' : '';
      var ins = editing() ? '<div class="art-ins"><button type="button" class="dyn-add" data-ins-img="1">＋ Insert image in the text</button><span>The picture is put where the cursor is in the text below (or at the end). It is a line like [image: /images/photo.webp | caption].</span></div>' : '';
      var body = '<div class="' + (editing() ? 'ed-multi' : 'art art-cards') + '" style="font-size:18px;line-height:1.8;min-height:60px"' + E('body', true) + '>' + (editing() ? esc(r.body) : fmtArticle(r.body, true)) + '</div>';
      host.innerHTML = '<section class="wb-hero"><img src="' + esc(cover) + '" alt=""><div class="wb-ov"></div><div class="wb-hin"><span class="wb-pill"><i></i>' + type + '</span><h1' + E('title') + '>' + esc(r.title) + '</h1>' +
        '<div class="wb-crumb"><a href="index.html">Home</a> › <a href="resources.html">Resources</a> › <span>' + esc(r.title) + '</span></div>' + (kind === 'blog' ? '<div class="bl-meta">' + (when ? esc(when) + ' · ' : '') + mins + ' min read</div>' : '') + '<div style="position:relative;margin-top:16px">' + photo + '</div></div></section>' +
        '<section class="wb-sec"><div class="wb-wrap"><div class="wb-main">' + strip2 + ins + (kind === 'blog' ? '<figure class="bl-fig"><img src="' + esc(cover) + '" alt="' + esc(r.title) + '"></figure>' : '') + body + '</div>' +
        '<aside class="wb-side"><div class="wb-card">' + (kind === 'webinar' ? '<div class="wb-img"><img src="' + esc(cover) + '" alt="' + esc(r.title) + '"><span class="wb-play" aria-hidden="true"></span></div>' : '') + '<div class="wb-body"><span class="wb-badge">' + type + '</span><dl class="wb-dl">' + facts + '</dl>' + cta + '</div></div>' +
        '<div class="bl-help"><b>Need specifications or help choosing a product?</b><span>Talk to the Premier Concrete team.</span><a href="contact.html">Contact us →</a></div></aside></div></section>';
      focusEnd(host, focus); reapply();
    }
    bindOnce(host, ress, { redraw: draw, afterDelete: function () { ress.deleted = true; } });
    host.addEventListener('click', function (e) {   // "Insert image in the text": pick a photo, upload it, put its line at the cursor
      var b = e.target.closest('[data-ins-img]'); if (!b || !editing()) return; e.preventDefault();
      var box = $('[data-e="body"][contenteditable]', host); if (!box) return;
      PCE.pickFile('image/*').then(function (file) {
        if (!file) return; b.textContent = 'Uploading…';
        return PCE.upload(file, 'resources').then(function (url) {
          box.focus(); var sel = window.getSelection();
          if (!sel.rangeCount || !box.contains(sel.anchorNode)) { var rg = document.createRange(); rg.selectNodeContents(box); rg.collapse(false); sel.removeAllRanges(); sel.addRange(rg); }
          document.execCommand('insertText', false, '\n\n[image: ' + url + ' | ]\n\n'); b.textContent = '＋ Insert image in the text';
        });
      }).catch(function (err) { window.PCDialog && PCDialog.alert(err.message, { title: 'Upload failed', danger: true }); b.textContent = '＋ Insert image in the text'; });
    });
    ress.onSaved = function () { if (ress.deleted || !ress.by(pid)) { location.href = 'resources.html'; return; } draw(); };
    draw();
  }

  /* ================================================================= solution page (product-detail-<slug>.html): hero + groups with items */
  var tplState = { groups: [], seq: 0, dirty: false, sel: 0 };
  function solutionPage() {
    var host = $('[data-soltpl]'); if (!host || !sols) return;
    var slug = routeSlug('product-detail'), m0 = sols.rows.filter(function (x) { return x.slug === slug; })[0];
    if (!m0) { notFound(host, 'product', 'products.html', 'See all products'); return; } var sid = m0.id, pageSlug = ('product-detail-' + slug).toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    var arrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    var T = tplState;
    var E = function (path, multi) { return editing() ? ' contenteditable="true" spellcheck="false" data-t="' + path + '"' + (multi ? ' data-multi="1"' : '') : ''; };
    function draw(focus) {
      var m = sols.by(sid); if (!m) { location.href = 'products.html'; return; } document.title = m.title + ' | Premier Concrete Products';
      T.sel = Math.min(T.sel, Math.max(0, T.groups.length - 1));
      var img = m.image || 'images/pcp/pipe-stack.webp';
      var groups = T.groups.map(function (g, gi) {
        var items2 = g.items.map(function (it, ii) {
          return '<details class="st-item"' + (editing() ? ' open' : '') + '><summary><span class="st-dot"></span><span' + E(gi + '.items.' + ii + '.name') + '>' + esc(it.name) + '</span></summary><div class="st-body">' +
            ((it.image || editing()) ? '<div class="st-img">' + (it.image ? '<img src="' + esc(it.image) + '" alt="' + esc(it.name) + '">' : '') + (editing() ? '<button type="button" class="dyn-photo" data-tphoto="' + gi + '.items.' + ii + '.image">📷 ' + (it.image ? 'Change photo' : 'Add photo') + '</button>' : '') + '</div>' : '') +
            '<div class="st-txt"><div' + E(gi + '.items.' + ii + '.text', true) + ' style="white-space:pre-line">' + esc(it.text) + '</div>' + (editing() ? '<button type="button" class="dyn-del" data-tdel="' + gi + '.items.' + ii + '">🗑 Remove item</button>' : '') + '</div></div></details>';
        }).join('');
        return '<div class="st-group" data-gi="' + gi + '"' + (!editing() && gi !== T.sel ? ' hidden' : '') + '><div class="st-ghead"><div><h3' + E(gi + '.name') + '>' + esc(g.name) + '</h3><p' + E(gi + '.desc', true) + '>' + esc(g.desc) + '</p>' + (editing() ? '<button type="button" class="dyn-del" data-tdel="' + gi + '">🗑 Remove group</button>' : '') + '</div>' +
          ((g.image || editing()) ? '<div class="st-gimg">' + (g.image ? '<img src="' + esc(g.image) + '" alt="' + esc(g.name) + '">' : '') + (editing() ? '<button type="button" class="dyn-photo" data-tphoto="' + gi + '.image">📷 ' + (g.image ? 'Change photo' : 'Add photo') + '</button>' : '') + '</div>' : '') + '</div>' +
          '<div class="st-list">' + items2 + '</div>' + (editing() ? '<button type="button" class="dyn-add" data-tadd="' + gi + '">＋ Add item</button>' : '') + '</div>';
      }).join('');
      var tabs = T.groups.length > 1 && !editing() ? '<div class="st-tabs" role="tablist">' + T.groups.map(function (g, gi) { return '<button type="button" role="tab" data-gtab="' + gi + '" class="' + (gi === T.sel ? 'on' : '') + '">' + esc(g.name) + '</button>'; }).join('') + '</div>' : '';
      host.innerHTML =
        '<section class="st-hero"><div class="st-hphoto"><img src="' + esc(img) + '" alt="' + esc(m.title) + '">' + (editing() ? '<button type="button" class="dyn-photo" data-eact="photo" data-id="' + esc(m.id) + '" data-field="image" data-folder="solutions">📷 Change photo</button>' : '') + '</div>' +
        '<div class="st-htxt"><h2' + (editing() ? ' contenteditable="true" spellcheck="false" data-e="title" data-id="' + esc(m.id) + '"' : '') + '>' + esc(m.title) + '</h2><p style="white-space:pre-line"' + (editing() ? ' contenteditable="true" spellcheck="false" data-multi="1" data-e="text" data-id="' + esc(m.id) + '"' : '') + '>' + esc(m.text) + '</p>' +
        '<div class="st-btns"><button class="btn btn-primary" data-href="contact.html" style="border-radius:999px;padding:13px 22px">Request a quote ' + arrow + '</button></div>' + (editing() ? '<div class="app-strip" style="margin-top:12px"><label>Order ' + inputF(m, 'order', 'number') + '</label>' + delBtn(m, 'Delete this product') + '</div>' : '') + '</div></section>' +
        '<section class="st-sec">' + tabs + groups + (editing() ? '<button type="button" class="dyn-add" data-tgroup="1">＋ Add group</button>' : (T.groups.length ? '' : '<p class="st-empty">Product details will be added soon.</p>')) + '</section>';
      focusEnd(host, focus); refresh();
    }
    // the list of groups is stored as ONE page element of this page (tpl-groups, JSON), saved with SAVE
    function mark() { T.dirty = true; if (window.PCCMS && PCCMS.refresh) PCCMS.refresh(); }
    var parse = function (v) { try { var j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (e) { return []; } };
    function loadGroups() {
      return fetch('/api/v2/page-elements/' + encodeURIComponent(pageSlug), { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (rows) {
        var row = (Array.isArray(rows) ? rows : []).filter(function (x) { return x.element_id === 'tpl-groups'; })[0], g = row ? parse(row.content_value) : [];
        T.groups = g.map(function (x) { return { name: x.name || '', desc: x.desc || '', image: x.image || '', items: (x.items || []).map(function (i) { return { name: i.name || '', text: i.text || '', image: i.image || '' }; }) }; }); T.dirty = false;
      });
    }
    var setPath = function (path, v) { var p = path.split('.'), o = T.groups; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; };
    host.addEventListener('input', function (e) { var t = e.target.closest && e.target.closest('[data-t]'); if (!t || !editing()) return; setPath(t.getAttribute('data-t'), (t.hasAttribute('data-multi') ? t.innerText : t.textContent).split(String.fromCharCode(160)).join(' ')); mark(); });
    host.addEventListener('click', function (e) {
      var t = e.target; if (!t.closest) return;
      var tab = t.closest('[data-gtab]'); if (tab) { T.sel = parseInt(tab.getAttribute('data-gtab'), 10); draw(); return; }
      if (!editing()) return;
      var ph = t.closest('[data-tphoto]'), del = t.closest('[data-tdel]'), addI = t.closest('[data-tadd]'), addG = t.closest('[data-tgroup]');
      if (ph) { e.preventDefault(); var path = ph.getAttribute('data-tphoto'); PCE.pickFile('image/*').then(function (f) { if (!f) return; ph.textContent = 'Uploading…'; return PCE.upload(f, 'solutions').then(function (u) { setPath(path, u); mark(); draw(); }); }).catch(function (er) { PCDialog.alert(er.message, { title: 'Upload failed', danger: true }); draw(); }); }
      else if (del) { e.preventDefault(); var p = del.getAttribute('data-tdel').split('.'); PCDialog.confirm({ title: 'Remove this ' + (p.length > 1 ? 'item' : 'group') + '?', message: 'It is removed from the page when you press SAVE.', ok: 'Remove', danger: true }).then(function (go) { if (!go) return; if (p.length > 1) T.groups[+p[0]].items.splice(+p[2], 1); else T.groups.splice(+p[0], 1); mark(); draw(); }); }
      else if (addI) { e.preventDefault(); var g = T.groups[+addI.getAttribute('data-tadd')]; g.items.push({ name: 'New item', text: '', image: '' }); mark(); draw(); }
      else if (addG) { e.preventDefault(); T.groups.push({ name: 'New group', desc: '', image: '', items: [] }); mark(); draw(); }
    });
    if (window.PCCMS && PCCMS.registerHook) PCCMS.registerHook('soltpl', { count: function () { return T.dirty ? 1 : 0; }, run: function () {
      var body = JSON.stringify({ page_slug: pageSlug, element_id: 'tpl-groups', content_type: 'text', content_value: JSON.stringify(T.groups) });
      return fetch('/api/v2/page-elements', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t.slice(0, 120) || ('Error ' + r.status)); if (/PENDING_APPROVAL/.test(t) && PCE) PCE.pending = true; T.dirty = false; return 1; }); });
    } });
    sols.bindHost = host; bindOnce(host, sols, { redraw: draw, afterDelete: function () { sols.deleted = true; } });
    var prevSaved = sols.onSaved; sols.onSaved = function () { if (sols.deleted || !sols.by(sid)) { location.href = 'products.html'; return; } draw(); };
    loadGroups().then(function () { draw(); });
    document.addEventListener('pc-edit-mode', function () { draw(); });
  }

  /* ================================================================= start */
  function redrawAll() { drawProducts(); drawStories(); drawProject(); drawResources(); }
  function start() {
    var wantStories = !!($('[data-dyn-item="pcards"]') || $('[data-pdetail]')), wantRes = !!($('[data-vgroup="res"]') || $('[data-article]'));
    if (!PCE) return;
    if (window.PCL) PCL.hold();   // the loader stays until the lists are drawn
    get('solutions').then(function (rows) { sols.load(rows); }).catch(function () { })
      .then(function () { return wantStories ? get('stories').then(function (rows) { stories.load(rows); }).catch(function () { }) : null; })
      .then(function () { return wantRes ? get('resources').then(function (rows) { ress.load(rows); }).catch(function () { }) : null; })
      .then(function () {
        redrawAll();
        if ($('[data-article="blog"]')) articlePage('blog'); else if ($('[data-article="webinar"]')) articlePage('webinar');
        if ($('[data-soltpl]')) solutionPage();
        sols.onSaved = sols.onSaved || function () { drawProducts(); };
        var after = sols.onSaved; sols.onSaved = function () { after(); drawProducts(); };
        stories.onSaved = function () { if (stories.deleted && $('[data-pdetail]')) { location.href = 'project-highlights.html'; return; } drawStories(); drawProject(); };
        ress.onSaved = ress.onSaved || function () { drawResources(); };
        reapply();
        document.dispatchEvent(new CustomEvent('pc-content-ready'));
        if (window.PCL) setTimeout(function () { PCL.release(); }, 120);
      })
      .catch(function () { if (window.PCL) PCL.release(); });   // (never keep the loader because of an error)
    document.addEventListener('pc-edit-mode', function () { redrawAll(); });
  }
  window.PCContent = { products: productsList, stories: function () { return stories ? stories.rows : []; }, resources: function () { return ress ? ress.rows : []; }, redraw: redrawAll };
  start();
})();
