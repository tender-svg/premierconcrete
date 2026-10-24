const fs = require('fs');
function patch(file, pairs) { let s = fs.readFileSync(file, 'utf8'); for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(file + ' missing: ' + a.slice(0, 70)); s = s.replace(a, () => b); } fs.writeFileSync(file, s); }
patch('js/pc-repeat.js', [["    e.preventDefault(); e.stopPropagation();\n    if (a) {", "    e.preventDefault(); e.stopImmediatePropagation();\n    if (a) {"]]);
patch('tools/build-pages.js', [["<script src=\"js/cms.js\" defer></script>\n", "<script src=\"js/cms.js\" defer></script>\n<script src=\"js/pc-repeat.js\" defer></script>\n"]]);
fs.appendFileSync('css/cms.css', `
/* ---- add / remove the items of a list, photo slots (js/pc-repeat.js) ---- */
body.cms-editing [data-rep]{outline:1px dashed rgba(63,125,58,.4);outline-offset:6px}
.pcr-edit>[data-rep-item],.pcr-edit>[data-rep-new]{position:relative}
.pcr-x{position:absolute;top:6px;right:6px;z-index:7;border:2px solid #fff;background:#a3200f;color:#fff;padding:5px 10px;cursor:pointer;font-family:'Archivo',sans-serif;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:11.5px;line-height:1.1;box-shadow:0 2px 8px rgba(0,0,0,.3);opacity:.92}
.pcr-x:hover{opacity:1;background:#7f160a}
.pcr-addhost{grid-column:1/-1;flex:0 0 100%;width:100%;display:block;padding:12px 0 4px}
li.pcr-addhost{list-style:none}
[data-slot-frame]{position:relative}
[data-slot-frame].pcr-has-img [data-slot-text]{display:none}
.cms-img-x{background:#a3200f!important}
.cms-img-x:hover{background:#7f160a!important}
`);
