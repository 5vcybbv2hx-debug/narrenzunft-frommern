import { useState, useRef, useEffect } from 'react';
import { Search, User, X, Loader2 } from 'lucide-react';

/**
 * MitgliedLiveSuche – Eingabefeld mit Live-Suche in der Mitgliederdatenbank.
 * Zeigt ab 2 Zeichen passende Mitglieder als Dropdown, Auswahl per Klick.
 * Props:
 *   mitglieder: Mitglied-Array (vorname, nachname, email, id)
 *   value:       aktuell gewählter Anzeigename (string) oder ''
 *   onSelect:    (mitglied) => void – bei Auswahl
 *   onClear:     () => void – X-Klick (optional)
 *   placeholder: Platzhaltertext
 */
export default function MitgliedLiveSuche({ mitglieder, value, onSelect, onClear, placeholder = 'Verantwortlichen suchen...' }) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const wrapRef = useRef(null);

  // Bei bereits gewähltem Namen: keinen Suchtext anzeigen
  useEffect(() => { if (value) setSuche(''); }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOffen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = suche.trim().toLowerCase();
  const treffer = q.length < 2
    ? []
    : (mitglieder || [])
        .filter(m => `${(m.vorname || '')} ${(m.nachname || '')}`.toLowerCase().includes(q))
        .slice(0, 8);

  const waehle = (m) => {
    setSuche('');
    setOffen(false);
    onSelect?.(m);
  };

  const inputCls = 'w-full px-2.5 py-2 rounded-lg bg-secondary border border-border text-sm text-white focus:outline-none focus:border-primary';

  // Bereits gewählt -> Name anzeigen (mit X zum Entfernen)
  if (value && !offen) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-sm text-white truncate flex-1 min-w-0">
          <User size={13} className="text-primary shrink-0" /> {value}
        </span>
        {onClear && (
          <button type="button" onClick={onClear}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Verantwortlichen entfernen">
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={suche}
          onChange={e => { setSuche(e.target.value); setOffen(true); }}
          onFocus={() => setOffen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOffen(false); setSuche(''); }
            if (e.key === 'Enter' && treffer.length) { e.preventDefault(); waehle(treffer[0]); }
          }}
          placeholder={placeholder}
          className={`${inputCls} pl-8`}
          autoComplete="off"
        />
      </div>

      {offen && suche.trim().length >= 2 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {treffer.length === 0 && (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">Kein Mitglied gefunden für „{suche}"</p>
          )}
          {treffer.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => waehle(m)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-primary/10 border-b border-border last:border-0"
            >
              <User size={13} className="text-muted-foreground shrink-0" />
              <span className="text-sm text-white truncate">
                {(m.vorname || '')} {(m.nachname || '')}
              </span>
              {m.status && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{m.status}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
