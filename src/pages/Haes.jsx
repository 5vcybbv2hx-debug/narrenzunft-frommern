import { useState, useEffect, useCallback } from 'react';
// Builder-Test
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Shirt, Plus, Search, ChevronRight, Calendar, Building, User } from 'lucide-react';
import HaesGroupTokenModal from '@/components/haes/HaesGroupTokenModal';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { isAdmin } from '@/lib/roles';
import { toast } from 'sonner';

const STATUS_COLORS = {
  'Aktiv': 'bg-green-500/20 text-green-400',
  'Verliehen': 'bg-blue-500/20 text-blue-400',
  'Verkauft': 'bg-gray-500/20 text-gray-400',
  'Frei': 'bg-yellow-500/20 text-yellow-400',
  'Stillgelegt': 'bg-red-500/20 text-red-400',
};

export default function Haes() {
  const { user } = useAuth();
  const [haes, setHaes] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'Alle');
  const [gruppeFilter, setGruppeFilter] = useState(searchParams.get('gruppe') || 'Alle');
  const [loading, setLoading] = useState(true);
  const [showNewGruppe, setShowNewGruppe] = useState(false);
  const [showNewHaes, setShowNewHaes] = useState(false);
  const [newGruppe, setNewGruppe] = useState({ name: '', beschreibung: '' });
  const [newHaes, setNewHaes] = useState({ haesnummer: '', haesgruppe_id: '', bezeichnung: '', status: 'Frei' });
  const [selectedGruppeToken, setSelectedGruppeToken] = useState(null);
  const isAdminUser = isAdmin(user);

  useEffect(() => {
    loadData();
  }, []);

  // Filter-Persistenz via URL-Parameter
  useEffect(() => {
    const params = {};
    if (statusFilter !== 'Alle') params.status = statusFilter;
    if (gruppeFilter !== 'Alle') params.gruppe = gruppeFilter;
    if (search) params.q = search;
    setSearchParams(params, { replace: true });
  }, [statusFilter, gruppeFilter, search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getHaesSicher', {});
      if (!result.data.erfolg) {
        setLoading(false);
        return;
      }
      setHaes(result.data.haes);
      setGruppen(result.data.gruppen);
      setMitglieder(result.data.mitglieder || []);
    } catch (e) {
      console.error('[Haes]', e instanceof Error ? e.message : e);
    }
    setLoading(false);
  }, []);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(loadData);

  const getMitgliedName = (id, h) => {
    if (h?.besitzer_name) return h.besitzer_name;
    const m = (mitglieder || []).find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const getGruppeName = (id) => {
    const g = gruppen.find(g => g.id === id);
    return g ? g.name : '–';
  };

  const gruppeMap = {};
  gruppen.forEach(g => { gruppeMap[g.id] = g; });

  const handleCreateGruppe = async () => {
    try {
      await base44.entities.Haesgruppe.create(newGruppe);
      setNewGruppe({ name: '', beschreibung: '' });
      setShowNewGruppe(false);
      toast.success('Gruppe erstellt');
      loadData();
    } catch (e) {
      console.error('Gruppe erstellen:', e);
      toast.error('Gruppe konnte nicht erstellt werden');
    }
  };

  const handleCreateHaes = async () => {
    try {
      await base44.entities.Haes.create(newHaes);
      setNewHaes({ haesnummer: '', haesgruppe_id: '', bezeichnung: '', status: 'Frei' });
      setShowNewHaes(false);
      toast.success('Häs erstellt');
      loadData();
    } catch (e) {
      console.error('Häs erstellen:', e);
      toast.error('Häs konnte nicht erstellt werden');
    }
  };

  const filtered = haes.filter(h => {
    if (statusFilter !== 'Alle' && h.status !== statusFilter) return false;
    if (gruppeFilter !== 'Alle' && h.haesgruppe_id !== gruppeFilter) return false;
    if (search) {
      return h.haesnummer?.includes(search) ||
        h.bezeichnung?.toLowerCase().includes(search.toLowerCase()) ||
        (h.besitzer_name || '').toLowerCase().includes(search.toLowerCase());
    }
    return true;
  }).sort((a, b) => {
    const aNum = parseInt(a.haesnummer) || 9999;
    const bNum = parseInt(b.haesnummer) || 9999;
    return aNum - bNum;
  });

  // Stats
  const stats = {
    gesamt:      haes.length,
    aktiv:       haes.filter(h => h.status === 'Aktiv').length,
    verliehen:   haes.filter(h => h.status === 'Verliehen').length,
    frei:        haes.filter(h => h.status === 'Frei').length,
    verkauft:    haes.filter(h => h.status === 'Verkauft').length,
    stillgelegt: haes.filter(h => h.status === 'Stillgelegt').length,
  };

  if (!loading && haes.length === 0 && !haes) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <p className="text-sm text-muted-foreground">Häs konnten nicht geladen werden</p>
      <button onClick={() => loadData()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
        Erneut versuchen
      </button>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Häs wird geladen…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl mx-auto overflow-x-hidden">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Häs & Masken</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{haes.length} Häs gesamt</p>
        </div>
        {isAdminUser && (
          <div className="flex gap-2 ml-auto">

            <button
              onClick={() => setShowNewGruppe(true)}
              className="flex items-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-border transition-colors"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Gruppe</span>
            </button>
            <button
              onClick={() => setShowNewHaes(true)}
              className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Häs
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {[
          { label: 'Gesamt',      value: stats.gesamt,      color: 'text-foreground',  filter: 'Alle' },
          { label: 'Aktiv',       value: stats.aktiv,       color: 'text-green-400',   filter: 'Aktiv' },
          { label: 'Verliehen',   value: stats.verliehen,   color: 'text-blue-400',    filter: 'Verliehen' },
          { label: 'Frei',        value: stats.frei,        color: 'text-yellow-400',  filter: 'Frei' },
          { label: 'Verkauft',    value: stats.verkauft,    color: 'text-gray-400',    filter: 'Verkauft' },
          { label: 'Stillgelegt', value: stats.stillgelegt, color: 'text-red-400',     filter: 'Stillgelegt' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.filter)}
            className={`bg-card border rounded-lg p-2.5 text-center transition-all hover:border-primary/40 ${statusFilter === s.filter ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
          >
            <p className={`text-lg font-oswald font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Gruppen */}
      {gruppen.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
          <button
            onClick={() => setGruppeFilter('Alle')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${gruppeFilter === 'Alle' ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'}`}
          >
            Alle Gruppen
          </button>
          {gruppen.map(g => {
            const count = haes.filter(h => h.haesgruppe_id === g.id).length;
            return (
            <div key={g.id} className="flex-shrink-0 relative group">
              <button
                onClick={() => setGruppeFilter(g.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${gruppeFilter === g.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'}`}
              >
                {g.name}
                <span className={`text-[10px] font-bold px-1 rounded-full ${gruppeFilter === g.id ? 'bg-white/20' : 'bg-secondary'}`}>{count}</span>
              </button>
              {isAdminUser && (
                <button
                  onClick={() => setSelectedGruppeToken(g)}
                  title="Kalender-Feed"
                  className="absolute -right-1 -top-1 p-1 rounded-lg bg-primary text-white hover:bg-primary/90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10"
                >
                  <Calendar size={12} />
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Häsnummer, Bezeichnung, Besitzer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Häs Liste */}
      <div className="space-y-2">
        {filtered.map(h => (
          <Link key={h.id} to={`/haes/${h.id}`} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/50 transition-all group" style={{ borderLeft: h.haesgruppe_id && gruppeMap[h.haesgruppe_id]?.farbe ? `3px solid ${gruppeMap[h.haesgruppe_id].farbe}` : undefined }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={h.haesgruppe_id && gruppeMap[h.haesgruppe_id]?.farbe ? { backgroundColor: gruppeMap[h.haesgruppe_id].farbe + '20' } : undefined}>
              <Shirt size={18} style={{ color: h.haesgruppe_id && gruppeMap[h.haesgruppe_id]?.farbe ? gruppeMap[h.haesgruppe_id].farbe : undefined }} className={h.haesgruppe_id && gruppeMap[h.haesgruppe_id]?.farbe ? '' : 'text-primary'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-mono font-bold text-primary text-sm">#{h.haesnummer}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status]}`}>{h.status}</span>
                {h.vereinseigentum && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium flex items-center gap-1">
                    <Building size={10} /> Verein
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground truncate">{h.bezeichnung || '–'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {h.haesgruppe_id && <span className="truncate">{getGruppeName(h.haesgruppe_id)}</span>}
                {h.aktueller_besitzer_id && (
                  <span className="flex items-center gap-1 truncate min-w-0">
                    <User size={11} className="shrink-0 text-primary/70" />
                    <span className="truncate">{h.besitzer_name || '–'}</span>
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Shirt size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">Keine Häs gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? `Für „${search}" wurde kein Häs gefunden` : 'In dieser Kategorie sind keine Häs vorhanden'}
          </p>
          {(search || statusFilter !== 'Alle' || gruppeFilter !== 'Alle') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('Alle'); setGruppeFilter('Alle'); }}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* New Gruppe Modal */}
      {showNewGruppe && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-oswald font-semibold text-foreground mb-4 tracking-wide">Neue Häsgruppe</h3>
            <input
              type="text"
              placeholder="Name der Gruppe"
              value={newGruppe.name}
              onChange={e => setNewGruppe(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary mb-3"
            />
            <input
              type="text"
              placeholder="Beschreibung (optional)"
              value={newGruppe.beschreibung}
              onChange={e => setNewGruppe(p => ({ ...p, beschreibung: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewGruppe(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button onClick={handleCreateGruppe} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold">Erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* New Häs Modal */}
      {showNewHaes && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-oswald font-semibold text-foreground mb-4 tracking-wide">Neues Häs</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Häsnummer *"
                value={newHaes.haesnummer}
                onChange={e => setNewHaes(p => ({ ...p, haesnummer: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Bezeichnung"
                value={newHaes.bezeichnung}
                onChange={e => setNewHaes(p => ({ ...p, bezeichnung: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={newHaes.haesgruppe_id}
                onChange={e => setNewHaes(p => ({ ...p, haesgruppe_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Keine Gruppe</option>
                {gruppen.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select
                value={newHaes.status}
                onChange={e => setNewHaes(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {['Aktiv', 'Verliehen', 'Verkauft', 'Frei', 'Stillgelegt'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewHaes(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button onClick={handleCreateHaes} className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold">Erstellen</button>
            </div>
          </div>
        </div>
      )}

      {/* Token Modal */}
      {selectedGruppeToken && (
        <HaesGroupTokenModal
          gruppe={selectedGruppeToken}
          onClose={() => setSelectedGruppeToken(null)}
        />
      )}

    </div>
  );
}