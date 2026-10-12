import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Filter, ChevronDown, Save, Loader2 } from 'lucide-react';

const STATUS_STYLES = {
  'Offen': 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  'In Bearbeitung': 'bg-blue-900/20 text-blue-400 border border-blue-700/30',
  'Erledigt': 'bg-green-900/20 text-green-400 border border-green-700/30',
};

const STATUS_ORDER = ['Offen', 'In Bearbeitung', 'Erledigt'];

/**
 * FaelleSektion – verwaltet DatenqualitaetFall-Einträge auf der Datenqualitäts-Seite.
 *
 * Lädt alle Fälle, bietet Filter nach Kategorie und Status (Standard: nur
 * Offen + In Bearbeitung) und erlaubt Status-Wechsel sowie Notiz-Bearbeitung
 * pro Fall-Karte. Meldet die Anzahl offener Fälle an die Eltern-Seite.
 */
export default function FaelleSektion({ onOpenCountChange }) {
  const [faelle, setFaelle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter: Standard = nur Offen + In Bearbeitung
  const [statusFilter, setStatusFilter] = useState('aktiv');
  const [kategorieFilter, setKategorieFilter] = useState('alle');

  // Notiz-Bearbeitung
  const [editNotizen, setEditNotizen] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [statusChangeId, setStatusChangeId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.entities.DatenqualitaetFall.filter({}, { sort: '-created_date', limit: 500 });
      const items = res.items || res || [];
      setFaelle(items);
      const offen = items.filter(f => f.status !== 'Erledigt').length;
      onOpenCountChange?.(offen);
    } catch (e) {
      console.error('Fälle laden:', e);
      setError('Fälle konnten nicht geladen werden.');
    }
    setLoading(false);
  }, [onOpenCountChange]);

  useEffect(() => { loadData(); }, [loadData]);

  // Kategorien für Filter-Dropdown ermitteln
  const kategorien = ['alle', ...Array.from(new Set(faelle.map(f => f.kategorie).filter(Boolean)))];

  const gefiltert = faelle.filter(f => {
    if (kategorieFilter !== 'alle' && f.kategorie !== kategorieFilter) return false;
    if (statusFilter === 'aktiv' && f.status === 'Erledigt') return false;
    if (statusFilter !== 'aktiv' && statusFilter !== 'alle' && f.status !== statusFilter) return false;
    return true;
  });

  const cycleStatus = async (fall) => {
    const idx = STATUS_ORDER.indexOf(fall.status || 'Offen');
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setStatusChangeId(fall.id);
    try {
      const updated = await base44.entities.DatenqualitaetFall.update(fall.id, { status: next });
      setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, ...updated } : f));
      const offen = faelle.filter(f => f.id !== fall.id && f.status !== 'Erledigt').length + (next !== 'Erledigt' ? 1 : 0);
      onOpenCountChange?.(offen);
    } catch (e) {
      console.error('Status ändern:', e);
    }
    setStatusChangeId(null);
  };

  const saveNotiz = async (fall) => {
    const text = editNotizen[fall.id] ?? fall.notizen ?? '';
    setSavingId(fall.id);
    try {
      const updated = await base44.entities.DatenqualitaetFall.update(fall.id, { notizen: text });
      setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, ...updated } : f));
      setEditNotizen(prev => { const c = { ...prev }; delete c[fall.id]; return c; });
    } catch (e) {
      console.error('Notiz speichern:', e);
    }
    setSavingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Sektionskopf */}
      <div className="flex items-center gap-2 mb-1">
        <FolderOpen size={18} className="text-primary" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-foreground">Offene Fälle</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Manuell erfasste Datenqualitäts-Fälle (z.B. Familienzuordnungen)
      </p>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-muted-foreground" />
        {/* Status-Filter */}
        <div className="flex items-center gap-1">
          {['aktiv', 'alle', 'Offen', 'In Bearbeitung', 'Erledigt'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'aktiv' ? 'Offen + In Bearb.' : s === 'alle' ? 'Alle' : s}
            </button>
          ))}
        </div>
        {/* Kategorie-Filter (nur wenn > 1 Kategorie) */}
        {kategorien.length > 2 && (
          <select
            value={kategorieFilter}
            onChange={e => setKategorieFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary"
          >
            {kategorien.map(k => (
              <option key={k} value={k}>{k === 'alle' ? 'Alle Kategorien' : k}</option>
            ))}
          </select>
        )}
      </div>

      {/* Fall-Liste */}
      {gefiltert.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Keine Fälle in diesem Filter.
        </div>
      ) : (
        <div className="space-y-3">
          {gefiltert.map(fall => {
            const status = fall.status || 'Offen';
            const notizWert = editNotizen[fall.id] ?? fall.notizen ?? '';
            const notizDirty = editNotizen[fall.id] !== undefined && editNotizen[fall.id] !== (fall.notizen ?? '');
            return (
              <div key={fall.id} className="bg-card border border-border rounded-xl p-4">
                {/* Titel + Badges */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{fall.titel}</h3>
                    {fall.kategorie && (
                      <span className="inline-block mt-1 text-[11px] font-medium bg-primary/10 text-primary border border-primary/25 rounded-full px-2 py-0.5">
                        {fall.kategorie}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => cycleStatus(fall)}
                    disabled={statusChangeId === fall.id}
                    className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${STATUS_STYLES[status]}`}
                    title="Klicken zum Wechseln: Offen → In Bearbeitung → Erledigt"
                  >
                    {statusChangeId === fall.id ? '…' : status}
                  </button>
                </div>

                {/* Beschreibung */}
                {fall.beschreibung && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line mb-3">{fall.beschreibung}</p>
                )}

                {/* Notiz-Feld */}
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Bearbeitungsvermerke</label>
                    {notizDirty && (
                      <button
                        onClick={() => saveNotiz(fall)}
                        disabled={savingId === fall.id}
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                      >
                        {savingId === fall.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Speichern
                      </button>
                    )}
                  </div>
                  <textarea
                    value={notizWert}
                    onChange={e => setEditNotizen(prev => ({ ...prev, [fall.id]: e.target.value }))}
                    onBlur={() => { if (!notizDirty) setEditNotizen(prev => { const c = { ...prev }; delete c[fall.id]; return c; }); }}
                    placeholder="Notizen des Vorstands…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-y min-h-[44px]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}