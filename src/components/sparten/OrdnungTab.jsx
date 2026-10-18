import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, ListOrdered, Loader2 } from 'lucide-react';

/**
 * OrdnungTab – Häsordnung: die feste Reihenfolge der Gruppenmitglieder
 * (für Aufstellung & Umzüge). Gilt für ALLE Gruppen.
 *
 * Angezeigt bekommt sie jede/jeder mit Gruppenzugriff; sortieren dürfen nur
 * Verantwortliche der Gruppe und Vorstand (via verwalteTanzDaten, typ 'ordnung').
 * Speicherformat: Haesgruppe.ordnung = JSON-Array der mitglied_ids.
 * Nicht zugeordnete aktive Teilnehmer hängen alphabetisch hinten dran.
 */
const parseOrdnung = (raw) => {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

export default function OrdnungTab({ gruppe, alleMitglieder, canEdit }) {
  const [ordnung, setOrdnung] = useState(() => parseOrdnung(gruppe?.ordnung));
  const [rest, setRest] = useState([]); // aktive Teilnehmer ohne feste Position
  const [busy, setBusy] = useState(false);
  const [laden, setLaden] = useState(true);

  const ladenFn = async () => {
    setLaden(true);
    try {
      const tn = await base44.entities.GruppenTeilnehmer.filter({ haesgruppe_id: gruppe.id });
      const aktiv = (tn || []).filter(x => x.aktiv !== false && x.mitglied_id);
      const ids = new Set(aktiv.map(x => x.mitglied_id));
      // Positionen ohne aktiven Teilnehmer rausfiltern
      const gueltig = parseOrdnung(gruppe?.ordnung).filter(id => ids.has(id));
      setOrdnung(gueltig);
      setRest(aktiv.map(x => x.mitglied_id).filter(id => !gueltig.includes(id)));
    } catch (e) {
      console.error('Ordnung laden:', e);
      toast.error('Ordnung konnte nicht geladen werden.');
    } finally { setLaden(false); }
  };

  useEffect(() => { ladenFn(); /* eslint-disable-line */ }, [gruppe?.id]);

  const nameVon = (mitgliedId) => {
    const m = (alleMitglieder || []).find(x => x.id === mitgliedId);
    return m ? [m.vorname, m.nachname].filter(Boolean).join(' ') : 'Unbekannt';
  };

  const alle = useMemo(() => [...ordnung, ...rest], [ordnung, rest]);

  const speichern = async (neueIds) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'ordnung', aktion: 'update', haesgruppe_id: gruppe.id,
        ordnung: JSON.stringify(neueIds),
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      setOrdnung(neueIds);
      toast.success('Ordnung gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const verschieben = (idx, richtung) => {
    const neu = [...alle];
    const j = idx + richtung;
    if (j < 0 || j >= neu.length) return;
    [neu[idx], neu[j]] = [neu[j], neu[idx]];
    speichern(neu);
  };

  const inOrdnung = (idx) => idx < ordnung.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-oswald uppercase tracking-wide text-foreground flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-primary" /> Ordnung
        </h2>
        <span className="text-sm text-muted-foreground">{alle.length} {gruppe?.typ === 'Tanzgruppe' ? 'Tänzer:innen' : 'Mitglieder'}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Feste Reihenfolge für Aufstellung & Umzug. {canEdit ? 'Sortieren mit den Pfeilen — wird automatisch gespeichert.' : ''}
      </p>

      {laden ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Ordnung…
        </div>
      ) : alle.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Noch keine aktiven Mitglieder in dieser Gruppe.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {alle.map((mitgliedId, i) => (
            <div key={mitgliedId} className="flex items-center gap-3 px-4 py-3">
              <span className={`w-7 h-7 rounded-full border text-xs font-semibold flex items-center justify-center shrink-0 ${
                inOrdnung(i) ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary border-border text-muted-foreground'
              }`}>
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm text-foreground truncate">{nameVon(mitgliedId)}</span>
              {!inOrdnung(i) && i === ordnung.length && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">ohne Position</span>
              )}
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => verschieben(i, -1)}
                    disabled={busy || i === 0}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Nach vorne"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => verschieben(i, 1)}
                    disabled={busy || i === alle.length - 1}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Nach hinten"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
