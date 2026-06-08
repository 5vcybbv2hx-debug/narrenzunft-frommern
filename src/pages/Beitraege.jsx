import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { CreditCard, Search, Plus, Settings, Bus } from 'lucide-react';
import { format } from 'date-fns';
import BeitraegeEinstellungen from '@/components/beitraege/BeitraegeEinstellungen';
import Buskosten from '@/components/beitraege/Buskosten';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'Bezahlt': 'bg-green-500/20 text-green-400',
  'Überfällig': 'bg-red-500/20 text-red-400',
  'Erlassen': 'bg-gray-500/20 text-gray-400',
};

const DEFAULT_BEITRAEGE_SATZ = {
  'Aktiv': 60,
  'Passiv': 30,
  'Passiv mit Häs': 45,
  'Leihäs': 40,
  'Jugendliche 11-14': 20,
  'Jungaktive 15-17': 25,
  'Kinder 4-10': 15,
  'Kleinkind 0-3': 0,
  'Ehrenmitglied': 0,
};

export default function Beitraege() {
  const { user } = useAuth();
  const [beitraege, setBeitraege] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Alle');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showEinstellungen, setShowEinstellungen] = useState(false);
  const [beitraegeSatz, setBeitraegeSatz] = useState(DEFAULT_BEITRAEGE_SATZ);
  const [activeTab, setActiveTab] = useState('jahresbeitraege');
  const isAdminUser = isAdmin(user);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const einst = await base44.entities.AppEinstellung.filter({ schluessel: 'beitraege_saetze' });
      if (einst[0]?.wert_json) setBeitraegeSatz({ ...DEFAULT_BEITRAEGE_SATZ, ...einst[0].wert_json });

      if (isAdminUser) {
        // Admins sehen alle Beiträge + alle Mitglieder für Namensauflösung
        const [bData, m] = await Promise.all([
          base44.entities.Beitrag.list('-jahr', 500),
          base44.entities.Mitglied.list('nachname', 300),
        ]);
        setBeitraege(bData);
        setMitglieder(m);
      } else {
        // Normales Mitglied: nur eigene Daten
        const me = await base44.auth.me();
        const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
        if (myM[0]) {
          setMitglieder([myM[0]]);
          const bData = await base44.entities.Beitrag.filter({ mitglied_id: myM[0].id });
          setBeitraege(bData);
        }
      }
    } catch (e) {}
    setLoading(false);
  };

  const getMitglied = (id) => mitglieder.find(m => m.id === id);

  const handleMarkBezahlt = async (beitrag) => {
    try {
      const updated = await base44.entities.Beitrag.update(beitrag.id, {
        zahlungsstatus: 'Bezahlt',
        zahlungsdatum: new Date().toISOString().split('T')[0]
      });
      setBeitraege(prev => prev.map(b => b.id === beitrag.id ? { ...b, zahlungsstatus: 'Bezahlt', zahlungsdatum: updated.zahlungsdatum } : b));
    } catch (e) {}
  };

  const handleJahresbeitraegeErstellen = async () => {
    if (!window.confirm(`Jahresbeiträge für ${selectedYear} erstellen?`)) return;
    setCreating(true);
    try {
      const aktiveMitglieder = mitglieder.filter(m => m.mitgliedsstatus !== 'Ehrenmitglied' && m.mitgliedsstatus !== 'Kleinkind 0-3');
      const existierende = beitraege.filter(b => b.jahr === selectedYear).map(b => b.mitglied_id);
      const neueM = aktiveMitglieder.filter(m => !existierende.includes(m.id));

      const neueBeitraege = neueM.map(m => ({
        mitglied_id: m.id,
        jahr: selectedYear,
        betrag: beitraegeSatz[m.mitgliedsstatus] || 0,
        mitgliedsstatus: m.mitgliedsstatus,
        zahlungsstatus: 'Offen',
      }));

      if (neueBeitraege.length > 0) {
        await base44.entities.Beitrag.bulkCreate(neueBeitraege);
        await loadData();
      }
    } catch (e) {}
    setCreating(false);
  };

  const filteredBeitraege = beitraege.filter(b => {
    if (filter !== 'Alle' && b.zahlungsstatus !== filter) return false;
    if (search) {
      const m = getMitglied(b.mitglied_id);
      const name = m ? `${m.vorname} ${m.nachname}` : '';
      return name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const stats = {
    total: beitraege.reduce((s, b) => s + (b.betrag || 0), 0),
    bezahlt: beitraege.filter(b => b.zahlungsstatus === 'Bezahlt').reduce((s, b) => s + (b.betrag || 0), 0),
    offen: beitraege.filter(b => b.zahlungsstatus === 'Offen').reduce((s, b) => s + (b.betrag || 0), 0),
    ueberfaellig: beitraege.filter(b => b.zahlungsstatus === 'Überfällig').reduce((s, b) => s + (b.betrag || 0), 0),
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Beiträge</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{beitraege.length} Einträge</p>
        </div>
        {isAdminUser && activeTab === 'jahresbeitraege' && (
          <button
            onClick={() => setShowEinstellungen(true)}
            className="p-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
            title="Beitragssätze anpassen"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('jahresbeitraege')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'jahresbeitraege' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <CreditCard size={14} /> Jahresbeiträge
        </button>
        <button
          onClick={() => setActiveTab('buskosten')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'buskosten' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Bus size={14} /> Buskosten
        </button>
      </div>

      {/* Buskosten Tab */}
      {activeTab === 'buskosten' && (
        <Buskosten isAdmin={isAdminUser} />
      )}

      {activeTab !== 'buskosten' && <>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Gesamt</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.total.toFixed(0)} €</p>
        </div>
        <div className="bg-card border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Bezahlt</p>
          <p className="text-xl font-bold text-green-400 mt-1">{stats.bezahlt.toFixed(0)} €</p>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Offen</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">{stats.offen.toFixed(0)} €</p>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Überfällig</p>
          <p className="text-xl font-bold text-red-400 mt-1">{stats.ueberfaellig.toFixed(0)} €</p>
        </div>
      </div>

      {/* Jahresbeiträge erstellen */}
      {isAdminUser && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Jahr:</label>
            <input
              type="number"
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="w-24 px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleJahresbeitraegeErstellen}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> {creating ? 'Erstelle...' : `Jahresbeiträge ${selectedYear} erstellen`}
          </button>
        </div>
      )}

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
        {['Alle', 'Offen', 'Bezahlt', 'Überfällig', 'Erlassen'].map(f => (
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

      {/* Tabelle */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Mitglied</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Jahr</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Betrag</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                {isAdminUser && <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {filteredBeitraege.map(b => {
                const m = getMitglied(b.mitglied_id);
                return (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{m ? `${m.vorname} ${m.nachname}` : '–'}</p>
                      <p className="text-xs text-muted-foreground">{b.mitgliedsstatus}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-muted-foreground">{b.jahr}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-foreground">{b.betrag} €</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.zahlungsstatus]}`}>
                        {b.zahlungsstatus}
                      </span>
                    </td>
                    {isAdminUser && (
                      <td className="px-4 py-3 text-right">
                        {b.zahlungsstatus !== 'Bezahlt' && b.zahlungsstatus !== 'Erlassen' && (
                          <button
                            onClick={() => handleMarkBezahlt(b)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors font-medium"
                          >
                            ✓ Bezahlt
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showEinstellungen && (
        <BeitraegeEinstellungen
          onClose={() => setShowEinstellungen(false)}
          onSaved={(newSaetze) => { setBeitraegeSatz(newSaetze); setShowEinstellungen(false); }}
        />
      )}

      {filteredBeitraege.length === 0 && (
        <div className="text-center py-8">
          <CreditCard size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Keine Beiträge gefunden</p>
        </div>
      )}

      </> }
    </div>
  );
}