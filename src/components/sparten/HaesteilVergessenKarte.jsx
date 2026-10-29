import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Shirt, Plus, Trash2, Loader2, ChevronDown } from 'lucide-react';
import { fmtDatum } from '@/lib/datum';

/**
 * HaesteilVergessenKarte – dokumentiert vergessene Hästeile (z. B. Garde)
 * direkt im Mitglieder-Tab der Gruppe. Nur für Verantwortliche (canEdit).
 * Zeigt die Historie pro Person — so fallen Muster auf statt Einzelfälle.
 */
export default function HaesteilVergessenKarte({ gruppeId, alleMitglieder }) {
  const [eintraege, setEintraege] = useState([]);
  const [laden, setLaden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offen, setOffen] = useState(false);
  const [person, setPerson] = useState('');
  const [teil, setTeil] = useState('');
  const [notiz, setNotiz] = useState('');
  const [haesordnung, setHaesordnung] = useState([]); // Teile aus der Kleiderordnung als Vorschlaege

  const ladenFn = async () => {
    setLaden(true);
    try {
      const e = await base44.entities.HaesTeilVergessen.filter({ haesgruppe_id: gruppeId });
      setEintraege((e || []).sort((a, b) => (b.datum || '').localeCompare(a.datum || '')));
    } catch (e) { console.error('Hästeil:', e); }
    finally { setLaden(false); }
  };

  useEffect(() => {
    base44.entities.Haesgruppe.get(gruppeId)
      .then(g => {
        try {
          const a = JSON.parse(g?.haesordnung || '[]');
          setHaesordnung(Array.isArray(a) ? a : []);
        } catch { setHaesordnung([]); }
      })
      .catch(() => setHaesordnung([]));
  }, [gruppeId]);

  useEffect(() => { ladenFn(); /* eslint-disable-line */ }, [gruppeId]);

  const nameVon = (id) => {
    const m = (alleMitglieder || []).find(x => x.id === id);
    return m ? [m.vorname, m.nachname].filter(Boolean).join(' ') : 'Unbekannt';
  };

  const eintragen = async () => {
    if (!person || !teil.trim()) { toast.error('Person und Hästeil ausfüllen.'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'haesteil', aktion: 'create', haesgruppe_id: gruppeId,
        mitglied_id: person, teil: teil.trim(), notiz: notiz.trim(),
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      setTeil(''); setNotiz(''); setOffen(false);
      await ladenFn();
      toast.success('Hästeil dokumentiert.');
    } catch (e) { toast.error(e.message || 'Eintrag fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const loeschen = async (e) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'haesteil', aktion: 'delete', haesgruppe_id: gruppeId, eintrag_id: e.id,
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      await ladenFn();
    } catch (err) { toast.error(err.message || 'Löschen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  // Zaehler pro Person
  const zaehler = eintraege.reduce((acc, e) => { acc[e.mitglied_id] = (acc[e.mitglied_id] || 0) + 1; return acc; }, {});
  const top = Object.entries(zaehler).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-4" aria-label="Hästeil vergessen">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-oswald uppercase tracking-wide text-foreground flex items-center gap-1.5">
          <Shirt className="w-4 h-4 text-primary" /> Hästeil vergessen
        </h3>
        <button onClick={() => setOffen(v => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25">
          {offen ? <ChevronDown className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {offen ? 'Schließen' : 'Eintragen'}
        </button>
      </div>

      {offen && (
        <div className="mt-3 space-y-2">
          <select value={person} onChange={e => setPerson(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="">Person wählen…</option>
            {(alleMitglieder || []).map(m => (
              <option key={m.id} value={m.id}>{[m.vorname, m.nachname].filter(Boolean).join(' ')}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input value={teil} onChange={e => setTeil(e.target.value)} placeholder="Hästeil (z. B. Handschuhe)" list="nzf-haesordnung-teile"
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            <datalist id="nzf-haesordnung-teile">
              {haesordnung.map((t, i) => (
                <option key={i} value={t.titel} />
              ))}
            </datalist>
            <button onClick={eintragen} disabled={busy || !person || !teil.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              Eintragen
            </button>
          </div>
          <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional)"
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
      )}

      {laden ? (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Lade…</p>
      ) : eintraege.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-3 italic">Noch nichts dokumentiert.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {top.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {top.map(([id, n]) => (
                <span key={id} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${n >= 3 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {nameVon(id)} ×{n}
                </span>
              ))}
            </div>
          )}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {eintraege.slice(0, 8).map(e => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground shrink-0 w-16">{fmtDatum(e.datum)}</span>
                <span className="text-foreground min-w-0 truncate flex-1">{nameVon(e.mitglied_id)}: {e.teil}</span>
                <button onClick={() => loeschen(e)} disabled={busy} className="p-1 rounded-lg text-muted-foreground hover:text-red-400 shrink-0" title="Löschen">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}