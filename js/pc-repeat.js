/* Premier Concrete: add / remove the items of the lists of a page in the live editor (js/cms.js), on every page.
 * tools/cms-repeat.js marks the lists in the HTML:  data-rep="rep-<key>" (the list)  data-rep-item="<key>" (one item of it).
 *   - Visitors: the saved structure of a list (page element "rep-<key>", JSON {order:[item ids], news:{new id: item it was copied from}}) is applied
 *     before the texts: removed items are gone, added items are copies of the first item whose texts / photos / links are saved under keys that end
 *     with  ~<new id>  (so they are edited and saved like every other text of the page).
 *   - Admin in edit mode: every item gets a "Remove" button and every list an "Add item" button. SAVE stores the structure (together with the texts).
 * Nothing is numbered or guessed at run time: only elements that already carry a key in the HTML are used (see tools/cms-tag.js).
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var CMS = function () { return window.PCCMS || {}; };
  var editing = function () { return !!CMS().editing; };
  var REPS = [], dirty = {};

  /* ---------------------------------------------------------------- the lists as the HTML ships them */
  function itemsOf(c) { return [].slice.call(c.children).filter(function (e) { return e.hasAttribute('data-rep-item') || e.hasAttribute('data-rep-new'); }); }
  function collect() {
    $$('[data-rep]').forEach(function (c) {
      var items = {}, order = [];
      [].slice.call(c.children).forEach(function (it) { var id = it.getAttribute('data-rep-item'); if (id) { items[id] = it; order.push(id); } });
      if (!order.length) return;
      REPS.push({ key: c.getAttribute('data-rep'), el: c, items: items, made: {}, protoId: order[0], proto: plain(items[order[0]].cloneNode(true)) });
    });
  }
  // the prototype of a new item: no animation / edit leftovers, no inner lists, no state
  function plain(el) {
    [el].concat($$('*', el)).forEach(function (e) {
      [].slice.call(e.classList).forEach(function (c) { if (/^pcm|^pcr-/.test(c)) e.classList.remove(c); });
      ['data-rep', 'data-rep-item', 'contenteditable', 'spellcheck'].forEach(function (a) { e.removeAttribute(a); });
      e.style.removeProperty('--pcm-d');
    });
    $$('.pcr-x, .pcr-addhost', el).forEach(function (e) { e.remove(); });
    return el;
  }

  /* ---------------------------------------------------------------- new items */
  function suffix(el, nid) {
    [el].concat($$('[data-cms], [data-cms-link]', el)).forEach(function (e) {
      if (e.hasAttribute('data-cms')) e.setAttribute('data-cms', e.getAttribute('data-cms').replace(/~[a-z0-9]+$/, '') + '~' + nid);
      if (e.hasAttribute('data-cms-link')) e.setAttribute('data-cms-link', e.getAttribute('data-cms-link').replace(/~[a-z0-9]+$/, '') + '~' + nid);
    });
  }
  function setPlainText(el, t) {   // the text of an element that may also hold an icon: first text node only
    var n = [].slice.call(el.childNodes).filter(function (x) { return x.nodeType === 3 && /\S/.test(x.nodeValue); })[0];
    if (!n) { if (el.children.length) el.insertBefore(document.createTextNode(t), el.firstChild); else el.textContent = t; return; }
    n.nodeValue = t; [].slice.call(el.childNodes).forEach(function (x) { if (x !== n && x.nodeType === 3) x.nodeValue = ''; });
  }
  function makeNew(rep, nid, fresh) {
    var el = rep.proto.cloneNode(true); el.setAttribute('data-rep-new', nid); suffix(el, nid);
    if (fresh) {   // a brand new item: placeholder texts, no photo, empty links (all saved with SAVE)
      $$('[data-cms]', el).concat(el.hasAttribute('data-cms') ? [el] : []).forEach(function (e) {
        var type = e.getAttribute('data-cms-type');
        if (type === 'image') { e.setAttribute('hidden', ''); e.setAttribute('data-removed', '1'); }
        else setPlainText(e, 'New text');
      });
      $$('[data-cms-link]', el).concat(el.hasAttribute('data-cms-link') ? [el] : []).forEach(function (e) { if (e.tagName === 'A') e.setAttribute('href', '#'); else e.setAttribute('data-href', '#'); });
    }
    return el;
  }
  function keysOf(el) {
    var o = []; [el].concat($$('[data-cms], [data-cms-link]', el)).forEach(function (e) {
      if (e.hasAttribute('data-cms')) o.push([e.getAttribute('data-cms'), e.getAttribute('data-cms-type') === 'image' ? 'image' : 'text']);
      if (e.hasAttribute('data-cms-link')) o.push([e.getAttribute('data-cms-link'), 'link']);
    }); return o;
  }

  /* ---------------------------------------------------------------- structure <-> DOM */
  function stateOf(rep) {
    var order = [], news = {};
    itemsOf(rep.el).forEach(function (it) { if (it.hasAttribute('data-rep-new')) { var n = it.getAttribute('data-rep-new'); order.push(n); news[n] = rep.protoId; } else order.push(it.getAttribute('data-rep-item')); });
    return { order: order, news: news };
  }
  function sameOrder(a, b) { return a.length === b.length && a.every(function (x, i) { return x === b[i]; }); }
  function build(rep, state) {
    var cur = itemsOf(rep.el), last = cur[cur.length - 1], ref = last ? last.nextSibling : null;
    cur.forEach(function (e) { e.parentNode.removeChild(e); });
    state.order.forEach(function (id) {
      var el = rep.items[id] || rep.made[id] || (rep.made[id] = makeNew(rep, id, false));
      rep.el.insertBefore(el, ref);
    });
  }
  // js/cms.js calls this with the saved rows of the page before it puts the texts in
  function apply(rows) {
    var changed = false;
    REPS.forEach(function (rep) {
      var row = (rows || []).filter(function (r) { return r.element_id === rep.key; })[0]; if (!row || !row.content_value) return;
      var st; try { st = JSON.parse(row.content_value); } catch (e) { return; }
      if (!st || !Array.isArray(st.order)) return;
      var order = st.order.filter(function (id) { return rep.items[id] || (st.news && st.news[id]) || rep.made[id]; });
      if (!order.length || sameOrder(order, stateOf(rep).order)) return;
      if (dirty[rep.key]) return;   // the admin is changing it right now
      build(rep, { order: order }); changed = true;
    });
    if (changed) { if (window.PC && window.PC.refresh) window.PC.refresh(); if (editing()) decorate(); }
  }

  /* ---------------------------------------------------------------- edit mode */
  function addHost(rep) {
    var t = rep.el.tagName, h;
    if (t === 'TBODY' || t === 'TABLE' || t === 'THEAD') { h = document.createElement('tr'); h.innerHTML = '<td colspan="99"></td>'; }
    else if (t === 'UL' || t === 'OL') h = document.createElement('li');
    else h = document.createElement('div');
    h.className = 'pcr-addhost'; h.setAttribute('contenteditable', 'false'); h.setAttribute('data-addrep', rep.key);
    (h.querySelector('td') || h).innerHTML = '<button type="button" class="dyn-add" data-pcr-add="' + rep.key + '">＋ Add item</button>';
    return h;
  }
  function decorate() {
    var on = editing();
    REPS.forEach(function (rep) {
      rep.el.classList.toggle('pcr-edit', on);
      $$('.pcr-x', rep.el).forEach(function (b) { b.remove(); });
      $$('.pcr-addhost', rep.el).forEach(function (h) { if (h.getAttribute('data-addrep') === rep.key) h.remove(); });
      if (!on) return;
      itemsOf(rep.el).forEach(function (it) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'pcr-x'; b.setAttribute('contenteditable', 'false'); b.setAttribute('title', 'Remove this item'); b.textContent = '✕ Remove'; it.appendChild(b);
      });
      var host = addHost(rep), last = itemsOf(rep.el).pop();
      if (last && last.parentNode === rep.el) rep.el.insertBefore(host, last.nextSibling); else rep.el.appendChild(host);
    });
  }
  function markDirty(rep) {
    dirty[rep.key] = true;
    if (CMS().refresh) CMS().refresh();
  }
  function repOf(key) { return REPS.filter(function (r) { return r.key === key; })[0]; }
  function afterChange(rep) {
    markDirty(rep); decorate();
    if (CMS().makeEditable) CMS().makeEditable(true);
    if (CMS().rebuildBadges) CMS().rebuildBadges();
    if (window.PC && window.PC.refresh) window.PC.refresh();
  }
  document.addEventListener('click', function (e) {
    if (!editing()) return;
    var x = e.target.closest && e.target.closest('.pcr-x'), a = e.target.closest && e.target.closest('[data-pcr-add]');
    if (!x && !a) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a) {
      var rep = repOf(a.getAttribute('data-pcr-add')); if (!rep) return;
      var nid = 'n' + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 36).toString(36);
      var el = rep.made[nid] = makeNew(rep, nid, true), host = $('.pcr-addhost[data-addrep="' + rep.key + '"]', rep.el);
      rep.el.insertBefore(el, host || null);
      keysOf(el).forEach(function (k) { if (CMS().markKey) CMS().markKey(k[0], k[1]); });   // the placeholder texts are saved with the new item
      afterChange(rep);
      var first = $('[data-cms][contenteditable="true"]', el); if (first) { first.focus(); try { var r = document.createRange(); r.selectNodeContents(first); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (err) { /* ignore */ } }
      return;
    }
    var item = x.closest('[data-rep-item], [data-rep-new]'), c = item && item.parentNode, rp = c && REPS.filter(function (r) { return r.el === c; })[0]; if (!rp) return;
    var name = (item.textContent || '').replace(/✕ Remove/, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'this item';
    var ask = window.PCDialog ? PCDialog.confirm({ title: 'Remove this item?', message: 'Remove "' + name + '"?\nIt is removed from the page when you press SAVE.', ok: 'Remove', danger: true }) : Promise.resolve(true);
    ask.then(function (go) { if (!go) return; item.parentNode.removeChild(item); afterChange(rp); });
  }, true);
  document.addEventListener('pc-edit-mode', decorate);

  /* ---------------------------------------------------------------- SAVE: the structure of the changed lists is one page element each */
  function registerSave() {
    if (!CMS().registerHook) return;
    CMS().registerHook('lists', {
      count: function () { return Object.keys(dirty).length; },
      run: function () {
        var keys = Object.keys(dirty), n = 0;
        return keys.reduce(function (p, k) {
          return p.then(function () {
            var rep = repOf(k); if (!rep) return;
            var st = stateOf(rep);
            return fetch('/api/v2/page-elements', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_slug: CMS().slug, element_id: k, content_type: 'text', content_value: JSON.stringify(st) }) })
              .then(function (r) { return r.text().then(function (t) { if (r.status === 401 || r.status === 403) throw new Error('Session expired. Please sign in again.'); if (!r.ok) throw new Error(t.slice(0, 120) || ('Error ' + r.status)); if (/PENDING_APPROVAL/.test(t) && window.PCE) PCE.pending = true; delete dirty[k]; n++; }); });
          });
        }, Promise.resolve()).then(function () { return n; });
      }
    });
  }

  collect();
  if (window.PCCMS && PCCMS.onApply) PCCMS.onApply(apply);
  document.addEventListener('pc-admin', function () { registerSave(); if (editing()) decorate(); });
  window.PCRepeat = { apply: apply, decorate: decorate, lists: function () { return REPS; }, state: function (key) { var r = repOf(key); return r ? stateOf(r) : null; } };
})();
