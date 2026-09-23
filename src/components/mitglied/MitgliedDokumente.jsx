import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

const TYPEN = ['Antrag', 'Einverständnis', 'Bescheinigung', 'Austritt', 'Sonstiges'];
export default function MitgliedDokumente({ mitglied, canDelete = false }) {
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [typ, setTyp] = useState(TYPEN[0]);
  async function reload() {
    try { const r = await base44.functions.invoke('mitgliedDokumentSicher', { aktion: 'liste', mitglied_id: mitglied.id }); setDocs(r.data?.dokumente || []); setError(''); }
    catch (e) { console.error('Dokumente:', e); setError('Dokumente konnten nicht geladen werden.'); }
  }
  useEffect(() => { reload(); }, [mitglied.id]);
  async function upload(e) {
    e.preventDefault(); if (!file) return;
    if (file.size > 15 * 1024 * 1024) return toast.error('Maximal 15 MB pro Datei.');
    setBusy(true);
    try {
      // Sensitive club documents are never uploaded with the public UploadFile integration.
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      if (!file_uri) throw new Error('Keine private Datei-URI erhalten');
      await base44.functions.invoke('mitgliedDokumentSicher', { aktion: 'anlegen', mitglied_id: mitglied.id, typ, name: file.name, datei_groesse: file.size, file_uri });
      setFile(null); e.target.reset(); toast.success('Privates Dokument hinzugefügt.'); await reload();
    } catch (err) { console.error('Privater Upload:', err); toast.error('Dokument konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  }
  async function download(doc) {
    // Open synchronously on click so mobile popup blockers do not reject the delayed URL.
    const tab = window.open('', '_blank');
    if (!tab) return toast.error('Bitte Pop-ups für den Dokumentenabruf erlauben.');
    tab.opener = null;
    try {
      const res = await base44.functions.invoke('mitgliedDokumentSicher', { aktion: 'signed_url', dokument_id: doc.id });
      if (!res.data?.signed_url) throw new Error('Keine Download-Adresse');
      tab.location.replace(res.data.signed_url);
    } catch (e) { tab.close(); console.error('Dokument öffnen:', e); toast.error('Dokument konnte nicht geöffnet werden.'); }
  }
  async function remove(doc) {
    if (!(await confirmDialog(`Dokument „${doc.name}“ entfernen?`))) return;
    try { await base44.functions.invoke('mitgliedDokumentSicher', { aktion: 'loeschen', dokument_id: doc.id }); await reload(); toast.success('Eintrag entfernt. Die Datei selbst wird nicht automatisch aus dem privaten Speicher gelöscht.'); }
    catch (e) { console.error('Dokument entfernen:', e); toast.error('Entfernen fehlgeschlagen.'); }
  }
  return <section className="rounded-lg border border-border bg-card p-4">
    <h2 className="font-oswald text-lg text-foreground mb-2">Geschützte Dokumente</h2>
    <p className="text-xs text-muted-foreground mb-3">Neue Dateien bleiben privat und können nur von berechtigten Verwaltungsrollen abgerufen werden.</p>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <ul className="space-y-2">{docs.map(doc => <li key={doc.id} className="flex gap-2 items-center justify-between text-sm border-b border-border py-2">
      <div className="min-w-0 text-foreground"><span className="break-all">{doc.name}</span><span className="block text-xs text-muted-foreground">{doc.typ} · {doc.datum || ''}</span></div>
      <div className="flex gap-2 shrink-0"><button onClick={() => download(doc)} className="text-primary">Öffnen</button>{canDelete && <button onClick={() => remove(doc)} className="text-destructive">Eintrag entfernen</button>}</div>
    </li>)}</ul>
    {!docs.length && !error && <p className="text-xs text-muted-foreground">Keine privaten Dokumente vorhanden.</p>}
    {mitglied.antrag_pdf_url && <p className="text-xs text-muted-foreground mt-3">Älterer Antrag liegt noch unter dem bisherigen Link. Neue Dokumente werden privat gespeichert.</p>}
    <form onSubmit={upload} className="mt-4 flex gap-2 flex-wrap items-center">
      <select value={typ} onChange={e => setTyp(e.target.value)} className="rounded-md border border-border bg-background p-2 text-sm text-foreground">{TYPEN.map(t => <option key={t}>{t}</option>)}</select>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={e => setFile(e.target.files?.[0] || null)} required className="text-xs text-foreground max-w-[210px]" />
      <button type="submit" disabled={!file || busy} className="rounded-md bg-primary px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Lädt…' : 'Privat hochladen'}</button>
    </form>
  </section>;
}
