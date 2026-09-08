import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Mail, AlertCircle, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

/**
 * Bulk-Einladung für den Launch (Admin-only).
 *
 * Lädt alle Mitglieder und sortiert sie in Kategorien:
 *  - EINLADBAR: gültige, eindeutige E-Mail, noch nie eingeladen, kein Login vorhanden
 *  - DUBLETTEN: E-Mail liegt auf mehreren Datensätzen → wird übersprungen und
 *    mit Namen angezeigt (meist Familien: Eltern-E-Mail auch am Kind).
 *    Hier würde die Auto-Verknüpfung beim Login den falschen (ersten)
 *    Treffer verknüpfen → vorher klären oder eigene E-Mails erfassen.
 *  - UNGÜLTIG: E-Mail-Format fehlerhaft (z.B. fehlende Endung)
 *  - OHNE E-MAIL: Information
 *  - BEREITS EINGELADEN / REGISTRIERT: Information
 *
 * Der Versand läuft sequenziell mit Fortschrittsanzeige; Fehler unterbrechen
 * nicht, sondern werden gesammelt und am Ende aufgeführt.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function BulkEinladenModal({ onClose, onDone }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liste, setListe] = useState(null); // { einladbar, dubletten, ungueltig, ohneEmail, eingeladen, registriert }

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total, current }
  const [result, setResult] = useState(null); // { ok, fehler: [{name, msg}] }

  const [showDup, setShowDup] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ms, users] = await Promise.all([
          base44.entities.Mitglied.list('nachname', 500),
          base44.entities.User.list().catch(() => []),
        ]);
        if (cancelled) return;

        const aktiv = ms.filter(m => !m.archiviert && m.mitgliedsstatus !== 'Verstorben');
        const userEmails = new Set(users.map(u => (u.email || '').toLowerCase()));
        const eingeladenIds = new Set(ms.filter(m => m.einladung_gesendet_am).map(m => m.id));

        // E-Mail-Verwendung zählen (case-insensitive, nur aktive Mitglieder)
        const emailCounts = {};
        for (const m of aktiv) {
          const e = (m.email || '').trim().toLowerCase();
          if (e) emailCounts[e] = (emailCounts[e] || 0) + 1;
        }

        const einladbar = [], dubletten = [], ungueltig = [];
        let ohneEmail = 0, eingeladen = 0, registriert = 0;

        for (const m of aktiv) {
          const e = (m.email || '').trim();
          if (!e) { ohneEmail += 1; continue; }
          if (m.user_id || userEmails.has(e.toLowerCase())) { registriert += 1; continue; }
          if (eingeladenIds.has(m.id)) { eingeladen += 1; continue; }
          if (!EMAIL_RE.test(e)) { ungueltig.push(m); continue; }
          if (emailCounts[e.toLowerCase()] > 1) { dubletten.push(m); continue; }
          einladbar.push(m);
        }

        if (!cancelled) {
          setListe({ einladbar, dubletten, ungueltig, ohneEmail, eingeladen, registriert });
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { setError('Mitglieder konnten nicht geladen werden.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const start = async () => {
    const queue = liste.einladbar;
    if (!queue.length) return;
    setRunning(true);
    setProgress({ done: 0, total: queue.length, current: '' });
    const today = new Date().toISOString().split('T')[0];
    const fehler = [];
    let ok = 0;

    for (let i = 0; i < queue.length; i++) {
      const m = queue[i];
      const name = `${m.vorname} ${m.nachname}`.trim() || m.id;
      setProgress({ done: i, total: queue.length, current: name });
      try {
        const baseRolle = ['vorstand', 'stellv_vorstand'].includes(m.app_rolle) ? 'admin' : 'user';
        await base44.users.inviteUser(m.email.trim(), baseRolle);
        await base44.entities.Mitglied.update(m.id, { einladung_gesendet_am: today });
        ok += 1;
      } catch (e) {
        fehler.push({ name, msg: (e?.message || 'Unbekannter Fehler').slice(0, 120) });
      }
      // kurze Pause, um die API zu schonen
      await new Promise(r => setTimeout(r, 150));
    }

    setProgress({ done: queue.length, total: queue.length, current: '' });
    setResult({ ok, fehler });
    setRunning(false);
    onDone?.();
  };

  const Stat = ({ icon: Icon, label, value, tone = 'muted' }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/60">
      <Icon size={16} className={tone === 'primary' ? 'text-primary' : tone === 'warn' ? 'text-yellow-400' : tone === 'green' ? 'text-green-400' : 'text-muted-foreground'} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );

  const groupBox = (titel, hint, members, open, setOpen, tone) => {
    if (!members.length) return null;
    return (
      <div className={`rounded-lg border ${tone === 'warn' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 text-left">
          <span className="text-sm font-medium text-foreground">{titel} ({members.length})</span>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>
        {open && (
          <div className="px-3 pb-3 space-y-1.5">
            <p className="text-xs text-muted-foreground">{hint}</p>
            {members.map(m => (
              <div key={m.id} className="text-xs text-foreground flex justify-between gap-2">
                <span className="shrink-0">{m.vorname} {m.nachname}</span>
                <span className="text-muted-foreground truncate max-w-[55%]">{m.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2">
            <Send size={18} className="text-primary" /> Mitglieder einladen
          </h3>
          <button onClick={onClose} disabled={running} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 size={24} className="text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Mitglieder werden analysiert…</p>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-red-900/20 border border-red-700/30 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {liste && !running && !result && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Versendet eine App-Einladung an alle aktiven Mitglieder mit eindeutiger E-Mail-Adresse,
              die noch nie eingeladen wurden. Beim ersten Login verknüpft sich das Konto automatisch mit dem Profil.
            </p>

            <div className="grid gap-2">
              <Stat icon={Send} label="Einladbar – werden jetzt eingeladen" value={liste.einladbar.length} tone="primary" />
              <Stat icon={Check} label="Bereits eingeladen oder registriert" value={liste.eingeladen + liste.registriert} tone="green" />
              <Stat icon={Mail} label="Ohne E-Mail – noch keine Einladung möglich" value={liste.ohneEmail} tone="muted" />
            </div>

            {groupBox(
              'E-Mail-Dubletten (übersprungen)',
              'Diese Adresse liegt auf mehreren Profilen (meist Familien: Eltern-E-Mail auch am Kind). Da die Auto-Verknüpfung beim Login den ersten Treffer nimmt, würde sich hier ein Konto mit dem falschen Profil verbinden. Bitte vorher klären oder dem Mitglied eine eigene E-Mail im Profil erfassen.',
              liste.dubletten, showDup, setShowDup, 'warn'
            )}
            {groupBox(
              'Ungültige E-Mail-Adressen (übersprungen)',
              'Das Format ist fehlerhaft – die Einladung würde nie ankommen. Bitte im Profil korrigieren (z.B. fehlende Endung wie .de).',
              liste.ungueltig, showInvalid, setShowInvalid, 'warn'
            )}

            <button
              onClick={start}
              disabled={!liste.einladbar.length}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send size={15} />
              {liste.einladbar.length > 0
                ? `${liste.einladbar.length} Einladungen versenden`
                : 'Nichts zu versenden'}
            </button>
          </div>
        )}

        {running && progress && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-foreground font-medium">
              Einladungen werden versendet… ({Math.min(progress.done + 1, progress.total)}/{progress.total})
            </p>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground truncate">{progress.current}</p>
            <p className="text-xs text-muted-foreground">Bitte das Fenster geöffnet lassen – das dauert wenige Sekunden.</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={24} className="text-green-400" />
              </div>
              <p className="text-sm font-medium text-white text-center">
                {result.ok} Einladung{result.ok !== 1 && 'en'} erfolgreich versendet
                {result.fehler.length > 0 && ` · ${result.fehler.length} fehlgeschlagen`}
              </p>
            </div>
            {result.fehler.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                {result.fehler.map(f => (
                  <div key={f.name} className="text-xs">
                    <p className="text-foreground font-medium">{f.name}</p>
                    <p className="text-red-400">{f.msg}</p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
