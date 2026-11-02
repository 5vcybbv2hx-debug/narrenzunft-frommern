import { useState, useEffect } from 'react';
import { getPushStatus, fragePushAb, pushHinweisBlockiert, PUSH_AKTIV } from '@/lib/push';
import { toast } from 'sonner';
import { Bell, BellOff, RefreshCw } from 'lucide-react';

/**
 * Dauerhafte Diagnose-Zeile für Push im Profil:
 * Abo-Status, Notification.permission, eingeloggte external_id.
 */
export default function PushStatus() {
  const [status, setStatus] = useState(null);
  const [prueft, setPrueft] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState(null);

  useEffect(() => {
    let aktiv = true;
    getPushStatus().then((s) => { if (aktiv) { setStatus(s); setPrueft(true); } });
    return () => { aktiv = false; };
  }, []);

  if (!prueft || !status) return null;
  if (!PUSH_AKTIV) return null; // Push nicht konfiguriert: Zeile weg

  const abonniert = status.abonniert;
  const externalId = status.externalId ? `…${String(status.externalId).slice(-6)}` : '–';

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Push-Status">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {abonniert
            ? <Bell size={16} className="text-primary" />
            : <BellOff size={16} className="text-muted-foreground" />}
          <h3 className="font-oswald text-lg text-foreground">Push-Benachrichtigungen</h3>
        </div>
        <button
          onClick={() => getPushStatus().then(setStatus)}
          className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Status neu prüfen"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        <p className="text-foreground">
          Abo: <span className={abonniert ? 'text-primary font-medium' : 'text-muted-foreground'}>
            {abonniert ? 'aktiv ✓' : 'nicht abonniert'}
          </span>
        </p>
        <p className="text-muted-foreground">Benachrichtigungs-Erlaubnis: {status.erlaubnis}</p>
        <p className="text-muted-foreground">Verbundene ID (external_id): {externalId}</p>
      </div>

      {!abonniert && (
        <>
          <button
            disabled={laeuft}
            onClick={async () => {
              setLaeuft(true);
              setHinweis(null);
              const ergebnis = await fragePushAb();
              const neuerStatus = await getPushStatus();
              setStatus(neuerStatus);
              setPrueft(true);
              setLaeuft(false);
              if (ergebnis.ok || neuerStatus.abonniert) {
                toast.success('Push aktiviert ✓ Du bekommst jetzt Benachrichtigungen.');
              } else if (ergebnis.grund === 'blockiert' || neuerStatus.erlaubnis === 'denied') {
                setHinweis(pushHinweisBlockiert());
              } else {
                setHinweis('Der Browser hat die Nachfrage nicht angezeigt. Bitte erneut tippen, '
                  + 'oder Benachrichtigungen direkt in den Browser-/Geräteeinstellungen erlauben.');
              }
            }}
            className="mt-3 w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {laeuft ? 'Wird geprüft …' : 'Benachrichtigungen aktivieren'}
          </button>
          {hinweis && <p className="text-xs text-foreground mt-2">{hinweis}</p>}
        </>
      )}
    </section>
  );
}
