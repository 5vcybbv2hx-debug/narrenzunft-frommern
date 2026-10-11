import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Check, Clock, Search } from 'lucide-react';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

export default function ZustimmungsUebersicht() {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState('');
  const [filter, setFilter] = useState('offen');
  const [suche, setSuche] = useState('');

  const laden = async () => {
    try { const r = await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'zustimmung_uebersicht' }); setDaten(r.data); setFehler(''); }
    catch (e) { console.error(e); setFehler('Übersicht konnte nicht geladen werden.'); }
  };
  useEffect(() => { laden(); }, []);

  const zeilen = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return (daten?.zeilen || [])
      .filter(z => (filter === 'offen' ? !z.zugestimmt : filter === 'ok' ? z.zugestimmt : true))
      .filter(z => !q || z.name.toLowerCase().includes(q));
  }, [daten, filter, suche]);

  async function manuell(z) {
    if (!(await confirmDialog(`Zustimmung für ${z.name} manuell eintragen (z.B. schriftlich am Probenabend)?`))) return;
    try { await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'zustimmung_manuell', mitglied_id: z.mitglied_id, notiz: 'Schriftlich/mündlich erklärt, durch Vorstand erfasst' }); toast.success('Eingetragen.'); laden(); }
    catch (e) { console.error(e); toast.error('Eintragen fehlgeschlagen.'); }
  }

  if (fehler) return <p role="alert" className="text-destructive text-sm">{fehler}</p>;
  if (!daten) return <p className="text-sm text-muted-foreground">Lädt…</p>;
  if (!daten.dokument) return <p className="text-sm text-muted-foreground">Lade zuerst die Satzung oder ein Datenschutz-Dokument hoch. Danach erscheint hier die Übersicht.</p>;

  const pct = daten.gesamt ? Math.round((daten.zugestimmt / daten.gesamt) * 100) : 0;
  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <p className="text-xs text-muted-foreground">Zustimmung zu „{daten.dokument.titel}“ · Version {daten.version}</p>
        <p className="font-oswald text-2xl text-foreground mt-1">{daten.zugestimmt} <span className="text-muted-foreground text-base">von {daten.gesamt} ({pct} %)</span></p>
        <div className="h-2 rounded-full bg-border mt-2 overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {[['offen', 'Offen'], ['ok', 'Zugestimmt'], ['alle', 'Alle']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm border ${filter === k ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border'}`}>{l}</button>
        ))}
        <div className="relative flex-1 min-w-[140px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Suchen…" className="w-full rounded-lg border border-border bg-background pl-8 pr-2 py-1.5 text-sm text-foreground" />
        </div>
      </div>
      <ul className="space-y-1.5">
        {zeilen.map(z => (
          <li key={z.mitglied_id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="text-foreground truncate">{z.name}</p>
              <p className="text-xs text-muted-foreground">{z.status}{z.zugestimmt && z.zugestimmt_am ? ` · ${new Date(z.zugestimmt_am).toLocaleDateString('de-DE')}${z.art === 'Manuell durch Vorstand' ? ' (manuell)' : ''}${z.via_eltern ? ' (durch Elternteil)' : ''}` : ''}</p>
            </div>
            {z.zugestimmt
              ? <Check size={18} className="text-green-600 shrink-0" />
              : <button onClick={() => manuell(z)} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:border-primary/40"><Clock size={12} /> Manuell eintragen</button>}
          </li>
        ))}
        {zeilen.length === 0 && <p className="text-sm text-muted-foreground">Keine Einträge.</p>}
      </ul>
    </div>
  );
}
