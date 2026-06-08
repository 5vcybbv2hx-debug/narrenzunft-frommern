import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannArbeitsdiensteVerwalten } from '@/lib/roles';
import { Briefcase, Plus, Calendar, MapPin, Users, Edit, X, ChevronDown, ChevronUp, LayoutTemplate, List } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import ArbeitsdienstEditModal from '@/components/arbeitsdienst/ArbeitsdienstEditModal';
import VeranstaltungsvorlagenModal from '@/components/veranstaltung/VeranstaltungsvorlagenModal';
import ArbeitsdienstKalender from '@/components/arbeitsdienst/ArbeitsdienstKalender';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'In Planung': 'bg-blue-500/20 text-blue-400',
  'Abgeschlossen': 'bg-green-500/20 text-green-400',
};

const ZUWEISUNG_COLORS = {
  'Offen':         'bg-secondary text-muted-foreground',
  'Bestätigt':     'bg-green-500/20 text-green-400',
  'Erledigt':      'bg-green-500/20 text-green-400',
  'Abgesagt':      'bg-red-500/20 text-red-400',
  'Nicht erledigt':'bg-primary/20 text-primary',
};

export default function Arbeitsdienste() {
  const { user } = useAuth();
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Alle');
  const [editDienst, setEditDienst] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [showVorlagen, setShowVorlagen] = useState(false);
  const [ansicht, setAnsicht] = useState('liste'); // 'liste' | 'kalender'
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getArbeitsdiensteSicher', {});
      if (!result.data.erfolg) {
        setLoading(false);
        return;
      }
      setDienste(result.data.dienste);
      setZuweisungen(result.data.zuweisungen);
      setVeranstaltungen(result.data.veranstaltungen || []);
      setMitglieder(result.data.mitglieder);

      const myMArr = result.data.mitglieder.filter(m => m.user_id === user?.id);
      if (myMArr.length > 0) {
        setMyMitglied(myMArr[0]);
      }
    } catch (e) {
      console.error('[Arbeitsdienste]', e instanceof Error ? e.message : e);
    }
    setLoading(false);
  };

  const getZuweisungen = (dienstId) => zuweisungen.filter(z => z.arbeitsdienst_id === dienstId);
  const meineZuweisung = (dienstId) => myMitglied ? zuweisungen.find(z => z.arbeitsdienst_id === dienstId && z.mitglied_id === myMitglied.id) : null;

  const handleStatusChange = async (zuweisung, newStatus) => {
    try {
      await base44.entities.ArbeitsdienstZuweisung.update(zuweisung.id, { status: newStatus });
      setZuweisungen(prev => prev.map(z => z.id === zuweisung.id ? { ...z, status: newStatus } : z));
    } catch (e) {}
  };

  const filtered = dienste
    .filter(d => {
      if (filter === 'Alle') return true;
      if (filter === 'Kommend') return d.datum >= today;
      if (filter === 'Vergangen') return d.datum < today;
      return d.status === filter;
    })
    .sort((a, b) => {
      const aKey = `${a.datum || ''}T${a.uhrzeit || '00:00'}`;
      const bKey = `${b.datum || ''}T${b.uhrzeit || '00:00'}`;
      return aKey.localeCompare(bKey);
    });

  // Gruppiere nach Veranstaltung (und nicht zugeordnete Dienste)
  const grouped = filtered.reduce((acc, d) => {
    const key = d.veranstaltung_id || '_keine';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  // Sortiere nach Veranstaltungsdatum oder Dienstdatum
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const aEvent = a === '_keine' ? null : veranstaltungen.find(v => v.id === a);
    const bEvent = b === '_keine' ? null : veranstaltungen.find(v => v.id === b);
    const aDate = aEvent?.datum || grouped[a][0]?.datum || '9999-12-31';
    const bDate = bEvent?.datum || grouped[b][0]?.datum || '9999-12-31';
    return aDate.localeCompare(bDate);
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arbeitsdienste</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dienste.length} gesamt</p>
        </div>
        {kannVerwalten && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setShowVorlagen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
              title="Vorlagen verwalten"
            >
              <LayoutTemplate size={16} />
              <span className="hidden sm:inline">Vorlagen</span>
            </button>
            <Link
              to="/arbeitsdienste/neu"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Neuer Dienst</span>
            </Link>
          </div>
        )}
      </div>

      {/* Ansicht-Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4">
        <div className="flex gap-0.5 sm:gap-1 bg-secondary rounded-xl p-0.5 sm:p-1">
          <button
            onClick={() => setAnsicht('liste')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ansicht === 'liste' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List size={13} /> Liste
          </button>
          <button
            onClick={() => setAnsicht('kalender')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ansicht === 'kalender' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Calendar size={13} /> Kalender
          </button>
        </div>
      </div>

      {/* Kalenderansicht */}
      {ansicht === 'kalender' && (
        <ArbeitsdienstKalender
          dienste={dienste}
          zuweisungen={zuweisungen}
          onDienstClick={(d) => kannVerwalten && setEditDienst(d)}
        />
      )}

      {ansicht === 'liste' && (
        <>
        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {['Alle', 'Kommend', 'Vergangen', 'Offen', 'In Planung', 'Abgeschlossen'].map(f => (
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

        <div className="space-y-3">
        {sortedKeys.map(eventKey => {
          const dienste_event = grouped[eventKey];
          const event = eventKey === '_keine' ? null : veranstaltungen.find(v => v.id === eventKey);
          const isExpanded = expandedEvents[eventKey] !== false; // Default: expanded
          const allZuweisungen = dienste_event.reduce((sum, d) => sum + getZuweisungen(d.id).filter(z => z.status !== 'Abgesagt').length, 0);
          
          return (
            <div key={eventKey}>
              {/* Veranstaltungs Header (Klappbar) */}
              <button
                onClick={() => setExpandedEvents(p => ({ ...p, [eventKey]: !p[eventKey] }))}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/40 transition-all group"
              >
                {isExpanded ? <ChevronUp size={18} className="text-primary" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                <div className="flex-1 text-left">
                  <p className="font-semibold text-foreground">
                    {event ? event.titel : 'Keine Veranstaltung zugeordnet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event ? format(new Date(event.datum), 'dd.MM.yyyy', { locale: de }) : 'N/A'} · {dienste_event.length} Dienst{dienste_event.length !== 1 ? 'e' : ''} · {allZuweisungen} eingeteilt
                  </p>
                </div>
              </button>

              {/* Dienste (Ausgeklappt) */}
              {isExpanded && (
                <div className="space-y-2 mt-2 ml-1 pl-3 border-l border-primary/30">
                  {dienste_event.map(d => {
                    const zuws = getZuweisungen(d.id);
                    const meineZ = meineZuweisung(d.id);

                    return (
                      <div key={d.id} className="bg-card border border-border rounded-lg overflow-hidden">
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground text-sm">{d.titel}</h3>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                                  {d.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                {d.uhrzeit && <span>{d.uhrzeit} Uhr</span>}
                                {d.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {d.ort}</span>}
                                <span className="flex items-center gap-1">
                                  <Users size={10} /> {zuws.filter(z => z.status !== 'Abgesagt').length}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                                </span>
                              </div>
                              {d.beschreibung && (
                                <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{d.beschreibung}</p>
                              )}
                            </div>
                            {kannVerwalten && (
                              <button
                                onClick={() => setEditDienst(d)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                              >
                                <Edit size={13} />
                              </button>
                            )}
                          </div>

                          {/* Meine Zuweisung */}
                          {meineZ && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-[10px] text-muted-foreground mb-1.5">Meine Zuweisung:</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStatusChange(meineZ, 'Bestätigt')}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    meineZ.status === 'Bestätigt' || meineZ.status === 'Erledigt'
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-400'
                                  }`}
                                >
                                  ✓ OK
                                </button>
                                <button
                                  onClick={() => handleStatusChange(meineZ, 'Abgesagt')}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    meineZ.status === 'Abgesagt'
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-400'
                                  }`}
                                >
                                  ✗ Absage
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Zugewiesene Personen – nur für Verwalter mit Namen, für andere nur Anzahl */}
                          {zuws.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              {kannVerwalten ? (
                                <>
                                  <p className="text-[10px] text-muted-foreground mb-1">Eingeteilt ({zuws.length}):</p>
                                  <div className="flex flex-wrap gap-1">
                                    {zuws.map(z => {
                                      const m = mitglieder.find(m => m.id === z.mitglied_id);
                                      return (
                                        <span
                                          key={z.id}
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${ZUWEISUNG_COLORS[z.status] || ZUWEISUNG_COLORS['Offen']}`}
                                        >
                                          {m ? `${m.vorname}` : '–'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <p className="text-[10px] text-muted-foreground">
                                  {zuws.filter(z => z.status !== 'Abgesagt').length} Person(en) eingeteilt
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Briefcase size={40} className="text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Keine Arbeitsdienste gefunden</p>
          </div>
        )}
        </>
      )}

      {showVorlagen && (
        <VeranstaltungsvorlagenModal onClose={() => setShowVorlagen(false)} />
      )}

      {/* Edit Modal */}
      {editDienst && (
        <ArbeitsdienstEditModal
          dienst={editDienst}
          mitglieder={mitglieder}
          zuweisungen={zuweisungen.filter(z => z.arbeitsdienst_id === editDienst.id)}
          onClose={() => setEditDienst(null)}
          onSaved={() => { setEditDienst(null); loadData(); }}
        />
      )}
    </div>
  );
}