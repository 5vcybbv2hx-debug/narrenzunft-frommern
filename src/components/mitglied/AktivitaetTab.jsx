import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Briefcase, Check, Bus, Clock, MapPin, TrendingUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// Status-Badges je Eintragstyp
const statusBadge = (typ, status) => {
  if (typ === 'dienst') {
    if (status === 'Erledigt') return { text: 'Erledigt', cls: 'bg-green-500/20 text-green-400' };
    if (status === 'Bestätigt') return { text: 'Bestätigt', cls: 'bg-blue-500/20 text-blue-400' };
    if (status === 'Abgesagt') return { text: 'Abgesagt', cls: 'bg-red-500/20 text-red-400' };
    return { text: 'Offen', cls: 'bg-yellow-500/20 text-yellow-400' };
  }
  if (typ === 'ausfahrt') {
    if (status === 'Eingecheckt') return { text: 'Teilgenommen ✓', cls: 'bg-green-500/20 text-green-400' };
    return { text: 'Angemeldet', cls: 'bg-blue-500/20 text-blue-400' };
  }
  if (status === 'Anwesend') return { text: 'Anwesend ✓', cls: 'bg-green-500/20 text-green-400' };
  if (status === 'Abgesagt') return { text: 'Abgesagt', cls: 'bg-red-500/20 text-red-400' };
  return { text: status || 'Angemeldet', cls: 'bg-blue-500/20 text-blue-400' };
};

export default function AktivitaetTab({ mitgliedId }) {
  const [eintraege, setEintraege] = useState([]);
  const [loading, setLoading] = useState(true);
  // Neuestes Jahr standardmäßig ausgeklappt, ältere eingeklappt
  const [geschlosseneJahre, setGeschlosseneJahre] = useState(null);

  useEffect(() => {
    if (!mitgliedId) return;
    loadData();
  }, [mitgliedId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Alle drei Quellen parallel laden
      const [teilnahmen, ausfahrtAnmeldungen, zuweisungen] = await Promise.all([
        base44.entities.Teilnahme.filter({ mitglied_id: mitgliedId }).catch(() => []),
        base44.entities.AusfahrtAnmeldung.filter({ mitglied_id: mitgliedId }).catch(() => []),
        base44.entities.ArbeitsdienstZuweisung.filter({ mitglied_id: mitgliedId }).catch(() => []),
      ]);

      // Verknüpfte Objekte laden (Veranstaltungen, Ausfahrten, Arbeitsdienste)
      const veranstaltungIds = [...new Set(teilnahmen.map(t => t.veranstaltung_id).filter(Boolean))];
      const ausfahrtIds = [...new Set(ausfahrtAnmeldungen.filter(a => a.status !== 'Abgemeldet').map(a => a.ausfahrt_id).filter(Boolean))];
      const dienstIds = [...new Set(zuweisungen.map(z => z.arbeitsdienst_id).filter(Boolean))];
      const [veranstaltungen, ausfahrten, dienste] = await Promise.all([
        veranstaltungIds.length ? Promise.all(veranstaltungIds.map(id => base44.entities.Veranstaltung.filter({ id }).catch(() => []))).then(r => r.flat()) : [],
        ausfahrtIds.length ? Promise.all(ausfahrtIds.map(id => base44.entities.Ausfahrt.filter({ id }).catch(() => []))).then(r => r.flat()) : [],
        dienstIds.length ? Promise.all(dienstIds.map(id => base44.entities.Arbeitsdienst.filter({ id }).catch(() => []))).then(r => r.flat()) : [],
      ]);

      const getV = (id) => veranstaltungen.find(v => v.id === id);
      const getF = (id) => ausfahrten.find(f => f.id === id);
      const getD = (id) => dienste.find(d => d.id === id);

      // Einheitliche Historie aufbauen
      const liste = [];
      teilnahmen.forEach(t => {
        const v = getV(t.veranstaltung_id);
        if (v && v.datum) liste.push({
          key: `v-${t.id}`, typ: 'veranstaltung', datum: v.datum,
          titel: v.titel, typLabel: v.typ || 'Veranstaltung', ort: v.ort,
          status: t.status, bus: t.bus, uhrzeit: v.uhrzeit,
        });
      });
      ausfahrtAnmeldungen.filter(a => a.status !== 'Abgemeldet').forEach(a => {
        const f = getF(a.ausfahrt_id);
        if (f && f.datum) liste.push({
          key: `a-${a.id}`, typ: 'ausfahrt', datum: f.datum,
          titel: f.titel, typLabel: f.typ || 'Ausfahrt', ort: f.ort,
          status: a.status, transport: a.transport, uhrzeit: f.abfahrt_zeit || f.veranstaltungsbeginn,
        });
      });
      zuweisungen.forEach(z => {
        const d = getD(z.arbeitsdienst_id);
        if (d && d.datum) liste.push({
          key: `d-${z.id}`, typ: 'dienst', datum: d.datum,
          titel: d.titel, typLabel: 'Arbeitsdienst', ort: d.ort,
          status: z.status, uhrzeit: d.uhrzeit, notizen: z.notizen,
        });
      });

      setEintraege(liste.sort((a, b) => b.datum.localeCompare(a.datum)));
    } catch (e) {
      console.error('Error loading Aktivität:', e);
    }
    setLoading(false);
  };

  // Nach Jahren gruppiert (neueste zuerst)
  const jahre = useMemo(() => {
    const gruppen = {};
    eintraege.forEach(e => {
      const jahr = e.datum.slice(0, 4);
      (gruppen[jahr] = gruppen[jahr] || []).push(e);
    });
    return Object.keys(gruppen)
      .sort((a, b) => b.localeCompare(a))
      .map(jahr => ({
        jahr,
        eintraege: gruppen[jahr],
        umzuege: gruppen[jahr].filter(e => e.typ === 'veranstaltung' && e.status === 'Anwesend').length,
        ausfahrten: gruppen[jahr].filter(e => e.typ === 'ausfahrt' && e.status === 'Eingecheckt').length,
        dienste: gruppen[jahr].filter(e => e.typ === 'dienst' && e.status === 'Erledigt').length,
      }));
  }, [eintraege]);

  // Initial: nur das neueste Jahr offen
  useEffect(() => {
    if (geschlosseneJahre === null && jahre.length > 0) {
      setGeschlosseneJahre(new Set(jahre.slice(1).map(j => j.jahr)));
    }
  }, [jahre, geschlosseneJahre]);

  const toggleJahr = (jahr) => {
    setGeschlosseneJahre(prev => {
      const s = new Set(prev || []);
      s.has(jahr) ? s.delete(jahr) : s.add(jahr);
      return s;
    });
  };

  // Statistiken
  const anwesendV = eintraege.filter(e => e.typ === 'veranstaltung' && e.status === 'Anwesend').length;
  const teilgenommenA = eintraege.filter(e => e.typ === 'ausfahrt' && e.status === 'Eingecheckt').length;
  const erledigtD = eintraege.filter(e => e.typ === 'dienst' && e.status === 'Erledigt').length;
  const angemeldetV = eintraege.filter(e => e.typ === 'veranstaltung' && e.status !== 'Abgesagt').length;
  const kommend = eintraege.filter(e => e.datum >= new Date().toISOString().split('T')[0] && !['Abgesagt'].includes(e.status)).length;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Statistik-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{anwesendV}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Umzüge/Veranst. anwesend</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{teilgenommenA}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ausfahrten teilgenommen</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{erledigtD}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Arbeitsdienste erledigt</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{kommend}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Kommende Termine</p>
        </div>
      </div>

      {/* Anwesenheitsquote (Veranstaltungen) */}
      {angemeldetV > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingUp size={14} /> Anwesenheitsquote (Umzüge & Veranstaltungen)
            </span>
            <span className="text-sm font-bold text-foreground">
              {Math.round((anwesendV / angemeldetV) * 100)}%
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((anwesendV / angemeldetV) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Historie nach Jahren ausklappbar */}
      {jahre.length === 0 ? (
        <div className="text-center py-10">
          <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Aktivitäten — keine Teilnahmen, Ausfahrten oder Arbeitsdienste gefunden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jahre.map(({ jahr, eintraege: jahrEintraege, umzuege, ausfahrten: fahrten, dienste }) => {
            const offen = !(geschlosseneJahre || new Set()).has(jahr);
            return (
              <div key={jahr} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleJahr(jahr)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors text-left"
                >
                  <span className="text-base font-bold text-foreground font-oswald tracking-wide">{jahr}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    {umzuege > 0 && <span className="text-green-400">{umzuege}× anwesend</span>}
                    {fahrten > 0 && <span className="text-blue-400">{fahrten}× Ausfahrt</span>}
                    {dienste > 0 && <span className="text-yellow-400">{dienste}× Dienst</span>}
                    <span className="opacity-60">({jahrEintraege.length} Einträge)</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`ml-auto shrink-0 text-muted-foreground transition-transform ${offen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
                {offen && (
                  <div className="px-3 pb-3 space-y-2">
                    {jahrEintraege.map(e => {
                      const badge = statusBadge(e.typ, e.status);
                      const istPositiv =
                        (e.typ === 'veranstaltung' && e.status === 'Anwesend') ||
                        (e.typ === 'ausfahrt' && e.status === 'Eingecheckt') ||
                        (e.typ === 'dienst' && e.status === 'Erledigt');
                      const istNegativ = e.status === 'Abgesagt' || e.status === 'Abgemeldet';
                      return (
                        <div
                          key={e.key}
                          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                            istPositiv ? 'bg-green-500/5 border-green-500/20'
                            : istNegativ ? 'bg-red-500/5 border-red-500/20 opacity-60'
                            : 'bg-secondary/30 border-border'
                          }`}
                        >
                          {/* Datum */}
                          <div className="w-11 h-11 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] text-muted-foreground leading-none">
                              {format(new Date(e.datum), 'MMM', { locale: de })}
                            </span>
                            <span className="text-sm font-bold text-foreground leading-none mt-0.5">
                              {format(new Date(e.datum), 'd')}
                            </span>
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {e.typ === 'ausfahrt' && <Bus size={11} className="inline mr-1 -mt-0.5 text-blue-400" />}
                              {e.typ === 'dienst' && <Briefcase size={11} className="inline mr-1 -mt-0.5 text-yellow-400" />}
                              {e.titel}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{e.typLabel}</span>
                              {e.uhrzeit && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Clock size={10} /> {e.uhrzeit}</span>}
                              {e.ort && <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate"><MapPin size={10} /> {e.ort}</span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                              {e.typ === 'ausfahrt' && e.transport && (
                                <span className="text-xs text-muted-foreground">{e.transport === 'Bus' ? '🚌 Bus' : '🚗 Privat'}</span>
                              )}
                              {e.typ === 'veranstaltung' && e.bus && <span className="text-xs text-blue-400 flex items-center gap-0.5"><Bus size={10} /> Bus</span>}
                            </div>
                            {e.typ === 'dienst' && e.notizen && <p className="text-xs text-muted-foreground mt-1">{e.notizen}</p>}
                          </div>
                          {istPositiv && <Check size={16} className="text-green-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
