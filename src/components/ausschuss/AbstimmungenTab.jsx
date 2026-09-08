import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Vote, Plus, X, ChevronUp, ChevronDown, Trash2, Check, FileText,
} from 'lucide-react';

const STIMME_FARBEN = {
  'Ja':         'bg-green-500/20 text-green-400 border border-green-500/30',
  'Nein':       'bg-red-500/20 text-red-400 border border-red-500/30',
  'Enthaltung': 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

const STIMME_BTN = {
  'Ja':         'bg-green-600 text-white',
  'Nein':       'bg-red-600 text-white',
  'Enthaltung': 'bg-gray-600 text-white',
};

const inputCls = "w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white focus:outline-none focus:border-primary transition-colors";

export default function AbstimmungenTab({ abstimmungen, setAbstimmungen, mitglieder, ausschussMitglieder, termine, isAdmin, onEdit, onNew }) {
  const { user } = useAuth();
  const [stimmen, setStimmen] = useState([]);
  const [myMitgliedId, setMyMitgliedId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loadingStimmen, setLoadingStimmen] = useState(true);

  // Aktive Ausschussmitglied-IDs
  const ausschussMitgliedIds = (ausschussMitglieder || [])
    .filter(am => am.aktiv !== false)
    .map(am => am.mitglied_id);

  // Aktuelles Mitglied des Users ermitteln
  useEffect(() => {
    const findMe = async () => {
      if (!user) return;
      try {
        const me = await base44.entities.Mitglied.filter({ user_id: user.id });
        if (me && me[0]) setMyMitgliedId(me[0].id);
      } catch (e) {
        console.error('Mitglied konnte nicht ermittelt werden:', e);
      }
    };
    findMe();
  }, [user]);

  // Ist der aktuelle User Teil des Ausschusses?
  const isAusschussMitglied = myMitgliedId && ausschussMitgliedIds.includes(myMitgliedId);

  // Stimmen laden
  const loadStimmen = async () => {
    setLoadingStimmen(true);
    try {
      const st = await base44.entities.AbstimmungsStimme.list('-created_date', 500);
      setStimmen(st || []);
    } catch (e) {
      console.error('Stimmen laden:', e);
    }
    setLoadingStimmen(false);
  };

  useEffect(() => { loadStimmen(); }, []);

  const getStimmenFuerAbstimmung = (abstimmungId) => stimmen.filter(s => s.abstimmung_id === abstimmungId);

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  // Eigene Stimme abgeben / ändern
  const handleStimme = async (abstimmungId, stimme) => {
    if (!myMitgliedId) return;
    const vorh = stimmen.find(s => s.abstimmung_id === abstimmungId && s.mitglied_id === myMitgliedId);
    try {
      if (vorh) {
        if (vorh.stimme === stimme) return; // keine Änderung
        await base44.entities.AbstimmungsStimme.update(vorh.id, { stimme });
        setStimmen(prev => prev.map(s => s.id === vorh.id ? { ...s, stimme } : s));
      } else {
        const neu = await base44.entities.AbstimmungsStimme.create({ abstimmung_id: abstimmungId, mitglied_id: myMitgliedId, stimme });
        setStimmen(prev => [...prev, neu]);
      }
    } catch (e) {
      console.error('Stimme abgeben:', e);
    }
  };

  // Admin: Stimme für anderes Mitglied ändern
  const handleStimmeFuerMitglied = async (abstimmungId, mitgliedId, stimme) => {
    const vorh = stimmen.find(s => s.abstimmung_id === abstimmungId && s.mitglied_id === mitgliedId);
    try {
      if (vorh) {
        if (vorh.stimme === stimme) return;
        await base44.entities.AbstimmungsStimme.update(vorh.id, { stimme });
        setStimmen(prev => prev.map(s => s.id === vorh.id ? { ...s, stimme } : s));
      } else {
        const neu = await base44.entities.AbstimmungsStimme.create({ abstimmung_id: abstimmungId, mitglied_id: mitgliedId, stimme });
        setStimmen(prev => [...prev, neu]);
      }
    } catch (e) {
      console.error('Stimme für Mitglied:', e);
    }
  };

  // Abstimmung abschließen
  const handleAbschliessen = async (abs) => {
    const st = getStimmenFuerAbstimmung(abs.id);
    const ja = st.filter(s => s.stimme === 'Ja').length;
    const gesamt = st.filter(s => s.stimme !== 'Enthaltung').length;
    const prozent = gesamt > 0 ? (ja / gesamt) * 100 : 0;
    const ergebnis = prozent > (abs.angenommen_ab || 50) ? 'Angenommen' : 'Abgelehnt';
    try {
      await base44.entities.Abstimmung.update(abs.id, { status: 'Abgeschlossen', ergebnis });
      setAbstimmungen(prev => prev.map(a => a.id === abs.id ? { ...a, status: 'Abgeschlossen', ergebnis } : a));
    } catch (e) {
      console.error('Abstimmung abschließen:', e);
    }
  };

  // Abstimmung wieder öffnen
  const handleWiederOeffnen = async (abs) => {
    try {
      await base44.entities.Abstimmung.update(abs.id, { status: 'Offen', ergebnis: null });
      setAbstimmungen(prev => prev.map(a => a.id === abs.id ? { ...a, status: 'Offen', ergebnis: null } : a));
    } catch (e) {
      console.error('Abstimmung öffnen:', e);
    }
  };

  const getMyStimme = (abstimmungId) => {
    if (!myMitgliedId) return null;
    const s = stimmen.find(s => s.abstimmung_id === abstimmungId && s.mitglied_id === myMitgliedId);
    return s?.stimme || null;
  };

  return (
    <div>
      {/* Header mit Neu-Button */}
      <div className="flex justify-end mb-4">
        <button onClick={onNew}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors">
          <Plus size={15} /> Abstimmung
        </button>
      </div>

      {abstimmungen.length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Vote size={32} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-white">Noch keine Abstimmungen erfasst</p>
        </div>
      )}

      <div className="space-y-3">
        {abstimmungen.map(abs => {
          const absStimmen = getStimmenFuerAbstimmung(abs.id);
          const ja = absStimmen.filter(s => s.stimme === 'Ja').length;
          const nein = absStimmen.filter(s => s.stimme === 'Nein').length;
          const enthalten = absStimmen.filter(s => s.stimme === 'Enthaltung').length;
          const gesamt = absStimmen.length;
          const abgeschlossen = abs.status === 'Abgeschlossen';
          const sitzung = termine.find(t => t.id === abs.termin_id);
          const myStimme = getMyStimme(abs.id);
          const optionen = abs.antwort_optionen && abs.antwort_optionen.length > 0 ? abs.antwort_optionen : ['Ja', 'Nein', 'Enthaltung'];

          return (
            <div key={abs.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Titel & Status */}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-white">{abs.titel}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${abgeschlossen ? 'bg-green-900/20 text-green-400 border border-green-700/30' : 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'}`}>
                      {abs.status}
                    </span>
                    {abgeschlossen && abs.ergebnis && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${abs.ergebnis === 'Angenommen' ? 'bg-green-900/20 text-green-400 border border-green-700/30' : 'bg-red-900/20 text-red-400 border border-red-700/30'}`}>
                        {abs.ergebnis}
                      </span>
                    )}
                  </div>
                  {abs.beschreibung && <p className="text-xs text-muted-foreground mt-0.5">{abs.beschreibung}</p>}
                  {sitzung && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Vote size={11} /> {sitzung.titel} · {sitzung.datum}
                    </p>
                  )}
                  {/* Stimmen-Zusammenfassung */}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-green-400 font-semibold flex items-center gap-1">✓ {ja}</span>
                    <span className="text-red-400 font-semibold flex items-center gap-1">✗ {nein}</span>
                    <span className="text-muted-foreground flex items-center gap-1">∼ {enthalten}</span>
                    <span className="text-muted-foreground/60">· {gesamt} Stimmen</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEdit(abs)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Bearbeiten">
                    <FileText size={14} />
                  </button>
                  <button onClick={() => setExpandedId(expandedId === abs.id ? null : abs.id)}
                    className="p-1 rounded text-muted-foreground hover:text-white shrink-0" title="Details">
                    {expandedId === abs.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Eigene Abstimmung — simpel direkt unter dem Titel */}
              {!abgeschlossen && isAusschussMitglied && (
                <div className="px-4 pb-3 border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground font-medium mb-2">
                    {myStimme ? `Deine Stimme: ${myStimme}` : 'Jetzt abstimmen:'}
                  </p>
                  <div className="flex gap-2">
                    {optionen.map(opt => (
                      <button key={opt}
                        onClick={() => handleStimme(abs.id, opt)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                          myStimme === opt
                            ? `${STIMME_BTN[opt] || 'bg-primary text-white'} border-transparent`
                            : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-white'
                        }`}>
                        {opt === 'Enthaltung' ? '∼ Enthaltung' : opt === 'Ja' ? '✓ Ja' : opt === 'Nein' ? '✗ Nein' : opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!abgeschlossen && !isAusschussMitglied && (
                <div className="px-4 pb-3 border-t border-border/50 pt-3">
                  <p className="text-xs text-muted-foreground italic">
                    {myMitgliedId
                      ? 'Du bist kein aktives Ausschussmitglied — keine Abstimmungsberechtigung.'
                      : 'Kein Mitgliederprofil verknüpft — Abstimmung nur als Admin möglich (Details).'}
                  </p>
                </div>
              )}

              {/* Erweitert: Admin — namentliche Abstimmung & Abschließen */}
              {expandedId === abs.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  {/* Admin: namentliche Abstimmung (nur Ausschussmitglieder) */}
                  {isAdmin && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Namentliche Abstimmung — Ausschussmitglieder ({ausschussMitgliedIds.length})
                      </p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {ausschussMitgliedIds.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">Keine aktiven Ausschussmitglieder erfasst.</p>
                        )}
                        {ausschussMitgliedIds.map(amId => {
                          const m = mitglieder.find(x => x.id === amId);
                          if (!m) return null;
                          const stimme = absStimmen.find(s => s.mitglied_id === amId);
                          return (
                            <div key={amId} className="flex items-center gap-2">
                              <span className="text-sm text-white flex-1 truncate">{m.vorname} {m.nachname}</span>
                              {!abgeschlossen ? (
                                <div className="flex gap-1 shrink-0">
                                  {['Ja', 'Nein', 'Enthaltung'].map(s => (
                                    <button key={s}
                                      onClick={() => handleStimmeFuerMitglied(abs.id, amId, s)}
                                      className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                        stimme?.stimme === s
                                          ? STIMME_FARBEN[s]
                                          : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
                                      }`}>
                                      {s === 'Enthaltung' ? '∼' : s === 'Ja' ? '✓' : '✗'}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${stimme ? STIMME_FARBEN[stimme.stimme] : 'bg-secondary text-muted-foreground'}`}>
                                  {stimme?.stimme || '–'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Abschließen / Öffnen */}
                  {isAdmin && (
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      {!abgeschlossen ? (
                        <button onClick={() => handleAbschliessen(abs)}
                          className="flex-1 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-semibold">
                          Abstimmung abschließen
                        </button>
                      ) : (
                        <button onClick={() => handleWiederOeffnen(abs)}
                          className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-white border border-border transition-colors text-sm font-semibold">
                          Wieder eröffnen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}