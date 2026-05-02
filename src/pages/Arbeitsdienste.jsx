import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannArbeitsdiensteVerwalten } from '@/lib/roles';
import { Briefcase, Plus, Calendar, MapPin, Users, Edit, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import ArbeitsdienstEditModal from '@/components/arbeitsdienst/ArbeitsdienstEditModal';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'In Planung': 'bg-blue-500/20 text-blue-400',
  'Abgeschlossen': 'bg-green-500/20 text-green-400',
};

const ZUWEISUNG_COLORS = {
  'Offen':         'bg-secondary text-muted-foreground',
  'Bestätigt':     'bg-blue-500/20 text-blue-400',
  'Erledigt':      'bg-green-500/20 text-green-400',
  'Abgesagt':      'bg-red-500/20 text-red-400',
  'Nicht erledigt':'bg-orange-500/20 text-orange-400',
};

export default function Arbeitsdienste() {
  const { user } = useAuth();
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Alle');
  const [editDienst, setEditDienst] = useState(null);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, z, m] = await Promise.all([
        base44.entities.Arbeitsdienst.list('datum', 200),
        base44.entities.ArbeitsdienstZuweisung.list('-created_date', 500),
        base44.entities.Mitglied.list('nachname', 500),
      ]);
      setDienste(d);
      setZuweisungen(z);
      setMitglieder(m);

      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) setMyMitglied(myM[0]);
    } catch (e) {}
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

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arbeitsdienste</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dienste.length} gesamt</p>
        </div>
        {kannVerwalten && (
          <Link
            to="/arbeitsdienste/neu"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neuer Dienst</span>
          </Link>
        )}
      </div>

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
        {filtered.map(d => {
          const zuws = getZuweisungen(d.id);
          const meineZ = meineZuweisung(d.id);

          return (
            <div key={d.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{d.titel}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {format(new Date(d.datum), 'dd.MM.yyyy', { locale: de })}
                        {d.uhrzeit && ` – ${d.uhrzeit}`}
                      </span>
                      {d.ort && <span className="flex items-center gap-1"><MapPin size={11} /> {d.ort}</span>}
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {zuws.filter(z => z.status !== 'Abgesagt').length}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''} eingeteilt
                      </span>
                    </div>
                    {d.beschreibung && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{d.beschreibung}</p>
                    )}
                  </div>
                  {kannVerwalten && (
                    <button
                      onClick={() => setEditDienst(d)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Edit size={15} />
                    </button>
                  )}
                </div>

                {/* Meine Zuweisung */}
                {meineZ && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Meine Zuweisung:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange(meineZ, 'Bestätigt')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          meineZ.status === 'Bestätigt' || meineZ.status === 'Erledigt'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-400'
                        }`}
                      >
                        ✓ Bestätigen
                      </button>
                      <button
                        onClick={() => handleStatusChange(meineZ, 'Abgesagt')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          meineZ.status === 'Abgesagt'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-400'
                        }`}
                      >
                        ✗ Absagen
                      </button>
                    </div>
                  </div>
                )}

                {/* Zugewiesene Personen */}
                {zuws.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Eingeteilt ({zuws.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {zuws.map(z => {
                        const m = mitglieder.find(m => m.id === z.mitglied_id);
                        return (
                          <span
                            key={z.id}
                            className={`text-xs px-2 py-0.5 rounded-full ${ZUWEISUNG_COLORS[z.status] || ZUWEISUNG_COLORS['Offen']}`}
                          >
                            {m ? `${m.vorname} ${m.nachname}` : '–'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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