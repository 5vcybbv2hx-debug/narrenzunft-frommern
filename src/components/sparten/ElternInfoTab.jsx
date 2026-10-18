import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Info, Pencil, Save, X, Euro } from 'lucide-react';

/**
 * ElternInfoTab – Informationsseite für Eltern (und Interessierte) mit
 * Kostenübersicht. Gilt für ALLE Gruppen.
 *
 * Lesbar für alle mit Gruppenzugriff; bearbeiten dürfen nur Verantwortliche
 * der Gruppe und Vorstand (via verwalteTanzDaten, typ 'info').
 * Inhalt: freier Text (Zeilenumbrüche bleiben erhalten).
 */
export default function ElternInfoTab({ gruppe, canEdit }) {
  const [edit, setEdit] = useState(false);
  const [eltern, setEltern] = useState(gruppe?.eltern_info || '');
  const [kosten, setKosten] = useState(gruppe?.kosten_info || '');
  const [busy, setBusy] = useState(false);

  const speichern = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'info', aktion: 'update', haesgruppe_id: gruppe.id,
        eltern_info: eltern, kosten_info: kosten,
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      setEdit(false);
      toast.success('Eltern-Info gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-oswald uppercase tracking-wide text-foreground flex items-center gap-2">
          <Info className="w-5 h-5 text-primary" /> Eltern-Info
        </h2>
        {canEdit && !edit && (
          <button onClick={() => setEdit(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25">
            <Pencil className="w-3.5 h-3.5" /> Bearbeiten
          </button>
        )}
      </div>

      {edit ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Informationen für Eltern</label>
            <textarea value={eltern} onChange={e => setEltern(e.target.value)} rows={8}
              placeholder="Trainingszeiten, Ansprechpartner, Ausrüstung, wichtige Hinweise…"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2 flex items-center gap-1.5"><Euro className="w-3.5 h-3.5" /> Kosten</label>
            <textarea value={kosten} onChange={e => setKosten(e.target.value)} rows={4}
              placeholder="z. B. Jahresbeitrag, Kostüm-/Häskosten, Unfallversicherung…"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={speichern} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              <Save className="w-4 h-4" /> Speichern
            </button>
            <button onClick={() => { setEltern(gruppe?.eltern_info || ''); setKosten(gruppe?.kosten_info || ''); setEdit(false); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm">
              <X className="w-4 h-4" /> Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Informationen für Eltern</h3>
            {eltern
              ? <p className="text-sm text-foreground whitespace-pre-line">{eltern}</p>
              : <p className="text-sm text-muted-foreground italic">Noch keine Informationen hinterlegt.</p>}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><Euro className="w-3.5 h-3.5" /> Kosten</h3>
            {kosten
              ? <p className="text-sm text-foreground whitespace-pre-line">{kosten}</p>
              : <p className="text-sm text-muted-foreground italic">Noch keine Kosten hinterlegt.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
