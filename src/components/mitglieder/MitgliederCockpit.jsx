import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

const SECTIONS = [
  { key: 'offeneAntraege', title: 'Offene Anträge' },
  { key: 'geburtstage', title: 'Geburtstage (30 Tage)' },
  { key: 'statusPruefung', title: 'Status prüfen' },
  { key: 'anstehendeEhrungen', title: 'Ehrungen prüfen' },
];

export default function MitgliederCockpit({ onMemberSelect }) {
  const [open, setOpen] = useState(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mitglieder', 'handlungsbedarf'],
    queryFn: async () => (await base44.functions.invoke('getMitgliederDashboardSicher', {})).data,
    staleTime: 5 * 60 * 1000,
  });
  return <section aria-label="Handlungsbedarf Mitglieder" className="mb-5">
    <div className="flex items-center justify-between mb-2">
      <h2 className="font-oswald text-lg font-semibold text-foreground">Handlungsbedarf</h2>
      <button type="button" onClick={() => refetch()} className="text-xs text-muted-foreground hover:text-primary">Aktualisieren</button>
    </div>
    {isLoading && <p className="text-sm text-muted-foreground">Handlungsbedarf wird geladen…</p>}
    {isError && <p role="alert" className="text-sm text-destructive">Handlungsbedarf konnte nicht geladen werden.</p>}
    {data && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SECTIONS.map(({ key, title }) => <button key={key} type="button" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}
          className={`rounded-lg border p-3 text-left transition-colors ${open === key ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/40'}`}>
          <span className="block text-xs text-muted-foreground">{title}</span>
          <span className="block text-xl font-oswald text-foreground mt-1">{(data[key] || []).length}</span>
        </button>)}
      </div>
      {open && <div className="mt-2 rounded-lg border border-border bg-card p-3 max-h-64 overflow-y-auto">
        {(data[open] || []).length === 0 && <p className="text-sm text-muted-foreground">Keine Einträge.</p>}
        {(data[open] || []).map((entry, i) => {
          const id = entry.mitglied_id || entry.id;
          const isApplication = open === 'offeneAntraege';
          const caption = open === 'geburtstage' ? `${entry.datum || ''} · wird ${entry.wirdAlter} Jahre` :
            open === 'statusPruefung' ? entry.text :
            open === 'anstehendeEhrungen' ? `${entry.typ || 'Ehrung'} · Stufe ${entry.stufe ?? ''}` : entry.status;
          return <div key={`${id}-${i}`} className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0 text-sm">
            <div className="min-w-0"><span className="text-foreground">{entry.vorname} {entry.nachname}</span><span className="block text-xs text-muted-foreground">{caption}</span></div>
            {isApplication ? <Link to="/ausschuss?tab=antraege" className="shrink-0 text-primary">Antrag öffnen</Link> :
              <button type="button" onClick={() => onMemberSelect(id)} className="shrink-0 text-primary">Profil öffnen</button>}
          </div>;
        })}
      </div>}
    </>}
  </section>;
}
