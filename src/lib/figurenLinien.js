// Hilfsfunktionen für feste Linien + Einrasten in der Figuren-Aufstellung.
// Alle Koordinaten sind Prozent (0-100) der bühne.

export const parseLinien = (raw) => {
  try {
    const a = JSON.parse(raw || '[]');
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Rastet einen Punkt p ({x,y} in %) ein:
 *  1. an Linien-Endpunkten (und optional weiteren Punkten, z. B. Personen)
 *  2. sonst an die nächstgelegene Stelle auf einer Linie
 * rect = Bühnenmaße in px (für pixelgenauen Fangradius).
 */
export function snapPunkt(p, linien, rect, extra = []) {
  const toPx = (q) => ({ x: (q.x * rect.width) / 100, y: (q.y * rect.height) / 100 });
  const pp = toPx(p);

  // 1) Endpunkte / Zusatzpunkte
  const punkte = [...extra];
  linien.forEach((l) => {
    punkte.push({ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 });
  });
  let best = null;
  let bestD = 16;
  punkte.forEach((q) => {
    const qp = toPx(q);
    const d = Math.hypot(qp.x - pp.x, qp.y - pp.y);
    if (d < bestD) { bestD = d; best = q; }
  });
  if (best) return { x: r1(best.x), y: r1(best.y) };

  // 2) Entlang einer Linie
  let bestSeg = null;
  let segD = 11;
  linien.forEach((l) => {
    const a = toPx({ x: l.x1, y: l.y1 });
    const b = toPx({ x: l.x2, y: l.y2 });
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) return;
    const t = Math.max(0, Math.min(1, ((pp.x - a.x) * vx + (pp.y - a.y) * vy) / len2));
    const fx = a.x + t * vx, fy = a.y + t * vy;
    const d = Math.hypot(fx - pp.x, fy - pp.y);
    if (d < segD) {
      segD = d;
      bestSeg = { x: (fx / rect.width) * 100, y: (fy / rect.height) * 100 };
    }
  });
  if (bestSeg) return { x: r1(bestSeg.x), y: r1(bestSeg.y) };
  return p;
}