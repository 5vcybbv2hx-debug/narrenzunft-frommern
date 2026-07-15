import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Shirt, Plus, Search, ChevronRight, Calendar } from 'lucide-react';
import HaesGroupTokenModal from '@/components/haes/HaesGroupTokenModal';
import { isAdmin } from '@/lib/roles';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [gruppeFilter, setGruppeFilter] = useState('Alle');
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

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getHaesSicher', {});
      if (!result.data.erfolg) {
        setLoading(false);
        return;
      }
      setHaes(result.data.haes);
      setGruppen(result.data.gruppen);
      if (isAdminUser) {
        setMitglieder(result.data.mitglieder);
      }
    } catch (e) {
      console.error('[Haes]', e instanceof Error ? e.message : e);
    }
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = (mitglieder || []).find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const getGruppeName = (id) => {
    const g = gruppen.find(g => g.id === id);
    return g ? g.name : '–';
  };

  const handleCreateGruppe = async () => {
    try {
      await base44.entities.Haesgruppe.create(newGruppe);
      setNewGruppe({ name: '', beschreibung: '' });
      setShowNewGruppe(false);
      loadData();
    } catch (e) {}
  };

  const handleCreateHaes = async () => {
    try {
      await base44.entities.Haes.create(newHaes);
      setNewHaes({ haesnummer: '', haesgruppe_id: '', bezeichnung: '', status: 'Frei' });
      setShowNewHaes(false);
      loadData();
    } catch (e) {}
  };

  const filtered = haes.filter(h => {
    if (statusFilter !== 'Alle' && h.status !== statusFilter) return false;
    if (gruppeFilter !== 'Alle' && h.haesgruppe_id !== gruppeFilter) return false;
    if (search) {
      return h.haesnummer?.includes(search) ||
        h.bezeichnung?.toLowerCase().includes(search.toLowerCase()) ||
        getMitgliedName(h.aktueller_besitzer_id).toLowerCase().includes(search.toLowerCase());
    }
    return true;
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Häs wird geladen…</p>
      </div>
    </div>
  );

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Häs & Masken</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{haes.length} Häs gesamt</p>
        </div>
        {isAdminUser && (
          <div className="flex gap-2">

            <button
              onClick={() => setShowNewGruppe(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-border transition-colors"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Gruppe</span>
            </button>
            <button
              onClick={() => setShowNewHaes(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> Häs
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
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
                  className="absolute -right-1 -top-1 p-1 rounded-lg bg-primary text-white hover:bg-primary/90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['Alle', 'Aktiv', 'Verliehen', 'Frei', 'Verkauft', 'Stillgelegt'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === s ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Häs Liste */}
      <div className="space-y-2">
        {filtered.map(h => (
          <Link key={h.id} to={`/haes/${h.id}`} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Shirt size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-mono font-bold text-primary text-sm">#{h.haesnummer}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[h.status]}`}>{h.status}</span>
              </div>
              <p className="text-sm text-foreground truncate">{h.bezeichnung || '–'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {h.haesgruppe_id && <span>{getGruppeName(h.haesgruppe_id)}</span>}
                {h.aktueller_besitzer_id && (
                  <span>· {getMitgliedName(h.aktueller_besitzer_id)}</span>
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