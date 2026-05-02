import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Loader2, Users, Shirt, Briefcase, AlertCircle } from 'lucide-react';

export default function SecureSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ mitglieder: [], haes: [], dienste: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults({ mitglieder: [], haes: [], dienste: [] });
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => search(), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, h, d] = await Promise.all([
        base44.functions.invoke('searchMitgliedSicher', { query }),
        base44.functions.invoke('searchHaesSicher', { query }),
        base44.functions.invoke('searchArbeitsdiensteSicher', { query }),
      ]);
      setResults({
        mitglieder: m.data?.results || [],
        haes: h.data?.results || [],
        dienste: d.data?.results || [],
      });
      setOpen(true);
    } catch (err) {
      setError('Suche fehlgeschlagen');
      console.error(err);
    }
    setLoading(false);
  };

  const total = results.mitglieder.length + results.haes.length + results.dienste.length;

  return (
    <div className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
        <input
          type="text"
          placeholder="Suche (min. 2 Zeichen)..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => total > 0 && setOpen(true)}
          className="w-full pl-8 pr-8 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-96 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {total === 0 && !loading && query.length >= 2 && (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Ergebnisse gefunden</p>
          )}

          {/* Mitglieder */}
          {results.mitglieder.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-secondary/30 border-b border-border flex items-center gap-2">
                <Users size={12} /> Mitglieder ({results.mitglieder.length})
              </div>
              {results.mitglieder.map(m => (
                <a
                  key={m.id}
                  href={`/mitglieder/${m.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {m.vorname?.[0]}{m.nachname?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{m.vorname} {m.nachname}</p>
                    <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                  </div>
                </a>
              ))}
            </>
          )}

          {/* Häs */}
          {results.haes.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-secondary/30 border-b border-border flex items-center gap-2">
                <Shirt size={12} /> Häs ({results.haes.length})
              </div>
              {results.haes.map(h => (
                <a
                  key={h.id}
                  href={`/haes/${h.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs shrink-0">
                    #{h.haesnummer[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">#{h.haesnummer}</p>
                    {h.bezeichnung && <p className="text-xs text-muted-foreground truncate">{h.bezeichnung}</p>}
                  </div>
                </a>
              ))}
            </>
          )}

          {/* Arbeitsdienste */}
          {results.dienste.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-secondary/30 border-b border-border flex items-center gap-2">
                <Briefcase size={12} /> Arbeitsdienste ({results.dienste.length})
              </div>
              {results.dienste.map(d => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left border-b border-border last:border-0 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                    📋
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{d.titel}</p>
                    <p className="text-xs text-muted-foreground">{d.datum}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-40" />}
    </div>
  );
}