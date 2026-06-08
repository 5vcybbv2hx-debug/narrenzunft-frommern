import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Calendar, Check, Bus, Clock, MapPin, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AktivitaetTab({ mitgliedId }) {
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mitgliedId) return;
    loadData();
  }, [mitgliedId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const t = await base44.entities.Teilnahme.filter({ mitglied_id: mitgliedId });
      setTeilnahmen(t);
      const veranstaltungIds = [...new Set(t.map(x => x.veranstaltung_id).filter(Boolean))];
      if (veranstaltungIds.length > 0) {
        const v = await Promise.all(veranstaltungIds.map(id => base44.entities.Veranstaltung.filter({ id })));
        setVeranstaltungen(v.flat());
      }
    } catch (e) {}
    setLoading(false);
  };

  const getVeranstaltung = (id) => veranstaltungen.find(v => v.id === id);

  // Statistiken
  const angemeldet = teilnahmen.filter(t => t.status !== 'Abgesagt').length;
  const anwesend = teilnahmen.filter(t => t.status === 'Anwesend').length;
  const abgesagt = teilnahmen.filter(t => t.status === 'Abgesagt').length;
  const mitBus = teilnahmen.filter(t => t.bus && t.status !== 'Abgesagt').length;

  // Chronologisch sortierte Teilnahmen mit Veranstaltungsdaten
  const historie = teilnahmen
    .map(t => ({ ...t, veranstaltung: getVeranstaltung(t.veranstaltung_id) }))
    .filter(t => t.veranstaltung)
    .sort((a, b) => (b.veranstaltung.datum || '').localeCompare(a.veranstaltung.datum || ''));

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Statistik-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{angemeldet}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Angemeldet</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{anwesend}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Anwesend ✓</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{abgesagt}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Abgesagt</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{mitBus}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Mit Bus</p>
        </div>
      </div>

      {/* Teilnahmequote */}
      {angemeldet > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <TrendingUp size={14} /> Anwesenheitsquote
            </span>
            <span className="text-sm font-bold text-foreground">
              {Math.round((anwesend / angemeldet) * 100)}%
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-green-400 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((anwesend / angemeldet) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Veranstaltungshistorie */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Veranstaltungshistorie ({historie.length})
        </h3>
        {historie.length === 0 ? (
          <div className="text-center py-10">
            <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Veranstaltungen gefunden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historie.map(t => {
              const v = t.veranstaltung;
              return (
                <div key={t.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  t.status === 'Anwesend' ? 'bg-green-500/5 border-green-500/20' :
                  t.status === 'Abgesagt' ? 'bg-red-500/5 border-red-500/20 opacity-60' :
                  'bg-card border-border'
                }`}>
                  {/* Datum */}
                  <div className="w-12 h-12 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {format(new Date(v.datum), 'MMM', { locale: de })}
                    </span>
                    <span className="text-base font-bold text-foreground leading-none mt-0.5">
                      {format(new Date(v.datum), 'd')}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{v.titel}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {v.ort && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin size={10} /> {v.ort}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        t.status === 'Anwesend' ? 'bg-green-500/20 text-green-400' :
                        t.status === 'Abgesagt' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{t.status}</span>
                      {t.bus && <span className="text-xs text-blue-400 flex items-center gap-0.5"><Bus size={10} /> Bus</span>}
                    </div>
                  </div>
                  {t.status === 'Anwesend' && (
                    <Check size={16} className="text-green-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}