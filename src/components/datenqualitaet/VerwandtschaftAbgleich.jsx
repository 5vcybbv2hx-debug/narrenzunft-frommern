import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link2, Loader2 } from 'lucide-react';
import { umkehrBeziehung } from '@/lib/verwandtschaft';

/**
 * Abgleich "Verwandtschaften beidseitig" (Owner-Regel: immer beide Richtungen).
 *
 * Fehlt die Gegenrichtung, greifen Elternrechte, Familienanmeldungen bei
 * Ausfahrten und das Familien-Dashboard für den Datensatz nicht — ohne dass
 * es irgendwo als Fehler auffällt. Dieses Werkzeug findet alle einseitigen
 * Einträge und ergänzt die fehlende Richtung. Idempotent: mehrfaches Ausführen
 * legt nichts doppelt an.
 */
export default function VerwandtschaftAbgleich({ onChanged }) {
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);

  const abgleichen = async () => {
    setLaeuft(true);
    setErgebnis(null);
    try {
      const alle = await base44.entities.Verwandtschaft.list('-created_date', 2000);
      const vorhanden = new Set(
        (alle || []).map(v => `${v.mitglied_id}|${v.verwandter_id}|${v.beziehung}`),
      );
      const fehlend = [];
      (alle || []).forEach(v => {
        if (!v.mitglied_id || !v.verwandter_id) return;
        const gegen = `${v.verwandter_id}|${v.mitglied_id}|${umkehrBeziehung(v.beziehung)}`;
        if (!vorhanden.has(gegen)) {
          // Doppelte in fehlend vermeiden (zwei gleichlautende Einträge)
          const schluessel = gegen;
          if (!fehlend.some(f => f._key === schluessel)) {
            fehlend.push({
              _key: schluessel,
              mitglied_id: v.verwandter_id,
              verwandter_id: v.mitglied_id,
              beziehung: umkehrBeziehung(v.beziehung),
            });
          }
        }
      });

      let erstellt = 0;
      for (const f of fehlend) {
        const { _key, ...daten } = f;
        try {
          await base44.entities.Verwandtschaft.create(daten);
          erstellt += 1;
        } catch (e) {
          console.error('Gegenrichtung anlegen fehlgeschlagen:', daten, e);
        }
      }

      setErgebnis({ geprueft: (alle || []).length, fehlend: fehlend.length, erstellt });
      if (erstellt > 0) {
        toast.success(`${erstellt} fehlende Gegenrichtung(en) ergänzt.`);
        onChanged?.();
      } else {
        toast.success('Alle Verwandtschaften sind bereits beidseitig eingetragen.');
      }
    } catch (e) {
      console.error('Abgleich Verwandtschaften:', e);
      toast.error('Abgleich fehlgeschlagen: ' + String(e?.message || e).slice(0, 120));
    }
    setLaeuft(false);
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-oswald uppercase tracking-wide text-foreground text-sm flex items-center gap-2">
            <Link2 size={15} className="text-primary" /> Verwandtschaften beidseitig
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Regel: Jede Verwandtschaft steht in beiden Profilen. Fehlt die Gegenrichtung,
            funktionieren Elternrechte und Familienanmeldungen nicht. Der Abgleich ergänzt
            nur Fehlendes, er löscht nichts.
          </p>
        </div>
        <button
          onClick={abgleichen}
          disabled={laeuft}
          className="shrink-0 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1.5"
        >
          {laeuft ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
          {laeuft ? 'Prüfe …' : 'Abgleichen'}
        </button>
      </div>
      {ergebnis && (
        <p className="text-xs text-foreground mt-2">
          {ergebnis.geprueft} Einträge geprüft, {ergebnis.fehlend} einseitig, {ergebnis.erstellt} ergänzt.
        </p>
      )}
    </section>
  );
}
