import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { HelpCircle, BellRing, Users, UserPlus, CalendarClock, Trash2 } from 'lucide-react';

/**
 * Arbeitsdienst-Abfrage mit Frist.
 *
 * Mitglieder: "Kommst du?" -> Ja / Vielleicht / Nein (mit Zeitstempel),
 * beantwortbar bis einschließlich Frist.
 * Verwaltung: Abfrage starten (Frist setzen, optional Push an alle aktiven
 * Mitglieder), Auswertung (Ja/Nein/Vielleicht/Offen) und "Zusagen übernehmen"
 * (erzeugt Zuweisungen aus Ja-Antworten, ohne bestehende Einteilungen zu duplizieren).
 */
const heute = () => new Date().toISOString().split('T')[0];

export default function DienstAbfrage({ dienst, kannVerwalten, mitglieder, myMitglied, bereitsEingeteiltIds, onDatenGeaendert }) {
  const [antworten, setAntworten] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pushSendet, setPushSendet] = useState(false);
  const [frist, setFrist] = useState('');

  const fristOffen = !!dienst.abfrage_frist && heute() <= dienst.abfrage_frist;

  const laden = useCallback(async () => {
    try {
      const a = await base44.entities.ArbeitsdienstAntwort.filter({ arbeitsdienst_id: dienst.id });
      setAntworten(a || []);
    } catch (e) { console.error('Abfrage laden:', e); }
  }, [dienst.id]);

  useEffect(() => {
    laden();
    setFrist(dienst.abfrage_frist || '');
  }, [laden, dienst.abfrage_frist]);

  const meineAntwort = myMitglied ? antworten.find(a => a.mitglied_id === myMitglied.id) : null;

  const antwortenAls = async (wert) => {
    setBusy(true);
    try {
      if (meineAntwort) {
        await base44.entities.ArbeitsdienstAntwort.update(meineAntwort.id, { antwort: wert });
      } else {
        await base44.entities.ArbeitsdienstAntwort.create({
          arbeitsdienst_id: dienst.id, mitglied_id: myMitglied.id, antwort: wert,
        });
      }
      await laden();
      toast.success(`Antwort gespeichert: ${wert}`);
    } catch (e) {
      toast.error(e.message || 'Antwort konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  };

  const fristStarten = async () => {
    if (!frist) { toast.error('Bitte eine Frist wählen.'); return; }
    setBusy(true);
    try {
      await base44.entities.Arbeitsdienst.update(dienst.id, { abfrage_frist: frist });
      toast.success(`Abfrage aktiv bis ${frist}.`);
      onDatenGeaendert?.();
    } catch (e) {
      toast.error(e.message || 'Abfrage konnte nicht gestartet werden.');
    } finally { setBusy(false); }
  };

  const fristStoppen = async () => {
    setBusy(true);
    try {
      await base44.entities.Arbeitsdienst.update(dienst.id, { abfrage_frist: '' });
      toast.success('Abfrage geschlossen.');
      onDatenGeaendert?.();
    } catch (e) {
      toast.error(e.message || 'Abfrage konnte nicht geschlossen werden.');
    } finally { setBusy(false); }
  };

  const pushStarten = async () => {
    if (!dienst.abfrage_frist) { toast.error('Bitte erst die Frist setzen.'); return; }
    setPushSendet(true);
    try {
      const res = await base44.functions.invoke('sendNotification', {
        aktion: 'senden', empfaenger: 'aktive',
        titel: 'Arbeitsdienst-Abfrage',
        nachricht: `„${dienst.titel}" am ${dienst.datum}${dienst.uhrzeit ? ', ' + dienst.uhrzeit + ' Uhr' : ''}. Kommst du? Antwort bis ${dienst.abfrage_frist} in der App.`,
        route: '/dienste',
      });
      if (res?.error) throw new Error(res.error);
      toast.success('Push an alle aktiven Mitglieder gesendet.');
    } catch (e) {
      toast.error(e.message || 'Push fehlgeschlagen.');
    } finally { setPushSendet(false); }
  };

  const zusaegenUebernehmen = async () => {
    const ja = antworten.filter(a => a.antwort === 'Ja');
    const neu = ja.filter(a => !(bereitsEingeteiltIds || []).includes(a.mitglied_id));
    if (neu.length === 0) { toast.info('Keine neuen Zusagen zu übernehmen.'); return; }
    setBusy(true);
    try {
      for (const a of neu) {
        await base44.entities.ArbeitsdienstZuweisung.create({
          arbeitsdienst_id: dienst.id, mitglied_id: a.mitglied_id, status: 'Offen',
        });
      }
      toast.success(`${neu.length} Zuweisung${neu.length > 1 ? 'en' : ''} aus Zusagen erstellt.`);
      onDatenGeaendert?.();
    } catch (e) {
      toast.error(e.message || 'Übernehmen fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const nameVon = (id) => {
    const m = (mitglieder || []).find(x => x.id === id);
    return m ? `${m.vorname} ${m.nachname?.[0] || ''}.` : '–';
  };

  const zaehler = {
    Ja: antworten.filter(a => a.antwort === 'Ja').length,
    Nein: antworten.filter(a => a.antwort === 'Nein').length,
    Vielleicht: antworten.filter(a => a.antwort === 'Vielleicht').length,
  };

  // ═══ Mitglieder-Ansicht ═══
  if (!kannVerwalten) {
    if (!dienst.abfrage_frist) return null;
    if (!myMitglied) return null;
    const erlaubt = fristOffen;
    return (
      <div className={`mt-2 pt-2 border-t border-border/50 ${erlaubt ? '' : 'opacity-70'}`}>
        <p className="text-[10px] text-muted-foreground mb-1.5">
          Abfrage{erlaubt ? ` (bis ${dienst.abfrage_frist})` : ` – Frist abgelaufen (${dienst.abfrage_frist})`}:
        </p>
        <div className="flex gap-2">
          {(['Ja', 'Vielleicht', 'Nein']).map(wert => (
            <button
              key={wert}
              onClick={() => antwortenAls(wert)}
              disabled={busy || !erlaubt}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                meineAntwort?.antwort === wert
                  ? wert === 'Ja' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : wert === 'Nein' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
              } disabled:opacity-50`}
            >
              {wert === 'Ja' ? '✓ ' : wert === 'Nein' ? '✗ ' : '? '}{wert}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══ Verwaltungs-Ansicht ═══
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <HelpCircle size={11} className="text-primary" />
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Abfrage</p>
        {dienst.abfrage_frist && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${fristOffen ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
            bis {dienst.abfrage_frist}{fristOffen ? '' : ' · vorbei'}
          </span>
        )}
      </div>

      {!dienst.abfrage_frist ? (
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarClock size={11} /> Frist:</label>
          <input type="date" value={frist} onChange={e => setFrist(e.target.value)}
            className="px-2 py-1 rounded-lg bg-secondary border border-border text-[11px] text-foreground" />
          <button onClick={fristStarten} disabled={busy || !frist}
            className="px-2 py-1 rounded-lg bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-50">
            Starten
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            <Users size={10} className="inline mr-0.5" />{zaehler.Ja} Ja · {zaehler.Vielleicht} vielleicht · {zaehler.Nein} Nein
          </span>
          <button onClick={pushStarten} disabled={pushSendet}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-medium hover:bg-primary/25 disabled:opacity-50">
            <BellRing size={10} /> Push
          </button>
          <button onClick={zusaegenUebernehmen} disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/15 text-green-400 text-[11px] font-medium hover:bg-green-500/25 disabled:opacity-50">
            <UserPlus size={10} /> Zusagen übernehmen
          </button>
          <button onClick={fristStoppen} disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-[11px] hover:text-red-400">
            <Trash2 size={10} /> Schließen
          </button>
        </div>
      )}

      {dienst.abfrage_frist && antworten.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {antworten.map(a => (
            <span key={a.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              a.antwort === 'Ja' ? 'bg-green-500/20 text-green-400'
              : a.antwort === 'Nein' ? 'bg-red-500/10 text-red-400'
              : 'bg-yellow-500/20 text-yellow-400'}`}>
              {nameVon(a.mitglied_id)}: {a.antwort}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
