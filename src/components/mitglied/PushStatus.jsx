import { useState, useEffect, useRef } from 'react';
import { getPushStatus, setzePushAbo, pushHinweisBlockiert, pushUmgebung, PUSH_AKTIV } from '@/lib/push';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check } from 'lucide-react';

const LANGDRUCK_MS = 700;

/**
 * Push im Profil — bewusst ruhig:
 *  - aktiv (Abo + Erlaubnis): eine Zeile "Benachrichtigungen aktiv" + "Deaktivieren"
 *  - nicht aktiv: zwei Zeilen Abo/Erlaubnis + Aktivieren-Button
 *  - Erlaubnis verweigert: Hinweis + Anleitung
 * Die technische Diagnose (inkl. external_id) bleibt erhalten, aber nur für
 * Admins per Long-Press auf der Statuszeile.
 */
export default function PushStatus({ istAdmin = false }) {
  const [status, setStatus] = useState(null);
  const [prueft, setPrueft] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState(null);
  const [zeigeDiagnose, setZeigeDiagnose] = useState(false);
  const [zeigeAnleitung, setZeigeAnleitung] = useState(false);
  const langdruck = useRef(null);

  useEffect(() => {
    let aktiv = true;
    getPushStatus().then((s) => { if (aktiv) { setStatus(s); setPrueft(true); } });
    return () => { aktiv = false; clearTimeout(langdruck.current); };
  }, []);

  if (!prueft || !status) return null;
  if (!PUSH_AKTIV) return null; // Push nicht konfiguriert: Zeile weg

  const abonniert = !!status.abonniert;
  const erlaubnis = status.erlaubnis;
  const aktiv = abonniert && erlaubnis === 'granted';
  const verweigert = erlaubnis === 'denied';
  const umgebung = pushUmgebung();

  // Long-Press auf der Statuszeile öffnet die Diagnose — nur für Admins.
  const langdruckStart = () => {
    if (!istAdmin) return;
    clearTimeout(langdruck.current);
    langdruck.current = setTimeout(() => setZeigeDiagnose((v) => !v), LANGDRUCK_MS);
  };
  const langdruckEnde = () => clearTimeout(langdruck.current);

  const einschalten = async () => {
    setLaeuft(true);
    setHinweis(null);
    const ergebnis = await setzePushAbo(true);
    const neu = await getPushStatus();
    setStatus(neu);
    setLaeuft(false);
    // Kein Toast: der Wechsel in den aktiven Zustand ist die Bestätigung.
    if (neu.abonniert && neu.erlaubnis === 'granted') return;
    if (ergebnis.grund === 'blockiert' || ergebnis.erlaubnis === 'denied') {
      setHinweis(pushHinweisBlockiert());
    } else {
      setHinweis('Der Browser hat die Nachfrage nicht angezeigt. Bitte erneut tippen, '
        + 'oder Benachrichtigungen direkt in den Browser-/Geräteeinstellungen erlauben.');
    }
  };

  const ausschalten = async () => {
    setLaeuft(true);
    setHinweis(null);
    const ergebnis = await setzePushAbo(false);
    setStatus(await getPushStatus());
    setLaeuft(false);
    if (ergebnis.ok) toast.success('Push ausgeschaltet. Du bekommst keine Benachrichtigungen mehr.');
    else setHinweis('Ausschalten hat nicht geklappt. Bitte erneut versuchen oder die App neu laden.');
  };

  const langdruckProps = {
    onPointerDown: langdruckStart,
    onPointerUp: langdruckEnde,
    onPointerLeave: langdruckEnde,
    onPointerCancel: langdruckEnde,
  };

  const diagnose = zeigeDiagnose && istAdmin
    ? <Diagnose status={status} umgebung={umgebung} />
    : null;

  // ── Zustand aktiv: eine ruhige Zeile, kein Rahmen, kein roter Button ──
  if (aktiv) {
    return (
      <div className="mb-4">
        <div {...langdruckProps} className="flex items-center gap-2 px-1 py-1.5">
          <motion.span
            initial={{ opacity: 0, x: -6, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="shrink-0 text-green-500"
          >
            <Check size={15} />
          </motion.span>
          <span className="flex-1 min-w-0 text-[13px] text-muted-foreground">Benachrichtigungen aktiv</span>
          <button
            onClick={ausschalten}
            disabled={laeuft}
            className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-60"
          >
            {laeuft ? '…' : 'Deaktivieren'}
          </button>
        </div>
        {hinweis && <p className="text-xs text-foreground px-1">{hinweis}</p>}
        {diagnose}
      </div>
    );
  }

  // ── Zustand Erlaubnis verweigert: Hinweis statt Diagnosezeilen ──
  if (verweigert) {
    return (
      <div className="mb-4">
        <div {...langdruckProps} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-2.5">
            <BellOff size={15} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">Erlaubnis in den Systemeinstellungen entzogen</p>
              <button
                onClick={() => setZeigeAnleitung((v) => !v)}
                className="mt-2 text-[13px] font-medium text-primary hover:underline"
              >
                Einstellungen öffnen
              </button>
              {zeigeAnleitung && (
                <p className="text-xs text-muted-foreground mt-2">{pushHinweisBlockiert()}</p>
              )}
            </div>
          </div>
        </div>
        {diagnose}
      </div>
    );
  }

  // ── Zustand nicht aktiv: zwei Zeilen + Aktivieren ──
  return (
    <section className="mb-4" aria-label="Push-Status">
      <div {...langdruckProps} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <BellOff size={16} className="text-muted-foreground" />
          <h3 className="font-oswald text-lg text-foreground">Push-Benachrichtigungen</h3>
        </div>
        <div className="mt-2 space-y-1 text-xs">
          <p className="text-foreground">
            Abo:{' '}
            <span className="text-muted-foreground">
              {abonniert ? 'aktiv' : (status.deaktiviert ? 'ausgeschaltet' : 'nicht abonniert')}
            </span>
          </p>
          <p className="text-muted-foreground">
            Erlaubnis: {erlaubnis === 'granted' ? 'erteilt' : 'nicht erteilt'}
          </p>
        </div>

        {!umgebung.unterstuetzt ? (
          <div className="mt-3 rounded-lg border border-border bg-secondary px-3 py-2">
            <p className="text-xs font-medium text-foreground">{umgebung.titel}</p>
            <p className="text-xs text-muted-foreground mt-1">{umgebung.hinweis}</p>
          </div>
        ) : (
          <button
            disabled={laeuft}
            onClick={einschalten}
            className="mt-3 w-full px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {laeuft ? 'Einen Moment …' : 'Benachrichtigungen aktivieren'}
          </button>
        )}
        {hinweis && <p className="text-xs text-foreground mt-2">{hinweis}</p>}
      </div>
      {diagnose}
    </section>
  );
}

/** Vollständige technische Diagnose — nur für Admins (Long-Press). */
function Diagnose({ status, umgebung }) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
      <p>Push konfiguriert: {status.aktiv ? 'ja' : 'nein'}</p>
      <p>Abo: {status.abonniert ? 'aktiv' : 'nicht abonniert'}{status.deaktiviert ? ' (bewusst aus)' : ''}</p>
      <p>Benachrichtigungs-Erlaubnis: {status.erlaubnis}</p>
      <p className="break-all">Verbundene ID (external_id): {status.externalId || '–'}</p>
      <p>Gerät/Browser: {umgebung.titel || umgebung.typ}</p>
    </div>
  );
}