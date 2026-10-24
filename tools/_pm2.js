const fs = require('fs');
let s = fs.readFileSync('js/pc-motion.js', 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.replace(a, () => b); };
rep("    [].forEach.call(scope.querySelectorAll('main img'), function (img) {\n      if (img.closest('.pcm-banner')) return;",
"    // the items of the lists the editor can add to / remove from (people of the team, core values, office cards, reasons, steps ...): each rises as one piece, one after another\n    [].forEach.call(scope.querySelectorAll('main [data-rep-item], main [data-rep-new]'), function (b) {\n      if (!/^(DIV|ARTICLE|SECTION)$/.test(b.tagName) || b.querySelector('[data-act]') || b.closest('.pcm-banner')) return;   // (not the accordion rows of the product pages)\n      add(b, 'pcm-block', Math.min(stagger(b), 440), late);\n    });\n    [].forEach.call(scope.querySelectorAll('main img'), function (img) {\n      if (img.closest('.pcm-banner')) return;\n      if (img.closest('[data-rep-item].pcm-block, [data-rep-new].pcm-block, [data-rep-item].pcm, [data-rep-new].pcm')) return;   // inside an animated list item");
fs.writeFileSync('js/pc-motion.js', s);
