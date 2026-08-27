import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { useAuth } from '@/lib/AuthContext';
import {
  Calendar, Users, Briefcase, Shirt, ArrowRight, ChevronRight,
  Shield, CheckCircle, AlertCircle, Clock, MapPin, Baby,
  Phone, MessageCircle, Bus,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { isAdmin, kannArbeitsdiensteVerwalten, istNurMitglied, getRollenLabel } from '@/lib/roles';
import MitgliedDashboard from '@/components/dashboard/MitgliedDashboard';
import StatuswechselWidget from '@/components/vorstand/StatuswechselWidget';
import MitgliederVerteilung from '@/components/dashboard/MitgliederVerteilung';

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getBegruessung(name) {
  const h = new Date().getHours();
  const vorname = name?.split(' ')[0] || 'Narr';
  if (h < 11) return `Guten Morgen, ${vorname} 👋`;
  if (h < 18) return `Guten Tag, ${vorname} 🎭`;
  return `Guten Abend, ${vorname} 🌙`;
}

function formatPhoneForTel(phone) {
  if (!phone) return null;
  return phone.replace(/[^\d+]/g, '');
}

function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('0')) cleaned = '49' + cleaned.substring(1);
  return cleaned;
}

// ── UI-Komponenten ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'text-primary', sub, onClick }) {
  return (
    <div
      className={`relative bg-card border border-border rounded-lg p-3 sm:p-4 flex items-center gap-3 sm:gap-4 overflow-hidden ${onClick ? 'cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all duration-150' : ''}`}
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
      <div className={`ml-1 sm:ml-2 w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/10 flex items-center justify-center ${color} shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-oswald font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children, linkTo, linkLabel, accent }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3.5 border-b border-border ${accent ? 'bg-primary/5' : ''}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-primary" />}
          <h3 className="font-oswald font-semibold text-foreground text-sm tracking-wide">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
      {linkTo && linkLabel && (
        <div className="px-5 pb-4">
          <Link
            to={linkTo}
            className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {linkLabel} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

const EVENT_TYP_STYLE = {
  'Umzug':              'bg-primary/20 text-primary',
  'Abendveranstaltung': 'bg-purple-500/20 text-purple-400',
  'Arbeitsdienst':      'bg-green-500/20 text-green-400',
  'Probe':              'bg-blue-500/20 text-blue-400',
  'Ausflug':            'bg-teal-500/20 text-teal-400',
  'Sitzung':            'bg-yellow-500/20 text-yellow-400',
};

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const isAdminUser = isAdmin(user);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);
  const today = new Date().toISOString().split('T')[0];

  const { data: dashData, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-merged', user?.role],
    queryFn: async () => {
      if (istNurMitglied(user)) return null;
      const [dashResult, haesResult, zuweisungen, ausfahrten] = await Promise.all([
        base44.functions.invoke('getDashboardSicher', {}),
        isAdmin(user)
          ? base44.functions.invoke('getHaesSicher', { aktion: 'liste', limit: 500 }).catch(() => null)
          : Promise.resolve(null),
        base44.entities.ArbeitsdienstZuweisung.list('-created_date', 500),
        base44.entities.Ausfahrt.list('datum', 100),
      ]);
      return { dashResult, haesResult, zuweisungen, ausfahrten };
    },
  });

  const { stats, naechsteTermine, naechsteGeburtstage, unterbesetzte, offeneDienste, verfuegbareHaes, statusVerteilung, gruppenVerteilung } = useMemo(() => {
    const empty = {
      stats: { mitglieder: 0, kommendeEvents: 0, offeneDienste: 0, unterbesetzt: 0, haesGesamt: 0, haesVerfuegbar: 0 },
      naechsteTermine: [], naechsteGeburtstage: [], unterbesetzte: [], offeneDienste: [], verfuegbareHaes: [], statusVerteilung: [], gruppenVerteilung: [],
    };
    if (!dashData || !dashData.dashResult?.data?.erfolg || !dashData.dashResult.data.mitglieder) return empty;

    const { mitglieder, veranstaltungen, arbeitsdienste } = dashData.dashResult.data;
    const haesResult = dashData.haesResult;
    const zuweisungen = dashData.zuweisungen || [];
    const ausfahrten = dashData.ausfahrten || [];

    // ── Anstehende Termine & Ausfahrten (gemischt) ──
    const events = veranstaltungen
      .filter(e => e.datum >= today)
      .map(e => ({ id: e.id, titel: e.titel, datum: e.datum, ort: e.ort, typ: e.typ, isAusfahrt: false, link: `/veranstaltungen/${e.id}` }));
    const fahrten = ausfahrten
      .filter(a => a.datum >= today)
      .map(a => ({ id: a.id, titel: a.titel, datum: a.datum, ort: a.ort, typ: a.typ, isAusfahrt: true, link: `/ausfahrten/${a.id}` }));
    const naechsteTermine = [...events, ...fahrten]
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .slice(0, 6);

    // ── Geburtstage ──
    const heute4B = new Date(); heute4B.setHours(0, 0, 0, 0);
    const in30Tagen = addDays(heute4B, 30);
    const naechsteGeburtstage = mitglieder
      .filter(m => m.geburtsdatum && !m.archiviert && m.mitgliedsstatus !== 'Verstorben')
      .map(m => {
        const geb = new Date(m.geburtsdatum);
        const diesesJ = new Date(heute4B.getFullYear(), geb.getMonth(), geb.getDate());
        const naechste = diesesJ < heute4B ? addDays(diesesJ, 365) : diesesJ;
        return { ...m, _naechsteGeb: naechste, _alter: new Date().getFullYear() - geb.getFullYear() };
      })
      .filter(m => m._naechsteGeb <= in30Tagen)
      .sort((a, b) => a._naechsteGeb - b._naechsteGeb)
      .slice(0, 6);

    // ── Arbeitsdienste ──
    const getDienstStats = (dienstId) => {
      const zuws = zuweisungen.filter(z => z.arbeitsdienst_id === dienstId);
      const bestaetigt = zuws.filter(z => ['Bestätigt', 'Erledigt'].includes(z.status)).length;
      return { total: zuws.length, bestaetigt };
    };

    const offene = arbeitsdienste.filter(d => d.datum >= today && d.status !== 'Abgeschlossen');
    const unterbesetzt = offene.filter(d => {
      if (!d.benoetigte_personen) return false;
      const { bestaetigt } = getDienstStats(d.id);
      return bestaetigt < d.benoetigte_personen;
    });

    const offeneDienste = offene.slice(0, 5);
    const unterbesetzte = unterbesetzt.slice(0, 4);

    // ── Häs ──
    let haesGesamt = 0;
    let verfuegbareHaes = [];
    if (haesResult?.data?.haes) {
      const hl = haesResult.data.haes;
      const gl = haesResult.data.gruppen || [];
      haesGesamt = hl.length;
      // Amtshäs-Gruppen identifizieren (Name enthält "Amt")
      const amtshaesGruppeIds = new Set(
        gl.filter(g => (g.name || '').toLowerCase().includes('amt')).map(g => g.id)
      );
      const gruppeMap = {};
      gl.forEach(g => { gruppeMap[g.id] = g; });
      // Verfügbar: nicht zugeordnet ODER Vereinsbesitz, außer Amtshäs und Stillgelegt
      verfuegbareHaes = hl
        .filter(h =>
          !amtshaesGruppeIds.has(h.haesgruppe_id) &&
          h.status !== 'Stillgelegt' &&
          (!h.aktueller_besitzer_id || h.vereinseigentum === true)
        )
        .map(h => ({
          ...h,
          gruppe_name: gruppeMap[h.haesgruppe_id]?.name || '–',
        }));
    }

    // ── Mitglieder-Verteilung ──
    const aktiveMitglieder = mitglieder.filter(m => !m.archiviert);
    const statusCounts = {};
    aktiveMitglieder.forEach(m => {
      const s = m.mitgliedsstatus || 'Ohne Status';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusVerteilung = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count }));

    const glVert = haesResult?.data?.gruppen || [];
    const gruppeMapVert = {};
    glVert.forEach(g => { gruppeMapVert[g.id] = g; });
    const gruppenData = {};
    aktiveMitglieder.forEach(m => {
      const ids = m.haesgruppen_ids?.length ? m.haesgruppen_ids : (m.haesgruppe_id ? [m.haesgruppe_id] : []);
      const isAktiv = m.mitgliedsstatus === 'Aktiv';
      ids.forEach(id => {
        const name = gruppeMapVert[id]?.name;
        if (!name) return;
        if (!gruppenData[name]) gruppenData[name] = { name, aktiv: 0, passiv: 0 };
        if (isAktiv) gruppenData[name].aktiv++;
        else gruppenData[name].passiv++;
      });
    });
    const gruppenVerteilung = Object.values(gruppenData)
      .sort((a, b) => (b.aktiv + b.passiv) - (a.aktiv + a.passiv));

    const stats = {
      mitglieder: aktiveMitglieder.length,
      kommendeEvents: events.length + fahrten.length,
      offeneDienste: offene.length,
      unterbesetzt: unterbesetzt.length,
      haesGesamt,
      haesVerfuegbar: verfuegbareHaes.length,
    };

    return { stats, naechsteTermine, naechsteGeburtstage, unterbesetzte, offeneDienste, verfuegbareHaes, statusVerteilung, gruppenVerteilung };
  }, [dashData, today]);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(useCallback(async () => {
    await refetch();
  }, [refetch]));

  // ── Reguläre Mitglieder: nur persönliches Dashboard ──
  if (istNurMitglied(user)) return <MitgliedDashboard />;

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Lädt…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-5xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">
          {getBegruessung(user?.full_name)}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {getRollenLabel(user?.role)} · {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Schnellaktions-Buttons */}
      {isAdminUser && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Link to="/veranstaltungen/neu" className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:border-primary/40 transition-colors">
            <Calendar size={14} className="text-primary" /> Termin
          </Link>
          <Link to="/mitglieder" className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:border-primary/40 transition-colors">
            <Users size={14} className="text-primary" /> Mitglied
          </Link>
          <Link to="/arbeitsdienste/neu" className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:border-primary/40 transition-colors">
            <Briefcase size={14} className="text-primary" /> Dienst
          </Link>
          <Link to="/ausfahrten/neu" className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-xs font-medium text-foreground hover:border-primary/40 transition-colors">
            <Bus size={14} className="text-primary" /> Ausfahrt
          </Link>
        </div>
      )}

      {/* Stats Row (reduziert) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6">
        <StatCard icon={Calendar} label="Kommende Termine" value={stats.kommendeEvents} onClick={() => window.location.href = '/kalender'} />
        {kannVerwalten && (
          <StatCard icon={Briefcase} label="Offene Dienste" value={stats.offeneDienste} onClick={() => window.location.href = '/arbeitsdienste'} />
        )}
        {kannVerwalten && (
          <StatCard
            icon={AlertCircle}
            label="Unterbesetzt"
            value={stats.unterbesetzt}
            color={stats.unterbesetzt > 0 ? 'text-red-400' : 'text-green-400'}
            onClick={() => window.location.href = '/arbeitsdienste'}
          />
        )}
        {isAdminUser && stats.haesGesamt > 0 && (
          <StatCard
            icon={Shirt}
            label="Häs verfügbar"
            value={stats.haesVerfuegbar}
            sub="Nicht zugeordnet / Vereinsbesitz"
            color={stats.haesVerfuegbar > 0 ? 'text-yellow-400' : 'text-green-400'}
            onClick={() => window.location.href = '/haes'}
          />
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Mitglieder-Verteilung (detailliert) */}
        {isAdminUser && (
          <MitgliederVerteilung
            total={stats.mitglieder}
            statusVerteilung={statusVerteilung}
            gruppenVerteilung={gruppenVerteilung}
          />
        )}

        {/* Anstehende Termine & Ausfahrten */}
        <SectionCard
          title="Anstehende Termine & Ausfahrten"
          icon={Calendar}
          linkTo="/kalender"
          linkLabel="Alle ansehen"
        >
          {naechsteTermine.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine anstehenden Termine</p>
          ) : (
            <div className="space-y-3">
              {naechsteTermine.map(event => {
                const isToday = event.datum === today;
                const isAusfahrt = event.isAusfahrt;
                return (
                  <Link key={`${isAusfahrt ? 'a' : 'v'}-${event.id}`} to={event.link} className="flex items-center gap-3 group">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center ${isToday ? 'bg-primary' : isAusfahrt ? 'bg-blue-500/10' : 'bg-primary/10'}`}>
                      <span className={`text-[10px] font-medium leading-none uppercase ${isToday ? 'text-white/80' : 'text-muted-foreground'}`}>
                        {format(new Date(event.datum), 'MMM', { locale: de })}
                      </span>
                      <span className={`text-sm font-bold leading-none ${isToday ? 'text-white' : isAusfahrt ? 'text-blue-400' : 'text-primary'}`}>
                        {format(new Date(event.datum), 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{event.titel}</p>
                      <p className="text-xs text-muted-foreground truncate">{event.ort || 'Kein Ort'}</p>
                    </div>
                    {isToday ? (
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-primary text-white font-semibold animate-pulse">HEUTE</span>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${isAusfahrt ? 'bg-blue-500/20 text-blue-400' : EVENT_TYP_STYLE[event.typ] || 'bg-secondary text-muted-foreground'}`}>
                        {isAusfahrt && <Bus size={10} />}
                        {isAusfahrt ? 'Ausfahrt' : event.typ}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Geburtstage mit Anruf- & WhatsApp-Buttons */}
        <SectionCard
          title="Nächste Geburtstage"
          subtitle="In den nächsten 30 Tagen"
          icon={Users}
        >
          {naechsteGeburtstage.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Keine Geburtstage in nächster Zeit</p>
          ) : (
            <div className="space-y-2.5">
              {naechsteGeburtstage.map(m => {
                const istHeute = format(m._naechsteGeb, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const telefon = m.telefon || m.mobiltelefon;
                const telUrl = telefon ? `tel:${formatPhoneForTel(telefon)}` : null;
                const waUrl = telefon ? `https://wa.me/${formatPhoneForWhatsApp(telefon)}` : null;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${istHeute ? 'bg-primary' : 'bg-primary/10'}`}>
                      <span className={`text-xs ${istHeute ? 'text-white' : 'text-primary'}`}>🎂</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.vorname} {m.nachname}</p>
                      <p className="text-xs text-muted-foreground">wird {m._alter + 1} Jahre</p>
                    </div>
                    {/* Telefon-Button */}
                    {telUrl && (
                      <a
                        href={telUrl}
                        className="p-2 rounded-lg bg-secondary text-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                        title="Anrufen"
                      >
                        <Phone size={14} />
                      </a>
                    )}
                    {/* WhatsApp-Button */}
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors shrink-0"
                        title="WhatsApp gratulieren"
                      >
                        <MessageCircle size={14} />
                      </a>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${istHeute ? 'bg-primary text-white font-semibold' : 'bg-secondary text-muted-foreground'}`}>
                      {istHeute ? 'HEUTE' : format(m._naechsteGeb, 'dd.MM.', { locale: de })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Unterbesetzte Dienste – Dringend */}
        {kannVerwalten && (
          <SectionCard title="Dringlich: Unterbesetzte Dienste" icon={AlertCircle} linkTo="/arbeitsdienste" accent>
            {unterbesetzte.length === 0 ? (
              <div className="flex items-center gap-2 py-3">
                <CheckCircle size={18} className="text-green-400" />
                <p className="text-sm text-green-400 font-medium">Alle Dienste sind ausreichend besetzt</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unterbesetzte.map(d => {
                  const zuws = (dashData?.zuweisungen || []).filter(z => z.arbeitsdienst_id === d.id);
                  const bestaetigt = zuws.filter(z => ['Bestätigt', 'Erledigt'].includes(z.status)).length;
                  const fehlend = (d.benoetigte_personen || 0) - bestaetigt;
                  return (
                    <div key={d.id} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{d.titel}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Clock size={10} />
                            <span>{format(new Date(d.datum), 'dd.MM.yyyy', { locale: de })}{d.uhrzeit ? ` · ${d.uhrzeit}` : ''}</span>
                            {d.ort && <span className="flex items-center gap-0.5"><MapPin size={10} />{d.ort}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-oswald font-bold text-red-400">{fehlend} fehlen</span>
                          <p className="text-xs text-muted-foreground">{bestaetigt}/{d.benoetigte_personen}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Link
                  to="/arbeitsdienste"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors mt-1"
                >
                  Dienste verwalten <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </SectionCard>
        )}

        {/* Offene Arbeitsdienste */}
        {kannVerwalten && (
          <SectionCard title="Offene Arbeitsdienste" icon={Briefcase} linkTo="/arbeitsdienste">
            {offeneDienste.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Keine offenen Arbeitsdienste</p>
            ) : (
              <div className="space-y-2">
                {offeneDienste.map(d => {
                  const zuws = (dashData?.zuweisungen || []).filter(z => z.arbeitsdienst_id === d.id);
                  const eingeteilt = zuws.filter(z => z.status !== 'Abgesagt').length;
                  const pct = d.benoetigte_personen > 0 ? Math.min(100, Math.round((eingeteilt / d.benoetigte_personen) * 100)) : null;
                  const barColor = pct === null ? 'bg-secondary' : pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-primary';
                  return (
                    <div key={d.id} className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 text-xs text-muted-foreground w-14 tabular-nums">
                          {format(new Date(d.datum), 'dd.MM.yy', { locale: de })}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${pct !== null && pct < 100 ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-400'}`}>
                          {eingeteilt}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                        </span>
                      </div>
                      {pct !== null && (
                        <div className="ml-0 sm:ml-14 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}

        {/* Verfügbare Häs — detailliert & klickbar */}
        {isAdminUser && verfuegbareHaes.length > 0 && (
          <SectionCard
            title="Verfügbare Häs"
            subtitle="Nicht zugeordnet oder Vereinsbesitz (ohne Amtshäs)"
            icon={Shirt}
            linkTo="/haes"
            linkLabel="Alle Häs ansehen"
          >
            <div className="space-y-2">
              {verfuegbareHaes.slice(0, 8).map(h => {
                const isVereinsbesitz = h.vereinseigentum === true;
                const isZugeordnet = !!h.aktueller_besitzer_id;
                return (
                  <Link
                    key={h.id}
                    to={`/haes/${h.id}`}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isVereinsbesitz ? 'bg-blue-500/10' : 'bg-yellow-500/10'}`}>
                      <Shirt size={16} className={isVereinsbesitz ? 'text-blue-400' : 'text-yellow-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {h.haesnummer || h.bezeichnung || 'Ohne Bezeichnung'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {h.bezeichnung && h.haesnummer ? `${h.bezeichnung} · ` : ''}{h.gruppe_name}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${isVereinsbesitz ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400'}`}>
                      {isVereinsbesitz ? 'Verein' : isZugeordnet ? 'Zugeordnet' : 'Frei'}
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground/50 group-hover:text-primary shrink-0" />
                  </Link>
                );
              })}
              {verfuegbareHaes.length > 8 && (
                <Link to="/haes" className="block text-center text-xs text-primary hover:text-primary/80 pt-1">
                  +{verfuegbareHaes.length - 8} weitere ansehen
                </Link>
              )}
            </div>
          </SectionCard>
        )}

        {/* Altersbedingte Statuswechsel */}
        {isAdminUser && (
          <SectionCard title="Altersbedingte Statuswechsel" icon={Baby} linkTo="/mitglieder">
            <StatuswechselWidget />
          </SectionCard>
        )}

      </div>
    </div>
  );
}