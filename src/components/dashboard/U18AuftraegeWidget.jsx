import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Erziehungsaufträge, in denen ICH die Aufsicht übernehmen soll.
 * Erscheint auf dem Dashboard, damit die Begleitperson nicht erst
 * die Ausfahrt aufrufen muss. Bestätigen oder Ablehnen direkt hier.
 */
export default function U18AuftraegeWidget() {
  const { user } = useAuth();
  const meinId = user?._mitglied?.id;
  const [eintraege, setEintraege] = useState([]);
  const [termine, setTermine] = useState({});
  const [busy, setBusy] = useState(null);

  const laden = async () => {
    if (!meinId) return;
    try {
      const alle = await base44.entities.U18Begleitung.filter({ begleit_mitglied_id: meinId });
      const offen = (alle || []).filter(e => e.status !== 'Bestätigt' && e.status !== 'Abgelehnt');
      setEintraege(offen);
      const map = {};
      for (const e of offen) {
        if (e.typ === 'ausfahrt') {
          const a = await base44.entities.Ausfahrt.get(e.termin_id).catch(() => null);
          if (a) map[e.id] = `${a.titel || 'Ausfahrt'}${a.datum ? ` · ${a.datum.split('-').reverse().join('.')}` : ''}`;
        }
      }
      setTermine(map);
    } catch (e) { console.error('U18-Aufträge laden:', e); }
  };

  useEffect(() => { laden(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [meinId]);

  const entscheiden = async (id, aktion) => {
    setBusy(id);
    try {
      const res = await base44.functions.invoke('verwalteU18Begleitung', { aktion, eintrag_id: id });
      if (res?.error) throw new Error(res.error);
      toast.success(aktion === 'ablehnen' ? 'Abgelehnt. Die Eltern wurden informiert.' : 'Bestätigt. Danke!');
      await laden();
    } catch (e) {
      toast.error(e.message || 'Aktion fehlgeschlagen.');
    } finally { setBusy(null); }
  };

  if (eintraege.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-amber-400" />
        <h3 className="font-oswald uppercase tracking-wide text-white text-sm">Erziehungsauftrag</h3>
        <span className="ml-auto text-[11px] font-semibold text-amber-400">{eintraege.length} offen</span>
      </div>
      <div className="space-y-2">
        {eintraege.map(e => (
          <div key={e.id} className="bg-background border border-border rounded-lg p-3">
            <p className="text-sm text-foreground">
              Du sollst <span className="font-semibold">{e.u18_name || 'ein Kind'}</span> beaufsichtigen.
            </p>
            {termine[e.id] && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{termine[e.id]}</p>
            )}
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
      </div>
    </div>
  );
}
