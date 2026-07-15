import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannMitgliederlisteSehn } from '@/lib/roles';
import { Search, Plus, User, ChevronRight, Archive, Download, ArrowUpDown, Shirt, FileText, FolderOpen, ChevronDown } from 'lucide-react';
import NeuerAntragModal from '@/components/mitglied/NeuerAntragModal';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const STATUS_COLORS = {
  'Aktiv':              'bg-green-500/20 text-green-400',
  'Passiv':             'bg-yellow-500/20 text-yellow-400',
  'Passiv mit Häs':     'bg-primary/20 text-primary',
  'Ehrenmitglied':      'bg-purple-500/20 text-purple-400',
  'Jugendliche 11-14':  'bg-blue-500/20 text-blue-400',
  'Jungaktive 15-17':   'bg-cyan-500/20 text-cyan-400',
  'Kinder 4-10':        'bg-pink-500/20 text-pink-400',
  'Kleinkind 0-3':      'bg-rose-500/20 text-rose-400',
  'Leihäs':             'bg-gray-500/20 text-gray-400',
  'Verstorben':         'bg-gray-600/30 text-gray-400',
};

const ALLE_STATUS = [
  'Alle', 'Aktiv', 'Passiv', 'Passiv mit Häs', 'Ehrenmitglied',
  'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3',
  'Leihäs', 'Verstorben',
];

const SORT_OPTIONS = [
  { value: 'nachname',    label: 'Name A–Z' },
  { value: 'eintritt',   label: 'Neuste zuerst' },
  { value: 'alter',      label: 'Alter' },
];

export default function Mitglieder() {
  const { user } = useAuth();
  const [mitglieder, setMitglieder] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [zeigeArchiviert, setZeigeArchiviert] = useState(false);
  const [sortBy, setSortBy] = useState('nachname');
  const [loading, setLoading] = useState(true);
  const [showAntragModal, setShowAntragModal] = useState(false);
  const isAdminUser = isAdmin(user);
  const kannListe = kannMitgliederlisteSehn(user);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await loadMitglieder();
  }, []));

  useEffect(() => { loadMitglieder(); }, []);

  const loadMitglieder = async () => {
    setLoading(true);
    try {
      let data;
      if (kannListe) {
        data = await base44.entities.Mitglied.list('nachname', 2000);
      } else {
        const me = await base44.auth.me();
        data = await base44.entities.Mitglied.filter({ user_id: me?.id });
      }
      setMitglieder(data);
    } catch (e) {}
    setLoading(false);
  };

  // Status-Zähler
  const statusCounts = useMemo(() => {
    const sichtbare = mitglieder.filter(m => zeigeArchiviert ? m.archiviert : !m.archiviert);
    return ALLE_STATUS.reduce((acc, s) => {
      acc[s] = s === 'Alle' ? sichtbare.length : sichtbare.filter(m => m.mitgliedsstatus === s).length;
      return acc;
    }, {});
  }, [mitglieder, zeigeArchiviert]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let result = mitglieder.filter(m => zeigeArchiviert ? m.archiviert : !m.archiviert);

    if (search) {
      let s = search.toLowerCase().trim();
      // #-Präfix für Mitgliedsnummern-Suche strippen
      const nummerOnly = s.startsWith('#') ? s.substring(1) : null;
      if (nummerOnly !== null) {
        result = result.filter(m => m.mitgliedsnummer?.toString().includes(nummerOnly));
      } else {
        result = result.filter(m =>
          `${m.vorname} ${m.nachname}`.toLowerCase().includes(s) ||
          m.email?.toLowerCase().includes(s) ||
          m.ort?.toLowerCase().includes(s) ||
          m.mitgliedsnummer?.toString().includes(s)
        );
      }
    }

    if (statusFilter !== 'Alle') {
      result = result.filter(m => m.mitgliedsstatus === statusFilter);
    }

    // Sortierung
    result = [...result].sort((a, b) => {
      if (sortBy === 'eintritt') {
        return (b.eintrittsdatum || '') > (a.eintrittsdatum || '') ? 1 : -1;
      }
      if (sortBy === 'alter') {
        return (a.geburtsdatum || '9999') > (b.geburtsdatum || '9999') ? 1 : -1;
      }
      // nachname
      return `${a.nachname}${a.vorname}`.localeCompare(`${b.nachname}${b.vorname}`, 'de');
    });

    return result;
  }, [mitglieder, search, statusFilter, zeigeArchiviert, sortBy]);

  const getAlter = (geb) => geb ? differenceInYears(new Date(), new Date(geb)) : null;

  const handleExport = async () => {
    // Häs-Gruppen für Export laden
    let gruppenMap = {};
    try {
      const gruppen = await base44.entities.Haesgruppe.list('name', 200);
      gruppen.forEach(g => { gruppenMap[g.id] = g.name; });
    } catch (e) {}

    const rows = mitglieder
      .filter(m => !m.archiviert)
      .map(m => ({
        'Mitgliedsnummer':     m.mitgliedsnummer || '',
        'Vorname':             m.vorname || '',
        'Nachname':            m.nachname || '',
        'Status':              m.mitgliedsstatus || '',
        'Häsgruppe':           gruppenMap[m.haesgruppe_id] || '',
        'Geburtsdatum':        m.geburtsdatum || '',
        'Eintrittsdatum':      m.eintrittsdatum || '',
        'Austrittsdatum':      m.austrittsdatum || '',
        'Straße':              m.strasse || '',
        'PLZ':                 m.plz || '',
        'Ort':                 m.ort || '',
        'Telefon':             m.telefon || '',
        'E-Mail':              m.email || '',
        'Notfallkontakt Name': m.notfallkontakt_name || '',
        'Notfallkontakt Tel':  m.notfallkontakt_telefon || '',
        'App-Rolle':           m.app_rolle || '',
        'Kontoinhaber':        m.kontoinhaber || '',
        'Bank':                m.bankname || '',
        'IBAN':                m.iban || '',
        'Mandatnummer':        m.sepa_mandatnummer || '',
        'Mandatdatum':         m.sepa_mandatdatum || '',
        'Umzüge (historisch)': m.umzuege_vor_digitalisierung || 0,
        'Notizen':             m.notizen || '',
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Spaltenbreiten
    ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mitglieder');
    XLSX.writeFile(wb, `Mitgliederliste_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Mitglieder werden geladen…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Mitglieder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mitglieder.filter(m => !m.archiviert).length} aktive
            {mitglieder.filter(m => m.archiviert).length > 0 && ` · ${mitglieder.filter(m => m.archiviert).length} archiviert`}
          </p>
        </div>
        {isAdminUser && (
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              title="Mitgliederliste exportieren"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <Link
              to="/mitglieder/neu"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Neu</span>
            </Link>
          </div>
        )}
      </div>

      {/* Antrag-Bereich */}
      {isAdminUser && (
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setShowAntragModal(true)}
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors text-left"
          >
            <FileText size={20} className="text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">Neues Mitglied aufnehmen</p>
              <p className="text-xs text-muted-foreground">Antrag ausfüllen & direkt anlegen</p>
            </div>
          </button>
          <Link
            to="/mitgliedsantraege"
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-secondary border border-border hover:border-primary/40 transition-colors text-sm font-medium text-foreground"
          >
            <FolderOpen size={18} className="text-muted-foreground" />
            <span className="hidden sm:inline">Anträge</span>
          </Link>
        </div>
      )}

      {showAntragModal && (
        <NeuerAntragModal
          onClose={() => setShowAntragModal(false)}
          onMitgliedAngelegt={() => { loadMitglieder(); setShowAntragModal(false); }}
        />
      )}

      {/* Suche + Sort + Filter — sticky */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 pb-2 pt-2 bg-background/95 backdrop-blur-sm mb-3">
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Name, #Nr, E-Mail, Ort…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="appearance-none pl-3 pr-9 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors cursor-pointer"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Status-Filter mit Zählern */}
      <div className="relative mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ALLE_STATUS.filter(s => statusCounts[s] > 0 || s === 'Alle').map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {s}
              <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${
                statusFilter === s ? 'bg-white/20' : 'bg-secondary'
              }`}>
                {statusCounts[s] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Info-Zeile */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'Mitglied' : 'Mitglieder'}
          {search && ` für „${search}"`}
        </p>
        {isAdminUser && (
          <button
            onClick={() => setZeigeArchiviert(p => !p)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              zeigeArchiviert
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            <Archive size={12} /> {zeigeArchiviert ? 'Archiv' : 'Archiv anzeigen'}
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="space-y-1.5">
        {filtered.map(m => {
          const alter = getAlter(m.geburtsdatum);
          const statusColor = STATUS_COLORS[m.mitgliedsstatus] || 'bg-gray-500/20 text-gray-400';
          const hatHaes = !!m.haesgruppe_id;
          const eintrittsJahr = m.eintrittsdatum ? format(new Date(m.eintrittsdatum), 'yyyy') : null;

          return (
            <Link
              key={m.id}
              to={`/mitglieder/${m.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/50 hover:bg-card/80 transition-all group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                {m.profilbild_url ? (
                  <img src={m.profilbild_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${m.vorname?.[0] || ''}${m.nachname?.[0] || ''}`
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {m.vorname} {m.nachname}
                  </p>
                  {alter !== null && (
                    <span className="text-xs text-muted-foreground">{alter} J.</span>
                  )}
                  {hatHaes && (
                    <Shirt size={12} className="text-primary/60 shrink-0" title="Hat ein Häs" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                    {m.mitgliedsstatus}
                  </span>
                  {m.ort && <span className="text-xs text-muted-foreground truncate max-w-[100px]">{m.ort}</span>}
                  {eintrittsJahr && (
                    <span className="text-xs text-muted-foreground">seit {eintrittsJahr}</span>
                  )}
                  {m.archiviert && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                      <Archive size={10} /> Archiviert
                    </span>
                  )}
                  {isAdminUser && m.einladung_gesendet_am && !m.user_id && !m.archiviert && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      Eingeladen
                    </span>
                  )}
                </div>
              </div>

              {/* Mitgliedsnummer */}
              {m.mitgliedsnummer && (
                <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:block">
                  #{m.mitgliedsnummer}
                </span>
              )}

              <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Leerer State */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <User size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          {search ? (
            <>
              <p className="text-foreground font-medium">Keine Ergebnisse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Für „{search}" wurde kein Mitglied gefunden
              </p>
              <button
                onClick={() => setSearch('')}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Suche zurücksetzen
              </button>
            </>
          ) : (
            <p className="text-muted-foreground">Keine Mitglieder in dieser Kategorie</p>
          )}
        </div>
      )}
    </div>
  );
}
