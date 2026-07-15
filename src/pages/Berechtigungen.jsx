import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, ROLLEN_LABELS } from '@/lib/roles';
import { Shield, Search, ChevronDown, ChevronUp, Lock, Check, AlertCircle, User, Users, ClipboardList, Wallet, Crown, Package, Landmark, CheckSquare } from 'lucide-react';

const ROLLEN_OPTIONEN = [
  { value: 'mitglied',        label: 'Mitglied',        desc: 'Grundzugang',          Icon: User },
  { value: 'elternkonto',     label: 'Elternkonto',     desc: 'Für Erziehungsberechtigte', Icon: Users },
  { value: 'spartenleiter',   label: 'Spartenleiter',   desc: 'Dienste & Check-In',    Icon: ClipboardList },
  { value: 'kassierer',       label: 'Kassierer',       desc: 'Finanzen & Beiträge',   Icon: Wallet },
  { value: 'stellv_vorstand', label: 'Stv. Vorstand',   desc: 'Vollzugriff (ohne Admin)', Icon: Shield },
  { value: 'vorstand',        label: 'Vorstand',        desc: 'Vollzugriff',           Icon: Crown },
];

const ZUSATZ_BERECHTIGUNGEN = [
  { value: 'inventar',  label: 'Inventar & Verleih', desc: 'Kann Gegenstände ausleihen und verwalten', Icon: Package },
  { value: 'ausschuss', label: 'Ausschuss-Zugang',   desc: 'Sieht Ausschussbereich & Sitzungen',       Icon: Landmark },
  { value: 'todos',     label: 'Aufgaben',           desc: 'Sieht und erstellt Aufgaben',             Icon: CheckSquare },
];

export default function Berechtigungen() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [mitglieder, setMitglieder] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!admin) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, u] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.User.list(),
      ]);
      setMitglieder(m.filter(x => !x.archiviert));
      setUsers(u);
    } catch (e) {
      console.error('Fehler beim Laden der Berechtigungen:', e);
      setError('Daten konnten nicht geladen werden. Bitte später erneut versuchen.');
    }
    setLoading(false);
  };

  const getLinkedUser = (mitglied) => users.find(u => u.id === mitglied.user_id);

  const handleRolleChange = async (mitglied, newRole) => {
    const prevRolle = users.find(u => u.id === mitglied.user_id)?.role || mitglied.app_rolle || 'mitglied';
    setSaving(p => ({ ...p, [mitglied.id]: true }));
    setError(null);
    try {
      await base44.entities.Mitglied.update(mitglied.id, { app_rolle: newRole });
      const linkedUser = getLinkedUser(mitglied);
      if (linkedUser) {
        await base44.entities.User.update(linkedUser.id, { role: newRole });
        setUsers(prev => prev.map(u => u.id === linkedUser.id ? { ...u, role: newRole } : u));
      }
      setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, app_rolle: newRole } : m));
    } catch (e) {
      console.error('Fehler beim Ändern der Rolle:', e);
      setError(`Rolle konnte nicht geändert werden für ${mitglied.vorname} ${mitglied.nachname}.`);
      // Rollback
      setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, app_rolle: prevRolle } : m));
    }
    setSaving(p => ({ ...p, [mitglied.id]: false }));
  };

  const handleZusatzChange = async (mitglied, berechtigung, checked) => {
    const aktuell = mitglied.zusatz_berechtigungen || [];
    const neu = checked
      ? [...aktuell, berechtigung]
      : aktuell.filter(b => b !== berechtigung);
    setSaving(p => ({ ...p, [`${mitglied.id}_z`]: true }));
    setError(null);
    try {
      await base44.entities.Mitglied.update(mitglied.id, { zusatz_berechtigungen: neu });
      setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, zusatz_berechtigungen: neu } : m));
    } catch (e) {
      console.error('Fehler beim Ändern der Zusatz-Berechtigung:', e);
      setError(`Zusatz-Berechtigung konnte nicht geändert werden für ${mitglied.vorname} ${mitglied.nachname}.`);
      // Rollback
      setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, zusatz_berechtigungen: aktuell } : m));
    }
    setSaving(p => ({ ...p, [`${mitglied.id}_z`]: false }));
  };

  const gefiltert = mitglieder.filter(m =>
    `${m.vorname} ${m.nachname}`.toLowerCase().includes(search.toLowerCase()) ||
    m.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Nur für Administratoren.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Berechtigungen werden geladen…</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white flex items-center gap-2">
            <Shield size={22} className="text-primary" /> Berechtigungen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rollen & Zusatz-Berechtigungen aller Mitglieder</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-900/20 border border-red-700/30 mb-5">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <ChevronUp size={14} className="rotate-90" />
          </button>
        </div>
      )}

      {/* Legende */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Rollen-Übersicht</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLLEN_OPTIONEN.map(r => {
            const Icon = r.Icon;
            return (
              <div key={r.value} className="flex items-center gap-2 text-xs">
                <Icon size={14} className="text-primary shrink-0" />
                <div>
                  <p className="text-white font-medium">{r.label}</p>
                  <p className="text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border mt-3 pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zusatz-Berechtigungen</p>
          <div className="flex flex-wrap gap-3">
            {ZUSATZ_BERECHTIGUNGEN.map(z => {
              const Icon = z.Icon;
              return (
                <div key={z.value} className="flex items-center gap-1.5 text-xs">
                  <Icon size={14} className="text-primary shrink-0" />
                  <span className="text-white font-medium">{z.label}</span>
                  <span className="text-muted-foreground">– {z.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Mitglied suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {/* Mitglieder-Liste */}
      <div className="space-y-2">
        {gefiltert.map(m => {
          const linkedUser = getLinkedUser(m);
          const aktuelleRolle = linkedUser?.role || m.app_rolle || 'mitglied';
          const zusatz = m.zusatz_berechtigungen || [];
          const isSaving = saving[m.id] || saving[`${m.id}_z`];

          return (
            <MitgliedBerechtigung
              key={m.id}
              mitglied={m}
              linkedUser={linkedUser}
              aktuelleRolle={aktuelleRolle}
              zusatz={zusatz}
              isSaving={isSaving}
              onRolleChange={(r) => handleRolleChange(m, r)}
              onZusatzChange={(b, c) => handleZusatzChange(m, b, c)}
            />
          );
        })}
      </div>

      {gefiltert.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">Keine Mitglieder gefunden</div>
      )}
    </div>
  );
}

function MitgliedBerechtigung({ mitglied, linkedUser, aktuelleRolle, zusatz, isSaving, onRolleChange, onZusatzChange }) {
  const [expanded, setExpanded] = useState(false);
  const rolleOption = ROLLEN_OPTIONEN.find(r => r.value === aktuelleRolle);
  const RolleIcon = rolleOption?.Icon || User;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header – immer sichtbar */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
          {mitglied.profilbild_url
            ? <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
            : `${mitglied.vorname?.[0]}${mitglied.nachname?.[0]}`
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{mitglied.vorname} {mitglied.nachname}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium flex items-center gap-1">
              <RolleIcon size={10} /> {rolleOption?.label || aktuelleRolle}
            </span>
            {zusatz.map(b => {
              const z = ZUSATZ_BERECHTIGUNGEN.find(z => z.value === b);
              const ZIcon = z?.Icon;
              return z ? (
                <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-muted-foreground flex items-center gap-1">
                  {ZIcon && <ZIcon size={10} />} {z.label}
                </span>
              ) : null;
            })}
            {!linkedUser && <span className="text-[10px] text-muted-foreground">– kein App-Login</span>}
            {linkedUser && (
              <span className="text-[10px] text-green-400 flex items-center gap-0.5">
                <Check size={10} /> App-Login aktiv
              </span>
            )}
          </div>
        </div>
        {isSaving
          ? <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
          : expanded ? <ChevronUp size={15} className="text-muted-foreground shrink-0" /> : <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-4">
          {/* Rolle */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Hauptrolle</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ROLLEN_OPTIONEN.map(r => {
                const Icon = r.Icon;
                const aktiv = aktuelleRolle === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => onRolleChange(r.value)}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all disabled:opacity-50 ${
                      aktiv
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-neutral-800/40 border-border hover:border-primary/30'
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 ${aktiv ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${aktiv ? 'text-primary' : 'text-white'}`}>{r.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zusatz-Berechtigungen */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Zusatz-Berechtigungen</p>
            <div className="space-y-2">
              {ZUSATZ_BERECHTIGUNGEN.map(z => {
                const Icon = z.Icon;
                const aktiv = zusatz.includes(z.value);
                return (
                  <label key={z.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-neutral-800/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={aktiv}
                      onChange={e => onZusatzChange(z.value, e.target.checked)}
                      disabled={isSaving}
                      className="rounded accent-[#EA2525]"
                    />
                    <Icon size={16} className="text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">{z.label}</p>
                      <p className="text-xs text-muted-foreground">{z.desc}</p>
                    </div>
                    {aktiv && (
                      <span className="ml-auto text-xs text-green-400 font-semibold flex items-center gap-0.5">
                        <Check size={12} /> Aktiv
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
