import { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, User, Calendar, Shirt, Briefcase } from 'lucide-react';

export default function Suche() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ mitglieder: [], veranstaltungen: [], haes: [] });
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q) => {
    setQuery(q);
    if (q.length < 2) { setResults({ mitglieder: [], veranstaltungen: [], haes: [] }); return; }
    setLoading(true);
    try {
      const [m, v, h] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Veranstaltung.list('datum', 200),
        base44.entities.Haes.list('haesnummer', 500),
      ]);
      const ql = q.toLowerCase();
      setResults({
        mitglieder: m.filter(x => `${x.vorname} ${x.nachname}`.toLowerCase().includes(ql) || x.email?.toLowerCase().includes(ql)).slice(0, 5),
        veranstaltungen: v.filter(x => x.titel?.toLowerCase().includes(ql) || x.ort?.toLowerCase().includes(ql)).slice(0, 5),
        haes: h.filter(x => x.haesnummer?.includes(q) || x.bezeichnung?.toLowerCase().includes(ql)).slice(0, 5),
      });
    } catch (e) {}
    setLoading(false);
  };

  const total = results.mitglieder.length + results.veranstaltungen.length + results.haes.length;

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-4">Suche</h1>

      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          autoFocus
          placeholder="Mitglieder, Veranstaltungen, Häsnummern..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-base"
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
          </div>
        )}
      </div>

      {query.length >= 2 && (
        <div className="space-y-4">
          {/* Mitglieder */}
          {results.mitglieder.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <User size={12} /> Mitglieder
              </h3>
              <div className="space-y-1.5">
                {results.mitglieder.map(m => (
                  <Link key={m.id} to={`/mitglieder/${m.id}`} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 transition-all">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                      <p className="text-xs text-muted-foreground">{m.mitgliedsstatus} · {m.ort || ''}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Veranstaltungen */}
          {results.veranstaltungen.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Calendar size={12} /> Veranstaltungen
              </h3>
              <div className="space-y-1.5">
                {results.veranstaltungen.map(v => (
                  <Link key={v.id} to={`/veranstaltungen/${v.id}`} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                      {v.datum?.slice(8, 10)}.
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{v.titel}</p>
                      <p className="text-xs text-muted-foreground">{v.typ} · {v.datum}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Häs */}
          {results.haes.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <Shirt size={12} /> Häs
              </h3>
              <div className="space-y-1.5">
                {results.haes.map(h => (
                  <div key={h.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Shirt size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-mono font-bold text-primary">#{h.haesnummer}</p>
                      <p className="text-xs text-muted-foreground">{h.bezeichnung || '–'} · {h.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {total === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Keine Ergebnisse für „{query}"</p>
            </div>
          )}
        </div>
      )}

      {query.length < 2 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Mindestens 2 Zeichen eingeben</p>
        </div>
      )}
    </div>
  );
}