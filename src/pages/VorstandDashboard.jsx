import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannArbeitsdiensteVerwalten, getRollenLabel } from '@/lib/roles';
import {
  Calendar, Users, Briefcase, AlertCircle, CheckCircle2,
  Clock, MapPin, ChevronRight, ArrowRight, UserCheck, UserX, Shield, Baby
} from 'lucide-react';
import StatuswechselWidget from '@/components/vorstand/StatuswechselWidget';
import { format, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

function SectionCard({ title, icon: Icon, children, linkTo, linkLabel, accent }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-3.5 border-b border-border ${accent ? 'bg-primary/5' : ''}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-primary" />}
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-primary hover:underline flex items-center gap-1">
            Alle <ChevronRight size={12} />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <p className="text-sm text-muted-foreground text-center py-4">{text}</p>
  );
}

export default function VorstandDashboard() {
  const { user } = useAuth();
  const hatZugriff = isAdmin(user) || kannArbeitsdiensteVerwalten(user);
  const [loading, setLoading] = useState(true);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [offeneDienste, setOffeneDienste] = useState([]);
  const [dienstZuweisungen, setDienstZuweisungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [arbeitsdienste, setArbeitsdienste] = useState([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, m, ad, adz] = await Promise.all([
        base44.entities.Veranstaltung.list('datum', 100),
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Arbeitsdienst.list('datum', 200),
        base44.entities.ArbeitsdienstZuweisung.list('-created_date', 1000),
      ]);
      setMitglieder(m);
      setDienstZuweisungen(adz);
      setArbeitsdienste(ad);

      // Kommende Veranstaltungen (nächste 60 Tage)
      const kommende = v
        .filter(e => e.datum >= today)
        .slice(0, 8);
      setVeranstaltungen(kommende);

      // Offene Arbeitsdienste in der Zukunft
      const offen = ad.filter(d => d.datum >= today && d.status !== 'Abgeschlossen');
      setOffeneDienste(offen.slice(0, 6));
    } catch (e) {}
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const getDienstStats = (dienstId) => {
    const zuws = dienstZuweisungen.filter(z => z.arbeitsdienst_id === dienstId);
    const bestaetigt = zuws.filter(z => ['Bestätigt', 'Erledigt'].includes(z.status)).length;
    return { total: zuws.length, bestaetigt };
  };

  const getDaysUntil = (datum) => differenceInDays(new Date(datum), new Date());

  const getTeilnahmeCount = (veranstaltungId) => {
    // Proxy über Arbeitsdienste falls verknüpft – hier zeigen wir nur die Veranstaltungsinfo
    return null;
  };

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Shield size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Nur für Vorstand und Spartenleiter.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Dienste mit Unterbesetzung (weniger als benötigte Personen bestätigt)
  const unterbesetzte = offeneDienste.filter(d => {
    if (!d.benoetigte_personen) return false;
    const { bestaetigt } = getDienstStats(d.id);
    return bestaetigt < d.benoetigte_personen;
  });

  return (
    <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} className="text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Führungs-Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {getRollenLabel(user?.role)} · {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Anstehende Events</p>
          <p className="text-2xl font-bold text-foreground mt-1">{veranstaltungen.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Offene Dienste</p>
          <p className="text-2xl font-bold text-primary mt-1">{offeneDienste.length}</p>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${unterbesetzte.length > 0 ? 'border-red-500/30' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground">Unterbesetzt</p>
          <p className={`text-2xl font-bold mt-1 ${unterbesetzte.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {unterbesetzte.length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Mitglieder</p>
          <p className="text-2xl font-bold text-foreground mt-1">{mitglieder.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Anstehende Veranstaltungen */}
        <SectionCard title="Anstehende Veranstaltungen" icon={Calendar} linkTo="/veranstaltungen" linkLabel="Alle">
          {veranstaltungen.length === 0 ? (
            <EmptyState text="Keine anstehenden Veranstaltungen" />
          ) : (
            <div className="space-y-2.5">
              {veranstaltungen.slice(0, 5).map(v => {
                const daysLeft = getDaysUntil(v.datum);
                const urgent = daysLeft <= 7;
                return (
                  <Link
                    key={v.id}
                    to={`/veranstaltungen/${v.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${urgent ? 'bg-red-500/10' : 'bg-primary/10'}`}>
                      <span className="text-[9px] text-muted-foreground font-medium leading-none">
                        {format(new Date(v.datum), 'MMM', { locale: de })}
                      </span>
                      <span className={`text-lg font-bold leading-none ${urgent ? 'text-red-400' : 'text-primary'}`}>
                        {format(new Date(v.datum), 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{v.titel}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {v.ort && <span className="flex items-center gap-0.5"><MapPin size={10} />{v.ort}</span>}
                        <span className={`px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-500/15 text-red-400' : 'bg-secondary'}`}>
                          {daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Morgen' : `in ${daysLeft} Tagen`}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      v.typ === 'Umzug' ? 'bg-primary/15 text-primary' :
                      v.typ === 'Abendveranstaltung' ? 'bg-purple-500/15 text-purple-400' :
                      'bg-blue-500/15 text-blue-400'
                    }`}>{v.typ}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Unterbesetzte Dienste – Dringend */}
        <SectionCard title="⚠ Dringlich: Unterbesetzte Dienste" icon={AlertCircle} linkTo="/arbeitsdienste" accent>
          {unterbesetzte.length === 0 ? (
            <div className="flex items-center gap-2 py-3">
              <CheckCircle2 size={18} className="text-green-400" />
              <p className="text-sm text-green-400 font-medium">Alle Dienste sind ausreichend besetzt</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unterbesetzte.map(d => {
                const { total, bestaetigt } = getDienstStats(d.id);
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
                        <span className="text-xs font-bold text-red-400">{fehlend} fehlen</span>
                        <p className="text-xs text-muted-foreground">{bestaetigt}/{d.benoetigte_personen}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <Link
                to="/arbeitsdienste"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors mt-1"
              >
                Dienste verwalten <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Alle offenen Arbeitsdienste */}
        <SectionCard title="Offene Arbeitsdienste" icon={Briefcase} linkTo="/arbeitsdienste">
          {offeneDienste.length === 0 ? (
            <EmptyState text="Keine offenen Arbeitsdienste" />
          ) : (
            <div className="space-y-2">
              {offeneDienste.map(d => {
                const { total, bestaetigt } = getDienstStats(d.id);
                const vollbesetzt = d.benoetigte_personen ? bestaetigt >= d.benoetigte_personen : null;
                return (
                  <div key={d.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(d.datum), 'dd.MM.yyyy', { locale: de })}
                        {d.ort ? ` · ${d.ort}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.benoetigte_personen ? (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          vollbesetzt ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {vollbesetzt ? <UserCheck size={11} /> : <UserX size={11} />}
                          {bestaetigt}/{d.benoetigte_personen}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{total} zugewiesen</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* Altersbedingte Statuswechsel */}
        <SectionCard title="👶 Altersbedingte Statuswechsel" icon={Baby} linkTo="/mitglieder" linkLabel="Mitglieder">
          <StatuswechselWidget />
        </SectionCard>

        {/* Schnellzugriff */}
        <SectionCard title="Schnellzugriff" icon={Shield}>
          <div className="grid grid-cols-2 gap-2">
            {[
              { path: '/mitglieder', label: 'Mitglieder', icon: Users, color: 'bg-blue-500/10 text-blue-400' },
              { path: '/arbeitsdienste', label: 'Arbeitsdienste', icon: Briefcase, color: 'bg-orange-500/10 text-orange-400' },
              { path: '/veranstaltungen', label: 'Veranstaltungen', icon: Calendar, color: 'bg-primary/10 text-primary' },
              { path: '/umzuege', label: 'Umzüge', icon: MapPin, color: 'bg-purple-500/10 text-purple-400' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-3 p-3 bg-secondary/50 hover:bg-secondary rounded-xl transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                    <Icon size={16} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </SectionCard>

      </div>
    </div>
  );
}