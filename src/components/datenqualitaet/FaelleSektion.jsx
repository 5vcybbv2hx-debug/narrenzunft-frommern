import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { FolderOpen, Search, Loader2, Check } from 'lucide-react';

const STATUS_STYLES = {
  'Offen': 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  'In Bearbeitung': 'bg-blue-900/20 text-blue-400 border border-blue-700/30',
  'Erledigt': 'bg-green-900/20 text-green-400 border border-green-700/30',
};

const STATUS_ACTIVE_STYLES = {
  'Offen': 'bg-yellow-500 text-black border border-yellow-400',
  'In Bearbeitung': 'bg-blue-500 text-black border border-blue-400',
  'Erledigt': 'bg-green-500 text-black border border-green-400',
};

const STATUS_ORDER = ['Offen', 'In Bearbeitung', 'Erledigt'];
const STATUS_SHORT = { 'Offen': 'Offen', 'In Bearbeitung': 'In Bearb.', 'Erledigt': 'Erledigt' };

/**
 * FaelleSektion – verwaltet DatenqualitaetFall-Einträge auf der Datenqualitäts-Seite.
 *
 * Mobile-first: Live-Suche, große Tap-Targets für Status-Wechsel (3-Button-
 * Segment-Steuerung), Auto-Save für Notizen beim Verlassen des Felds.
 */
export default function FaelleSektion({ onOpenCountChange }) {
  const [faelle, setFaelle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter: Standard = nur Offen + In Bearbeitung
  const [statusFilter, setStatusFilter] = useState('aktiv');
  const [suche, setSuche] = useState('');

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

  const gefiltert = faelle.filter(f => {
    // Status-Filter
    if (statusFilter === 'aktiv' && f.status === 'Erledigt') return false;
    if (statusFilter !== 'aktiv' && statusFilter !== 'alle' && f.status !== statusFilter) return false;
    // Such-Filter
    if (suche.trim()) {
      const q = suche.toLowerCase();
      const haystack = `${f.titel || ''} ${f.beschreibung || ''} ${f.notizen || ''} ${f.kategorie || ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const recalcOffen = (list, excludeId, newStatus) => {
    const offen = list.filter(f => f.id !== excludeId && f.status !== 'Erledigt').length + (newStatus !== 'Erledigt' ? 1 : 0);
    onOpenCountChange?.(offen);
  };

  const setStatus = async (fall, neuerStatus) => {
    if (neuerStatus === fall.status) return;
    setStatusChangeId(fall.id);
    try {
      const updated = await base44.entities.DatenqualitaetFall.update(fall.id, { status: neuerStatus });
      setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, ...updated } : f));
      recalcOffen(faelle, fall.id, neuerStatus);
    } catch (e) {
      console.error('Status ändern:', e);
    }
    setStatusChangeId(null);
  };

  const saveNotiz = async (fall) => {
    const text = editNotizen[fall.id] ?? fall.notizen ?? '';
    if (text === (fall.notizen ?? '')) {
      setEditNotizen(prev => { const c = { ...prev }; delete c[fall.id]; return c; });
      return;
    }
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
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-foreground">Fälle</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Manuell erfasste Datenqualitäts-Fälle (z.B. Familienzuordnungen)
      </p>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Live-Suche */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={suche}
          onChange={e => setSuche(e.target.value)}
          placeholder="Fälle durchsuchen…"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary min-h-[48px]"
        />
      </div>

      {/* Status-Filter (horizontal scrollbar) */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {[
          { key: 'aktiv', label: 'Offen + In Bearb.' },
          { key: 'alle', label: 'Alle' },
          { key: 'Offen', label: 'Offen' },
          { key: 'In Bearbeitung', label: 'In Bearb.' },
          { key: 'Erledigt', label: 'Erledigt' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[40px] ${
              statusFilter === s.key
                ? 'bg-primary text-white'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Fall-Liste */}
      {gefiltert.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {suche ? 'Keine Fälle gefunden.' : 'Keine Fälle in diesem Filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {gefiltert.map(fall => {
            const status = fall.status || 'Offen';
            const notizWert = editNotizen[fall.id] ?? fall.notizen ?? '';
            const notizDirty = editNotizen[fall.id] !== undefined && editNotizen[fall.id] !== (fall.notizen ?? '');
            const saving = savingId === fall.id;
            return (
              <div key={fall.id} className="bg-card border border-border rounded-xl p-4">
                {/* Titel + Kategorie */}
                <div className="mb-2">
                  <h3 className="text-sm font-semibold text-foreground">{fall.titel}</h3>
                  {fall.kategorie && (
                    <span className="inline-block mt-1 text-[11px] font-medium bg-primary/10 text-primary border border-primary/25 rounded-full px-2 py-0.5">
                      {fall.kategorie}
                    </span>
                  )}
                </div>

                {/* Beschreibung */}
                {fall.beschreibung && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line mb-3">{fall.beschreibung}</p>
                )}

                {/* Status: 3-Button Segment-Steuerung (große Tap-Targets) */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {STATUS_ORDER.map(s => {
                    const isActive = status === s;
                    const isChanging = statusChangeId === fall.id;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(fall, s)}
                        disabled={isChanging}
                        className={`py-2.5 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 min-h-[44px] ${
                          isActive ? STATUS_ACTIVE_STYLES[s] : 'bg-secondary text-muted-foreground border border-border'
                        }`}
                      >
                        {isChanging && isActive ? '…' : STATUS_SHORT[s]}
                      </button>
                    );
                  })}
                </div>

                {/* Notiz-Feld mit Auto-Save on Blur */}
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Bearbeitungsvermerke</label>
                    {saving && <Loader2 size={12} className="text-primary animate-spin" />}
                    {notizDirty && !saving && (
                      <button
                        onClick={() => saveNotiz(fall)}
                        className="flex items-center gap-1 text-xs font-bold text-primary px-3 py-1.5 rounded-lg bg-primary/10 active:scale-95 transition-all min-h-[36px]"
                      >
                        <Check size={12} /> Speichern
                      </button>
                    )}
                  </div>
                  <textarea
                    value={notizWert}
                    onChange={e => setEditNotizen(prev => ({ ...prev, [fall.id]: e.target.value }))}
                    onBlur={() => saveNotiz(fall)}
                    placeholder="Notizen des Vorstands…"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary resize-y min-h-[48px]"
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