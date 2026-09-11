import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannArbeitsdiensteVerwalten } from '@/lib/roles';
import { Briefcase, Plus, Calendar, MapPin, Users, User, Edit, X, ChevronDown, ChevronUp, LayoutTemplate, List, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import ArbeitsdienstEditModal from '@/components/arbeitsdienst/ArbeitsdienstEditModal';
import VeranstaltungsvorlagenModal from '@/components/veranstaltung/VeranstaltungsvorlagenModal';
import ArbeitsdienstKalender from '@/components/arbeitsdienst/ArbeitsdienstKalender';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { toast } from 'sonner';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'In Planung': 'bg-blue-500/20 text-blue-400',
  'Abgeschlossen': 'bg-green-500/20 text-green-400',
};

const ZUWEISUNG_COLORS = {
  'Offen':         'bg-secondary text-muted-foreground',
  'Bestätigt':     'bg-green-500/20 text-green-400',
  'Erledigt':      'bg-green-500/20 text-green-400',
  'Abgesagt':      'bg-red-500/20 text-red-400',
  'Nicht erledigt':'bg-orange-500/20 text-orange-400',
};

export default function Arbeitsdienste() {
  const { user } = useAuth();
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('Kommend');
  const [editDienst, setEditDienst] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [showVorlagen, setShowVorlagen] = useState(false);
  const [ansicht, setAnsicht] = useState('liste'); // 'liste' | 'kalender'
  const [nurMeine, setNurMeine] = useState(false);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await base44.functions.invoke('getArbeitsdiensteSicher', {});
      if (!result.data.erfolg) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setDienste(result.data.dienste);
      setZuweisungen(result.data.zuweisungen);
      setVeranstaltungen(result.data.veranstaltungen || []);
      setMitglieder(result.data.mitglieder);

      const myMArr = result.data.mitglieder.filter(m => m.user_id === user?.id);
      if (myMArr.length > 0) {
        setMyMitglied(myMArr[0]);
      }
    } catch (e) {
      console.error('[Arbeitsdienste]', e instanceof Error ? e.message : e);
      setLoadError(true);
    }
    setLoading(false);
  }, [user]);

  const { pullDistance, refreshing, containerRef } = usePullToRefresh(loadData);

  const getZuweisungen = (dienstId) => zuweisungen.filter(z => z.arbeitsdienst_id === dienstId);
  const meineZuweisung = (dienstId) => myMitglied ? zuweisungen.find(z => z.arbeitsdienst_id === dienstId && z.mitglied_id === myMitglied.id) : null;

  const handleStatusChange = async (zuweisung, newStatus) => {
    try {
      await base44.entities.ArbeitsdienstZuweisung.update(zuweisung.id, { status: newStatus });
      setZuweisungen(prev => prev.map(z => z.id === zuweisung.id ? { ...z, status: newStatus } : z));
    } catch (e) {
      console.error('Status ändern:', e);
      toast.error('Status konnte nicht geändert werden');
    }
  };

  const filtered = dienste
    .filter(d => {
      if (filter === 'Alle') return true;
      if (filter === 'Kommend') return d.datum >= today;
      if (filter === 'Vergangen') return d.datum < today;
      return d.status === filter;
    })
    .filter(d => !nurMeine || (myMitglied && zuweisungen.some(z => z.arbeitsdienst_id === d.id && z.mitglied_id === myMitglied.id)))
    .sort((a, b) => {
      const aKey = `${a.datum || ''}T${a.uhrzeit || '00:00'}`;
      const bKey = `${b.datum || ''}T${b.uhrzeit || '00:00'}`;
      // Vergangen: absteigend (neueste zuerst), sonst aufsteigend
      return filter === 'Vergangen' ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
    });

  // Gruppiere nach Veranstaltung (und nicht zugeordnete Dienste)
  const grouped = filtered.reduce((acc, d) => {
    const key = d.veranstaltung_id || '_keine';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  // Sortiere nach Veranstaltungsdatum oder Dienstdatum
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const aEvent = a === '_keine' ? null : veranstaltungen.find(v => v.id === a);
    const bEvent = b === '_keine' ? null : veranstaltungen.find(v => v.id === b);
    const aDate = aEvent?.datum || grouped[a][0]?.datum || '9999-12-31';
    const bDate = bEvent?.datum || grouped[b][0]?.datum || '9999-12-31';
    return aDate.localeCompare(bDate);
  });

  // PDF-Export der aktuell gefilterten Ansicht (respektiert Kommend/Vergangen/Alle + 'Nur meine')
  const exportierePdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const SEITENBREITE = 210;
    const RAND = 15;
    const INHALT = SEITENBREITE - 2 * RAND;
    let y = 0;

    const filterLabel = filter === 'Kommend' ? 'Kommende Dienste' : filter === 'Vergangen' ? 'Vergangene Dienste' : 'Alle Dienste';
    const heute = format(new Date(), 'dd.MM.yyyy', { locale: de });

    const neueSeite = () => {
      doc.addPage();
      y = 20;
    };
    const sicher = (platz) => {
      if (y + platz > 282) neueSeite();
    };

    // Kopfzeile auf jeder Seite
    const kopf = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(234, 37, 37); // #EA2525
      doc.text('NARRENZUNFT FROMMERN', RAND, 12);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Arbeitsdienste - ${filterLabel}${nurMeine ? ' (nur meine)' : ''}`, RAND, 18);
      doc.setDrawColor(234, 37, 37);
      doc.setLineWidth(0.6);
      doc.line(RAND, 21, SEITENBREITE - RAND, 21);
    };

    kopf();
    y = 28;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Erstellt am ${heute}`, RAND, y);
    y += 4;

    if (filtered.length === 0) {
      y += 6;
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('Keine Arbeitsdienste in dieser Ansicht.', RAND, y);
    }

    const mitgliedName = (id) => {
      const m = mitglieder.find(x => x.id === id);
      return m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : 'Unbekannt';
    };
    const statusLabel = { 'Offen': '(offen)', 'Bestätigt': '(bestätigt)', 'Abgesagt': '(abgesagt)', 'Erledigt': '(erledigt)', 'Nicht erledigt': '(nicht erledigt)' };

    sortedKeys.forEach(eventKey => {
      const dienste_event = grouped[eventKey];
      const event = eventKey === '_keine' ? null : veranstaltungen.find(v => v.id === eventKey);

      sicher(24);
      // Veranstaltungs-Überschrift
      doc.setFillColor(245, 245, 245);
      doc.rect(RAND, y - 4, INHALT, 9, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const eventTitel = event ? event.titel : 'Keine Veranstaltung zugeordnet';
      const eventDatum = event ? ` - ${format(new Date(event.datum), 'dd.MM.yyyy', { locale: de })}` : '';
      doc.text(`${eventTitel}${eventDatum}`.slice(0, 75), RAND + 2, y + 2);
      y += 11;

      dienste_event.forEach(d => {
        const zuws = getZuweisungen(d.id).filter(z => z.status !== 'Abgesagt');
        sicher(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(234, 37, 37);
        const datumStr = format(new Date(d.datum), 'dd.MM.yyyy', { locale: de });
        const titel = d.titel.length > 60 ? d.titel.slice(0, 57) + '...' : d.titel;
        doc.text(`${datumStr}${d.uhrzeit ? '  ' + d.uhrzeit + ' Uhr' : ''}  ${titel}`, RAND + 2, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        if (d.ort) {
          sicher(5);
          doc.text(`Ort: ${d.ort}`.slice(0, 90), RAND + 5, y);
          y += 4.5;
        }
        if (d.beschreibung) {
          sicher(5);
          doc.text(`Hinweis: ${d.beschreibung}`.slice(0, 90), RAND + 5, y);
          y += 4.5;
        }
        sicher(5 + Math.max(1, Math.ceil(zuws.length / 2)) * 5);
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        if (zuws.length === 0) {
          doc.text('Noch niemand eingeteilt', RAND + 5, y);
          y += 5;
        } else {
          // Zwei Namen pro Zeile (Platz sparen)
          for (let i = 0; i < zuws.length; i += 2) {
            const pairs = zuws.slice(i, i + 2).map(z => `${mitgliedName(z.mitglied_id)} ${statusLabel[z.status] || ''}`.trim());
            doc.text(pairs.join('     |     ').slice(0, 110), RAND + 5, y);
            y += 5;
          }
        }
        y += 3;
      });
      y += 2;
    });

    // Fußzeilen mit Seitenzahlen
    const seiten = doc.getNumberOfPages();
    for (let i = 1; i <= seiten; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Seite ${i} von ${seiten}`, SEITENBREITE / 2, 291, { align: 'center' });
    }

    doc.save(`Arbeitsdienste_${filterLabel.replace(/ /g, '-')}_${heute.replace(/\./g, '-')}.pdf`);
  };

  if (!loading && loadError) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <p className="text-sm text-muted-foreground">Arbeitsdienste konnten nicht geladen werden</p>
      <button onClick={() => loadData()} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
        Erneut versuchen
      </button>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Arbeitsdienste werden geladen…</p>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-4xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Arbeitsdienste</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dienste.length} gesamt</p>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={exportierePdf}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
            title="Aktuelle Ansicht als PDF exportieren"
          >
            <FileDown size={16} />
            <span className="hidden sm:inline">PDF</span>
          </button>
          {kannVerwalten && (
            <>
            <button
              onClick={() => setShowVorlagen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border hover:text-foreground transition-colors"
              title="Vorlagen verwalten"
            >
              <LayoutTemplate size={16} />
              <span className="hidden sm:inline">Vorlagen</span>
            </button>
            <Link
              to="/arbeitsdienste/neu"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Neuer Dienst</span>
            </Link>
            </>
          )}
        </div>
      </div>

      {/* Ansicht-Toggle */}
      <div className="flex gap-1.5 mb-4">
        <button
          onClick={() => setAnsicht('liste')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${ansicht === 'liste' ? 'bg-primary text-white shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <List size={14} /> Liste
        </button>
        <button
          onClick={() => setAnsicht('kalender')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${ansicht === 'kalender' ? 'bg-primary text-white shadow-sm' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <Calendar size={14} /> Kalender
        </button>
      </div>

      {/* Kalenderansicht */}
      {ansicht === 'kalender' && (
        <ArbeitsdienstKalender
          dienste={dienste}
          zuweisungen={zuweisungen}
          onDienstClick={(d) => kannVerwalten && setEditDienst(d)}
        />
      )}

      {ansicht === 'liste' && (
        <>
        {/* Filter */}
        {(() => {
          const filterCount = {
            'Alle':         dienste.length,
            'Kommend':      dienste.filter(d => d.datum >= today).length,
            'Vergangen':    dienste.filter(d => d.datum < today).length,
          };
          const meineCount = myMitglied
            ? dienste.filter(d => zuweisungen.some(z => z.arbeitsdienst_id === d.id && z.mitglied_id === myMitglied.id)).length
            : 0;
          return (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
              {['Alle', 'Kommend', 'Vergangen'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filter === f ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {f}
                  <span className={`text-[10px] font-bold px-1 rounded-full ${filter === f ? 'bg-white/20' : 'bg-secondary'}`}>
                    {filterCount[f] ?? 0}
                  </span>
                </button>
              ))}
              <button
                onClick={() => setNurMeine(v => !v)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  nurMeine ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                }`}
              >
                <User size={11} /> Nur meine
                <span className={`text-[10px] font-bold px-1 rounded-full ${nurMeine ? 'bg-white/20' : 'bg-secondary'}`}>
                  {meineCount}
                </span>
              </button>
            </div>
          );
        })()}

        <div className="space-y-3">
        {sortedKeys.map(eventKey => {
          const dienste_event = grouped[eventKey];
          const event = eventKey === '_keine' ? null : veranstaltungen.find(v => v.id === eventKey);
          const isExpanded = expandedEvents[eventKey] !== false; // Default: expanded
          const allZuweisungen = dienste_event.reduce((sum, d) => sum + getZuweisungen(d.id).filter(z => z.status !== 'Abgesagt').length, 0);
          
          return (
            <div key={eventKey}>
              {/* Veranstaltungs Header (Klappbar) */}
              <button
                onClick={() => setExpandedEvents(p => ({ ...p, [eventKey]: !p[eventKey] }))}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/60 border border-border hover:border-primary/40 transition-all"
              >
                {event ? (
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center ${event.datum === today ? 'bg-primary' : 'bg-primary/10'}`}>
                    <span className={`text-[9px] uppercase leading-none font-medium ${event.datum === today ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {format(new Date(event.datum), 'MMM', { locale: de })}
                    </span>
                    <span className={`text-base font-oswald font-bold leading-tight ${event.datum === today ? 'text-white' : 'text-primary'}`}>
                      {format(new Date(event.datum), 'd')}
                    </span>
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Briefcase size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {event ? event.titel : 'Keine Veranstaltung zugeordnet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event ? format(new Date(event.datum), 'dd.MM.yyyy', { locale: de }) : 'N/A'} · {dienste_event.length} Dienst{dienste_event.length !== 1 ? 'e' : ''} · {allZuweisungen} eingeteilt
                  </p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-primary shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>

              {/* Dienste (Ausgeklappt) */}
              {isExpanded && (
                <div className="space-y-2 mt-2 ml-1 pl-3 border-l border-primary/30">
                  {dienste_event.map(d => {
                    const zuws = getZuweisungen(d.id);
                    const meineZ = meineZuweisung(d.id);

                    return (
                      <div key={d.id} className="bg-card border border-border rounded-lg overflow-hidden">
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground text-sm">{d.titel}</h3>
                                {d.datum === today && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white font-semibold">HEUTE</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
                                {d.uhrzeit && <span>{d.uhrzeit} Uhr</span>}
                                {d.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {d.ort}</span>}
                                <span className="flex items-center gap-1">
                                  <Users size={10} /> {zuws.filter(z => z.status !== 'Abgesagt').length}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                                </span>
                              </div>
                              {d.beschreibung && (
                                <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{d.beschreibung}</p>
                              )}
                              {d.benoetigte_personen > 0 && (() => {
                                const eingeteilt = zuws.filter(z => z.status !== 'Abgesagt').length;
                                const pct = Math.min(100, Math.round((eingeteilt / d.benoetigte_personen) * 100));
                                const barColor = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-primary';
                                return (
                                  <div className="mt-2">
                                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            {kannVerwalten && (
                              <button
                                onClick={() => setEditDienst(d)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                              >
                                <Edit size={13} />
                              </button>
                            )}
                          </div>

                          {/* Meine Zuweisung */}
                          {meineZ && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-[10px] text-muted-foreground mb-1.5">Meine Zuweisung:</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    if (meineZ.status === 'Bestätigt') return;
                                    await handleStatusChange(meineZ, 'Bestätigt');
                                  }}
                                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                                    meineZ.status === 'Bestätigt' || meineZ.status === 'Erledigt'
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-400 border border-border'
                                  }`}
                                >
                                  {meineZ.status === 'Bestätigt' || meineZ.status === 'Erledigt' ? '✓ Bestätigt' : '✓ Bestätigen'}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (meineZ.status === 'Abgesagt') return;
                                    await handleStatusChange(meineZ, 'Abgesagt');
                                  }}
                                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                                    meineZ.status === 'Abgesagt'
                                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                      : 'bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-400 border border-border'
                                  }`}
                                >
                                  {meineZ.status === 'Abgesagt' ? '✗ Abgesagt' : '✗ Absagen'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Zugewiesene Personen – nur für Verwalter mit Namen, für andere nur Anzahl */}
                          {zuws.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              {kannVerwalten ? (
                                <>
                                  <p className="text-[10px] text-muted-foreground mb-1">Eingeteilt ({zuws.length}):</p>
                                  <div className="flex flex-wrap gap-1">
                                    {zuws.map(z => {
                                      const m = mitglieder.find(m => m.id === z.mitglied_id);
                                      return (
                                        <span
                                          key={z.id}
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full ${ZUWEISUNG_COLORS[z.status] || ZUWEISUNG_COLORS['Offen']}`}
                                        >
                                          {m ? `${m.vorname} ${m.nachname?.[0] || ''}.` : '–'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <p className="text-[10px] text-muted-foreground">
                                  {zuws.filter(z => z.status !== 'Abgesagt').length} Person(en) eingeteilt
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Briefcase size={36} className="text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-foreground font-medium">Keine Arbeitsdienste</p>
            <p className="text-sm text-muted-foreground mt-1">
              {nurMeine
                ? 'Du bist aktuell für keinen Arbeitsdienst eingeteilt.'
                : filter !== 'Alle' ? `Keine Einträge für Filter „${filter}"` : 'Noch keine Arbeitsdienste angelegt'}
            </p>
            {(filter !== 'Alle' || nurMeine) && (
              <button onClick={() => { setFilter('Alle'); setNurMeine(false); }} className="mt-3 text-xs text-primary hover:underline">
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}
        </>
      )}

      {showVorlagen && (
        <VeranstaltungsvorlagenModal onClose={() => setShowVorlagen(false)} />
      )}

      {/* Edit Modal */}
      {editDienst && (
        <ArbeitsdienstEditModal
          dienst={editDienst}
          mitglieder={mitglieder}
          zuweisungen={zuweisungen.filter(z => z.arbeitsdienst_id === editDienst.id)}
          onClose={() => setEditDienst(null)}
          onSaved={() => { setEditDienst(null); loadData(); }}
        />
      )}
    </div>
  );
}