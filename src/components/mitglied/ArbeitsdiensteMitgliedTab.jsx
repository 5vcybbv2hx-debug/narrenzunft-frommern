import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Briefcase, Clock, MapPin, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function ArbeitsdiensteMitgliedTab({ mitgliedId }) {
  const [zuweisungen, setZuweisungen] = useState([]);
  const [dienste, setDienste] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mitgliedId) return;
    loadData();
  }, [mitgliedId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [z, d] = await Promise.all([
        base44.entities.ArbeitsdienstZuweisung.filter({ mitglied_id: mitgliedId }),
        base44.entities.Arbeitsdienst.list('datum', 500),
      ]);
      setZuweisungen(z);
      setDienste(d);
    } catch (e) {}
    setLoading(false);
  };

  const getDienst = (id) => dienste.find(d => d.id === id);

  // Statistiken
  const erledigt = zuweisungen.filter(z => z.status === 'Erledigt').length;
  const bestaetigt = zuweisungen.filter(z => z.status === 'Bestätigt').length;
  const abgesagt = zuweisungen.filter(z => z.status === 'Abgesagt').length;
  const offen = zuweisungen.filter(z => z.status === 'Offen').length;

  const historie = zuweisungen
    .map(z => ({ ...z, dienst: getDienst(z.arbeitsdienst_id) }))
    .filter(z => z.dienst)
    .sort((a, b) => (b.dienst.datum || '').localeCompare(a.dienst.datum || ''));

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Statistik */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{erledigt}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Erledigt</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{bestaetigt}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bestätigt</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{offen}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Offen</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{abgesagt}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Abgesagt</p>
        </div>
      </div>

      {/* Liste */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Zugewiesene Dienste ({zuweisungen.length})
        </h3>
        {historie.length === 0 ? (
          <div className="text-center py-10">
            <Briefcase size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Arbeitsdienste zugewiesen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historie.map(z => {
              const d = z.dienst;
              return (
                <div key={z.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                  z.status === 'Erledigt' ? 'bg-green-500/5 border-green-500/20' :
                  z.status === 'Abgesagt' ? 'bg-red-500/5 border-red-500/20 opacity-60' :
                  'bg-card border-border'
                }`}>
                  <div className="w-12 h-12 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {format(new Date(d.datum), 'MMM', { locale: de })}
                    </span>
                    <span className="text-base font-bold text-foreground leading-none mt-0.5">
                      {format(new Date(d.datum), 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {d.uhrzeit && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Clock size={10} /> {d.uhrzeit}
                        </span>
                      )}
                      {d.ort && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin size={10} /> {d.ort}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        z.status === 'Erledigt' ? 'bg-green-500/20 text-green-400' :
                        z.status === 'Bestätigt' ? 'bg-blue-500/20 text-blue-400' :
                        z.status === 'Abgesagt' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>{z.status}</span>
                    </div>
                    {z.notizen && <p className="text-xs text-muted-foreground mt-1">{z.notizen}</p>}
                  </div>
                  {z.status === 'Erledigt' && <Check size={16} className="text-green-400 shrink-0" />}
                  {z.status === 'Abgesagt' && <X size={16} className="text-red-400 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}