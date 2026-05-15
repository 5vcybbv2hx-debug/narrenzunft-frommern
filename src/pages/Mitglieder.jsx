import { useState, useEffect, useCallback } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannMitgliederlisteSehn } from '@/lib/roles';
import { Search, Plus, User, ChevronRight, Archive, Download } from 'lucide-react';
import NeuerAntragModal from '@/components/mitglied/NeuerAntragModal';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import * as XLSX from 'xlsx';

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
  'Verstorben': 'bg-gray-600/30 text-gray-400',
};

const ALLE_STATUS = ['Alle', 'Aktiv', 'Passiv', 'Passiv mit Häs', 'Ehrenmitglied', 'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3', 'Leihäs', 'Verstorben'];

export default function Mitglieder() {
  const { user } = useAuth();
  const [mitglieder, setMitglieder] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [zeigeArchiviert, setZeigeArchiviert] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdminUser = isAdmin(user);
  const kannListe = kannMitgliederlisteSehn(user);
  const [showAntragModal, setShowAntragModal] = useState(false);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await loadMitglieder();
  }, []));

  useEffect(() => {
    loadMitglieder();
  }, []);

  useEffect(() => {
    filterMitglieder();
  }, [mitglieder, search, statusFilter, zeigeArchiviert]);

  const loadMitglieder = async () => {
    setLoading(true);
    try {
      // #1 – Datenschutz: nur berechtigte Rollen sehen alle Mitglieder
      let data;
      if (kannListe) {
        data = await base44.entities.Mitglied.list('nachname', 500);
      } else {
        // Normale Mitglieder sehen nur eigenes Profil
        const me = await base44.auth.me();
        data = await base44.entities.Mitglied.filter({ user_id: me?.id });
      }
      setMitglieder(data);
    } catch (e) {}
    setLoading(false);
  };

  const filterMitglieder = () => {
    let result = mitglieder;
    // Archivierte ausblenden (außer wenn explizit gewünscht)
    result = result.filter(m => zeigeArchiviert ? m.archiviert : !m.archiviert);
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

  const handleExport = () => {
    const haesgruppen = []; // Gruppen werden inline aus den IDs aufgelöst – hier nur IDs verfügbar
    const rows = mitglieder
      .filter(m => !m.archiviert)
      .map(m => ({
        'Vorname': m.vorname || '',
        'Nachname': m.nachname || '',
        'Status': m.mitgliedsstatus || '',
        'Geburtsdatum': m.geburtsdatum || '',
        'Eintrittsdatum': m.eintrittsdatum || '',
        'Austrittsdatum': m.austrittsdatum || '',
        'Straße': m.strasse || '',
        'PLZ': m.plz || '',
        'Ort': m.ort || '',
        'Telefon': m.telefon || '',
        'E-Mail': m.email || '',
        'Notfallkontakt Name': m.notfallkontakt_name || '',
        'Notfallkontakt Telefon': m.notfallkontakt_telefon || '',
        'App-Rolle': m.app_rolle || '',
        'Kontoinhaber': m.kontoinhaber || '',
        'Bank': m.bankname || '',
        'IBAN': m.iban || '',
        'Mandatnummer': m.sepa_mandatnummer || '',
        'Mandatdatum': m.sepa_mandatdatum || '',
        'Umzüge (historisch)': m.umzuege_vor_digitalisierung || 0,
        'Notizen': m.notizen || '',
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mitglieder');
    XLSX.writeFile(wb, `Mitgliederliste_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <p className="text-sm text-muted-foreground mt-0.5">{mitglieder.filter(m => !m.archiviert).length} Mitglieder · {mitglieder.filter(m => m.archiviert).length} archiviert</p>
        </div>
        {isAdminUser && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              title="Mitgliederliste exportieren"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <Link
              to="/mitglieder/neu"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Neu</span>
            </Link>
          </div>
        )}
      </div>

      {/* Mitgliedsantrag Bereich */}
      {isAdminUser && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowAntragModal(true)}
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-left"
          >
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">Neues Mitglied aufnehmen</p>
              <p className="text-xs text-muted-foreground">Antrag ausfüllen & direkt anlegen</p>
            </div>
          </button>
          <Link
            to="/mitgliedsantraege"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border hover:border-primary/40 hover:bg-secondary/80 transition-colors text-sm font-medium text-foreground"
          >
            <span className="text-base">📂</span>
            <span className="hidden sm:inline">Anträge verwalten</span>
          </Link>
        </div>
      )}

      {showAntragModal && (
        <NeuerAntragModal
          onClose={() => setShowAntragModal(false)}
          onMitgliedAngelegt={() => { loadMitglieder(); }}
        />
      )}

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

      {/* Archiv-Toggle */}
      {isAdminUser && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">{filtered.length} Ergebnisse</p>
          <button
            onClick={() => setZeigeArchiviert(p => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${zeigeArchiviert ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-card text-muted-foreground border-border hover:border-primary/50'}`}
          >
            <Archive size={12} /> {zeigeArchiviert ? 'Archiv wird angezeigt' : 'Archiv anzeigen'}
          </button>
        </div>
      )}
      {!isAdminUser && <p className="text-xs text-muted-foreground mb-3">{filtered.length} Ergebnisse</p>}

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
                      Eintrittsdatum: {format(new Date(m.eintrittsdatum), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  )}
                  {m.archiviert && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                      <Archive size={10} /> Archiviert
                    </span>
                  )}
                  {isAdminUser && m.einladung_gesendet_am && !m.user_id && !m.archiviert && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                      📧 Eingeladen
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