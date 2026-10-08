import { useRef, useState } from 'react';
import { Check } from 'lucide-react';

/**
 * SwipeActionRow — Wischbare Zeile mit Aktion auf der linken Seite.
 *
 * Nach rechts wischen zieht den Inhalt beiseite und gibt eine grüne
 * Aktionsfläche frei; über ~64px beim Loslassen löst onSwipe aus.
 * Reine Touch-Interaktion — auf dem Desktop verhält sich die Zeile
 * exakt wie vorher. onSwipe wird bewusst NICHT automatisch gefeuert:
 * dahinter kann dieselbe (Bestätigungs-)Logik wie beim Tipp-Button liegen.
 */
export default function SwipeActionRow({ onSwipe, actionLabel = 'Erledigt', disabled, className = '', children }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const horizontal = useRef(false);

  const onTouchStart = (e) => {
    if (disabled || e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    horizontal.current = false;
  };

  const onTouchMove = (e) => {
    if (!start.current) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x;
    const my = t.clientY - start.current.y;
    if (!horizontal.current) {
      // Richtungsentscheidung erst ab 10px — vertikal = normales Scrollen
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      if (Math.abs(mx) <= Math.abs(my)) { start.current = null; return; }
      horizontal.current = true;
    }
    setDx(Math.max(0, Math.min(mx, 96)));
  };

  const onTouchEnd = () => {
    if (horizontal.current && dx >= 64) onSwipe && onSwipe();
    setDx(0);
    start.current = null;
    horizontal.current = false;
  };

  return (
    <div
      className={`relative overflow-hidden ${dx > 0 ? 'rounded-xl' : ''} ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Aktionsfläche links, wird beim Wischen nach rechts freigegeben */}
      <div
        className="absolute inset-y-0 left-0 w-24 bg-green-600 flex flex-col items-center justify-center gap-1 text-white"
        style={{ opacity: dx > 0 ? 1 : 0, transition: dx > 0 ? 'opacity .1s' : 'opacity .2s' }}
        aria-hidden="true"
      >
        <Check size={18} />
        <span className="text-[10px] font-semibold uppercase tracking-wide leading-tight text-center px-1">{actionLabel}</span>
      </div>
      <div
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dx ? 'none' : 'transform .2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
