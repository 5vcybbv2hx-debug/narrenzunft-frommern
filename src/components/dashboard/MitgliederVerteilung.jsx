import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';

const STATUS_COLORS = {
  'Aktiv': 'bg-green-500/15 text-green-400 hover:bg-green-500/25',
  'Passiv': 'bg-gray-500/15 text-gray-400 hover:bg-gray-500/25',
  'Passiv mit Häs': 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25',
  'Leihäs': 'bg-teal-500/15 text-teal-400 hover:bg-teal-500/25',
  'Jugendliche 11-14': 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25',
  'Jungaktive 15-17': 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25',
  'Kinder 4-10': 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25',
  'Kleinkind 0-3': 'bg-pink-500/15 text-pink-400 hover:bg-pink-500/25',
  'Ehrenmitglied': 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25',
  'Verstorben': 'bg-border/40 text-muted-foreground hover:bg-border/60',
};

export default function MitgliederVerteilung({ total, statusVerteilung, gruppenVerteilung }) {

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Link to="/mitglieder" className="flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-secondary/40 transition-colors group">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" />
          <h3 className="font-oswald font-semibold text-foreground text-sm tracking-wide">Mitglieder</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">{total} gesamt</p>
          <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </Link>
      <div className="p-4 space-y-4">
        {/* Status-Verteilung */}
        <div>
          <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {statusVerteilung.map(s => (
              <Link
                key={s.status}
                to={`/mitglieder?status=${encodeURIComponent(s.status)}`}
                className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${STATUS_COLORS[s.status] || 'bg-secondary text-muted-foreground hover:bg-secondary/70'}`}
              >
                {s.status}: <strong className="font-bold">{s.count}</strong>
              </Link>
            ))}
          </div>
        </div>
        {/* Häsgruppen-Verteilung */}
        {gruppenVerteilung.length > 0 && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Häsgruppen</p>
            <div className="space-y-1.5">
              {gruppenVerteilung.slice(0, 8).map(g => {
                const gesamt = g.aktiv + g.passiv;
                const aktivPct = gesamt > 0 ? (g.aktiv / gesamt) * 100 : 0;
                return (
                  <Link
                    key={g.id}
                    to={`/sparte/${g.id}`}
                    className="block space-y-1 p-1.5 -m-1.5 rounded-lg hover:bg-secondary/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">{g.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        <strong className="text-green-400">{g.aktiv}</strong> aktiv · <strong className="text-gray-400">{g.passiv}</strong> passiv
                      </span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
                      <div className="h-full bg-green-500" style={{ width: `${aktivPct}%` }} />
                      <div className="h-full bg-gray-500" style={{ width: `${100 - aktivPct}%` }} />
                    </div>
                  </Link>
                );
              })}
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