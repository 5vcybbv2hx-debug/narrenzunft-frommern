// Zentrale Datums-Anzeige: deutsches Format TT.MM.JJJJ.
// ISO-Werte aus der Datenbank (YYYY-MM-DD) bleiben Speicherformat —
// angezeigt wird ausschließlich über diese Helfer.

/** 2026-11-15 → 15.11.2026 (auch mit Zeitanteil); leer/ungültig → ''. */
export function fmtDatum(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** 2026-11-15 → 15.11.26 (kurz, für enge Zeilen/Listen). */
export function fmtDatumKurz(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  return `${m[3]}.${m[2]}.${String(m[1]).slice(2)}`;
}

/** 2026-11-15T19:00:00Z → 15.11.2026, 19:00 Uhr. */
export function fmtDatumZeit(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fmtDatum(iso);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Zeitraum: 15.11.2026 → 17.11.2026 */
export function fmtZeitraum(von, bis) {
  const a = fmtDatum(von);
  const b = fmtDatum(bis);
  if (!a && !b) return '';
  return `${a || '–'} → ${b || '–'}`;
}
