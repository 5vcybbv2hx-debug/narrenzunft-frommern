#!/usr/bin/env python3
"""Wandelt handgeschnitzte Bottom-Modals auf die gemeinsame BottomModal-Komponente um.

Muster in den 31 Dateien:
  <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" [onClick={...}]>
    <div className="...karte..." [onClick={e => e.stopPropagation()}]>
      ...inhalt...
    </div>
  </div>

wird zu:
  <BottomModal onClose={...} [onBackdropClick={...}] cardClass="...karte...">
    ...inhalt...
  </BottomModal>
"""
import re, sys

BACKDROP_KEY = 'fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4'
STANDARD_BACKDROP = BACKDROP_KEY
SELF_CLOSING_END = '/>'

def find_div_spans(s, start):
    """Liefert (open_end, is_selfclosing) für das <div bei s[start:].

    Respektiert Quotes und JS-Ausdrücke in Attributen: Ein '>' innerhalb von
    Zeichenketten oder geschweiften Klammern (z. B. Pfeilfunktionen) beendet
    den Tag NICHT.
    """
    i = start
    quote = None       # aktuelles Quote-Zeichen oder None
    brace = 0          # Tiefe der { } in Attributausdrücken
    while i < len(s):
        c = s[i]
        if quote:
            if c == quote and s[i - 1] != '\\':
                quote = None
        elif c in ('"', "'", '`'):
            quote = c
        elif c == '{':
            brace += 1
        elif c == '}':
            brace -= 1
        elif c == '>' and brace == 0:
            selfclosing = s[i - 1] == '/'
            return i + 1, selfclosing
        i += 1
    raise ValueError('unterminated div')

def next_tag(s, pos):
    """Nächstes <div oder </div> ab pos. Liefert (pos, kind)."""
    a = s.find('<div', pos)
    b = s.find('</div>', pos)
    if a == -1 and b == -1:
        return None, None
    if b == -1 or (a != -1 and a < b):
        return a, 'open'
    return b, 'close'

def matching_close(s, open_pos):
    """Position des passenden </div> für das <div bei open_pos."""
    depth = 0
    pos = open_pos
    while True:
        p, kind = next_tag(s, pos + 1)
        if p is None:
            raise ValueError('no matching close')
        if kind == 'open':
            open_end, selfclosing = find_div_spans(s, p)
            # <div in Attributen ausschließen? In Strings wie "..." kommt kein '<div' vor (JSX-Attr sind quoted), OK.
            if selfclosing:
                pos = open_end - 1
            else:
                depth += 1
                pos = open_end - 1
        else:
            if depth == 0:
                return p
            depth -= 1
            pos = p + 6

def balanced_brace(s, start):
    """s[start] == '{' → Position nach der schließenden '}'."""
    assert s[start] == '{'
    depth = 0
    for i in range(start, len(s)):
        c = s[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i + 1
    raise ValueError('unbalanced')

def parse_attrs(tag):
    """Extrahiert className-String und onClick-Ausdruck aus einem div-Tag-Text."""
    if re.search(r'className=\{`', tag):
        raise ValueError('className als Template-Literal — bitte manuell umwandeln')
    cls = None
    m = re.search(r'className="([^"]*)"', tag)
    if m:
        cls = m.group(1)
    onclick = None
    m = re.search(r'onClick=\{', tag)
    if m:
        end = balanced_brace(tag, m.end() - 1)
        onclick = tag[m.end():end - 1]  # Ausdruck zwischen den geschweiften Klammern
    return cls, onclick

def transform(source):
    out = []
    pos = 0
    changed = False
    while True:
        b = source.find(BACKDROP_KEY, pos)
        if b == -1:
            out.append(source[pos:])
            break
        open_start = source.rfind('<div', pos, b + len(BACKDROP_KEY))
        if open_start == -1:
            out.append(source[pos:b + len(BACKDROP_KEY)])
            pos = b + len(BACKDROP_KEY)
            continue
        open_end, _ = find_div_spans(source, open_start)
        backdrop_tag = source[open_start:open_end]
        backdrop_cls, backdrop_onclick = parse_attrs(backdrop_tag)

        # Erstes Kind-<div = Karte
        card_pos, kind = next_tag(source, open_end)
        if card_pos is None or kind != 'open':
            raise ValueError('keine Karte nach Backdrop')
        card_open_end, card_selfclosing = find_div_spans(source, card_pos)
        card_tag = source[card_pos:card_open_end]
        card_cls, card_onclick = parse_attrs(card_tag)
        if card_selfclosing:
            raise ValueError('Karte ist self-closing')

        card_close = matching_close(source, card_pos)
        backdrop_close = matching_close(source, open_start)

        # onClose-Ausdruck: Backdrop-Click, sonst onClose-Prop (eslint fängt falsche Namen)
        on_close = backdrop_onclick or 'onClose'
        props = [f'onClose={{{on_close}}}']
        if backdrop_onclick:
            props.append(f'onBackdropClick={{{backdrop_onclick}}}')
        props.append(f'cardClass="{card_cls}"')
        extra_bd = backdrop_cls.replace(STANDARD_BACKDROP, '').strip()
        if extra_bd:
            props.append(f'backdropClass="{extra_bd}"')
        new_open = '<BottomModal ' + ' '.join(props) + '>'

        new_close = '</BottomModal>'
        out.append(source[pos:open_start])
        out.append(new_open)
        out.append(source[card_open_end:card_close])
        out.append(new_close)
        # Zwischen Karten-Ende und Backdrop-Ende darf nur Whitespace/Leerraum-Kommentar stehen
        between = source[card_close + 6:backdrop_close]
        if between.strip():
            out.insert(len(out) - 1, between)  # ungewöhnlich, aber mit übernehmen
        pos = backdrop_close + 6
        changed = True
    return ''.join(out), changed

def add_import(src):
    if 'BottomModal' in src and "components/ui/BottomModal" in src:
        return src
    # Import nach dem letzten Import anfügen
    imports = list(re.finditer(r"^import .*?;$", src, re.MULTILINE))
    if not imports:
        return src
    last = imports[-1]
    return src[:last.end()] + "\nimport BottomModal from '@/components/ui/BottomModal';" + src[last.end():]

def process(path):
    with open(path) as f:
        src = f.read()
    # Nur JSX-Dateien mit dem Muster
    if BACKDROP_KEY not in src:
        return False
    new, changed = transform(src)
    if not changed:
        return False
    new = add_import(new)
    with open(path, 'w') as f:
        f.write(new)
    return True

if __name__ == '__main__':
    for p in sys.argv[1:]:
        try:
            ok = process(p)
            print(('UMGEWANDELT  ' if ok else 'übersprungen ') + p)
        except Exception as e:
            print(f'FEHLER       {p}: {e}')
