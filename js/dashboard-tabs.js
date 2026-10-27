/* CMS Dashboard > Products > (a product) > "Edit tabs and their data".
 * Edits the tabs (groups) of the page of a product and everything inside them - the same data that the live editor changes on the page:
 *   - a product page that ships as a file (products-pipe.html ...): the page is read, every text / photo / link of every group is a field; dropdowns and bullets
 *     can be added and removed; a tab can be removed and new tabs added (page elements "rep-..." and "grp-struct", exactly what js/pc-repeat.js / js/pc-groups.js store);
 *   - a product with an automatic page (product-detail-<name>.html): its groups are the page element "tpl-groups".
 * Uses window.PCDash (api, upload, ... of js/dashboard.js). */
(function () {
  'use strict';
  var D = window.PCDash; if (!D) return;
  var api = D.api, esc = D.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var S = null;   // the open editor: { mode, slug, row, saved, groups[], extra[], removedGroups[], lists{}, loaded{ struct, reps } }

  /* ---------------------------------------------------------------- text <-> what is stored
   * (the live editor stores the innerHTML of a text; the form shows plain text and a text is only written back when it was changed) */
  function toPlain(h) { var t = document.createElement('div'); t.innerHTML = String(h == null ? '' : h).replace(/<br\s*\/?>/gi, '\n'); return t.textContent.replace(/ /g, ' ').trim(); }
  function fromPlain(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>'); }
  var uid = function () { return 'n' + Date.now().toString(36).slice(-4) + Math.floor(Math.random() * 36).toString(36); };

  /* ---------------------------------------------------------------- read a page that ships as a file */
  function labelOf(el) {
    var t = el.tagName.toLowerCase();
    if (el.getAttribute('data-cms-type') === 'image') return 'Photo';
    if (t === 'h2' || t === 'h3') return 'Title';
    if (el.closest('.pcp-rte')) return 'Text';
    if (t === 'p') return 'Description';
    if (t === 'a' || t === 'button') return 'Button text';
    if (t === 'span' && /uppercase/.test(el.getAttribute('style') || '')) return 'Label';
    return 'Text';
  }
  function fieldsOf(box, skipReps, saved) {
    var out = [], seen = {};
    $$('[data-cms], [data-cms-link]', box).forEach(function (el) {
      var rp = el.closest('[data-rep]'); if (skipReps && rp && rp !== box && box.contains(rp)) return;   // (the lists inside a group are read separately)
      var k = el.getAttribute('data-cms'), lk = el.getAttribute('data-cms-link');
      if (k && !seen[k]) {
        seen[k] = 1;
        var img = el.getAttribute('data-cms-type') === 'image';
        var orig = saved[k] !== undefined ? saved[k] : (img ? (el.getAttribute('src') || '') : el.innerHTML);
        out.push({ key: k, type: img ? 'image' : 'text', label: labelOf(el), orig: img ? (orig === '__none__' ? '' : orig) : toPlain(orig), multi: !img && el.tagName.toLowerCase() === 'p' });
      }
      if (lk && !seen[lk]) {
        seen[lk] = 1;
        var cur = saved[lk] !== undefined ? saved[lk] : (el.getAttribute('href') || el.getAttribute('data-href') || ''), name = toPlain(el.innerHTML).slice(0, 40);
        out.push({ key: lk, type: 'link', label: 'Link or file of "' + (name || 'this button') + '"', orig: cur === '#' ? '' : cur });
      }
    });
    return out;
  }
  function parsePage(html, saved) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    return $$('[data-grp-panel]', doc).map(function (p) {
      var h3 = $('h3[data-cms]', p), g = { key: h3 ? h3.getAttribute('data-cms') : '', name: h3 ? toPlain(saved[h3.getAttribute('data-cms')] !== undefined ? saved[h3.getAttribute('data-cms')] : h3.innerHTML) : 'Tab', fields: fieldsOf(p, true, saved), lists: [] };
      $$('[data-rep]', p).forEach(function (l) {
        var rep = l.getAttribute('data-rep'), kids = [].slice.call(l.children).filter(function (c) { return c.hasAttribute('data-rep-item'); });
        var acc = kids.length ? !!kids[0].querySelector(':scope > button[data-act="acc"]') : !!l.hasAttribute('data-dd-empty');
        var protoEl = kids[0] || (function () { var tp = l.parentNode && l.parentNode.querySelector('template[data-rep-proto="' + rep + '"]'); return tp && (tp.content || tp).firstElementChild; })();
        if (!protoEl) return;
        var ids = kids.map(function (c) { return c.getAttribute('data-rep-item'); }), items = {};
        kids.forEach(function (c) { items[c.getAttribute('data-rep-item')] = fieldsOf(c, true, saved); });
        var protoFields = fieldsOf(protoEl, true, {}), row = saved[rep], st = null;
        if (row) { try { st = JSON.parse(row); } catch (e) { st = null; } }
        var order = st && Array.isArray(st.order) ? st.order.filter(function (id) { return items[id] || (st.news && st.news[id]); }) : ids.slice();
        var list = { rep: rep, acc: acc, protoFields: protoFields.map(function (f) { return { key: f.key, type: f.type, label: f.label, multi: f.multi }; }), items: [], ids: ids.slice(), initOrder: order.slice(), initNews: (st && st.news) || {} };
        order.forEach(function (id) {
          if (items[id]) list.items.push({ id: id, isNew: false, fields: items[id] });
          else list.items.push({ id: id, isNew: true, fields: protoFields.map(function (f) { var k = f.key + '~' + id, v = saved[k]; return { key: k, type: f.type, label: f.label, multi: f.multi, orig: v === undefined ? '' : (f.type === 'text' ? toPlain(v) : (v === '__none__' ? '' : v)) }; }) });
        });
        g.lists.push(list);
      });
      return g;
    });
  }

  /* ---------------------------------------------------------------- the form */
  var ctr = 0;
  function fieldHtml(f) {
    var id = 'dtf' + (++ctr), val = esc(f.orig == null ? '' : f.orig), ro = ' data-k="' + esc(f.key) + '" data-t="' + f.type + '" data-o="' + val + '"';
    if (f.type === 'image' || f.type === 'link') {
      var img = f.type === 'image', ph = img ? (f.orig ? '<img src="' + val + '" alt="">' : '<div class="ph">no photo yet</div>') : '<div class="ph">' + (f.orig ? 'file attached' : 'no file yet') + '</div>';
      return '<div class="db-field full dt-f" data-dtup data-kind="' + (img ? 'image' : 'file') + '"><span>' + esc(f.label) + '</span><div class="db-up"><div class="pv">' + ph + '</div><div class="col"><input type="text" id="' + id + '"' + ro + ' value="' + val + '" placeholder="' + (img ? 'Photo link (filled after upload)' : 'File or page link (filled after upload)') + '">' +
        '<div class="row"><input type="file"' + (img ? ' accept="image/*"' : '') + '><button type="button" class="db-btn db-btn-ghost db-btn-sm" data-dtclear>Remove</button></div><div class="st"></div></div></div></div>';
    }
    return '<label class="db-field dt-f' + (f.multi ? ' full' : '') + '"><span>' + esc(f.label) + '</span>' + (f.multi ? '<textarea rows="3" id="' + id + '"' + ro + '>' + val + '</textarea>' : '<input type="text" id="' + id + '"' + ro + ' value="' + val + '">') + '</label>';
  }
  function itemTitle(fields) { var f = fields.filter(function (x) { return x.type === 'text' && x.orig; })[0]; return f ? f.orig : ''; }
  function itemHtml(l, it) {
    return '<details class="dt-item" data-id="' + esc(it.id) + '"' + (it.isNew ? ' data-new="1"' : '') + '><summary><b>' + esc(itemTitle(it.fields) || (l.acc ? 'New dropdown' : 'New item')) + '</b><span class="dt-badge">' + (it.isNew ? 'added' : '') + '</span><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-rm" data-dt-rm>Remove</button><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-undo" data-dt-undo hidden>Restore</button></summary>' +
      '<div class="dt-fields">' + it.fields.map(fieldHtml).join('') + '</div></details>';
  }
  function listHtml(l) {
    return '<div class="dt-list" data-rep="' + esc(l.rep) + '"><h4>' + (l.acc ? 'Dropdowns' : 'Bullets / items') + '</h4><div class="dt-items">' + l.items.map(function (it) { return itemHtml(l, it); }).join('') + '</div>' +
      '<button type="button" class="db-btn db-btn-ghost db-btn-sm" data-dt-add="' + esc(l.rep) + '">＋ Add ' + (l.acc ? 'dropdown' : 'item') + '</button></div>';
  }
  // groups that live inside a JSON (new groups of a page file, groups of an automatic page): title, text, photo, items (title, text, photo)
  function xItem(it) {
    return '<details class="dt-item" data-xi><summary><b>' + esc(it.name || 'New item') + '</b><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-rm" data-dt-xrm>Remove</button></summary><div class="dt-fields">' +
      fieldHtml({ key: 'name', type: 'text', label: 'Item title', orig: it.name }) + fieldHtml({ key: 'text', type: 'text', label: 'Text', orig: it.text, multi: true }) + fieldHtml({ key: 'image', type: 'image', label: 'Photo', orig: it.image }) + '</div></details>';
  }
  function xGroup(g) {
    return '<details class="dt-group" data-x="' + esc(g.id || '') + '" open><summary><b>' + esc(g.name || 'New tab') + '</b><span class="dt-badge">tab</span><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-rm" data-dt-grm>Remove tab</button></summary><div class="dt-body">' +
      fieldHtml({ key: 'name', type: 'text', label: 'Tab title', orig: g.name }) + fieldHtml({ key: 'desc', type: 'text', label: 'Description', orig: g.desc, multi: true }) + fieldHtml({ key: 'image', type: 'image', label: 'Photo', orig: g.image }) +
      '<div class="dt-list"><h4>Dropdowns</h4><div class="dt-items">' + (g.items || []).map(xItem).join('') + '</div><button type="button" class="db-btn db-btn-ghost db-btn-sm" data-dt-xadd>＋ Add dropdown</button></div></div></details>';
  }
  function sGroup(g, i) {
    var gone = S.removedKeys.indexOf(g.key) >= 0;
    return '<details class="dt-group' + (gone ? ' dt-gone' : '') + '" data-gkey="' + esc(g.key) + '"' + (gone ? ' data-removed="1"' : '') + (i === 0 ? ' open' : '') + '><summary><b>' + esc(g.name || 'Tab ' + (i + 1)) + '</b><span class="dt-badge"></span><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-rm" data-dt-srm' + (gone ? ' hidden' : '') + '>Remove tab</button><button type="button" class="db-btn db-btn-ghost db-btn-sm dt-undo" data-dt-sundo' + (gone ? '' : ' hidden') + '>Restore tab</button></summary><div class="dt-body">' +
      '<div class="dt-fields">' + g.fields.map(fieldHtml).join('') + '</div>' + g.lists.map(listHtml).join('') + '</div></details>';
  }

  /* ---------------------------------------------------------------- open */
  function open(row) {
    var link = String(row.custom_link || '').trim(), isFile = /^products-[a-z0-9-]+\.html$/i.test(link), slug = isFile ? link.replace(/\.html$/i, '') : ('product-detail-' + row.slug).toLowerCase().replace(/[^a-z0-9\-_]/g, '-');
    S = { mode: isFile ? 'file' : 'tpl', slug: slug, row: row, saved: {}, groups: [], extra: [], removedKeys: [], initStruct: '' };
    D.toast('Loading the tabs of this page…');
    Promise.all([api('GET', '/api/v2/page-elements/' + encodeURIComponent(slug)).catch(function () { return []; }), isFile ? fetch(link, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('page not found'); return r.text(); }) : Promise.resolve('')])
      .then(function (res) {
        (res[0] || []).forEach(function (r) { S.saved[r.element_id] = r.content_value; });
        var struct = null; try { struct = JSON.parse(S.saved[isFile ? 'grp-struct' : 'tpl-groups'] || 'null'); } catch (e) { struct = null; }
        if (isFile) {
          S.groups = parsePage(res[1], S.saved);
          S.removedKeys = struct && Array.isArray(struct.removed) ? struct.removed.slice() : [];
          S.extra = struct && Array.isArray(struct.extra) ? struct.extra.map(function (g) { return { id: g.id || uid(), name: g.name || '', desc: g.desc || '', image: g.image || '', items: g.items || [] }; }) : [];
        } else S.extra = Array.isArray(struct) ? struct.map(function (g) { return { id: uid(), name: g.name || '', desc: g.desc || '', image: g.image || '', items: (g.items || []).map(function (i) { return { name: i.name || '', text: i.text || '', image: i.image || '' }; }) }; }) : [];
        draw();
      }).catch(function (e) { D.toast('Could not load the page: ' + e.message, true); });
  }
  function draw() {
    var o = document.getElementById('dtModal'); if (o) o.remove();
    o = document.createElement('div'); o.className = 'db-modal'; o.id = 'dtModal';
    var file = S.mode === 'file';
    o.innerHTML = '<div class="db-modal-box dt-box" role="dialog" aria-modal="true"><div class="db-modal-head"><h2>Tabs &amp; details: ' + esc(S.row.title) + '</h2><button class="db-x" type="button" data-dt-close aria-label="Close">×</button></div>' +
      '<div class="dt-main"><p class="dt-help">' + (file ? 'Every tab of the page "' + esc(S.slug) + '.html" with its title, text, photos, links / files and dropdowns. You can remove a tab, add new tabs, and add or remove dropdowns. The same data can be changed on the page itself in edit mode.' : 'The tabs (groups) of this product page with their dropdowns.') + '</p>' +
      '<div id="dtGroups">' + S.groups.map(sGroup).join('') + S.extra.map(xGroup).join('') + '</div><button type="button" class="db-btn db-btn-ghost" data-dt-gadd>＋ Add tab</button></div>' +
      '<div class="db-modal-foot"><span class="db-form-msg" id="dtMsg" role="alert"></span><button class="db-btn db-btn-ghost" type="button" data-dt-close>Cancel</button><button class="db-btn db-btn-red" type="button" id="dtSave">Save</button></div></div>';
    document.body.appendChild(o);
  }
  function close() { var o = document.getElementById('dtModal'); if (o) o.remove(); S = null; }

  /* ---------------------------------------------------------------- clicks */
  var listOf = function (el) { var rep = el.closest('[data-rep]'), key = rep && rep.getAttribute('data-rep'); for (var i = 0; S && i < S.groups.length; i++) for (var j = 0; j < S.groups[i].lists.length; j++) if (S.groups[i].lists[j].rep === key) return S.groups[i].lists[j]; return null; };
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var b = t.closest('[data-tabs-edit]'); if (b) { e.preventDefault(); if (D.row()) open(D.row()); return; }
    if (!S || !t.closest('#dtModal')) return;
    if (t.closest('[data-dt-close]')) { close(); return; }
    var x;
    if (t.closest('#dtSave')) { save(); return; }
    if ((x = t.closest('[data-dt-add]'))) {   // add a dropdown / item to a list of a tab of the page file
      var l = listOf(x); if (!l) return; var id = uid();
      var it = { id: id, isNew: true, fields: l.protoFields.map(function (f) { return { key: f.key + '~' + id, type: f.type, label: f.label, multi: f.multi, orig: f.type === 'text' ? (f.label === 'Title' || /title|text/i.test(f.label) ? 'New text' : '') : '' }; }) };
      l.items.push(it); var holder = x.parentNode.querySelector('.dt-items'); holder.insertAdjacentHTML('beforeend', itemHtml(l, it)); var d = holder.lastElementChild; d.open = true; return;
    }
    if ((x = t.closest('[data-dt-rm]'))) { e.preventDefault(); var d1 = x.closest('.dt-item'); d1.setAttribute('data-removed', '1'); d1.classList.add('dt-gone'); x.hidden = true; $('[data-dt-undo]', d1).hidden = false; return; }
    if ((x = t.closest('[data-dt-undo]'))) { e.preventDefault(); var d2 = x.closest('.dt-item'); d2.removeAttribute('data-removed'); d2.classList.remove('dt-gone'); x.hidden = true; $('[data-dt-rm]', d2).hidden = false; return; }
    if ((x = t.closest('[data-dt-srm]'))) { e.preventDefault(); var g1 = x.closest('.dt-group'); g1.setAttribute('data-removed', '1'); g1.classList.add('dt-gone'); x.hidden = true; $('[data-dt-sundo]', g1).hidden = false; return; }
    if ((x = t.closest('[data-dt-sundo]'))) { e.preventDefault(); var g2 = x.closest('.dt-group'); g2.removeAttribute('data-removed'); g2.classList.remove('dt-gone'); x.hidden = true; $('[data-dt-srm]', g2).hidden = false; return; }
    if (t.closest('[data-dt-gadd]')) { var ng = { id: uid(), name: 'New tab', desc: '', image: '', items: [{ name: 'New dropdown', text: '', image: '' }] }; S.extra.push(ng); $('#dtGroups').insertAdjacentHTML('beforeend', xGroup(ng)); $('#dtGroups').lastElementChild.scrollIntoView({ block: 'center' }); return; }
    if ((x = t.closest('[data-dt-grm]'))) { e.preventDefault(); var g3 = x.closest('.dt-group'); g3.parentNode.removeChild(g3); return; }
    if ((x = t.closest('[data-dt-xadd]'))) { var h = x.parentNode.querySelector('.dt-items'); h.insertAdjacentHTML('beforeend', xItem({ name: 'New dropdown', text: '', image: '' })); h.lastElementChild.open = true; return; }
    if ((x = t.closest('[data-dt-xrm]'))) { e.preventDefault(); var d3 = x.closest('.dt-item'); d3.parentNode.removeChild(d3); return; }
    if ((x = t.closest('[data-dtclear]'))) { var box = x.closest('[data-dtup]'); $('input[type=text]', box).value = ''; $('.pv', box).innerHTML = '<div class="ph">' + (box.getAttribute('data-kind') === 'image' ? 'no photo yet' : 'no file yet') + '</div>'; }
  });
  document.addEventListener('change', function (e) {
    var inp = e.target; if (!S || !inp.matches || !inp.matches('#dtModal input[type=file]')) return;
    var box = inp.closest('[data-dtup]'), st = $('.st', box), file = inp.files && inp.files[0]; if (!file) return;
    box.setAttribute('data-busy', '1'); st.textContent = 'Uploading ' + file.name + '…';
    D.upload(file, box.getAttribute('data-kind') === 'image' ? 'solutions' : 'resources').then(function (url) {
      $('input[type=text]', box).value = url; st.textContent = 'Uploaded.';
      $('.pv', box).innerHTML = box.getAttribute('data-kind') === 'image' ? '<img src="' + esc(url) + '" alt="">' : '<div class="ph">file attached</div>';
    }).catch(function (err) { st.textContent = 'Upload failed: ' + err.message; }).then(function () { box.removeAttribute('data-busy'); inp.value = ''; });
  });

  /* ---------------------------------------------------------------- save */
  function post(id, type, value) { return api('POST', '/api/v2/page-elements', { page_slug: S.slug, element_id: id, content_type: type, content_value: value }); }
  function readX(g) {
    var o = { id: g.getAttribute('data-x') || uid() };
    ['name', 'desc', 'image'].forEach(function (k) { var el = $('.dt-body > .dt-f [data-k="' + k + '"]', g); o[k] = el ? el.value.trim() : ''; });
    o.items = $$('.dt-item', g).map(function (d) { var r = {}; ['name', 'text', 'image'].forEach(function (k) { var el = $('[data-k="' + k + '"]', d); r[k] = el ? el.value.trim() : ''; }); return r; });
    return o;
  }
  function save() {
    var msg = $('#dtMsg'); msg.textContent = '';
    if ($$('#dtModal [data-busy]').length) { msg.textContent = 'Wait for the upload to finish.'; return; }
    var jobs = [], file = S.mode === 'file';
    if (file) {
      // 1) changed fields of the groups and of their items (also of the removed ones: nothing to lose)
      $$('#dtGroups > .dt-group[data-gkey] [data-k]').forEach(function (el) {
        var v = el.value, o = el.getAttribute('data-o'), type = el.getAttribute('data-t'), k = el.getAttribute('data-k'), item = el.closest('.dt-item');
        if (item && item.getAttribute('data-new') && item.getAttribute('data-removed')) return;
        if (item && item.getAttribute('data-new')) {   // a new item is a copy of the first one: every field is written, so nothing of the original shows through
          if (type === 'image') jobs.push([k, 'image', v.trim() || '__none__']); else if (type === 'link') jobs.push([k, 'text', v.trim() || '#']); else jobs.push([k, 'text', v.trim() ? fromPlain(v) : ' ']);
          return;
        }
        if (v === o) return;
        if (type === 'image') jobs.push([k, 'image', v.trim() || '__none__']);
        else if (type === 'link') { if (v.trim() || o) jobs.push([k, 'text', v.trim() || '#']); }
        else jobs.push([k, 'text', fromPlain(v)]);
      });
      // 2) the structure of the lists
      S.groups.forEach(function (g) {
        var gEl = $('#dtGroups > .dt-group[data-gkey="' + (window.CSS && CSS.escape ? CSS.escape(g.key) : g.key) + '"]'); if (!gEl) return;
        g.lists.forEach(function (l) {
          var lEl = $$('.dt-list', gEl).filter(function (x) { return x.getAttribute('data-rep') === l.rep; })[0]; if (!lEl) return;
          var order = [], news = {};
          $$('.dt-item', lEl).forEach(function (d) { if (d.getAttribute('data-removed')) return; var id = d.getAttribute('data-id'); order.push(id); if (d.getAttribute('data-new')) news[id] = l.initNews[id] || (l.ids[0] || 'dd'); });
          var changed = JSON.stringify(order) !== JSON.stringify(l.initOrder) || S.saved[l.rep] !== undefined && JSON.stringify(news) !== JSON.stringify(l.initNews);
          if (changed) jobs.push([l.rep, 'text', JSON.stringify({ order: order, news: news })]);
        });
        // a removed tab
      });
      var removed = $$('#dtGroups > .dt-group[data-gkey][data-removed]').map(function (g) { return g.getAttribute('data-gkey'); });
      var extra = $$('#dtGroups > .dt-group[data-x]').map(readX);
      var nu = JSON.stringify({ removed: removed, extra: extra }), old = JSON.stringify({ removed: S.removedKeys, extra: S.extra });
      if (nu !== old) jobs.push(['grp-struct', 'text', nu]);
    } else {
      var groups = $$('#dtGroups > .dt-group[data-x]').map(readX).map(function (g) { return { name: g.name, desc: g.desc, image: g.image, items: g.items }; });
      jobs.push(['tpl-groups', 'text', JSON.stringify(groups)]);
    }
    if (!jobs.length) { msg.textContent = 'Nothing was changed.'; return; }
    var btn = $('#dtSave'); btn.disabled = true; btn.textContent = 'Saving…'; D.pending(false);
    var n = 0, failed = [];
    jobs.reduce(function (p, j) { return p.then(function () { return post(j[0], j[1], j[2]).then(function () { n++; }).catch(function (err) { failed.push(j[0] + ': ' + err.message); }); }); }, Promise.resolve()).then(function () {
      btn.disabled = false; btn.textContent = 'Save';
      if (failed.length) { msg.textContent = 'Saved ' + n + ', but ' + failed.length + ' failed: ' + failed[0]; return; }
      var sub = D.pending(); if (!sub) D.logHistory(S.slug, 'Tabs & details', 'Updated');
      D.notify(); D.toast(sub ? 'Submitted for admin approval. It goes live once an admin approves it.' : 'Saved. The change is live.'); close();
    });
  }
  window.PCDTabs = { open: open };
})();
