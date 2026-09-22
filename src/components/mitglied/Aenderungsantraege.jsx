import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

const FIELDS = [
  ['strasse', 'Straße'], ['plz', 'PLZ'], ['ort', 'Ort'],
  ['telefon', 'Telefon'], ['email', 'E-Mail'],
  ['notfallkontakt_name', 'Notfallkontakt'], ['notfallkontakt_telefon', 'Notfall-Telefon'],
];
const LABELS = Object.fromEntries(FIELDS);

/** Own/child contact edits are always reviewed before changing member records. */
export function SelbstpflegeAntrag({ mitglied }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setForm(Object.fromEntries(FIELDS.map(([key]) => [key, mitglied?.[key] || ''])));
  }, [mitglied?.id]);
  if (!mitglied?.id) return null;
  const changed = FIELDS.filter(([key]) => (form[key] || '') !== (mitglied[key] || ''));
  async function submit(e) {
    e.preventDefault();
    if (!changed.length) return;
    setBusy(true);
    try {
      await base44.functions.invoke('aenderungsantragVerwalten', {
        aktion: 'anlegen', ziel_mitglied_id: mitglied.id,
        felder: changed.map(([feld]) => ({ feld, neu: (form[feld] || '').trim() })),
      });
      toast.success('Änderung zur Prüfung eingereicht. Bis zur Freigabe bleiben die Profildaten unverändert.');
      setOpen(false);
    } catch (err) {
      console.error('Änderungsantrag:', err);
      toast.error('Änderung konnte nicht eingereicht werden.');
    } finally { setBusy(false); }
  }
  return <section className="rounded-lg border border-border bg-card p-4 my-4">
    <button type="button" onClick={() => setOpen(!open)} className="text-sm font-semibold text-foreground">Kontaktdaten ändern {open ? '−' : '+'}</button>
    {open && <form onSubmit={submit} className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {FIELDS.map(([field, label]) => <label key={field} className="text-xs text-muted-foreground">{label}
        <input type={field === 'email' ? 'email' : 'text'} value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" />
      </label>)}
      <p className="sm:col-span-2 text-xs text-muted-foreground">Der Vorstand prüft deine Änderungen, bevor sie übernommen werden.</p>
      <button type="submit" disabled={busy || !changed.length} className="sm:col-span-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Wird eingereicht…' : `${changed.length} Änderung${changed.length === 1 ? '' : 'en'} einreichen`}
      </button>
    </form>}
  </section>;
}

export function AenderungsantraegeVerwaltung() {
  const [antraege, setAntraege] = useState([]);
  const [namen, setNamen] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  async function reload() {
    try {
      const res = await base44.functions.invoke('aenderungsantragVerwalten', { aktion: 'liste', nur_offen: true });
      setAntraege(res.data?.antraege || []);
      setNamen(res.data?.namen || {});
      setError('');
    } catch (e) { console.error('Änderungsanträge laden:', e); setError('Änderungsanträge konnten nicht geladen werden.'); }
  }
  useEffect(() => { reload(); }, []);
  async function decide(a, aktion) {
    const text = aktion === 'genehmigen' ? 'Änderungen nach Prüfung ins Mitgliedsprofil übernehmen?' : 'Änderungsantrag ablehnen?';
    if (!(await confirmDialog(text))) return;
    setBusy(a.id);
    try {
      await base44.functions.invoke('aenderungsantragVerwalten', { aktion, antrag_id: a.id });
      toast.success(aktion === 'genehmigen' ? 'Änderungen übernommen.' : 'Antrag abgelehnt.');
      await reload();
    } catch (e) { console.error('Änderungsantrag entscheiden:', e); toast.error('Aktion fehlgeschlagen.'); }
    finally { setBusy(null); }
  }
  return <section className="rounded-lg border border-border bg-card p-4 mb-5" aria-label="Offene Profiländerungen">
    <div className="flex justify-between items-center"><h2 className="font-oswald text-lg text-foreground">Profiländerungen zur Freigabe</h2><button onClick={reload} className="text-xs text-primary">Aktualisieren</button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!error && !antraege.length && <p className="text-sm text-muted-foreground mt-2">Keine offenen Änderungen.</p>}
    <div className="space-y-3 mt-3">{antraege.map(a => <article key={a.id} className="border-t border-border pt-3">
      <p className="text-sm font-medium text-foreground">{namen[a.ziel_mitglied_id] || 'Mitglied'}</p>
      {(a.felder || []).map((f, i) => <p key={i} className="text-xs text-muted-foreground break-words">{LABELS[f.feld] || f.feld}: {f.alt || '–'} → {f.neu || '–'}</p>)}
      <div className="flex gap-3 mt-2 text-sm"><button disabled={busy === a.id} onClick={() => decide(a, 'genehmigen')} className="text-primary disabled:opacity-50">Genehmigen</button>
        <button disabled={busy === a.id} onClick={() => decide(a, 'ablehnen')} className="text-muted-foreground disabled:opacity-50">Ablehnen</button></div>
    </article>)}</div>
  </section>;
}
