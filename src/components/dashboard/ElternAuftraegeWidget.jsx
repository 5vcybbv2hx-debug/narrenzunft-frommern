import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Check, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Karte für Erziehungsberechtigte: "Wer fährt mit meinem Kind mit?"
 * Zeigt alle Erziehungsaufträge der eigenen Kinder, bei denen die
 * Elternbestätigung noch fehlt, und erlaubt das Bestätigen direkt hier.
 */
function datumKurz(iso) {
  if (!iso) return '';
  const d = String(iso).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : '';
}

export default function ElternAuftraegeWidget() {
  const { user } = useAuth();
  const [meinId, setMeinId] = useState(user?._mitglied?.id || null);
  const [offene, setOffene] = useState([]);
  const [termine, setTermine] = useState({});
  const [busy, setBusy] = useState(null);

  // Eigene Mitglieds-ID am Profil nachschlagen (user._mitglied fehlt bei bestehenden Sessions).
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

  const laden = async () => {
    if (!meinId) return;
    try {
      // Kinder ermitteln: beide Richtungen, damit auch einseitige Alt-Einträge greifen.
      const [hin, zurueck] = await Promise.all([
        base44.entities.Verwandtschaft.filter({ mitglied_id: meinId }).catch(() => []),
        base44.entities.Verwandtschaft.filter({ verwandter_id: meinId }).catch(() => []),
      ]);
      const kinderIds = [
        ...(hin || []).filter(v => v.beziehung === 'Kind').map(v => v.verwandter_id),
        ...(zurueck || []).filter(v => v.beziehung === 'Elternteil').map(v => v.mitglied_id),
      ].filter(Boolean);
      if (kinderIds.length === 0) { setOffene([]); return; }

      const alle = [];
      for (const kid of [...new Set(kinderIds)]) {
        const liste = await base44.entities.U18Begleitung.filter({ u18_mitglied_id: kid }).catch(() => []);
        alle.push(...(liste || []));
      }
      // Nur was noch die Elternbestätigung braucht und nicht abgelehnt ist.
      const wartend = alle.filter(e => e.status !== 'Abgelehnt' && !e.eltern_bestaetigt_am);
      setOffene(wartend);

      const map = {};
      for (const e of wartend) {
        if (e.typ === 'ausfahrt') {
          const a = await base44.entities.Ausfahrt.get(e.termin_id).catch(() => null);
          if (a) map[e.id] = { titel: a.titel || 'Ausfahrt', datum: a.datum };
        }
      }
      setTermine(map);
    } catch (e) { console.error('Eltern-Aufträge laden:', e); }
  };

  useEffect(() => { laden(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [meinId]);

  const bestaetigen = async (id) => {
    setBusy(id);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', { aktion: 'eltern_bestaetigen', eintrag_id: id });
      if (res?.error) throw new Error(res.error);
      toast.success('Bestätigt. Die Begleitperson ist jetzt verbindlich eingetragen.');
      await laden();
    } catch (e) {
      toast.error(e.message || 'Bestätigung fehlgeschlagen.');
    } finally { setBusy(null); }
  };

  if (offene.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-amber-400" />
        <h3 className="font-oswald uppercase tracking-wide text-white text-sm">Aufsicht bestätigen</h3>
        <span className="ml-auto text-[11px] font-semibold text-amber-400">{offene.length} offen</span>
      </div>

      <div className="space-y-2">
        {offene.map(e => {
          const t = termine[e.id];
          return (
            <div key={e.id} className="bg-background border border-border rounded-lg p-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{e.begleit_name || 'Eine Begleitperson'}</span> fährt mit{' '}
                <span className="font-semibold">{e.u18_name || 'deinem Kind'}</span> mit.
              </p>
              {t && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t.titel}{t.datum ? ` · ${datumKurz(t.datum)}` : ''}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Du bestätigst damit, dass diese Person die Aufsicht übernimmt.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  onClick={() => bestaetigen(e.id)}
                  disabled={busy === e.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[36px]"
                >
                  {busy === e.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Bestätigen
                </button>
                {e.typ === 'ausfahrt' && (
                  <Link
                    to={`/ausfahrten/${e.termin_id}`}
                    className="inline-flex items-center gap-0.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    Andere Aufsicht eintragen <ChevronRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
