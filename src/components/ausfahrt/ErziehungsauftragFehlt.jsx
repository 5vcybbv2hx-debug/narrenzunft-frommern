import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { istU18 } from '@/lib/u18Begleitung';
import { ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Für Kinder, die bereits angemeldet sind, aber noch keinen Erziehungsauftrag
 * haben. Die Aufsichtssuche bei der Anmeldung greift nur für neu angehakte
 * Kinder — hier wird die Begleitperson nachgetragen, ohne erneute Anmeldung.
 * Auswahl speichert sofort (verwalteU18Begleitung, aktion 'anlegen').
 */
export default function ErziehungsauftragFehlt({ typ = 'ausfahrt', terminId, datum, kinder = [], onSaved }) {
  const [erwachsene, setErwachsene] = useState([]);
  const [suche, setSuche] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (kinder.length === 0) return;
    base44.entities.Mitglied.list('nachname', 1000)
      .then(liste => setErwachsene((liste || []).filter(m => !m.archiviert && !istU18(m.geburtsdatum, datum))))
      .catch(e => console.error('Aufsichtspersonen laden:', e));
  }, [kinder.length, datum]);

  if (kinder.length === 0) return null;

  const eintragen = async (kind, person) => {
    setBusy(kind.id);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', {
        aktion: 'anlegen',
        typ,
        termin_id: terminId,
        u18_mitglied_id: kind.id,
        begleit_mitglied_id: person.id,
      });
      const fehler = res?.data?.error || res?.error;
      if (fehler) throw new Error(fehler);
      toast.success(`Aufsicht für ${kind.name} eingetragen`);
      setSuche(p => ({ ...p, [kind.id]: '' }));
      onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Eintragen fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
        <ShieldCheck size={13} /> Erziehungsauftrag fehlt
      </p>
      {kinder.map(kind => {
        const text = suche[kind.id] || '';
        const treffer = text.trim().length >= 2
          ? erwachsene.filter(m => `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase().includes(text.trim().toLowerCase())).slice(0, 5)
          : [];
        return (
          <div key={kind.id} className="rounded-lg border border-border bg-background p-2.5">
            <p className="text-xs font-semibold text-foreground mb-1.5">Aufsicht für {kind.name}</p>
            <input
              value={text}
              onChange={e => setSuche(p => ({ ...p, [kind.id]: e.target.value }))}
              placeholder="Aufsichtsperson suchen (min. 2 Zeichen)…"
              className="w-full px-2.5 py-2 rounded-md bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
            {treffer.length > 0 && (
              <div className="mt-1 space-y-1">
                {treffer.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={busy === kind.id}
                    onClick={() => eintragen(kind, m)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-secondary hover:bg-border text-xs text-foreground disabled:opacity-50"
                  >
                    <span>{m.vorname} {m.nachname}</span>
                    {busy === kind.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : <CheckCircle2 size={12} className="text-green-500" />}
                  </button>
                ))}
              </div>
            )}
            {text.trim().length >= 2 && treffer.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">Niemand gefunden.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}