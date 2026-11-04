/* Premier Concrete: rows of cards that slide ([data-slider]): the "Why Premier" cards of the home page and the people of each group of the Our Team page.
 *   - edit mode: the cards are a normal grid that wraps (a card that is added appears in the next row, so every card can be edited, added and removed).
 *   - preview / visitors: ONE row. When there are more cards than fit in the row, the row slides by one card every 3 seconds, over and over
 *     (it pauses while the mouse is over it) and has a left / right arrow (outside the cards) to move it by hand.
 *   data-slider-per = cards in a row on a wide screen (default 5), data-slider-gap = the gap between the cards in px (default 16), data-slider-every = ms between two moves (default 3000).
 * The cards stay in the page as they are; only their layout changes (clones are used for the endless loop and are removed in edit mode). */
(function () {
  'use strict';
  var GAP0 = 16, EVERY0 = 3000, SPEED = 700;
  var editing = function () { return document.body.classList.contains('cms-editing'); };
  var ARROW = 'position:absolute;z-index:3;width:42px;height:42px;border-radius:999px;border:0;background:#fff;color:var(--color-accent-800);display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 10px rgba(22,50,23,.28)';
  var SVG = function (d) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };

  function init(host) {
    var WIDE = parseInt(host.getAttribute('data-slider-per'), 10) || 5, GAP = host.hasAttribute('data-slider-gap') ? parseInt(host.getAttribute('data-slider-gap'), 10) : GAP0;
    var EVERY = parseInt(host.getAttribute('data-slider-every'), 10) || EVERY0;
    var outer = null, view = null, prev = null, next = null, idx = 0, timer = 0, paused = false, busy = false, sliding = false, perN = WIDE, clones = [];
    var cards = function () { return [].slice.call(host.children).filter(function (c) { return !c.hasAttribute('data-pcs-clone'); }); };
    var perRow = function () { var w = window.innerWidth; return w > 1100 ? WIDE : w > 800 ? Math.min(WIDE, 3) : w > 520 ? Math.min(WIDE, 2) : 1; };
    var saved = host.getAttribute('style') || '';

    function wrap() {
      if (outer) return;
      outer = document.createElement('div'); outer.setAttribute('data-pcs-outer', ''); outer.style.position = 'relative';
      view = document.createElement('div'); view.setAttribute('data-pcs-view', '');
      host.parentNode.insertBefore(outer, host); outer.appendChild(view); view.appendChild(host);
      prev = document.createElement('button'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous'); prev.setAttribute('style', ARROW); prev.innerHTML = SVG('m15 18-6-6 6-6');
      next = document.createElement('button'); next.type = 'button'; next.setAttribute('aria-label', 'Next'); next.setAttribute('style', ARROW); next.innerHTML = SVG('m9 18 6-6-6-6');
      outer.appendChild(prev); outer.appendChild(next);
      prev.addEventListener('click', function () { move(-1, true); }); next.addEventListener('click', function () { move(1, true); });
      outer.addEventListener('mouseenter', function () { paused = true; }); outer.addEventListener('mouseleave', function () { paused = false; });
    }
    // the arrows sit OUTSIDE the cards: in a gutter left and right of the row (wide screens) or under the row (narrow screens)
    function arrows(on) {
      if (!prev) return;
      var side = window.innerWidth > 800;
      outer.style.padding = on ? (side ? '0 56px' : '0 0 58px') : '';
      [prev, next].forEach(function (b, k) {
        b.style.display = on ? 'flex' : 'none';
        b.style.top = side ? '50%' : 'auto'; b.style.bottom = side ? 'auto' : '0'; b.style.transform = side ? 'translateY(-50%)' : 'none';
        b.style.left = side ? (k ? 'auto' : '0') : (k ? 'auto' : 'calc(50% - 50px)'); b.style.right = side ? (k ? '0' : 'auto') : (k ? 'calc(50% - 50px)' : 'auto');
      });
    }
    function clearClones() { clones.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); }); clones = []; }
    function plain() {   // edit mode / nothing to slide: the original grid
      clearTimeout(timer); timer = 0; idx = 0; sliding = false; busy = false; clearClones(); arrows(false);
      host.setAttribute('style', saved); if (view) view.style.cssText = '';
      cards().forEach(function (c) { c.style.flex = ''; c.style.minWidth = ''; });
    }
    var offset = function (i) { return 'translateX(calc(' + i + ' * (((100% - ' + (perN - 1) * GAP + 'px) / ' + perN + ') + ' + GAP + 'px) * -1))'; };
    function place(i, animate) {
      host.style.transition = animate ? 'transform ' + SPEED + 'ms cubic-bezier(0.65,0,0.35,1)' : 'none'; host.style.transform = offset(i);
      if (!animate) void host.offsetWidth;   // (apply the jump before the next animated move)
    }
    function layout() {
      if (!host.isConnected) return;
      wrap(); clearTimeout(timer); timer = 0;
      var list = cards(); perN = perRow();
      if (editing() || list.length <= perN) { plain(); return; }   // (edit mode, or the cards fit in one row: the original grid)
      sliding = true; busy = false; clearClones(); idx = 0;
      view.style.cssText = 'overflow:hidden';
      host.style.cssText = saved + ';display:flex;flex-wrap:nowrap;gap:' + GAP + 'px;grid-template-columns:none;transition:none;transform:translateX(0)';
      var basis = 'calc((100% - ' + (perN - 1) * GAP + 'px) / ' + perN + ')';
      list.concat(list.slice(0, perN).map(function (c) { var k = c.cloneNode(true); k.setAttribute('data-pcs-clone', ''); k.removeAttribute('data-rep-item'); [].slice.call(k.querySelectorAll('[data-cms]')).forEach(function (e) { e.removeAttribute('data-cms'); e.removeAttribute('contenteditable'); }); host.appendChild(k); clones.push(k); return k; }))
        .forEach(function (c) { c.style.flex = '0 0 ' + basis; c.style.minWidth = '0'; });
      arrows(true); tick();
    }
    // one card to the left (dir 1) or right (dir -1); the row is endless: the clones of the first cards follow the last card
    function move(dir, byHand) {
      if (!sliding || editing() || busy) return;
      var total = cards().length; busy = true;
      if (dir > 0) {
        idx++; place(idx, true);
        setTimeout(function () { if (idx >= total) { idx = 0; place(0, false); } busy = false; }, SPEED + 40);
      } else {
        if (idx === 0) { idx = total; place(idx, false); }
        idx--; place(idx, true);
        setTimeout(function () { busy = false; }, SPEED + 40);
      }
      if (byHand) tick();   // (the 3 seconds start again after a click)
    }
    function tick() {
      clearTimeout(timer);
      timer = setTimeout(function () { if (editing() || !sliding) return; if (!paused) move(1); tick(); }, EVERY);
    }
    var again = (function () { var t = 0; return function () { clearTimeout(t); t = setTimeout(layout, 60); }; })();
    window.addEventListener('resize', again);
    document.addEventListener('pc-edit-mode', again);
    document.addEventListener('pc-applied', again);
    document.addEventListener('pc-content-ready', again);
    document.addEventListener('pc-groups-changed', again);
    new MutationObserver(function (m) { if (m.some(function (r) { return [].slice.call(r.addedNodes).concat([].slice.call(r.removedNodes)).some(function (n) { return !(n.nodeType === 1 && n.hasAttribute('data-pcs-clone')); }); })) again(); }).observe(host, { childList: true });
    again();
    host.__slider = { layout: layout, move: move };
  }

  var hosts = [].slice.call(document.querySelectorAll('[data-slider]'));
  hosts.forEach(init);
  window.PCSlider = { layout: function () { hosts.forEach(function (h) { h.__slider.layout(); }); }, move: function (d, byHand) { if (hosts[0]) hosts[0].__slider.move(d, byHand); }, hosts: hosts };
})();
