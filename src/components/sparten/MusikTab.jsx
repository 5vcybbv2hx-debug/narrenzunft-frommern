import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { Music, Upload, Loader2, X, Pencil, Check, ArrowUp, ArrowDown, Trash2, Repeat, Play, Square, Plus, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import { parseMarker, fmtZeit, parseZeit, sortMarker } from '@/lib/tanzMarker';

/**
 * MusikTab – Musikstücke der Tanzgruppe mit eingebettetem Player,
 * umbenennbar, löschbar, Reihenfolge einstellbar.
 *
 * Musik-Zeitmarker: Pro Stück lassen sich Zeitmarker setzen (Sekunden ab
 * Stückbeginn), die optional mit einer Figur aus dem Figuren-Tab verknüpft
 * sind. Beim Klick auf einen Marker spielt die App NUR diesen Abschnitt
 * (bis zum nächsten Marker bzw. Stückende) — zum gezielten Üben einzelner
 * Szenen/Figuren. Mit Loop wiederholt der Abschnitt endlos. Marker werden
 * als JSON-String am TanzMusik-Datensatz gespeichert.
 *
 * Lesen/Anhören darf jeder mit Gruppenzugriff; Schreiben dürfen Vorstand/
 * Stellv./Admin und alle Verantwortlichen der Gruppe — läuft über die
 * sichere Backend-Function 'verwalteTanzDaten' (typ 'musik').
 */
export default function MusikTab({ gruppeId, canEdit, uebungswunsch, onWunschVerbraucht }) {
  const [liste, setListe] = useState([]);
  const [figuren, setFiguren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ladet, setLadet] = useState(false);
  const [titelDraft, setTitelDraft] = useState('');
  const [editId, setEditId] = useState(null);
  const [editTitel, setEditTitel] = useState('');
  // Marker-Entwürfe je Stück: { [musikId]: { marker: [...], dirty: bool } }
  const [markerDrafts, setMarkerDrafts] = useState({});
  // Aktive Übung: { musikId, start, ende (null = bis Stückende), loop }
  const [uebung, setUebung] = useState(null);
  const audios = useRef({});

  const laden = async () => {
    try {
      const [m, f] = await Promise.all([
        base44.entities.TanzMusik.filter({ haesgruppe_id: gruppeId }),
        base44.entities.TanzFigur.filter({ haesgruppe_id: gruppeId }),
      ]);
      const sortiert = [...(m || [])].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0));
      setListe(sortiert);
      setFiguren([...(f || [])].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0)));
      const drafts = {};
      for (const st of sortiert) drafts[st.id] = { marker: parseMarker(st.marker), dirty: false };
      setMarkerDrafts(drafts);
    } catch (e) {
      console.error(e);
      toast.error('Musik konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (gruppeId) laden(); }, [gruppeId]);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('verwalteTanzDaten', { haesgruppe_id: gruppeId, ...payload });
    return res?.data || res;
  };

  const figurName = (figurId) => figuren.find(f => f.id === figurId)?.name || '';

  // ── Marker-Draft-Helfer ──
  const markerVon = (m) => markerDrafts[m.id]?.marker || [];

  const markerAendern = (musikId, naechste) => {
    setMarkerDrafts(v => ({ ...v, [musikId]: { marker: naechste, dirty: true } }));
  };

  const markerHinzufuegen = (m) => {
    const a = audios.current[m.id];
    const zeit = a && a.currentTime > 0 ? Math.round(a.currentTime * 10) / 10 : 0;
    markerAendern(m.id, sortMarker([...markerVon(m), { zeit, figur_id: '', label: '' }]));
    toast.success(`Marker bei ${fmtZeit(zeit)} gesetzt${canEdit ? ' — noch speichern!' : ''}.`);
  };

  const markerEntfernen = (m, idx) => {
    markerAendern(m.id, markerVon(m).filter((_, i) => i !== idx));
  };

  const markerPatch = (m, idx, patch) => {
    markerAendern(m.id, markerVon(m).map((mk, i) => (i === idx ? { ...mk, ...patch } : mk)));
  };

  const markerSpeichern = async (m) => {
    try {
      const data = await invoke({ typ: 'musik', aktion: 'update', musik_id: m.id, marker: JSON.stringify(markerVon(m)) });
      if (data?.error) throw new Error(data.error);
      await laden();
      toast.success('Zeitmarker gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    }
  };

  // ── Übungsmodus: nur einen Abschnitt (Marker → nächster Marker/Ende) spielen ──
  const starteAbschnitt = (m, markerObj, loop = false) => {
    const start = Number(markerObj?.zeit) || 0;
    const alle = sortMarker(parseMarker(m.marker).length ? parseMarker(m.marker) : markerVon(m));
    const next = alle.find(x => (x.zeit ?? 0) > start + 0.05);
    setUebung({ musikId: m.id, start, ende: next ? next.zeit : null, loop });
    const a = audios.current[m.id];
    if (a) {
      a.currentTime = start;
      a.play().catch(() => {});
    }
  };

  const stoppeUebung = (mId) => {
    const a = mId ? audios.current[mId] : null;
    if (a) a.pause();
    setUebung(null);
  };

  // Fortschritts-Steuerung: Abschnittsende respektieren
  const onTimeUpdate = (e, m) => {
    if (!uebung || uebung.musikId !== m.id) return;
    if (uebung.ende != null && e.target.currentTime >= uebung.ende) {
      if (uebung.loop) {
        e.target.currentTime = uebung.start;
      } else {
        e.target.pause();
        e.target.currentTime = uebung.start;
        setUebung(null);
      }
    }
  };

  // Sprungwunsch aus Figuren-/Ablauf-Tab: Stück laden, zur Zeit springen, abspielen
  useEffect(() => {
    if (!uebungswunsch || liste.length === 0) return;
    const st = liste.find(x => x.id === uebungswunsch.musik_id);
    if (!st) { onWunschVerbraucht?.(); return; }
    const start = Number(uebungswunsch.zeit) || 0;
    const alle = sortMarker(parseMarker(st.marker));
    const next = alle.find(x => (x.zeit ?? 0) > start + 0.05);
    setUebung({ musikId: st.id, start, ende: next ? next.zeit : null, loop: true });
    const a = audios.current[st.id];
    if (a) {
      a.currentTime = start;
      a.play().catch(() => {});
    }
    onWunschVerbraucht?.();
  }, [uebungswunsch, liste]);

  const hochladen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Datei ist zu groß (max. 25 MB).');
      e.target.value = '';
      return;
    }
    setLadet(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const titel = (titelDraft.trim() || file.name.replace(/\.[^.]+$/, '')).trim();
      const data = await invoke({ typ: 'musik', aktion: 'create', titel, datei_url: file_url, sortierung: liste.length });
      if (data?.error) throw new Error(data.error);
      setTitelDraft('');
      await laden();
      toast.success(`„${titel}" hochgeladen.`);
    } catch (err) {
      toast.error('Upload fehlgeschlagen: ' + (err.message || ''));
    } finally {
      setLadet(false);
      e.target.value = '';
    }
  };

  const umbenennen = async (m) => {
    const titel = editTitel.trim();
    setEditId(null);
    if (!titel || titel === m.titel) return;
    try {
      const data = await invoke({ typ: 'musik', aktion: 'update', musik_id: m.id, titel });
      if (data?.error) throw new Error(data.error);
      await laden();
    } catch (e) {
      toast.error(e.message || 'Umbenennen fehlgeschlagen.');
    }
  };

  const entfernen = async (m) => {
    if (!(await confirmDialog(`„${m.titel}" samt Zeitmarkern löschen?`))) return;
    try {
      const data = await invoke({ typ: 'musik', aktion: 'delete', musik_id: m.id });
      if (data?.error) throw new Error(data.error);
      if (uebung?.musikId === m.id) setUebung(null);
      await laden();
      toast.success('Gelöscht.');
    } catch (e) {
      toast.error(e.message || 'Löschen fehlgeschlagen.');
    }
  };

  const verschieben = async (m, richtung) => {
    const idx = liste.findIndex(x => x.id === m.id);
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= liste.length) return;
    const andere = liste[ziel];
    try {
      await invoke({ typ: 'musik', aktion: 'update', musik_id: m.id, sortierung: andere.sortierung ?? 0 });
      await invoke({ typ: 'musik', aktion: 'update', musik_id: andere.id, sortierung: m.sortierung ?? 0 });
      await laden();
    } catch {
      toast.error('Verschieben fehlgeschlagen.');
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Lade Musik…</div>;
  }

  const figurSelectCls = 'px-2 py-1 rounded-lg bg-secondary border border-border text-xs text-white focus:outline-none focus:border-primary max-w-[140px]';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Musik &amp; Zeitmarker</h2>
        <span className="text-sm text-muted-foreground">{liste.length} {liste.length === 1 ? 'Stück' : 'Stücke'}</span>
      </div>

      {canEdit && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground">Neues Musikstück hochladen (MP3/Audio, max. 25 MB):</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={titelDraft}
              onChange={e => setTitelDraft(e.target.value)}
              placeholder="Titel (leer lassen = Dateiname)…"
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary"
            />
            <label className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium cursor-pointer hover:bg-primary/90 ${ladet ? 'opacity-60 pointer-events-none' : ''}`}>
              {ladet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {ladet ? 'Lädt hoch…' : 'Hochladen'}
              <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" className="hidden" onChange={hochladen} disabled={ladet} />
            </label>
          </div>
        </div>
      )}

      {liste.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Noch keine Musik hinterlegt.
          {canEdit && <span className="block mt-1">Lade oben das erste Musikstück hoch — danach kannst du Zeitmarker für die Figuren setzen.</span>}
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map((m, i) => {
            const draft = markerDrafts[m.id] || { marker: parseMarker(m.marker), dirty: false };
            const sortierteMarker = sortMarker(draft.marker);
            const istUebung = uebung?.musikId === m.id;
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {editId === m.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editTitel}
                          onChange={e => setEditTitel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') umbenennen(m); if (e.key === 'Escape') setEditId(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => umbenennen(m)} className="p-1 rounded text-primary hover:bg-primary/10" title="Speichern"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 rounded text-muted-foreground hover:text-white" title="Abbrechen"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-white truncate block">{m.titel}</span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button disabled={i === 0} onClick={() => verschieben(m, -1)} className="p-1 rounded text-muted-foreground hover:text-white disabled:opacity-30" title="Nach vorne"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button disabled={i === liste.length - 1} onClick={() => verschieben(m, 1)} className="p-1 rounded text-muted-foreground hover:text-white disabled:opacity-30" title="Nach hinten"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setEditId(m.id); setEditTitel(m.titel || ''); }} className="p-1 rounded text-muted-foreground hover:text-primary" title="Umbenennen"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => entfernen(m)} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Löschen"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>

                <audio
                  ref={el => { audios.current[m.id] = el; }}
                  controls preload="none" src={m.datei_url}
                  onTimeUpdate={e => onTimeUpdate(e, m)}
                  className="w-full mt-2.5"
                />

                {/* Übungs-Banner */}
                {istUebung && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5">
                    <Play className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-white">
                      Übt Abschnitt {fmtZeit(uebung.start)}–{uebung.ende != null ? fmtZeit(uebung.ende) : 'Ende'}
                    </span>
                    <button
                      onClick={() => setUebung(u => ({ ...u, loop: !u.loop }))}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${uebung.loop ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border'}`}
                      title="Abschnitt wiederholen"
                    >
                      <Repeat className="w-3 h-3" /> Loop {uebung.loop ? 'an' : 'aus'}
                    </button>
                    <button onClick={() => stoppeUebung(m.id)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground hover:text-white">
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  </div>
                )}

                {/* Zeitmarker */}
                <div className="mt-2.5 pt-2.5 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" /> Zeitmarker</span>
                    {canEdit && (
                      <div className="flex items-center gap-1.5">
                        {draft.dirty && <span className="text-[11px] text-yellow-400">Ungespeichert</span>}
                        <button onClick={() => markerHinzufuegen(m)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary border border-border text-[11px] text-white hover:border-primary">
                          <Plus className="w-3 h-3" /> Marker bei Play-Position
                        </button>
                        <button onClick={() => markerSpeichern(m)} disabled={!draft.dirty}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50">
                          <Check className="w-3 h-3" /> Speichern
                        </button>
                      </div>
                    )}
                  </div>

                  {sortierteMarker.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Noch keine Zeitmarker — setze sie während des Abspielens (z. B. Einsätze der Figuren).</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {sortierteMarker.map((mk, idx) => (
                        <div key={idx} className="flex items-center gap-2 min-h-8">
                          {canEdit ? (
                            <>
                              <input
                                defaultValue={fmtZeit(mk.zeit)}
                                onBlur={e => {
                                  const t = parseZeit(e.target.value);
                                  if (Number.isNaN(t) || t < 0) { e.target.value = fmtZeit(mk.zeit); toast.error('Ungültige Zeit (z. B. 1:30)'); return; }
                                  markerPatch(m, idx, { zeit: Math.round(t * 10) / 10 });
                                }}
                                className="w-14 px-1.5 py-1 rounded-lg bg-secondary border border-border text-xs text-white focus:outline-none focus:border-primary text-center"
                                title="Zeit mm:ss"
                              />
                              <select value={mk.figur_id || ''} onChange={e => markerPatch(m, idx, { figur_id: e.target.value })} className={figurSelectCls}>
                                <option value="">— ohne Figur —</option>
                                {figuren.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                              </select>
                              <input
                                defaultValue={mk.label}
                                onBlur={e => markerPatch(m, idx, { label: e.target.value })}
                                placeholder="Beschreibung (z. B. Einsatz)"
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-secondary border border-border text-xs text-white focus:outline-none focus:border-primary"
                              />
                              <button onClick={() => markerEntfernen(m, idx)} className="p-1 rounded text-muted-foreground hover:text-red-400" title="Marker entfernen"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => starteAbschnitt(m, mk)}
                                className="px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-mono hover:bg-primary/25"
                                title="Diesen Abschnitt einmal abspielen (bis zum nächsten Marker)">
                                {fmtZeit(mk.zeit)}
                              </button>
                              <span className="text-xs text-white truncate flex-1 min-w-0">
                                {mk.figur_id ? figurName(mk.figur_id) || 'Figur' : ''}{mk.figur_id && mk.label ? ' · ' : ''}{mk.label}
                              </span>
                              <button onClick={() => starteAbschnitt(m, mk, true)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary border border-border text-[11px] text-white hover:border-primary"
                                title="Abschnitt in Dauerschleife üben">
                                <Repeat className="w-3 h-3" /> Üben
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      {canEdit && sortierteMarker.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">Zeit als m:ss eintragen (z. B. 1:30). Marker gelten ab dem Zeitpunkt bis zum nächsten Marker — speichern nicht vergessen.</p>
                      )}
                      {!canEdit && sortierteMarker.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">Zeit antippen = Abschnitt einmal abspielen · „Üben" = Abschnitt in Dauerschleife.</p>
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
}
