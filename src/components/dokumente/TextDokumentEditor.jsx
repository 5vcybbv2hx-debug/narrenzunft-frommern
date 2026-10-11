import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Upload } from 'lucide-react';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

/**
 * Entwurfs-Editor für Text-Dokumente (z.B. Satzung).
 * Änderungen landen zuerst im Entwurf – für Mitglieder sichtbar wird erst
 * "Veröffentlichen" mit neuer Versionsnummer.
 */
export default function TextDokumentEditor({ doc, onGeschlossen, onVeroeffentlicht }) {
  const [absaetze, setAbsaetze] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    base44.functions.invoke('vereinsDokumentSicher', { aktion: 'text_laden', dokument_id: doc.id })
      .then(r => setAbsaetze(r.data?.entwurf || r.data?.absaetze || []))
      .catch(e => { console.error(e); toast.error('Entwurf konnte nicht geladen werden.'); setAbsaetze([]); });
  }, [doc.id]);

  if (!absaetze) return <p className="text-sm text-muted-foreground">Lädt…</p>;

  const aendere = (i, feld, wert) => setAbsaetze(list => list.map((a, j) => j === i ? { ...a, [feld]: wert } : a));
  const hinzu = () => setAbsaetze(list => [...list, { nummer: '', titel: '', text: '' }]);
  const weg = async (i) => {
    if (await confirmDialog(`Absatz „${absaetze[i].nummer || absaetze[i].titel || i + 1}“ entfernen?`)) {
      setAbsaetze(list => list.filter((_, j) => j !== i));
    }
  };

  async function entwurfSpeichern() {
    setBusy(true);
    try {
      await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'text_entwurf_speichern', dokument_id: doc.id, absaetze });
      toast.success('Entwurf gespeichert. Für Mitglieder noch nichts geändert.');
    } catch (e) { console.error(e); toast.error('Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  async function veroeffentlichen() {
    const relevant = ['Satzung', 'Datenschutz'].includes(doc.kategorie);
    const frage = relevant
      ? `Neue Version von „${doc.titel}“ veröffentlichen?\n\nHäkchen „erneute Zustimmung“ setzt du, wenn sich Datenschutz-relevante Paragrafen (z.B. § 14) geändert haben – dann müssen alle Mitglieder beim nächsten Login erneut zustimmen.`
      : `Neue Version von „${doc.titel}“ für alle veröffentlichen?`;
    if (!(await confirmDialog(frage))) return;
    setBusy(true);
    try {
      // Erst speichern, dann mit dem Häkchen veröffentlichen
      const extra = relevant ? { zustimmung_erforderlich: window.confirm('Erneute Datenschutz-Zustimmung aller Mitglieder einfordern?\n\nOK = ja, beim nächsten Login erscheint das Zustimmungs-Modal.\nAbbrechen = nein, nur inhaltliche Änderung.') } : {};
      await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'text_entwurf_speichern', dokument_id: doc.id, absaetze });
      await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'text_veroeffentlichen', dokument_id: doc.id, ...extra });
      toast.success('Veröffentlicht. Neue Version ist für alle sichtbar.');
      onVeroeffentlicht?.();
    } catch (e) { console.error(e); toast.error('Veröffentlichen fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-oswald text-lg text-foreground">Bearbeiten: {doc.titel}</h3>
        <button onClick={onGeschlossen} className="text-xs text-muted-foreground">Schließen</button>
      </div>
      <p className="text-xs text-muted-foreground">Änderungen sind erst im Entwurf. Veröffentlichen erstellt eine neue Version – die alte bleibt im Archiv.</p>
      {absaetze.map((a, i) => (
        <div key={i} className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex gap-2">
            <input value={a.nummer} onChange={e => aendere(i, 'nummer', e.target.value)} placeholder="§ 14"
              className="w-20 rounded-md border border-border bg-card p-2 text-sm text-foreground" />
            <input value={a.titel} onChange={e => aendere(i, 'titel', e.target.value)} placeholder="Überschrift"
              className="flex-1 rounded-md border border-border bg-card p-2 text-sm text-foreground" />
            <button onClick={() => weg(i)} className="text-destructive p-2" aria-label="Absatz entfernen"><Trash2 size={15} /></button>
          </div>
          <textarea value={a.text} onChange={e => aendere(i, 'text', e.target.value)} rows={Math.min(12, Math.max(3, (a.text.match(/\n/g) || []).length + 2))}
            className="w-full rounded-md border border-border bg-card p-2 text-sm text-foreground leading-relaxed" />
        </div>
      ))}
      <button onClick={hinzu} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary/40"><Plus size={14} /> Absatz hinzufügen</button>
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <button onClick={entwurfSpeichern} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-foreground disabled:opacity-50"><Save size={15} /> Entwurf speichern</button>
        <button onClick={veroeffentlichen} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"><Upload size={15} /> Neue Version veröffentlichen</button>
      </div>
    </div>
  );
}
