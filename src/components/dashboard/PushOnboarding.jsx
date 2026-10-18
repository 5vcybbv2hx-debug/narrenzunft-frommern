import { useState, useEffect } from 'react';
import { getPushStatus, fragePushAb, PUSH_AKTIV } from '@/lib/push';
import { Bell, X, Share, PlusSquare } from 'lucide-react';

/**
 * Onboarding-Karte "Push aktivieren" auf dem Dashboard.
 *
 * iOS-Spezialfall (größte Verwirrungsquelle): Web-Push geht NUR in der
 * installierten Web-App (Zum Home-Bildschirm), NIEMALS im Safari.
 * Einmal abgelehnt -> iOS fragt nie wieder -> nur über Einstellungen.
 * Android/Desktop läuft direkt im Browser.
 */
function istIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function istInstalliert() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function PushOnboarding() {
  const [status, setStatus] = useState(null);
  const [versteckt, setVersteckt] = useState(() => {
    try { return localStorage.getItem('nz_push_onboarding_weg') === '1'; } catch { return false; }
  });

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  if (!PUSH_AKTIV || versteckt || !status || status.abonniert) return null;

  const schliessen = () => {
    try { localStorage.setItem('nz_push_onboarding_weg', '1'); } catch { /* egal */ }
    setVersteckt(true);
  };

  const ios = istIOS();
  const installiert = istInstalliert();
  const abgelehnt = status.erlaubnis === 'denied';

  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-4 relative" aria-label="Push aktivieren">
      <button onClick={schliessen} className="absolute top-2 right-2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground" title="Später erinnern">
        <X size={16} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Bell size={16} className="text-primary" />
        <h2 className="font-oswald text-lg text-foreground">Push aktivieren</h2>
      </div>

      {ios && !installiert ? (
        <div className="text-sm space-y-2">
          <p className="text-foreground">Auf dem iPhone funktionieren Push-Benachrichtigungen nur in der installierten App, nicht im Safari. So geht's:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li className="flex items-center gap-1.5">In Safari unten auf <Share size={13} /> <em>Teilen</em> tippen</li>
            <li className="flex items-center gap-1.5"><PlusSquare size={13} /> <em>Zum Home-Bildschirm</em> wählen, hinzufügen</li>
            <li>App vom Home-Bildschirm öffnen – beim ersten Mal nach Erlaubnis fragen lassen</li>
          </ol>
        </div>
      ) : ios && abgelehnt ? (
        <div className="text-sm space-y-2">
          <p className="text-foreground">Push wurde früher abgelehnt – iOS fragt nicht erneut nach. So schaltest du es frei:</p>
          <p className="text-muted-foreground">iPhone-Einstellungen → Benachrichtigungen → Narrenzunft App → „Zulassen“ aktivieren.</p>
        </div>
      ) : (
        <div className="text-sm space-y-2">
          <p className="text-muted-foreground">Erhalte Erinnerungen für Arbeitsdienste, Ausfahrten, Abstimmungen und Termine.</p>
          <button
            onClick={async () => { await fragePushAb(); setStatus(await getPushStatus()); }}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Benachrichtigungen aktivieren
          </button>
        </div>
      )}
    </section>
  );
}
