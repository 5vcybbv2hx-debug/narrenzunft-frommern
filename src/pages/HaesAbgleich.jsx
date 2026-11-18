import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import DateSelect from '@/components/ui/DateSelect';
import { Shirt, Search, ChevronLeft, ChevronRight, ChevronDown, UserX, AlertTriangle, Plus, Undo2, Check } from 'lucide-react';

/**
 * Häs-Abgleich für die Vorstandschaft.
 *
 * Ziel: in einem Durchgang durch alle Mitglieder klicken und Abweichungen
 * sofort korrigieren. Deshalb keine Dropdowns — jede Auswahl ist eine Karte,
 * ein Tipp genügt und der Wert ist gespeichert.
 *
 * Links das Mitglied, rechts das Häs. Zuweisungen laufen über
 * weiseHaesZuSicher, damit die HaesHistorie stimmt.
 */

const STATUS_KARTEN = [
  { wert: 'Aktiv', farbe: 'bg-primary' },
  { wert: 'Passiv', farbe: 'bg-secondary' },
  { wert: 'Jungaktive 15-17', kurz: 'Jungaktive', farbe: 'bg-secondary' },
  { wert: 'Jugendliche 11-14', kurz: 'Jugendliche', farbe: 'bg-secondary' },
  { wert: 'Kinder 4-10', kurz: 'Kinder', farbe: 'bg-secondary' },
  { wert: 'Kleinkind 0-3', kurz: 'Kleinkind', farbe: 'bg-secondary' },
];

const HAES_STATUS = ['Aktiv', 'Verliehen', 'Passiv', 'Stillgelegt'];

/** Eine antippbare Auswahlkarte. */
function Karte({ aktiv, onClick, children, gesperrt }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={gesperrt}
      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left ${
        aktiv
          ? 'bg-primary text-white border border-primary'
          : 'bg-secondary text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground'
      } ${gesperrt ? 'opacity-50' : ''}`}
    >
      {children}
    </button>
  );
}

/** Karte mit aufklappbarem Kopf. */
function Klappkarte({ titel, children, offenStart = true, rechts }) {
  const [offen, setOffen] = useState(offenStart);
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        <span className="text-sm font-bold font-oswald uppercase tracking-wider text-foreground">{titel}</span>
        <span className="flex items-center gap-2">
          {rechts}
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${offen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {offen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function HaesAbgleich() {
  const [mitglieder, setMitglieder] = useState([]);
  const [haes, setHaes] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState('alle');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(null);
  const [freiesHaes, setFreiesHaes] = useState(null);
  const [zeigeFreie, setZeigeFreie] = useState(false);

  useEffect(() => { laden(); }, []);

  const laden = async () => {
    setLoading(true);
    try {
      const [m, h, g] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 1000),
        base44.entities.Haes.list('haesnummer', 1000),
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
  const aktuelleHaes = useMemo(() => (aktuell ? haesProMitglied.get(aktuell.id) || [] : []), [aktuell, haesProMitglied]);
  const [haesAuswahl, setHaesAuswahl] = useState(0);
  const haesAktiv = aktuelleHaes[Math.min(haesAuswahl, Math.max(0, aktuelleHaes.length - 1))] || null;

  useEffect(() => { setHaesAuswahl(0); setZeigeFreie(false); setFreiesHaes(null); }, [aktuell?.id]);

  const springe = (delta) => setIndex(i => Math.min(Math.max(0, i + delta), Math.max(0, gefiltert.length - 1)));

  /** Ein Tipp speichert sofort — das ist der Sinn der Karten. */
  const setzeMitglied = async (feld, wert) => {
    if (!aktuell) return;
    const alt = aktuell[feld];
    if (alt === wert) return;
    setBusy(`m:${feld}`);
    setMitglieder(prev => prev.map(m => m.id === aktuell.id ? { ...m, [feld]: wert } : m));
    try {
      await base44.entities.Mitglied.update(aktuell.id, { [feld]: wert });
    } catch (e) {
      console.error(e);
      setMitglieder(prev => prev.map(m => m.id === aktuell.id ? { ...m, [feld]: alt } : m));
      toast.error('Speichern fehlgeschlagen');
    }
    setBusy(null);
  };

  const setzeHaes = async (feld, wert) => {
    if (!haesAktiv) return;
    const alt = haesAktiv[feld];
    if (alt === wert) return;
    setBusy(`h:${feld}`);
    setHaes(prev => prev.map(h => h.id === haesAktiv.id ? { ...h, [feld]: wert } : h));
    try {
      await base44.entities.Haes.update(haesAktiv.id, { [feld]: wert });
    } catch (e) {
      console.error(e);
      setHaes(prev => prev.map(h => h.id === haesAktiv.id ? { ...h, [feld]: alt } : h));
      toast.error('Speichern fehlgeschlagen');
    }
    setBusy(null);
  };

  const zuweisen = async (haesId) => {
    if (!aktuell || !haesId) return;
    setBusy('zuweisung');
    try {
      const res = await base44.functions.invoke('weiseHaesZuSicher', {
        haes_id: haesId,
        mitglied_id: aktuell.id,
        aktion: 'verliehen',
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success('Häs zugewiesen');
      await laden();
      setFreiesHaes(null);
      setZeigeFreie(false);
    } catch (e) {
      toast.error(e?.message || 'Zuweisung fehlgeschlagen');
    }
    setBusy(null);
  };

  const zurueckgeben = async () => {
    if (!haesAktiv) return;
    setBusy('zuweisung');
    try {
      const res = await base44.functions.invoke('weiseHaesZuSicher', {
        haes_id: haesAktiv.id,
        mitglied_id: null,
        aktion: 'zurueckgegeben',
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success('Häs zurückgenommen');
      await laden();
    } catch (e) {
      toast.error(e?.message || 'Rückgabe fehlgeschlagen');
    }
    setBusy(null);
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
    <div className="px-4 lg:px-6 py-5 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-oswald uppercase tracking-wider text-foreground flex items-center gap-2">
          <Shirt size={24} className="text-primary" /> Häs-Abgleich
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Antippen speichert sofort.</p>
      </div>

      {/* Suche + Filter */}
      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={suche}
          onChange={e => { setSuche(e.target.value); setIndex(0); }}
          placeholder="Mitglied suchen…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'alle', label: 'Alle' },
          { key: 'ohne', label: 'Ohne Häs' },
          { key: 'mehrere', label: 'Mehrere' },
          { key: 'ohneGruppe', label: 'Ohne Gruppe' },
        ].map(f => (
          <Karte key={f.key} aktiv={filter === f.key} onClick={() => { setFilter(f.key); setIndex(0); }}>
            {f.label}
          </Karte>
        ))}
      </div>

      {!aktuell ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Kein Mitglied für diese Auswahl.</p>
        </div>
      ) : (
        <>
          {/* Blättern */}
          <div className="flex items-center justify-between mb-3 bg-card border border-border rounded-xl px-2 py-1.5">
            <button onClick={() => springe(-1)} disabled={index === 0}
              className="p-2 rounded-lg hover:bg-secondary text-foreground disabled:opacity-30">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <div className="text-sm font-semibold text-foreground">{aktuell.vorname} {aktuell.nachname}</div>
              <div className="text-[11px] text-muted-foreground">{index + 1} von {gefiltert.length}</div>
            </div>
            <button onClick={() => springe(1)} disabled={index >= gefiltert.length - 1}
              className="p-2 rounded-lg hover:bg-secondary text-foreground disabled:opacity-30">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* ── Mitglied ── */}
            <div className="space-y-3">
              <Klappkarte
                titel="Mitglied"
                offenStart={false}
                rechts={!aktuelleHaes.length && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-semibold flex items-center gap-1">
                    <UserX size={10} /> kein Häs
                  </span>
                )}
              >
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Vorname</label>
                      <input
                        defaultValue={aktuell.vorname || ''}
                        key={`vn-${aktuell.id}`}
                        onBlur={e => setzeMitglied('vorname', e.target.value.trim())}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Nachname</label>
                      <input
                        defaultValue={aktuell.nachname || ''}
                        key={`nn-${aktuell.id}`}
                        onBlur={e => setzeMitglied('nachname', e.target.value.trim())}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Geburtsdatum</label>
                    <DateSelect
                      name="geburtsdatum"
                      value={aktuell.geburtsdatum || ''}
                      onChange={e => setzeMitglied('geburtsdatum', e.target.value)}
                    />
                  </div>
                </div>
              </Klappkarte>

              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_KARTEN.map(s => (
                    <Karte
                      key={s.wert}
                      aktiv={aktuell.mitgliedsstatus === s.wert}
                      gesperrt={busy === 'm:mitgliedsstatus'}
                      onClick={() => setzeMitglied('mitgliedsstatus', s.wert)}
                    >
                      {s.kurz || s.wert}
                    </Karte>
                  ))}
                </div>

                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mt-4 mb-2">Gruppe</p>
                <div className="flex flex-wrap gap-1.5">
                  {gruppen.map(g => (
                    <Karte
                      key={g.id}
                      aktiv={aktuell.haesgruppe_id === g.id}
                      gesperrt={busy === 'm:haesgruppe_id'}
                      onClick={() => setzeMitglied('haesgruppe_id', aktuell.haesgruppe_id === g.id ? null : g.id)}
                    >
                      {g.name}
                    </Karte>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Häs ── */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Häs</p>
                {aktuelleHaes.length > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 font-semibold flex items-center gap-1">
                    <AlertTriangle size={10} /> {aktuelleHaes.length}
                  </span>
                )}
              </div>

              {aktuelleHaes.length > 1 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {aktuelleHaes.map((h, i) => (
                    <Karte key={h.id} aktiv={i === haesAuswahl} onClick={() => setHaesAuswahl(i)}>
                      {h.haesnummer || 'ohne Nr.'}
                    </Karte>
                  ))}
                </div>
              )}

              {haesAktiv ? (
                <>
                  <div className="flex items-end gap-2 mb-3">
                    <div className="flex-1">
                      <label className="text-[11px] text-muted-foreground block mb-1">Häsnummer</label>
                      <input
                        defaultValue={haesAktiv.haesnummer || ''}
                        key={`hn-${haesAktiv.id}`}
                        onBlur={e => setzeHaes('haesnummer', e.target.value.trim())}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      onClick={zurueckgeben}
                      disabled={busy === 'zuweisung'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <Undo2 size={14} /> Zurück
                    </button>
                  </div>

                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {haesAktiv.status && !HAES_STATUS.includes(haesAktiv.status) && (
                      <Karte aktiv onClick={() => {}}>{haesAktiv.status}</Karte>
                    )}
                    {HAES_STATUS.map(s => (
                      <Karte
                        key={s}
                        aktiv={haesAktiv.status === s}
                        gesperrt={busy === 'h:status'}
                        onClick={() => setzeHaes('status', s)}
                      >
                        {s}
                      </Karte>
                    ))}
                  </div>

                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Häsgruppe</p>
                  <div className="flex flex-wrap gap-1.5">
                    {gruppen.map(g => (
                      <Karte
                        key={g.id}
                        aktiv={haesAktiv.haesgruppe_id === g.id}
                        gesperrt={busy === 'h:haesgruppe_id'}
                        onClick={() => setzeHaes('haesgruppe_id', haesAktiv.haesgruppe_id === g.id ? null : g.id)}
                      >
                        {g.name}
                      </Karte>
                    ))}
                  </div>

                  {haesAktiv.haesgruppe_id && aktuell.haesgruppe_id !== haesAktiv.haesgruppe_id && (
                    <p className="text-[11px] text-yellow-400 mt-3 flex items-center gap-1">
                      <AlertTriangle size={11} />
                      Mitglied steht in {gruppeName(aktuell.haesgruppe_id)}, Häs gehört zu {gruppeName(haesAktiv.haesgruppe_id)}.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mb-3">
                    <UserX size={16} className="text-yellow-400" /> Kein Häs zugeordnet.
                  </p>
                  {!zeigeFreie ? (
                    <button
                      onClick={() => setZeigeFreie(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
                    >
                      <Plus size={15} /> Häs zuweisen
                    </button>
                  ) : (
                    <div>
                      <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto mb-2">
                        {freieHaes.map(h => (
                          <Karte key={h.id} aktiv={freiesHaes === h.id} onClick={() => setFreiesHaes(h.id)}>
                            <span className="block font-bold">{h.haesnummer || '—'}</span>
                            <span className="block text-[10px] opacity-70 truncate">{gruppeName(h.haesgruppe_id)}</span>
                          </Karte>
                        ))}
                      </div>
                      <button
                        onClick={() => zuweisen(freiesHaes)}
                        disabled={!freiesHaes || busy === 'zuweisung'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40"
                      >
                        <Check size={15} /> {busy === 'zuweisung' ? 'Weist zu…' : 'Zuweisen'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
