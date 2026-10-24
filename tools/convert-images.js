#!/usr/bin/env node
/*
 * convert-images: design images -> local WebP files under images/, each under 100 KB (same rule as the CMS upload:
 * WebP, max 1920 px wide, quality 80 down to 50, then a smaller picture until it fits). Transparency is kept.
 *
 *   node tools/convert-images.js            local files of the design (Premier Concrete Template (7)/standalone-export/images)
 *                                           + the logo, and the images the design loads from other sites (-> images/ext/)
 *
 * The remote images are listed in tools/remote-images.json (url -> local file); tools/build-pages.js uses that list.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
// the ORIGINAL pictures live outside the project folder (so they are never deployed or committed): D:/projects/Premier Concrete_images_backup/{design-images,client}
const BACKUP = process.env.PC_IMAGES_BACKUP || path.join(ROOT, '..', 'Premier Concrete_images_backup');
const SRC_DIR = path.join(BACKUP, 'design-images');
const OUT = path.join(ROOT, 'images');
const MAP_FILE = path.join(__dirname, 'remote-images.json');
const LIMIT = 100 * 1024;

async function toWebp(input, outFile) {
  let width = 1920;
  const meta = await sharp(input).metadata();
  if (meta.width && meta.width < width) width = meta.width;
  for (;;) {
    for (let q = 80; q >= 50; q -= 10) {
      const buf = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: q, effort: 5 }).toBuffer();
      if (buf.length <= LIMIT || (width <= 320 && q === 50)) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, buf); return { bytes: buf.length, width, q }; }
    }
    width = Math.round(width * 0.85);
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

async function main() {
  const only = process.argv[2];
  let n = 0, big = 0;
  if (!only || only === 'local') {
    for (const f of walk(SRC_DIR)) {
      if (!/\.(jpe?g|png)$/i.test(f)) continue;
      const rel = path.relative(SRC_DIR, f).replace(/\\/g, '/').replace(/\.(jpe?g|png)$/i, '.webp');
      const out = path.join(OUT, rel);
      if (fs.existsSync(out)) continue;
      const r = await toWebp(f, out); n++; if (r.bytes > LIMIT) big++;
      console.log(rel, Math.round(r.bytes / 1024) + ' KB', r.width + 'px');
    }
    // logos given by the client (project root)
    for (const [src, dst] of [['premiere-concrete-logo-green-gray-retina.png', 'logo.webp'], ['logo.png', 'logo-mark.webp']]) {
      const f = path.join(BACKUP, 'client', src); const out = path.join(OUT, dst);
      if (fs.existsSync(f) && !fs.existsSync(out)) { await sharp(f).webp({ quality: 90, effort: 5 }).toFile(out); console.log(dst); n++; }
    }
  }
  if (!only || only === 'client') {
    // pictures the client sent (project root + "1 vish _PCP"): converted copies go to images/client/, the originals stay where they are
    const skip = /node_modules|[\\/]images[\\/]|Template|[\\/]\.git[\\/]|__MACOSX/;
    const files = [];
    (function scan(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (skip.test(p + path.sep)) continue; if (e.isDirectory()) scan(p); else if (/\.(jpe?g|png)$/i.test(e.name) && !/^(logo|premiere-concrete-logo)/i.test(e.name)) files.push(p); } })(path.join(BACKUP, 'client'));
    for (const f of files) {
      const name = path.basename(f).replace(/\.(jpe?g|png)$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const out = path.join(OUT, 'client', name + '.webp');
      if (fs.existsSync(out)) continue;
      const r = await toWebp(f, out); n++; if (r.bytes > LIMIT) big++;
      console.log('client/' + name + '.webp', Math.round(r.bytes / 1024) + ' KB', r.width + 'px');
    }
  }
  if (!only || only === 'remote') {
    // the design file + the pages built from it (some image addresses are put together in the design script)
    const html = fs.readFileSync(path.join(ROOT, '_original', 'index.original.html'), 'utf8') + fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).map(f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/&amp;/g, '&')).join('\n');
    const urls = [...new Set(html.match(/https:\/\/static\.wixstatic\.com\/[^\s"'()\\<>]+|https:\/\/images\.unsplash\.com\/[^\s"'()\\<>]+|https?:\/\/[^\s"'()\\<>]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'()\\<>]*)?/g) || [])];
    const map = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
    for (const u of urls) {
      if (map[u] && fs.existsSync(path.join(ROOT, map[u]))) continue;
      const name = new URL(u).pathname.split('/').pop().replace(/\.(jpe?g|png|webp)$/i, '').replace(/[^\w-]+/g, '-').slice(0, 40) + '-' + crypto.createHash('md5').update(u).digest('hex').slice(0, 6);
      try {
        const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) { console.log('SKIP', res.status, u); continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const rel = 'images/ext/' + name + '.webp';
        const r = await toWebp(buf, path.join(ROOT, rel));
        map[u] = rel; n++; console.log(rel, Math.round(r.bytes / 1024) + ' KB');
      } catch (e) { console.log('FAIL', u, e.message); }
    }
    fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 1));
  }
  console.log('done: ' + n + ' converted' + (big ? ', ' + big + ' still over 100 KB' : ''));
}
main();
