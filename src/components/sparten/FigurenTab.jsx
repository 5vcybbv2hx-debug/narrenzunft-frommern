import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, X, Check, Upload, Loader2, FileText, ExternalLink, Trash2, Play as PlayIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { fmtZeit, einsatzpunkteFuerFigur } from '@/lib/tanzMarker';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

/**
 * FigurenTab – Figuren der Tanzgruppe mit zugehörigen Figuren-PDFs und
 * digitalem Aufstellungs-Editor. Tänzer:innen (aktive GruppenTeilnehmer)
 * werden per Drag & Drop frei auf einer Bühnenfläche platziert; die
 * Positionen werden als Prozent-Koordinaten gespeichert und ändern sich
 * dadurch nicht bei unterschiedlichen Bildschirmgrößen.
 *
 * Lesen darf jeder mit Gruppenzugriff; Schreiben (Figur anlegen, PDF
 * hochladen, Aufstellung ändern, Löschen) dürfen Vorstand/Stellv./Admin
 * und alle Verantwortlichen der Gruppe — läuft über die sichere
 * Backend-Function 'verwalteTanzDaten' (typ 'figur').
 */
const parseAufstellung = (raw) => {
  try { return JSON.parse(raw || '[]') || []; } catch { return []; }
};

export default function FigurenTab({ gruppeId, alleMitglieder, canEdit, onUebeMusik }) {
  const [figuren, setFiguren] = useState([]);
  const [gewaehlt, setGewaehlt] = useState(null); // geöffnete Figur
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [neueFigur, setNeueFigur] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [pdfLadet, setPdfLadet] = useState(false);
  const [marker, setMarker] = useState([]); // [{mitglied_id, x, y}]
  const [dirty, setDirty] = useState(false);
  const canvasRef = useRef(null);
  const dragIdx = useRef(null);

  const nameVon = (mitgliedId) => {
    const m = (alleMitglieder || []).find(x => x.id === mitgliedId);
    if (!m) return 'Unbekannt';
    return `${m.vorname || ''} ${m.nachname || ''}`.trim();
  };

  const [musikListe, setMusikListe] = useState([]);

  const laden = async () => {
    try {
      const [f, mus] = await Promise.all([
        base44.entities.TanzFigur.filter({ haesgruppe_id: gruppeId }),
        base44.entities.TanzMusik.filter({ haesgruppe_id: gruppeId }),
      ]);
      const sortiert = [...(f || [])].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
      setFiguren(sortiert);
      setMusikListe(mus || []);
    } catch (e) {
      console.error(e);
      toast.error('Figuren konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (gruppeId) laden(); }, [gruppeId]);

  // Beim Öffnen einer Figur: Marker aus der gespeicherten Aufstellung laden
  useEffect(() => {
    if (gewaehlt) {
      setMarker(parseAufstellung(gewaehlt.aufstellung));
      setNameDraft(gewaehlt.name || '');
      setDirty(false);
    }
  }, [gewaehlt?.id]);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('verwalteTanzDaten', { haesgruppe_id: gruppeId, ...payload });
    return res?.data || res;
  };

  const figurAnlegen = async () => {
    const name = neueFigur.trim();
    if (!name) return;
    setBusy(true);
    try {
      const data = await invoke({ typ: 'figur', aktion: 'create', name, reihenfolge: figuren.length });
      if (data?.error) throw new Error(data.error);
      setNeueFigur('');
      await laden();
      toast.success(`Figur „${name}" angelegt.`);
    } catch (e) {
      toast.error(e.message || 'Anlegen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const figurLoeschen = async (f) => {
    if (!(await confirmDialog(`Figur „${f.name}" inkl. Aufstellung löschen?`))) return;
    try {
      const data = await invoke({ typ: 'figur', aktion: 'delete', figur_id: f.id });
      if (data?.error) throw new Error(data.error);
      setGewaehlt(null);
      await laden();
      toast.success('Figur gelöscht.');
    } catch (e) {
      toast.error(e.message || 'Löschen fehlgeschlagen.');
    }
  };

  const verschieben = async (f, richtung) => {
    const idx = figuren.findIndex(x => x.id === f.id);
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= figuren.length) return;
    const andere = figuren[ziel];
    try {
      await invoke({ typ: 'figur', aktion: 'update', figur_id: f.id, reihenfolge: andere.reihenfolge ?? 0 });
      await invoke({ typ: 'figur', aktion: 'update', figur_id: andere.id, reihenfolge: f.reihenfolge ?? 0 });
      await laden();
    } catch {
      toast.error('Verschieben fehlgeschlagen.');
    }
  };

  const nameSpeichern = async () => {
    if (!gewaehlt) return;
    const name = nameDraft.trim();
    if (!name || name === gewaehlt.name) return;
    try {
      const data = await invoke({ typ: 'figur', aktion: 'update', figur_id: gewaehlt.id, name });
      if (data?.error) throw new Error(data.error);
      setGewaehlt(v => ({ ...v, name }));
      await laden();
      toast.success('Name gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    }
  };

  // ── PDF ──
  const pdfHochladen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !gewaehlt) return;
    setPdfLadet(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const data = await invoke({ typ: 'figur', aktion: 'update', figur_id: gewaehlt.id, pdf_url: file_url });
      if (data?.error) throw new Error(data.error);
      setGewaehlt(v => ({ ...v, pdf_url: file_url }));
      toast.success('PDF hochgeladen.');
    } catch (err) {
      toast.error('Upload fehlgeschlagen: ' + (err.message || ''));
    } finally {
      setPdfLadet(false);
      e.target.value = '';
    }
  };

  const pdfEntfernen = async () => {
    if (!gewaehlt?.pdf_url) return;
    if (!(await confirmDialog('PDF von dieser Figur entfernen?'))) return;
    try {
      const data = await invoke({ typ: 'figur', aktion: 'update', figur_id: gewaehlt.id, pdf_url: '' });
      if (data?.error) throw new Error(data.error);
      setGewaehlt(v => ({ ...v, pdf_url: '' }));
      toast.success('PDF entfernt.');
    } catch (e) {
      toast.error(e.message || 'Entfernen fehlgeschlagen.');
    }
  };

  // ── Aufstellungs-Editor ──
  const inAufstellung = useMemo(() => new Set(marker.map(m => m.mitglied_id)), [marker]);

  const tanzlisteLaden = async () => {
    try {
      const t = await base44.entities.GruppenTeilnehmer.filter({ haesgruppe_id: gruppeId });
      return (t || []).filter(x => x.aktiv !== false);
    } catch { return []; }
  };
  const [tanzliste, setTanzliste] = useState([]);

  useEffect(() => {
    if (!gewaehlt) return;
    tanzlisteLaden().then(setTanzliste);
  }, [gewaehlt?.id]);

  const hinzufuegenZurAufstellung = (t) => {
    if (inAufstellung.has(t.mitglied_id)) return;
    const n = marker.length;
    setMarker(v => [...v, {
      mitglied_id: t.mitglied_id,
      x: 20 + (n % 5) * 15,
      y: 75 - Math.floor(n / 5) * 20,
    }]);
    setDirty(true);
  };

  const entfernenAusAufstellung = (mitgliedId) => {
    setMarker(v => v.filter(m => m.mitglied_id !== mitgliedId));
    setDirty(true);
  };

  const posAusEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(98, Math.max(2, Math.round(x * 10) / 10)),
      y: Math.min(98, Math.max(2, Math.round(y * 10) / 10)),
    };
  };

  const startDrag = (e, idx) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    dragIdx.current = idx;
    setMarker(v => v.map((m, i) => (i === idx ? { ...m, ...posAusEvent(e) } : m)));
    setDirty(true);
  };

  const aufDrag = (e) => {
    if (dragIdx.current === null) return;
    const p = posAusEvent(e);
    const idx = dragIdx.current;
    setMarker(v => v.map((m, i) => (i === idx ? { ...m, ...p } : m)));
  };

  const endeDrag = () => { dragIdx.current = null; };

  const aufstellungSpeichern = async () => {
    if (!gewaehlt) return;
    setBusy(true);
    try {
      const data = await invoke({ typ: 'figur', aktion: 'update', figur_id: gewaehlt.id, aufstellung: JSON.stringify(marker) });
      if (data?.error) throw new Error(data.error);
      setGewaehlt(v => ({ ...v, aufstellung: JSON.stringify(marker) }));
      setDirty(false);
      toast.success('Aufstellung gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  // ══════════════ ANSICHT: FIGUR-LISTE ══════════════
  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">Lade Figuren…</div>;
  }

  if (!gewaehlt) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-white">Figuren &amp; Aufstellung</h2>
          <span className="text-sm text-muted-foreground">{figuren.length} {figuren.length === 1 ? 'Figur' : 'Figuren'}</span>
        </div>

        {canEdit && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-2">
            <input
              value={neueFigur}
              onChange={e => setNeueFigur(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && figurAnlegen()}
              placeholder="Name der neuen Figur (z. B. Stern, Brücke)…"
              className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary"
            />
            <button onClick={figurAnlegen} disabled={busy || !neueFigur.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Anlegen
            </button>
          </div>
        )}

        {figuren.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            Noch keine Figuren angelegt.
            {canEdit && <span className="block mt-1">Lege oben die erste Figur an — danach kannst du ein Figuren-PDF hochladen und die Aufstellung per Drag &amp; Drop festlegen.</span>}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {figuren.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <button onClick={() => setGewaehlt(f)} className="min-w-0 flex-1 text-left">
                  <span className="text-sm font-medium text-white block truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {parseAufstellung(f.aufstellung).length} Tänzer:innen{f.pdf_url ? ' · PDF vorhanden' : ''}
                  </span>
                </button>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button disabled={i === 0} onClick={() => verschieben(f, -1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white disabled:opacity-30" title="Nach vorne"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button disabled={i === figuren.length - 1} onClick={() => verschieben(f, 1)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white disabled:opacity-30" title="Nach hinten"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => figurLoeschen(f)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ══════════════ ANSICHT: FIGUR-EDITOR ══════════════
  const nichtPlatziert = tanzliste.filter(t => !inAufstellung.has(t.mitglied_id));

  return (
    <div className="space-y-4">
      <button onClick={() => setGewaehlt(null)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Alle Figuren
      </button>

      {/* Name */}
      <div className="flex items-center gap-2">
        {canEdit ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && nameSpeichern()}
              className="flex-1 text-xl font-semibold bg-transparent border-b border-border focus:border-primary outline-none text-white"
            />
            <button onClick={nameSpeichern} className="p-1.5 rounded-lg text-primary hover:bg-primary/10" title="Name speichern"><Check className="w-4 h-4" /></button>
          </div>
        ) : (
          <h2 className="text-xl font-semibold text-white">{gewaehlt.name}</h2>
        )}
      </div>

      {/* PDF */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-white flex items-center gap-1.5"><FileText className="w-4 h-4 text-primary" /> Figuren-PDF</span>
          <div className="flex items-center gap-2">
            {gewaehlt.pdf_url && (
              <a href={gewaehlt.pdf_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3.5 h-3.5" /> Öffnen</a>
            )}
            {canEdit && (
              <>
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium cursor-pointer hover:bg-primary/90 ${pdfLadet ? 'opacity-60' : ''}`}>
                  {pdfLadet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {pdfLadet ? 'Lädt…' : gewaehlt.pdf_url ? 'Ersetzen' : 'Hochladen'}
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={pdfHochladen} disabled={pdfLadet} />
                </label>
                {gewaehlt.pdf_url && (
                  <button onClick={pdfEntfernen} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="PDF entfernen"><X className="w-4 h-4" /></button>
                )}
              </>
            )}
          </div>
        </div>
        {gewaehlt.pdf_url ? (
          <iframe src={gewaehlt.pdf_url} title={`Figuren-PDF ${gewaehlt.name}`}
            className="w-full h-80 md:h-96 rounded-lg border border-border bg-white" />
        ) : (
          <p className="text-xs text-muted-foreground italic">Noch kein PDF hinterlegt.</p>
        )}
      </div>

      {/* Aufstellung */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-white">Aufstellung</span>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-yellow-400">Ungespeicherte Änderungen</span>}
            {canEdit && (
              <button onClick={aufstellungSpeichern} disabled={busy || !dirty}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Speichern
              </button>
            )}
          </div>
        </div>

        {/* Bühne */}
        <div
          ref={canvasRef}
          onPointerMove={aufDrag}
          onPointerUp={endeDrag}
          onPointerCancel={endeDrag}
          onPointerLeave={endeDrag}
          data-no-swipe
          style={canEdit ? { touchAction: 'none' } : undefined}
          className="relative w-full aspect-[16/10] rounded-lg border border-dashed border-border bg-secondary/40 overflow-hidden select-none"
        >
          <span className="absolute top-1.5 left-3 text-[10px] uppercase tracking-wide text-muted-foreground">Vorne</span>
          <span className="absolute bottom-1.5 left-3 text-[10px] uppercase tracking-wide text-muted-foreground">Hinten</span>
          {marker.length === 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground italic">
              {canEdit ? 'Tänzer:innen aus der Liste unten hinzufügen und per Drag & Drop platzieren' : 'Noch niemand platziert'}
            </span>
          )}
          {marker.map((m, i) => (
            <div key={m.mitglied_id}
              onPointerDown={e => startDrag(e, i)}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              <span className="px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium whitespace-nowrap shadow-md border border-white/20">
                {nameVon(m.mitglied_id)}
              </span>
              {canEdit && (
                <button
                  onPointerDown={e => { e.stopPropagation(); entfernenAusAufstellung(m.mitglied_id); }}
                  className="w-4 h-4 rounded-full bg-secondary border border-border text-muted-foreground hover:text-red-400 flex items-center justify-center shrink-0"
                  title="Von Aufstellung entfernen"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Nicht platzierte aktive Tänzer:innen */}
        {canEdit && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Aktive Tänzer:innen — antippen zum Platzieren:</p>
            <div className="flex flex-wrap gap-1.5">
              {nichtPlatziert.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">Alle aktiven Tänzer:innen sind platziert.</span>
              ) : nichtPlatziert.map(t => (
                <button key={t.mitglied_id} onClick={() => hinzufuegenZurAufstellung(t)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-white hover:border-primary">
                  <Plus className="w-3 h-3 text-primary" /> {nameVon(t.mitglied_id)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Musik-Einsatzpunkte dieser Figur (aus den Zeitmarkern im Musik-Tab) */}
      {(() => {
        const punkte = einsatzpunkteFuerFigur(musikListe, gewaehlt.id);
        return (
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <span className="text-sm font-medium text-white">Musik-Einsatzpunkte</span>
            {punkte.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Diese Figur ist noch mit keinem Musik-Zeitmarker verknüpft. Zeitmarker werden im Musik-Tab gesetzt{canEdit ? '' : ' (durch Vorstand oder Spartenleiter)'}.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {punkte.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-mono">{fmtZeit(p.marker.zeit)}</span>
                    <span className="text-sm text-white truncate flex-1 min-w-0">{p.musik.titel}{p.marker.label ? <span className="text-muted-foreground text-xs"> · {p.marker.label}</span> : null}</span>
                    <button onClick={() => onUebeMusik?.(p.musik.id, p.marker.zeit)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 shrink-0">
                      <PlayIcon /> Üben
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">„Üben" wechselt in den Musik-Tab und spielt den Abschnitt ab diesem Marker in Dauerschleife.</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
