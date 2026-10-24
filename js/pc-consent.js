/* Cookie banner + cookie settings (css/pc-consent.css).
 * The visitor's choice is kept in the browser (localStorage "pc-consent"). Necessary storage (CMS login, page cache, this choice) is always on;
 * third-party "marketing / analytics" tools (ZoomInfo) are only loaded after the visitor accepts them.
 * To switch ZoomInfo on, put the address of the ZoomInfo script that ZoomInfo gives you in ZI.src below (nothing is loaded while it is empty).
 * Footer link [data-cookie-settings] re-opens the settings; other scripts can listen to the "pc-consent" event (detail.marketing). */
(function () {
  'use strict';
  var KEY = 'pc-consent';
  var ZI = { src: '' };   // <- ZoomInfo script address
  var page = document.body && document.body.getAttribute('data-page');
  if (page === 'login') return;

  function read() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && j.v === 1 ? j : null; } catch (e) { return null; } }
  function write(m) { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, marketing: !!m, t: Date.now() })); } catch (e) { /* ignore */ } }
  var loaded = false;
  function loadMarketing() {
    if (loaded || !ZI.src) return; loaded = true;
    var s = document.createElement('script'); s.src = ZI.src; s.async = true; document.head.appendChild(s);
  }
  function apply(m, was) {
    document.dispatchEvent(new CustomEvent('pc-consent', { detail: { marketing: !!m } }));
    if (m) loadMarketing(); else if (loaded || was) location.reload();   // a script that is already running cannot be switched off: the page starts again without it
  }

  var box = null;
  function close() { if (box) { box.classList.remove('show'); var b = box; setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300); box = null; } }
  function choose(m) { var was = !!(read() || {}).marketing; write(m); close(); apply(m, was); }
  function open(settings) {
    if (box) { if (settings) box.classList.add('pcc-set'); return; }
    var cur = read();
    box = document.createElement('div'); box.id = 'pc-consent'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Cookie settings');
    box.innerHTML = '<div class="pcc-in"><button type="button" class="pcc-x" data-c="x" aria-label="Close">&times;</button><div class="pcc-main"><h2>Our Site Uses Cookies</h2>' +
      '<p>We use cookies to make our website work and to remember your preferences. We also use a third-party tracking tag from ZoomInfo to understand which businesses visit our website.</p>' +
      '<p>See our <a href="privacy-policy.html#cookies">Cookie Policy</a> and <a href="privacy-policy.html">Privacy Statement</a> for details, including your privacy rights.</p>' +
      '<div class="pcc-btns"><button type="button" class="pcc-b pri" data-c="all">Accept</button><button type="button" class="pcc-b" data-c="none">Deny</button><button type="button" class="pcc-b" data-c="set">View preferences</button></div>' +
      '<a href="#" class="pcc-dns" data-c="set">Do Not Sell or Share My Personal Information</a></div>' +
      '<div class="pcc-pane"><h2>Cookie preferences</h2><label class="pcc-row"><span><b>Necessary</b><small>Keeps the website working: staff login, page speed, and remembering this choice. Always on.</small></span><input type="checkbox" checked disabled></label>' +
      '<label class="pcc-row"><span><b>Marketing &amp; analytics (ZoomInfo)</b><small>Lets ZoomInfo, a third-party business information service, recognise which companies visit the website. Turn off to opt out of this sharing.</small></span><input type="checkbox" id="pcc-m"' + (cur && cur.marketing ? ' checked' : '') + '></label>' +
      '<div class="pcc-btns"><button type="button" class="pcc-b pri" data-c="save">Save choices</button><button type="button" class="pcc-b" data-c="back">Back</button></div></div></div>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-c]'); if (!b) return; e.preventDefault(); var c = b.getAttribute('data-c');
      if (c === 'all') choose(true); else if (c === 'none') choose(false);
      else if (c === 'set') box.classList.add('pcc-set'); else if (c === 'back') box.classList.remove('pcc-set');
      else if (c === 'x') close(); else if (c === 'save') choose(box.querySelector('#pcc-m').checked);
    });
    if (settings) box.classList.add('pcc-set');
    document.body.appendChild(box); void box.offsetWidth; box.classList.add('show');
  }

  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-cookie-settings]'); if (a) { e.preventDefault(); open(true); } });
  window.PCConsent = { get: function () { return read(); }, open: function () { open(true); } };

  var c = read();
  if (c) { if (c.marketing) loadMarketing(); return; }
  // first visit: the banner appears once the page loader has gone
  var tries = 0;
  (function wait() { if (document.documentElement.classList.contains('pc-loading') && tries++ < 40) { setTimeout(wait, 250); return; } setTimeout(function () { if (!read()) open(false); }, 600); })();
})();
