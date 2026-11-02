import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Users, Check, Loader2, Info } from 'lucide-react';
import MitgliedLiveSuche from '@/components/MitgliedLiveSuche';
import { toast } from 'sonner';

/**
 * Zentrale Zuständige für Verleih & Inventar pflegen.
 * Wer hier steht, bekommt ALLE Verleih-Anfragen — zusätzlich zu den
 * Personen, die pro Gegenstand eingetragen sind.
 */
export default function VerleihZustaendigeModal({ mitglieder = [], onClose, onSaved }) {
  const [ids, setIds] = useState([]);
  const [personen, setPersonen] = useState([]);
  const [darfBearbeiten, setDarfBearbeiten] = useState(false);
  const [laden, setLaden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('verwalteVerleihZustaendigeSicher', { aktion: 'holen' });
        const d = res?.data || {};
        setIds(Array.isArray(d.zustaendige_ids) ? d.zustaendige_ids : []);
        setPersonen(Array.isArray(d.personen) ? d.personen : []);
        setDarfBearbeiten(Boolean(d.darf_bearbeiten));
      } catch (e) {
        toast.error('Zuständige konnten nicht geladen werden.');
      }
      setLaden(false);
    })();
  }, []);

  const nameVon = (id) => {
    const m = mitglieder.find((x) => x.id === id) || personen.find((x) => x.id === id);
    return m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : 'Unbekannt';
  };

  const hinzufuegen = (m) => {
    if (ids.includes(m.id)) return;
    setIds((prev) => [...prev, m.id]);
  };

  const entfernen = (id) => setIds((prev) => prev.filter((x) => x !== id));

  const speichern = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteVerleihZustaendigeSicher', {
        aktion: 'speichern',
        zustaendige_ids: ids,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(ids.length ? `${ids.length} zentrale Zuständige gespeichert.` : 'Zentrale Zuständige entfernt.');
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Speichern fehlgeschlagen.');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="font-oswald text-lg uppercase tracking-wide text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Verleih-Zuständige
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="px-4 pb-2">
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 shrink-0 text-primary" />
            Diese Personen bekommen <span className="text-foreground font-medium">alle</span> Verleih-Anfragen per App und E-Mail.
            Zuständige, die direkt am Gegenstand eingetragen sind, bleiben zusätzlich zuständig.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {laden ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
              <Loader2 size={14} className="animate-spin" /> Wird geladen…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {ids.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Noch niemand zentral eingetragen.</p>
                )}
                {ids.map((id) => (
                  <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                    {nameVon(id)}
                    {darfBearbeiten && (
                      <button onClick={() => entfernen(id)} title="Entfernen" className="hover:text-destructive ml-0.5">
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {darfBearbeiten ? (
                <div className="pt-1">
                  <MitgliedLiveSuche
                    mitglieder={mitglieder.filter((m) => !ids.includes(m.id))}
                    value=""
                    onSelect={hinzufuegen}
                    placeholder="Person suchen und hinzufügen…"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Nur Vorstand, Stellvertreter und Admin können die Liste ändern.</p>
              )}
            </>
          )}
        </div>

        {darfBearbeiten && !laden && (
          <div className="p-4 pt-2 border-t border-border">
            <button onClick={speichern} disabled={busy}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
