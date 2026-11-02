import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDatum } from '@/lib/datum';
import { waEinladungsLink, waNummer } from '@/lib/whatsappEinladung';
import {
  X, Search, UserPlus, Check, AlertCircle, Send, Loader2, Users, Phone, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/**
 * Gruppe zusammenstellen und in einem Rutsch einladen.
 * Live-Suche füllt die Auswahl, ein Klick verschickt alle Einladungen.
 */
export default function EinladenGruppeModal({ mitglieder = [], onClose, onDone }) {
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState([]); // Mitglieder-Objekte
  const [laeuft, setLaeuft] = useState(false);
  const [fortschritt, setFortschritt] = useState(null);
  const [ergebnis, setErgebnis] = useState(null);

  const aktive = useMemo(() => mitglieder.filter(m => !m.archiviert), [mitglieder]);

  const treffer = useMemo(() => {
    const s = suche.trim().toLowerCase();
    if (!s) return [];
    const gewaehlt = new Set(auswahl.map(m => m.id));
    return aktive
      .filter(m => !gewaehlt.has(m.id))
      .filter(m =>
        `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase().includes(s)
        || String(m.mitgliedsnummer || '').includes(s.replace('#', ''))
        || (m.email || '').toLowerCase().includes(s)
      )
      .slice(0, 12);
  }, [suche, aktive, auswahl]);

  const hinzufuegen = (m) => {
    setAuswahl(prev => [...prev, m]);
    setSuche('');
  };
  const entfernen = (id) => setAuswahl(prev => prev.filter(m => m.id !== id));

  // Status je Person in der Auswahl
  const status = (m) => {
    const email = (m.email || '').trim();
    if (m.user_id) return { art: 'registriert', text: 'schon in der App', sendbar: false };
    if (!email) return { art: 'ohne', text: 'keine Mailadresse', sendbar: false };
    if (!EMAIL_RE.test(email)) return { art: 'ungueltig', text: 'Mailadresse ungültig', sendbar: false };
    if (m.einladung_gesendet_am) return { art: 'eingeladen', text: `schon eingeladen ${fmtDatum(m.einladung_gesendet_am)}`, sendbar: false };
    // Adresse, die innerhalb der Auswahl doppelt vorkommt: nur die erste einladen
    const gleich = auswahl.filter(x => (x.email || '').trim().toLowerCase() === email.toLowerCase());
    if (gleich.length > 1 && gleich[0].id !== m.id) return { art: 'dublette', text: 'Adresse doppelt in der Auswahl', sendbar: false };
    return { art: 'ok', text: email, sendbar: true };
  };

  const sendbar = auswahl.filter(m => status(m).sendbar);

  const senden = async () => {
    if (!sendbar.length) { toast.error('Keine einladbare Person in der Auswahl.'); return; }
    setLaeuft(true);
    setFortschritt({ done: 0, total: sendbar.length, current: '' });
    const heute = new Date().toISOString().split('T')[0];
    const fehler = [];
    let ok = 0;

    for (let i = 0; i < sendbar.length; i += 1) {
      const m = sendbar[i];
      const name = `${m.vorname || ''} ${m.nachname || ''}`.trim() || m.id;
      setFortschritt({ done: i, total: sendbar.length, current: name });
      try {
        const rolle = ['vorstand', 'stellv_vorstand'].includes(m.app_rolle) ? 'admin' : 'user';
        await base44.users.inviteUser(m.email.trim(), rolle);
        await base44.entities.Mitglied.update(m.id, { einladung_gesendet_am: heute });
        ok += 1;
      } catch (e) {
        fehler.push({ name, msg: (e?.message || 'Unbekannter Fehler').slice(0, 120) });
      }
      await new Promise(r => setTimeout(r, 150));
    }

    setFortschritt(null);
    setErgebnis({ ok, fehler });
    setLaeuft(false);
    onDone?.();
  };

  const ohneMail = auswahl.filter(m => !(m.email || '').trim() && !m.user_id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="font-oswald text-lg uppercase tracking-wide text-foreground flex items-center gap-2">
            <Users size={18} className="text-primary" /> Gruppe einladen
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {ergebnis ? (
          <div className="p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center gap-2 text-green-400">
              <Check size={18} />
              <p className="text-sm font-semibold">{ergebnis.ok} Einladung{ergebnis.ok === 1 ? '' : 'en'} verschickt</p>
            </div>
            {ergebnis.fehler.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <p className="text-xs font-semibold text-red-400 mb-1">{ergebnis.fehler.length} fehlgeschlagen</p>
                {ergebnis.fehler.map((f, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">{f.name}: {f.msg}</p>
                ))}
              </div>
            )}
            {ohneMail.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-yellow-400">{ohneMail.length} ohne Mailadresse — direkt per WhatsApp</p>
                {ohneMail.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-foreground truncate">{m.vorname} {m.nachname}</span>
                    {(m.telefon || '').trim() && waNummer(m.telefon) ? (
                      <a href={waEinladungsLink({ telefon: m.telefon, vorname: m.vorname })} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-400 shrink-0">
                        <Phone size={11} /> WhatsApp
                      </a>
                    ) : <span className="text-[11px] text-muted-foreground shrink-0">keine Nummer</span>}
                  </div>
                ))}
              </div>
            )}
            <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold">Fertig</button>
          </div>
        ) : (
          <>
            {/* Live-Suche */}
            <div className="px-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Name, Mitgliedsnummer oder E-Mail suchen…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground"
                />
              </div>
              {treffer.length > 0 && (
                <div className="mt-1 rounded-lg border border-border bg-popover overflow-hidden max-h-56 overflow-y-auto">
                  {treffer.map(m => {
                    const em = (m.email || '').trim();
                    return (
                      <button key={m.id} onClick={() => hinzufuegen(m)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent active:bg-accent">
                        <UserPlus size={14} className="text-primary shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm text-foreground truncate">{m.vorname} {m.nachname}</span>
                          <span className="block text-[11px] text-muted-foreground truncate">
                            {m.mitgliedsnummer ? `#${m.mitgliedsnummer} · ` : ''}{em || 'keine Mailadresse'}
                          </span>
                        </span>
                        {m.user_id && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 shrink-0">App</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {suche.trim() && !treffer.length && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Keine Treffer{auswahl.length ? ' (bereits ausgewählt?)' : ''}.</p>
              )}
            </div>

            {/* Auswahl */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {auswahl.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Noch niemand ausgewählt.<br />
                  <span className="text-xs">Oben suchen und antippen, dann alle zusammen einladen.</span>
                </p>
              )}
              {auswahl.map(m => {
                const st = status(m);
                return (
                  <div key={m.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{m.vorname} {m.nachname}</p>
                      <p className={`text-[11px] truncate ${st.art === 'ok' ? 'text-muted-foreground' : 'text-yellow-400'}`}>
                        {st.text}
                      </p>
                    </div>
                    {!st.sendbar && st.art !== 'ohne' && <AlertCircle size={13} className="text-yellow-400 shrink-0" />}
                    <button onClick={() => entfernen(m.id)} className="p-1.5 text-muted-foreground hover:text-red-400 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Fußzeile */}
            <div className="p-4 pt-2 border-t border-border space-y-2">
              {fortschritt && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((fortschritt.done / fortschritt.total) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{fortschritt.done} / {fortschritt.total}{fortschritt.current ? ` · ${fortschritt.current}` : ''}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {auswahl.length} ausgewählt · {sendbar.length} einladbar
                </p>
                <button
                  onClick={senden}
                  disabled={laeuft || !sendbar.length}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
                >
                  {laeuft ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {laeuft ? 'Sendet…' : `${sendbar.length} einladen`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}