import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search } from 'lucide-react';

/** Liest ein Text-Dokument (z.B. Satzung) direkt in der App – kein PDF nötig. */
export default function TextDokumentLeser({ doc, verwaltung, onBearbeiten }) {
  const [absaetze, setAbsaetze] = useState(null);
  const [fehler, setFehler] = useState('');
  const [suche, setSuche] = useState('');

  useEffect(() => {
    let aktiv = true;
    base44.functions.invoke('vereinsDokumentSicher', { aktion: 'text_laden', dokument_id: doc.id })
      .then(r => { if (aktiv) { setAbsaetze(r.data?.absaetze || []); setFehler(''); } })
      .catch(e => { console.error(e); if (aktiv) setFehler('Inhalt konnte nicht geladen werden.'); });
    return () => { aktiv = false; };
  }, [doc.id, doc.version]);

  if (fehler) return <p role="alert" className="text-destructive text-sm px-1">{fehler}</p>;
  if (!absaetze) return <p className="text-sm text-muted-foreground px-1">Lädt…</p>;

  const q = suche.trim().toLowerCase();
  const gefiltert = q
    ? absaetze.map(a => ({ ...a, treffer: (a.nummer + ' ' + a.titel + ' ' + a.text).toLowerCase().includes(q) }))
    : absaetze.map(a => ({ ...a, treffer: false }));

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex gap-2 items-center mb-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="In der Satzung suchen…"
            className="w-full rounded-lg border border-border bg-card pl-8 pr-2 py-1.5 text-sm text-foreground" />
        </div>
        {verwaltung && <button onClick={onBearbeiten} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm text-white active:scale-95 transition-transform">Bearbeiten</button>}
      </div>
      {q && gefiltert.some(a => !a.treffer) && (
        <button onClick={() => setSuche('')} className="text-xs text-muted-foreground mb-3">Suche zurücksetzen ({gefiltert.filter(a => a.treffer).length} Treffer)</button>
      )}
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {gefiltert.map((a, i) => {
          if (q && !a.treffer) return null;
          return (
            <section key={i} className={`mb-4 ${q ? 'ring-1 ring-primary/40 rounded-lg p-2.5' : ''}`}>
              {a.nummer && <p className="font-oswald uppercase tracking-wide text-sm text-primary">{a.nummer}</p>}
              {a.titel && <p className="font-semibold text-foreground text-sm mb-1">{a.titel}</p>}
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{a.text}</div>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
        {doc.titel}{doc.stand_datum ? ` · Stand ${new Date(doc.stand_datum).toLocaleDateString('de-DE')}` : ''} · Version {doc.version || 1} · direkt in der App gepflegt
      </p>
    </div>
  );
}
