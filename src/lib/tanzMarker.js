/**
 * Gemeinsame Helfer für Musik-Zeitmarker der Tanzwerkstatt.
 * Marker werden als JSON-String am TanzMusik-Datensatz gespeichert:
 *   [{"zeit": 42, "figur_id": "...", "label": "Einsatz"}]
 * `zeit` = Sekunden ab Stückbeginn (Zahl).
 */
export const parseMarker = (raw) => {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

export const fmtZeit = (s) => {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(sec / 60);
  const rest = sec % 60;
  return `${m}:${String(rest).padStart(2, '0')}`;
};

// Akzeptiert "90" (Sekunden) oder "1:30" (m:ss)
export const parseZeit = (str) => {
  if (typeof str !== 'string') return NaN;
  const parts = str.trim().split(':').map(p => p.trim());
  if (parts.some(p => p === '' || Number.isNaN(Number(p)))) return NaN;
  if (parts.length === 1) return Number(parts[0]);
  if (parts.length === 2) return Number(parts[0]) * 60 + Number(parts[1]);
  return NaN;
};

// Marker eines Stücks sortiert nach Zeit
export const sortMarker = (marker) => [...(marker || [])].sort((a, b) => (a.zeit ?? 0) - (b.zeit ?? 0));

// Alle Einsatzpunkte einer Figur über alle Musikstücke: [{musik, marker}]
export const einsatzpunkteFuerFigur = (musikListe, figurId) => {
  const punkte = [];
  for (const m of musikListe || []) {
    for (const mk of parseMarker(m.marker)) {
      if (mk.figur_id === figurId) punkte.push({ musik: m, marker: mk });
    }
  }
  return punkte.sort((a, b) => (a.marker.zeit ?? 0) - (b.marker.zeit ?? 0));
};
