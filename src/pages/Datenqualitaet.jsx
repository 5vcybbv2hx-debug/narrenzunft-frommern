import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, Shield, Filter } from 'lucide-react';
import { differenceInYears } from 'date-fns';

function pruefeStatusAlter(m) {
  if (!m.geburtsdatum || !m.mitgliedsstatus) return null;
  const alter = differenceInYears(new Date(), new Date(m.geburtsdatum));
  const s = m.mitgliedsstatus;
  if (s === 'Kleinkind 0-3' && alter > 3) return `Alter ${alter} passt nicht zu "${s}"`;
  if (s === 'Kinder 4-10' && (alter < 4 || alter > 10)) return `Alter ${alter} passt nicht zu "${s}"`;
  if (s === 'Jugendliche 11-14' && (alter < 11 || alter > 14)) return `Alter ${alter} passt nicht zu "${s}"`;
  if (s === 'Jungaktive 15-17' && (alter < 15 || alter > 17)) return `Alter ${alter} passt nicht zu "${s}"`;
  if (s === 'Aktiv' && alter < 18) return `Alter ${alter}: Mitglied ist noch keine 18`;
  return null;
}

const SEVERITY = {
  error: { label: 'Fehler', color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/30' },
  warning: { label: 'Warnung', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30' },
  info: { label: 'Info', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/30' },
};

export default function Datenqualitaet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [haes, setHaes] = useState([]);
  const [historien, setHistorien] = useState([]);
  const [beitraege, setBeitraege] = useState([]);
  const [filter, setFilter] = useState('all'); // all | error | warning | info

  useEffect(() => {
    if (!admin) { navigate('/'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, h, hist, b] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Haes.list('haesnummer', 300),
        base44.entities.HaesHistorie.list('-created_date', 800),
        base44.entities.Beitrag.list('-created_date', 800),
      ]);
      setMitglieder(m || []);
      setHaes(h || []);
      setHistorien(hist || []);
      setBeitraege(b || []);
    } catch (e) {
      console.error('Datenqualität laden:', e);
      setError('Daten konnten nicht geladen werden. Bitte erneut versuchen.');
    }
    setLoading(false);
  };

  const probleme = useMemo(() => {
    const result = [];

    // 1. Mitglied ohne Geburtsdatum
    mitglieder.forEach(m => {
      if (!m.geburtsdatum) {
        result.push({ severity: 'warning', text: `${m.vorname || ''} ${m.nachname || ''}: kein Geburtsdatum`, link: `/mitglieder/${m.id}` });
      }
    });

    // 2. Mitglied ohne Eintrittsdatum
    mitglieder.forEach(m => {
      if (!m.eintrittsdatum && !['Kleinkind 0-3', 'Kinder 4-10'].includes(m.mitgliedsstatus)) {
        result.push({ severity: 'warning', text: `${m.vorname || ''} ${m.nachname || ''}: kein Eintrittsdatum`, link: `/mitglieder/${m.id}` });
      }
    });

    // 3. Status passt nicht zum Alter
    mitglieder.forEach(m => {
      const warn = pruefeStatusAlter(m);
      if (warn) result.push({ severity: 'error', text: `${m.vorname || ''} ${m.nachname || ''}: ${warn}`, link: `/mitglieder/${m.id}` });
    });

    // 4. Häs mit mehreren aktiven Besitzern (über HaesHistorie)
    const aktiveNachHaes = {};
    historien.filter(h => h.aktiv).forEach(h => {
      if (!aktiveNachHaes[h.haes_id]) aktiveNachHaes[h.haes_id] = [];
      aktiveNachHaes[h.haes_id].push(h.mitglied_id);
    });
    Object.entries(aktiveNachHaes).forEach(([haesId, besitzer]) => {
      if (besitzer.length > 1) {
        const h = haes.find(h => h.id === haesId);
        result.push({ severity: 'error', text: `Häs ${h?.haesnummer || haesId}: ${besitzer.length} aktive Besitzer!`, link: `/haes/${haesId}` });
      }
    });

    // 5. Ehrenmitglied mit Beitrag > 0
    const ehrenmitglieder = new Set(mitglieder.filter(m => m.mitgliedsstatus === 'Ehrenmitglied').map(m => m.id));
    beitraege.forEach(b => {
      const betrag = parseFloat(b.betrag) || 0;
      if (ehrenmitglieder.has(b.mitglied_id) && betrag > 0 && b.zahlungsstatus !== 'Erlassen') {
        const m = mitglieder.find(m => m.id === b.mitglied_id);
        result.push({ severity: 'warning', text: `${m?.vorname || ''} ${m?.nachname || ''} (Ehrenmitglied) hat Beitrag ${betrag}€ (${b.jahr})`, link: `/beitraege` });
      }
    });

    // 6. SEPA unvollständig (für aktive Mitglieder mit Beiträgen)
    const mitMitBeitraegen = new Set(beitraege.map(b => b.mitglied_id));
    mitglieder.filter(m => mitMitBeitraegen.has(m.id) && m.mitgliedsstatus === 'Aktiv').forEach(m => {
      if (!m.iban || !m.kontoinhaber) {
        result.push({ severity: 'info', text: `${m.vorname || ''} ${m.nachname || ''}: SEPA-Daten unvollständig`, link: `/mitglieder/${m.id}` });
      }
    });

    // 7. Häs ohne Besitzer aber Status "Aktiv"
    haes.filter(h => h.status === 'Aktiv' && !h.aktueller_besitzer_id).forEach(h => {
      result.push({ severity: 'warning', text: `Häs ${h.haesnummer}: Status "Aktiv" aber kein Besitzer`, link: `/haes/${h.id}` });
    });

    const order = { error: 0, warning: 1, info: 2 };
    return result.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [mitglieder, haes, historien, beitraege]);

  const errors = probleme.filter(p => p.severity === 'error');
  const warnings = probleme.filter(p => p.severity === 'warning');
  const infos = probleme.filter(p => p.severity === 'info');

  const filteredProbleme = filter === 'all'
    ? probleme
    : probleme.filter(p => p.severity === filter);

  if (!admin) return null;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Daten werden geprüft…</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-primary" />
            <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white">Datenqualität</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {probleme.length} Probleme · {mitglieder.length} Mitglieder · {haes.length} Häs · {beitraege.length} Beiträge geprüft
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2.5 rounded-lg bg-neutral-800 text-muted-foreground hover:text-white hover:bg-neutral-700 transition-colors"
          title="Neu prüfen"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Übersichtskacheln als Filter */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <button
          onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
          className={`rounded-xl p-4 text-center border transition-all ${
            filter === 'error' ? 'ring-2 ring-primary' : ''
          } ${
            errors.length > 0
              ? 'bg-red-900/20 border-red-700/30 hover:border-red-600/50'
              : 'bg-card border-border hover:border-primary/30'
          }`}
        >
          <p className={`text-2xl font-bold font-oswald ${errors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{errors.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Fehler</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
          className={`rounded-xl p-4 text-center border transition-all ${
            filter === 'warning' ? 'ring-2 ring-primary' : ''
          } ${
            warnings.length > 0
              ? 'bg-yellow-900/20 border-yellow-700/30 hover:border-yellow-600/50'
              : 'bg-card border-border hover:border-primary/30'
          }`}
        >
          <p className={`text-2xl font-bold font-oswald ${warnings.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{warnings.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Warnungen</p>
        </button>
        <button
          onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}
          className={`rounded-xl p-4 text-center border transition-all ${
            filter === 'info' ? 'ring-2 ring-primary' : ''
          } ${infos.length > 0 ? 'bg-blue-900/20 border-blue-700/30 hover:border-blue-600/50' : 'bg-card border-border hover:border-primary/30'}`}
        >
          <p className="text-2xl font-bold font-oswald text-blue-400">{infos.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Hinweise</p>
        </button>
      </div>

      {/* Filter-Indikator */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-primary" />
          <span className="text-xs text-muted-foreground">
            Gefiltert: {SEVERITY[filter].label} · {filteredProbleme.length} von {probleme.length}
          </span>
          <button onClick={() => setFilter('all')} className="text-xs text-primary hover:underline">
            Alle anzeigen
          </button>
        </div>
      )}

      {/* Problem-Liste */}
      {filteredProbleme.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-white">
            {probleme.length === 0 ? 'Keine Probleme gefunden' : 'Keine Probleme in diesem Filter'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {probleme.length === 0
              ? 'Alle geprüften Daten sind konsistent.'
              : `Es gibt noch ${probleme.length} andere Probleme in anderen Kategorien.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProbleme.map((p, idx) => {
            const sev = SEVERITY[p.severity];
            return (
              <a
                key={idx}
                href={p.link}
                onClick={e => { e.preventDefault(); navigate(p.link); }}
                className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all hover:opacity-80 ${sev.bg}`}
              >
                <AlertTriangle size={15} className={`${sev.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{p.text}</p>
                </div>
                <span className={`text-xs font-medium shrink-0 ${sev.color}`}>{sev.label}</span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
