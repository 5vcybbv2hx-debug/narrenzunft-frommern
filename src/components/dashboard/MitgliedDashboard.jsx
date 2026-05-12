/**
 * Persönliches Dashboard für normale Mitglieder und Elternkonten.
 * Zeigt eigene Veranstaltungsanmeldungen, Arbeitsdienste, Beiträge und Benachrichtigungen.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Calendar, Briefcase, CreditCard, Bell, ChevronRight, Bus, Check, Clock, MapPin, Music } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

function Card({ title, icon: Icon, children, linkTo, linkLabel, accent }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className={`flex items-center gap-3 px-5 py-4 border-b border-border ${accent ? 'bg-primary/5' : ''}`}>
        <Icon size={16} className="text-primary shrink-0" />
        <h3 className="font-semibold text-foreground text-sm flex-1">{title}</h3>
        {linkTo && (
          <Link to={linkTo} className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5">
            Alle <ChevronRight size={12} />
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
      {linkTo && linkLabel && (
        <div className="px-4 pb-4">
          <Link
            to={linkTo}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {linkLabel} <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyHint({ text }) {
  return <p className="text-sm text-muted-foreground text-center py-4">{text}</p>;
}

export default function MitgliedDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myMitglied, setMyMitglied] = useState(null);
  const [familienMitglieder, setFamilienMitglieder] = useState([]);
  const [meineAnmeldungen, setMeineAnmeldungen] = useState([]);
  const [meineArbeitsdienste, setMeineArbeitsdienste] = useState([]);
  const [meineBeitraege, setMeineBeitraege] = useState([]);
  const [ungeleseneNotifs, setUngeleseneNotifs] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [arbeitsdienste, setArbeitsdienste] = useState([]);
  const [spartenTermine, setSpartenTermine] = useState([]);
  const [meineSpartenGruppen, setMeineSpartenGruppen] = useState([]);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (!myM[0]) { setLoading(false); return; }

      const mitglied = myM[0];
      setMyMitglied(mitglied);

      // Parallele Abfragen
      const [teilnahmen, zuweisungen, beitraege, notifs] = await Promise.all([
        base44.entities.Teilnahme.filter({ mitglied_id: mitglied.id }),
        base44.entities.ArbeitsdienstZuweisung.filter({ mitglied_id: mitglied.id }),
        base44.entities.Beitrag.filter({ mitglied_id: mitglied.id }),
        base44.entities.Benachrichtigung.filter({ mitglied_id: mitglied.id }),
      ]);

      // Veranstaltungen nur für angemeldete IDs laden
      const veranstaltungIds = [...new Set(teilnahmen.map(t => t.veranstaltung_id).filter(Boolean))];
      const events = veranstaltungIds.length > 0
        ? (await Promise.all(veranstaltungIds.map(id => base44.entities.Veranstaltung.filter({ id })))).flat()
        : [];

      // Arbeitsdienste nur für zugewiesene IDs laden
      const dienstIds = [...new Set(zuweisungen.map(z => z.arbeitsdienst_id).filter(Boolean))];
      const dienste = dienstIds.length > 0
        ? (await Promise.all(dienstIds.map(id => base44.entities.Arbeitsdienst.filter({ id })))).flat()
        : [];

      // Sparten-Termine: nur für Gruppen, in denen das Mitglied ist
      const gruppenIds = mitglied.haesgruppen_ids || (mitglied.haesgruppe_id ? [mitglied.haesgruppe_id] : []);
      if (gruppenIds.length > 0) {
        const [alleTermineArr, gruppen] = await Promise.all([
          Promise.all(gruppenIds.map(gid => base44.entities.SpartenTermin.filter({ haesgruppe_id: gid }))),
          Promise.all(gruppenIds.map(gid => base44.entities.Haesgruppe.filter({ id: gid }))),
        ]);
        const meineTermine = alleTermineArr.flat()
          .filter(t => t.datum >= today)
          .sort((a, b) => a.datum.localeCompare(b.datum))
          .slice(0, 5);
        setSpartenTermine(meineTermine);
        setMeineSpartenGruppen(gruppen.flat().filter(Boolean));
      }

      // Familienübersicht für Elternkonten
      if (user?.role === 'elternkonto' && mitglied.familie_id) {
        const famM = await base44.entities.Mitglied.filter({ familie_id: mitglied.familie_id });
        setFamilienMitglieder(famM.filter(m => m.id !== mitglied.id));
      }

      setVeranstaltungen(events);
      setArbeitsdienste(dienste);

      // Kommende Anmeldungen
      const kommendeTeilnahmen = teilnahmen
        .filter(t => ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status))
        .filter(t => {
          const ev = events.find(e => e.id === t.veranstaltung_id);
          return ev && ev.datum >= today;
        })
        .slice(0, 5);
      setMeineAnmeldungen(kommendeTeilnahmen);

      // Offene Arbeitsdienste
      const offeneDienste = zuweisungen
        .filter(z => ['Offen', 'Bestätigt'].includes(z.status))
        .filter(z => {
          const d = dienste.find(d => d.id === z.arbeitsdienst_id);
          return d && d.datum >= today;
        })
        .slice(0, 5);
      setMeineArbeitsdienste(offeneDienste);

      // Offene Beiträge
      setMeineBeitraege(beitraege.filter(b => ['Offen', 'Überfällig'].includes(b.zahlungsstatus)));

      // Ungelesene Benachrichtigungen
      setUngeleseneNotifs(notifs.filter(n => !n.gelesen).slice(0, 5));

    } catch (e) {}
    setLoading(false);
  };

  const getVeranstaltung = (id) => veranstaltungen.find(v => v.id === id);
  const getArbeitsdienst = (id) => arbeitsdienste.find(d => d.id === id);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!myMitglied) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="text-4xl mb-4">🎭</div>
      <p className="text-muted-foreground text-sm">Kein Mitgliedsprofil gefunden. Bitte wende dich an den Vorstand.</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto space-y-4">
      {/* Begrüßung */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">
          Hallo, {myMitglied.vorname} 🎭
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Benachrichtigungen – nur wenn ungelesen */}
      {ungeleseneNotifs.length > 0 && (
        <Card title={`${ungeleseneNotifs.length} neue Benachrichtigungen`} icon={Bell} linkTo="/benachrichtigungen">
          <div className="space-y-2">
            {ungeleseneNotifs.slice(0, 3).map(n => (
              <div key={n.id} className="flex items-start gap-2 py-1">
                <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-sm text-foreground">{n.titel}</p>
              </div>
            ))}
            {ungeleseneNotifs.length > 3 && (
              <p className="text-xs text-muted-foreground">+ {ungeleseneNotifs.length - 3} weitere</p>
            )}
          </div>
        </Card>
      )}

      {/* Meine Veranstaltungen */}
      <Card title="Meine Anmeldungen" icon={Calendar} linkTo="/umzuege">
        {meineAnmeldungen.length === 0 ? (
          <EmptyHint text="Keine bevorstehenden Anmeldungen" />
        ) : (
          <div className="space-y-3">
            {meineAnmeldungen.map(t => {
              const ev = getVeranstaltung(t.veranstaltung_id);
              if (!ev) return null;
              return (
                <Link key={t.id} to={`/veranstaltungen/${ev.id}`} className="flex items-center gap-3 group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] text-muted-foreground">{format(new Date(ev.datum), 'MMM', { locale: de })}</span>
                    <span className="text-sm font-bold text-primary">{format(new Date(ev.datum), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{ev.titel}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {ev.uhrzeit && <span className="flex items-center gap-1"><Clock size={10} /> {ev.uhrzeit}</span>}
                      {ev.ort && <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {ev.ort}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.bus && <Bus size={12} className="text-blue-400" />}
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">✓</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Sparten-Termine */}
      {spartenTermine.length > 0 && (
        <Card title="Meine Sparten-Termine" icon={Music} linkTo="/sparten">
          <div className="space-y-2">
            {spartenTermine.map(t => {
              const gruppe = meineSpartenGruppen.find(g => g.id === t.haesgruppe_id);
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] text-muted-foreground">{format(new Date(t.datum), 'MMM', { locale: de })}</span>
                    <span className="text-sm font-bold text-purple-400">{format(new Date(t.datum), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.titel}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {t.uhrzeit && <span className="flex items-center gap-1"><Clock size={10} /> {t.uhrzeit}</span>}
                      {gruppe && <span className="text-purple-400">{gruppe.name}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 shrink-0">{t.typ}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Meine Arbeitsdienste */}
      <Card title="Meine Arbeitsdienste" icon={Briefcase} linkTo="/arbeitsdienste">
        {meineArbeitsdienste.length === 0 ? (
          <EmptyHint text="Keine offenen Arbeitsdienste" />
        ) : (
          <div className="space-y-3">
            {meineArbeitsdienste.map(z => {
              const d = getArbeitsdienst(z.arbeitsdienst_id);
              if (!d) return null;
              return (
                <div key={z.id} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] text-muted-foreground">{format(new Date(d.datum), 'MMM', { locale: de })}</span>
                    <span className="text-sm font-bold text-orange-400">{format(new Date(d.datum), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                    {d.ort && <p className="text-xs text-muted-foreground truncate">{d.ort}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    z.status === 'Bestätigt' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{z.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Offene Beiträge */}
      {meineBeitraege.length > 0 && (
        <Card title="Offene Beiträge" icon={CreditCard} linkTo="/beitraege">
          <div className="space-y-2">
            {meineBeitraege.map(b => (
              <div key={b.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-foreground">Jahresbeitrag {b.jahr}</p>
                  <p className="text-xs text-muted-foreground">{b.mitgliedsstatus}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{b.betrag} €</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.zahlungsstatus === 'Überfällig' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{b.zahlungsstatus}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Familienmitglieder (nur für Elternkonten) */}
      {familienMitglieder.length > 0 && (
        <Card title="Familienmitglieder" icon={Calendar}>
          <div className="space-y-2">
            {familienMitglieder.map(m => (
              <Link key={m.id} to={`/mitglieder/${m.id}`} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {m.vorname} {m.nachname}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Schnellzugriff */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Link to="/umzuege" className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
          <Calendar size={22} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Termine</span>
        </Link>
        <Link to="/profil" className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl p-4 hover:border-primary/50 transition-colors">
          <Check size={22} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Mein Profil</span>
        </Link>
      </div>
    </div>
  );
}