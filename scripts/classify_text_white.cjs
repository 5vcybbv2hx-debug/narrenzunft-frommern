/* Klassifiziert text-white in ALLEN Klassen (auch dynamische Zweige in Templates):
   Für jedes Vorkommen wird der effektive Hintergrund ermittelt:
   eigener Zweig -> statische Template-Teile -> statische Eltern-Klassen.
   Nur Zweige mit weißer Schrift OHNE farbigen Hintergrund gelten als kaputt. */
const fs = require('fs');
const parser = require('@babel/parser');

const WHITE = /(?<![:\w-])text-white\b/;
const HOVER_WHITE = /hover:text-white\b/;
const COLORED_BG = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)/;
const HOVER_COLORED = /hover:bg-(primary|red|green|blue|destructive)/;
const THEMED_BG = /\bbg-(card|secondary|background|popover|muted|transparent|sidebar-background|input|white)\b/;
const TINTED_BG = /\bbg-(primary|red|green|yellow|blue|orange)-[2-8]00\/(1[0-9]|2[0-9]|3[0-9])\b/;

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

function walkDir(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'ui' || e.name === 'node_modules') continue;
    const p = path = require('path').join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

function staticPieces(el) {
  // alle statischen Textstücke des className-Attributs dieses Elements
  const attr = el.openingElement.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === 'className');
  if (!attr || !attr.value) return [];
  const v = attr.value;
  if (v.type === 'StringLiteral') return [v.value];
  if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral')
    return v.expression.quasis.map(q => q.value.cooked);
  return [];
}

function ancestorsOf(el, parents) { return parents.filter(p => p.type === 'JSXElement'); }

const broken = [], hover = [];

function visit(el, parentStack, file) {
  const pieces = staticPieces(el);
  const chainStatics = []; // von innen nach außen: eigene statics, dann Eltern
  chainStatics.push(pieces.join(' | '));
  for (let i = parentStack.length - 1; i >= 0; i--) {
    chainStatics.push(staticPieces(parentStack[i]).join(' | '));
  }

  // Zweig-Strings in dynamischen classNames sammeln
  const attr = el.openingElement.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === 'className');
  const branchStrings = [];
  if (attr && attr.value && attr.value.type === 'JSXExpressionContainer') {
    (function rec(n) {
      if (!n || typeof n !== 'object') return;
      if (n.type === 'StringLiteral' && (WHITE.test(n.value) || HOVER_WHITE.test(n.value)))
        branchStrings.push(n);
      for (const k of Object.keys(n)) {
        if (k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && rec(i));
        else if (v && typeof v === 'object') rec(v);
      }
    })(attr.value);
  }

  const line = el.openingElement.loc.start.line;
  for (const node of branchStrings) {
    const v = node.value;
    // 1. eigener Zweig, 2. eigene statics, 3. Eltern
    let verdict = effBg(v);
    if (!verdict) {
      for (const cls of chainStatics) { verdict = effBg(cls); if (verdict) break; }
    }
    const entry = `${file}:${node.loc.start.line}  "${v.slice(0, 90)}"  [el z.${line} -> ${verdict || 'kein bg'}]`;
    if (WHITE.test(v) && !HOVER_WHITE.test(v)) {
      if (verdict === 'farbig') continue; // weiß auf farbigem Grund: korrekt
      broken.push(entry);
    } else if (HOVER_WHITE.test(v)) {
      if (HOVER_COLORED.test(v)) continue; // hover auf farbigem Grund: korrekt
      if (WHITE.test(v) && verdict === 'farbig') continue;
      hover.push(entry);
    }
  }

  // statische classNames wie im ersten Analyzer
  if (pieces.length === 1) {
    const cls = pieces[0];
    if (WHITE.test(cls) && !HOVER_COLORED.test(cls) && !COLORED_BG.test(cls)) {
      let verdict = null;
      for (const c of chainStatics.slice(1)) { verdict = effBg(c); if (verdict) break; }
      if (verdict !== 'farbig') broken.push(`${file}:${line}  "${cls.slice(0, 90)}"  [static -> ${verdict || 'kein bg'}]`);
    }
  }

  const newStack = [...parentStack, el];
  // WICHTIG: auch Ausdrucks-Kinder ({x.map(... => <div/>)}, Fragmente) absteigen,
  // sonst fehlen alle Elemente in Listen
  for (const c of el.children || []) walkNode(c, newStack, file);
}

function walkNode(node, stack, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXElement') { visit(node, stack, file); return; }
  for (const k of Object.keys(node)) {
    if (k === 'loc') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && walkNode(i, stack, file));
    else if (v && typeof v === 'object') walkNode(v, stack, file);
  }
}

for (const file of walkDir('src')) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { console.error('PARSE-FEHLER', file); continue; }
  walkNode(ast.program, [], file);
}

console.log('=== KAPUTT (weiß auf theme/tint/kein bg) ===');
broken.forEach(x => console.log(x));
console.log('\n=== HOVER-WHITE AUF THEME-GRUND ===');
hover.forEach(x => console.log(x));
console.log('\nKaputt:', broken.length, ' Hover:', hover.length);
