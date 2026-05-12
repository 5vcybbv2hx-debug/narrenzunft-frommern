import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useAuth } from '@/lib/AuthContext';
import {
  Calendar, Users, Award, CreditCard, Briefcase, Bus,
  Shirt, TrendingUp, ArrowRight, Clock, CheckCircle,
  AlertCircle, Star, ChevronRight, Shield
} from 'lucide-react';
import { format, isAfter, isBefore, addDays, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import { isAdmin, kannArbeitsdiensteVerwalten, istNurMitglied } from '@/lib/roles';
import MitgliedDashboard from '@/components/dashboard/MitgliedDashboard';

function StatCard({ icon: Icon, label, value, color = 'text-primary', onClick }) {
  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 flex items-center gap-4 ${onClick ? 'cursor-pointer hover:border-primary/50 transition-all' : ''}`}
      onClick={onClick}
    >
      <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
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
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {linkLabel} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }) {
  const colors = {
    'Geplant': 'bg-blue-400',
    'Aktiv': 'bg-green-400',
    'Angemeldet': 'bg-green-400',
    'Bestätigt': 'bg-green-400',
    'Offen': 'bg-yellow-400',
    'Bezahlt': 'bg-green-400',
    'Überfällig': 'bg-red-400',
    'Vorgeschlagen': 'bg-yellow-400',
    'Genehmigt': 'bg-green-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

export default function Dashboard() {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    mitglieder: 0, veranstaltungen: 0, offeneEhrungen: 0,
    offeneBeitraege: 0, arbeitsdienste: 0
  });
  const [naechsteEvents, setNaechsteEvents] = useState([]);
  const [offeneEhrungen, setOffeneEhrungen] = useState([]);
  const [arbeitsdienste, setArbeitsdienste] = useState([]);
  const [beitraegeStats, setBeitraegeStats] = useState({ offen: 0, ueberfaellig: 0, total: 0 });
  const [neueMitglieder, setNeueMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdminUser = isAdmin(user);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await loadData();
  }, []));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [mitglieder, events, ehrungen, beitraege, dienste, zuweisungen] = await Promise.all([
        isAdminUser ? base44.entities.Mitglied.list('-created_date', 100) : Promise.resolve([]),
        base44.entities.Veranstaltung.list('datum', 50),
        isAdminUser ? base44.entities.Ehrung.filter({ status: 'Vorgeschlagen' }) : Promise.resolve([]),
        isAdminUser ? base44.entities.Beitrag.list('-created_date', 200) : Promise.resolve([]),
        base44.entities.Arbeitsdienst.list('datum', 30),
        base44.entities.ArbeitsdienstZuweisung.list('-created_date', 300),
      ]);

      const kommende = events.filter(e => e.datum >= today).slice(0, 5);
      setNaechsteEvents(kommende);
      setOffeneEhrungen(ehrungen.slice(0, 4));

      const offenB = beitraege.filter(b => b.zahlungsstatus === 'Offen');
      const ueberfaelligB = beitraege.filter(b => b.zahlungsstatus === 'Überfällig');
      setBeitraegeStats({
        offen: offenB.reduce((s, b) => s + (b.betrag || 0), 0),
        ueberfaellig: ueberfaelligB.reduce((s, b) => s + (b.betrag || 0), 0),
        total: beitraege.reduce((s, b) => s + (b.betrag || 0), 0)
      });

      // Unterbesetzte Dienste ermitteln
      const offeneDienste = dienste.filter(d => d.datum >= today && d.status !== 'Abgeschlossen');
      const unterbesetzte = offeneDienste
        .filter(d => d.benoetigte_personen > 0)
        .map(d => {
          const count = zuweisungen.filter(z => z.arbeitsdienst_id === d.id && z.status !== 'Abgesagt').length;
          return { ...d, eingeteilt: count };
        })
        .filter(d => d.eingeteilt < d.benoetigte_personen)
        .slice(0, 4);

      setArbeitsdienste(unterbesetzte.length > 0 ? unterbesetzte : offeneDienste.slice(0, 3).map(d => ({
        ...d,
        eingeteilt: zuweisungen.filter(z => z.arbeitsdienst_id === d.id && z.status !== 'Abgesagt').length,
      })));

      setNeueMitglieder(mitglieder.slice(0, 3));
      setStats({
        mitglieder: mitglieder.length,
        veranstaltungen: kommende.length,
        offeneEhrungen: ehrungen.length,
        offeneBeitraege: offenB.length + ueberfaelligB.length,
        arbeitsdienste: unterbesetzte.length,
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Normale Mitglieder & Elternkonten bekommen ihr eigenes Dashboard
  if (istNurMitglied(user)) {
    return <MitgliedDashboard />;
  }

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Guten Tag, {user?.full_name?.split(' ')[0] || 'Narr'} 🎭
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
        {kannVerwalten && (
          <Link
            to="/vorstand"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
          >
            <Shield size={15} /> Führungs-Dashboard öffnen <ChevronRight size={14} />
          </Link>
        )}
      </div>

      {/* Stats Row */}
      {isAdminUser && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Mitglieder" value={stats.mitglieder} />
          <StatCard icon={Calendar} label="Nächste Events" value={stats.veranstaltungen} />
          <StatCard icon={Award} label="Offene Ehrungen" value={stats.offeneEhrungen} color="text-yellow-400" />
          <StatCard icon={CreditCard} label="Offene Beiträge" value={stats.offeneBeitraege} color="text-red-400" />
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
                    <span className="text-[10px] text-muted-foreground font-medium leading-none">
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
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      event.typ === 'Umzug' ? 'bg-primary/20 text-primary' :
                      event.typ === 'Abendveranstaltung' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{event.typ}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Offene Ehrungen */}
        {isAdminUser && (
          <SectionCard
            title="Offene Ehrungen"
            subtitle="Vorschläge & Genehmigungen"
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
                      <p className="text-sm text-foreground truncate">{e.typ} – {e.wert}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                      Vorgeschlagen
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
          subtitle={stats.arbeitsdienste > 0 ? `${stats.arbeitsdienste} unterbesetzt` : 'Kommende Dienste'}
          icon={Briefcase}
          linkTo="/arbeitsdienste"
          linkLabel="Alle Dienste"
        >
          {arbeitsdienste.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine offenen Arbeitsdienste</p>
          ) : (
            <div className="space-y-3">
              {arbeitsdienste.map(d => {
                const pct = d.benoetigte_personen > 0 ? Math.min(100, Math.round((d.eingeteilt / d.benoetigte_personen) * 100)) : null;
                const unterbesetzt = pct !== null && pct < 100;
                return (
                  <div key={d.id} className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 text-xs text-muted-foreground w-14">
                        {format(new Date(d.datum), 'dd.MM', { locale: de })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${unterbesetzt ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}>
                        {d.eingeteilt}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="ml-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                          style={{ width: `${pct}%` }}
                        />
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-xs text-muted-foreground">Offen</p>
                  <p className="text-lg font-bold text-green-400">{beitraegeStats.offen.toFixed(0)} €</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs text-muted-foreground">Überfällig</p>
                  <p className="text-lg font-bold text-red-400">{beitraegeStats.ueberfaellig.toFixed(0)} €</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Bezahlt</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Offen</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Überfällig</span>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Mitglieder */}
        <SectionCard
          title="Mitglieder"
          subtitle="Neueste Mitglieder"
          icon={Users}
          linkTo="/mitglieder"
          linkLabel="Alle Mitglieder"
        >
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400" />Aktiv</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" />Passiv</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Jugend</span>
          </div>
          <p className="text-3xl font-bold text-primary mb-4">{stats.mitglieder} Mitglieder</p>
          <div className="space-y-2.5">
            {neueMitglieder.map(m => (
              <Link key={m.id} to={`/mitglieder/${m.id}`} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                    {m.vorname} {m.nachname}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                </div>
                <span className="text-xs text-muted-foreground">
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
          <p className="text-sm text-muted-foreground text-center py-6">
            Häs-Verwaltung → Häs & Masken
          </p>
        </SectionCard>

      </div>
    </div>
  );
}