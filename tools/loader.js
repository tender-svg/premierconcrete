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
    '#pc-loader img{position:relative;grid-area:1/1;display:block;width:150px;height:auto;filter:none;animation:pcl-pop 2.2s ease-in-out infinite}' +
  '#pc-loader img.pcl-base{filter:grayscale(1);opacity:.22}#pc-loader img.pcl-fill{animation:pcl-pour 1.5s cubic-bezier(.4,.1,.3,1) infinite}' +
  '#pc-loader .pcl-tag{margin-top:-10px;font:600 clamp(12px,2.6vw,14px)/1.2 Archivo,Arial,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.78);animation:pcl-up .8s .25s both cubic-bezier(.2,.8,.2,1)}' +
  '@keyframes pcl-spin{to{transform:rotate(360deg)}}@keyframes pcl-drop{0%{opacity:0;transform:translateY(-46px) rotate(-6deg)}9%{opacity:1;transform:translateY(3px)}13%{transform:translateY(0)}84%{opacity:1;transform:none}96%,100%{opacity:0;transform:translateY(6px)}}' +
  '@keyframes pcl-pour{0%{clip-path:polygon(0 108%,25% 104%,50% 108%,75% 104%,100% 108%,100% 140%,0 140%);opacity:1}20%{clip-path:polygon(0 76%,25% 84%,50% 76%,75% 84%,100% 76%,100% 140%,0 140%)}42%{clip-path:polygon(0 56%,25% 46%,50% 56%,75% 46%,100% 56%,100% 140%,0 140%)}64%{clip-path:polygon(0 30%,25% 40%,50% 30%,75% 40%,100% 30%,100% 140%,0 140%)}82%{clip-path:polygon(0 -4%,25% 4%,50% -4%,75% 4%,100% -4%,100% 140%,0 140%);opacity:1}88%{clip-path:polygon(0 -20%,25% -20%,50% -20%,75% -20%,100% -20%,100% 140%,0 140%);opacity:1}96%,100%{clip-path:polygon(0 -20%,25% -20%,50% -20%,75% -20%,100% -20%,100% 140%,0 140%);opacity:0}}@keyframes pcl-pop{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}@keyframes pcl-glow{0%,100%{opacity:.55;transform:scale(.94)}50%{opacity:1;transform:scale(1.06)}}@keyframes pcl-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}' +
  '@media (prefers-reduced-motion:reduce){#pc-loader *,#pc-loader .pcl-bar:after{left:0;width:100%}}' +
  '</style>\n' +
  '<noscript><style>#pc-loader{display:none}html.pc-loading{overflow:auto}</style></noscript>\n' +
  '<script>(function(){var d=document,n=0,ready=false,hid=false,t0=Date.now(),c=false;d.documentElement.classList.add("pc-loading");' +
  'try{var nv=performance.getEntriesByType("navigation")[0];if(nv&&nv.type==="reload"){localStorage.removeItem("pc-cache-v1");localStorage.removeItem("pc-cache-t")}}catch(e){}try{var t=+localStorage.getItem("pc-cache-t");c=!!(t&&Date.now()-t<864e5&&!localStorage.getItem("pc-admin"))}catch(e){}if(c)d.documentElement.classList.add("pc-cached");' +
  'function hide(){if(hid)return;hid=true;var e=d.getElementById("pc-loader");d.documentElement.classList.remove("pc-loading");d.documentElement.classList.remove("pc-cached");if(e){e.classList.add("done");setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e)},600)}}' +
  'function check(){if(ready&&n<=0)setTimeout(function(){if(n<=0)hide()},Math.max(30,(PCL.cached?0:380)-(Date.now()-t0)))}' +
  'window.PCL={cached:c,cachedUsed:false,hold:function(){n++},release:function(){n=Math.max(0,n-1);check()},miss:function(){PCL.cached=false;d.documentElement.classList.remove("pc-cached")}};' +
  'd.addEventListener("DOMContentLoaded",function(){ready=true;check()});setTimeout(hide,c?2500:12000)})();</script>\n';
const LOADER_BODY = '<div id="pc-loader" role="status" aria-live="polite" aria-label="Loading"><div class="pcl-mark"><span class="pcl-glow"></span><span class="pcl-ring"></span><span class="pcl-disc"></span><img class="pcl-base" src="images/logo.webp" alt="" width="150" height="48"><img class="pcl-fill" src="images/logo.webp" alt="Premier Concrete Products" width="150" height="48"></div>' +
  '<div class="pcl-tag">Concrete Products Since 1996</div></div>\n';

module.exports = { LOADER_HEAD, LOADER_BODY };
