import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Search, Loader2, X, Users, Link2, PauseCircle, RotateCcw,
  AlertTriangle, CheckCircle2, UserPlus, Baby
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const HEUTE = new Date();

const istMinderjaehrig = (geb) => {
  if (!geb) return false;
  const d = new Date(geb);
  if (isNaN(d.getTime())) return false;
  const volljaehrig = new Date(d);
  volljaehrig.setFullYear(volljaehrig.getFullYear() + 18);
  return volljaehrig > HEUTE;
};

const alterVon = (geb) => {
  if (!geb) return '?';
  const d = new Date(geb);
  if (isNaN(d.getTime())) return '?';
  let a = HEUTE.getFullYear() - d.getFullYear();
  const m = HEUTE.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && HEUTE.getDate() < d.getDate())) a -= 1;
  return a;
};

/**
 * FaelleSektion – Live berechnete Familienzuordnung auf der Datenqualitäts-Seite.
 *
 * Die Fälle entstehen automatisch aus der Datenlage: Jedes Mitglied unter 18
 * ohne Elternteil-Verknüpfung ist ein Fall (gruppiert nach Nachname).
 * Der Vorstand wählt Vater/Mutter per Namenssuche und tippt „Verknüpfen“ –
 * die App legt die Verwandtschafts-Records an (Kind beidseitig, Geschwister
 * automatisch) und der Fall verschwindet. Nichts muss gepflegt werden.
 */
export default function FaelleSektion({ onOpenCountChange }) {
  const [mitglieder, setMitglieder] = useState([]);
  const [verwandtschaften, setVerwandtschaften] = useState([]);
  const [faelle, setFaelle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suche, setSuche] = useState('');
  const [zeigeZurueckgestellt, setZeigeZurueckgestellt] = useState(false);

  const [elternwahl, setElternwahl] = useState({});       // { [familie]: { vater: m, mutter: m } }
  const [sucheFeld, setSucheFeld] = useState({});          // { [familie_vater]: 'text' }
  const [kindAbgewaehlt, setKindAbgewaehlt] = useState({}); // { [familie]: { [kindId]: true } }
  const [geschwisterAus, setGeschwisterAus] = useState({});   // { [familie]: true } wenn KEINE Geschwister-Verknuepfung
  const [actionFamilie, setActionFamilie] = useState(null);

  const ladeDaten = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, vRes, fRes] = await Promise.all([
        base44.entities.Mitglied.filter({}, { limit: 1000, sort: 'nachname' }),
        base44.entities.Verwandtschaft.filter({}, { limit: 1000 }),
        base44.entities.DatenqualitaetFall.filter({}, { limit: 500 }),
      ]);
      setMitglieder(mRes.items || mRes || []);
      setVerwandtschaften(vRes.items || vRes || []);
      setFaelle(fRes.items || fRes || []);
    } catch (e) {
      console.error('Fälle laden:', e);
      setError('Daten konnten nicht geladen werden.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { ladeDaten(); }, [ladeDaten]);

  // Alle Kinder, die bereits ein Elternteil haben (beide Blickrichtungen)
  const kinderMitEltern = useMemo(() => {
    const set = new Set();
    verwandtschaften.forEach(v => {
      if (v.beziehung === 'Kind') set.add(v.verwandter_id);
      if (v.beziehung === 'Elternteil') set.add(v.mitglied_id);
    });
    return set;
  }, [verwandtschaften]);

  const paarExistiert = useCallback((a, b) =>
    verwandtschaften.some(v =>
      (v.mitglied_id === a && v.verwandter_id === b) ||
      (v.mitglied_id === b && v.verwandter_id === a)
    ), [verwandtschaften]);

  // Offene Fälle: Minderjährige ohne Elternteil, gruppiert nach Nachname
  const familien = useMemo(() => {
    const offen = mitglieder.filter(m => istMinderjaehrig(m.geburtsdatum) && !kinderMitEltern.has(m.id));
    const gruppen = {};
    offen.forEach(m => {
      const name = (m.nachname || 'Ohne Nachname').trim();
      (gruppen[name] = gruppen[name] || []).push(m);
    });
    return Object.entries(gruppen)
      .map(([name, kinder]) => ({
        name,
        kinder: kinder.sort((a, b) => (a.geburtsdatum || '') < (b.geburtsdatum || '') ? 1 : -1)
      }))
      .sort((a, b) => b.kinder.length - a.kinder.length || a.name.localeCompare(b.name));
  }, [mitglieder, kinderMitEltern]);

  useEffect(() => {
    onOpenCountChange?.(familien.reduce((s, f) => s + f.kinder.length, 0));
  }, [familien, onOpenCountChange]);

  const erwachsenePool = useMemo(
    () => mitglieder.filter(m => !istMinderjaehrig(m.geburtsdatum)),
    [mitglieder]
  );

  const fallFuerFamilie = useCallback((name) =>
    faelle.find(f => (f.titel || '').includes(name)), [faelle]);

  const istZurueckgestellt = useCallback((name) =>
    fallFuerFamilie(name)?.status === 'In Bearbeitung', [fallFuerFamilie]);

  const verknuepfen = async (fam) => {
    const wahl = elternwahl[fam.name] || {};
    const eltern = [wahl.vater, wahl.mutter].filter(Boolean);
    const abgewaehlt = kindAbgewaehlt[fam.name] || {};
    const kinder = fam.kinder.filter(k => !abgewaehlt[k.id]);
    if (!eltern.length || !kinder.length) return;

    setActionFamilie(fam.name);
    try {
      const neu = [];
      eltern.forEach(p => kinder.forEach(c => {
        if (!paarExistiert(p.id, c.id)) {
          neu.push({ mitglied_id: p.id, verwandter_id: c.id, beziehung: 'Kind' });
        }
      }));
      if (geschwisterAus[fam.name] !== true) {
        for (let i = 0; i < kinder.length; i++) {
          for (let j = i + 1; j < kinder.length; j++) {
            if (!paarExistiert(kinder[i].id, kinder[j].id)) {
              neu.push({ mitglied_id: kinder[i].id, verwandter_id: kinder[j].id, beziehung: 'Geschwister' });
            }
          }
        }
      }
      await Promise.all(neu.map(r => base44.entities.Verwandtschaft.create(r)));
      setVerwandtschaften(prev => [...prev, ...neu]);

      // Passenden Fall-Datensatz (Hinweis-Store) abschließen, wenn die Familie komplett ist
      const fall = fallFuerFamilie(fam.name);
      if (fall && kinder.length === fam.kinder.length) {
        try {
          await base44.entities.DatenqualitaetFall.update(fall.id, { status: 'Erledigt' });
          setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, status: 'Erledigt' } : f));
        } catch (e) { console.error('Fall abschließen:', e); }
      }

      setElternwahl(prev => { const c = { ...prev }; delete c[fam.name]; return c; });
      setSucheFeld(prev => { const c = { ...prev }; delete c[`${fam.name}_vater`]; delete c[`${fam.name}_mutter`]; return c; });
      setKindAbgewaehlt(prev => { const c = { ...prev }; delete c[fam.name]; return c; });
      setGeschwisterAus(prev => { const c = { ...prev }; delete c[fam.name]; return c; });
    } catch (e) {
      console.error('Verknüpfen:', e);
      setError('Verknüpfung fehlgeschlagen – bitte erneut versuchen.');
    }
    setActionFamilie(null);
  };

  const zurueckstellen = async (fam) => {
    setActionFamilie(fam.name);
    try {
      const fall = fallFuerFamilie(fam.name);
      if (fall) {
        await base44.entities.DatenqualitaetFall.update(fall.id, { status: 'In Bearbeitung' });
        setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, status: 'In Bearbeitung' } : f));
      } else {
        const neu = await base44.entities.DatenqualitaetFall.create({
          titel: `Familienzuordnung: ${fam.name}`,
          kategorie: 'Familienzuordnung',
          status: 'In Bearbeitung'
        });
        setFaelle(prev => [...prev, neu]);
      }
    } catch (e) {
      console.error('Zurückstellen:', e);
      setError('Zurückstellen fehlgeschlagen.');
    }
    setActionFamilie(null);
  };

  const wiederOeffnen = async (fam) => {
    setActionFamilie(fam.name);
    try {
      const fall = fallFuerFamilie(fam.name);
      if (fall) {
        await base44.entities.DatenqualitaetFall.update(fall.id, { status: 'Offen' });
        setFaelle(prev => prev.map(f => f.id === fall.id ? { ...f, status: 'Offen' } : f));
      }
    } catch (e) {
      console.error('Wieder öffnen:', e);
      setError('Wieder öffnen fehlgeschlagen.');
    }
    setActionFamilie(null);
  };

  const waehleElternteil = (fam, rolle, m) => {
    setElternwahl(prev => ({ ...prev, [fam.name]: { ...(prev[fam.name] || {}), [rolle]: m } }));
    setSucheFeld(prev => { const c = { ...prev }; delete c[`${fam.name}_${rolle}`]; return c; });
  };

  const entferneElternteil = (fam, rolle) => {
    setElternwahl(prev => {
      const c = { ...prev, [fam.name]: { ...(prev[fam.name] || {}) } };
      delete c[fam.name][rolle];
      return c;
    });
  };

  const toggleKind = (fam, kindId) => {
    setKindAbgewaehlt(prev => {
      const famState = { ...(prev[fam.name] || {}) };
      if (famState[kindId]) delete famState[kindId];
      else famState[kindId] = true;
      return { ...prev, [fam.name]: famState };
    });
  };

  const elternPicker = (fam, rolle) => {
    const key = `${fam.name}_${rolle}`;
    const wahl = (elternwahl[fam.name] || {})[rolle];
    const q = (sucheFeld[key] || '').trim().toLowerCase();
    const kindIds = new Set(fam.kinder.map(k => k.id));
    const vorschlaege = q && !wahl
      ? erwachsenePool
          .filter(m => !kindIds.has(m.id))
          .filter(m => `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase().includes(q))
          .slice(0, 6)
      : [];

    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {rolle === 'vater' ? 'Vater' : 'Mutter'}
        </label>
        {wahl ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 min-h-[48px]">
            <span className="text-sm font-semibold text-foreground">
              {wahl.vorname} {wahl.nachname}
            </span>
            <button
              onClick={() => entferneElternteil(fam, rolle)}
              className="p-1.5 rounded-lg bg-secondary active:scale-95"
              aria-label="Auswahl entfernen"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={sucheFeld[key] || ''}
                onChange={e => setSucheFeld(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={`${rolle === 'vater' ? 'Vater' : 'Mutter'} in Mitglieder suchen…`}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary min-h-[48px]"
              />
            </div>
            {vorschlaege.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg bg-secondary border border-border shadow-xl overflow-hidden">
                {vorschlaege.map(m => (
                  <button
                    key={m.id}
                    onClick={() => waehleElternteil(fam, rolle, m)}
                    className="w-full flex items-center gap-2 px-3 py-3 text-left text-sm text-foreground hover:bg-accent active:bg-accent"
                  >
                    <UserPlus size={14} className="text-primary shrink-0" />
                    <span className="flex-1">{m.vorname} {m.nachname}</span>
                    <span className="text-xs text-muted-foreground">{alterVon(m.geburtsdatum) !== '?' ? `${alterVon(m.geburtsdatum)} J.` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="text-primary animate-spin" />
      </div>
    );
  }

  const q = suche.trim().toLowerCase();
  const sichtbareFamilien = familien.filter(f =>
    (!q || f.name.toLowerCase().includes(q)) &&
    (zeigeZurueckgestellt || !istZurueckgestellt(f.name))
  );
  const zurueckgestelltCount = familien.filter(f => istZurueckgestellt(f.name)).length;
  const kinderOffen = familien.reduce((s, f) => s + f.kinder.length, 0);

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-1">
        <Baby size={18} className="text-primary" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-foreground">
          Familienzuordnung
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Live ermittelt: Mitglieder unter 18 ohne Elternteil. Verknüpfen entfernt den Fall automatisch.
      </p>

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Zusammenfassung */}
      <div className="mb-4 p-4 rounded-xl bg-secondary border border-border">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} className={kinderOffen === 0 ? 'text-green-400' : 'text-primary'} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {kinderOffen === 0
                ? 'Alle minderjährigen Mitglieder haben ein Elternteil.'
                : `${kinderOffen} ${kinderOffen === 1 ? 'Kind' : 'Kinder'} in ${familien.length} ${familien.length === 1 ? 'Familie' : 'Familien'} noch ohne Elternteil`}
            </p>
            <p className="text-xs text-muted-foreground">
              Gleicher Nachname heißt nicht automatisch Geschwister! Nicht zusammengehörige Kinder antippen (ausgrauen) und separat verknüpfen – sie bleiben dann als eigener Fall offen.
            </p>
          </div>
        </div>
      </div>

      {/* Suche + Filter */}
      {familien.length > 0 && (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="Familie suchen…"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary min-h-[48px]"
            />
          </div>

          {zurueckgestelltCount > 0 && (
            <button
              onClick={() => setZeigeZurueckgestellt(v => !v)}
              className={`mb-4 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all min-h-[40px] ${
                zeigeZurueckgestellt ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
              }`}
            >
              Zurückgestellt ({zurueckgestelltCount}) {zeigeZurueckgestellt ? 'ausblenden' : 'anzeigen'}
            </button>
          )}
        </>
      )}

      {sichtbareFamilien.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          {familien.length === 0
            ? 'Nichts zu tun — alle Familien sind verknüpft.'
            : (suche ? 'Keine Familie gefunden.' : 'Keine offenen Fälle mehr.')}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sichtbareFamilien.map(fam => {
              const abgewaehlt = kindAbgewaehlt[fam.name] || {};
              const wahl = elternwahl[fam.name] || {};
              const elternGewaehlt = !!(wahl.vater || wahl.mutter);
              const kinderAktiv = fam.kinder.filter(k => !abgewaehlt[k.id]);
              const busy = actionFamilie === fam.name;
              const fall = fallFuerFamilie(fam.name);
              const zurueckgestellt = istZurueckgestellt(fam.name);
              return (
                <motion.div
                  key={fam.name}
                  layout
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="bg-card border border-border rounded-xl p-4 overflow-hidden"
                >
                  {/* Kopf */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-primary" />
                      <h3 className="text-sm font-bold font-oswald uppercase tracking-wide text-foreground">
                        {fam.name}
                      </h3>
                    </div>
                    {zurueckgestellt && (
                      <span className="text-[11px] font-medium bg-blue-900/20 text-blue-400 border border-blue-700/30 rounded-full px-2 py-0.5">
                        Zurückgestellt
                      </span>
                    )}
                  </div>

                  {/* Kinder (antippen zum Ab-/Auswählen) */}
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      Kinder ({fam.kinder.length === 1 ? '1 Kind' : `${fam.kinder.length} Kinder`}) — antippen zum Ausschließen
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fam.kinder.map(k => {
                        const aktiv = !abgewaehlt[k.id];
                        return (
                          <button
                            key={k.id}
                            onClick={() => toggleKind(fam, k.id)}
                            className={`px-3 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                              aktiv
                                ? 'bg-primary/15 text-foreground border border-primary/40'
                                : 'bg-secondary text-muted-foreground border border-border line-through'
                            }`}
                          >
                            {k.vorname} ({alterVon(k.geburtsdatum)})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hinweis aus dem Fall-Store */}
                  {fall?.beschreibung && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line mb-3 pl-3 border-l-2 border-primary/30">
                      {fall.beschreibung}
                    </p>
                  )}

                  {/* Geschwister-Toggle */}
                  {fam.kinder.length > 1 && (
                    <div className="mb-3 flex items-center justify-between bg-secondary rounded-lg border border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        {fam.kinder.length} Kinder als <span className="font-semibold text-foreground">Geschwister</span> verknüpfen
                      </span>
                      <button
                        onClick={() => setGeschwisterAus(prev => ({ ...prev, [fam.name]: prev[fam.name] === true ? false : true }))}
                        className={`relative w-12 h-7 rounded-full transition-all shrink-0 ${geschwisterAus[fam.name] === true ? 'bg-border' : 'bg-primary'}`}
                        aria-label="Geschwister-Verknüpfung umschalten"
                      >
                        <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${geschwisterAus[fam.name] === true ? 'left-1' : 'right-1'}`} />
                      </button>
                    </div>
                  )}

                  {/* Eltern-Auswahl */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {elternPicker(fam, 'vater')}
                    {elternPicker(fam, 'mutter')}
                  </div>

                  {/* Aktionen */}
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => verknuepfen(fam)}
                      disabled={busy || !elternGewaehlt || kinderAktiv.length === 0}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-[0.98] min-h-[48px] ${
                        elternGewaehlt && !busy && kinderAktiv.length > 0
                          ? 'bg-primary text-white'
                          : 'bg-secondary text-muted-foreground border border-border'
                      }`}
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                      {busy ? 'Verknüpfe…' : `Verknüpfen${kinderAktiv.length > 1 ? ` (${kinderAktiv.length} Kinder)` : ''}`}
                    </button>
                    {zurueckgestellt ? (
                      <button
                        onClick={() => wiederOeffnen(fam)}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground border border-border active:scale-95 min-h-[40px]"
                      >
                        <RotateCcw size={14} /> Wieder öffnen
                      </button>
                    ) : (
                      <button
                        onClick={() => zurueckstellen(fam)}
                        disabled={busy}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground border border-border active:scale-95 min-h-[40px]"
                      >
                        <PauseCircle size={14} /> Zurückstellen (Eltern nicht in der DB)
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
