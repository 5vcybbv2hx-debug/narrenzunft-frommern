import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, CheckCircle2, Circle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * NachbereitungTab – Nachbesprechung einer Veranstaltung:
 * Pro Position gekauft / übrig / gefehlt erfassen, Notizen festhalten.
 * Der Abschluss ("Nachbesprechung abgeschlossen") entfernt die Veranstaltung
 * aus der Auto-TOP-Logik für die nächste Ausschusssitzung.
 */

const parseListe = (raw) => {
  try { return JSON.parse(raw || '[]') || []; } catch { return []; }
};

export default function NachbereitungTab({ veranstaltung, isAdmin, onVeranstaltungChange }) {
  const [bereiche, setBereiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [busy, setBusy] = useState(false);

  const canEdit = isAdmin;
  const abgeschlossen = veranstaltung?.nachbereitung_status === 'Abgeschlossen';

  useEffect(() => { loadData(); }, [veranstaltung?.id]);

  const loadData = async () => {
    if (!veranstaltung?.id) return;
    setLoading(true);
    try {
      const bs = await base44.entities.VeranstaltungBereich.filter({ veranstaltung_id: veranstaltung.id });
      bs.sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0) || (a.name || '').localeCompare(b.name || ''));
      setBereiche(bs.map(b => ({ ...b, liste: parseListe(b.liste) })));
    } catch (e) {
      console.error('Nachbereitung laden:', e);
    }
    setLoading(false);
  };

  const markDirty = (id) => setDirty(d => ({ ...d, [id]: true }));

  const patchPosition = (bereichId, idx, patch) => {
    setBereiche(bs => bs.map(b => {
      if (b.id !== bereichId) return b;
      const liste = b.liste.map((p, i) => i === idx ? { ...p, ...patch } : p);
      return { ...b, liste };
    }));
    markDirty(bereichId);
  };

  const patchBereich = (id, patch) => {
    setBereiche(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b));
    markDirty(id);
  };

  const saveBereich = async (bereich) => {
    setBusy(true);
    try {
      await base44.entities.VeranstaltungBereich.update(bereich.id, {
        liste: JSON.stringify(bereich.liste),
        nachher_notizen: bereich.nachher_notizen || undefined,
      });
      setDirty(d => ({ ...d, [bereich.id]: false }));
    } catch (e) {
      console.error('Nachbereitung speichern:', e);
    }
    setBusy(false);
  };

  const abschliessen = async () => {
    if (!confirm('Nachbesprechung als abgeschlossen markieren? Sie erscheint dann nicht mehr automatisch als TOP bei neuen Ausschusssitzungen.')) return;
    setBusy(true);
    try {
      await base44.entities.Veranstaltung.update(veranstaltung.id, { nachbereitung_status: 'Abgeschlossen' });
      onVeranstaltungChange?.({ nachbereitung_status: 'Abgeschlossen' });
    } catch (e) {
      console.error('Abschluss fehlgeschlagen:', e);
    }
    setBusy(false);
  };

  const wiederOeffnen = async () => {
    setBusy(true);
    try {
      await base44.entities.Veranstaltung.update(veranstaltung.id, { nachbereitung_status: 'Ausstehend' });
      onVeranstaltungChange?.({ nachbereitung_status: 'Ausstehend' });
    } catch (e) {
      console.error('Wiederöffnen fehlgeschlagen:', e);
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" /> Nachbereitung wird geladen...
      </div>
    );
  }

  const datumText = veranstaltung.datum
    ? (() => { try { return format(parseISO(veranstaltung.datum), 'EEEE, d. MMMM yyyy', { locale: de }); } catch { return veranstaltung.datum; } })()
    : '';

  const inputCls = 'w-full px-2 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary';

  return (
    <div className="space-y-4">
      {/* Status-Kopf */}
      <div className={`rounded-xl px-4 py-3 border ${abgeschlossen ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
        <div className="flex items-center gap-2">
          {abgeschlossen ? <CheckCircle2 size={16} className="text-green-400" /> : <Circle size={16} className="text-yellow-400" />}
          <p className="text-sm text-white flex-1">
            {abgeschlossen ? 'Nachbesprechung abgeschlossen' : 'Nachbesprechung noch offen'}{datumText && <span className="text-muted-foreground"> · {datumText}</span>}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {abgeschlossen
            ? 'Erfahrungen und Zahlen sind gespeichert und fließen beim nächsten Mal automatisch in die Planung ein.'
            : 'Offene Nachbesprechungen erscheinen automatisch als TOP, sobald eine neue Ausschusssitzung geplant wird.'}
        </p>
        {canEdit && (
          <button onClick={abgeschlossen ? wiederOeffnen : abschliessen} disabled={busy}
            className={`mt-2.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${abgeschlossen ? 'bg-secondary border border-border' : 'bg-green-600 hover:bg-green-500'}`}>
            {abgeschlossen ? 'Wieder öffnen' : 'Nachbesprechung abgeschlossen'}
          </button>
        )}
      </div>

      {bereiche.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-xl text-sm text-muted-foreground">
          Keine Bereiche angelegt – lege sie im Tab "Planung" an, um hier Zahlen zu erfassen.
        </div>
      )}

      {bereiche.map(bereich => (
        <div key={bereich.id} className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-oswald uppercase tracking-wide text-white text-base mb-3">
            {bereich.name}
            {bereich.verantwortlicher_name && <span className="text-muted-foreground font-sans text-sm tracking-normal"> · {bereich.verantwortlicher_name}</span>}
          </h3>

          {/* Planungs-Notizen zur Erinnerung */}
          {bereich.notizen && (
            <p className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">
              📋 {bereich.notizen}
            </p>
          )}

          {/* Positionen */}
          <div className="space-y-1.5">
            {bereich.liste.length === 0 && <p className="text-xs text-muted-foreground py-1">Keine Positionen in diesem Bereich.</p>}
            {bereich.liste.map((p, idx) => (
              <div key={idx} className="rounded-lg border border-border bg-secondary/40 p-2.5">
                <p className="text-sm text-white font-medium mb-2">
                  {p.artikel || '(ohne Namen)'}
                  {p.menge ? <span className="text-muted-foreground font-normal"> · geplant: {p.menge} {p.einheit || ''}</span> : null}
                </p>
                {canEdit ? (
                  <>
                    <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground block mb-0.5">Gekauft</label>
                        <input value={p.gekauft_menge || ''} inputMode="numeric"
                          onChange={e => patchPosition(bereich.id, idx, { gekauft_menge: e.target.value })}
                          className={inputCls} placeholder="–" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground block mb-0.5">Übrig</label>
                        <input value={p.uebrig_menge || ''} inputMode="numeric"
                          onChange={e => patchPosition(bereich.id, idx, { uebrig_menge: e.target.value })}
                          className={inputCls} placeholder="–" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase text-muted-foreground block mb-0.5">Gefehlt</label>
                        <input value={p.gefehlt_menge || ''} inputMode="numeric"
                          onChange={e => patchPosition(bereich.id, idx, { gefehlt_menge: e.target.value })}
                          className={inputCls} placeholder="–" />
                      </div>
                    </div>
                    <input value={p.notiz || ''} onChange={e => patchPosition(bereich.id, idx, { notiz: e.target.value })}
                      placeholder="Notiz (z.B. zu viel, Kinder waren weniger...)" className={inputCls} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {[p.gekauft_menge && `${p.gekauft_menge} gekauft`, p.uebrig_menge && `${p.uebrig_menge} übrig`, p.gefehlt_menge && `${p.gefehlt_menge} gefehlt`].filter(Boolean).join(' · ') || 'Keine Zahlen erfasst'}
                    {p.notiz && ` – ${p.notiz}`}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Bereichs-Fazit */}
          {canEdit ? (
            <textarea
              value={bereich.nachher_notizen || ''}
              onChange={e => patchBereich(bereich.id, { nachher_notizen: e.target.value })}
              placeholder="Fazit fürs nächste Jahr (z.B. weniger Cola, dafür mehr Pommes...)"
              rows={2}
              className={`${inputCls} mt-3`}
            />
          ) : bereich.nachher_notizen ? (
            <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">💡 {bereich.nachher_notizen}</p>
          ) : null}

          {canEdit && dirty[bereich.id] && (
            <button onClick={() => saveBereich(bereich)} disabled={busy}
              className="flex items-center gap-1.5 mt-2.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50">
              <Save size={13} /> {busy ? 'Speichert...' : 'Nachbereitung speichern'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
