import React from 'react';

/**
 * Intuitives Datum-Eingabefeld als Ersatz für <input type="date">.
 * Drei Dropdowns (Tag / Monat / Jahr) in beliebiger Reihenfolge wählbar.
 * API-kompatibel zu <input type="date" />: onChange({ target: { name, value } }).
 * value ist "YYYY-MM-DD" (ISO), Display ist DD.MM.YYYY (deutsch).
 */
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
  const [yRaw, mRaw, dRaw] = (value || '').split('-');
  const year = yRaw || '';
  const month = mRaw || '';
  const day = dRaw || '';

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(maxYear - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  // IMMER 1-31 Tage anzeigen — unabhängig von Monat/Jahr
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

  const emit = (newY, newM, newD) => {
    let nextValue = '';
    if (newY !== '' || newM !== '' || newD !== '') {
      if (newY && newM && newD) {
        // Tag gültig für Monat/Jahr? Falls nicht, anpassen
        const maxDay = new Date(parseInt(newY), parseInt(newM), 0).getDate();
        const validDay = parseInt(newD) > maxDay ? String(maxDay).padStart(2, '0') : newD;
        nextValue = `${newY}-${newM}-${validDay}`;
      } else if (newY && newM) {
        nextValue = `${newY}-${newM}`;
      } else if (newY) {
        nextValue = `${newY}`;
      }
    }
    onChange({ target: { name, value: nextValue } });
  };

  const selectClass = `bg-secondary rounded-lg px-2 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px] flex-1 min-w-0 cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  return (
    <div className={`flex items-center gap-1.5 border border-border rounded-lg p-1.5 ${className}`}>
      <select
        value={day}
        onChange={(e) => emit(year, month, e.target.value)}
        className={selectClass}
        aria-label="Tag"
        disabled={disabled}
        required={required}
      >
        {allowEmpty && <option value="">--</option>}
        {days.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <span className="text-muted-foreground font-semibold select-none">.</span>
      <select
        value={month}
        onChange={(e) => emit(year, e.target.value, day)}
        className={selectClass}
        aria-label="Monat"
        disabled={disabled}
        required={required}
      >
        {allowEmpty && <option value="">--</option>}
        {months.map((mm, idx) => (
          <option key={mm} value={mm}>{monthNames[idx]}</option>
        ))}
      </select>
      <span className="text-muted-foreground font-semibold select-none">.</span>
      <select
        value={year}
        onChange={(e) => emit(e.target.value, month, day)}
        className={selectClass}
        aria-label="Jahr"
        disabled={disabled}
        required={required}
      >
        {allowEmpty && <option value="">--</option>}
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      {value && !disabled && allowEmpty && (
        <button
          type="button"
          onClick={() => emit('', '', '')}
          className="text-muted-foreground hover:text-primary text-xs px-1.5 py-1 shrink-0"
          aria-label="Datum löschen"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
    </div>
  );
}