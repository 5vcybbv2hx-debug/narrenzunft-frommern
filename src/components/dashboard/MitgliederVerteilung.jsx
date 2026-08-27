import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';

const STATUS_COLORS = {
  'Aktiv': 'bg-green-500/15 text-green-400',
  'Passiv': 'bg-gray-500/15 text-gray-400',
  'Passiv mit Häs': 'bg-blue-500/15 text-blue-400',
  'Leihäs': 'bg-teal-500/15 text-teal-400',
  'Jugendliche 11-14': 'bg-yellow-500/15 text-yellow-400',
  'Jungaktive 15-17': 'bg-orange-500/15 text-orange-400',
  'Kinder 4-10': 'bg-purple-500/15 text-purple-400',
  'Kleinkind 0-3': 'bg-pink-500/15 text-pink-400',
  'Ehrenmitglied': 'bg-amber-500/15 text-amber-400',
  'Verstorben': 'bg-neutral-700/40 text-neutral-400',
};

export default function MitgliederVerteilung({ total, statusVerteilung, gruppenVerteilung }) {
  const maxGruppe = Math.max(1, ...gruppenVerteilung.map(g => g.count));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h3 className="font-oswald font-semibold text-foreground text-sm tracking-wide">Mitglieder</h3>
        </div>
        <p className="text-xs text-muted-foreground">{total} gesamt</p>
      </div>
      <div className="p-4 space-y-4">
        {/* Status-Verteilung */}
        <div>
          <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {statusVerteilung.map(s => (
              <span key={s.status} className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-secondary text-muted-foreground'}`}>
                {s.status}: <strong className="font-bold">{s.count}</strong>
              </span>
            ))}
          </div>
        </div>
        {/* Häsgruppen-Verteilung */}
        {gruppenVerteilung.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Häsgruppen</p>
            <div className="space-y-1.5">
              {gruppenVerteilung.slice(0, 8).map(g => (
                <div key={g.name} className="flex items-center gap-2">
                  <span className="text-sm text-foreground truncate flex-1 min-w-0">{g.name}</span>
                  <div className="w-16 sm:w-24 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(g.count / maxGruppe) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums w-6 text-right shrink-0">{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 pb-4">
        <Link
          to="/mitglieder"
          className="flex items-center justify-center gap-2 w-full py-3 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Alle Mitglieder ansehen <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}