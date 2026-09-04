import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Save, History, User, Loader2, ClipboardList } from 'lucide-react';
import MobileSelect from '@/components/MobileSelect';
import MitgliedLiveSuche from '@/components/MitgliedLiveSuche';
import { useAuth } from '@/lib/AuthContext';

/**
 * PlanungTab – Bereiche & Listen einer Veranstaltung (Einkauf, Getränke, ...).
 * Bereiche haben Verantwortliche, Status und Positionslisten.
 * "Aus letztem Jahr übernehmen" klont die Liste der Vorjahres-Veranstaltung
 * (gleiche Vorlage bzw. gleicher Titel) inkl. smarter Mengen-Empfehlung.
 */

const STATUSSE = ['Offen', 'In Planung', 'Erledigt'];
const STATUS_FARBEN = {
  'Offen': 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  'In Planung': 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'Erledigt': 'bg-green-500/15 text-green-400 border border-green-500/30',
};
const VORSCHLAEGE = ['Einkauf', 'Getränke', 'Deko', 'Technik', 'Musik', 'Sonstiges'];

const parseListe = (raw) => {
  try { return JSON.parse(raw || '[]') || []; } catch { return []; }
};
const normKey = (s) => (s || '').trim().toLowerCase();

// Smarte Menge: gekauft - übrig + gefehlt, sonst geplante Menge des Vorjahres
const smartMenge = (pos) => {
  const g = Number(pos.gekauft_menge);
  const u = Number(pos.uebrig_menge);
  const f = Number(pos.gefehlt_menge);
  if (g) return Math.max(0, g - (u || 0) + (f || 0));
  return pos.menge || '';
};

export default function PlanungTab({ veranstaltung, isAdmin }) {
  const [bereiche, setBereiche] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [vorjahr, setVorjahr] = useState(null); // { veranstaltung, bereicheByBereich }
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState({});
  const [neuBereich, setNeuBereich] = useState('');
  const [busy, setBusy] = useState(false);
  const [meinMitgliedId, setMeinMitgliedId] = useState(null);
  const { user } = useAuth();

  // Eigenes Mitgliedsprofil auflösen (für Bereichsverantwortliche)
  useEffect(() => {
    if (!user?.email || !mitglieder.length) return;
    const m = mitglieder.find(x => (x.email || '').toLowerCase() === (user.email || '').toLowerCase());
    setMeinMitgliedId(m?.id || null);
  }, [mitglieder, user?.email]);

  // Berechtigungen: Admin darf alles; Bereichsverantwortliche ihren eigenen Bereich
  const istMeinBereich = (b) => !!meinMitgliedId && b.verantwortlicher_id === meinMitgliedId;
  const kannBereichBearbeiten = (b) => isAdmin || istMeinBereich(b);

  useEffect(() => { loadData(); }, [veranstaltung?.id]);

  const loadData = async () => {
    if (!veranstaltung?.id) return;
    setLoading(true);
    try {
      const [bs, ms, alleVeranstaltungen] = await Promise.all([
        base44.entities.VeranstaltungBereich.filter({ veranstaltung_id: veranstaltung.id }),
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Veranstaltung.list('datum', 500),
      ]);
      bs.sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0) || (a.name || '').localeCompare(b.name || ''));
      setBereiche(bs.map(b => ({ ...b, liste: parseListe(b.liste) })));
      setMitglieder(ms);

      // Vorjahres-Veranstaltung finden (gleiche Vorlage, sonst gleicher Titel)
      const kandidaten = (alleVeranstaltungen || []).filter(v =>
        v.id !== veranstaltung.id && v.datum && veranstaltung.datum && v.datum < veranstaltung.datum
      );
      let vj = null;
      if (veranstaltung.vorlage_id) {
        vj = kandidaten.filter(v => v.vorlage_id === veranstaltung.vorlage_id)
          .sort((a, b) => b.datum.localeCompare(a.datum))[0];
      }
      if (!vj) {
        vj = kandidaten.filter(v => normKey(v.titel) === normKey(veranstaltung.titel))
          .sort((a, b) => b.datum.localeCompare(a.datum))[0];
      }
      if (vj) {
        const vjBereiche = await base44.entities.VeranstaltungBereich.filter({ veranstaltung_id: vj.id });
        const byName = {};
        vjBereiche.forEach(b => { byName[normKey(b.name)] = { ...b, liste: parseListe(b.liste) }; });
        setVorjahr({ veranstaltung: vj, byName });
      } else {
        setVorjahr(null);
      }
    } catch (e) {
      console.error('Planung laden:', e);
    }
    setLoading(false);
  };

  const markDirty = (id) => setDirty(d => ({ ...d, [id]: true }));

  const patchBereich = (id, patch) => {
    setBereiche(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b));
    markDirty(id);
  };

  const patchPosition = (bereichId, idx, patch) => {
    setBereiche(bs => bs.map(b => {
      if (b.id !== bereichId) return b;
      const liste = b.liste.map((p, i) => i === idx ? { ...p, ...patch } : p);
      return { ...b, liste };
    }));
    markDirty(bereichId);
  };

  const addPosition = (bereichId) => {
    setBereiche(bs => bs.map(b => {
      if (b.id !== bereichId) return b;
      return { ...b, liste: [...b.liste, { artikel: '', menge: '', einheit: '', notiz: '' }] };
    }));
    markDirty(bereichId);
  };

  const removePosition = (bereichId, idx) => {
    setBereiche(bs => bs.map(b => {
      if (b.id !== bereichId) return b;
      return { ...b, liste: b.liste.filter((_, i) => i !== idx) };
    }));
    markDirty(bereichId);
  };

  // Vorjahres-Liste übernehmen (mit smarter Mengen-Empfehlung)
  const uebernehmeVorjahr = (bereich) => {
    const vjB = vorjahr?.byName?.[normKey(bereich.name)];
    if (!vjB || !vjB.liste.length) return;
    setBereiche(bs => bs.map(b => {
      if (b.id !== bereich.id) return b;
      const vorhanden = new Set(b.liste.map(p => normKey(p.artikel)));
      const neue = vjB.liste
        .filter(p => p.artikel && !vorhanden.has(normKey(p.artikel)))
        .map(p => ({
          artikel: p.artikel,
          menge: smartMenge(p),
          einheit: p.einheit || '',
          notiz: p.notiz || '',
        }));
      return { ...b, liste: [...b.liste, ...neue] };
    }));
    markDirty(bereich.id);
  };

  const saveBereich = async (bereich) => {
    setBusy(true);
    try {
      await base44.entities.VeranstaltungBereich.update(bereich.id, {
        name: bereich.name,
        verantwortlicher_id: bereich.verantwortlicher_id || undefined,
        verantwortlicher_name: bereich.verantwortlicher_name || undefined,
        status: bereich.status,
        notizen: bereich.notizen || undefined,
        liste: JSON.stringify(bereich.liste),
      });
      setDirty(d => ({ ...d, [bereich.id]: false }));
    } catch (e) {
      console.error('Bereich speichern:', e);
    }
    setBusy(false);
  };

  const addBereich = async (name) => {
    if (!name?.trim()) return;
    setBusy(true);
    try {
      const neu = await base44.entities.VeranstaltungBereich.create({
        veranstaltung_id: veranstaltung.id,
        vorlage_id: veranstaltung.vorlage_id || undefined,
        name: name.trim(),
        status: 'Offen',
        sortierung: bereiche.length,
        liste: JSON.stringify([]),
      });
      setBereiche(bs => [...bs, { ...neu, liste: [] }]);
      setNeuBereich('');
    } catch (e) {
      console.error('Bereich anlegen:', e);
    }
    setBusy(false);
  };

  const deleteBereich = async (id) => {
    if (!confirm('Diesen Bereich inkl. Liste wirklich löschen?')) return;
    try {
      await base44.entities.VeranstaltungBereich.delete(id);
      setBereiche(bs => bs.filter(b => b.id !== id));
    } catch (e) { console.error('Bereich löschen:', e); }
  };

  const aktiveMitglieder = mitglieder.filter(m => m.status === 'Aktiv' || !m.status);

  const setVerantwortlicher = (bereich, m) => {
    patchBereich(bereich.id, {
      verantwortlicher_id: m?.id || undefined,
      verantwortlicher_name: m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : '',
    });
  };

  const vorjahrHint = (bereich, position) => {
    const vjB = vorjahr?.byName?.[normKey(bereich.name)];
    if (!vjB) return null;
    const vp = vjB.liste.find(p => normKey(p.artikel) === normKey(position.artikel));
    if (!vp) return null;
    const parts = [];
    if (vp.gekauft_menge) parts.push(`${vp.gekauft_menge} gekauft`);
    if (vp.uebrig_menge) parts.push(`${vp.uebrig_menge} übrig`);
    if (vp.gefehlt_menge) parts.push(`${vp.gefehlt_menge} gefehlt`);
    if (!parts.length) return vp.menge ? `Vorjahr: ${vp.menge} ${vp.einheit || ''}`.trim() : null;
    return `Vorjahr: ${parts.join(', ')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" /> Planung wird geladen...
      </div>
    );
  }

  const inputCls = 'w-full px-2.5 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary';

  return (
    <div className="space-y-4">
      {/* Vorjahr-Banner */}
      {vorjahr ? (
        <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
          <History size={16} className="text-primary shrink-0" />
          <p className="text-sm text-white">
            <span className="text-muted-foreground">Vorjahr gefunden: </span>
            <span className="font-semibold">{vorjahr.veranstaltung.titel}</span>
            <span className="text-muted-foreground"> ({vorjahr.veranstaltung.datum?.split('-').reverse().join('.')})</span>
          </p>
        </div>
      ) : (
        <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
          Keine Vorjahres-Veranstaltung gefunden – die Listen starten bei null. Ab dem nächsten Jahr greift automatisch die Übernahme.
        </div>
      )}

      {/* Bereiche */}
      {bereiche.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <ClipboardList size={28} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">Noch keine Bereiche – z.B. "Einkauf" oder "Getränke" anlegen</p>
          {isAdmin && VORSCHLAEGE.slice(0, 3).map(v => (
            <button key={v} onClick={() => addBereich(v)}
              className="mx-1 px-3 py-1.5 rounded-full bg-secondary border border-border text-xs text-white hover:bg-primary hover:border-primary transition-colors">
              + {v}
            </button>
          ))}
        </div>
      )}

      {bereiche.map(bereich => {
        const vjB = vorjahr?.byName?.[normKey(bereich.name)];
        return (
          <div key={bereich.id} className="bg-card border border-border rounded-xl p-4">
            {/* Kopf */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h3 className="font-oswald uppercase tracking-wide text-white text-base flex-1 min-w-[120px]">{bereich.name}</h3>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_FARBEN[bereich.status] || STATUS_FARBEN['Offen']}`}>
                {bereich.status}
              </span>
              {isAdmin && (
                <button onClick={() => deleteBereich(bereich.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Bereich löschen">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Verantwortlicher (Live-Suche) & Status-Wechsel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
              <div className="flex items-center gap-2">
                <User size={14} className="text-muted-foreground shrink-0" />
                {isAdmin ? (
                  <div className="flex-1 min-w-0">
                    <MitgliedLiveSuche
                      mitglieder={aktiveMitglieder}
                      value={bereich.verantwortlicher_name || ''}
                      onSelect={(m) => setVerantwortlicher(bereich, m)}
                      onClear={() => setVerantwortlicher(bereich, null)}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-white">
                    {bereich.verantwortlicher_name || '– Niemand –'}
                    {istMeinBereich(bereich) && <span className="text-primary text-xs ml-1.5">(du)</span>}
                  </span>
                )}
              </div>
              {kannBereichBearbeiten(bereich) && (
                <MobileSelect
                  value={bereich.status}
                  onChange={(v) => patchBereich(bereich.id, { status: v })}
                  options={STATUSSE}
                  label="Status"
                  className="text-sm"
                />
              )}
            </div>

            {/* Planungs-Notizen */}
            {kannBereichBearbeiten(bereich) ? (
              <textarea
                value={bereich.notizen || ''}
                onChange={e => patchBereich(bereich.id, { notizen: e.target.value })}
                placeholder="Planungs-Notizen (z.B. Einkaufsliste vom letzten Jahr liegt bei X...)"
                rows={2}
                className={`${inputCls} mb-3`}
              />
            ) : bereich.notizen ? (
              <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{bereich.notizen}</p>
            ) : null}

            {/* Liste */}
            <div className="space-y-1.5">
              {bereich.liste.map((p, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-secondary/40 p-2">
                  <div className="flex items-center gap-1.5">
                    {kannBereichBearbeiten(bereich) ? (
                      <>
                        <input value={p.artikel} onChange={e => patchPosition(bereich.id, idx, { artikel: e.target.value })}
                          placeholder="Artikel" className={`${inputCls} flex-[2_1_0%] min-w-0`} />
                        <input value={p.menge} onChange={e => patchPosition(bereich.id, idx, { menge: e.target.value })}
                          placeholder="Menge" inputMode="numeric" className={`${inputCls} w-16 sm:w-20`} />
                        <input value={p.einheit} onChange={e => patchPosition(bereich.id, idx, { einheit: e.target.value })}
                          placeholder="Einheit" className={`${inputCls} w-16 sm:w-20`} />
                        <button onClick={() => removePosition(bereich.id, idx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Position löschen">
                          <Trash2 size={13} />
                        </button>
                      </>
                    ) : (
                      <span className="text-sm text-white">
                        {p.artikel}{p.menge ? ` · ${p.menge} ${p.einheit || ''}` : ''}
                      </span>
                    )}
                  </div>
                  {vorjahrHint(bereich, p) && (
                    <p className="text-xs text-primary/90 mt-1.5 pl-1">{vorjahrHint(bereich, p)}</p>
                  )}
                </div>
              ))}

              {bereich.liste.length === 0 && (
                <p className="text-xs text-muted-foreground py-1">Noch keine Positionen.</p>
              )}
            </div>

            {/* Aktionen */}
            {kannBereichBearbeiten(bereich) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button onClick={() => addPosition(bereich.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-white hover:border-primary/50">
                  <Plus size={13} /> Position
                </button>
                {vjB && vjB.liste.length > 0 && (
                  <button onClick={() => uebernehmeVorjahr(bereich)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/40 text-xs text-white hover:bg-primary/25">
                    <History size={13} /> Aus letztem Jahr übernehmen ({vjB.liste.length})
                  </button>
                )}
                {dirty[bereich.id] && (
                  <button onClick={() => saveBereich(bereich)} disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50 ml-auto">
                    <Save size={13} /> {busy ? 'Speichert...' : 'Speichern'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Neuer Bereich */}
      {isAdmin && bereiche.length > 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Bereich hinzufügen</p>
          <div className="flex gap-2">
            <input value={neuBereich} onChange={e => setNeuBereich(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addBereich(neuBereich)}
              placeholder="z.B. Einkauf, Getränke, Deko..." className={inputCls} />
            <button onClick={() => addBereich(neuBereich)} disabled={!neuBereich.trim() || busy}
              className="px-3 rounded-lg bg-primary text-white disabled:opacity-50 shrink-0">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {VORSCHLAEGE.map(v => (
              <button key={v} onClick={() => addBereich(v)}
                className="px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-muted-foreground hover:text-white hover:border-primary/40">
                + {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
