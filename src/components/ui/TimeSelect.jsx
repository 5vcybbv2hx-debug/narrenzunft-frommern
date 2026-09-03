import React, { useState, useRef, useEffect } from 'react';
import { Clock, X } from 'lucide-react';

/**
 * Smartes Zeit-Eingabefeld als Ersatz für <input type="time">.
 * Ein Tap öffnet ein Stunden-/Minuten-Grid mit "Jetzt"-Schnellwahl
 * statt zwei Dropdowns.
 * API-kompatibel zu <input type="time" />: onChange({ target: { name, value } }).
 * value ist "HH:MM" (24h).
 */
export default function TimeSelect({
  value,
  onChange,
  name,
  className = '',
  minuteStep = 5,
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const trigRef = useRef(null);
  const popRef = useRef(null);

  const [hRaw, mRaw] = (value || '').split(':');
  const hour = hRaw || '';
  const minute = mRaw || '';

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteCount = Math.max(1, Math.floor(60 / minuteStep));
  const minutes = Array.from({ length: minuteCount }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  // Nicht rasterkonforme Minute (z.B. imported 13:37) trotzdem wählbar machen
  if (minute && !minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort();
  }

    const emit = (h, m) => {
    const v = h || m ? `${h || '00'}:${m || '00'}` : '';
    onChange({ target: { name, value: v } });
  };

  const openPop = () => {
    const r = trigRef.current?.getBoundingClientRect();
    if (r) {
      const fitsBelow = r.bottom + 330 < window.innerHeight;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 268)),
        top: fitsBelow ? r.bottom + 6 : Math.max(8, r.top - 320),
      });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onDown = (e) => {
      if (trigRef.current?.contains(e.target)) return;
      if (popRef.current?.contains(e.target)) return;
      close();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const display = value ? `${hour || '00'}:${minute || '00'}` : '';
  const now = new Date();
  const btnBase = 'h-8 rounded-lg text-xs font-semibold transition-colors';
  const trigClass = `flex items-center justify-between gap-2 w-full bg-secondary border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-sm cursor-pointer hover:border-primary/60 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={trigRef}
        type="button"
        onClick={() => !disabled && (open ? setOpen(false) : openPop())}
        className={trigClass}
        aria-label="Uhrzeit wählen"
      >
        <span className={`flex items-center gap-2 ${display ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
          <Clock size={15} className="text-primary shrink-0" />
          {display || 'Uhrzeit wählen'}
        </span>
        {display && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); emit('', ''); }}
            className="text-muted-foreground hover:text-primary px-1"
            aria-label="Zeit löschen"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="fixed z-[100] w-[260px] bg-card border border-border rounded-xl shadow-2xl p-3 max-h-[85vh] overflow-y-auto"
          style={pos ? { top: pos.top, left: pos.left } : undefined}
        >
          {/* Stunden */}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Stunde</p>
          <div className="grid grid-cols-6 gap-1 mb-3">
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => emit(h, minute || '00')}
                className={`${btnBase} ${
                  h === (hour || null)
                    ? 'bg-primary text-white'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Minuten */}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Minute</p>
          <div className="grid grid-cols-6 gap-1 mb-3">
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { emit(hour || '00', m); setOpen(false); }}
                className={`${btnBase} ${
                  m === (minute || null)
                    ? 'bg-primary text-white'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Schnellwahl */}
          <div className="flex gap-1.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => {
                emit(String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'));
                setOpen(false);
              }}
              className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-white font-semibold hover:bg-primary hover:border-primary transition-colors"
            >
              Jetzt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
