import { useState } from 'react';
import { X, RefreshCw, Copy, Check, Link2, BellOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';

// Live-Kalender-Abo (iCal Subscription): Termin-Apps (iPhone, Google, Outlook)
// rufen die URL regelmaessig selbst ab — ohne Login, der Token ist die Authentifizierung.
// Der Token wird nur EINMAL angezeigt (serverseitig wird nur der Hash gespeichert).
export default function KalenderAboModal({ onClose }) {
  const [status, setStatus] = useState('start'); // start | erstelle | bereit
  const [aboUrl, setAboUrl] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [copied, setCopied] = useState(false);

  const handleErstellen = async () => {
    setStatus('erstelle');
    try {
      const origin = window.location.origin;
      const res = await base44.functions.invoke('generateKalenderFeedToken', { feed_typ: 'persoenlich', origin });
      const data = res?.data || res;
      if (!data?.token) throw new Error('Kein Token erhalten');
      // URL IMMER client-seitig bauen: Die serverseitig gebaute URL läuft im
      // Production-Dispatcher mit leerer App-ID und Dispatcher-Origin (worker.dev)
      // und ist dort nicht abrufbar. Der öffentliche App-Origin ist verbindlich.
      const url = `${origin}/api/apps/${appParams.appId}/functions/getKalenderFeedSicher?type=persoenlich&token=${data.token}`;
      setAboUrl(url);
      setTokenId(data.token_id || '');
      setStatus('bereit');
    } catch (e) {
      console.error('Abo-Link-Erstellung fehlgeschlagen:', e);
      toast.error('Abo-Link konnte nicht erstellt werden.');
      setStatus('start');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aboUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopieren fehlgeschlagen — URL manuell markieren.');
    }
  };

  const handleWiderrufen = async () => {
    if (!(await confirmDialog('Abo-Link wirklich zurückziehen? Termine werden dann nicht mehr synchronisiert.'))) return;
    try {
      await base44.functions.invoke('revokeKalenderFeedToken', { token_id: tokenId });
      toast.success('Abo-Link zurückgezogen.');
      setAboUrl(''); setTokenId(''); setStatus('start');
    } catch {
      toast.error('Zurückziehen fehlgeschlagen.');
    }
  };

  const webcalUrl = aboUrl ? aboUrl.replace(/^https/, 'webcal') : '';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
            <Link2 size={18} className="text-primary" /> Live-Kalender abonnieren
          </h3>
          <button onClick={onClose} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        {status === 'start' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Deine Kalender-App ruft den Terminkalender der Zunft automatisch ab und hält ihn aktuell —
              neue Termine und Änderungen erscheinen ohne erneutes Herunterladen.
            </p>
            <div className="bg-secondary border border-border rounded-xl p-3 text-xs text-muted-foreground space-y-1">
              <p><strong className="text-foreground">So funktioniert's:</strong></p>
              <p>1. Link erstellen (unten)</p>
              <p>2. In deiner Kalender-App als <strong className="text-foreground">Kalender-Abonnement</strong> hinterlegen</p>
              <p>3. Fertig — Updates kommen automatisch</p>
            </div>
            <button onClick={handleErstellen} disabled={status === 'erstelle'}
              className="w-full py-3 min-h-[44px] rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
              {status === 'erstelle' ? 'Wird erstellt…' : 'Abo-Link erstellen'}
            </button>
            <p className="text-xs text-muted-foreground">
              Falls du bereits einen Abo-Link eingerichtet hast, wird er durch den neuen ersetzt —
              trage dann den neuen Link in deiner Kalender-App ein.
            </p>
          </div>
        )}

        {status === 'bereit' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Deine Abo-URL</p>
              <div className="flex gap-2">
                <input readOnly value={aboUrl} onFocus={e => e.target.select()}
                  className="flex-1 px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-xs text-foreground truncate" />
                <button onClick={handleCopy}
                  className="px-3 min-h-[44px] rounded-lg bg-primary text-white flex items-center gap-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors">
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopiert' : 'Kopieren'}
                </button>
              </div>
            </div>

            <div className="bg-secondary border border-border rounded-xl p-3 space-y-2.5 text-xs text-muted-foreground">
              <p><strong className="text-foreground">iPhone / iPad:</strong> Einstellungen → Kalender → Konten → Kalender hinzufügen → <em>Kalender-Abonnement</em> → URL einfügen.</p>
              <p><strong className="text-foreground">Google Kalender:</strong> calendar.google.com → Andere Kalender → <em>Über URL hinzufügen</em>. (Am Handy funktioniert das nur über die Website, nicht in der App.)</p>
              <p><strong className="text-foreground">Outlook:</strong> outlook.com → Kalender → <em>Abonnieren</em> → URL einfügen.</p>
              {webcalUrl && <p className="text-muted-foreground/70">Tipp für Apple: die URL funktioniert auch mit <span className="truncate inline-block max-w-full align-bottom">webcal://</span>-Protokoll: <span className="text-primary break-all">{webcalUrl}</span></p>}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={handleErstellen} disabled={status === 'erstelle'}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:text-foreground flex items-center justify-center gap-1.5 transition-colors">
                <RefreshCw size={13} /> Neuen Link erstellen
              </button>
              {tokenId && (
                <button onClick={handleWiderrufen}
                  className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:text-destructive flex items-center justify-center gap-1.5 transition-colors">
                  <BellOff size={13} /> Abo beenden
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Der Link ist persönlich und gilt nur für dich — nicht weitergeben. Wer ihn hat, sieht deine Termine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
