import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, ROLLEN_LABELS } from '@/lib/roles';
import { Shield, Search, ChevronDown, ChevronUp, Lock } from 'lucide-react';

const ROLLEN_OPTIONEN = [
  { value: 'mitglied',        label: 'Mitglied',        desc: 'Grundzugang', icon: '👤' },
  { value: 'elternkonto',     label: 'Elternkonto',     desc: 'Für Erziehungsberechtigte', icon: '👨‍👩‍👧' },
  { value: 'spartenleiter',   label: 'Spartenleiter',   desc: 'Dienste & Check-In', icon: '📋' },
  { value: 'kassierer',       label: 'Kassierer',       desc: 'Finanzen & Beiträge', icon: '💰' },
  { value: 'stellv_vorstand', label: 'Stv. Vorstand',   desc: 'Vollzugriff (ohne Admin)', icon: '🎭' },
  { value: 'vorstand',        label: 'Vorstand',        desc: 'Vollzugriff', icon: '👑' },
];

const ZUSATZ_BERECHTIGUNGEN = [
  { value: 'inventar',  label: 'Inventar & Verleih', desc: 'Kann Gegenstände ausleihen und verwalten', icon: '📦' },
  { value: 'ausschuss', label: 'Ausschuss-Zugang',   desc: 'Sieht Ausschussbereich & Sitzungen', icon: '🏛️' },
  { value: 'todos',     label: 'Aufgaben',            desc: 'Sieht und erstellt Aufgaben', icon: '✅' },
];

export default function Berechtigungen() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [mitglieder, setMitglieder] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState({});

  useEffect(() => {
    if (!admin) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [m, u] = await Promise.all([
      base44.entities.Mitglied.list('nachname', 500),
      base44.entities.User.list(),
    ]);
    setMitglieder(m.filter(x => !x.archiviert));
    setUsers(u);
    setLoading(false);
  };

  const getLinkedUser = (mitglied) => users.find(u => u.id === mitglied.user_id);

  const handleRolleChange = async (mitglied, newRole) => {
    setSaving(p => ({ ...p, [mitglied.id]: true }));
    await base44.entities.Mitglied.update(mitglied.id, { app_rolle: newRole });
    const linkedUser = getLinkedUser(mitglied);
    if (linkedUser) {
      await base44.entities.User.update(linkedUser.id, { role: newRole });
      setUsers(prev => prev.map(u => u.id === linkedUser.id ? { ...u, role: newRole } : u));
    }
    setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, app_rolle: newRole } : m));
    setSaving(p => ({ ...p, [mitglied.id]: false }));
  };

  const handleZusatzChange = async (mitglied, berechtigung, checked) => {
    const aktuell = mitglied.zusatz_berechtigungen || [];
    const neu = checked
      ? [...aktuell, berechtigung]
      : aktuell.filter(b => b !== berechtigung);
    setSaving(p => ({ ...p, [`${mitglied.id}_z`]: true }));
    await base44.entities.Mitglied.update(mitglied.id, { zusatz_berechtigungen: neu });
    setMitglieder(prev => prev.map(m => m.id === mitglied.id ? { ...m, zusatz_berechtigungen: neu } : m));
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
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Nur für Administratoren.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={22} className="text-primary" /> Berechtigungen
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rollen & Zusatz-Berechtigungen aller Mitglieder</p>
        </div>
      </div>

      {/* Legende */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Rollen-Übersicht</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ROLLEN_OPTIONEN.map(r => (
            <div key={r.value} className="flex items-center gap-2 text-xs">
              <span>{r.icon}</span>
              <div>
                <p className="text-foreground font-medium">{r.label}</p>
                <p className="text-muted-foreground">{r.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-3 pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zusatz-Berechtigungen</p>
          <div className="flex flex-wrap gap-3">
            {ZUSATZ_BERECHTIGUNGEN.map(z => (
              <div key={z.value} className="flex items-center gap-1.5 text-xs">
                <span>{z.icon}</span>
                <span className="text-foreground font-medium">{z.label}</span>
                <span className="text-muted-foreground">– {z.desc}</span>
              </div>
            ))}
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
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header – immer sichtbar */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
          {mitglied.profilbild_url
            ? <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
            : `${mitglied.vorname?.[0]}${mitglied.nachname?.[0]}`
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{mitglied.vorname} {mitglied.nachname}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {ROLLEN_OPTIONEN.find(r => r.value === aktuelleRolle)?.icon} {ROLLEN_OPTIONEN.find(r => r.value === aktuelleRolle)?.label || aktuelleRolle}
            </span>
            {zusatz.map(b => {
              const z = ZUSATZ_BERECHTIGUNGEN.find(z => z.value === b);
              return z ? (
                <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {z.icon} {z.label}
                </span>
              ) : null;
            })}
            {!linkedUser && <span className="text-[10px] text-muted-foreground">– kein App-Login</span>}
            {linkedUser && <span className="text-[10px] text-green-400">✓ App-Login aktiv</span>}
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
              {ROLLEN_OPTIONEN.map(r => (
                <button
                  key={r.value}
                  onClick={() => onRolleChange(r.value)}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    aktuelleRolle === r.value
                      ? 'bg-primary/15 border-primary'
                      : 'bg-secondary/40 border-border hover:border-primary/40'
                  }`}
                >
                  <span className="text-base shrink-0">{r.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${aktuelleRolle === r.value ? 'text-primary' : 'text-foreground'}`}>{r.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Zusatz-Berechtigungen */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Zusatz-Berechtigungen</p>
            <div className="space-y-2">
              {ZUSATZ_BERECHTIGUNGEN.map(z => {
                const aktiv = zusatz.includes(z.value);
                return (
                  <label key={z.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={aktiv}
                      onChange={e => onZusatzChange(z.value, e.target.checked)}
                      disabled={isSaving}
                      className="rounded"
                    />
                    <span className="text-lg">{z.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{z.label}</p>
                      <p className="text-xs text-muted-foreground">{z.desc}</p>
                    </div>
                    {aktiv && <span className="ml-auto text-xs text-green-400 font-semibold">✓ Aktiv</span>}
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