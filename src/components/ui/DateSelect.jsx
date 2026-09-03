import React, { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Smartes Datum-Eingabefeld als Ersatz für <input type="date">.
 * Ein Tap öffnet einen Mini-Kalender-Popover mit Schnellwahl
 * (Heute / Morgen / Samstag) statt drei Dropdowns.
 * API-kompatibel zu <input type="date" />: onChange({ target: { name, value } }).
 * value ist "YYYY-MM-DD" (ISO), Display ist DD.MM.YYYY (deutsch).
 */
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const pad = (n) => String(n).padStart(2, '0');

const fromISO = (v) => {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
};

const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m ist 0-basiert

export default function DateSelect({
  value,
  onChange,
  name,
  className = '',
  required = false,
  disabled = false,
  minYear = 1950,
  maxYear = 2030,
  allowEmpty = true,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const trigRef = useRef(null);
  const popRef = useRef(null);
  const today = new Date();
  const sel = fromISO(value);
  const [view, setView] = useState(() => {
    const base = sel || { y: today.getFullYear(), m: today.getMonth() };
    return { y: base.y, m: base.m };
  });

  // View mit externem Wert synchron halten (solange geschlossen)
  useEffect(() => {
    if (!open && sel) setView({ y: sel.y, m: sel.m });
  }, [value]);

  const openPop = () => {
    const r = trigRef.current?.getBoundingClientRect();
    if (r) {
      const fitsBelow = r.bottom + 340 < window.innerHeight;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 290)),
        top: fitsBelow ? r.bottom + 6 : Math.max(8, r.top - 330),
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

  const emit = (iso) => onChange({ target: { name, value: iso } });

  const pick = (y, m, d) => {
    emit(toISO(y, m, d));
    setOpen(false);
  };

  const stepMonth = (delta) => {
    setView((v) => {
      let y = v.y;
      let m = v.m + delta;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      if (y < minYear) { y = minYear; m = 0; }
      if (y > maxYear) { y = maxYear; m = 11; }
      return { y, m };
    });
  };

  // Kalender-Grid
  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mo-basiert
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) =>
    d === today.getDate() && view.m === today.getMonth() && view.y === today.getFullYear();
  const isSel = (d) => sel && d === sel.d && view.m === sel.m && view.y === sel.y;

  // Schnellwahl
  const nextSaturday = () => {
    const d = new Date();
    const delta = (6 - d.getDay() + 7) % 7; // 6 = Samstag
    d.setDate(d.getDate() + delta);
    return d;
  };
  const quicks = [
    { label: 'Heute', date: new Date() },
    { label: 'Morgen', date: new Date(Date.now() + 86400000) },
    { label: 'Samstag', date: nextSaturday() },
  ];

  const display = sel ? `${pad(sel.d)}.${pad(sel.m + 1)}.${sel.y}` : '';
  const trigClass = `flex items-center justify-between gap-2 w-full bg-secondary border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-sm cursor-pointer hover:border-primary/60 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={trigRef}
        type="button"
        onClick={() => !disabled && (open ? setOpen(false) : openPop())}
        className={trigClass}
        aria-label="Datum wählen"
      >
        <span className={`flex items-center gap-2 ${display ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
          <CalendarDays size={15} className="text-primary shrink-0" />
          {display || 'Datum wählen'}
        </span>
        {display && allowEmpty && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); emit(''); }}
            className="text-muted-foreground hover:text-primary px-1"
            aria-label="Datum löschen"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popRef}
          className="fixed z-[100] w-[272px] bg-card border border-border rounded-xl shadow-2xl p-3"
          style={pos ? { top: pos.top, left: pos.left } : undefined}
        >
          {/* Monat-Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => stepMonth(-1)} className="p-1.5 rounded-lg hover:bg-secondary text-foreground" aria-label="Vorheriger Monat">
              <ChevronLeft size={16} />
            </button>
            <span className="font-oswald uppercase tracking-wide text-white text-sm">
              {MONTHS[view.m]} {view.y}
            </span>
            <button type="button" onClick={() => stepMonth(1)} className="p-1.5 rounded-lg hover:bg-secondary text-foreground" aria-label="Nächster Monat">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Wochentage */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <span key={w} className="text-center text-[10px] uppercase text-muted-foreground font-semibold">{w}</span>
            ))}
          </div>

          {/* Tage */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) =>
              d === null ? (
                <span key={`b${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(view.y, view.m, d)}
                  className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                    isSel(d)
                      ? 'bg-primary text-white'
                      : isToday(d)
                        ? 'bg-primary/15 text-primary border border-primary/50'
                        : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  {d}
                </button>
              )
            )}
          </div>

          {/* Schnellwahl */}
          <div className="flex gap-1.5 mt-3 pt-2 border-t border-border">
            {quicks.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => pick(q.date.getFullYear(), q.date.getMonth(), q.date.getDate())}
                className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-white font-semibold hover:bg-primary hover:border-primary transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
