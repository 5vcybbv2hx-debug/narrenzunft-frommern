/* Fixt die vom Analyzer (tw_analysis.json) als kaputt erkannten text-white-Vorkommen:
   Nur in den gemeldeten Zeilen wird standalone text-white -> text-foreground
   (und hover:text-white -> hover:text-foreground) ersetzt. */
const fs = require('fs');
const parser = require('@babel/parser');
const path = require('path');

const analysis = JSON.parse(fs.readFileSync('/tmp/tw_analysis.json', 'utf8'));
const targets = []; // {file, line}
for (const [group, extra] of [['broken', 0], ['unknown', 0]]) {
  for (const [file, lines] of Object.entries(analysis[group] || {})) {
    for (const l of lines) targets.push({ file, line: parseInt(l) });
  }
}

const byFile = {};
for (const t of targets) (byFile[t.file] ||= new Set()).add(t.line);

let fixed = 0;
for (const [file, lineSet] of Object.entries(byFile)) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
  const lines = src.split('\n');
  // Klassennamen pro Zeile suchen und ersetzen
  for (const attr of (function collect(node, acc) {
    if (!node || typeof node !== 'object') return acc;
    if (node.type === 'JSXAttribute' && node.name && node.name.name === 'className'
        && node.value && node.value.type === 'StringLiteral') acc.push(node.value);
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach(i => i && typeof i === 'object' && collect(i, acc));
      else if (v && typeof v === 'object') collect(v, acc);
    }
    return acc;
  })(ast.program, [])) {
    const ln = attr.loc.start.line;
    if (!lineSet.has(ln)) continue;
    const before = attr.value;
    const after = before
      .replace(/(?<![:\w-])text-white\b/g, 'text-foreground')
      .replace(/hover:text-white\b/g, 'hover:text-foreground');
    if (after !== before) {
      attr.value = after; // nur zur Doku
      lines[ln - 1] = lines[ln - 1].replace(before, after);
      fixed++;
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
}
console.log('Ersetzt:', fixed, 'Stellen in', Object.keys(byFile).length, 'Dateien');
