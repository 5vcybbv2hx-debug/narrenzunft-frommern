import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { UserCheck, Plus, X, Pencil, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MitgliedLiveSuche from '@/components/MitgliedLiveSuche';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

/**
 * TeilnehmerTab – Verwaltung der Teilnehmer:innen einer Tanzgruppe
 * (z. B. Hexentanz). Auswählbar sind ALLE Zunftmitglieder, pro Teilnehmer:in
 * gibt es eine freie Position/Rolle (z. B. „Vortänzerin", „Reihe 1").
 *
 * Lesen darf jeder, der die Gruppe öffnen darf. Schreiben (Hinzufügen,
 * Position ändern, Pausieren, Entfernen) dürfen Vorstand/Stellv./Admin und
 * ALLE Verantwortlichen der Gruppe (canEdit-Prop, gespiegelt aus
 * gruppe.verantwortliche_ids) — läuft aus RLS-Gründen über die sichere
 * Backend-Function 'verwalteGruppenTeilnehmer'.
 */
const POSITION_SUGGESTIONS = ['Vortänzer:in', 'Reihe 1', 'Reihe 2', 'Reihe 3', 'Solo', 'Musik'];

export default function TeilnehmerTab({ gruppeId, alleMitglieder, canEdit }) {
  const [teilnehmer, setTeilnehmer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auswahl, setAuswahl] = useState(null); // gewähltes Mitglied beim Hinzufügen
  const [positionDraft, setPositionDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null); // Inline-Edit der Position
  const [editPos, setEditPos] = useState('');

  const laden = async () => {
    try {
      const t = await base44.entities.GruppenTeilnehmer.filter({ haesgruppe_id: gruppeId });
      setTeilnehmer(t || []);
    } catch (e) {
      console.error(e);
      toast.error('Teilnehmer:innen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gruppeId) laden();
  }, [gruppeId]);

  const mitgliedVon = useMemo(() => {
    const map = new Map();
    (alleMitglieder || []).forEach(m => map.set(m.id, m));
    return (id) => map.get(id);
  }, [alleMitglieder]);

  const bereitsDabei = useMemo(
    () => new Set((teilnehmer || []).map(t => t.mitglied_id)),
    [teilnehmer]
  );

  // Zum Hinzufügen suchen: alle Zunftmitglieder außer archivierten und bereits Eingetragenen
  const suchbare = useMemo(
    () => (alleMitglieder || []).filter(m => !m.archiviert && !bereitsDabei.has(m.id)),
    [alleMitglieder, bereitsDabei]
  );

  const sortierte = useMemo(() => {
    const nameVon = (t) => {
      const m = mitgliedVon(t.mitglied_id);
      return `${m?.nachname || ''} ${m?.vorname || ''}`.trim();
    };
    return [...(teilnehmer || [])].sort((a, b) => {
      const aPause = a.aktiv === false ? 1 : 0;
      const bPause = b.aktiv === false ? 1 : 0;
      if (aPause !== bPause) return aPause - bPause;
      return nameVon(a).localeCompare(nameVon(b), 'de');
    });
  }, [teilnehmer, mitgliedVon]);

  const aktivCount = (teilnehmer || []).filter(t => t.aktiv !== false).length;

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('verwalteGruppenTeilnehmer', payload);
    return res?.data || res;
  };

  const hinzufuegen = async () => {
    if (!auswahl) return;
    setBusy(true);
    try {
      const data = await invoke({
        aktion: 'add',
        haesgruppe_id: gruppeId,
        mitglied_id: auswahl.id,
        position: positionDraft.trim(),
      });
      if (data?.error) throw new Error(data.error);
      setTeilnehmer(v => [...(v || []), data.teilnehmer]);
      setAuswahl(null);
      setPositionDraft('');
      toast.success(`${auswahl.vorname || ''} ${auswahl.nachname || ''}`.trim() + ' als Teilnehmer:in hinzugefügt.');
    } catch (e) {
      toast.error(e.message || 'Hinzufügen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const positionSpeichern = async (t) => {
    const neu = editPos.trim();
    setEditId(null);
    if (neu === (t.position || '')) return;
    try {
      const data = await invoke({ aktion: 'update', haesgruppe_id: gruppeId, teilnehmer_id: t.id, position: neu });
      if (data?.error) throw new Error(data.error);
      setTeilnehmer(v => v.map(x => (x.id === t.id ? { ...x, position: neu } : x)));
      toast.success('Position gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    }
  };

  const aktivUmschalten = async (t) => {
    const neuerZustand = t.aktiv === false; // pausiert → aktiv, aktiv → pausiert
    try {
      const data = await invoke({ aktion: 'update', haesgruppe_id: gruppeId, teilnehmer_id: t.id, aktiv: neuerZustand });
      if (data?.error) throw new Error(data.error);
      setTeilnehmer(v => v.map(x => (x.id === t.id ? { ...x, aktiv: neuerZustand } : x)));
      toast.success(neuerZustand ? 'Teilnehmer:in wieder aktiv.' : 'Teilnehmer:in pausiert.');
    } catch (e) {
      toast.error(e.message || 'Änderung fehlgeschlagen.');
    }
  };

  const entfernen = async (t) => {
    const m = mitgliedVon(t.mitglied_id);
    const name = `${m?.vorname || ''} ${m?.nachname || ''}`.trim() || 'Teilnehmer:in';
    if (!(await confirmDialog(`${name} als Teilnehmer:in entfernen?`))) return;
    try {
      const data = await invoke({ aktion: 'remove', haesgruppe_id: gruppeId, teilnehmer_id: t.id });
      if (data?.error) throw new Error(data.error);
      setTeilnehmer(v => v.filter(x => x.id !== t.id));
      toast.success(name + ' entfernt.');
    } catch (e) {
      toast.error(e.message || 'Entfernen fehlgeschlagen.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Teilnehmer:innen</h2>
        {!loading && (
          <span className="text-sm text-muted-foreground">
            {aktivCount} aktiv{teilnehmer.length > aktivCount ? ` · ${teilnehmer.length - aktivCount} pausiert` : ''}
          </span>
        )}
      </div>

      {/* Hinzufügen (nur Bearbeiter) */}
      {canEdit && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <UserCheck className="w-4 h-4 text-primary" /> Teilnehmer:in hinzufügen
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <MitgliedLiveSuche
              mitglieder={suchbare}
              value={auswahl ? `${auswahl.vorname || ''} ${auswahl.nachname || ''}`.trim() : ''}
              onSelect={m => setAuswahl(m)}
              onClear={() => setAuswahl(null)}
              placeholder="Mitglied suchen (alle Zunftmitglieder wählbar)..."
            />
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Position / Rolle (optional)</label>
              <input
                list="position-vorschlaege"
                value={positionDraft}
                onChange={e => setPositionDraft(e.target.value)}
                placeholder="z. B. Vortänzer:in, Reihe 1"
                className="w-full px-2.5 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary"
              />
              <datalist id="position-vorschlaege">
                {POSITION_SUGGESTIONS.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <button
              onClick={hinzufuegen}
              disabled={!auswahl || busy}
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Lade Teilnehmer:innen…</div>
      ) : sortierte.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Noch keine Teilnehmer:innen ausgewählt.
          {canEdit && <span className="block mt-1">Oben über die Suche Mitglieder hinzufügen.</span>}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          {sortierte.map(t => {
            const m = mitgliedVon(t.mitglied_id);
            const name = `${m?.vorname || ''} ${m?.nachname || ''}`.trim() || 'Unbekanntes Mitglied';
            const pausiert = t.aktiv === false;
            return (
              <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${pausiert ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{name}</span>
                    {m?.status && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-secondary text-muted-foreground">
                        {m.status}
                      </span>
                    )}
                    {pausiert && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                        Pausiert
                      </span>
                    )}
                  </div>
                  {/* Position: Inline-Anzeige, per Stift bearbeitbar */}
                  {editId === t.id ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <input
                        autoFocus
                        list="position-vorschlaege"
                        value={editPos}
                        onChange={e => setEditPos(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') positionSpeichern(t);
                          if (e.key === 'Escape') setEditId(null);
                        }}
                        className="flex-1 px-2 py-1 rounded-lg bg-secondary border border-border text-xs text-white focus:outline-none focus:border-primary"
                      />
                      <button onClick={() => positionSpeichern(t)} className="p-1.5 rounded-lg text-primary hover:bg-primary/10" title="Speichern">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5">
                      {t.position ? (
                        <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[11px] text-white">
                          {t.position}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Keine Position</span>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => { setEditId(t.id); setEditPos(t.position || ''); }}
                          className="p-1 rounded text-muted-foreground hover:text-primary"
                          title="Position bearbeiten"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => aktivUmschalten(t)}
                      className="px-2 py-1 rounded-lg text-[11px] border border-border text-muted-foreground hover:text-white hover:border-primary"
                      title={pausiert ? 'Wieder aktivieren' : 'Pausieren (nimmt vorläufig nicht teil)'}
                    >
                      {pausiert ? 'Aktivieren' : 'Pausieren'}
                    </button>
                    <button
                      onClick={() => entfernen(t)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      title="Entfernen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
