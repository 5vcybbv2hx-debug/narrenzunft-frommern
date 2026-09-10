import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Users, X } from 'lucide-react';

const MAX_SICHTBAR = 2;

export default function ArbeitsdienstKalender({ dienste, zuweisungen, onDienstClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });

  // Wochentag des ersten Tags (Montag = 0)
  const startWeekday = (getDay(start) + 6) % 7;

  const getDiensteForDay = (day) =>
    dienste.filter(d => d.datum && isSameDay(new Date(d.datum), day));

  const getZuweisungCount = (dienstId) =>
    zuweisungen.filter(z => z.arbeitsdienst_id === dienstId && z.status !== 'Abgesagt').length;

  const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const today = new Date();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-semibold text-foreground text-sm">
          {format(currentMonth, 'MMMM yyyy', { locale: de })}
        </h3>
        <button
          onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells before first day */}
        {Array.from({ length: startWeekday }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[60px] border-b border-r border-border/50 bg-secondary/20" />
        ))}

        {days.map((day, idx) => {
          const dayDienste = getDiensteForDay(day);
          const isToday = isSameDay(day, today);
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          const colIndex = (startWeekday + idx) % 7;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[60px] border-b border-r border-border/50 p-1 ${isWeekend ? 'bg-secondary/10' : ''}`}
            >
              <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday ? 'bg-primary text-white' : 'text-muted-foreground'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayDienste.slice(0, MAX_SICHTBAR).map(d => {
                  const count = getZuweisungCount(d.id);
                  const needed = d.benoetigte_personen;
                  const unterbesetzt = needed && count < needed;
                  return (
                    <button
                      key={d.id}
                      onClick={() => onDienstClick && onDienstClick(d)}
                      title={`${d.titel}${d.uhrzeit ? ` · ${d.uhrzeit}` : ''} · ${count}${needed ? `/${needed}` : ''} Personen`}
                      className={`w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded font-medium truncate transition-opacity hover:opacity-80 ${
                        unterbesetzt
                          ? 'bg-primary/30 text-primary'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {d.titel}
                    </button>
                  );
                })}
                {dayDienste.length > MAX_SICHTBAR && (
                  <button
                    onClick={() => setSelectedDay(day)}
                    className="w-full text-left text-[9px] leading-tight px-1 py-0.5 rounded font-semibold text-muted-foreground hover:text-primary bg-secondary/60 transition-colors"
                  >
                    +{dayDienste.length - MAX_SICHTBAR} weitere
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tages-Detail: statt endlos stapelnder Zellen öffnet '+N weitere' diese Liste */}
      {selectedDay && (() => {
        const tagesDienste = getDiensteForDay(selectedDay);
        return (
          <div className="border-t border-border p-3 space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground">
                {format(selectedDay, 'EEEE, d. MMMM', { locale: de })} · {tagesDienste.length} Dienste
              </p>
              <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            {tagesDienste.map(d => {
              const count = getZuweisungCount(d.id);
              const needed = d.benoetigte_personen;
              const unterbesetzt = needed && count < needed;
              return (
                <button
                  key={d.id}
                  onClick={() => onDienstClick && onDienstClick(d)}
                  className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary/60 hover:bg-secondary transition-colors"
                >
                  <span className="text-sm text-foreground truncate">{d.titel}{d.uhrzeit ? ` · ${d.uhrzeit}` : ''}</span>
                  <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${unterbesetzt ? 'bg-primary/30 text-primary' : 'bg-primary/20 text-primary'}`}>
                    <Users size={10} className="inline mr-1 -mt-0.5" />{count}{needed ? `/${needed}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/20" /> Besetzt</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/30" /> Unterbesetzt</span>
      </div>
    </div>
  );
}