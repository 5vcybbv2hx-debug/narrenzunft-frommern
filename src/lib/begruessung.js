import { useEffect, useState } from 'react';

// Einheitliche, tageszeitabhängige Begrüßung — für ALLE Nutzer identisch.
export function getBegruessung(name) {
  const h = new Date().getHours();
  const vorname = name?.split(' ')[0] || 'Narr';
  if (h < 11) return `Guten Morgen, ${vorname} \u{1F44B}`;
  if (h < 18) return `Guten Tag, ${vorname} \u{1F3AD}`;
  return `Guten Abend, ${vorname} \u{1F319}`;
}

// Begrüßung als Hook: bleibt auch bei offener App aktuell (Prüfung jede Minute),
// z. B. wenn jemand über die Abenddämmerung hinaus eingeloggt bleibt.
export function useBegruessung(name) {
  const [text, setText] = useState(() => getBegruessung(name));
  useEffect(() => {
    setText(getBegruessung(name));
    const timer = setInterval(() => setText(getBegruessung(name)), 60 * 1000);
    return () => clearInterval(timer);
  }, [name]);
  return text;
}
