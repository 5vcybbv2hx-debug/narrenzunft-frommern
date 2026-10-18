import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Info, Pencil, Save, X, Euro, ShoppingBag, Plus, Trash2, ExternalLink } from 'lucide-react';

/**
 * ElternInfoTab – Informationsseite für Eltern (und Interessierte) mit
 * Kostenübersicht. Gilt für ALLE Gruppen.
 *
 * Lesbar für alle mit Gruppenzugriff; bearbeiten dürfen nur Verantwortliche
 * der Gruppe und Vorstand (via verwalteTanzDaten, typ 'info').
 * Inhalt: freier Text (Zeilenumbrüche bleiben erhalten).
 */
const parseEmpfehlungen = (raw) => {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

export default function ElternInfoTab({ gruppe, canEdit }) {
  const [edit, setEdit] = useState(false);
  const [eltern, setEltern] = useState(gruppe?.eltern_info || '');
  const [kosten, setKosten] = useState(gruppe?.kosten_info || '');
  const [empfehlungen, setEmpfehlungen] = useState(() => parseEmpfehlungen(gruppe?.empfehlungen));
  const [busy, setBusy] = useState(false);

  const speichern = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'info', aktion: 'update', haesgruppe_id: gruppe.id,
        eltern_info: eltern, kosten_info: kosten,
        empfehlungen: JSON.stringify(empfehlungen.filter(e => e.titel?.trim())),
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      setEdit(false);
      toast.success('Eltern-Info gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const empfehlungAendern = (i, feld, wert) => {
    setEmpfehlungen(v => v.map((e, j) => (i === j ? { ...e, [feld]: wert } : e)));
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
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Empfohlene Ausstattung</label>
              <button onClick={() => setEmpfehlungen(v => [...v, { titel: '', url: '', preis: '', notiz: '' }])}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-medium hover:bg-primary/25">
                <Plus className="w-3 h-3" /> Artikel
              </button>
            </div>
            <div className="space-y-2">
              {empfehlungen.map((e, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-1.5">
                  <input value={e.titel || ''} onChange={ev => empfehlungAendern(i, 'titel', ev.target.value)} placeholder="Artikel (z. B. Fleecejacke)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
                  <input value={e.preis || ''} onChange={ev => empfehlungAendern(i, 'preis', ev.target.value)} placeholder="Preis"
                    className="sm:w-20 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
                  <input value={e.url || ''} onChange={ev => empfehlungAendern(i, 'url', ev.target.value)} placeholder="Link (Zunftshop oder extern)"
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
                  <button onClick={() => setEmpfehlungen(v => v.filter((_, j) => j !== i))}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {empfehlungen.length === 0 && <p className="text-xs text-muted-foreground italic">Noch keine Artikel hinterlegt.</p>}
            </div>
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
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Empfohlene Ausstattung</h3>
            {empfehlungen.length === 0
              ? <p className="text-sm text-muted-foreground italic">Noch keine Empfehlungen hinterlegt.</p>
              : <ul className="space-y-1.5">
                  {empfehlungen.map((e, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-foreground flex-1 min-w-0 truncate">{e.titel}</span>
                      {e.preis && <span className="text-primary font-semibold shrink-0">{e.preis} €</span>}
                      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-primary shrink-0"><ExternalLink className="w-3 h-3" /> Link</a>}
                    </li>
                  ))}
                </ul>}
          </div>
        </div>
      )}
    </div>
  );
}
