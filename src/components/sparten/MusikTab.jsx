import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Music, Upload, Loader2, X, Pencil, Check, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

/**
 * MusikTab – Musikstücke der Tanzgruppe als Audio-Datei (Upload, in der
 * App abspielbar), umbenenn- und löschbar, Reihenfolge einstellbar.
 *
 * Lesen/Anhören darf jeder mit Gruppenzugriff; Schreiben dürfen Vorstand/
 * Stellv./Admin und alle Verantwortlichen der Gruppe — läuft über die
 * sichere Backend-Function 'verwalteTanzDaten' (typ 'musik').
 */
export default function MusikTab({ gruppeId, canEdit }) {
  const [liste, setListe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ladet, setLadet] = useState(false);
  const [titelDraft, setTitelDraft] = useState('');
  const [editId, setEditId] = useState(null);
  const [editTitel, setEditTitel] = useState('');

  const laden = async () => {
    try {
      const m = await base44.entities.TanzMusik.filter({ haesgruppe_id: gruppeId });
      setListe([...(m || [])].sort((a, b) => (a.sortierung ?? 0) - (b.sortierung ?? 0)));
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
    if (!(await confirmDialog(`„${m.titel}" löschen?`))) return;
    try {
      const data = await invoke({ typ: 'musik', aktion: 'delete', musik_id: m.id });
      if (data?.error) throw new Error(data.error);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-white">Musik</h2>
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
          {canEdit && <span className="block mt-1">Lade oben das erste Musikstück hoch — es ist direkt in der App abspielbar.</span>}
        </div>
      ) : (
        <div className="space-y-2">
          {liste.map((m, i) => (
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
              <audio controls preload="none" src={m.datei_url} className="w-full mt-2.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
