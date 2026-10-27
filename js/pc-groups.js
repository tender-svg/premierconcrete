/* Premier Concrete: add / remove the GROUP TABS of a product page (products-pipe.html ... : "Reinforced Concrete Pipe Round (RCP)", "... Arch (RCPA)" ...)
 * in the live editor (js/cms.js).
 *   - the groups that ship with the page (tab + panel) can be REMOVED; a new group (tab + panel with a title, text, photo and accordion items) can be ADDED.
 *   - the change is stored as ONE page element of the page: "grp-struct" = { removed: [key of the removed groups], extra: [new groups] }, saved with SAVE.
 *   - visitors get the same structure (it is applied when the page texts are applied, js/cms.js onApply).
 * The texts of the groups that ship with the page keep their own keys (js/cms.js); the new groups keep their texts inside grp-struct.
 */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var CMS = function () { return window.PCCMS || {}; };
  var editing = function () { return !!CMS().editing; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  var tablist = $('[role="tablist"]'), panels0 = $$('[data-grp-panel]');
  if (!tablist || !panels0.length) return;
  var tabs0 = $$('[role="tab"]', tablist);
  if (tabs0.length !== panels0.length) return;

  var ON = '', OFF = '';
  tabs0.forEach(function (t) { var s = t.getAttribute('style') || ''; if (/background:var\(--color-accent\);/.test(s)) ON = ON || s; else OFF = OFF || s; });
  ON = ON || tabs0[0].getAttribute('style'); OFF = OFF || ON;
  var STATIC = panels0.map(function (p, i) { var h = $('h3[data-cms]', p); return { key: h ? h.getAttribute('data-cms') : 'g' + i, panel: p, tab: tabs0[i] }; });
  var tabProto = tabs0[tabs0.length - 1].cloneNode(false);   // a plain tab button (no children)
  var host = panels0[0].parentNode, endMark = document.createElement('div'); endMark.hidden = true; endMark.setAttribute('data-pcg-end', '');
  host.insertBefore(endMark, panels0[panels0.length - 1].nextSibling);

  var S = { removed: [], extra: [] }, dirty = false, list = [];
  var arrow = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>';
  var minus = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg>';

  /* ---------------------------------------------------------------- the new groups */
  function T(path, multi) { return editing() ? ' contenteditable="true" spellcheck="false" data-pcgt="' + path + '"' + (multi ? ' data-multi="1"' : '') : ''; }
  function itemHtml(g, ii) {
    var it = g.items[ii], open = editing();
    return '<div style="border-top:0">' +
      '<button type="button" data-act="acc" aria-expanded="' + open + '" style="width:100%;display:flex;align-items:center;gap:16px;padding:26px 28px;background:' + (open ? 'var(--color-accent-100)' : '#fff') + ';border:0;cursor:pointer;font:inherit;text-align:left;color:var(--color-text)" class="hv-6">' +
      '<span style="width:8px;height:8px;border-radius:999px;background:var(--color-accent);flex:none"></span><span style="font-weight:600;font-size:17px;flex:1"' + T('items.' + ii + '.name') + '>' + esc(it.name) + '</span>' +
      '<span style="color:var(--color-accent);display:flex"><span data-ico="open"' + (open ? '' : ' hidden') + '>' + minus + '</span><span data-ico="closed"' + (open ? ' hidden' : '') + '>' + arrow + '</span></span></button>' +
      '<div data-acc-body' + (open ? '' : ' hidden') + ' style="display:contents"><div style="padding:24px 40px 40px 48px;display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start;background:#fff">' +
      ((it.image || editing()) ? '<div style="flex:1 1 420px;max-width:520px;aspect-ratio:4/3;position:relative">' + (it.image ? '<img src="' + esc(it.image) + '" alt="' + esc(it.name) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain">' : '') +
        (editing() ? '<button type="button" class="dyn-photo" data-pcgp="items.' + ii + '.image">📷 ' + (it.image ? 'Change photo' : 'Add photo') + '</button>' : '') + '</div>' : '') +
      '<div style="flex:1 1 380px;display:flex;flex-direction:column;gap:18px;padding-top:8px"><div class="pcp-rte"><p style="white-space:pre-line"' + T('items.' + ii + '.text', true) + '>' + esc(it.text) + '</p></div>' +
      (editing() ? '<button type="button" class="dyn-del" data-pcgd="' + ii + '">🗑 Remove item</button>' : '<div><button type="button" data-href="contact.html" style="font:inherit;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;background:transparent;border:1.5px solid var(--color-accent);border-radius:4px;padding:13px 20px;cursor:pointer;color:var(--color-accent-700)" class="hv-6">Request a quote</button></div>') +
      '</div></div></div></div>';
  }
  function panelHtml(g) {
    var items = g.items.map(function (it, ii) { return itemHtml(g, ii); }).join('');
    return '<div style="display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start;margin-bottom:40px"><div style="flex:2 1 480px;display:flex;flex-direction:column;gap:16px">' +
      '<h3 style="font-size:34px;letter-spacing:-.025em;line-height:1.1;margin:0;font-weight:700;color:var(--color-accent-700)"' + T('name') + '>' + esc(g.name) + '</h3>' +
      '<p style="font-size:16px;line-height:1.7;margin:0;white-space:pre-line;color:var(--color-neutral-800);text-wrap:pretty"' + T('desc', true) + '>' + esc(g.desc) + '</p></div>' +
      ((g.image || editing()) ? '<div style="flex:1 1 300px;aspect-ratio:4/3;position:relative;overflow:hidden">' + (g.image ? '<img src="' + esc(g.image) + '" alt="' + esc(g.name) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply">' : '') +
        (editing() ? '<button type="button" class="dyn-photo" data-pcgp="image">📷 ' + (g.image ? 'Change photo' : 'Add photo') + '</button>' : '') + '</div>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:20px;margin-top:0"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(22,50,23,.08)">' + items + '</div>' +
      (editing() ? '<div><button type="button" class="dyn-add" data-pcga="1">＋ Add item</button></div>' : '') + '</div>';
  }
  function extraPanel(g) {
    var p = document.createElement('div'); p.setAttribute('data-grp-panel', '0'); p.setAttribute('data-pcg-extra', g.id); p.style.display = 'block'; p.innerHTML = panelHtml(g); return p;
  }
  function extraTab(g) { var t = tabProto.cloneNode(false); t.setAttribute('data-pcg-extra', g.id); t.textContent = g.name || 'New group'; return t; }
  function groupOf(el) { var p = el.closest && el.closest('[data-pcg-extra]'); return p ? S.extra.filter(function (g) { return g.id === p.getAttribute('data-pcg-extra'); })[0] : null; }

  /* ---------------------------------------------------------------- structure -> DOM */
  function build(select) {
    STATIC.forEach(function (s) { [s.panel, s.tab].forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); });
    $$('[data-pcg-extra]').forEach(function (e) { e.parentNode.removeChild(e); });
    $$('.pcg-x, .pcg-add', tablist).forEach(function (e) { e.parentNode.removeChild(e); });
    list = [];
    STATIC.forEach(function (s) { if (S.removed.indexOf(s.key) < 0) list.push({ key: s.key, tab: s.tab, panel: s.panel }); });
    S.extra.forEach(function (g) { list.push({ key: g.id, extra: g, tab: extraTab(g), panel: extraPanel(g) }); });
    list.forEach(function (g, i) {
      g.tab.setAttribute('data-set', JSON.stringify({ grp: i, open: [] })); g.tab.setAttribute('style', i === (select || 0) ? ON : OFF);
      g.panel.setAttribute('data-grp-panel', String(i)); g.panel.style.display = i === (select || 0) ? 'block' : 'none';
      tablist.appendChild(g.tab); host.insertBefore(g.panel, endMark);
    });
    if (window.PC && window.PC.selectGroup) window.PC.selectGroup(select || 0);
    decorate();
    document.dispatchEvent(new CustomEvent('pc-groups-changed'));
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function parse(rows) {
    var row = (rows || []).filter(function (r) { return r.element_id === 'grp-struct'; })[0], j = null;
    if (row && row.content_value) { try { j = JSON.parse(row.content_value); } catch (e) { j = null; } }
    var clean = function (g) { return { id: String(g.id || ('n' + Math.random().toString(36).slice(2, 6))), name: g.name || '', desc: g.desc || '', image: g.image || '', items: (g.items || []).map(function (i) { return { name: i.name || '', text: i.text || '', image: i.image || '' }; }) }; };
    return { removed: j && Array.isArray(j.removed) ? j.removed.filter(function (k) { return STATIC.some(function (s) { return s.key === k; }); }) : [], extra: j && Array.isArray(j.extra) ? j.extra.map(clean) : [] };
  }
  function apply(rows) {
    if (dirty) return;   // the admin is changing it right now
    var n = parse(rows); if (same(n, S) && (list.length || !n.removed.length)) { if (!list.length) { list = []; } else return; }
    S = n; build(0);
  }

  /* ---------------------------------------------------------------- edit mode */
  function decorate() {
    $$('.pcg-x, .pcg-add', tablist).forEach(function (e) { e.parentNode.removeChild(e); });
    if (!editing()) return;
    list.forEach(function (g, i) {
      var x = document.createElement('span'); x.className = 'pcg-x'; x.setAttribute('contenteditable', 'false'); x.setAttribute('data-pcg-rm', String(i)); x.setAttribute('title', 'Remove this group'); x.textContent = '✕'; g.tab.appendChild(x);
    });
    var a = document.createElement('button'); a.type = 'button'; a.className = 'dyn-add pcg-add'; a.setAttribute('data-pcg-add', '1'); a.textContent = '＋ Add group'; tablist.appendChild(a);
  }
  function mark() { dirty = true; if (CMS().refresh) CMS().refresh(); }
  function setPath(g, path, v) { var p = path.split('.'), o = g; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = v; }
  function redraw(g) {   // re-draw the panel of one new group (keeps the selected tab)
    var cur = list.filter(function (x) { return x.extra === g; })[0]; if (!cur) return;
    var np = extraPanel(g); np.setAttribute('data-grp-panel', cur.panel.getAttribute('data-grp-panel')); np.style.display = cur.panel.style.display;
    cur.panel.parentNode.replaceChild(np, cur.panel); cur.panel = np;
    if (window.PC && window.PC.refresh) window.PC.refresh();
  }
  function selectedIndex() { return Math.max(0, list.map(function (g) { return g.tab.getAttribute('style') === ON; }).indexOf(true)); }

  document.addEventListener('click', function (e) {
    if (!editing() || !e.target.closest) return;
    var t = e.target, rm = t.closest('[data-pcg-rm]'), add = t.closest('[data-pcg-add]'), ph = t.closest('[data-pcgp]'), del = t.closest('[data-pcgd]'), addI = t.closest('[data-pcga]');
    if (!rm && !add && !ph && !del && !addI) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var g;
    if (add) {
      S.extra.push({ id: 'n' + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 36).toString(36), name: 'New group', desc: 'Describe this group. Click the text to edit it.', image: '', items: [{ name: 'New item', text: 'Describe this item. Click the text to edit it.', image: '' }] });
      mark(); build(list.length); var np = list[list.length - 1]; if (np && np.panel.scrollIntoView) np.panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (rm) {
      var i = parseInt(rm.getAttribute('data-pcg-rm'), 10), item = list[i]; if (!item) return;
      if (list.length <= 1) { window.PCDialog && PCDialog.alert('A product page needs at least one group.', { title: 'Cannot remove' }); return; }
      var nm = (item.tab.textContent || '').replace('✕', '').trim() || 'this group';
      var ask = window.PCDialog ? PCDialog.confirm({ title: 'Remove this group?', message: 'Remove the group "' + nm + '" (tab and everything in it)?\nIt is removed from the page when you press SAVE.', ok: 'Remove', danger: true }) : Promise.resolve(true);
      ask.then(function (go) {
        if (!go) return;
        if (item.extra) S.extra = S.extra.filter(function (x) { return x !== item.extra; }); else if (S.removed.indexOf(item.key) < 0) S.removed.push(item.key);
        mark(); build(0);
      });
    } else if (ph && (g = groupOf(ph)) && window.PCE) {
      var path = ph.getAttribute('data-pcgp');
      PCE.pickFile('image/*').then(function (f) { if (!f) return; ph.textContent = 'Uploading…'; return PCE.upload(f, 'solutions').then(function (u) { setPath(g, path, u); mark(); redraw(g); }); })
        .catch(function (err) { ph.textContent = '📷 Add photo'; window.PCDialog && PCDialog.alert(err.message, { title: 'Upload failed', danger: true }); });
    } else if (del && (g = groupOf(del))) {
      g.items.splice(parseInt(del.getAttribute('data-pcgd'), 10), 1); mark(); redraw(g);
    } else if (addI && (g = groupOf(addI))) {
      g.items.push({ name: 'New item', text: 'Describe this item. Click the text to edit it.', image: '' }); mark(); redraw(g);
    }
  }, true);
  document.addEventListener('input', function (e) {
    var f = e.target.closest && e.target.closest('[data-pcgt]'); if (!f || !editing()) return;
    var g = groupOf(f); if (!g) return;
    var v = (f.hasAttribute('data-multi') ? f.innerText : f.textContent).replace(/ /g, ' ');
    var path = f.getAttribute('data-pcgt'); setPath(g, path, v); mark();
    if (path === 'name') { var cur = list.filter(function (x) { return x.extra === g; })[0]; if (cur) { var n = [].slice.call(cur.tab.childNodes).filter(function (c) { return c.nodeType === 3; })[0]; if (n) n.nodeValue = v || 'New group'; } }
  });
  document.addEventListener('keydown', function (e) {   // typing inside a title that sits in a button: space must write a space, Enter must not click
    var f = e.target.closest && e.target.closest('[data-pcgt]'); if (!f || !editing()) return;
    if (e.key === ' ') { e.preventDefault(); document.execCommand('insertText', false, ' '); }
    else if (e.key === 'Enter') { e.preventDefault(); document.execCommand(f.hasAttribute('data-multi') ? 'insertLineBreak' : 'insertText', false, f.hasAttribute('data-multi') ? undefined : ' '); }
  }, true);
  document.addEventListener('paste', function (e) {
    var f = e.target.closest && e.target.closest('[data-pcgt]'); if (!f || !editing()) return;
    e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
  }, true);
  document.addEventListener('pc-edit-mode', function () {
    var sel = selectedIndex(); build(sel);
  });

  /* ---------------------------------------------------------------- SAVE */
  function registerSave() {
    if (!CMS().registerHook) return;
    CMS().registerHook('groups', {
      count: function () { return dirty ? 1 : 0; },
      run: function () {
        var body = JSON.stringify({ page_slug: CMS().slug, element_id: 'grp-struct', content_type: 'text', content_value: JSON.stringify(S) });
        return fetch('/api/v2/page-elements', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body }).then(function (r) {
          return r.text().then(function (t) {
            if (r.status === 401 || r.status === 403) throw new Error('Session expired. Please sign in again.');
            if (!r.ok) throw new Error(t.slice(0, 120) || ('Error ' + r.status));
            if (/PENDING_APPROVAL/.test(t) && window.PCE) PCE.pending = true;
            dirty = false; return 1;
          });
        });
      }
    });
  }

  if (window.PCCMS && PCCMS.onApply) PCCMS.onApply(apply);
  document.addEventListener('pc-admin', registerSave);
  if (window.PCCMS && PCCMS.reapply) setTimeout(function () { PCCMS.reapply(); }, 0);   // (the page texts may have been applied before this script ran)
  window.PCGroups = { state: function () { return S; }, apply: apply, list: function () { return list; } };
})();
