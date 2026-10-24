/*
 * Page loader (shown from the first paint until the CMS data of the page is in) - used by tools/build-pages.js.
 * js/cms.js (page texts) and js/pc-content.js (lists) hold / release it through window.PCL; js/pc-cache.js keeps the data so that it only shows on the first visit.
 *   html.pc-loading   loader visible (page not scrollable)
 *   html.pc-cached    the page is drawn from the browser cache: no loader, the page is only kept invisible for a few ms until it is drawn
 * A page reload (F5, Ctrl+R) clears the cache first, so the page is loaded with fresh data (loader shown once). Never longer than 12 s; hidden without JavaScript.
 * Look: dark green with a faint blueprint grid and slow drifting glows, the logo on a card with a light sweep and blueprint corner marks, a thin progress line.
 */
const CSS = [
  '#pc-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;overflow:hidden;color:#fff;text-align:center;background:#0b1a0c;transition:opacity .55s ease,transform .55s ease,visibility .55s}',
  '#pc-loader.done{opacity:0;transform:scale(1.04);visibility:hidden;pointer-events:none}html.pc-loading{overflow:hidden}html.pc-cached #pc-loader{display:none}html.pc-cached{visibility:hidden}',
  /* background: blueprint grid + two slow glows */
  '#pc-loader .pcl-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(183,215,173,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(183,215,173,.07) 1px,transparent 1px);background-size:56px 56px;-webkit-mask:radial-gradient(ellipse at 50% 46%,#000 0%,transparent 72%);mask:radial-gradient(ellipse at 50% 46%,#000 0%,transparent 72%);animation:pcl-grid 6s linear infinite}',
  '#pc-loader .pcl-glow{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55}',
  '#pc-loader .pcl-glow.a{width:min(60vw,520px);height:min(60vw,520px);inset:0;margin:auto;background:#2f7a34;animation:pcl-drift-a 9s ease-in-out infinite}',
  '#pc-loader .pcl-glow.b{width:min(40vw,340px);height:min(40vw,340px);inset:0;margin:auto;background:#6fb36a;opacity:.3;animation:pcl-drift-b 11s ease-in-out infinite}',
  /* logo card */
  '#pc-loader .pcl-card{position:relative;width:min(300px,74vw);padding:34px 28px;border-radius:22px;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.5);overflow:hidden;animation:pcl-in .9s cubic-bezier(.2,.8,.2,1) both,pcl-float 4.5s 1s ease-in-out infinite}',
  '#pc-loader .pcl-card img{display:block;width:100%;max-width:210px;height:auto;margin:0 auto}',
  '#pc-loader .pcl-card:after{content:"";position:absolute;top:0;bottom:0;left:0;width:55%;background:linear-gradient(105deg,transparent 0%,rgba(255,255,255,.85) 50%,transparent 100%);transform:translateX(-130%) skewX(-12deg);animation:pcl-sweep 2.4s .6s ease-in-out infinite}',
  '#pc-loader .pcl-wrap{position:relative}',
  '#pc-loader .pcl-c{position:absolute;width:22px;height:22px;border:2px solid #86ba78;opacity:.9;animation:pcl-mark 2.4s ease-in-out infinite}',
  '#pc-loader .pcl-c.tl{left:-14px;top:-14px;border-right:0;border-bottom:0}#pc-loader .pcl-c.tr{right:-14px;top:-14px;border-left:0;border-bottom:0}',
  '#pc-loader .pcl-c.bl{left:-14px;bottom:-14px;border-right:0;border-top:0}#pc-loader .pcl-c.br{right:-14px;bottom:-14px;border-left:0;border-top:0}',
  /* progress line + tagline */
  '#pc-loader .pcl-line{position:relative;width:min(240px,62vw);height:2px;border-radius:2px;background:rgba(255,255,255,.16);overflow:hidden;animation:pcl-up .8s .35s both cubic-bezier(.2,.8,.2,1)}',
  '#pc-loader .pcl-line:after{content:"";position:absolute;top:0;bottom:0;width:38%;border-radius:2px;background:linear-gradient(90deg,transparent,#b7d7ad 40%,#fff);animation:pcl-slide 1.1s ease-in-out infinite}',
  '#pc-loader .pcl-tag{margin-top:-12px;font:600 clamp(11px,2.5vw,13px)/1.2 Archivo,Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:rgba(255,255,255,.7);animation:pcl-up .8s .5s both cubic-bezier(.2,.8,.2,1)}',
  '@keyframes pcl-slide{0%{left:-40%}100%{left:104%}}@keyframes pcl-sweep{0%{transform:translateX(-130%) skewX(-12deg)}55%,100%{transform:translateX(330%) skewX(-12deg)}}',
  '@keyframes pcl-mark{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(.8);opacity:.45}}@keyframes pcl-grid{to{background-position:56px 56px}}',
  '@keyframes pcl-drift-a{0%,100%{transform:translate(0,0)}50%{transform:translate(-7vmin,-4vmin)}}@keyframes pcl-drift-b{0%,100%{transform:translate(0,0)}50%{transform:translate(6vmin,5vmin)}}',
  '@keyframes pcl-in{from{opacity:0;transform:translateY(24px) scale(.94)}to{opacity:1;transform:none}}@keyframes pcl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}',
  '@keyframes pcl-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
  '@media (prefers-reduced-motion:reduce){#pc-loader *{animation:none!important}#pc-loader .pcl-card:after{display:none}#pc-loader .pcl-line:after{left:0;width:100%}}'
].join('');

const LOADER_HEAD = '<style>' + CSS + '</style>\n' +
  '<noscript><style>#pc-loader{display:none}html.pc-loading{overflow:auto}</style></noscript>\n' +
  '<script>(function(){var d=document,n=0,ready=false,hid=false,t0=Date.now(),c=false;d.documentElement.classList.add("pc-loading");' +
  'try{var nv=performance.getEntriesByType("navigation")[0];if(nv&&nv.type==="reload"){localStorage.removeItem("pc-cache-v1");localStorage.removeItem("pc-cache-t")}}catch(e){}try{var t=+localStorage.getItem("pc-cache-t");c=!!(t&&Date.now()-t<864e5)}catch(e){}if(c)d.documentElement.classList.add("pc-cached");' +
  'function hide(){if(hid)return;hid=true;var e=d.getElementById("pc-loader");d.documentElement.classList.remove("pc-loading");d.documentElement.classList.remove("pc-cached");if(e){e.classList.add("done");setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},600)}}' +
  'function check(){if(ready&&n<=0)setTimeout(function(){if(n<=0)hide()},Math.max(30,(PCL.cached?0:380)-(Date.now()-t0)))}' +
  'window.PCL={cached:c,cachedUsed:false,hold:function(){n++},release:function(){n=Math.max(0,n-1);check()},miss:function(){PCL.cached=false;d.documentElement.classList.remove("pc-cached")}};' +
  'd.addEventListener("DOMContentLoaded",function(){ready=true;check()});setTimeout(hide,c?2500:12000)})();</script>\n';
const LOADER_BODY = '<div id="pc-loader" role="status" aria-live="polite" aria-label="Loading"><span class="pcl-grid"></span><span class="pcl-glow a"></span><span class="pcl-glow b"></span>' +
  '<div class="pcl-wrap"><span class="pcl-c tl"></span><span class="pcl-c tr"></span><span class="pcl-c bl"></span><span class="pcl-c br"></span>' +
  '<div class="pcl-card"><img src="images/logo.webp" alt="Premier Concrete Products" width="210" height="67"></div></div>' +
  '<div class="pcl-line"></div><div class="pcl-tag">Concrete Products Since 1996</div></div>\n';

module.exports = { LOADER_HEAD, LOADER_BODY };
