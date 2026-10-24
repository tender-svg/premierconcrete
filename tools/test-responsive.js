// Horizontal-overflow check of the pages at phone / tablet widths in real Chrome (headless): every page is loaded in an iframe of exactly the width
// (a headless window is never narrower than ~500 px) and the elements that stick out on the right are listed.
//   node tools/test-responsive.js [width,width...] [page,page...]      (the dev server must run on :5181)
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const widths = (process.argv[2] || '320,375,414,768').split(',').map(Number);
const pages = (process.argv[3] || 'index,products,products-pipe,products-masonry,about,our-team,project-highlights,project-highlight-lakeside-box-culvert-replacement,resources,contact,lunch-learn,credit-application,login,dashboard,product-detail-pipe-culverts,solution-reference').split(',');
const tests = []; widths.forEach(w => pages.forEach(p => tests.push({ w, p })));
const html = `<!DOCTYPE html><html><body style="margin:0"><pre id="out"></pre><script>
var T=${JSON.stringify(tests)},out=document.getElementById('out'),res=[];
function run(i){
  if(i>=T.length){out.textContent='RESULT'+JSON.stringify(res)+'END';return;}
  var t=T[i],f=document.createElement('iframe');f.style.cssText='border:0;width:'+t.w+'px;height:900px;position:absolute;left:0;top:0';
  f.onload=function(){setTimeout(function(){
    try{var d=f.contentDocument,W=t.w,bad=[];
      [].forEach.call(d.querySelectorAll('body *'),function(e){var r=e.getBoundingClientRect();if(r.width&&r.right>W+1&&getComputedStyle(e).position!=='fixed'){var p=e.parentElement,clip=false;while(p&&p!==d.body){var o=getComputedStyle(p);if(/hidden|auto|scroll|clip/.test(o.overflowX)){clip=true;break}p=p.parentElement}
        if(!clip)bad.push((e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:''))+' '+Math.round(r.right)+' "'+(e.textContent||'').trim().slice(0,24)+'"')}});
      res.push({w:t.w,p:t.p,sw:d.documentElement.scrollWidth,bad:bad.slice(0,4),n:bad.length});
    }catch(e){res.push({w:t.w,p:t.p,err:String(e)})}
    f.remove();run(i+1)},1800)};
  f.src='/'+t.p+'.html';document.body.appendChild(f);
}
run(0);
</script></body></html>`;
const tmp = path.join(ROOT, '__resp.html'); fs.writeFileSync(tmp, html);
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--user-data-dir=' + os.tmpdir() + '/cdp-resp-' + Date.now(), '--window-size=1000,900', '--virtual-time-budget=' + (tests.length * 4000 + 5000), '--dump-dom', 'http://127.0.0.1:5181/__resp.html'], { timeout: 900000, maxBuffer: 50 * 1024 * 1024 });
fs.unlinkSync(tmp);
const m = /RESULT([\s\S]*?)END/.exec(String(r.stdout).replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
if (!m) { console.log('no result', String(r.stdout).slice(0, 300), String(r.stderr).slice(0, 300)); process.exit(1); }
const res = JSON.parse(m[1]); let bad = 0;
res.forEach(x => { const over = x.sw > x.w + 1; if (over || x.n) { bad++; console.log((x.w + 'px').padEnd(6) + x.p.padEnd(44) + 'scrollWidth ' + x.sw + (x.n ? '  sticking out (' + x.n + '): ' + x.bad.join(' | ') : '')); } });
console.log(bad ? bad + ' of ' + res.length + ' page / width combinations overflow' : 'no horizontal overflow in ' + res.length + ' page / width combinations');
