import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import MobileSelect from '@/components/MobileSelect';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannMitgliederlisteSehn, kannAusschussSehn } from '@/lib/roles';
import { Search, Plus, User, ChevronRight, Archive, Download, Shirt, FileText, FolderOpen, Send } from 'lucide-react';
import NeuerAntragModal from '@/components/mitglied/NeuerAntragModal';
import BulkEinladenModal from '@/components/mitglied/BulkEinladenModal';
import MitgliederStatistik from '@/components/mitglieder/MitgliederStatistik';
import MitgliederCockpit from '@/components/mitglieder/MitgliederCockpit';
import { AenderungsantraegeVerwaltung } from '@/components/mitglied/Aenderungsantraege';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import { format, differenceInYears } from 'date-fns';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const STATUS_COLORS = {
  'Aktiv':              'bg-green-500/20 text-green-400',
  'Passiv':             'bg-yellow-500/20 text-yellow-400',
  'Passiv mit Häs':     'bg-primary/20 text-primary',
  'Ehrenmitglied':      'bg-purple-500/20 text-purple-400',
  'Jugendliche 11-14':  'bg-blue-500/20 text-blue-400',
  'Jungaktive 15-17':   'bg-cyan-500/20 text-cyan-400',
  'Kinder 4-10':        'bg-pink-500/20 text-pink-400',
  'Kleinkind 0-3':      'bg-rose-500/20 text-rose-400',
  'Leihäs':             'bg-gray-500/20 text-muted-foreground',
  'Verstorben':         'bg-gray-600/30 text-muted-foreground',
};

const ALLE_STATUS = [
  'Alle', 'Aktiv', 'Passiv', 'Passiv mit Häs', 'Ehrenmitglied',
  'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3',
  'Leihäs', 'Verstorben',
];

const SORT_OPTIONS = [
  { value: 'nachname',    label: 'Name A–Z' },
  { value: 'haesnummer',  label: 'Häsnummer' },
  { value: 'eintritt',    label: 'Neuste zuerst' },
  { value: 'alter',       label: 'Alter' },
];

export default function Mitglieder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stateKey = `mitglieder-filter:${user?.id || 'anon'}`;
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(stateKey) || '{}'); } catch { return {}; } })();
  const [search, setSearch] = useState(saved.search || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || saved.statusFilter || 'Alle');
  const [gruppeFilter, setGruppeFilter] = useState(saved.gruppeFilter || 'Alle');
  const [zeigeArchiviert, setZeigeArchiviert] = useState(saved.zeigeArchiviert || false);
  const [sortBy, setSortBy] = useState(saved.sortBy || 'nachname');
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [viewName, setViewName] = useState('');
  const viewKey = `mitglieder-ansichten:${user?.id || 'anon'}`;
  const [views, setViews] = useState(() => { try { return JSON.parse(localStorage.getItem(viewKey) || '[]'); } catch { return []; } });
  const [showAntragModal, setShowAntragModal] = useState(false);
  const [showBulkEinladen, setShowBulkEinladen] = useState(false);
  const isAdminUser = isAdmin(user);
  const kannListe = kannMitgliederlisteSehn(user);
  const kannStatistik = kannAusschussSehn(user);
  const darfVerwalten = ['admin', 'vorstand', 'stellv_vorstand'].includes(user?.role);
  const darfEntscheiden = ['admin', 'vorstand'].includes(user?.role);
  useEffect(() => { sessionStorage.setItem(stateKey, JSON.stringify({ search, statusFilter, gruppeFilter, zeigeArchiviert, sortBy })); }, [stateKey, search, statusFilter, gruppeFilter, zeigeArchiviert, sortBy]);
  useEffect(() => { localStorage.setItem(viewKey, JSON.stringify(views)); }, [viewKey, views]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mitglieder', kannListe],
    queryFn: async () => {
      let m;
      if (kannListe) {
        m = await base44.entities.Mitglied.list('nachname', 2000);
      } else if (user?.id) {
        m = await base44.entities.Mitglied.filter({ user_id: user.id });
      } else {
        m = [];
      }
      const [allHaes, allGruppen] = await Promise.all([
        base44.entities.Haes.list('haesnummer', 1000),
        base44.entities.Haesgruppe.list('name', 200),
      ]);
      const map = {};
      for (const h of allHaes) {
        if (h.aktueller_besitzer_id && h.haesnummer && h.status === 'Aktiv') {
          map[h.aktueller_besitzer_id] = h.haesnummer;
        }
      }
      const gruppenMap = {};
      for (const g of allGruppen) {
        gruppenMap[g.id] = { name: g.name, farbe: g.farbe };
      }
      return { mitglieder: m, haesMap: map, gruppenMap };
    },
  });
  const mitglieder = data?.mitglieder || []
  const queryError = data === undefined && !isLoading;
  const haesMap = data?.haesMap || {};
  const gruppenMap = data?.gruppenMap || {};
  const gruppen = Object.entries(gruppenMap)
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await refetch();
  }, [refetch]));

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
          m.mitgliedsnummer?.toString().includes(s) ||
          haesMap[m.id]?.toString().includes(s)
        );
      }
    }

    if (statusFilter !== 'Alle') {
      result = result.filter(m => m.mitgliedsstatus === statusFilter);
    }

    if (gruppeFilter !== 'Alle') {
      result = result.filter(m => m.haesgruppe_id === gruppeFilter || m.haesgruppen_ids?.includes(gruppeFilter));
    }

    // Sortierung
    result = [...result].sort((a, b) => {
      if (sortBy === 'eintritt') {
        return (b.eintrittsdatum || '') > (a.eintrittsdatum || '') ? 1 : -1;
      }
      if (sortBy === 'alter') {
        return (a.geburtsdatum || '9999') > (b.geburtsdatum || '9999') ? 1 : -1;
      }
      if (sortBy === 'haesnummer') {
        const aNum = haesMap[a.id] ? parseInt(haesMap[a.id]) || 9999 : 9999;
        const bNum = haesMap[b.id] ? parseInt(haesMap[b.id]) || 9999 : 9999;
        if (aNum !== bNum) return aNum - bNum;
        // Fallback: Nachname
        return `${a.nachname}`.localeCompare(`${b.nachname}`, 'de');
      }
      // nachname
      return `${a.nachname}${a.vorname}`.localeCompare(`${b.nachname}${b.vorname}`, 'de');
    });

    return result;
  }, [mitglieder, search, statusFilter, gruppeFilter, zeigeArchiviert, sortBy, haesMap]);

  const getAlter = (geb) => geb ? differenceInYears(new Date(), new Date(geb)) : null;

  const handleExport = async (selectedOnly = false) => {
    // Häs-Gruppen für Export laden
    let gruppenMap = {};
    try {
      const gruppen = await base44.entities.Haesgruppe.list('name', 200);
      gruppen.forEach(g => { gruppenMap[g.id] = g.name; });
    } catch (e) { console.error('Error:', e); }

    const rows = (selectedOnly ? mitglieder.filter(m => selected.includes(m.id)) : mitglieder.filter(m => !m.archiviert))
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

    // The new selected export intentionally excludes payment and mandate information.
    if (selectedOnly) rows.forEach(row => { for (const k of ['Kontoinhaber', 'Bank', 'IBAN', 'Mandatnummer', 'Mandatdatum']) delete row[k]; });
    if (!rows.length) { toast.error('Keine Mitglieder zum Export ausgewählt.'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    // Spaltenbreiten
    ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(k.length, 12) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mitglieder');
    XLSX.writeFile(wb, `Mitgliederliste_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  async function bulkAction(aktion) {
    if (!selected.length || !darfEntscheiden) return;
    if (aktion === 'status_setzen' && !bulkStatus) return toast.error('Bitte einen Status auswählen.');
    if (aktion === 'status_setzen' && !(await confirmDialog(`Status für ${selected.length} ausgewählte Mitglieder auf „${bulkStatus}“ setzen?`))) return;
    setBulkBusy(true);
    try {
      const res = await base44.functions.invoke('mitgliederBulkSicher', { aktion, mitglied_ids: selected, ...(aktion === 'status_setzen' ? { mitgliedsstatus: bulkStatus } : {}) });
      if (aktion === 'einladung_entwurf') setDraft(res.data?.entwurf || null);
      else { toast.success(`${res.data?.ok || 0} von ${selected.length} Mitgliedern aktualisiert.`); setSelected([]); await refetch(); await queryClient.invalidateQueries({ queryKey: ['mitglieder', 'handlungsbedarf'] }); }
    } catch (e) { console.error('Sammelaktion:', e); toast.error('Sammelaktion fehlgeschlagen.'); }
    finally { setBulkBusy(false); }
  }
  function saveView() {
    const name = viewName.trim().slice(0, 40);
    if (!name) return;
    setViews(prev => [...prev.filter(v => v.name !== name), { name, statusFilter, gruppeFilter, zeigeArchiviert, sortBy }].slice(-8));
    setViewName('');
  }
  function applyView(view) { setSearch(''); setStatusFilter(view.statusFilter || 'Alle'); setGruppeFilter(view.gruppeFilter || 'Alle'); setZeigeArchiviert(!!view.zeigeArchiviert); setSortBy(view.sortBy || 'nachname'); setSelected([]); }

  if (!isLoading && !data) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <p className="text-sm text-muted-foreground">Mitglieder konnten nicht geladen werden</p>
      <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
        Erneut versuchen
      </button>
    </div>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Mitglieder werden geladen…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-4 lg:px-6 py-6 max-w-7xl mx-auto overflow-x-hidden">
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
              onClick={() => setShowBulkEinladen(true)}
              title="Mitglieder in Bulk einladen"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Einladen</span>
            </button>
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

      {darfVerwalten && <MitgliederCockpit onMemberSelect={id => navigate(`/mitglieder/${id}`)} />}
      {darfEntscheiden && <AenderungsantraegeVerwaltung />}

      {/* Statistik (nur Ausschuss & Spartenleiter) */}
      {kannStatistik && (
        <MitgliederStatistik
          mitglieder={mitglieder}
          gruppenMap={gruppenMap}
          onStatusFilter={(status) => setStatusFilter(status)}
        />
      )}

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

      {showBulkEinladen && (
        <BulkEinladenModal
          onClose={() => setShowBulkEinladen(false)}
        />
      )}

      {showAntragModal && (
        <NeuerAntragModal
          onClose={() => setShowAntragModal(false)}
          onMitgliedAngelegt={() => { refetch(); setShowAntragModal(false); }}
        />
      )}

      {/* Suche + Sort + Filter — sticky */}
      <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 pb-2 pt-2 bg-background/95 backdrop-blur-sm mb-3 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Name, #Nr, Häs-Nr., E-Mail, Ort…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>
        <MobileSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} className="!py-2.5" />
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

      {/* Häsgruppen-/Sparten-Filter */}
      {gruppen.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-hide items-center">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 mr-0.5">Sparte:</span>
          <button
            onClick={() => setGruppeFilter('Alle')}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              gruppeFilter === 'Alle'
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            Alle
          </button>
          {gruppen.map(g => (
            <button
              key={g.id}
              onClick={() => setGruppeFilter(g.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                gruppeFilter === g.id
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: gruppeFilter === g.id ? '#ffffff' : (g.farbe || '#EA2525') }}
              />
              {g.name}
            </button>
          ))}
        </div>
      )}
      </div>

      {isAdminUser && <div className="mb-3 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">Ansichten:</span>
        {views.map(v => <button type="button" key={v.name} onClick={() => applyView(v)} className="rounded-md border border-border bg-card px-2 py-1 text-foreground">{v.name}</button>)}
        <input aria-label="Name der Filteransicht" placeholder="Ansicht speichern…" value={viewName} onChange={e => setViewName(e.target.value)} maxLength={40} className="rounded-md border border-border bg-card px-2 py-1 text-foreground" />
        <button type="button" onClick={saveView} disabled={!viewName.trim()} className="text-primary disabled:opacity-50">Speichern</button>
      </div>}

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

      {darfEntscheiden && <div className="mb-3 rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-2 text-foreground"><input type="checkbox" checked={filtered.length > 0 && filtered.every(m => selected.includes(m.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...filtered.map(m => m.id)])] : selected.filter(id => !filtered.some(m => m.id === id)))} /> Sichtbare auswählen</label>
        <span className="text-muted-foreground">{selected.length} ausgewählt</span>
        {selected.length > 0 && <><button type="button" onClick={() => handleExport(true)} className="text-primary">Auswahl exportieren</button>
          <button type="button" onClick={() => bulkAction('einladung_entwurf')} disabled={bulkBusy} className="text-primary">Nachrichtentwurf</button>
          <MobileSelect value={bulkStatus} onChange={setBulkStatus} options={ALLE_STATUS.filter(s => s !== 'Alle' && s !== 'Verstorben').map(s => ({ label: s, value: s }))} className="!py-1" />
          <button type="button" onClick={() => bulkAction('status_setzen')} disabled={bulkBusy || !bulkStatus} className="text-primary disabled:opacity-50">Status bestätigen</button>
          <button type="button" onClick={() => setSelected([])} className="text-muted-foreground">Auswahl löschen</button></>}
      </div>}
      {draft && <div className="mb-3 rounded-lg border border-border bg-card p-4 text-sm text-foreground"><div className="flex justify-between"><strong>Nachrichtentwurf, kein Versand</strong><button onClick={() => setDraft(null)} aria-label="Entwurf schließen">Schließen</button></div><p className="text-xs text-muted-foreground mt-2">{draft.empfaenger?.length || 0} ausgewählt, {draft.mitEmail || 0} mit E-Mail. Es wird nichts versendet.</p><input aria-label="Betreff" value={draft.betreff || ''} onChange={e => setDraft(p => ({ ...p, betreff: e.target.value }))} className="mt-2 w-full rounded-md border border-border bg-background p-2 text-foreground" /><textarea aria-label="Nachrichtentext" value={draft.text || ''} onChange={e => setDraft(p => ({ ...p, text: e.target.value }))} rows={6} className="mt-2 w-full rounded-md border border-border bg-background p-2 text-foreground" /></div>}
      {/* Liste */}
      <div className="space-y-1.5">
        {filtered.map(m => {
          const alter = getAlter(m.geburtsdatum);
          const statusColor = STATUS_COLORS[m.mitgliedsstatus] || 'bg-gray-500/20 text-muted-foreground';
          const hatHaes = !!m.haesgruppe_id;
          const haesNr = haesMap[m.id] || null;
          const eintrittsJahr = m.eintrittsdatum ? format(new Date(m.eintrittsdatum), 'yyyy') : null;

          return (
            <div key={m.id} className="flex items-center gap-2">
            {darfEntscheiden && <input aria-label={`${m.vorname} ${m.nachname} auswählen`} type="checkbox" checked={selected.includes(m.id)} onChange={e => setSelected(prev => e.target.checked ? [...prev, m.id] : prev.filter(id => id !== m.id))} />}
            <Link
              to={`/mitglieder/${m.id}`}
              className="flex-1 flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/50 hover:bg-card/80 transition-all group min-w-0"
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
                  {haesNr && (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-mono font-medium" title={`Häsnummer ${haesNr}`}>
                      <Shirt size={10} className="shrink-0" />
                      {haesNr}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                    {m.mitgliedsstatus}
                  </span>
                  {(() => {
                    const gids = m.haesgruppen_ids?.length ? m.haesgruppen_ids : (m.haesgruppe_id ? [m.haesgruppe_id] : []);
                    return gids.slice(0, 2).map(gid => {
                      const g = gruppenMap[gid];
                      if (!g) return null;
                      return (
                        <span key={gid} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (g.farbe || '#888') + '20', color: g.farbe || '#888' }}>
                          {g.name}
                        </span>
                      );
                    });
                  })()}
                  {m.ort && <span className="text-xs text-muted-foreground truncate max-w-[100px] sm:max-w-none">{m.ort}</span>}
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
            </div>
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