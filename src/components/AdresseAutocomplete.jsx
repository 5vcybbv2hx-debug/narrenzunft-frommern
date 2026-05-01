import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

export default function AdresseAutocomplete({ value, onChange, placeholder = 'Adresse suchen...' }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value
  useEffect(() => { setQuery(value || ''); }, [value]);

  // Click outside → close
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q); // live passthrough

    clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=de,at,ch`,
          { headers: { 'Accept-Language': 'de' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 400);
  };

  const handleSelect = (item) => {
    const label = item.display_name;
    setQuery(label);
    onChange(label);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-8 pr-8 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {suggestions.map((item) => (
            <button
              key={item.place_id}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
            >
              <MapPin size={13} className="text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground leading-snug">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}