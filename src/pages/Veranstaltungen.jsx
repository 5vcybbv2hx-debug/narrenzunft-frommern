import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Calendar, Plus, MapPin, Clock, Bus, ChevronRight, LayoutTemplate, Users } from 'lucide-react';
import { isAdmin } from '@/lib/roles';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import VeranstaltungsvorlagenModal from '@/components/veranstaltung/VeranstaltungsvorlagenModal';

const TYP_COLORS = {
  'Umzug':             'bg-primary/20 text-primary',
  'Abendveranstaltung':'bg-purple-500/20 text-purple-400',
  'Intern':            'bg-blue-500/20 text-blue-400',
  'Fest':              'bg-yellow-500/20 text-yellow-400',
  'Probe':             'bg-cyan-500/20 text-cyan-400',
  'Arbeitsdienst':     'bg-green-500/20 text-green-400',
  'Hauptversammlung':  'bg-orange-500/20 text-orange-400',
  'Sonstiges':         'bg-gray-500/20 text-gray-400',
};

const STATUS_COLORS = {
  'Geplant':       'bg-blue-500/20 text-blue-400',
  'Aktiv':         'bg-green-500/20 text-green-400',
  'Abgeschlossen': 'bg-gray-500/20 text-gray-400',
  'Abgesagt':      'bg-red-500/20 text-red-400',
};

const FILTERS = ['Alle', 'Kommend', 'Vergangen', 'Umzug', 'Abendveranstaltung', 'Intern', 'Fest', 'Arbeitsdienst'];

export default function Veranstaltungen() {
  const { user } = useAuth();
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [filter, setFilter] = useState('Kommend');
  const [loading, setLoading] = useState(true);
  const [showVorlagen, setShowVorlagen] = useState(false);
  const [myMitgliedId, setMyMitgliedId] = useState(null);
  const [meineTeilnahmen, setMeineTeilnahmen] = useState([]);
  const kannVerwalten = isAdmin(user);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, me] = await Promise.all([
        base44.entities.Veranstaltung.list('datum', 500),
        base44.auth.me(),
      ]);
      setVeranstaltungen(data);

      // Eigene Teilnahmen laden für Anmeldestatus-Anzeige
      if (me?.id) {
        const myM = await base44.entities.Mitglied.filter({ user_id: me.id });
        if (myM[0]) {
          setMyMitgliedId(myM[0].id);
          const teilnahmen = await base44.entities.Teilnahme.filter({ mitglied_id: myM[0].id });
          setMeineTeilnahmen(teilnahmen);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  // Zähler pro Filter
  const filterCounts = useMemo(() => {
    return FILTERS.reduce((acc, f) => {
      if (f === 'Alle') acc[f] = veranstaltungen.length;
      else if (f === 'Kommend') acc[f] = veranstaltungen.filter(v => v.datum >= today).length;
      else if (f === 'Vergangen') acc[f] = veranstaltungen.filter(v => v.datum < today).length;
      else acc[f] = veranstaltungen.filter(v => v.typ === f).length;
      return acc;
    }, {});
  }, [veranstaltungen, today]);

  const filtered = useMemo(() => {
    let result = veranstaltungen;
    if (filter === 'Kommend') result = result.filter(v => v.datum >= today);
    else if (filter === 'Vergangen') result = result.filter(v => v.datum < today);
    else if (filter !== 'Alle') result = result.filter(v => v.typ === filter);
    // Kommend: aufsteigend (nächster zuerst), Vergangen: absteigend (letzter zuerst)
    result = [...result].sort((a, b) => {
      if (filter === 'Vergangen') return b.datum > a.datum ? 1 : -1;
      return a.datum > b.datum ? 1 : -1;
    });
    return result;
  }, [veranstaltungen, filter, today]);

  // Nach Jahr gruppieren
  const groupedByYear = useMemo(() => {
    const groups = {};
    filtered.forEach(v => {
      const year = v.datum ? v.datum.substring(0, 4) : 'Kein Datum';
      if (!groups[year]) groups[year] = [];
      groups[year].push(v);
    });
    // Jahre sortieren: kommend aufsteigend, vergangen absteigend
    const years = Object.keys(groups).sort((a, b) =>
      filter === 'Vergangen' ? b.localeCompare(a) : a.localeCompare(b)
    );
    return years.map(y => ({ year: y, items: groups[y] }));
  }, [filtered, filter]);

  const getMeineTeilnahme = (veranstaltungId) =>
    meineTeilnahmen.find(t => t.veranstaltung_id === veranstaltungId);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Veranstaltungen werden geladen…</p>
      </div>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Veranstaltungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{veranstaltungen.length} gesamt</p>
        </div>
        {kannVerwalten && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowVorlagen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
              title="Vorlagen"
            >
              <LayoutTemplate size={16} />
              <span className="hidden sm:inline">Vorlagen</span>
            </button>
            <Link
              to="/veranstaltungen/neu"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Neu</span>
            </Link>
          </div>
        )}
      </div>

      {/* Filter mit Zählern */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {FILTERS.filter(f => filterCounts[f] > 0 || f === 'Alle' || f === 'Kommend').map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f
                ? 'bg-primary text-white shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {f}
            {filterCounts[f] > 0 && (
              <span className={`text-[10px] font-bold px-1 rounded-full ${filter === f ? 'bg-white/20' : 'bg-secondary'}`}>
                {filterCounts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste gruppiert nach Jahr */}
      {groupedByYear.length === 0 ? (
        <div className="text-center py-16">
          <Calendar size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">Keine Veranstaltungen</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === 'Kommend' ? 'Noch keine kommenden Veranstaltungen geplant' : 'Keine Einträge für diesen Filter'}
          </p>
          {filter !== 'Alle' && (
            <button onClick={() => setFilter('Alle')} className="mt-3 text-xs text-primary hover:underline">
              Alle anzeigen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByYear.map(({ year, items }) => (
            <div key={year}>
              {/* Jahr-Trennlinie */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{year}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map(v => {
                  const isKommend = v.datum >= today;
                  const meineTeilnahme = getMeineTeilnahme(v.id);
                  const istAngemeldet = meineTeilnahme && !['Abgesagt'].includes(meineTeilnahme.status);
                  return (
                    <Link
                      key={v.id}
                      to={`/veranstaltungen/${v.id}`}
                      className="flex gap-3 bg-card border border-border rounded-lg p-3.5 hover:border-primary/50 hover:bg-card/80 transition-all group"
                    >
                      {/* Datum-Block */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center ${isKommend ? 'bg-primary/10' : 'bg-secondary'}`}>
                        <span className="text-[9px] text-muted-foreground font-medium uppercase leading-none">
                          {v.datum ? format(new Date(v.datum), 'MMM', { locale: de }) : '–'}
                        </span>
                        <span className={`text-lg font-oswald font-bold leading-tight ${isKommend ? 'text-primary' : 'text-muted-foreground'}`}>
                          {v.datum ? format(new Date(v.datum), 'd') : '–'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {v.titel}
                          </h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {istAngemeldet && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                                ✓ Angemeldet
                              </span>
                            )}
                            <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYP_COLORS[v.typ] || 'bg-gray-500/20 text-gray-400'}`}>
                            {v.typ}
                          </span>
                          {v.status && v.status !== 'Geplant' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[v.status] || ''}`}>
                              {v.status}
                            </span>
                          )}
                          {v.bus_erforderlich && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                              <Bus size={9} /> Bus
                            </span>
                          )}
                          {v.uhrzeit && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock size={9} /> {v.uhrzeit}
                            </span>
                          )}
                          {v.ort && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[120px]">
                              <MapPin size={9} /> {v.ort}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showVorlagen && <VeranstaltungsvorlagenModal onClose={() => setShowVorlagen(false)} />}
    </div>
  );
}
