import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Link } from 'react-router-dom';
import {
  Calendar, List, ChevronLeft, ChevronRight, Plus, Clock,
  MapPin, Users, Download, Filter, X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import { de } from 'date-fns/locale';
import KalenderTerminModal from '@/components/kalender/KalenderTerminModal';

const TERMINART_FARBEN = {
  'Umzug':             'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Abendveranstaltung':'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Arbeitsdienst':     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Ausschusssitzung':  'bg-red-500/20 text-red-400 border-red-500/30',
  'Vorstandssitzung':  'bg-red-600/20 text-red-300 border-red-600/30',
  'Jugendtermin':      'bg-green-500/20 text-green-400 border-green-500/30',
  'Gruppen-Termin':    'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'Intern':            'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'Sonstiges':         'bg-secondary text-muted-foreground border-border',
};

const TERMINART_DOT = {
  'Umzug':             'bg-orange-400',
  'Abendveranstaltung':'bg-purple-400',
  'Arbeitsdienst':     'bg-blue-400',
  'Ausschusssitzung':  'bg-red-400',
  'Vorstandssitzung':  'bg-red-300',
  'Jugendtermin':      'bg-green-400',
  'Gruppen-Termin':    'bg-teal-400',
  'Intern':            'bg-gray-400',
  'Sonstiges':         'bg-muted-foreground',
};

// Welche Terminarten darf die jeweilige Rolle sehen?
const ROLLE_ERLAUBTE_SICHTBARKEIT = {
  mitglied:        ['alle'],
  elternkonto:     ['alle'],
  spartenleiter:   ['alle', 'verantwortliche'],
  kassierer:       ['alle', 'verantwortliche'],
  stellv_vorstand: ['alle', 'verantwortliche', 'ausschuss', 'admin'],
  vorstand:        ['alle', 'verantwortliche', 'ausschuss', 'admin'],
  admin:           ['alle', 'verantwortliche', 'ausschuss', 'admin', 'eingeladen', 'haesgruppe'],
};

const ALLE_TERMINARTEN = ['Umzug','Abendveranstaltung','Arbeitsdienst','Ausschusssitzung','Vorstandssitzung','Jugendtermin','Gruppen-Termin','Intern','Sonstiges'];

export default function Kalender() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [ansicht, setAnsicht] = useState('liste'); // 'monat' | 'liste'
  const [monat, setMonat] = useState(new Date());
  const [termine, setTermine] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTermin, setSelectedTermin] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTermin, setEditTermin] = useState(null);
  const [filterArt, setFilterArt] = useState('alle');
  const [showFilter, setShowFilter] = useState(false);
  const [downloadingFeed, setDownloadingFeed] = useState(false);

  const userRolle = user?.role || 'mitglied';
  const erlaubteSichtbarkeiten = ROLLE_ERLAUBTE_SICHTBARKEIT[userRolle] || ['alle'];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) {
        setMyMitglied(myM[0]);
        const anm = await base44.entities.KalenderAnmeldung.filter({ mitglied_id: myM[0].id });
        setAnmeldungen(anm);
      }
      const alleTermine = await base44.entities.KalenderTermin.list('datum', 500);
      // Clientseitig filtern (Serverseitig erzwingt ICS-Feed die Sicherheit)
      const sichtbar = alleTermine.filter(t => {
        const s = t.sichtbarkeit || 'alle';
        if (!erlaubteSichtbarkeiten.includes(s)) return false;
        if (s === 'eingeladen') return myM[0] && (t.eingeladene_ids || []).includes(myM[0].id);
        if (s === 'verantwortliche') return myM[0] && (t.verantwortliche_ids || []).includes(myM[0].id);
        return true;
      });
      setTermine(sichtbar);
    } catch (e) {}
    setLoading(false);
  };

  const gefilterteTermine = useMemo(() => {
    let list = [...termine];
    if (filterArt !== 'alle') list = list.filter(t => t.terminart === filterArt);
    return list.sort((a, b) => a.datum.localeCompare(b.datum));
  }, [termine, filterArt]);

  const termineImMonat = useMemo(() => {
    const start = format(startOfMonth(monat), 'yyyy-MM-dd');
    const end = format(endOfMonth(monat), 'yyyy-MM-dd');
    return gefilterteTermine.filter(t => t.datum >= start && t.datum <= end);
  }, [gefilterteTermine, monat]);

  const kommende = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return gefilterteTermine.filter(t => t.datum >= today).slice(0, 20);
  }, [gefilterteTermine]);

  const getTermineForDay = (day) => {
    const key = format(day, 'yyyy-MM-dd');
    return gefilterteTermine.filter(t => t.datum === key);
  };

  const meineAnmeldung = (terminId) => anmeldungen.find(a => a.termin_id === terminId);

  const handleAnmelden = async (termin) => {
    if (!myMitglied) return;
    const vorhandene = meineAnmeldung(termin.id);
    if (vorhandene) {
      await base44.entities.KalenderAnmeldung.update(vorhandene.id, { status: 'Abgesagt' });
    } else {
      await base44.entities.KalenderAnmeldung.create({ termin_id: termin.id, mitglied_id: myMitglied.id, status: 'Angemeldet' });
    }
    const anm = await base44.entities.KalenderAnmeldung.filter({ mitglied_id: myMitglied.id });
    setAnmeldungen(anm);
  };

  const handleDownloadFeed = async (feedTyp) => {
    setDownloadingFeed(true);
    try {
      const res = await base44.functions.invoke('kalenderFeed', {
        feed_typ: feedTyp,
        mitglied_id: myMitglied?.id,
      });
      // ICS als Datei speichern
      const blob = new Blob([res.data], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${feedTyp}-kalender.ics`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {}
    setDownloadingFeed(false);
  };

  const tage = eachDayOfInterval({ start: startOfMonth(monat), end: endOfMonth(monat) });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kalender</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{termine.length} Termine sichtbar</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`p-2 rounded-lg transition-colors ${showFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            <Filter size={18} />
          </button>
          {admin && (
            <button
              onClick={() => { setEditTermin(null); setShowModal(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Neuer Termin</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      {showFilter && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Nach Terminart filtern</p>
            {filterArt !== 'alle' && (
              <button onClick={() => setFilterArt('alle')} className="text-xs text-primary flex items-center gap-1">
                <X size={12} /> Zurücksetzen
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterArt('alle')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filterArt === 'alle' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}
            >
              Alle
            </button>
            {ALLE_TERMINARTEN.map(art => (
              <button
                key={art}
                onClick={() => setFilterArt(art)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filterArt === art ? 'bg-primary text-primary-foreground border-primary' : `${TERMINART_FARBEN[art]} border`}`}
              >
                {art}
              </button>
            ))}
          </div>

          {/* ICS Downloads */}
          <div className="border-t border-border mt-4 pt-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">📅 Kalender abonnieren (ICS)</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleDownloadFeed('mitglieder')} disabled={downloadingFeed}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-border transition-colors">
                <Download size={12} /> Mitglieder
              </button>
              {['spartenleiter','kassierer','stellv_vorstand','vorstand','admin'].includes(userRolle) && (
                <button onClick={() => handleDownloadFeed('verantwortliche')} disabled={downloadingFeed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-border transition-colors">
                  <Download size={12} /> Verantwortliche
                </button>
              )}
              {['stellv_vorstand','vorstand','admin'].includes(userRolle) && (
                <button onClick={() => handleDownloadFeed('ausschuss')} disabled={downloadingFeed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-border transition-colors">
                  <Download size={12} /> Ausschuss
                </button>
              )}
              {['vorstand','admin'].includes(userRolle) && (
                <button onClick={() => handleDownloadFeed('vorstand')} disabled={downloadingFeed}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs text-foreground hover:bg-border transition-colors">
                  <Download size={12} /> Vorstand
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ansicht-Toggle */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
        <button
          onClick={() => setAnsicht('liste')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${ansicht === 'liste' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}
        >
          <List size={15} /> Liste
        </button>
        <button
          onClick={() => setAnsicht('monat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${ansicht === 'monat' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}
        >
          <Calendar size={15} /> Monat
        </button>
      </div>

      {/* MONATSANSICHT */}
      {ansicht === 'monat' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-4">
          {/* Monat-Navigation */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button onClick={() => setMonat(subMonths(monat, 1))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-bold text-foreground">
              {format(monat, 'MMMM yyyy', { locale: de })}
            </h2>
            <button onClick={() => setMonat(addMonths(monat, 1))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Wochentage */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground py-2 font-medium">{d}</div>
            ))}
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7">
            {/* Lücke für Wochenstart */}
            {Array.from({ length: (new Date(format(startOfMonth(monat), 'yyyy-MM-dd')).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 border-b border-r border-border/50" />
            ))}
            {tage.map(day => {
              const dayTermine = getTermineForDay(day);
              const heute = isToday(day);
              const gleichesMonat = isSameMonth(day, monat);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => dayTermine.length > 0 && setSelectedTermin({ day, termine: dayTermine })}
                  className={`h-14 border-b border-r border-border/50 p-1 text-left relative transition-colors ${heute ? 'bg-primary/10' : 'hover:bg-secondary/50'} ${!gleichesMonat ? 'opacity-30' : ''}`}
                >
                  <span className={`text-xs font-medium block text-center w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 ${heute ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {dayTermine.slice(0, 3).map(t => (
                      <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${TERMINART_DOT[t.terminart] || 'bg-primary'}`} />
                    ))}
                    {dayTermine.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayTermine.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tages-Popup */}
          {selectedTermin && (
            <div className="border-t border-border p-4 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">
                  {format(selectedTermin.day, 'EEEE, d. MMMM', { locale: de })}
                </p>
                <button onClick={() => setSelectedTermin(null)} className="p-1 rounded text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              {selectedTermin.termine.map(t => (
                <TerminKarte
                  key={t.id}
                  termin={t}
                  anmeldung={meineAnmeldung(t.id)}
                  onAnmelden={() => handleAnmelden(t)}
                  onEdit={admin ? () => { setEditTermin(t); setShowModal(true); } : null}
                  compact
                />
              ))}
            </div>
          )}

          {/* Monatsübersicht */}
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">{termineImMonat.length} Termine diesen Monat</p>
            <div className="space-y-2">
              {termineImMonat.map(t => (
                <TerminKarte
                  key={t.id}
                  termin={t}
                  anmeldung={meineAnmeldung(t.id)}
                  onAnmelden={() => handleAnmelden(t)}
                  onEdit={admin ? () => { setEditTermin(t); setShowModal(true); } : null}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LISTENANSICHT */}
      {ansicht === 'liste' && (
        <div className="space-y-3">
          {kommende.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-xl">
              <Calendar size={40} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Keine bevorstehenden Termine</p>
              {admin && (
                <button onClick={() => { setEditTermin(null); setShowModal(true); }} className="mt-3 text-sm text-primary hover:underline">
                  Ersten Termin erstellen
                </button>
              )}
            </div>
          ) : (
            kommende.map(t => (
              <TerminKarte
                key={t.id}
                termin={t}
                anmeldung={meineAnmeldung(t.id)}
                onAnmelden={() => handleAnmelden(t)}
                onEdit={admin ? () => { setEditTermin(t); setShowModal(true); } : null}
              />
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <KalenderTerminModal
          termin={editTermin}
          onClose={() => { setShowModal(false); setEditTermin(null); }}
          onSaved={() => { setShowModal(false); setEditTermin(null); loadData(); }}
        />
      )}
    </div>
  );
}

function TerminKarte({ termin, anmeldung, onAnmelden, onEdit, compact = false }) {
  const farbeClass = TERMINART_FARBEN[termin.terminart] || TERMINART_FARBEN['Sonstiges'];
  const isAngemeldet = anmeldung?.status === 'Angemeldet';

  return (
    <div className={`bg-card border border-border rounded-xl overflow-hidden ${compact ? '' : 'hover:border-primary/30 transition-colors'}`}>
      <div className={`flex gap-3 p-4`}>
        {/* Datum */}
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-[9px] text-muted-foreground leading-none">
            {format(parseISO(termin.datum), 'MMM', { locale: de })}
          </span>
          <span className="text-base font-bold text-primary leading-none">
            {format(parseISO(termin.datum), 'd')}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-semibold text-foreground text-sm">{termin.titel}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${farbeClass}`}>
              {termin.terminart}
            </span>
            {isAngemeldet && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Angemeldet</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {(termin.startzeit || termin.endzeit) && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {termin.startzeit}{termin.endzeit ? ` – ${termin.endzeit}` : ''}
              </span>
            )}
            {termin.ort && (
              <span className="flex items-center gap-1 truncate">
                <MapPin size={10} /> {termin.ort}
              </span>
            )}
          </div>
          {!compact && termin.beschreibung && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{termin.beschreibung}</p>
          )}
        </div>

        {onEdit && (
          <button onClick={onEdit} className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
            ✏️
          </button>
        )}
      </div>

      {termin.anmeldbar && onAnmelden && (
        <div className="px-4 pb-3">
          <button
            onClick={onAnmelden}
            className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors ${
              isAngemeldet
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isAngemeldet ? 'Absagen' : 'Anmelden'}
          </button>
        </div>
      )}
    </div>
  );
}