import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { ShieldCheck, FileText } from 'lucide-react';

/**
 * Pflicht-Zustimmung zum Datenschutz (Satzung § 14) beim App-Start.
 * - erscheint, solange für die aktuelle Dokument-Version noch keine Zustimmung vorliegt
 * - Eltern stimmen für verknüpfte Kinder mit zu (die selbst keine Mitglieder sind, Satzung § 4)
 * - bewusst NICHT wegwischbar: erst "Zustimmen" oder Abmelden
 */
export default function DatenschutzZustimmungModal() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [kinderAuswahl, setKinderAuswahl] = useState({});
  const [busy, setBusy] = useState(false);
  const [haken, setHaken] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let aktiv = true;
    base44.functions.invoke('vereinsDokumentSicher', { aktion: 'zustimmung_status' })
      .then(r => {
        if (!aktiv || !r.data?.erforderlich) return;
        setStatus(r.data);
        setKinderAuswahl(Object.fromEntries((r.data.kinder_offen || []).map(k => [k.id, true])));
      })
      .catch(e => console.error('Zustimmungsstatus:', e));
    return () => { aktiv = false; };
  }, [user?.id]);

  if (!status) return null;

  async function oeffneDokument() {
    const tab = window.open('', '_blank');
    if (!tab) return toast.error('Bitte Pop-ups erlauben.');
    tab.opener = null;
    try {
      const r = await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'signed_url', dokument_id: status.dokument.id });
      if (!r.data?.signed_url) throw new Error('keine URL');
      tab.location.replace(r.data.signed_url);
    } catch (e) { tab.close(); console.error(e); toast.error('Dokument konnte nicht geöffnet werden.'); }
  }

  async function zustimmen() {
    setBusy(true);
    try {
      await base44.functions.invoke('vereinsDokumentSicher', {
        aktion: 'zustimmen',
        fuer_kinder_ids: Object.entries(kinderAuswahl).filter(([, v]) => v).map(([k]) => k),
      });
      toast.success('Danke, deine Zustimmung ist gespeichert.');
      setStatus(null);
    } catch (e) { console.error(e); toast.error('Speichern fehlgeschlagen. Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }

  const kinder = status.kinder_offen || [];
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center"><ShieldCheck size={20} className="text-foreground" /></div>
          <h2 className="font-oswald uppercase tracking-wide text-lg text-foreground">Datenschutz</h2>
        </div>
        <p className="text-sm text-foreground mb-2">Die Narrenzunft Frommern e.V. verwaltet Mitgliederdaten digital in dieser App, so wie es § 14 der Satzung vorsieht.</p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mb-3">
          <li>Gespeichert werden Name, Anschrift, Kontaktdaten, Geburtsdatum, Bankverbindung und Funktion im Verein.</li>
          <li>Weitergabe nur an Verband und Versicherung, soweit nötig. Kein Datenverkauf.</li>
          <li>Fotos und Ehrungen dürfen veröffentlicht werden. Du kannst dem jederzeit beim Vorstand widersprechen.</li>
          <li>Du hast ein Recht auf Auskunft, Berichtigung und Löschung.</li>
        </ul>
        <button onClick={oeffneDokument} className="inline-flex items-center gap-1.5 text-sm text-primary mb-4"><FileText size={15} /> {status.dokument.titel} lesen</button>

        {kinder.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-3 mb-4">
            <p className="text-xs text-muted-foreground mb-2">Als Elternteil stimmst du auch für deine Kinder zu (sie sind laut Satzung nicht selbst Mitglied):</p>
            {kinder.map(k => (
              <label key={k.id} className="flex items-center gap-2 text-sm text-foreground py-0.5">
                <input type="checkbox" checked={!!kinderAuswahl[k.id]} onChange={e => setKinderAuswahl(s => ({ ...s, [k.id]: e.target.checked }))} /> {k.name}
              </label>
            ))}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-foreground mb-4">
          <input type="checkbox" checked={haken} onChange={e => setHaken(e.target.checked)} className="mt-1" />
          <span>Ich habe die Hinweise gelesen und stimme der Verarbeitung meiner Daten in der Vereins-App zu.</span>
        </label>
        <button onClick={zustimmen} disabled={!haken || busy} className="w-full rounded-lg bg-primary py-3 text-white font-semibold disabled:opacity-50">{busy ? 'Speichert…' : 'Zustimmen und weiter'}</button>
        <button onClick={() => base44.auth.logout('/')} className="w-full mt-2 py-2 text-xs text-muted-foreground">Nicht zustimmen und abmelden</button>
      </div>
    </div>
  );
}
