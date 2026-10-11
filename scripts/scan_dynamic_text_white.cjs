/* Findet text-white in String-Zweigen dynamischer classNames (Template-Literal-
   Interpolationen), die der statische Analyzer nicht sieht. */
const fs = require('fs');
const parser = require('@babel/parser');
const path = require('path');

const WHITE = /(?<![:\w-])text-white\b/;
const HOVER_WHITE = /hover:text-white\b/;
const COLORED_BG = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)/;
const HOVER_COLORED = /hover:bg-(primary|red|green|blue|destructive)/;

function walkDir(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'ui' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

// alle StringLiterals, die innerhalb eines className-Templates liegen
function classNameStrings(root) {
  const out = [];
  (function rec(node, inClassAttr) {
    if (!node || typeof node !== 'object') return;
    let next = inClassAttr;
    if (node.type === 'JSXAttribute' && node.name && node.name.name === 'className') {
      // alles innerhalb dieses Attributs
      (function rec2(n) {
        if (!n || typeof n !== 'object') return;
        if (n.type === 'StringLiteral' && (WHITE.test(n.value) || HOVER_WHITE.test(n.value))) out.push(n);
        for (const k of Object.keys(n)) {
          if (k === 'loc') continue;
          const v = n[k];
          if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && rec2(i));
          else if (v && typeof v === 'object') rec2(v);
        }
      })(node);
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && rec(i, next));
      else if (v && typeof v === 'object') rec(v, next);
    }
  })(root, false);
  return out;
}

for (const file of walkDir('src')) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { continue; }
  for (const node of classNameStrings(ast.program)) {
    const v = node.value;
    if (WHITE.test(v)) {
      if (COLORED_BG.test(v) && !HOVER_COLORED.test(v)) continue; // weiß auf farbigem Grund: ok
      console.log(`${file}:${node.loc.start.line} WEISS: "${v.slice(0, 120)}"`);
    } else if (HOVER_WHITE.test(v)) {
      if (HOVER_COLORED.test(v)) continue; // hover auf farbigem Grund: ok
      console.log(`${file}:${node.loc.start.line} HOVER: "${v.slice(0, 120)}"`);
    }
  }
}
