import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, ArrowUp, ArrowDown, Trash2, Pencil, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtZeit, einsatzpunkteFuerFigur } from '@/lib/tanzMarker';
import { Music as MusicIcon } from 'lucide-react';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

/**
 * AblaufTab – Bearbeitbare, nummerierte Tanzablauf-Folge der Gruppe.
 * Jeder Schritt hat eine Beschreibung (Freitext) und kann optional mit
 * einer Figur aus dem Figuren-Tab verknüpft werden.
 *
 * Lesen darf jeder mit Gruppenzugriff; Schreiben dürfen Vorstand/Stellv./
 * Admin und alle Verantwortlichen der Gruppe — läuft über die sichere
 * Backend-Function 'verwalteTanzDaten' (typ 'schritt').
 */
export default function AblaufTab({ gruppeId, canEdit, onUebeMusik }) {
  const [schritte, setSchritte] = useState([]);
  const [figuren, setFiguren] = useState([]);
  const [musikListe, setMusikListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [neuText, setNeuText] = useState('');
  const [neuFigur, setNeuFigur] = useState('');
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editFigur, setEditFigur] = useState('');

  const laden = async () => {
    try {
      const [s, f, mus] = await Promise.all([
        base44.entities.TanzSchritt.filter({ haesgruppe_id: gruppeId }),
        base44.entities.TanzFigur.filter({ haesgruppe_id: gruppeId }),
        base44.entities.TanzMusik.filter({ haesgruppe_id: gruppeId }),
      ]);
      setSchritte([...(s || [])].sort((a, b) => (a.nr ?? 0) - (b.nr ?? 0)));
      setFiguren([...(f || [])].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0)));
      setMusikListe(mus || []);
    } catch (e) {
      console.error(e);
      toast.error('Tanzablauf konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (gruppeId) laden(); }, [gruppeId]);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('verwalteTanzDaten', { haesgruppe_id: gruppeId, ...payload });
    return res?.data || res;
  };

  const figurName = (figurId) => figuren.find(f => f.id === figurId)?.name || '';

  const hinzufuegen = async () => {
    const beschreibung = neuText.trim();
    if (!beschreibung) return;
    setBusy(true);
    try {
      const data = await invoke({ typ: 'schritt', aktion: 'create', beschreibung, nr: schritte.length + 1, figur_id: neuFigur });
      if (data?.error) throw new Error(data.error);
      setNeuText('');
      setNeuFigur('');
      await laden();
    } catch (e) {
      toast.error(e.message || 'Hinzufügen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const speichern = async (s) => {
    const beschreibung = editText.trim();
    if (!beschreibung) return;
    setEditId(null);
    if (beschreibung === s.beschreibung && editFigur === (s.figur_id || '')) return;
    try {
      const data = await invoke({ typ: 'schritt', aktion: 'update', schritt_id: s.id, beschreibung, figur_id: editFigur });
      if (data?.error) throw new Error(data.error);
      await laden();
      toast.success('Schritt gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    }
  };

  const entfernen = async (s) => {
    if (!(await confirmDialog(`Schritt ${s.nr ?? ''} entfernen?`))) return;
    try {
      const data = await invoke({ typ: 'schritt', aktion: 'delete', schritt_id: s.id });
      if (data?.error) throw new Error(data.error);
      await laden();
      await neuNummerieren(schritte.filter(x => x.id !== s.id));
    } catch (e) {
      toast.error(e.message || 'Entfernen fehlgeschlagen.');
    }
  };

  const verschieben = async (s, richtung) => {
    const idx = schritte.findIndex(x => x.id === s.id);
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= schritte.length) return;
    const neu = [...schritte];
    const [eintrag] = neu.splice(idx, 1);
    neu.splice(ziel, 0, eintrag);
    await neuNummerieren(neu, true);
  };

  // Schreibe die fortlaufende Nummerierung (1..n) in der neuen Reihenfolge
  const neuNummerieren = async (liste, nurSortierung = false) => {
    try {
      for (let i = 0; i < liste.length; i++) {
        if ((liste[i].nr ?? 0) !== i + 1) {
          await invoke({ typ: 'schritt', aktion: 'update', schritt_id: liste[i].id, nr: i + 1 });
        }
      }
      await laden();
    } catch (e) {
      console.error(e);
      if (!nurSortierung) toast.error('Nummerierung fehlgeschlagen.');
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary';
  const figurSelectCls = 'px-2.5 py-2 rounded-lg bg-secondary border border-border text-xs text-white focus:outline-none focus:border-primary';

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Lade Tanzablauf…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Tanzablauf</h2>
        <span className="text-sm text-muted-foreground">{schritte.length} {schritte.length === 1 ? 'Schritt' : 'Schritte'}</span>
      </div>

      {canEdit && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Neuen Schritt anfügen:</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={neuText} onChange={e => setNeuText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && hinzufuegen()}
              placeholder="Beschreibung (z. B. Stern formieren, dann zurück in die Reihe)…"
              className={`${inputCls} flex-1`} />
            <select value={neuFigur} onChange={e => setNeuFigur(e.target.value)} className={figurSelectCls}>
              <option value="">Ohne Figur</option>
              {figuren.map(f => <option key={f.id} value={f.id}>Figur: {f.name}</option>)}
            </select>
            <button onClick={hinzufuegen} disabled={busy || !neuText.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 shrink-0">
              <Plus className="w-4 h-4" /> Anfügen
            </button>
          </div>
        </div>
      )}

      {schritte.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Der Tanzablauf ist noch leer.
          {canEdit && <span className="block mt-1">Füge oben den ersten Schritt hinzu.</span>}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {schritte.map((s, i) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3">
              <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {editId === s.id ? (
                  <div className="space-y-2">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2} className={inputCls} autoFocus />
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={editFigur} onChange={e => setEditFigur(e.target.value)} className={figurSelectCls}>
                        <option value="">Ohne Figur</option>
                        {figuren.map(f => <option key={f.id} value={f.id}>Figur: {f.name}</option>)}
                      </select>
                      <button onClick={() => speichern(s)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90"><Check className="w-3.5 h-3.5" /> Speichern</button>
                      <button onClick={() => setEditId(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{s.beschreibung}</p>
                    {s.figur_id && figurName(s.figur_id) && (
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[11px] text-white">
                        Figur: {figurName(s.figur_id)}
                      </span>
                    )}
                    {s.figur_id && einsatzpunkteFuerFigur(musikListe, s.figur_id).slice(0, 3).map((p, pi) => (
                      <button key={pi} onClick={() => onUebeMusik?.(p.musik.id, p.marker.zeit)}
                        className="mt-1 mr-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] text-white hover:border-primary"
                        title="Diesen Musik-Abschnitt im Musik-Tab üben">
                        <MusicIcon className="w-3 h-3 text-primary" /> {fmtZeit(p.marker.zeit)} · {p.musik.titel}
                      </button>
                    ))}
                  </>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button disabled={i === 0} onClick={() => verschieben(s, -1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white disabled:opacity-30" title="Nach vorne"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button disabled={i === schritte.length - 1} onClick={() => verschieben(s, 1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white disabled:opacity-30" title="Nach hinten"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setEditId(s.id); setEditText(s.beschreibung || ''); setEditFigur(s.figur_id || ''); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary" title="Bearbeiten"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => entfernen(s)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
