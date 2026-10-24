/* Premier Concrete data cache (window.PCC).
 * The first time a visitor opens the website the page shows its loader while the CMS data of that page is fetched; the data is kept in the browser
 * (localStorage) and, once the page is shown, the data of ALL other pages and lists is fetched in the background too.
 * After that every page is drawn at once from the cache (no loader) and refreshed from the CMS in the background (js/cms.js, js/pc-content.js).
 * An admin who is signed in uses it too (no loader on every page switch; fresh data is still fetched in the background); signing in / out and every SAVE clear it.
 * Nothing here is required: if localStorage is blocked or full everything works as before (loader on every page).
 */
(function () {
  'use strict';
  var KEY = 'pc-cache-v1', T = 'pc-cache-t', ADMIN = 'pc-admin', MAX = 24 * 3600e3, FRESH = 10 * 60e3;
  var PAGES = ['index', 'products', 'products-pipe', 'products-box', 'products-drainage', 'products-utility', 'products-bridges', 'products-erosion', 'products-pipeline', 'products-masonry', 'products-hardscapes', 'about', 'our-team', 'project-highlights', 'resources', 'contact', 'lunch-learn', 'credit-application', 'privacy-policy'];
  var LISTS = ['solutions', 'stories', 'resources'];
  var mem = null, timer = 0;
  function ls(f) { try { return f(window.localStorage); } catch (e) { return null; } }
  function load() {
    if (mem) return mem;
    var j = ls(function (s) { return JSON.parse(s.getItem(KEY) || 'null'); });
    mem = j && j.v === 1 && j.pages && j.lists ? j : { v: 1, pages: {}, lists: {} }; return mem;
  }
  function flush() {
    clearTimeout(timer);
    timer = setTimeout(function () { ls(function (s) { s.setItem(KEY, JSON.stringify(mem)); s.setItem(T, String(Date.now())); }); }, 60);
  }
  var PCC = window.PCC = {
    // may the cache be used for drawing the page? (not when older than a day)
    usable: function () { return !!ls(function (s) { var t = +s.getItem(T); return t && Date.now() - t < MAX; }); },
    page: function (slug) { var e = load().pages[slug]; return e ? e.d : null; },
    list: function (path) { var e = load().lists[path]; return e ? e.d : null; },
    setPage: function (slug, rows) { if (Array.isArray(rows)) { load().pages[slug] = { t: Date.now(), d: rows }; flush(); } },
    setList: function (path, rows) { if (Array.isArray(rows)) { load().lists[path] = { t: Date.now(), d: rows }; flush(); } },
    clear: function () { clearTimeout(timer); mem = { v: 1, pages: {}, lists: {} }; ls(function (s) { s.removeItem(KEY); s.removeItem(T); }); },
    // flag of a signed-in admin (set / unset by js/cms.js and js/login.js); the cache is cleared when it changes (sign-in / sign-out), not on every page
    admin: function (on) { var was = !!ls(function (s) { return s.getItem(ADMIN); }); if (on) ls(function (s) { s.setItem(ADMIN, '1'); }); else ls(function (s) { s.removeItem(ADMIN); }); if (on !== was) PCC.clear(); }
  };

  /* background: fetch the data of the rest of the website once the page is shown (only what is missing or older than 10 minutes) */
  function jget(path) { return fetch('/api/v2/' + path, { credentials: 'include', cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  function warm() {
    if (!PCC.usable()) return; var c = load(), now = Date.now(), jobs = [];
    PAGES.forEach(function (p) { var e = c.pages[p]; if (!e || now - e.t > FRESH) jobs.push(jget('page-elements/' + encodeURIComponent(p)).then(function (d) { PCC.setPage(p, d); })); });
    LISTS.forEach(function (p) { var e = c.lists[p]; if (!e || now - e.t > FRESH) jobs.push(jget(p).then(function (d) { PCC.setList(p, d); })); });
  }
  window.addEventListener('load', function () { setTimeout(warm, 1200); });
})();
