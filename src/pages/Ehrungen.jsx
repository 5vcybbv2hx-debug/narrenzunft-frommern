import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Award, Star, Search, Filter, Plus, Check, X } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';

const EHRUNGSSTUFEN_UMZUEGE = [66, 99, 133, 166, 199, 222, 266, 299, 333];

const STATUS_COLORS = {
  'Vorgeschlagen': 'bg-yellow-500/20 text-yellow-400',
  'Genehmigt': 'bg-blue-500/20 text-blue-400',
  'Verliehen': 'bg-green-500/20 text-green-400',
  'Abgelehnt': 'bg-red-500/20 text-red-400',
};

export default function Ehrungen() {
  const { user } = useAuth();
  const [ehrungen, setEhrungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [filter, setFilter] = useState('Alle');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [e, m] = await Promise.all([
        base44.entities.Ehrung.list('-created_date', 500),
        base44.entities.Mitglied.list('nachname', 500),
      ]);
      setEhrungen(e);
      setMitglieder(m);
    } catch (err) {}
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleStatusUpdate = async (ehrung, newStatus) => {
    try {
      await base44.entities.Ehrung.update(ehrung.id, { status: newStatus });
      setEhrungen(prev => prev.map(e => e.id === ehrung.id ? { ...e, status: newStatus } : e));
    } catch (e) {}
  };

  const filtered = ehrungen.filter(e => {
    if (filter !== 'Alle' && e.status !== filter) return false;
    if (search) {
      const name = getMitgliedName(e.mitglied_id).toLowerCase();
      return name.includes(search.toLowerCase());
    }
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const vorgeschlagene = ehrungen.filter(e => e.status === 'Vorgeschlagen');

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ehrungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{ehrungen.length} gesamt, {vorgeschlagene.length} offen</p>
        </div>
        {isAdmin && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neue Ehrung</span>
          </button>
        )}
      </div>

      {/* Ehrungsstufen Info */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Star size={14} className="text-yellow-400" /> Umzugsteilnahmen-Stufen
        </h3>
        <div className="flex flex-wrap gap-2">
          {EHRUNGSSTUFEN_UMZUEGE.map(s => (
            <span key={s} className="text-xs px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 font-mono font-semibold">
              {s}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Mitgliedsjahre: alle 10 Jahre ab 18. Geburtstag
        </p>
      </div>

      {/* Search & Filter */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Mitglied suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['Alle', 'Vorgeschlagen', 'Genehmigt', 'Verliehen', 'Abgelehnt'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Ehrungen Liste */}
      <div className="space-y-2">
        {filtered.map(e => (
          <div key={e.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Award size={18} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground text-sm">{getMitgliedName(e.mitglied_id)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[e.status]}`}>
                    {e.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{e.typ} – <span className="text-primary font-semibold">{e.wert}</span></p>
                {e.datum && (
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(e.datum), 'dd.MM.yyyy')}</p>
                )}
                {e.beschreibung && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{e.beschreibung}</p>
                )}
              </div>
            </div>
            {isAdmin && e.status === 'Vorgeschlagen' && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => handleStatusUpdate(e, 'Genehmigt')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium"
                >
                  <Check size={14} /> Genehmigen
                </button>
                <button
                  onClick={() => handleStatusUpdate(e, 'Abgelehnt')}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium"
                >
                  <X size={14} /> Ablehnen
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Award size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Ehrungen gefunden</p>
        </div>
      )}
    </div>
  );
}