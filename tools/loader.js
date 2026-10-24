/*
 * Page loader (shown from the first paint until the CMS data of the page is in) - used by tools/build-pages.js.
 * js/cms.js (page texts) and js/pc-content.js (lists) hold / release it through window.PCL; js/pc-cache.js keeps the data so that it only shows on the first visit.
 *   html.pc-loading   loader visible (page not scrollable)
 *   html.pc-cached    the page is drawn from the browser cache: no loader, the page is only kept invisible for a few ms until it is drawn
 * A page reload (F5, Ctrl+R) clears the cache first, so the page is loaded with fresh data (loader shown once). Never longer than 12 s; hidden without JavaScript.
 */
const LOADER_HEAD = '<style>' +
  '#pc-loader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;overflow:hidden;color:#fff;text-align:center;' +
  'background:radial-gradient(ellipse at 50% 38%,#2c6128 0%,#214a1f 30%,#163217 66%,#0d1f0e 100%);transition:opacity .6s ease,transform .6s ease,visibility .6s}' +
  '#pc-loader.done{opacity:0;transform:scale(1.05);visibility:hidden;pointer-events:none}html.pc-loading{overflow:hidden}html.pc-cached #pc-loader{display:none}html.pc-cached{visibility:hidden}' +
  '#pc-loader:before{content:"";position:absolute;left:0;right:0;bottom:15%;height:6px;opacity:.35;background:repeating-linear-gradient(90deg,#b7d7ad 0 64px,transparent 64px 80px);animation:pcl-brick 1.1s linear infinite}' +
  '#pc-loader:after{content:"";position:absolute;left:0;right:0;bottom:calc(15% - 14px);height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent)}' +
  '#pc-loader .pcl-mark{position:relative;width:210px;height:210px;display:grid;place-items:center}' +
  '#pc-loader .pcl-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#86ba78,rgba(134,186,120,0) 38%,rgba(255,255,255,0) 52%,#fff 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:pcl-spin 1.25s linear infinite}' +
  '#pc-loader .pcl-glow{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,rgba(183,215,173,.3),rgba(183,215,173,0) 68%);animation:pcl-glow 2.2s ease-in-out infinite}' +
    '#pc-loader img{position:relative;display:block;width:150px;height:auto;filter:drop-shadow(0 4px 12px rgba(0,0,0,.4));animation:pcl-pop 2.2s ease-in-out infinite}' +
  '#pc-loader .pcl-tag{margin-top:-10px;font:600 clamp(12px,2.6vw,14px)/1.2 Archivo,Arial,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.75);animation:pcl-up .8s .25s both cubic-bezier(.2,.8,.2,1)}' +
  '#pc-loader .pcl-bar{width:min(230px,60vw);height:4px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;position:relative;animation:pcl-up .8s .4s both cubic-bezier(.2,.8,.2,1)}' +
  '#pc-loader .pcl-bar:after{content:"";position:absolute;top:0;bottom:0;width:44%;border-radius:4px;background:linear-gradient(90deg,transparent,#fff 45%,#86ba78);animation:pcl-slide 1.1s ease-in-out infinite}' +
  '@keyframes pcl-spin{to{transform:rotate(360deg)}}@keyframes pcl-slide{0%{left:-48%}100%{left:104%}}@keyframes pcl-brick{to{background-position:80px 0}}' +
  '@keyframes pcl-pop{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}@keyframes pcl-glow{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}@keyframes pcl-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
  '@media (prefers-reduced-motion:reduce){#pc-loader *,#pc-loader:before{animation:none!important}#pc-loader .pcl-bar:after{left:0;width:100%}}' +
  '</style>\n' +
  '<noscript><style>#pc-loader{display:none}html.pc-loading{overflow:auto}</style></noscript>\n' +
  '<script>(function(){var d=document,n=0,ready=false,hid=false,t0=Date.now(),c=false;d.documentElement.classList.add("pc-loading");' +
  'try{var nv=performance.getEntriesByType("navigation")[0];if(nv&&nv.type==="reload"){localStorage.removeItem("pc-cache-v1");localStorage.removeItem("pc-cache-t")}}catch(e){}try{var t=+localStorage.getItem("pc-cache-t");c=!!(t&&Date.now()-t<864e5&&!localStorage.getItem("pc-admin"))}catch(e){}if(c)d.documentElement.classList.add("pc-cached");' +
  'function hide(){if(hid)return;hid=true;var e=d.getElementById("pc-loader");d.documentElement.classList.remove("pc-loading");d.documentElement.classList.remove("pc-cached");if(e){e.classList.add("done");setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},600)}}' +
  'function check(){if(ready&&n<=0)setTimeout(function(){if(n<=0)hide()},Math.max(30,(PCL.cached?0:380)-(Date.now()-t0)))}' +
  'window.PCL={cached:c,cachedUsed:false,hold:function(){n++},release:function(){n=Math.max(0,n-1);check()},miss:function(){PCL.cached=false;d.documentElement.classList.remove("pc-cached")}};' +
  'd.addEventListener("DOMContentLoaded",function(){ready=true;check()});setTimeout(hide,c?2500:12000)})();</script>\n';
const LOADER_BODY = '<div id="pc-loader" role="status" aria-live="polite" aria-label="Loading"><div class="pcl-mark"><span class="pcl-glow"></span><span class="pcl-ring"></span><img src="images/logo-white.webp" alt="Premier Concrete Products" width="150" height="48"></div>' +
  '<div class="pcl-tag">Concrete Products Since 1996</div><div class="pcl-bar"></div></div>\n';

module.exports = { LOADER_HEAD, LOADER_BODY };
