/* Codemod: ersetzt text-white -> text-foreground bzw. hover:text-white ->
   hover:text-foreground, aber NUR dort, wo die Schrift auf einem Theme-Hintergrund,
   Farb-Tint oder Seiten-Hintergrund sitzt (Hellmodus-Bug). Weiße Schrift auf
   farbigen Hintergründen bleibt unangetastet. Nutzt dieselbe Klassifikation wie
   classify_text_white.cjs und schreibt über node.start/end exakt. */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const WHITE = /(?<![:\w-])text-white\b/;
const HOVER_WHITE = /hover:text-white\b/;
const COLORED_BG = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)/;
const HOVER_COLORED = /hover:bg-(primary|red|green|blue|destructive)/;
const THEMED_BG = /\bbg-(card|secondary|background|popover|muted|transparent|sidebar-background|input|white)\b/;
const TINTED_BG = /\bbg-(primary|red|green|yellow|blue|orange)-[2-8]00\/(1[0-9]|2[0-9]|3[0-9])\b/;

function walkDir(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'ui' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

function staticPieces(el) {
  const attr = el.openingElement.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === 'className');
  if (!attr || !attr.value) return [];
  const v = attr.value;
  if (v.type === 'StringLiteral') return [v.value];
  if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral')
    return v.expression.quasis.map(q => q.value.cooked);
  return [];
}

function effBg(cls) {
  // nur Idle-Zustand zählt: hover:/focus:/disabled:-Varianten entfernen
  const idle = cls.replace(/\b[a-z]+:[\w[\]/.-]+/g, ' ').replace(/\s+/g, ' ');
  const solid = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)(-\d{3})?(?![/\w-])/;
  const tint = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)(-\d{3})?\//;
  if (solid.test(idle)) return 'farbig';
  if (tint.test(idle)) return 'tint';
  if (THEMED_BG.test(idle)) return 'theme';
  if (/bg-\[/.test(idle)) return 'bg-[]';
  return null;
}

const stats = { files: 0, standalone: 0, hover: 0 };

function fixString(value, node, edits, kind) {
  const after = value
    .replace(/(?<![:\w-])text-white\b/g, 'text-foreground')
    .replace(/hover:text-white\b/g, 'hover:text-foreground');
  if (after !== value) {
    edits.push({ node, value: after });
    stats[kind]++;
  }
}

function visit(el, parentStack, edits) {
  const pieces = staticPieces(el);
  const chainStatics = [pieces.join(' | ')];
  for (let i = parentStack.length - 1; i >= 0; i--)
    chainStatics.push(staticPieces(parentStack[i]).join(' | '));

  const attr = el.openingElement.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === 'className');

  // --- Zweig-Strings in dynamischen classNames ---
  if (attr && attr.value && attr.value.type === 'JSXExpressionContainer') {
    (function rec(n) {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'StringLiteral' && (WHITE.test(n.value) || HOVER_WHITE.test(n.value))) {
        const v = n.value;
        let verdict = effBg(v);
        if (!verdict) for (const cls of chainStatics) { verdict = effBg(cls); if (verdict) break; }
        const ok = verdict === 'farbig';
        if (!ok) {
          if (WHITE.test(v) && !HOVER_WHITE.test(v)) {
            if (!HOVER_COLORED.test(v)) fixString(v, n, edits, 'standalone');
          } else if (HOVER_WHITE.test(v)) {
            if (!HOVER_COLORED.test(v)) fixString(v, n, edits, 'hover');
          }
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && rec(i));
        else if (v && typeof v === 'object') rec(v);
      }
    })(attr.value);
  }

  // --- statisches className ---
  if (pieces.length === 1 && attr && attr.value && attr.value.type === 'StringLiteral') {
    const cls = pieces[0];
    if (WHITE.test(cls) && !HOVER_COLORED.test(cls) && !COLORED_BG.test(cls)) {
      let verdict = null;
      for (const c of chainStatics.slice(1)) { verdict = effBg(c); if (verdict) break; }
      if (verdict !== 'farbig') fixString(cls, attr.value, edits, 'standalone');
    }
    // hover:text-white im statischen Klassenstring ohne farbigen Hover-Hintergrund
    if (HOVER_WHITE.test(cls) && !WHITE.test(cls) && !HOVER_COLORED.test(cls) && !COLORED_BG.test(cls)) {
      fixString(cls, attr.value, edits, 'hover');
    }
  }

  const newStack = [...parentStack, el];
  for (const c of el.children || []) walkNode(c, newStack, edits);
}

function walkNode(node, stack, edits) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXElement') { visit(node, stack, edits); return; }
  for (const k of Object.keys(node)) {
    if (k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && walkNode(i, stack, edits));
    else if (v && typeof v === 'object') walkNode(v, stack, edits);
  }
}

for (const file of walkDir('src')) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { console.error('PARSE-FEHLER', file); continue; }
  const edits = [];
  walkNode(ast.program, [], edits);
  if (!edits.length) continue;
  edits.sort((a, b) => b.node.start - a.node.start);
  let out = src;
  for (const e of edits) {
    const q = out[e.node.start] === "'" ? "'" : '"';
    out = out.slice(0, e.node.start) + q + e.value + q + out.slice(e.node.end);
  }
  fs.writeFileSync(file, out);
  stats.files++;
  console.log(file, '->', edits.length, 'Knoten');
}
console.log('Dateien:', stats.files, '| standalone:', stats.standalone, '| hover:', stats.hover);
