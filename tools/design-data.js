/*
 * design-data: runs the design's own logic (_original/index.original.html, an "x-dc" component) in Node and hands out its content:
 * the categories (products), project highlights and resources, exactly as the design has them. Used by tools/seed-content.js.
 * (tools/build-pages.js has its own copy of this loader because it also renders the template.)
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '_original', 'index.original.html'), 'utf8');
const script = SRC.slice(SRC.indexOf('>', SRC.indexOf('data-dc-script')) + 1, SRC.lastIndexOf('</script>'));
class DCLogic { }
const React = { createRef: () => ({}), createElement: (t, p) => '<' + t + ' class="' + p.className + '">' + p.dangerouslySetInnerHTML.__html + '</' + t + '>' };
const M = new Function('DCLogic', 'React', 'window', 'requestAnimationFrame', 'setInterval', 'clearInterval', 'clearTimeout', 'setTimeout',
  script + '\nreturn { Component, CATS, PROJECTS };')(DCLogic, React, { scrollTo() { } }, f => f(), () => 0, () => { }, () => { }, () => 0);

const slugify = s => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const webp = s => String(s || '').replace(/^assets\/([\w-]+\/[\w.-]+?)\.(?:jpe?g|png)\b/, '/images/$1.webp');
const REMOTE = fs.existsSync(path.join(__dirname, 'remote-images.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'remote-images.json'), 'utf8')) : {};
const localImg = s => {   // design image -> local file of the site (/images/...)
  s = String(s || ''); if (!s) return '';
  for (const u of Object.keys(REMOTE).sort((a, b) => b.length - a.length)) if (s === u || s.startsWith(u)) return '/' + REMOTE[u];
  return webp(s);
};

function vals(view, patch) {
  const inst = new M.Component();
  inst.props = { grayscalePhotos: false, quoteTray: false };
  inst.state = Object.assign({}, inst.state, { view }, patch || {});
  return inst.renderVals();
}

// products = the categories of the design
function products() {
  const tiles = vals('home').catTiles;
  return M.CATS.map((c, i) => ({
    key: c.id, title: c.name, slug: slugify(c.name), file: 'products-' + c.id + '.html', order: i,
    text: tiles[i].d || '', image: localImg(c.img),
    groups: c.groups.map(g => g.name || '').filter(Boolean),
  }));
}

function projects() {
  const prods = products();
  return M.PROJECTS.map((p, i) => ({
    key: p.id, title: p.t, slug: slugify(p.t), tag: p.tag, product: (prods.find(x => x.key === p.cat) || {}).slug || '', cat: p.cat,
    location: p.loc, year: p.years, owner: p.owner, products: p.products, excerpt: p.ex, challenge: p.ch, solution: p.so, images: p.imgs.map(localImg), order: i,
  }));
}

// resources of the six tabs; "product" = the categories an item belongs to (found by asking the design with every category filter), none = general (always shown)
const TABS = { downloads: 'Brochure', sheets: 'Data Sheet', webinars: 'Webinar', videos: 'Video', blog: 'Blog Post', notes: 'Technical Note' };
function resources() {
  const prods = products(), out = [];
  for (const [tab, type] of Object.entries(TABS)) {
    const all = vals('resources', { resTab: tab });
    const items = (all.resDocs || []).concat(all.resVideos || []);
    const generalOnly = new Set(((v) => (v.resDocs || []).concat(v.resVideos || []).map(x => x.t))(vals('resources', { resTab: tab, resCats: ['__none__'] })));
    const catsOf = {};
    M.CATS.forEach((c, ci) => {
      const v = vals('resources', { resTab: tab, resCats: [c.name] });
      (v.resDocs || []).concat(v.resVideos || []).forEach(x => { if (!generalOnly.has(x.t)) (catsOf[x.t] = catsOf[x.t] || []).push(prods[ci].slug); });
    });
    items.forEach((x, i) => {
      const rec = out.length;
      // the design's own "Concrete Pipe / Pipeline ..." label stays as the short text of the card
      out.push({ title: x.t, type: x.type === 'DOCX' && tab === 'downloads' ? 'Form' : type, tab, label: x.cat, file: x.href && x.href !== '#' ? x.href : '', image: localImg(x.img), products: catsOf[x.t] || [], order: rec });
    });
  }
  return out;
}

module.exports = { products, projects, resources, slugify };
if (require.main === module) { console.log(JSON.stringify({ products: products().map(p => [p.title, p.slug, p.file, p.image, p.text.slice(0, 40)]), projects: projects().map(p => [p.title, p.slug, p.product]), resources: resources().map(r => [r.type, r.title, r.products.join(','), r.label]) }, null, 1)); }
