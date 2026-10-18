import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { ShieldCheck, UserCheck, AlertTriangle, Check, X } from 'lucide-react';

/**
 * U18-Begleitbestätigung.
 *
 * Anzeige + Bestätigung der Begleit-Einträge für eine Ausfahrt / einen Termin:
 *  - Erziehungsberechtigte bestätigen ihren Teil (Verwandtschaft 'Elternteil')
 *  - Die Begleitperson bestätigt selbst (falls App-Mitglied)
 *  - Bei externer Begleitung und für den Vorstand: manuelle Bestätigung
 * Erst wenn beide Seiten bestätigt haben, ist der Status 'Bestätigt'.
 */
export function U18BegleitungKarte({ typ, terminId, myMitglied }) {
  const { user } = useAuth();
  const [eintraege, setEintraege] = useState([]);
  const [busy, setBusy] = useState(null);

  const istVerwaltung = ['admin', 'vorstand', 'stellv_vorstand'].includes(user?.role);

  const laden = async () => {
    try {
      const e = await base44.entities.U18Begleitung.filter({ termin_id: terminId });
      setEintraege((e || []).filter(x => x.typ === typ));
    } catch (e) { console.error('U18-Begleitung laden:', e); }
  };

  useEffect(() => { laden(); /* eslint-disable-line */ }, [terminId, typ]);

  const bestaetigen = async (aktion, eintragId) => {
    setBusy(eintragId);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', { aktion, eintrag_id: eintragId });
      if (res?.error) throw new Error(res.error);
      await laden();
      toast.success('Bestätigung gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Bestätigung fehlgeschlagen.');
    } finally { setBusy(null); }
  };

  if (eintraege.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2" aria-label="U18-Begleitung">
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={13} className="text-amber-400" />
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">U18-Begleitung</h4>
      </div>
      {eintraege.map(e => {
        const elternOk = !!e.eltern_bestaetigt_am;
        const beglOk = !!e.begleitung_bestaetigt_am;
        const fertig = e.status === 'Bestätigt';
        return (
          <div key={e.id} className={`rounded-lg border p-2.5 space-y-1.5 ${fertig ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-foreground">
                <b>{e.u18_name || 'U18'}</b> geht mit <b>{e.begleit_name || '–'}</b>
              </p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${fertig ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {fertig ? '✓ Bestätigt' : 'Ausstehend'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${elternOk ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                {elternOk ? <Check size={9} /> : <AlertTriangle size={9} />} Eltern {elternOk ? `✓ (${e.eltern_bestaetigt_von || '–'})` : 'offen'}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${beglOk ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                {beglOk ? <Check size={9} /> : <X size={9} />} Begleitung {beglOk ? `✓ (${e.begleitung_bestaetigt_von || '–'})` : 'offen'}
              </span>
            </div>
            {istVerwaltung && !fertig && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {!elternOk && (
                  <button onClick={() => bestaetigen('eltern_bestaetigen', e.id)} disabled={busy === e.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-medium hover:bg-primary/25 disabled:opacity-50">
                    <UserCheck size={10} /> Eltern manuell bestätigen
                  </button>
                )}
                {!beglOk && (
                  <button onClick={() => bestaetigen('begleitung_bestaetigen', e.id)} disabled={busy === e.id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-medium hover:bg-primary/25 disabled:opacity-50">
                    <UserCheck size={10} /> {e.begleit_mitglied_id ? 'Begleitung bestätigen' : 'Begleitung manuell bestätigen (z. B. vor Ort)'}
                  </button>
                )}
              </div>
            )}
            {!istVerwaltung && !fertig && myMitglied && e.begleit_mitglied_id === myMitglied.id && !beglOk && (
              <button onClick={() => bestaetigen('begleitung_bestaetigen', e.id)} disabled={busy === e.id}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-[10px] font-semibold hover:bg-primary/90 disabled:opacity-50">
                <UserCheck size={10} /> Ich übernehme die Begleitung
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Modal: Begleitperson wählen (nach Anmeldung einer U18-Person).
 * Auswahl aus App-Mitgliedern oder freie Namenseingabe (extern).
 */
export function U18BegleitungModal({ typ, terminId, u18MitgliedId, u18Name, onClose, onAngelegt }) {
  const [mitglieder, setMitglieder] = useState([]);
  const [suche, setSuche] = useState('');
  const [externName, setExternName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.entities.Mitglied.list('nachname', 1000)
      .then(m => setMitglieder((m || []).filter(x => x.archiviert !== true && x.id !== u18MitgliedId)))
      .catch(() => setMitglieder([]));
  }, [u18MitgliedId]);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return [];
    return mitglieder.filter(m =>
      `${m.vorname} ${m.nachname}`.toLowerCase().includes(q)).slice(0, 8);
  }, [suche, mitglieder]);

  const anlegen = async (begleitMitgliedId, begleitName) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', {
        aktion: 'anlegen', typ, termin_id: terminId, u18_mitglied_id: u18MitgliedId,
        begleit_mitglied_id: begleitMitgliedId || '', begleit_name: begleitName || '',
      });
      if (res?.error) throw new Error(res.error);
      toast.success('Begleitperson eingetragen. Beide Seiten müssen jetzt bestätigen.');
      onAngelegt?.();
      onClose();
    } catch (e) {
      toast.error(e.message || 'Eintrag fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-xl bg-card border border-border p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-oswald text-lg text-foreground">U18-Begleitperson</h3>
          <p className="text-xs text-muted-foreground">
            {u18Name} ist unter 18. Bitte die begleitende, verantwortliche Person eintragen — Erziehungsberechtigte und Begleitung bestätigen danach getrennt.
          </p>
        </div>
        <div>
          <input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Mitglied suchen (z. B. Sandra Hugendubel)…"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
          {treffer.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {treffer.map(m => (
                <button key={m.id} onClick={() => anlegen(m.id)} disabled={busy}
                  className="w-full text-left px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground hover:border-primary/50 disabled:opacity-50">
                  {m.vorname} {m.nachname}{m.todesdatum ? '' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={externName}
            onChange={e => setExternName(e.target.value)}
            placeholder="…oder Name einer externen Begleitperson"
            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
          <button onClick={() => anlegen('', externName)} disabled={busy || !externName.trim()}
            className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            Eintragen
          </button>
        </div>
        <button onClick={onClose} className="w-full py-2 rounded-lg bg-secondary text-muted-foreground text-sm">
          Später nachtragen
        </button>
      </div>
    </div>
  );
}
