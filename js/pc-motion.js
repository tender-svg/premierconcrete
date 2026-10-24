/* Scroll animations (see css/pc-motion.css): the hero / banner title of every page slides in, hero photos ease in, section headings slide in and
 * photos are unveiled while scrolling. Only touches classes (no text is split or rewritten), so the CMS / editor keep working on the same elements.
 * Content drawn after the page loaded (CMS lists, the project / product / blog / webinar pages made from the templates) is picked up by a
 * MutationObserver, so every page made from a template has the same animation. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce || document.body.getAttribute('data-page') === 'login') { root.classList.remove('pcm-pre'); return; }

  // never animated: the header / footer / menus, the loader, controls and the sliders / photo lists that move or fade their own photos
  var SKIP = 'header, footer, nav, #pc-loader, [data-hm], [data-dyn-item="himg"], [data-mega], [data-dd], .pcm-banner, #cms-admin-bar, #cms-dash';
  var seen = new WeakSet();
  var ready = false, pending = [], fresh = [];

  function skip(el) { return !!el.closest(SKIP) || (el.tagName === 'IMG' && !!el.closest('a, [data-href]')); }
  function inView(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

  function reveal(el, extra) {
    if (extra) el.style.setProperty('--pcm-d', ((parseInt(el.style.getPropertyValue('--pcm-d'), 10) || 0) + extra) + 'ms');
    el.classList.add('pcm-in');
    // after the entrance the delay goes, hovers stay snappy (cards / boxes lose the animation classes completely, so their own hover transitions work again)
    setTimeout(function () {
      el.style.setProperty('--pcm-d', '0ms');
      if (el.classList.contains('pcm-block')) { el.classList.remove('pcm', 'pcm-block', 'pcm-in', 'pcm-nt'); el.style.removeProperty('--pcm-d'); }
    }, 1800 + (extra || 0));
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      if (!ready) { pending.push(en.target); return; }   // seen on the first screen while the loader / banner entrance is still running
      reveal(en.target, 0);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  // late = content (re)drawn after load (CMS lists, tabs, edits): what is already on screen must never hide and re-animate
  function add(el, cls, delay, late) {
    if (seen.has(el) || skip(el)) return;
    seen.add(el);
    if (late && ready && inView(el)) return;
    el.classList.add('pcm', cls, 'pcm-nt');
    fresh.push(el);
    if (delay) el.style.setProperty('--pcm-d', delay + 'ms');
    io.observe(el);
  }
  // one reflow applies the hidden start state of every element added in this pass, then the transitions come back
  function flush() { if (!fresh.length) return; void root.offsetWidth; fresh.forEach(function (e) { e.classList.remove('pcm-nt'); }); fresh = []; }

  // photos in the same row cascade a little
  function stagger(el) {
    var p = el.parentElement; if (!p) return 0;
    var sibs = [].filter.call(p.children, function (c) { return c.tagName === el.tagName || c.tagName === 'DIV'; });
    var i = sibs.indexOf(el); return i < 0 ? 0 : Math.min(i, 5) * 110;
  }

  function scan(scope, late) {
    scope = scope || document;
    [].forEach.call(scope.querySelectorAll('main h2, main h3'), function (el) {
      if (el.closest('.pcm-banner')) return;
      add(el, 'pcm-head', 0, late);
      var e = el.previousElementSibling;   // the small label above a section heading
      if (e && /^(SPAN|DIV)$/.test(e.tagName) && !e.children.length && e.textContent.trim().length > 0 && e.textContent.trim().length < 60) add(e, 'pcm-up', 0, late);
    });
    // the cards of the lists (products page, project highlights, resources) rise and settle one after another; their photos / texts then do not animate again
    [].forEach.call(scope.querySelectorAll('main [data-dyn-item="cats"], main [data-dyn-item="pcards"], main [data-dyn-item="rvideos"], main [data-dyn-item="rdocs"]'), function (b) {
      if (/^(BUTTON|LI|OPTION)$/.test(b.tagName) && b.getAttribute('data-dyn-item') === 'cats') return;   // the category tabs
      add(b, 'pcm-block', Math.min(stagger(b), 440), late);
    });
    [].forEach.call(scope.querySelectorAll('main img'), function (img) {
      if (img.closest('[data-dyn-item="cats"],[data-dyn-item="pcards"],[data-dyn-item="rvideos"],[data-dyn-item="rdocs"]')) return;   // inside an animated card
      if (img.closest('.pcm-banner')) return;
      var frame = img.parentElement, clipped = false;
      try { clipped = getComputedStyle(frame).overflow === 'hidden'; } catch (e) { /* ignore */ }
      add(img, 'pcm-img', stagger(img), late);
      if (clipped) img.classList.add('pcm-zoom');
    });
    flush();
  }

  // run fn once the page loader has gone, so an entrance animation is actually seen
  function afterLoader(fn) {
    if (!root.classList.contains('pc-loading') && !document.getElementById('pc-loader')) { fn(); return; }
    var started = false;
    function begin() { if (started) return; started = true; setTimeout(fn, 200); }
    new MutationObserver(function (m, o) { if (!root.classList.contains('pc-loading')) { o.disconnect(); begin(); } }).observe(root, { attributes: true, attributeFilter: ['class'] });
    setTimeout(begin, 6000);
  }

  // the hero / banner = the first block of <main> (home hero, the grey title band of the inner pages, the hero of a blog / webinar page)
  function markBanner() {
    var main = document.querySelector('main') || document.getElementById('app'); if (!main) return;
    var h = main.querySelector('h1'); if (!h) return;
    var sec = h; while (sec.parentElement && sec.parentElement !== main) sec = sec.parentElement;
    if (sec.parentElement !== main || sec.classList.contains('pcm-banner')) return;
    if (sec.getBoundingClientRect().top > innerHeight * 0.8) return;   // only a banner at the top of the page
    sec.classList.add('pcm-banner');
    var k = h.previousElementSibling; if (k) k.classList.add('pcm-k');   // the small line above the title
    if (ready) { void sec.offsetWidth; sec.classList.add('pcm-banner-on'); }
  }

  // starts the entrance animations and lifts the first-paint hold (html.pcm-pre) in the same frame
  function release() {
    ready = true;
    [].forEach.call(document.querySelectorAll('.pcm-banner:not(.pcm-banner-on)'), function (s) { void s.offsetWidth; s.classList.add('pcm-banner-on'); });
    root.classList.remove('pcm-pre');
    var q = pending; pending = [];
    q.forEach(function (el) { reveal(el, 450); });
  }

  function start() {
    root.classList.add('pc-motion');
    markBanner();
    scan();
    afterLoader(release);
    // content that appears later (CMS lists, template pages, tabs, accordions): pick up the new nodes
    var busy = 0;
    new MutationObserver(function () { clearTimeout(busy); busy = setTimeout(function () { markBanner(); scan(document, true); }, 30); })
      .observe(document.body, { childList: true, subtree: true });
    // safety net: never leave content invisible
    setTimeout(function () {
      [].forEach.call(document.querySelectorAll('.pcm:not(.pcm-in)'), function (el) { var r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('pcm-in'); });
      root.classList.remove('pcm-pre');
    }, 3500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
