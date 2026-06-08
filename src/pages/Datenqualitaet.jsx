import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { differenceInYears } from 'date-fns';

const JUGEND_STATUS = ['Kleinkind 0-3', 'Kinder 4-10', 'Jugendliche 11-14', 'Jungaktive 15-17'];

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
  error: { label: 'Fehler', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  warning: { label: 'Warnung', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  info: { label: 'Info', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

export default function Datenqualitaet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = isAdmin(user);

  const [loading, setLoading] = useState(true);
  const [mitglieder, setMitglieder] = useState([]);
  const [haes, setHaes] = useState([]);
  const [historien, setHistorien] = useState([]);
  const [beitraege, setBeitraege] = useState([]);

  useEffect(() => {
    if (!admin) { navigate('/'); return; }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, h, hist, b] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Haes.list('haesnummer', 300),
        base44.entities.HaesHistorie.list('-created_date', 800),
        base44.entities.Beitrag.list('-created_date', 800),
      ]);
      setMitglieder(m);
      setHaes(h);
      setHistorien(hist);
      setBeitraege(b);
    } catch (e) {}
    setLoading(false);
  };

  const probleme = useMemo(() => {
    const result = [];

    // 1. Mitglied ohne Geburtsdatum
    mitglieder.forEach(m => {
      if (!m.geburtsdatum) {
        result.push({ severity: 'warning', text: `${m.vorname} ${m.nachname}: kein Geburtsdatum`, link: `/mitglieder/${m.id}` });
      }
    });

    // 2. Mitglied ohne Eintrittsdatum
    mitglieder.forEach(m => {
      if (!m.eintrittsdatum && !['Kleinkind 0-3', 'Kinder 4-10'].includes(m.mitgliedsstatus)) {
        result.push({ severity: 'warning', text: `${m.vorname} ${m.nachname}: kein Eintrittsdatum`, link: `/mitglieder/${m.id}` });
      }
    });

    // 3. Status passt nicht zum Alter
    mitglieder.forEach(m => {
      const warn = pruefeStatusAlter(m);
      if (warn) result.push({ severity: 'error', text: `${m.vorname} ${m.nachname}: ${warn}`, link: `/mitglieder/${m.id}` });
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
      if (ehrenmitglieder.has(b.mitglied_id) && b.betrag > 0 && b.zahlungsstatus !== 'Erlassen') {
        const m = mitglieder.find(m => m.id === b.mitglied_id);
        result.push({ severity: 'warning', text: `${m?.vorname} ${m?.nachname} (Ehrenmitglied) hat Beitrag ${b.betrag}€ (${b.jahr})`, link: `/beitraege` });
      }
    });

    // 6. SEPA unvollständig (für aktive Mitglieder mit Beiträgen)
    const mitMitBeitraegen = new Set(beitraege.map(b => b.mitglied_id));
    mitglieder.filter(m => mitMitBeitraegen.has(m.id) && m.mitgliedsstatus === 'Aktiv').forEach(m => {
      if (!m.iban || !m.kontoinhaber) {
        result.push({ severity: 'info', text: `${m.vorname} ${m.nachname}: SEPA-Daten unvollständig`, link: `/mitglieder/${m.id}` });
      }
    });

    // 7. Häs ohne Besitzer aber Status "Aktiv"
    haes.filter(h => h.status === 'Aktiv' && !h.aktueller_besitzer_id).forEach(h => {
      result.push({ severity: 'warning', text: `Häs ${h.haesnummer}: Status "Aktiv" aber kein Besitzer`, link: `/haes/${h.id}` });
    });

    // Sort by severity
    const order = { error: 0, warning: 1, info: 2 };
    return result.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [mitglieder, haes, historien, beitraege]);

  const errors = probleme.filter(p => p.severity === 'error');
  const warnings = probleme.filter(p => p.severity === 'warning');
  const infos = probleme.filter(p => p.severity === 'info');

  if (!admin) return null;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Datenqualität</h1>
          </div>
          <p className="text-sm text-muted-foreground">{probleme.length} Probleme gefunden · {mitglieder.length} Mitglieder geprüft</p>
        </div>
        <button onClick={loadData} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Übersicht */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`rounded-xl p-4 text-center border ${errors.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-card border-border'}`}>
          <p className={`text-2xl font-bold ${errors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{errors.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Fehler</p>
        </div>
        <div className={`rounded-xl p-4 text-center border ${warnings.length > 0 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-card border-border'}`}>
          <p className={`text-2xl font-bold ${warnings.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>{warnings.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Warnungen</p>
        </div>
        <div className="rounded-xl p-4 text-center bg-card border border-border">
          <p className="text-2xl font-bold text-blue-400">{infos.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Hinweise</p>
        </div>
      </div>

      {probleme.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">Keine Probleme gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">Alle geprüften Daten sind konsistent.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {probleme.map((p, idx) => {
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
                  <p className="text-sm text-foreground">{p.text}</p>
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