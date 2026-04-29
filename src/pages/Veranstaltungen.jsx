import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Calendar, Plus, MapPin, Clock, Users, Bus, ChevronRight, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYP_COLORS = {
  'Umzug': 'bg-primary/20 text-primary',
  'Abendveranstaltung': 'bg-purple-500/20 text-purple-400',
  'Intern': 'bg-blue-500/20 text-blue-400',
  'Arbeitsdienst': 'bg-orange-500/20 text-orange-400',
};

const STATUS_COLORS = {
  'Geplant': 'bg-blue-500/20 text-blue-400',
  'Aktiv': 'bg-green-500/20 text-green-400',
  'Abgeschlossen': 'bg-gray-500/20 text-gray-400',
  'Abgesagt': 'bg-red-500/20 text-red-400',
};

export default function Veranstaltungen() {
  const { user } = useAuth();
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [filter, setFilter] = useState('Alle');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'admin';
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Veranstaltung.list('datum', 200);
      setVeranstaltungen(data);
    } catch (e) {}
    setLoading(false);
  };

  const filters = ['Alle', 'Kommend', 'Vergangen', 'Umzug', 'Abendveranstaltung', 'Intern'];

  const filtered = veranstaltungen.filter(v => {
    if (filter === 'Alle') return true;
    if (filter === 'Kommend') return v.datum >= today;
    if (filter === 'Vergangen') return v.datum < today;
    return v.typ === filter;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veranstaltungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{veranstaltungen.length} gesamt</p>
        </div>
        {isAdmin && (
          <Link
            to="/veranstaltungen/neu"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neue Veranstaltung</span>
          </Link>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map(v => {
          const isKommend = v.datum >= today;
          return (
            <Link
              key={v.id}
              to={`/veranstaltungen/${v.id}`}
              className="block bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-all group"
            >
              <div className="flex gap-4">
                {/* Date Block */}
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center ${isKommend ? 'bg-primary/10' : 'bg-secondary'}`}>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {format(new Date(v.datum), 'MMM', { locale: de })}
                  </span>
                  <span className={`text-xl font-bold ${isKommend ? 'text-primary' : 'text-muted-foreground'}`}>
                    {format(new Date(v.datum), 'd')}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{v.titel}</h3>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYP_COLORS[v.typ] || 'bg-gray-500/20 text-gray-400'}`}>
                      {v.typ}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] || 'bg-gray-500/20 text-gray-400'}`}>
                      {v.status}
                    </span>
                    {v.bus_erforderlich && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Bus size={10} /> Bus
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {v.uhrzeit && (
                      <span className="flex items-center gap-1"><Clock size={11} /> {v.uhrzeit}</span>
                    )}
                    {v.ort && (
                      <span className="flex items-center gap-1"><MapPin size={11} /> {v.ort}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Veranstaltungen gefunden</p>
        </div>
      )}
    </div>
  );
}