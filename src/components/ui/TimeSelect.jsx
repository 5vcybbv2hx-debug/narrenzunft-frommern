import React from 'react';

/**
 * Intuitives Zeit-Eingabefeld als Ersatz für <input type="time">.
 * Zwei Dropdowns (Stunde / Minute) statt fummeligem Segment-Picker.
 * API-kompatibel zu <input type="time" />: onChange({ target: { name, value } }).
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
  const [hRaw, mRaw] = (value || '').split(':');
  const hour = hRaw || '';
  const minute = mRaw || '';

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteCount = Math.max(1, Math.floor(60 / minuteStep));
  const minutes = Array.from({ length: minuteCount }, (_, i) => String(i * minuteStep).padStart(2, '0'));
  if (minute && !minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort();
  }

  const emit = (newHour, newMinute) => {
    let nextValue = '';
    if (newHour !== '' || newMinute !== '') {
      nextValue = `${newHour || '00'}:${newMinute || '00'}`;
    }
    onChange({ target: { name, value: nextValue } });
  };

  const selectClass = `flex-1 min-w-0 bg-secondary border border-border rounded-lg px-2 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px] cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  return (
    <div className={`flex items-center gap-1.5 w-full ${disabled ? "opacity-60" : ""}`}>
      <select
        value={hour}
        onChange={(e) => emit(e.target.value, minute)}
        className={selectClass}
        aria-label="Stunde"
        disabled={disabled}
        required={required}
      >
        <option value="">--</option>
        {hours.map((hh) => (
          <option key={hh} value={hh}>{hh}</option>
        ))}
      </select>
      <span className="text-muted-foreground font-semibold select-none">:</span>
      <select
        value={minute}
        onChange={(e) => emit(hour, e.target.value)}
        className={selectClass}
        aria-label="Minute"
        disabled={disabled}
        required={required}
      >
        <option value="">--</option>
        {minutes.map((mm) => (
          <option key={mm} value={mm}>{mm}</option>
        ))}
      </select>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => emit('', '')}
          className="text-muted-foreground hover:text-primary text-xs px-1.5 py-1 shrink-0"
          aria-label="Zeit löschen"
          tabIndex={-1}
        >
          ✕
        </button>
      )}
    </div>
  );
}
