import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Check, X, Loader2, CircleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { nurAktiveAuftraege } from '@/lib/u18AuftragAktiv';

/**
 * Erziehungsaufträge, in denen ICH die Aufsicht übernehmen soll.
 * Erscheint auf dem Dashboard, damit die Begleitperson nicht erst
 * die Ausfahrt aufrufen muss.
 *
 * Wichtig: Übernommene Aufträge bleiben sichtbar (mit Datum), damit die
 * Begleitperson im Nachhinein abgeben kann, wenn sie z.B. krank wird.
 * Das Abgeben geht zurück an die Eltern, das Kind bleibt angemeldet.
 */
function datumKurz(iso) {
  if (!iso) return '';
  const d = String(iso).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : '';
}

export default function U18AuftraegeWidget() {
  const { user } = useAuth();
  // user._mitglied wird nur beim automatischen Verknüpfen gesetzt und fehlt bei
  // bestehenden Sessions. Deshalb die Mitglieds-ID am Profil nachschlagen.
  const [meinId, setMeinId] = useState(user?._mitglied?.id || null);

  useEffect(() => {
    if (meinId || !user) return;
    let abbruch = false;
    (async () => {
      try {
        const treffer = await base44.entities.Mitglied.filter({ user_id: user.id });
        let m = (treffer || [])[0];
        if (!m && user.email) {
          const perMail = await base44.entities.Mitglied.filter({ email: user.email });
          m = (perMail || [])[0];
        }
        if (!abbruch && m) setMeinId(m.id);
      } catch (e) { console.error('Mitglied zu Login nicht gefunden:', e); }
    })();
    return () => { abbruch = true; };
  }, [meinId, user]);
  const [eintraege, setEintraege] = useState([]);
  const [termine, setTermine] = useState({});
  const [busy, setBusy] = useState(null);

  const laden = async () => {
    if (!meinId) return;
    try {
      const alle = await base44.entities.U18Begleitung.filter({ begleit_mitglied_id: meinId });
      // Abgelehnte ausblenden, übernommene aber behalten (Rückgabe möglich).
      const ohneAbgelehnt = (alle || []).filter(e => e.status !== 'Abgelehnt');
      // Kind abgemeldet -> Auftrag ist hinfällig und verschwindet.
      const relevant = await nurAktiveAuftraege(ohneAbgelehnt);
      setEintraege(relevant);
      const map = {};
      for (const e of relevant) {
        if (e.typ === 'ausfahrt') {
          const a = await base44.entities.Ausfahrt.get(e.termin_id).catch(() => null);
          if (a) map[e.id] = `${a.titel || 'Ausfahrt'}${a.datum ? ` · ${datumKurz(a.datum)}` : ''}`;
        }
      }
      setTermine(map);
    } catch (e) { console.error('U18-Aufträge laden:', e); }
  };

  useEffect(() => { laden(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [meinId]);

  const entscheiden = async (id, aktion, grund) => {
    setBusy(id);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', { aktion, eintrag_id: id, grund });
      if (res?.error) throw new Error(res.error);
      if (aktion === 'ablehnen') {
        toast.success('Abgegeben. Die Eltern werden informiert und tragen jemand anderen ein.');
      } else {
        toast.success('Übernommen. Die Eltern müssen noch bestätigen.');
      }
      await laden();
    } catch (e) {
      toast.error(e.message || 'Aktion fehlgeschlagen.');
    } finally { setBusy(null); }
  };

  const abgeben = (e) => {
    const ok = window.confirm(
      `Aufsicht für ${e.u18_name || 'das Kind'} wirklich abgeben?\n\n` +
      'Die Eltern werden informiert und müssen jemand anderen eintragen. ' +
      'Das Kind bleibt angemeldet.'
    );
    if (ok) entscheiden(e.id, 'ablehnen', 'Kann doch nicht mitfahren');
  };

  const offen = eintraege.filter(e => !e.begleitung_bestaetigt_am);
  const uebernommen = eintraege.filter(e => !!e.begleitung_bestaetigt_am);

  if (eintraege.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-amber-400" />
        <h3 className="font-oswald uppercase tracking-wide text-white text-sm">Erziehungsauftrag</h3>
        <span className="ml-auto text-[11px] font-semibold text-amber-400">
          {offen.length > 0 ? `${offen.length} offen` : 'übernommen'}
        </span>
      </div>

      <div className="space-y-2">
        {/* Offene Aufträge: hier ist eine Entscheidung nötig */}
        {offen.map(e => (
          <div key={e.id} className="bg-background border border-border rounded-lg p-3">
            <p className="text-sm text-foreground">
              Du sollst <span className="font-semibold">{e.u18_name || 'ein Kind'}</span> beaufsichtigen.
            </p>
            {termine[e.id] && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{termine[e.id]}</p>
            )}
            <p className="text-[11px] text-amber-400/90 mt-1">
              Deine Zusage gilt nur für diese Veranstaltung.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => entscheiden(e.id, 'begleitung_bestaetigen')}
                disabled={busy === e.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[36px]"
              >
                {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Übernehmen
              </button>
              <button
                onClick={() => entscheiden(e.id, 'ablehnen')}
                disabled={busy === e.id}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50 min-h-[36px]"
              >
                <X size={12} /> Ablehnen
              </button>
            </div>
          </div>
        ))}

        {/* Übernommene Aufträge: bleiben sichtbar, Abgeben weiterhin möglich */}
        {uebernommen.map(e => {
          const allesBestaetigt = !!e.eltern_bestaetigt_am;
          return (
            <div key={e.id} className="bg-background border border-emerald-600/30 rounded-lg p-3">
              <p className="text-sm text-foreground flex items-start gap-1.5">
                <Check size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">{e.u18_name || 'Kind'}</span> beaufsichtigst du
                  {e.begleitung_bestaetigt_am ? ` seit ${datumKurz(e.begleitung_bestaetigt_am)}` : ''}.
                </span>
              </p>
              {termine[e.id] && (
                <p className="text-[11px] text-muted-foreground mt-0.5 ml-[22px]">{termine[e.id]}</p>
              )}
              <p className={`text-[11px] mt-1 ml-[22px] flex items-center gap-1 ${allesBestaetigt ? 'text-emerald-500' : 'text-amber-400'}`}>
                {allesBestaetigt ? (
                  <><Check size={11} /> Von den Eltern bestätigt</>
                ) : (
                  <><CircleAlert size={11} /> Elternbestätigung steht noch aus</>
                )}
              </p>
              <button
                onClick={() => abgeben(e)}
                disabled={busy === e.id}
                className="mt-2 ml-[22px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:text-red-400 hover:border-red-500/40 disabled:opacity-50 min-h-[36px]"
              >
                {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Kann doch nicht
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
