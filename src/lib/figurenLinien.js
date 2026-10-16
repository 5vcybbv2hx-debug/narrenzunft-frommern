// Hilfsfunktionen für feste Linien (Person↔Person) + Einrasten in der Figuren-Aufstellung.
// Alle Koordinaten sind Prozent (0-100) der Bühne.
// Eine Linie verbindet zwei Personen: { a: mitglied_id, b: mitglied_id }.
// Gezeichnet wird immer von Chipmitte zu Chipmitte.

export const parseLinien = (raw) => {
  try {
    const a = JSON.parse(raw || '[]');
    if (!Array.isArray(a)) return [];
    return a
      .filter((l) => l && l.a && l.b)
      .map((l) => ({ a: String(l.a), b: String(l.b) }));
  } catch {
    return [];
  }
};

const r1 = (n) => Math.round(n * 10) / 10;
const GRID = 5; // sauberes 5%-Raster, beide Achsen, an 0 ausgerichtet

// Rechnet die Personen-Linien in konkrete Strecken um (für Snap & Render).
export function linienSegmente(linien, marker) {
  const m = (id) => marker.find((x) => x.mitglied_id === id);
  const segs = [];
  linien.forEach((l) => {
    const a = m(l.a), b = m(l.b);
    if (a && b) segs.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  });
  return segs;
}

/**
 * Einrasten beim Verschieben einer Person:
 *  1. an Enden anderer Linien (also andere Personen)
 *  2. sonst an die nächste Stelle auf einer Linie
 *  3. sonst ans 5%-Raster
 */
export function snapPerson(p, linien, marker, rect) {
  const toPx = (q) => ({ x: (q.x * rect.width) / 100, y: (q.y * rect.height) / 100 });
  const pp = toPx(p);
  const segs = linienSegmente(linien, marker);

  // 1) Linien-Enden
  const punkte = [];
  segs.forEach((s) => { punkte.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }); });
  let best = null, bestD = 14;
  punkte.forEach((q) => {
    const qp = toPx(q);
    const d = Math.hypot(qp.x - pp.x, qp.y - pp.y);
    if (d < bestD) { bestD = d; best = q; }
  });
  if (best) return { x: r1(best.x), y: r1(best.y) };

  // 2) Entlang einer Linie
  let bs = null, sd = 10;
  segs.forEach((s) => {
    const a = toPx({ x: s.x1, y: s.y1 }), b = toPx({ x: s.x2, y: s.y2 });
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
    if (!L2) return;
    const t = Math.max(0, Math.min(1, ((pp.x - a.x) * vx + (pp.y - a.y) * vy) / L2));
    const fx = a.x + t * vx, fy = a.y + t * vy;
    const d = Math.hypot(fx - pp.x, fy - pp.y);
    if (d < sd) { sd = d; bs = { x: (fx / rect.width) * 100, y: (fy / rect.height) * 100 }; }
  });
  if (bs) return { x: r1(bs.x), y: r1(bs.y) };

  // 3) Raster
  return { x: r1(Math.round(p.x / GRID) * GRID), y: r1(Math.round(p.y / GRID) * GRID) };
}

/** Einrasten beim Linien-Zeichnen: nächste Person innerhalb Fangradius. */
export function snapZuPerson(p, marker, rect) {
  const toPx = (q) => ({ x: (q.x * rect.width) / 100, y: (q.y * rect.height) / 100 });
  const pp = toPx(p);
  let best = null, bd = 24;
  marker.forEach((m) => {
    const qp = toPx(m);
    const d = Math.hypot(qp.x - pp.x, qp.y - pp.y);
    if (d < bd) { bd = d; best = m; }
  });
  return best ? { x: r1(best.x), y: r1(best.y), mitglied_id: best.mitglied_id } : null;
}

/** Schriftgröße für Namen-Chip je nach Namenslänge (kürzere Namen = größer). */
export function chipFontSize(name) {
  const n = (name || '').length;
  if (n <= 7) return '10px';
  if (n <= 11) return '9px';
  return '8px';
}