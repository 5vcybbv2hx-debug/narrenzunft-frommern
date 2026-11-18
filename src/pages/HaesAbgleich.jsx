import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import DateSelect from '@/components/ui/DateSelect';
import { Shirt, Search, ChevronLeft, ChevronRight, Save, UserX, AlertTriangle, Check, Plus, Undo2 } from 'lucide-react';

/**
 * Häs-Abgleich für die Vorstandschaft.
 *
 * Ein Bildschirm, zwei Hälften: links das Mitgliedsprofil, rechts der
 * zugehörige Häs-Datensatz. Beide Seiten sind direkt bearbeitbar, damit
 * Abweichungen in einem Durchgang korrigiert werden können, ohne zwischen
 * Profil und Häs hin- und herzuspringen.
 *
 * Zuweisungen laufen bewusst über weiseHaesZuSicher (HaesHistorie!), nicht
 * über ein direktes Update von aktueller_besitzer_id.
 */

const STATUS_OPTIONEN = ['Aktiv', 'Passiv', 'Kleinkind 0-3', 'Kinder 4-10', 'Jugendliche 11-14', 'Jungaktive 15-17'];
// Vorstandsbeschluss: nur diese vier Werte. 'Aktiv' ist der Normalfall und fehlte.
const HAES_STATUS = ['Aktiv', 'Verliehen', 'Passiv', 'Stillgelegt'];

export default function HaesAbgleich() {
  const [mitglieder, setMitglieder] = useState([]);
  const [haes, setHaes] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState('alle');
  const [index, setIndex] = useState(0);
  const [mitgliedForm, setMitgliedForm] = useState(null);
  const [haesForm, setHaesForm] = useState(null);
  const [speichert, setSpeichert] = useState(null);
  const [freiesHaes, setFreiesHaes] = useState(null);

  useEffect(() => { laden(); }, []);

  const laden = async () => {
    setLoading(true);
    try {
      const [m, h, g] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 1000),
        base44.entities.Haes.list('-created_date', 1000),
        base44.entities.Haesgruppe.list('name', 100),
      ]);
      setMitglieder((m || []).filter(x => !x.archiviert));
      setHaes(h || []);
      setGruppen(g || []);
    } catch (e) {
      console.error('Häs-Abgleich laden:', e);
      toast.error('Daten konnten nicht geladen werden');
    }
    setLoading(false);
  };

  const haesProMitglied = useMemo(() => {
    const map = new Map();
    for (const h of haes) {
      if (!h.aktueller_besitzer_id) continue;
      const liste = map.get(h.aktueller_besitzer_id) || [];
      liste.push(h);
      map.set(h.aktueller_besitzer_id, liste);
    }
    return map;
  }, [haes]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    let liste = mitglieder;
    if (q.length >= 2) {
      const woerter = q.split(/\s+/).filter(Boolean);
      liste = liste.filter(m => {
        const heu = `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase();
        return woerter.every(w => heu.includes(w));
      });
    }
    if (filter === 'ohne') liste = liste.filter(m => !haesProMitglied.has(m.id));
    if (filter === 'mehrere') liste = liste.filter(m => (haesProMitglied.get(m.id) || []).length > 1);
    if (filter === 'ohneGruppe') liste = liste.filter(m => !m.haesgruppe_id);
    return liste;
  }, [mitglieder, suche, filter, haesProMitglied]);

  const aktuell = gefiltert[index] || null;
  const aktuelleHaes = useMemo(() => {
    if (!aktuell) return [];
    return haesProMitglied.get(aktuell.id) || [];
  }, [aktuell, haesProMitglied]);

  // Formulare beim Wechsel des Mitglieds neu setzen
  useEffect(() => {
    if (!aktuell) { setMitgliedForm(null); setHaesForm(null); return; }
    setMitgliedForm({
      vorname: aktuell.vorname || '',
      nachname: aktuell.nachname || '',
      geburtsdatum: aktuell.geburtsdatum || '',
      mitgliedsstatus: aktuell.mitgliedsstatus || '',
      haesgruppe_id: aktuell.haesgruppe_id || '',
    });
    const h = aktuelleHaes[0];
    setHaesForm(h ? {
      id: h.id,
      haesnummer: h.haesnummer || '',
      bezeichnung: h.bezeichnung || '',
      status: h.status || '',
      haesgruppe_id: h.haesgruppe_id || '',
      notizen: h.notizen || '',
    } : null);
    setFreiesHaes(null);
  }, [aktuell?.id, aktuelleHaes.length]);

  const springe = (delta) => {
    setIndex(i => Math.min(Math.max(0, i + delta), Math.max(0, gefiltert.length - 1)));
  };

  const speichereMitglied = async () => {
    if (!aktuell || !mitgliedForm) return;
    setSpeichert('mitglied');
    try {
      const daten = {
        vorname: mitgliedForm.vorname.trim(),
        nachname: mitgliedForm.nachname.trim(),
        geburtsdatum: mitgliedForm.geburtsdatum || null,
        mitgliedsstatus: mitgliedForm.mitgliedsstatus,
        haesgruppe_id: mitgliedForm.haesgruppe_id || null,
      };
      await base44.entities.Mitglied.update(aktuell.id, daten);
      setMitglieder(prev => prev.map(m => m.id === aktuell.id ? { ...m, ...daten } : m));
      toast.success('Mitglied gespeichert');
    } catch (e) {
      console.error(e);
      toast.error('Speichern fehlgeschlagen');
    }
    setSpeichert(null);
  };

  const speichereHaes = async () => {
    if (!haesForm?.id) return;
    setSpeichert('haes');
    try {
      const daten = {
        haesnummer: haesForm.haesnummer.trim(),
        bezeichnung: haesForm.bezeichnung.trim(),
        status: haesForm.status,
        haesgruppe_id: haesForm.haesgruppe_id || null,
        notizen: haesForm.notizen || '',
      };
      await base44.entities.Haes.update(haesForm.id, daten);
      setHaes(prev => prev.map(h => h.id === haesForm.id ? { ...h, ...daten } : h));
      toast.success('Häs gespeichert');
    } catch (e) {
      console.error(e);
      toast.error('Speichern fehlgeschlagen');
    }
    setSpeichert(null);
  };

  const weiseZu = async (haesId, aktion) => {
    if (!aktuell) return;
    setSpeichert('zuweisung');
    try {
      const res = await base44.functions.invoke('weiseHaesZuSicher', {
        haes_id: haesId,
        mitglied_id: aktion === 'zurueckgegeben' ? null : aktuell.id,
        aktion,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(aktion === 'zurueckgegeben' ? 'Häs zurückgenommen' : 'Häs zugewiesen');
      await laden();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Zuweisung fehlgeschlagen');
    }
    setSpeichert(null);
  };

  const freieHaes = useMemo(() => haes.filter(h => !h.aktueller_besitzer_id), [haes]);
  const gruppeName = (id) => gruppen.find(g => g.id === id)?.name || '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-7xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold font-oswald uppercase tracking-wider text-foreground flex items-center gap-2">
          <Shirt size={24} className="text-primary" /> Häs-Abgleich
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mitglied links, Häs rechts, beides direkt bearbeitbar.
        </p>
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={suche}
            onChange={e => { setSuche(e.target.value); setIndex(0); }}
            placeholder="Mitglied suchen (min. 2 Zeichen)…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            { key: 'alle', label: 'Alle' },
            { key: 'ohne', label: 'Ohne Häs' },
            { key: 'mehrere', label: 'Mehrere Häse' },
            { key: 'ohneGruppe', label: 'Ohne Gruppe' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setIndex(0); }}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                filter === f.key
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {gefiltert.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Kein Mitglied für diese Auswahl.</p>
        </div>
      ) : (
        <>
          {/* Blättern */}
          <div className="flex items-center justify-between mb-3 bg-card border border-border rounded-lg px-3 py-2">
            <button onClick={() => springe(-1)} disabled={index === 0}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground disabled:opacity-30">
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{index + 1}</span> von {gefiltert.length}
            </div>
            <button onClick={() => springe(1)} disabled={index >= gefiltert.length - 1}
              className="p-1.5 rounded-lg hover:bg-secondary text-foreground disabled:opacity-30">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LINKS: Mitglied */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <h2 className="text-sm font-bold font-oswald uppercase tracking-wider text-foreground">Mitglied</h2>
                {!aktuelleHaes.length && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium flex items-center gap-1">
                    <UserX size={11} /> kein Häs
                  </span>
                )}
              </div>
              {mitgliedForm && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Vorname</label>
                      <input value={mitgliedForm.vorname}
                        onChange={e => setMitgliedForm(p => ({ ...p, vorname: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Nachname</label>
                      <input value={mitgliedForm.nachname}
                        onChange={e => setMitgliedForm(p => ({ ...p, nachname: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Geburtsdatum</label>
                    <DateSelect name="geburtsdatum" value={mitgliedForm.geburtsdatum}
                      onChange={e => setMitgliedForm(p => ({ ...p, geburtsdatum: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Mitgliedsstatus</label>
                    <select value={mitgliedForm.mitgliedsstatus}
                      onChange={e => setMitgliedForm(p => ({ ...p, mitgliedsstatus: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                      <option value="">—</option>
                      {STATUS_OPTIONEN.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Häsgruppe</label>
                    <select value={mitgliedForm.haesgruppe_id}
                      onChange={e => setMitgliedForm(p => ({ ...p, haesgruppe_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                      <option value="">— keine Gruppe —</option>
                      {gruppen.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <button onClick={speichereMitglied} disabled={speichert === 'mitglied'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                    <Save size={15} /> {speichert === 'mitglied' ? 'Speichert…' : 'Mitglied speichern'}
                  </button>
                </div>
              )}
            </div>

            {/* RECHTS: Häs */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <h2 className="text-sm font-bold font-oswald uppercase tracking-wider text-foreground">Häs</h2>
                {aktuelleHaes.length > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-medium flex items-center gap-1">
                    <AlertTriangle size={11} /> {aktuelleHaes.length} Datensätze
                  </span>
                )}
              </div>

              {aktuelleHaes.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {aktuelleHaes.map(h => (
                    <button key={h.id}
                      onClick={() => setHaesForm({ id: h.id, haesnummer: h.haesnummer || '', bezeichnung: h.bezeichnung || '', status: h.status || '', haesgruppe_id: h.haesgruppe_id || '', notizen: h.notizen || '' })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        haesForm?.id === h.id ? 'bg-primary text-white border-primary' : 'bg-secondary border-border text-muted-foreground'
                      }`}>
                      {h.haesnummer || 'ohne Nr.'}
                    </button>
                  ))}
                </div>
              )}

              {haesForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Häsnummer</label>
                      <input value={haesForm.haesnummer}
                        onChange={e => setHaesForm(p => ({ ...p, haesnummer: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Status</label>
                      <select value={haesForm.status}
                        onChange={e => setHaesForm(p => ({ ...p, status: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                        <option value="">—</option>
                        {haesForm.status && !HAES_STATUS.includes(haesForm.status) && (
                          <option value={haesForm.status}>{haesForm.status} (alter Wert)</option>
                        )}
                        {HAES_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Bezeichnung</label>
                    <input value={haesForm.bezeichnung}
                      onChange={e => setHaesForm(p => ({ ...p, bezeichnung: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Häsgruppe</label>
                    <select value={haesForm.haesgruppe_id}
                      onChange={e => setHaesForm(p => ({ ...p, haesgruppe_id: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                      <option value="">— keine Gruppe —</option>
                      {gruppen.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Notizen</label>
                    <textarea value={haesForm.notizen} rows={2}
                      onChange={e => setHaesForm(p => ({ ...p, notizen: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={speichereHaes} disabled={speichert === 'haes'}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                      <Save size={15} /> {speichert === 'haes' ? 'Speichert…' : 'Häs speichern'}
                    </button>
                    <button onClick={() => weiseZu(haesForm.id, 'zurueckgegeben')} disabled={speichert === 'zuweisung'}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/10 disabled:opacity-50">
                      <Undo2 size={15} /> Zurück
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <UserX size={16} className="text-yellow-400" /> Diesem Mitglied ist kein Häs zugeordnet.
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Freies Häs zuweisen</label>
                    <select value={freiesHaes || ''} onChange={e => setFreiesHaes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                      <option value="">— Häs wählen —</option>
                      {freieHaes.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.haesnummer || 'ohne Nr.'}{h.bezeichnung ? ` · ${h.bezeichnung}` : ''} ({gruppeName(h.haesgruppe_id)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => weiseZu(freiesHaes, 'verliehen')} disabled={!freiesHaes || speichert === 'zuweisung'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                    <Plus size={15} /> {speichert === 'zuweisung' ? 'Weist zu…' : 'Häs zuweisen'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
            <Check size={12} className="text-green-400" />
            Zuweisungen und Rückgaben werden in der Häs-Historie festgehalten.
          </p>
        </>
      )}
    </div>
  );
}
