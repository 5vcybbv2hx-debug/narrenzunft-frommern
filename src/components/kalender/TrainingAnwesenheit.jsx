import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { Check, Minus, BellRing, RefreshCw } from 'lucide-react';

/**
 * Training-Anwesenheit (nur für Verantwortliche der Gruppe / Vorstand) plus
 * Push-Abfrage ("Wer kommt?") — im Termin-Card-Bereich des Trainings.
 * Mitglieder melden sich selbst an/ab (bestehende Kalender-Anmeldung mit
 * Zeitstempel); die Anwesenheit haken Verantwortliche hier ab.
 */
export default function TrainingAnwesenheit({ termin, myMitglied }) {
  const { user } = useAuth();
  const [teilnehmer, setTeilnehmer] = useState([]);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [busy, setBusy] = useState(null);
  const [pushSendet, setPushSendet] = useState(false);
  const [laden, setLaden] = useState(true);

  const istVorstand = ['admin', 'vorstand', 'stellv_vorstand'].includes(user?.role);
  const gruppenChef = myMitglied && (termin.verantwortliche_ids || []).includes(myMitglied.id);
  const darfVerwalten = istVorstand || gruppenChef || user?.role === 'spartenleiter';

  const [namen, setNamen] = useState({}); // mitglied_id -> Name

  const ladenCb = useCallback(async () => {
    if (!termin.haesgruppe_id) { setLaden(false); return; }
    setLaden(true);
    try {
      const [t, a, ms] = await Promise.all([
        base44.entities.GruppenTeilnehmer.filter({ haesgruppe_id: termin.haesgruppe_id }),
        base44.entities.KalenderAnmeldung.filter({ termin_id: termin.id }),
        base44.entities.Mitglied.list('nachname', 1000),
      ]);
      setTeilnehmer((t || []).filter(x => x.aktiv !== false && x.mitglied_id));
      setAnmeldungen(a || []);
      const map = {};
      (ms || []).forEach(m => { map[m.id] = [m.vorname, m.nachname].filter(Boolean).join(' '); });
      setNamen(map);
    } catch (e) { console.error('Training-Anwesenheit:', e); }
    setLaden(false);
  }, [termin.id, termin.haesgruppe_id]);

  useEffect(() => { ladenCb(); }, [ladenCb]);

  const anwesenheitSetzen = async (mitgliedId, anwesend) => {
    setBusy(mitgliedId);
    try {
      const res = await base44.functions.invoke('verwalteTrainingAnwesenheit', {
        aktion: 'setzen', termin_id: termin.id, mitglied_id: mitgliedId, anwesend,
      });
      if (res?.error) throw new Error(res.error);
      await ladenCb();
    } catch (e) {
      toast.error(e.message || 'Anwesenheit konnte nicht gespeichert werden.');
    } finally { setBusy(null); }
  };

  const pushAbfrageSenden = async () => {
    setPushSendet(true);
    try {
      const res = await base44.functions.invoke('sendNotification', {
        aktion: 'senden', empfaenger: 'gruppe', haesgruppe_id: termin.haesgruppe_id,
        titel: `Training ${termin.startzeit ? termin.startzeit + ' Uhr' : ''}`.trim(),
        nachricht: `„${termin.titel}" am ${new Date(termin.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}${termin.startzeit ? ', ' + termin.startzeit + ' Uhr' : ''}${termin.ort ? ', ' + termin.ort : ''}. Kommst du? Bitte kurz an- oder abmelden.`,
        route: '/kalender',
      });
      if (res?.error) throw new Error(res.error);
      toast.success('Push-Abfrage an die Gruppe gesendet.');
    } catch (e) {
      toast.error(e.message || 'Push-Abfrage fehlgeschlagen.');
    } finally { setPushSendet(false); }
  };

  if (!termin.haesgruppe_id) return null;

  if (!darfVerwalten) return null;

  const anw = new Map(anmeldungen.map(a => [a.mitglied_id, a]));
  const anwesendCount = anmeldungen.filter(a => a.anwesend === true).length;
  const abgemeldetCount = anmeldungen.filter(a => ['Abgemeldet', 'Abgesagt'].includes(a.status)).length;

  const nameVon = (mitgliedId) => namen[mitgliedId] || 'Unbekannt';

  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-3 mt-2" aria-label="Anwesenheit">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Anwesenheit</h4>
          <span className="text-[10px] text-muted-foreground">{anwesendCount} anwesend · {abgemeldetCount} abgemeldet</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={ladenCb} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10" title="Neu laden">
            <RefreshCw size={12} />
          </button>
          <button
            onClick={pushAbfrageSenden}
            disabled={pushSendet}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-[11px] font-medium hover:bg-primary/25 disabled:opacity-50"
            title="Fragt per Push alle Gruppen-Mitglieder ab, ob sie kommen"
          >
            <BellRing size={11} /> Push-Abfrage
          </button>
        </div>
      </div>

      {laden ? (
        <p className="text-xs text-muted-foreground">Lade…</p>
      ) : teilnehmer.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine aktiven Teilnehmer:innen in dieser Gruppe.</p>
      ) : (
        <div className="space-y-1">
          {teilnehmer.map(t => {
            const a = anw.get(t.mitglied_id);
            const status = a ? a.status : null;
            const istAnwesend = a?.anwesend === true;
            return (
              <div key={t.mitglied_id} className="flex items-center gap-2 text-xs">
                <span className="flex-1 min-w-0 truncate text-foreground">{nameVon(t.mitglied_id)}</span>
                {status && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    ['Angemeldet'].includes(status) ? 'bg-green-500/20 text-green-400'
                    : ['Abgemeldet', 'Abgesagt'].includes(status) ? 'bg-red-500/10 text-red-400'
                    : 'bg-secondary text-muted-foreground'}`}>
                    {status}
                  </span>
                )}
                <button
                  onClick={() => anwesenheitSetzen(t.mitglied_id, !istAnwesend)}
                  disabled={busy === t.mitglied_id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium border disabled:opacity-40 ${
                    istAnwesend
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40'
                  }`}
                >
                  {istAnwesend ? <Check size={11} /> : <Minus size={11} />} {istAnwesend ? 'dabei' : 'fehlt'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
