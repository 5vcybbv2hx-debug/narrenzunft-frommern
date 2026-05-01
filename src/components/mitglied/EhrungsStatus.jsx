/**
 * Ehrungsstatus-Komponente für das Mitgliederprofil.
 * Zeigt alle berechneten Ehrungsdaten für ein einzelnes Mitglied.
 */
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  berechneEhrungsstatusGesamt,
} from '@/lib/ehrungsLogik';
import { Award, AlertTriangle, Star, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';

function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value ?? '–'}
      </span>
    </div>
  );
}

export default function EhrungsStatus({ mitglied }) {
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [ehrungen, setEhrungen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mitglied?.id) return;
    loadData();
  }, [mitglied?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [t, v, e] = await Promise.all([
        base44.entities.Teilnahme.filter({ mitglied_id: mitglied.id }),
        base44.entities.Veranstaltung.list('datum', 500),
        base44.entities.Ehrung.filter({ mitglied_id: mitglied.id }),
      ]);
      setTeilnahmen(t);
      setVeranstaltungen(v);
      setEhrungen(e);
    } catch (err) {}
    setLoading(false);
  };

  const status = useMemo(() => {
    if (loading || !mitglied) return null;
    return berechneEhrungsstatusGesamt(mitglied, teilnahmen, veranstaltungen, ehrungen);
  }, [mitglied, teilnahmen, veranstaltungen, ehrungen, loading]);

  if (loading) return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Award size={16} className="text-primary" />
        <h2 className="font-semibold text-foreground">Ehrungen & Teilnahmen</h2>
      </div>
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-secondary rounded w-3/4" />
        <div className="h-4 bg-secondary rounded w-1/2" />
      </div>
    </div>
  );

  if (!status) return null;

  const { mitgliedsEhrungen, jugendUmzuege, umzugsEhrungen, warnungen, erwachsenenUmzuegeDigital, umzuegeHistorisch } = status;
  const verliehene = ehrungen.filter(e => e.status === 'Verliehen');
  const istKindOderJugend = mitglied?.mitgliedsstatus &&
    ['Kinder 4-10', 'Kleinkind 0-3', 'Jugendliche 11-14', 'Jungaktive 15-17'].includes(mitglied.mitgliedsstatus);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Award size={16} className="text-primary" /> Ehrungen & Teilnahmen
      </h2>

      {/* Warnungen */}
      {warnungen.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {warnungen.map((w, i) => (
            <div key={i} className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* Mitgliedsjahre */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Star size={11} /> Mitgliedsjahre
        </p>
        <div className="bg-secondary/50 rounded-lg px-3">
          <InfoRow
            label="Anrechenbare Jahre"
            value={mitgliedsEhrungen.jahre !== null ? `${mitgliedsEhrungen.jahre} Jahre` : 'Nicht berechenbar'}
            highlight={mitgliedsEhrungen.jahre !== null}
          />
          {mitgliedsEhrungen.letzteStufe && (
            <InfoRow label="Letzte Ehrungsstufe" value={`${mitgliedsEhrungen.letzteStufe} Jahre`} />
          )}
          {mitgliedsEhrungen.naechsteStufe && (
            <InfoRow
              label="Nächste Ehrung"
              value={`${mitgliedsEhrungen.naechsteStufe} Jahre (noch ${mitgliedsEhrungen.jahreZurNaechsten} J.)`}
            />
          )}
          {mitgliedsEhrungen.faelligeStufen.length > 0 && (
            <div className="py-2 border-b border-border last:border-0">
              <p className="text-xs text-muted-foreground mb-1.5">Fällig</p>
              <div className="flex gap-1 flex-wrap">
                {mitgliedsEhrungen.faelligeStufen.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                    ⭐ {s} Jahre
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Umzüge */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <TrendingUp size={11} /> Umzugsteilnahmen
        </p>
        <div className="bg-secondary/50 rounded-lg px-3">
          <InfoRow label="Jugend-Umzüge (unter 18)" value={jugendUmzuege} />
          {umzuegeHistorisch > 0 && (
            <InfoRow label="Historisch (vor App)" value={umzuegeHistorisch} />
          )}
          <InfoRow label="Digital erfasst (ab 18)" value={erwachsenenUmzuegeDigital} />
          <InfoRow
            label="Gesamt Erwachsenen-Umzüge"
            value={umzugsEhrungen.erwachsenenUmzuege}
            highlight
          />
          {istKindOderJugend && (
            <div className="py-2">
              <p className="text-xs text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2">
                ℹ️ Erwachsenen-Zähler startet ab dem 18. Geburtstag bei 0
              </p>
            </div>
          )}
          {umzugsEhrungen.letzteStufe && (
            <InfoRow label="Letzte Ehrungsstufe" value={`${umzugsEhrungen.letzteStufe} Umzüge`} />
          )}
          {umzugsEhrungen.naechsteStufe && (
            <InfoRow
              label="Nächste Ehrung"
              value={`${umzugsEhrungen.naechsteStufe} Umzüge (noch ${umzugsEhrungen.fehlendeBisNaechste})`}
            />
          )}
          {umzugsEhrungen.faelligeStufen.length > 0 && (
            <div className="py-2 border-b border-border last:border-0">
              <p className="text-xs text-muted-foreground mb-1.5">Fällig</p>
              <div className="flex gap-1 flex-wrap">
                {umzugsEhrungen.faelligeStufen.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                    🎪 {s} Umzüge
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verliehene Ehrungen */}
      {verliehene.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Award size={11} /> Bereits verliehen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {verliehene.map(e => (
              <span key={e.id} className="text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 font-medium">
                ✓ {e.typ === 'Mitgliedsjahre' ? `${e.wert} Jahre` : `${e.wert} Umzüge`}
                {e.datum ? ` (${new Date(e.datum).getFullYear()})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}