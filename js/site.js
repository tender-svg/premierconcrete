/* Premier Concrete site behaviour (replaces the old x-dc component runtime).
 * Every page is static HTML (tools/build-pages.js); this file only adds the interactions:
 *   - navigation buttons ([data-href]), header menus, mobile menu
 *   - "choice groups": buttons with [data-set='{"key":value}'] that share a parent (tabs, filter chips, photo thumbnails,
 *     credit steps). A click changes the state; the button that matches gets the "active" look of the design
 *   - tabs / panels: [data-vgroup][data-vstate] blocks (Resources tabs), [data-grp-panel] (product groups)
 *   - accordions ([data-act="acc"] + the next [data-acc-body]), photo galleries, home sliders, product search,
 *     project and resource filters, forms (validation + thank-you screen)
 */
(function () {
  'use strict';
  var body = document.body;
  var state = {};
  try { state = JSON.parse(body.getAttribute('data-state') || '{}'); } catch (e) { state = {}; }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var jsonOf = function (el, a) { try { return JSON.parse(el.getAttribute(a)); } catch (e) { return null; } };

  /* ------------------------------------------------------------ choice groups (look of the active button) */
  var groups = [];
  function buildGroups() {
    groups = [];
    var byParent = [];
    $$('[data-set]').forEach(function (b) {
      var p = jsonOf(b, 'data-set'); if (!p) return;
      var keys = Object.keys(p).filter(function (k) { return k !== 'open' && k !== 'phOpen'; }).sort().join(',');
      if (!keys || keys === 'crStep') return;   // the credit steps are painted by crStep()
      var host = b.parentElement, g = null;
      for (var i = 0; i < byParent.length; i++) if (byParent[i].host === host && byParent[i].keys === keys) { g = byParent[i]; break; }
      if (!g) { g = { host: host, keys: keys, items: [] }; byParent.push(g); }
      g.items.push({ el: b, patch: p });
    });
    byParent.forEach(function (g) {
      if (g.items.length < 2) return;
      var k = g.keys.split(',')[0];
      var on = g.items.filter(function (it) { return it.patch[k] === state[k]; })[0];
      var off = g.items.filter(function (it) { return it !== on; })[0];
      if (!on || !off) return;
      var cap = function (el) { var c = el.firstElementChild; return { s: el.getAttribute('style') || '', c: c && c.tagName === 'IMG' ? c.getAttribute('style') || '' : null }; };
      g.on = cap(on.el); g.off = cap(off.el); g.key = k;
      groups.push(g);
    });
  }
  buildGroups();
  function paintGroups() {
    groups.forEach(function (g) {
      g.items.forEach(function (it) {
        var a = it.patch[g.key] === state[g.key], st = a ? g.on : g.off;
        it.el.setAttribute('style', st.s);
        if (st.c !== null && it.el.firstElementChild) it.el.firstElementChild.setAttribute('style', st.c);
      });
    });
  }
  var vgroups = $$('[data-vgroup]');
  function matches(vs) { return Object.keys(vs).every(function (k) { return state[k] === vs[k]; }); }
  function paintVgroups() { vgroups.forEach(function (el) { var vs = jsonOf(el, 'data-vstate'); if (vs) el.hidden = !matches(vs); }); }
  var hooks = [];   // functions called after the state changed
  function setState(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    paintGroups(); paintVgroups(); hooks.forEach(function (h) { h(patch); });
  }
  paintGroups();

  /* ------------------------------------------------------------ clicks */
  function toggleBody(btn, open) {
    var b = btn.nextElementSibling; if (!b || !b.hasAttribute('data-acc-body')) return;
    if (open === undefined) open = b.hidden;
    b.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var o = $('[data-ico="open"]', btn), c = $('[data-ico="closed"]', btn);
    if (o) o.hidden = !open; if (c) c.hidden = open;
    var t = btn.lastChild; // "View dimensions" <-> "Hide dimensions"
    if (btn.getAttribute('data-act') === 'acc-dims' && t && t.nodeType === 3) t.nodeValue = t.nodeValue.replace(/^(Hide|View)/, open ? 'Hide' : 'View');
    if (btn.closest('aside')) { var arrow = $('svg', btn); if (arrow) arrow.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)'; }   // filter groups of the Resources page
    else if (btn.getAttribute('data-act') === 'acc') btn.style.background = open ? 'var(--color-accent-100)' : '#fff';
  }
  $$('[data-act="acc"],[data-act="acc-dims"]').forEach(function (b) { toggleBody(b, false); });

  function gallery() {
    var prev = $('[data-act="gal-prev"]'); if (!prev) return null;
    var host = prev.parentElement, main = $('img', host), count = $('span', host);
    var thumbs = $$('[data-set]').filter(function (b) { var p = jsonOf(b, 'data-set'); return p && ('gal' in p || 'phImg' in p); });
    var key = thumbs.length ? ('gal' in jsonOf(thumbs[0], 'data-set') ? 'gal' : 'phImg') : 'gal';
    var srcs = thumbs.map(function (b) { var i = $('img', b); return i ? i.getAttribute('src') : ''; });
    return {
      key: key, n: srcs.length,
      show: function (i) {
        if (!srcs.length) return;
        i = (i + srcs.length) % srcs.length; state[key] = i; main.setAttribute('src', srcs[i]);
        if (count && /\d+\s*\/\s*\d+/.test(count.textContent)) count.textContent = (i + 1) + ' / ' + srcs.length;
        paintGroups();
      }
    };
  }
  var gal = gallery();

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-href],[data-set],[data-act]');
    if (!t) return;
    if (t.hasAttribute('data-href')) { if (t.tagName === 'A') return; location.href = t.getAttribute('data-href'); return; }
    if (t.hasAttribute('data-set')) {
      var patch = jsonOf(t, 'data-set'); if (!patch) return;
      if (gal && (gal.key in patch)) { gal.show(patch[gal.key]); return; }
      setState(patch); return;
    }
    var act = t.getAttribute('data-act');
    if (act === 'acc' || act === 'acc-dims') { if (!body.classList.contains('cms-editing')) toggleBody(t); }   // (in edit mode everything is open)
    else if (act === 'gal-prev' && gal) gal.show(state[gal.key] - 1);
    else if (act === 'gal-next' && gal) gal.show(state[gal.key] + 1);
    else if (act === 'hm-prev' && hm) hm.step(-1);
    else if (act === 'hm-next' && hm) hm.step(1);
    else if (act === 'res-clear') { $$('aside input[type=checkbox]').forEach(function (c) { c.checked = false; }); filterResources(); }
    else if (act === 'form-reset') { var f = t.closest('[data-sent]'); resetForm(f ? f.parentElement : document); }
    else if (act === 'cr-next') crStep(state.crStep + 1, true);
    else if (act === 'cr-prev') crStep(state.crStep - 1);
  });

  /* ------------------------------------------------------------ header: menus + mobile menu */
  (function () {
    var header = $('header'); if (!header) return;
    var mega = $('[data-mega]', header), megaBtn = $('[data-mega-open]', header);
    var wide = function () { return window.innerWidth > 1100; };
    if (mega && megaBtn) {
      megaBtn.addEventListener('mouseenter', function () { if (wide()) { mega.hidden = false; closeDd(); } });
      header.addEventListener('mouseleave', function () { mega.hidden = true; closeDd(); });
      $$('nav > div > button', header).forEach(function (b) { if (b !== megaBtn) b.addEventListener('mouseenter', function () { mega.hidden = true; }); });
    }
    function closeDd() { $$('[data-dd]', header).forEach(function (d) { d.hidden = true; }); }
    $$('[data-dd-open]', header).forEach(function (b) {
      var dd = $('[data-dd]', b.parentElement); if (!dd) return;
      b.parentElement.addEventListener('mouseenter', function () { if (wide()) { dd.hidden = false; if (mega) mega.hidden = true; } });
      b.parentElement.addEventListener('mouseleave', function () { dd.hidden = true; });
    });
    var burger = $('.pc-burger', header);
    if (burger) {
      var set = function (open) { body.classList.toggle('nav-open', open); burger.setAttribute('aria-expanded', open ? 'true' : 'false'); burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
      burger.addEventListener('click', function (e) { e.stopPropagation(); set(!body.classList.contains('nav-open')); });
      window.addEventListener('resize', function () { if (wide()) set(false); });
    }
  })();

  /* ------------------------------------------------------------ home: product list (hover) + markets slider */
  function initHome() {
    var rows = $$('[data-hover-set]'); if (!rows.length) return;
    var ul = rows[0].closest('ul'), panel = ul.nextElementSibling, imgs = $$('img', panel);
    var tag = panel.querySelector('div:last-child'), tagSpans = tag ? $$('span', tag) : [];
    var cap = function (b) { return { b: b.getAttribute('style'), arrow: b.lastElementChild.getAttribute('style') }; };
    var on = cap(rows[0]), off = cap(rows[1]);
    function show(i) {
      rows.forEach(function (r, k) { var s = k === i ? on : off; r.setAttribute('style', s.b); r.lastElementChild.setAttribute('style', s.arrow); });
      imgs.forEach(function (im, k) { im.style.opacity = k === i ? 1 : 0; });
      if (tagSpans.length > 1 && rows[i]) { var rs = $$('span', rows[i]); tagSpans[0].textContent = rs[0].textContent; tagSpans[1].textContent = rs[1].textContent; }
    }
    rows.forEach(function (r, i) { r.addEventListener('mouseenter', function () { show(i); }); r.addEventListener('focus', function () { show(i); }); });
    // phones / tablets have no hover: the big photo is hidden (css/site.css) and every row shows its own small photo; a tap opens the page
    panel.classList.add('pc-hpanel');
    rows.forEach(function (r, i) {
      var old = $('.pc-hthumb', r); if (old) old.remove();
      var im = imgs[i], sp = $$('span', r); if (!im || sp.length < 2) return;
      var t = document.createElement('img'); t.className = 'pc-hthumb'; t.alt = ''; t.loading = 'lazy'; t.src = im.getAttribute('src') || ''; r.insertBefore(t, sp[1]);
    });
    var mq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null;
    var first = function () { show(mq && mq.matches ? -1 : 0); };
    if (mq) mq.onchange = first;
    first();
  }
  initHome();
  var hm = (function () {
    var host = $('[data-hm]'); if (!host) return null;
    var track = host.firstElementChild, slides = [].slice.call(track.children), N = slides.length / 2;
    var dots = $$('span', host.nextElementSibling);
    var cur = 0, paused = false, snapping = false;
    var pv = function () { var w = host.clientWidth; return w >= 860 ? 3 : w >= 560 ? 2 : 1; };
    function layout(anim) {
      var p = pv(), gap = 16, basis = 'calc((100% - ' + ((p - 1) * gap) + 'px) / ' + p + ')';
      slides.forEach(function (s) { s.style.flex = '0 0 ' + basis; });
      track.style.transition = anim === false ? 'none' : 'transform 700ms cubic-bezier(0.65,0,0.35,1)';
      track.style.transform = 'translateX(calc(' + (-cur) + ' * (' + basis + ' + ' + gap + 'px)))';
      dots.forEach(function (d, i) { d.style.background = i === cur % N ? 'var(--color-accent)' : 'oklch(0.955 0.004 100 / 0.25)'; });
    }
    function step(d) {
      if (snapping) return;
      cur += d;
      if (cur < 0) { cur = N; layout(false); void track.offsetWidth; cur = N - 1; layout(true); return; }
      layout(true);
      if (cur >= N) { snapping = true; setTimeout(function () { cur = 0; layout(false); snapping = false; }, 720); }
    }
    host.addEventListener('mouseenter', function () { paused = true; });
    host.addEventListener('mouseleave', function () { paused = false; });
    window.addEventListener('resize', function () { layout(false); });
    setInterval(function () { if (!paused && !body.classList.contains('cms-editing')) step(1); }, 3200);
    layout(false);
    return { step: step };
  })();

  /* ------------------------------------------------------------ products: group tabs, ?grp=, search */
  (function () {
    var panels = $$('[data-grp-panel]');
    if (panels.length) {
      var m = /[?&]grp=(\d+)/.exec(location.search); if (m && +m[1] < panels.length) { state.grp = +m[1]; paintGroups(); }
      var showGrp = function () { panels = $$('[data-grp-panel]'); panels.forEach(function (p, i) { p.style.display = i === state.grp ? 'block' : 'none'; }); };   // (also in edit mode: only the tab you are on is shown and edited)
      document.addEventListener('pc-edit-mode', showGrp);
      window.__pcShowGrp = showGrp;   // (js/pc-groups.js adds / removes groups)
      showGrp(); hooks.push(function (p) { if ('grp' in p) { showGrp(); if (!body.classList.contains('cms-editing')) toggleAllClosed(); } });
      if (m) { var tabs = $('[role="tablist"]'); if (tabs) setTimeout(function () { tabs.scrollIntoView({ block: 'center' }); }, 60); }
    }
    function toggleAllClosed() { $$('[data-act="acc"]').forEach(function (b) { toggleBody(b, false); }); }
    var input = $('input[data-change="onQuery"]'); if (!input || !window.PCP_SEARCH) return;
    var main = $('main'), head = main.firstElementChild, rest = [].slice.call(main.children, 1);
    var box = document.createElement('div'); box.hidden = true;
    box.setAttribute('style', 'max-width:1440px;margin:0 auto;padding:32px clamp(20px,3vw,48px) 96px');
    main.insertBefore(box, head.nextElementSibling);
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { box.hidden = true; rest.forEach(function (r) { r.hidden = false; }); return; }
      var res = window.PCP_SEARCH.filter(function (x) { return x.h.indexOf(q) >= 0; });
      rest.forEach(function (r) { r.hidden = true; }); box.hidden = false;
      box.innerHTML = '<p style="font-size:14px;color:var(--color-neutral-800);margin:0 0 12px">' + res.length + (res.length === 1 ? ' result' : ' results') + ' for “' + esc(input.value.trim()) + '”</p>' +
        res.map(function (x) {
          var n = x.n; if (x.s && x.s.indexOf(q) >= 0 && x.n.toLowerCase().indexOf(q) < 0) n += ' (incl. ' + x.s.split(' | ').filter(function (v) { return v.indexOf(q) >= 0; }).join(', ') + ')';
          return '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:16px 0;border-bottom:1px solid var(--color-divider)"><div style="flex:1 1 260px;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600;font-size:16px">' + esc(n) + '</span><span style="font-size:13px;color:var(--color-neutral-800)">' + esc(x.g) + '</span></div>' +
            '<a class="btn btn-ghost" href="' + esc(x.f) + '" style="color:var(--color-accent-700);text-decoration:none">' + esc(x.c) + ' →</a></div>';
        }).join('');
    }
    input.addEventListener('input', run); input.addEventListener('change', run);
    input.closest('label').addEventListener('submit', function (e) { e.preventDefault(); });
    var qm = /[?&]q=([^&]+)/.exec(location.search); if (qm) { input.value = decodeURIComponent(qm[1].replace(/\+/g, ' ')); run(); }
  })();

  /* ------------------------------------------------------------ project highlights: filter chips + search */
  var phRun = null;
  function initProjects() {
    var cards = $$('[data-cat][data-q]'); if (!cards.length) return;
    var input = $('input[data-change="phOnQuery"]'), count = $('[data-ph-count]');
    function run() {
      var q = input ? input.value.trim().toLowerCase() : '', f = state.phCat || 'all', n = 0;
      cards.forEach(function (c) { var ok = (f === 'all' || c.getAttribute('data-cat') === f) && (!q || c.getAttribute('data-q').indexOf(q) >= 0); c.hidden = !ok; if (ok) n++; });
      if (count) count.textContent = n + (n === 1 ? ' project' : ' projects');
    }
    phRun = run;
    if (input) { input.oninput = run; input.onchange = run; }
    run();
  }
  hooks.push(function (p) { if ('phCat' in p && phRun) phRun(); });
  initProjects();

  /* ------------------------------------------------------------ resources: tabs (vgroups) + product filters */
  function filterResources() {
    var picked = $$('aside input[type=checkbox]').filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-prod') || c.parentElement.textContent.trim(); });   // product slugs (CMS) / group names (shipped list)
    $$('[data-vgroup="res"]').forEach(function (col) {
      var shown = 0, items = $$('[data-subs]', col), total = 0;
      var all = $$('[data-dyn-item="rdocs"],[data-dyn-item="rvideos"]', col);
      all.forEach(function (el) {
        total++;
        var subs = el.getAttribute('data-subs');
        var ok = subs === null || !picked.length || subs.split('|').some(function (s) { return picked.indexOf(s) >= 0; });
        el.hidden = !ok; if (ok) shown++;
      });
      var empty = $('[data-empty]', col); if (empty) empty.hidden = shown > 0;
    });
  }
  function initRes() { $$('aside input[type=checkbox]').forEach(function (c) { c.checked = false; c.onchange = filterResources; }); filterResources(); }
  initRes();

  /* ------------------------------------------------------------ forms */
  function resetForm(scope) {
    $$('[data-sent]', scope).forEach(function (s) { s.hidden = true; });
    $('[data-notsent]', scope).forEach(function (s) { s.hidden = false; if (s.reset) s.reset(); var after = s.nextElementSibling; if (after && after.tagName === 'SECTION') after.hidden = false; });
    if ('crStep' in state) crStep(0);
    window.scrollTo(0, 0);
  }
  function sentScreen(form) {
    var sent = form.parentElement.querySelector('[data-sent]');
    if (!sent) return;
    form.hidden = true; var after = form.nextElementSibling; if (after && after.tagName === 'SECTION') after.hidden = true;
    sent.hidden = false; window.scrollTo(0, 0);
  }
  // Cloudflare Turnstile dynamic loader
  if (typeof document !== 'undefined' && !document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    var tsScript = document.createElement('script');
    tsScript.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=auto';
    tsScript.async = true;
    tsScript.defer = true;
    (document.head || document.body || document.documentElement).appendChild(tsScript);
  }
  function formValues(form) {
    var o = {};
    $$('input,select,textarea', form).forEach(function (f) {
      var n = f.name; if (!n || f.type === 'file') return;
      if (f.type === 'checkbox') { if (f.checked) o[n] = (o[n] ? o[n] + ', ' : '') + (f.value && f.value !== 'on' ? f.value : 'Yes'); }
      else if (f.type === 'radio') { if (f.checked) o[n] = f.value; }
      else o[n] = String(f.value || '').trim();
    });
    return o;
  }
  function payloadOf(kind, form) {
    var v = formValues(form), g = function (k) { return v[k] || ''; }, lines = function (a) { return a.filter(Boolean).join('\n'); };
    const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value || (window.turnstile ? window.turnstile.getResponse() : '') || '';
    const hpValue = form.querySelector('input[name="website_hp"]')?.value || '';
    var base = { captcha_token: turnstileToken, website_hp: hpValue };
    if (kind === 'contact') {
      return Object.assign({ form_type: 'support', subject: g('subject') || 'Contact form', name: g('name'), email: g('email'), phone: g('phone'), company: g('company'), product: g('product'),
        project_country: g('country'), project_state: g('state'), project_city: g('city'), company_address: g('address'), message: g('message') }, base);
    }
    if (kind === 'lunch') {
      return Object.assign({ form_type: 'lunch_learn', subject: 'Lunch & Learn request', name: g('name'), email: g('email'), phone: g('phone'), company: g('company'), product: g('topics'), company_address: g('office_address'),
        message: lines([g('expected_attendees') && 'Expected attendees: ' + g('expected_attendees'), g('preferred_date') && 'Preferred date: ' + g('preferred_date'), g('alternate_date') && 'Alternate date: ' + g('alternate_date'), g('topics') && 'Topics of interest: ' + g('topics'), g('dietary_needs_or_notes') && 'Dietary needs or notes: ' + g('dietary_needs_or_notes')]) }, base);
    }
    // credit application: the fields are named cr-<step>-<block>-<field> by tools/build-pages.js (the order of CR_SECTIONS in the design)
    var c = function (k) { return g('cr-' + k); };
    return Object.assign({ form_type: 'credit_application', subject: 'Credit Application', name: c('7-0-0') || c('0-0-0'), email: c('0-0-19'), phone: c('0-0-13'), company: c('0-0-0'), product: c('0-0-2'), message: lines([c('3-0-1') && 'Tax contact: ' + c('3-0-1'), c('7-0-3') && 'Signature date: ' + c('7-0-3'), g('taxAck') && 'Acknowledged: sales tax is not refunded without a current exemption certificate']),
      company_address: c('0-0-3'), project_city: c('0-0-4'), project_state: c('0-0-5'), zip: c('0-0-6'), county: c('0-0-7'), date_started: c('0-0-8'), mailing_address: c('0-0-9'), mailing_city: c('0-0-10'), mailing_state: c('0-0-11'), mailing_zip: c('0-0-12'), fax: c('0-0-14'),
      owners: c('0-0-15'), fed_tax_id: c('0-0-16'), duns: c('0-0-17'), accounting_contact: c('0-0-18'), business_type: c('0-0-20'), credit_amount: c('0-0-21'), po_required: c('0-0-22'), salesperson: c('0-0-1'),
      ref1_company: c('1-0-0'), ref1_email: c('1-0-1'), ref1_phone: c('1-0-2'), ref2_company: c('1-1-0'), ref2_email: c('1-1-1'), ref2_phone: c('1-1-2'), ref3_company: c('1-2-0'), ref3_email: c('1-2-1'), ref3_phone: c('1-2-2'),
      bank_name: c('2-0-0'), bank_phone: c('2-0-1'), bank_account: c('2-0-2'), bank_contact: c('2-0-3'), bank_address: c('2-0-4'), bank_city: c('2-0-5'), bank_state: c('2-0-6'), bank_zip: c('2-0-7'),
      tax_business_type: c('3-0-0'), tax_exempt_all: c('3-0-2'), tax_exempt_some: c('3-0-3'), agree_terms: g('agreeTerms') ? 'Yes' : '', agree_guaranty: g('agreeGuaranty') ? 'Yes' : '', agree_tos: g('agreeSale') ? 'Yes' : '',
      guarantor_name: c('5-0-0'), guarantor_title: c('5-0-1'), sign_name: c('7-0-0'), sign_signature: c('7-0-1'), sign_title: c('7-0-2') }, base);
  }
  function isContactForm(form) {
    if (!form || !form.tagName || form.tagName !== 'FORM') return false;
    var id = form.id || '';
    var submitKind = form.getAttribute('data-submit') || '';
    return id === 'contactForm' || id === 'careerApplicationForm' ||
      id === 'creditApplicationForm' || id === 'lunchLearnRequestForm' ||
      submitKind === 'contact' || submitKind === 'lunch' || submitKind === 'credit';
  }
  var targetForms = $$('form#contactForm, form#lunchLearnRequestForm, form#creditApplicationForm, form#careerApplicationForm, form[data-submit]').filter(function (f, i, arr) { return arr.indexOf(f) === i && isContactForm(f); });
  targetForms.forEach(function (form) {
    if (!form.querySelector('input[name="website_hp"]')) {
      var hp = document.createElement('div');
      hp.style.cssText = 'display:none !important; visibility:hidden !important; opacity:0; position:absolute; left:-9999px; height:0; width:0; overflow:hidden;';
      hp.setAttribute('aria-hidden', 'true');
      hp.innerHTML = '<input type="text" name="website_hp" id="website_hp" tabindex="-1" autocomplete="off" value="" />';
      form.insertBefore(hp, form.firstChild);
    }
    if (!form.querySelector('.cf-turnstile')) {
      var btn = form.querySelector('button[type="submit"]');
      var cf = document.createElement('div');
      cf.className = 'cf-turnstile';
      cf.setAttribute('data-sitekey', '0x4AAAAAAFrgpAvn0SGkLylt');
      cf.setAttribute('data-theme', 'light');
      if (btn && btn.parentNode) {
        btn.parentNode.insertBefore(cf, btn);
      } else {
        form.appendChild(cf);
      }
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kind = form.getAttribute('data-submit') || (form.id === 'contactForm' ? 'contact' : (form.id === 'lunchLearnRequestForm' ? 'lunch' : (form.id === 'creditApplicationForm' ? 'credit' : 'contact')));
      if (kind === 'credit') {
        var bad = $$('section', form).filter(function (s) { return !$$('input,textarea,select', s).every(function (f) { return f.checkValidity(); }); })[0];
        if (bad) { crStep($$('section', form).indexOf(bad)); setTimeout(function () { form.reportValidity(); }, 30); return; }
      } else if (!form.checkValidity()) { form.reportValidity(); return; }
      var btn = $('button[type="submit"]', form), label = btn ? btn.innerHTML : '', msg = $('.form-err', form);
      if (!msg) { msg = document.createElement('div'); msg.className = 'form-err'; msg.setAttribute('role', 'alert'); msg.style.cssText = 'color:#b42318;font-size:15px;margin-top:12px;font-weight:600'; (btn ? btn.parentNode : form).appendChild(msg); }
      msg.textContent = ''; if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadOf(kind, form)) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === false) throw new Error(j.message || ('Error ' + r.status)); }); })
        .then(function () {
          if (window.turnstile) {
            try { window.turnstile.reset(); } catch (e) {}
          }
          sentScreen(form);
        })   // the thank-you screen shows only after the mail went out
        .catch(function (err) {
          if (window.turnstile) {
            try { window.turnstile.reset(); } catch (e) {}
          }
          msg.textContent = 'Sorry, your message could not be sent (' + (err && err.message || 'network error') + '). Please try again in a moment or call us.';
        })
        .then(function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } });
    });
  });

  /* ------------------------------------------------------------ credit application wizard */
  var crSections = $$('form[data-submit="credit"] > section');
  var crNav = $$('aside nav button[data-set]');
  function crStep(i, validate) {
    if (!crSections.length) return;
    i = Math.max(0, Math.min(crSections.length - 1, i));
    if (validate) {
      var cur = crSections[state.crStep], bad = $$('input,textarea,select', cur).filter(function (f) { return !f.checkValidity(); })[0];
      if (bad) { bad.reportValidity(); return; }
    }
    state.crStep = i;
    crSections.forEach(function (s, k) { s.style.display = k === i ? 'flex' : 'none'; });
    crNav.forEach(function (b, k) {
      var dot = b.children[0], label = b.children[1], done = k < i, cur = k === i;
      b.style.background = cur ? 'var(--color-surface)' : 'transparent';
      dot.style.background = cur || done ? 'var(--color-accent)' : 'var(--color-neutral-200)';
      dot.style.color = cur || done ? '#fff' : 'var(--color-neutral-700)';
      dot.textContent = done ? '✓' : String(k + 1);
      label.style.fontWeight = cur ? 700 : 500;
    });
    var top = $('main'); if (top && window.scrollY > 300) window.scrollTo({ top: crSections[0].getBoundingClientRect().top + window.scrollY - 160, behavior: 'smooth' });
    if (i === crSections.length - 1) {
      setTimeout(function () {
        var curSec = crSections[i];
        if (!curSec) return;
        var widget = curSec.querySelector('.cf-turnstile');
        if (widget && window.turnstile && !widget.querySelector('iframe')) {
          try {
            window.turnstile.render(widget, {
              sitekey: widget.getAttribute('data-sitekey') || '0x4AAAAAAFrgpAvn0SGkLylt',
              theme: widget.getAttribute('data-theme') || 'light'
            });
          } catch (e) {}
        }
      }, 50);
    }
  }
  if (crSections.length) {
    crNav.forEach(function (b, k) { b.addEventListener('click', function (e) { e.stopImmediatePropagation(); crStep(k); }, true); });
    crStep(0);
  }
  // live editor (js/cms.js): in edit mode every accordion row / table is open so that all of its texts can be edited
  document.addEventListener('pc-edit-mode', function (e) { $$('[data-act="acc"],[data-act="acc-dims"]').forEach(function (b) { toggleBody(b, !!e.detail.on); }); });
  paintVgroups();
  // js/pc-content.js draws lists from the CMS: after that the scripts of the changed parts start again
  window.PC = { toggleBody: toggleBody, selectGroup: function (i) { state.grp = i; buildGroups(); paintGroups(); if (window.__pcShowGrp) window.__pcShowGrp(); }, refresh: function () { buildGroups(); vgroups = $$('[data-vgroup]'); gal = gallery(); initHome(); initProjects(); initRes(); paintGroups(); paintVgroups(); } };
})();
