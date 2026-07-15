import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannEhrungenVerwalten } from '@/lib/roles';
import {
  berechneEhrungsstatusGesamt,
  isMitgliedsEhrungBaldFaellig,
  isUmzugsEhrungBaldFaellig,
  findeDataProbleme,
  exportiereAlsCSV,
} from '@/lib/ehrungsLogik';
import {
  Award, AlertTriangle, CheckCircle2, Clock, Download,
  Star, TrendingUp, ChevronDown, ChevronUp, RefreshCw, Tent, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TABS = [
  { id: 'faellig', label: 'Fällig', icon: AlertTriangle },
  { id: 'bald', label: 'Bald fällig', icon: Clock },
  { id: 'verliehen', label: 'Verliehen', icon: CheckCircle2 },
  { id: 'probleme', label: 'Datenprobleme', icon: AlertTriangle },
];

const STATUS_COLORS = {
  'Vorgeschlagen': 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  'Geplant':       'bg-blue-900/20 text-blue-400 border border-blue-700/30',
  'Verliehen':     'bg-green-900/20 text-green-400 border border-green-700/30',
  'Abgelehnt':     'bg-red-900/20 text-red-400 border border-red-700/30',
};

function EhrungsBadge({ typ, wert }) {
  const isUmzug = typ === 'Umzugsteilnahmen';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
      isUmzug ? 'bg-blue-900/20 text-blue-400 border border-blue-700/30' : 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'
    }`}>
      {isUmzug ? <Tent size={11} /> : <Star size={11} />}
      {typ === 'Mitgliedsjahre' ? `${wert} Jahre` : `${wert} Umzüge`}
    </span>
  );
}

export default function Ehrungen() {
  const { user } = useAuth();
  const kannVerwalten = kannEhrungenVerwalten(user);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab] = useState('faellig');
  const [error, setError] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [ehrungen, setEhrungen] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, t, v, e] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 300),
        base44.entities.Teilnahme.list('-created_date', 1000),
        base44.entities.Veranstaltung.list('datum', 200),
        base44.entities.Ehrung.list('-created_date', 800),
      ]);
      setMitglieder(m || []);
      setTeilnahmen(t || []);
      setVeranstaltungen(v || []);
      setEhrungen(e || []);
    } catch (e) {
      console.error('Ehrungen laden:', e);
      setError('Daten konnten nicht geladen werden.');
    }
    setLoading(false);
  };

  const alleAuswertungen = useMemo(() => {
    if (loading) return [];
    return mitglieder.map(m => {
      const meineTeilnahmen = teilnahmen.filter(t => t.mitglied_id === m.id);
      const meineEhrungen = ehrungen.filter(e => e.mitglied_id === m.id);
      return berechneEhrungsstatusGesamt(m, meineTeilnahmen, veranstaltungen, meineEhrungen);
    });
  }, [mitglieder, teilnahmen, veranstaltungen, ehrungen, loading]);

  const faelligeEhrungen = useMemo(() => {
    const result = [];
    for (const auswertung of alleAuswertungen) {
      for (const stufe of auswertung.mitgliedsEhrungen.faelligeStufen) {
        result.push({ mitglied: auswertung.mitglied, typ: 'Mitgliedsjahre', stufe, stand: `${auswertung.mitgliedsEhrungen.jahre} Jahre`, auswertung });
      }
      for (const stufe of auswertung.umzugsEhrungen.faelligeStufen) {
        result.push({ mitglied: auswertung.mitglied, typ: 'Umzugsteilnahmen', stufe, stand: `${auswertung.umzugsEhrungen.erwachsenenUmzuege} Umzüge`, auswertung });
      }
    }
    return result;
  }, [alleAuswertungen]);

  const baldFaellige = useMemo(() => {
    const result = [];
    for (const auswertung of alleAuswertungen) {
      if (isMitgliedsEhrungBaldFaellig(auswertung.mitgliedsEhrungen)) {
        result.push({ mitglied: auswertung.mitglied, typ: 'Mitgliedsjahre', naechsteStufe: auswertung.mitgliedsEhrungen.naechsteStufe, fehlend: `${auswertung.mitgliedsEhrungen.jahreZurNaechsten} Jahr(e)`, stand: `${auswertung.mitgliedsEhrungen.jahre} Jahre` });
      }
      if (isUmzugsEhrungBaldFaellig(auswertung.umzugsEhrungen)) {
        result.push({ mitglied: auswertung.mitglied, typ: 'Umzugsteilnahmen', naechsteStufe: auswertung.umzugsEhrungen.naechsteStufe, fehlend: `${auswertung.umzugsEhrungen.fehlendeBisNaechste} Umzüge`, stand: `${auswertung.umzugsEhrungen.erwachsenenUmzuege} Umzüge` });
      }
    }
    return result;
  }, [alleAuswertungen]);

  const verlieheneEhrungen = useMemo(() => {
    return ehrungen.filter(e => e.status === 'Verliehen').sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  }, [ehrungen]);

  const dataProbleme = useMemo(() => {
    return findeDataProbleme(mitglieder, teilnahmen, veranstaltungen, ehrungen);
  }, [mitglieder, teilnahmen, veranstaltungen, ehrungen]);

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleEhrungAktualisieren = async (mitglied, typ, stufe, neuerStatus) => {
    setSaving(`${mitglied.id}-${typ}-${stufe}`);
    try {
      const vorhandene = ehrungen.find(e =>
        e.mitglied_id === mitglied.id && e.typ === typ && Number(e.wert) === stufe && ['Vorgeschlagen', 'Geplant'].includes(e.status)
      );
      if (vorhandene) {
        await base44.entities.Ehrung.update(vorhandene.id, {
          status: neuerStatus,
          datum: neuerStatus === 'Verliehen' ? new Date().toISOString().split('T')[0] : vorhandene.datum,
          verliehen_von: neuerStatus === 'Verliehen' ? user?.full_name : vorhandene.verliehen_von,
        });
      } else {
        await base44.entities.Ehrung.create({
          mitglied_id: mitglied.id, typ, wert: stufe, status: neuerStatus,
          datum: neuerStatus === 'Verliehen' ? new Date().toISOString().split('T')[0] : null,
          verliehen_von: neuerStatus === 'Verliehen' ? user?.full_name : null,
          automatisch_berechnet: true, jahr: new Date().getFullYear(),
        });
      }
      await loadData();
    } catch (e) {
      console.error('Ehrung aktualisieren:', e);
      setError('Ehrung konnte nicht aktualisiert werden.');
    }
    setSaving(null);
  };

  const exportFaellig = () => {
    const daten = faelligeEhrungen.map(e => ({ Name: `${e.mitglied.vorname} ${e.mitglied.nachname}`, Typ: e.typ, Stufe: e.stufe, AktuellerStand: e.stand }));
    exportiereAlsCSV(daten, 'faellige_ehrungen.csv');
  };

  const exportBaldFaellig = () => {
    const daten = baldFaellige.map(e => ({ Name: `${e.mitglied.vorname} ${e.mitglied.nachname}`, Typ: e.typ, NaechsteStufe: e.naechsteStufe, AktuellerStand: e.stand, FehlendeEinheiten: e.fehlend }));
    exportiereAlsCSV(daten, 'bald_faellige_ehrungen.csv');
  };

  const exportVerliehen = () => {
    const daten = verlieheneEhrungen.map(e => ({ Name: getMitgliedName(e.mitglied_id), Typ: e.typ, Stufe: e.wert, Datum: e.datum || '', VerliehenenVon: e.verliehen_von || '', Notiz: e.beschreibung || '' }));
    exportiereAlsCSV(daten, 'verliehene_ehrungen.csv');
  };

  if (!kannVerwalten) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Award size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Diese Seite ist nur für Ehrungsverwalter.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Ehrungen werden berechnet…</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white">Ehrungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {faelligeEhrungen.length} fällig · {verlieheneEhrungen.length} verliehen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg bg-neutral-800 text-muted-foreground hover:text-white transition-colors" title="Neu berechnen">
            <RefreshCw size={16} />
          </button>
          {kannVerwalten && (
            <div className="relative">
              <button onClick={() => setShowExport(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 text-sm text-white hover:bg-neutral-700 transition-colors">
                <Download size={14} /> Export
              </button>
              {showExport && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowExport(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-30 w-48 overflow-hidden">
                    <button onClick={() => { exportFaellig(); setShowExport(false); }} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-neutral-800 transition-colors">Fällige (CSV)</button>
                    <button onClick={() => { exportBaldFaellig(); setShowExport(false); }} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-neutral-800 transition-colors">Bald fällige (CSV)</button>
                    <button onClick={() => { exportVerliehen(); setShowExport(false); }} className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-neutral-800 transition-colors">Verliehene (CSV)</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 ml-2"><AlertCircle size={16} /></button>
        </div>
      )}

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className={`bg-card border rounded-xl p-4 ${faelligeEhrungen.length > 0 ? 'border-yellow-700/30' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground">Fällig</p>
          <p className={`text-2xl font-oswald font-semibold mt-1 ${faelligeEhrungen.length > 0 ? 'text-yellow-400' : 'text-white'}`}>{faelligeEhrungen.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Bald fällig</p>
          <p className="text-2xl font-oswald font-semibold text-white mt-1">{baldFaellige.length}</p>
        </div>
        <div className="bg-card border border-green-700/30 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Verliehen</p>
          <p className="text-2xl font-oswald font-semibold text-green-400 mt-1">{verlieheneEhrungen.length}</p>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${dataProbleme.length > 0 ? 'border-red-700/30' : 'border-border'}`}>
          <p className="text-xs text-muted-foreground">Datenprobleme</p>
          <p className={`text-2xl font-oswald font-semibold mt-1 ${dataProbleme.length > 0 ? 'text-red-400' : 'text-green-400'}`}>{dataProbleme.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {TABS.map(tab => {
          let count = 0;
          if (tab.id === 'faellig') count = faelligeEhrungen.length;
          if (tab.id === 'bald') count = baldFaellige.length;
          if (tab.id === 'verliehen') count = verlieheneEhrungen.length;
          if (tab.id === 'probleme') count = dataProbleme.length;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'bg-neutral-800 text-muted-foreground hover:text-white hover:bg-neutral-700'
              }`}>
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-neutral-700 text-muted-foreground'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Fällig */}
      {activeTab === 'faellig' && (
        <div className="space-y-3">
          {faelligeEhrungen.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-white font-medium">Keine fälligen Ehrungen</p>
              <p className="text-sm text-muted-foreground mt-1">Alle Ehrungen sind auf dem aktuellen Stand.</p>
            </div>
          ) : (
            faelligeEhrungen.map((item, idx) => {
              const key = `${item.mitglied.id}-${item.typ}-${item.stufe}`;
              const isSaving = saving === key;
              return (
                <div key={idx} className="bg-card border border-yellow-700/30 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{item.mitglied.vorname} {item.mitglied.nachname}</p>
                        <EhrungsBadge typ={item.typ} wert={item.stufe} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Aktuell: <span className="text-white font-medium">{item.stand}</span></p>
                    </div>
                  </div>
                  {kannVerwalten && (
                    <div className="flex gap-2 mt-3">
                      <button disabled={isSaving} onClick={() => handleEhrungAktualisieren(item.mitglied, item.typ, item.stufe, 'Geplant')}
                        className="flex-1 py-2 rounded-lg bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 transition-colors text-sm font-medium disabled:opacity-50">
                        Planen
                      </button>
                      <button disabled={isSaving} onClick={() => handleEhrungAktualisieren(item.mitglied, item.typ, item.stufe, 'Verliehen')}
                        className="flex-1 py-2 rounded-lg bg-green-900/20 text-green-400 hover:bg-green-900/30 transition-colors text-sm font-medium disabled:opacity-50">
                        Verliehen
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Bald fällig */}
      {activeTab === 'bald' && (
        <div className="space-y-3">
          {baldFaellige.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={36} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-white font-medium">Keine bald fälligen Ehrungen</p>
              <p className="text-sm text-muted-foreground mt-1">In nächster Zeit steht keine Ehrung an</p>
            </div>
          ) : (
            baldFaellige.map((item, idx) => (
              <div key={idx} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{item.mitglied.vorname} {item.mitglied.nachname}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <EhrungsBadge typ={item.typ} wert={item.naechsteStufe} />
                      <span className="ml-2 text-xs">Noch <span className="text-primary font-bold">{item.fehlend}</span> fehlend · Aktuell: {item.stand}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Verliehen */}
      {activeTab === 'verliehen' && (
        <div className="space-y-2">
          {verlieheneEhrungen.length === 0 ? (
            <div className="text-center py-12">
              <Award size={36} className="text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-white font-medium">Noch keine verliehenen Ehrungen</p>
              <p className="text-sm text-muted-foreground mt-1">Ehrungen werden hier nach Vergabe angezeigt</p>
            </div>
          ) : (
            verlieheneEhrungen.map(e => (
              <div key={e.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-900/20 flex items-center justify-center shrink-0">
                  <Award size={18} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{getMitgliedName(e.mitglied_id)}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <EhrungsBadge typ={e.typ} wert={e.wert} />
                    {e.datum && <span className="text-xs text-muted-foreground">{format(new Date(e.datum), 'dd.MM.yyyy', { locale: de })}</span>}
                    {e.verliehen_von && <span className="text-xs text-muted-foreground">· von {e.verliehen_von}</span>}
                  </div>
                  {e.beschreibung && <p className="text-xs text-muted-foreground mt-1">{e.beschreibung}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Datenprobleme */}
      {activeTab === 'probleme' && (
        <div className="space-y-2">
          {dataProbleme.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-medium">Keine Datenprobleme gefunden</p>
            </div>
          ) : (
            dataProbleme.map((p, idx) => (
              <div key={idx} className="bg-card border border-red-700/30 rounded-xl px-4 py-3 flex items-center gap-3">
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-white">{p.text}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
