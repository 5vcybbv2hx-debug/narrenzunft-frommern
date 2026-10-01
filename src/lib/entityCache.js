// Leichter In-Memory-Cache für Entitätslisten — entlastet die API bei
// gleichzeitig aktiven Nutzern (weniger Abfragen pro App-Besuch).
//
// - Schlüssel-Format: "<Entity>|<userId>|<Zusatz>" — Daten sind RLS-gefiltert
//   pro Nutzer, daher gehört die userId in jeden Schlüssel.
// - Frische Einträge (innerhalb der TTL) kommen sofort aus dem Cache,
//   ganz ohne API-Aufruf. Parallele Aufrufe mit gleichem Schlüssel teilen
//   sich einen laufenden Request (kein Doppel-Fetch).
// - Abgelaufene oder fehlende Einträge werden frisch geholt.
// - Nach Schreibzugriffen clearEntityCache('<Entity>') aufrufen, damit der
//   nächste Ladevorgang frisch holt.
// - Nur RAM (kein localStorage): personenbezogene Daten verlassen die
//   Session nicht und sterben mit dem Tab.

const store = new Map(); // key -> { data, expiresAt }
const inflight = new Map(); // key -> laufender Promise

export async function cachedFetch(key, fetcher, ttlMs = 60000) {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  let p = inflight.get(key);
  if (!p) {
    p = Promise.resolve()
      .then(fetcher)
      .then(data => {
        store.set(key, { data, expiresAt: Date.now() + ttlMs });
        return data;
      })
      .finally(() => { inflight.delete(key); });
    inflight.set(key, p);
  }
  return p;
}

// Invalidiert alle Cache-Einträge einer Entity (ohne Argument: alles).
export function clearEntityCache(name) {
  for (const key of [...store.keys()]) {
    if (!name || key.startsWith(`${name}|`)) store.delete(key);
  }
}
