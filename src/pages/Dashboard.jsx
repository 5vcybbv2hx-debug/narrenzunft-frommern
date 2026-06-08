import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useAuth } from '@/lib/AuthContext';
import {
  Calendar, Users, Award, CreditCard, Briefcase,
  Shirt, ArrowRight, Star, ChevronRight, Shield,
  CheckCircle, AlertCircle, Clock
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { isAdmin, kannArbeitsdiensteVerwalten, istNurMitglied } from '@/lib/roles';
import MitgliedDashboard from '@/components/dashboard/MitgliedDashboard';

// Tageszeit-basierte Begrüßung
function getBegruessung(name) {
  const h = new Date().getHours();
  const vorname = name?.split(' ')[0] || 'Narr';
  if (h < 11) return `Guten Morgen, ${vorname} 👋`;
  if (h < 18) return `Guten Tag, ${vorname} 🎭`;
  return `Guten Abend, ${vorname} 🌙`;
}

function StatCard({ icon: Icon, label, value, color = 'text-primary', sub, onClick }) {
  return (
    <div
      className={`relative bg-card border border-border rounded-lg p-4 flex items-center gap-4 overflow-hidden ${onClick ? 'cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all duration-150' : ''}`}
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
      <div className={`ml-2 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center ${color} shrink-0`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-oswald font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, linkTo, linkLabel }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {Icon && <Icon size={18} className="text-muted-foreground" />}
      </div>
      <div className="p-5">{children}</div>
      {linkTo && (
        <div className="px-5 pb-4">
          <Link
            to={linkTo}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {linkLabel} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

const EVENT_TYP_STYLE = {
  'Umzug':             'bg-primary/20 text-primary',
  'Abendveranstaltung':'bg-purple-500/20 text-purple-400',
  'Probe':             'bg-blue-500/20 text-blue-400',
  'Ausflug':           'bg-teal-500/20 text-teal-400',
  'Sitzung':           'bg-yellow-500/20 text-yellow-400',
};

const EHRUNG_STATUS_STYLE = {
  'Vorgeschlagen': 'bg-yellow-500/20 text-yellow-400',
  'Genehmigt':     'bg-green-500/20 text-green-400',
  'Verliehen':     'bg-blue-500/20 text-blue-400',
  'Abgelehnt':     'bg-red-500/20 text-red-400',
};

export default function Dashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    mitglieder: 0, mitgliedAktiv: 0, mitgliedPassiv: 0, mitgliedJugend: 0,
    veranstaltungen: 0, offeneEhrungen: 0, offeneBeitraege: 0, arbeitsdienste: 0,
    haesGesamt: 0, haesFrei: 0, haesAktiv: 0, haesVerliehen: 0,
  });
  const [naechsteEvents, setNaechsteEvents] = useState([]);
  const [offeneEhrungen, setOffeneEhrungen] = useState([]);
  const [arbeitsdienste, setArbeitsdienste] = useState([]);
  const [beitraegeStats, setBeitraegeStats] = useState({ offen: 0, ueberfaellig: 0, bezahlt: 0 });
  const [neueMitglieder, setNeueMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdminUser = isAdmin(user);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await loadData();
  }, []));

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashResult, haesResult] = await Promise.all([
        base44.functions.invoke('getDashboardSicher', {}),
        isAdmin(user)
          ? base44.functions.invoke('getHaesSicher', { aktion: 'liste', limit: 500 }).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (!dashResult.data.erfolg) { setLoading(false); return; }

      const { mitglieder, veranstaltungen, arbeitsdienste, ehrungen, beitraege } = dashResult.data;
      const today = new Date().toISOString().split('T')[0];

      // Veranstaltungen
      setNaechsteEvents(veranstaltungen.filter(e => e.datum >= today).slice(0, 5));

      // Ehrungen – nur offene (nicht Verliehen/Abgelehnt)
      const offeneEh = ehrungen.filter(e => !['Verliehen','Abgelehnt'].includes(e.status));
      setOffeneEhrungen(offeneEh.slice(0, 4));

      // Arbeitsdienste
      setArbeitsdienste(arbeitsdienste.slice(0, 4));

      // Mitglieder
      setNeueMitglieder([...mitglieder].sort((a,b) =>
        (b.eintrittsdatum||'') > (a.eintrittsdatum||'') ? 1 : -1
      ).slice(0, 3));

      // Beiträge
      const offenB = beitraege.filter(b => b.zahlungsstatus === 'Offen');
      const uebB   = beitraege.filter(b => b.zahlungsstatus === 'Überfällig');
      const bezB   = beitraege.filter(b => b.zahlungsstatus === 'Bezahlt');
      setBeitraegeStats({
        offen:       offenB.reduce((s,b) => s + (b.betrag||0), 0),
        ueberfaellig:uebB.reduce((s,b) => s + (b.betrag||0), 0),
        bezahlt:     bezB.reduce((s,b) => s + (b.betrag||0), 0),
      });

      // Häs-Stats aus Backend oder aus Dashboard-Daten
      let haesGesamt = 0, haesFrei = 0, haesAktiv = 0, haesVerliehen = 0;
      if (haesResult?.data?.haes) {
        const hl = haesResult.data.haes;
        haesGesamt   = hl.length;
        haesFrei     = hl.filter(h => h.status === 'Frei').length;
        haesAktiv    = hl.filter(h => h.status === 'Aktiv').length;
        haesVerliehen= hl.filter(h => h.status === 'Verliehen').length;
      }

      setStats({
        mitglieder:    mitglieder.length,
        mitgliedAktiv: mitglieder.filter(m => m.mitgliedsstatus === 'Aktiv').length,
        mitgliedPassiv:mitglieder.filter(m => m.mitgliedsstatus === 'Passiv').length,
        mitgliedJugend:mitglieder.filter(m => m.mitgliedsstatus === 'Jugend').length,
        veranstaltungen: veranstaltungen.filter(e => e.datum >= today).length,
        offeneEhrungen:  offeneEh.length,
        offeneBeitraege: offenB.length + uebB.length,
        arbeitsdienste:  arbeitsdienste.length,
        haesGesamt, haesFrei, haesAktiv, haesVerliehen,
      });
    } catch (e) {
      console.error('[Dashboard]', e instanceof Error ? e.message : e);
    }
    setLoading(false);
  };

  if (istNurMitglied(user)) return <MitgliedDashboard />;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Lädt…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">
          {getBegruessung(user?.full_name)}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
        {kannVerwalten && (
          <Link
            to="/vorstand"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
          >
            <Shield size={15} /> Führungs-Dashboard <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {/* Stats Row */}
      {isAdminUser && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6">
          <StatCard
            icon={Users} label="Mitglieder" value={stats.mitglieder}
            sub={`${stats.mitgliedAktiv} aktiv · ${stats.mitgliedPassiv} passiv`}
          />
          <StatCard
            icon={Calendar} label="Kommende Events" value={stats.veranstaltungen}
          />
          <StatCard
            icon={Award} label="Offene Ehrungen" value={stats.offeneEhrungen}
            color="text-yellow-400"
          />
          <StatCard
            icon={CreditCard} label="Offene Beiträge" value={stats.offeneBeitraege}
            color="text-red-400"
          />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Nächste Veranstaltungen */}
        <SectionCard
          title="Nächste Veranstaltungen"
          subtitle="Anstehende Termine"
          icon={Calendar}
          linkTo="/veranstaltungen"
          linkLabel="Alle ansehen"
        >
          {naechsteEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Veranstaltungen geplant</p>
          ) : (
            <div className="space-y-3">
              {naechsteEvents.map(event => (
                <Link key={event.id} to={`/veranstaltungen/${event.id}`} className="flex items-center gap-3 group">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-muted-foreground font-medium leading-none uppercase">
                      {format(new Date(event.datum), 'MMM', { locale: de })}
                    </span>
                    <span className="text-sm font-bold text-primary leading-none">
                      {format(new Date(event.datum), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{event.titel}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.ort || 'Kein Ort'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${EVENT_TYP_STYLE[event.typ] || 'bg-secondary text-muted-foreground'}`}>
                    {event.typ}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Offene Ehrungen */}
        {isAdminUser && (
          <SectionCard
            title="Offene Ehrungen"
            subtitle={`${stats.offeneEhrungen} ausstehend`}
            icon={Award}
            linkTo="/ehrungen"
            linkLabel="Bearbeiten"
          >
            {offeneEhrungen.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine offenen Ehrungen</p>
            ) : (
              <div className="space-y-2.5">
                {offeneEhrungen.map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <Star size={14} className="text-yellow-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{e.typ}{e.wert ? ` – ${e.wert}` : ''}</p>
                      {e.mitglied_name && <p className="text-xs text-muted-foreground truncate">{e.mitglied_name}</p>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${EHRUNG_STATUS_STYLE[e.status] || 'bg-secondary text-muted-foreground'}`}>
                      {e.status || 'Vorgeschlagen'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}

        {/* Arbeitsdienste */}
        <SectionCard
          title="Arbeitsdienste"
          subtitle={stats.arbeitsdienste > 0 ? `${stats.arbeitsdienste} anstehend` : 'Keine offenen Dienste'}
          icon={Briefcase}
          linkTo="/arbeitsdienste"
          linkLabel="Alle Dienste"
        >
          {arbeitsdienste.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine offenen Arbeitsdienste</p>
          ) : (
            <div className="space-y-3">
              {arbeitsdienste.map(d => {
                const pct = d.benoetigte_personen > 0
                  ? Math.min(100, Math.round((d.eingeteilt / d.benoetigte_personen) * 100))
                  : null;
                const barColor = pct === null ? 'bg-secondary'
                  : pct >= 100 ? 'bg-green-500'
                  : pct >= 60  ? 'bg-yellow-500'
                  : 'bg-primary';
                const badgeStyle = pct !== null && pct < 100
                  ? 'bg-primary/20 text-primary'
                  : 'bg-green-500/20 text-green-400';
                return (
                  <div key={d.id} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="flex-shrink-0 text-xs text-muted-foreground w-14 tabular-nums">
                        {format(new Date(d.datum), 'dd.MM.yy', { locale: de })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${badgeStyle}`}>
                        {d.eingeteilt}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="ml-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Beiträge */}
        {isAdminUser && (
          <SectionCard
            title="Beiträge"
            subtitle="Zahlungsübersicht"
            icon={CreditCard}
            linkTo="/beitraege"
            linkLabel="Rechnungen prüfen"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Bezahlt</p>
                  <p className="text-base font-oswald font-semibold text-green-400">{beitraegeStats.bezahlt.toFixed(0)} €</p>
                </div>
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Offen</p>
                  <p className="text-base font-oswald font-semibold text-yellow-400">{beitraegeStats.offen.toFixed(0)} €</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-[10px] text-muted-foreground">Überfällig</p>
                  <p className="text-base font-oswald font-semibold text-red-400">{beitraegeStats.ueberfaellig.toFixed(0)} €</p>
                </div>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Mitglieder */}
        <SectionCard
          title="Mitglieder"
          subtitle="Neueste Zugänge"
          icon={Users}
          linkTo="/mitglieder"
          linkLabel="Alle Mitglieder"
        >
          {/* Aufschlüsselung */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-center">
              <p className="text-lg font-oswald font-semibold text-green-400">{stats.mitgliedAktiv}</p>
              <p className="text-[10px] text-muted-foreground">Aktiv</p>
            </div>
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-center">
              <p className="text-lg font-oswald font-semibold text-yellow-400">{stats.mitgliedPassiv}</p>
              <p className="text-[10px] text-muted-foreground">Passiv</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
              <p className="text-lg font-oswald font-semibold text-blue-400">{stats.mitgliedJugend}</p>
              <p className="text-[10px] text-muted-foreground">Jugend</p>
            </div>
          </div>
          {/* Neueste Mitglieder */}
          <div className="space-y-2.5">
            {neueMitglieder.map(m => (
              <Link key={m.id} to={`/mitglieder/${m.id}`} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {m.vorname} {m.nachname}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {m.eintrittsdatum ? format(new Date(m.eintrittsdatum), 'dd.MM.yy') : '–'}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        {/* Häs */}
        <SectionCard
          title="Häs & Masken"
          subtitle="Kostümübersicht"
          icon={Shirt}
          linkTo="/haes"
          linkLabel="Bestand verwalten"
        >
          {stats.haesGesamt === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Häs-Daten werden geladen…</p>
          ) : (
            <div className="space-y-3">
              {/* Gesamt */}
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Gesamt</span>
                <span className="font-oswald font-semibold text-foreground text-lg">{stats.haesGesamt}</span>
              </div>
              {/* Aufschlüsselung */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2.5 text-center">
                  <p className="text-lg font-oswald font-semibold text-green-400">{stats.haesAktiv}</p>
                  <p className="text-[10px] text-muted-foreground">Aktiv</p>
                </div>
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-center">
                  <p className="text-lg font-oswald font-semibold text-yellow-400">{stats.haesFrei}</p>
                  <p className="text-[10px] text-muted-foreground">Frei</p>
                </div>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 text-center">
                  <p className="text-lg font-oswald font-semibold text-blue-400">{stats.haesVerliehen}</p>
                  <p className="text-[10px] text-muted-foreground">Verliehen</p>
                </div>
              </div>
              {/* Fortschrittsbalken Auslastung */}
              {stats.haesGesamt > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Auslastung</span>
                    <span>{Math.round(((stats.haesAktiv + stats.haesVerliehen) / stats.haesGesamt) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.round(((stats.haesAktiv + stats.haesVerliehen) / stats.haesGesamt) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
