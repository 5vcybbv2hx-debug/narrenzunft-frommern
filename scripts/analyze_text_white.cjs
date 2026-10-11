/* Analysiert: Wo sitzt text-white auf einem Theme-Hintergrund (= im Hellmodus unsichtbar)?
   Ein rekursiver AST-Walk (@babel/parser) mit Eltern-Stack: für jedes Element mit
   text-white wird die Kette nach oben durchsucht, bis der erste relevante
   Hintergrund (farbig / Theme / bg-[...]) gefunden wird. */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const STANDALONE_WHITE = /(?<![:\w-])text-white\b/;
const COLORED_BG = /\bbg-(primary|red|green|blue|orange|amber|emerald|black|destructive|yellow|purple|pink|teal|cyan|indigo|violet|rose|lime|sky|fuchsia)/;
const HOVER_ONLY_BG = /hover:bg-(primary|red|green|blue|destructive)/;
const THEMED_BG = /\bbg-(card|secondary|background|popover|muted|transparent|sidebar-background|input|white)\b/;
const GRADIENT = /\b(from|via|to)-(red|blue|green|primary|amber|purple|indigo|cyan|emerald)-/;

function clsString(el) {
  const attr = el.openingElement.attributes.find(
    a => a.type === 'JSXAttribute' && a.name && a.name.name === 'className'
  );
  if (!attr) return { cls: '', dynamic: false };
  const v = attr.value;
  if (!v) return { cls: '', dynamic: false };
  if (v.type === 'StringLiteral') return { cls: v.value, dynamic: false };
  if (v.type === 'JSXExpressionContainer' && v.expression.type === 'TemplateLiteral') {
    const parts = v.expression.quasis.map(q => q.value.cooked);
    return { cls: parts.join('…'), dynamic: v.expression.expressions.length > 0 };
  }
  return { cls: '', dynamic: true };
}

function walkDir(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'ui' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

const broken = {}, fine = {}, unknown = {};
function add(map, file, line, why) { (map[file] ||= []).push(`${line}: ${why}`); }

function visitEl(el, ancestors, file) {
  const { cls, dynamic } = clsString(el);
  const line = el.openingElement.loc ? el.openingElement.loc.start.line : 0;
  const chain = [...ancestors, { cls, dynamic }];

  if (!dynamic && STANDALONE_WHITE.test(cls) && !HOVER_ONLY_BG.test(cls)) {
    if (COLORED_BG.test(cls) || GRADIENT.test(cls)) {
      add(fine, file, line, 'eigen bg farbig');
    } else {
      let verdict = null, sawDynamic = false;
      for (let i = chain.length - 2; i >= 0; i--) {
        const a = chain[i];
        if (a.dynamic) { sawDynamic = true; continue; }
        if (COLORED_BG.test(a.cls) || GRADIENT.test(a.cls)) { verdict = 'farbig'; break; }
        if (THEMED_BG.test(a.cls)) { verdict = 'theme'; break; }
        if (/bg-\[/.test(a.cls)) { verdict = 'bg-[]'; break; }
      }
      if (verdict === 'farbig') add(fine, file, line, 'elter bg farbig');
      else if (verdict === 'theme') add(broken, file, line, 'auf Theme-Hintergrund');
      else if (verdict === 'bg-[]') add(unknown, file, line, 'elter bg-[...]');
      else if (sawDynamic) add(unknown, file, line, 'kein statischer bg, dynamische Klasse dazwischen');
      else add(broken, file, line, 'auf Seiten-Hintergrund (kein bg)');
    }
  }

  for (const child of el.children || []) {
    if (child.type === 'JSXElement') visitEl(child, chain, file);
  }
}

// generischer AST-Walk: jedes JSXElement mit Vorfahren-Kette besuchen
function walkNode(node, ancestors, file) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'JSXElement') {
    visitEl(node, ancestors, file);
    // visitEl steigt selbst in JSX-Kinder ein; hier nicht doppeln:
    // wir laufen weiter über alle anderen Felder außer children/JSX-Kinder
    walkNode(node.openingElement, ancestors, file);
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object') {
          // JSX-Kinder, die nicht JSXElement sind (Fragmente, Container), normal weiterlaufen lassen
          walkNode(item, ancestors, file);
        }
      }
    } else if (v && typeof v === 'object') {
      walkNode(v, ancestors, file);
    }
  }
}

for (const file of walkDir('src')) {
  const src = fs.readFileSync(file, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] }); }
  catch (e) { console.error('PARSE-FEHLER', file, e.message); continue; }
  walkNode(ast.program, [], file);
}

const sum = m => Object.values(m).reduce((s, l) => s + l.length, 0);
const fmt = (m, title) => {
  console.log(title);
  for (const [f, l] of Object.entries(m).map(([f, l]) => [f, l.length]).sort((a, b) => b[1] - a[1]))
    console.log(String(l).padStart(4), f);
  console.log('Summe:', sum(m), 'in', Object.keys(m).length, 'Dateien\n');
};
fmt(broken, '=== KAPUTT IM HELLMODUS ===');
fmt(fine, '=== OK (farbiger Hintergrund) ===');
fmt(unknown, '=== UNBEKANNT ===');
fs.writeFileSync('/tmp/tw_analysis.json', JSON.stringify({ broken, fine, unknown }, null, 1));
