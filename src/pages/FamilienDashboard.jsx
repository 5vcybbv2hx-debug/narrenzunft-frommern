import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Users, Calendar, Briefcase, Shirt, ArrowRight, Lock } from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';

export default function FamilienDashboard() {
  const { user } = useAuth();
  const [myMitglied, setMyMitglied] = useState(null);
  const [kinder, setKinder] = useState([]);
  const [verwandtschaften, setVerwandtschaften] = useState([]);
  const [termine, setTermine] = useState([]);
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      if (!me) {
        setLoading(false);
        return;
      }

      // Mein Mitglied-Profil laden
      const myProfiles = await base44.entities.Mitglied.filter({ user_id: me.id });
      if (!myProfiles[0]) {
        setLoading(false);
        return;
      }

      const myProfile = myProfiles[0];
      setMyMitglied(myProfile);

      // Verwandtschaften laden (meine Kinder) – gefiltert nach diesem Mitglied
      const verwandtschaften_all = await base44.entities.Verwandtschaft.filter({ mitglied_id: myProfile.id });
      const kinderVerwandtschaften = verwandtschaften_all.filter(v => v.beziehung === 'Kind');
      setVerwandtschaften(kinderVerwandtschaften);

      if (kinderVerwandtschaften.length === 0) {
        setLoading(false);
        return;
      }

      const kinderIds = kinderVerwandtschaften.map(v => v.verwandter_id);
      const heute = new Date().toISOString().split('T')[0];

      // Kinder direkt gefiltert laden – kein .list() mehr
      const kinderProfiles = await Promise.all(
        kinderIds.map(kid => base44.entities.Mitglied.filter({ id: kid }))
      );
      setKinder(kinderProfiles.map(r => r[0]).filter(Boolean));

      // Arbeitsdienst-Zuweisungen gefiltert pro Kind
      const alleZuweisungenArr = await Promise.all(
        kinderIds.map(kid => base44.entities.ArbeitsdienstZuweisung.filter({ mitglied_id: kid }))
      );
      const alleZuweisungen = alleZuweisungenArr.flat();
      setZuweisungen(alleZuweisungen);

      const dienstIds = [...new Set(
        alleZuweisungen.filter(z => z.status !== 'Abgesagt').map(z => z.arbeitsdienst_id)
      )];

      // Dienste direkt gefiltert – nur die relevanten IDs
      if (dienstIds.length > 0) {
        const diensteArr = await Promise.all(
          dienstIds.slice(0, 20).map(did => base44.entities.Arbeitsdienst.filter({ id: did }))
        );
        const kinderDienste = diensteArr.map(r => r[0]).filter(d => d && d.datum >= heute).slice(0, 10);
        setDienste(kinderDienste);
      }

      // Kalenderanmeldungen gefiltert
      const anmeldungenArr = await Promise.all(
        kinderIds.map(kid => base44.entities.KalenderAnmeldung.filter({ mitglied_id: kid }))
      );
      const alleAnmeldungen = anmeldungenArr.flat();
      const terminIds = [...new Set(alleAnmeldungen.map(a => a.termin_id))];
      if (terminIds.length > 0) {
        const termineArr = await Promise.all(
          terminIds.slice(0, 20).map(tid => base44.entities.KalenderTermin.filter({ id: tid }))
        );
        setTermine(termineArr.map(r => r[0]).filter(t => t && t.datum >= heute).slice(0, 10));
      }
    } catch (e) {
      console.error('FamilienDashboard Ladefehler:', e);
    }
    setLoading(false);
  };

  // Nur für Elternkonten
  if (myMitglied?.app_rolle !== 'elternkonto') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold text-foreground mb-2">Nicht verfügbar</h2>
        <p className="text-sm text-muted-foreground">Diese Seite ist nur für Elternkonten verfügbar.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (kinder.length === 0) {
    return (
      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">👨‍👩‍👧 Familien-Dashboard</h1>
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Users size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Noch keine Kinder verknüpft</p>
          <p className="text-xs text-muted-foreground mt-2">Wenden Sie sich an den Vorstand, um Verwandtschaften zu erfassen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">👨‍👩‍👧 Familien-Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Übersicht aller Ihrer Kinder</p>
      </div>

      {/* Kinder-Cards */}
      <div className="space-y-4 mb-6">
        {kinder.map(kind => {
          const alter = kind.geburtsdatum ? differenceInYears(new Date(), new Date(kind.geburtsdatum)) : null;
          const kindTermine = termine.filter(t => (t.anmeldungen || []).includes(kind.id));
          const kindDienste = dienste.filter(d => {
            return zuweisungen.some(z => z.arbeitsdienst_id === d.id && z.mitglied_id === kind.id);
          });

          return (
            <Link
              key={kind.id}
              to={`/mitglieder/${kind.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all group"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {kind.vorname?.[0]}{kind.nachname?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground">{kind.vorname} {kind.nachname}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {alter !== null && <span>{alter} Jahre</span>}
                      <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                        {kind.mitgliedsstatus}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
              </div>

              {/* Kurz-Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-secondary/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-primary">{kindTermine.length}</p>
                  <p className="text-[10px] text-muted-foreground">Termine</p>
                </div>
                <div className="bg-secondary/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-blue-400">{kindDienste.length}</p>
                  <p className="text-[10px] text-muted-foreground">Dienste</p>
                </div>
                <div className="bg-secondary/30 rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-accent">{kind.mitgliedsstatus === 'Aktiv' ? '✓' : '–'}</p>
                  <p className="text-[10px] text-muted-foreground">Status</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Kommende Termine */}
      {termine.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-primary" /> Kommende Termine
          </h2>
          <div className="space-y-2">
            {termine.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.titel}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.datum), 'dd.MM.yyyy', { locale: de })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arbeitsdienste */}
      {dienste.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Briefcase size={16} className="text-primary" /> Arbeitsdienste
          </h2>
          <div className="space-y-2">
            {dienste.slice(0, 5).map(d => (
              <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(d.datum), 'dd.MM.yyyy', { locale: de })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}