import { useRef, useCallback } from 'react';

/**
 * useSwipe — erkennt horizontale Wischgesten (Touch).
 *
 * onSwipeLeft  – Wisch nach links (Finger nach links = "weiter/vor")
 * onSwipeRight – Wisch nach rechts ("zurück")
 * threshold    – Mindeststrecke in px (Standard 60)
 * enabled      – Geste aktiv (z. B. false während Bearbeitung)
 *
 * Die Handler werden direkt aufs Ziel-Element gelegt ({...swipe}).
 * Vertikale Bewegungen (Scrollen) und Diagonalen werden ignoriert,
 * damit normales Scrollen nie eine Aktion auslöst.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60, enabled = true }) {
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    if (!enabled || e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [enabled]);

  const onTouchEnd = useCallback((e) => {
    if (!start.current) return;
    const t = e.changedTouches && e.changedTouches[0];
    const s = start.current;
    start.current = null;
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < threshold) return;
    // Nur auslösen, wenn die Geste klar horizontal war (sonst: Scrollen/Pull-to-Refresh)
    if (Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (dx < 0) onSwipeLeft && onSwipeLeft();
    else onSwipeRight && onSwipeRight();
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
