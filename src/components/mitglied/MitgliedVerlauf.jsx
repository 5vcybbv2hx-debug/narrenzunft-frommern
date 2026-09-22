import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/** Combines documented historical events only, without inventing earlier changes. */
export default function MitgliedVerlauf({ mitglied }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['mitglied-verlauf', mitglied.id],
    queryFn: async () => {
      const [ereignisse, haes, leitung, ehrungen] = await Promise.all([
        base44.entities.MitgliedEreignis.filter({ mitglied_id: mitglied.id }),
        base44.entities.HaesHistorie.filter({ mitglied_id: mitglied.id }),
        base44.entities.SpartenleiterHistorie.filter({ mitglied_id: mitglied.id }),
        base44.entities.Ehrung.filter({ mitglied_id: mitglied.id }),
      ]);
      const rows = (ereignisse || []).map(e => ({ id: `e-${e.id}`, date: e.datum, title: e.titel, description: e.beschreibung || '' }));
      if (mitglied.eintrittsdatum && !rows.some(e => e.date === mitglied.eintrittsdatum && /Eintritt/i.test(e.title))) rows.push({ id: 'eintritt', date: mitglied.eintrittsdatum, title: 'Eintritt in den Verein', description: '' });
      if (mitglied.austrittsdatum && !rows.some(e => e.date === mitglied.austrittsdatum && /Austritt/i.test(e.title))) rows.push({ id: 'austritt', date: mitglied.austrittsdatum, title: 'Austritt', description: '' });
      (haes || []).forEach(h => { if (h.von_datum) rows.push({ id: `haes-${h.id}-von`, date: h.von_datum, title: 'Häs übernommen', description: h.notizen || '' }); if (h.bis_datum) rows.push({ id: `haes-${h.id}-bis`, date: h.bis_datum, title: 'Häs zurückgegeben', description: '' }); });
      (leitung || []).forEach(l => { if (l.von_datum) rows.push({ id: `leitung-${l.id}-von`, date: l.von_datum, title: 'Spartenleitung übernommen', description: l.haesgruppe_name || '' }); if (l.bis_datum) rows.push({ id: `leitung-${l.id}-bis`, date: l.bis_datum, title: 'Spartenleitung beendet', description: l.haesgruppe_name || '' }); });
      (ehrungen || []).filter(e => e.status === 'Verliehen' && (e.datum || e.jahr)).forEach(e => rows.push({ id: `ehrung-${e.id}`, date: e.datum || `${e.jahr}-01-01`, title: 'Ehrung verliehen', description: `${e.typ || ''} ${e.wert ?? ''}`.trim() }));
      return rows.filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date));
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Verlauf wird geladen…</p>;
  if (isError) return <p role="alert" className="text-sm text-destructive">Verlauf konnte nicht geladen werden.</p>;
  return <div className="rounded-lg border border-border bg-card p-4">
    <h2 className="font-oswald text-lg text-foreground mb-1">Mitgliederverlauf</h2>
    <p className="text-xs text-muted-foreground mb-3">Nur belegte Ereignisse. Frühere Änderungen ohne Historie erscheinen nicht.</p>
    {(!data || data.length === 0) && <p className="text-sm text-muted-foreground">Noch keine dokumentierten Ereignisse.</p>}
    <ol className="space-y-3">{(data || []).map(e => <li key={e.id} className="border-l-2 border-primary pl-3 text-sm">
      <time className="text-xs text-muted-foreground">{e.date}</time><p className="text-foreground font-medium">{e.title}</p>{e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
    </li>)}</ol>
  </div>;
}
