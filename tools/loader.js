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
  '#pc-loader .pcl-mark{position:relative;width:210px;height:210px;display:grid;place-items:center}' +
  '#pc-loader .pcl-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#86ba78,rgba(134,186,120,0) 38%,rgba(255,255,255,0) 52%,#fff 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:pcl-spin 1.25s linear infinite}' +
  '#pc-loader .pcl-disc{position:absolute;inset:12px;border-radius:50%;background:#fff;box-shadow:0 8px 26px rgba(0,0,0,.35)}' +
  '#pc-loader .pcl-glow{position:absolute;inset:-26px;border-radius:50%;background:radial-gradient(circle,rgba(183,215,173,.3),rgba(183,215,173,0) 68%);animation:pcl-glow 2.2s ease-in-out infinite}' +
    '#pc-loader img{position:relative;display:block;width:150px;height:auto;filter:none;animation:pcl-pop 2.2s ease-in-out infinite}' +
  '#pc-loader .pcl-tag{margin-top:-10px;font:600 clamp(12px,2.6vw,14px)/1.2 Archivo,Arial,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.78);animation:pcl-up .8s .25s both cubic-bezier(.2,.8,.2,1)}' +
  '#pc-loader .pcl-wall{display:flex;flex-direction:column-reverse;align-items:center;gap:4px;height:84px;justify-content:flex-start;animation:pcl-up .8s .4s both cubic-bezier(.2,.8,.2,1)}' +
  '#pc-loader .pcl-wall b{display:flex;gap:4px}' +
  '#pc-loader .pcl-wall i{display:block;width:clamp(36px,10vw,50px);height:24px;border-radius:2px;background:linear-gradient(180deg,#e4ebe1,#b9c6b5);box-shadow:inset 0 -3px 0 rgba(0,0,0,.14),0 2px 5px rgba(0,0,0,.3);opacity:0;animation:pcl-drop 3.8s calc(var(--n)*.17s) infinite cubic-bezier(.3,.7,.3,1)}' +
  '@keyframes pcl-spin{to{transform:rotate(360deg)}}@keyframes pcl-drop{0%{opacity:0;transform:translateY(-46px) rotate(-6deg)}9%{opacity:1;transform:translateY(3px)}13%{transform:translateY(0)}84%{opacity:1;transform:none}96%,100%{opacity:0;transform:translateY(6px)}}' +
  '@keyframes pcl-pop{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}@keyframes pcl-glow{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}@keyframes pcl-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
  '@media (prefers-reduced-motion:reduce){#pc-loader *,#pc-loader .pcl-bar:after{left:0;width:100%}}' +
  '</style>\n' +
  '<noscript><style>#pc-loader{display:none}html.pc-loading{overflow:auto}</style></noscript>\n' +
  '<script>(function(){var d=document,n=0,ready=false,hid=false,t0=Date.now(),c=false;d.documentElement.classList.add("pc-loading");' +
  'try{var nv=performance.getEntriesByType("navigation")[0];if(nv&&nv.type==="reload"){localStorage.removeItem("pc-cache-v1");localStorage.removeItem("pc-cache-t")}}catch(e){}try{var t=+localStorage.getItem("pc-cache-t");c=!!(t&&Date.now()-t<864e5&&!localStorage.getItem("pc-admin"))}catch(e){}if(c)d.documentElement.classList.add("pc-cached");' +
  'function hide(){if(hid)return;hid=true;var e=d.getElementById("pc-loader");d.documentElement.classList.remove("pc-loading");d.documentElement.classList.remove("pc-cached");if(e){e.classList.add("done");setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},600)}}' +
  'function check(){if(ready&&n<=0)setTimeout(function(){if(n<=0)hide()},Math.max(30,(PCL.cached?0:380)-(Date.now()-t0)))}' +
  'window.PCL={cached:c,cachedUsed:false,hold:function(){n++},release:function(){n=Math.max(0,n-1);check()},miss:function(){PCL.cached=false;d.documentElement.classList.remove("pc-cached")}};' +
  'd.addEventListener("DOMContentLoaded",function(){ready=true;check()});setTimeout(hide,c?2500:12000)})();</script>\n';
const LOADER_BODY = '<div id="pc-loader" role="status" aria-live="polite" aria-label="Loading"><div class="pcl-mark"><span class="pcl-glow"></span><span class="pcl-ring"></span><span class="pcl-disc"></span><img src="images/logo.webp" alt="Premier Concrete Products" width="150" height="48"></div>' +
  '<div class="pcl-tag">Concrete Products Since 1996</div><div class="pcl-wall"><b><i style="--n:0"></i><i style="--n:1"></i><i style="--n:2"></i><i style="--n:3"></i><i style="--n:4"></i><i style="--n:5"></i></b><b><i style="--n:6"></i><i style="--n:7"></i><i style="--n:8"></i><i style="--n:9"></i><i style="--n:10"></i></b><b><i style="--n:11"></i><i style="--n:12"></i><i style="--n:13"></i><i style="--n:14"></i></b></div></div>\n';

module.exports = { LOADER_HEAD, LOADER_BODY };
