/* Premier Concrete: the photo gallery of a product page (big photo + thumbnails) in the live editor.
 * Every thumbnail has its own image key (<key of the big photo>-s<n>, tools/build-pages.js tagGallery). In edit mode "Change image" / "Remove image" on the big photo
 * change the photo that is shown AND its thumbnail (and so the slide of the gallery); the change is saved under the key of that thumbnail.
 *   - Change: the thumbnail and the big photo show the new photo.
 *   - Remove: the photo leaves the gallery (its thumbnail is hidden, the counter and the arrows skip it). The last photo cannot be removed.
 * Visitors: the saved photos are applied to the thumbnails, so the big photo, the arrows and the counter use them.
 * (An older change of the big photo itself, saved under its own key, is read as the change of the first photo.) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var host = $('[data-gal]'), main = host && $('img[data-gal-main]', host);
  if (!host || !main) return;
  var CMS = function () { return window.PCCMS || {}; };
  var thumbImgs = function () { return $$('img[data-gal-thumb]', host); };
  var btnOf = function (img) { return img.closest('button'); };
  var isGone = function (img) { return img.hasAttribute('data-removed') || img.hidden; };
  var visible = function () { return thumbImgs().filter(function (i) { return !isGone(i); }); };

  // thumbnails that are removed are hidden; the others are numbered again (js/site.js shows photo n of the visible ones)
  function renumber() {
    var n = 0;
    thumbImgs().forEach(function (img) {
      var b = btnOf(img); if (!b) return;
      if (isGone(img)) { img.hidden = false; img.setAttribute('data-removed', '1'); b.hidden = true; return; }
      img.hidden = false; img.removeAttribute('data-removed'); b.hidden = false; b.setAttribute('data-set', JSON.stringify({ gal: n++ }));
    });
    var c = $('span[data-cms-type="text"]', main.parentElement); if (c && /\d+\s*\/\s*\d+/.test(c.textContent) && window.PC) c.textContent = (((window.PC.galIndex && window.PC.galIndex()) || 0) + 1) + ' / ' + Math.max(1, n);
  }
  function refresh(i) {
    renumber();
    if (window.PC && window.PC.refresh) window.PC.refresh();
    var v = visible(); if (!v.length) return;
    if (window.PC && window.PC.galShow) window.PC.galShow(Math.min(Math.max(0, i || 0), v.length - 1));
  }
  var current = function () { return (window.PC && window.PC.galIndex && window.PC.galIndex()) || 0; };
  var slotAt = function (i) { return visible()[i] || null; };

  // visitors / page load: the saved photos of the thumbnails
  function apply(rows) {
    var all = thumbImgs(), byKey = {}; (rows || []).forEach(function (r) { byKey[r.element_id] = r.content_value; });
    var legacy = byKey[main.getAttribute('data-cms')];   // the big photo itself was changed before the thumbnails had keys: that is the first photo
    var touched = false;
    all.forEach(function (img, i) {
      var v = byKey[img.getAttribute('data-cms')];
      if (v === undefined && i === 0 && legacy && legacy !== '__none__') v = legacy;
      if (v === undefined || v === null || v === '') return;
      if (v === '__none__') img.setAttribute('data-removed', '1'); else { img.removeAttribute('data-removed'); img.removeAttribute('srcset'); img.setAttribute('src', v); img.removeAttribute('loading'); }
      touched = true;
    });
    if (touched) refresh(0);
  }

  // the big photo is always one of the gallery photos: after the page texts are applied it is put in order again (a stale value of its own key must not win)
  document.addEventListener('pc-applied', function () {
    main.hidden = false; main.removeAttribute('data-removed');
    var s = slotAt(current()); if (s) main.setAttribute('src', s.getAttribute('src'));
  });

  window.PCGallery = {
    change: function (url) {
      var s = slotAt(current()); if (!s) return;
      var i = current();
      s.removeAttribute('data-removed'); s.removeAttribute('srcset'); s.setAttribute('src', url); s.removeAttribute('loading');
      if (CMS().markKey) CMS().markKey(s.getAttribute('data-cms'), 'image');
      refresh(i);
    },
    remove: function () {
      var v = visible(); if (v.length <= 1) { window.PCDialog && PCDialog.alert('A gallery needs at least one photo. Use "Change image" to replace it.', { title: 'Cannot remove' }); return; }
      var i = current(), s = slotAt(i); if (!s) return;
      var ask = window.PCDialog ? PCDialog.confirm({ title: 'Remove this photo?', message: 'The photo is removed from the gallery when you press SAVE.', ok: 'Remove', danger: true }) : Promise.resolve(true);
      ask.then(function (go) {
        if (!go) return;
        s.setAttribute('data-removed', '1'); if (CMS().markKey) CMS().markKey(s.getAttribute('data-cms'), 'image');
        refresh(i);
      });
    },
    slots: function () { return thumbImgs(); }
  };
  if (window.PCCMS && PCCMS.onApply) PCCMS.onApply(apply);
  if (window.PCCMS && PCCMS.reapply) setTimeout(function () { PCCMS.reapply(); }, 0);
})();
