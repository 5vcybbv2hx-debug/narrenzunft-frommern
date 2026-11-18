import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Check-in-QR-Karussell für die angemeldete Familie.
 *
 * Zeigt alle Anmeldungen als großen QR-Code, mit Wischen und Pfeilen.
 * Der QR-Inhalt ist die Anmeldungs-ID - genau das, was der Scanner erwartet
 * (identisch zur Anzeige auf der Ausfahrt-Detailseite).
 *
 * @param {boolean} open
 * @param {function} onClose
 * @param {Array<{id:string, name:string, transport?:string, istFamilie?:boolean}>} eintraege
 * @param {string} titel optional, z. B. "Narrenzunft Alpirsbach"
 */
export default function QrKarussell({ open, onClose, eintraege = [], titel = '' }) {
  const [index, setIndex] = useState(0);
  const startX = useRef(null);

  useEffect(() => { if (open) setIndex(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, eintraege.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, eintraege.length, onClose]);

  if (!open || eintraege.length === 0) return null;

  const idx = Math.min(index, eintraege.length - 1);
  const reg = eintraege[idx];

  const wischen = (clientX) => {
    if (startX.current === null) return;
    const dx = clientX - startX.current;
    startX.current = null;
    if (dx < -45 && idx < eintraege.length - 1) setIndex(idx + 1);
    else if (dx > 45 && idx > 0) setIndex(idx - 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-4 sm:p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold font-oswald uppercase tracking-wider text-foreground">
              Check-in QR{eintraege.length > 1 ? 's' : ''}
            </h3>
            {titel && <p className="text-[11px] text-muted-foreground truncate">{titel}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="relative flex items-center justify-center touch-pan-y select-none"
          onTouchStart={e => { startX.current = e.touches[0].clientX; }}
          onTouchEnd={e => wischen(e.changedTouches[0].clientX)}
        >
          {idx > 0 && (
            <button
              onClick={() => setIndex(idx - 1)}
              className="absolute left-0 z-10 p-2 rounded-full bg-secondary/80 border border-border text-foreground active:scale-95 transition-transform"
              aria-label="Vorheriger QR"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-white rounded-2xl p-3 shadow-lg">
            <img
              key={reg.id}
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&bgcolor=ffffff&data=${encodeURIComponent(reg.id)}`}
              alt={`QR ${reg.name || ''}`}
              className="rounded-lg w-[230px] h-[230px] sm:w-[260px] sm:h-[260px] max-w-full"
              draggable={false}
            />
          </div>
          {idx < eintraege.length - 1 && (
            <button
              onClick={() => setIndex(idx + 1)}
              className="absolute right-0 z-10 p-2 rounded-full bg-secondary/80 border border-border text-foreground active:scale-95 transition-transform"
              aria-label="Nächster QR"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="text-center mt-3">
          <p className="text-base font-semibold text-foreground">{reg.name || 'Anmeldung'}</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            {reg.transport && (
              <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
                {reg.transport}
              </span>
            )}
            {reg.istFamilie && (
              <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground bg-secondary border border-border rounded-full px-2 py-0.5">
                Familie
              </span>
            )}
          </div>
        </div>

        {eintraege.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {eintraege.map((e, i) => (
              <button
                key={e.id}
                onClick={() => setIndex(i)}
                aria-label={`QR ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-primary' : 'w-1.5 bg-border'}`}
              />
            ))}
          </div>
        )}
        {eintraege.length > 1 && (
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            {idx + 1} von {eintraege.length} · wischen oder tippen
          </p>
        )}
      </div>
    </div>
  );
}
