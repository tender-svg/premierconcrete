// screenshot helper:  node tools/shot.js <page> <width> <height> <out.png> [scrollY] [open-menu]
// the page is shown inside an iframe of exactly <width> px so phone widths are real (a headless window is never narrower than ~500 px). The dev server must run on :5181.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const [page, w, h, out, scrollY, openMenu] = process.argv.slice(2);
const html = `<!DOCTYPE html><html><body style="margin:0;background:#888"><iframe id="f" src="/${page}" style="border:0;width:${w}px;height:${h}px;display:block"></iframe>
<script>var f=document.getElementById('f');f.onload=function(){setTimeout(function(){var d=f.contentDocument;
${openMenu ? "var b=d.querySelector('.pc-burger');if(b)b.click();" : ''}
var y=${Number(scrollY) || 0};if(y){var go=function(){f.contentWindow.scrollTo(0,y)};go();setTimeout(go,300);setTimeout(go,900);}
},2200)};</script></body></html>`;
const tmp = path.join(ROOT, '__shot.html'); fs.writeFileSync(tmp, html);
spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-shot-' + Date.now(), '--hide-scrollbars', '--window-size=' + Math.max(Number(w), 520) + ',' + h, '--virtual-time-budget=9000', '--screenshot=' + out, 'http://127.0.0.1:5181/__shot.html'], { timeout: 120000 });
fs.unlinkSync(tmp);
console.log(fs.existsSync(out) ? 'saved ' + out : 'FAILED');
