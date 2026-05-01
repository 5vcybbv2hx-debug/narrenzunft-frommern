import { useState, useEffect, useCallback } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannMitgliederlisteSehn } from '@/lib/roles';
import { Search, Plus, User, ChevronRight } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';

const STATUS_COLORS = {
  'Aktiv': 'bg-green-500/20 text-green-400',
  'Passiv': 'bg-yellow-500/20 text-yellow-400',
  'Passiv mit Häs': 'bg-orange-500/20 text-orange-400',
  'Ehrenmitglied': 'bg-purple-500/20 text-purple-400',
  'Jugendliche 11-14': 'bg-blue-500/20 text-blue-400',
  'Jungaktive 15-17': 'bg-cyan-500/20 text-cyan-400',
  'Kinder 4-10': 'bg-pink-500/20 text-pink-400',
  'Kleinkind 0-3': 'bg-rose-500/20 text-rose-400',
  'Leihäs': 'bg-gray-500/20 text-gray-400',
};

const ALLE_STATUS = ['Alle', 'Aktiv', 'Passiv', 'Passiv mit Häs', 'Ehrenmitglied', 'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3', 'Leihäs'];

export default function Mitglieder() {
  const { user } = useAuth();
  const [mitglieder, setMitglieder] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [loading, setLoading] = useState(true);
  const isAdminUser = isAdmin(user);
  const kannListe = kannMitgliederlisteSehn(user);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await loadMitglieder();
  }, []));

  useEffect(() => {
    loadMitglieder();
  }, []);

  useEffect(() => {
    filterMitglieder();
  }, [mitglieder, search, statusFilter]);

  const loadMitglieder = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Mitglied.list('nachname', 500);
      setMitglieder(data);
    } catch (e) {}
    setLoading(false);
  };

  const filterMitglieder = () => {
    let result = mitglieder;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m =>
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(s) ||
        m.email?.toLowerCase().includes(s) ||
        m.ort?.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'Alle') {
      result = result.filter(m => m.mitgliedsstatus === statusFilter);
    }
    setFiltered(result);
  };

  const getAlter = (geb) => {
    if (!geb) return null;
    return differenceInYears(new Date(), new Date(geb));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mitglieder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{mitglieder.length} Mitglieder gesamt</p>
        </div>
        {isAdminUser && (
          <Link
            to="/mitglieder/neu"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neu</span>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Name, E-Mail, Ort suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {ALLE_STATUS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-3">{filtered.length} Ergebnisse</p>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(m => {
          const alter = getAlter(m.geburtsdatum);
          const statusColor = STATUS_COLORS[m.mitgliedsstatus] || 'bg-gray-500/20 text-gray-400';
          return (
            <Link
              key={m.id}
              to={`/mitglieder/${m.id}`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3.5 hover:border-primary/50 transition-all group"
            >
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                {m.profilbild_url ? (
                  <img src={m.profilbild_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${m.vorname?.[0] || ''}${m.nachname?.[0] || ''}`
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    {m.vorname} {m.nachname}
                  </p>
                  {alter !== null && (
                    <span className="text-xs text-muted-foreground font-normal">{alter} J.</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                    {m.mitgliedsstatus}
                  </span>
                  {m.ort && <span className="text-xs text-muted-foreground">{m.ort}</span>}
                  {m.eintrittsdatum && (
                    <span className="text-xs text-muted-foreground">
                      Eintrittsdatum: {format(new Date(m.eintrittsdatum), 'dd.MM.yyyy')}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <User size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Mitglieder gefunden</p>
        </div>
      )}
    </div>
  );
}