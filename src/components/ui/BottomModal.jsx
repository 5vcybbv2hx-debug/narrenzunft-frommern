import { motion, useDragControls } from 'framer-motion';

/**
 * BottomModal – der gemeinsame Rahmen für alle Bottom-Sheets/Modals der App.
 *
 * Auf dem Handy erscheint der Dialog als unten aufruhendes Sheet (Desktop:
 * zentriert). Neu: Per Griffleiste oben lässt sich das Sheet mit dem Finger
 * nach unten wegziehen, um es zu schließen (Drag-to-Close) – wie von
 * iOS/Android gewohnt. Schnelles Ziehen oder mehr als ~100px genügt.
 *
 * Warum nur die Griffleiste ziehbar ist: Formulare im Sheet enthalten
 * scrollbare Inhalte und Eingabefelder – dort darf die Drag-Geste das
 * Scrollen nie übernehmen. Deshalb startet der Drag ausschließlich am
 * Griff (dragListener=false + manuelle dragControls).
 *
 * - onClose: Schließen per Drag (und ggf. Backdrop-Klick)
 * - onBackdropClick: optional – nur Modals, die bisher auf den dunklen
 *   Hintergrund klickbar waren, bekommen diese Prop übergeben
 */
export default function BottomModal({ onClose, onBackdropClick, cardClass = '', backdropClass = '', children }) {
  const controls = useDragControls();

  return (
    <div
      className={`fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 ${backdropClass}`}
      onClick={onBackdropClick}
    >
      <motion.div
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.55 }}
        onDragEnd={(_, info) => {
          if (!onClose) return;
          if (info.offset.y > 100 || info.velocity.y > 600) onClose();
        }}
        onClick={onBackdropClick ? e => e.stopPropagation() : undefined}
        className={cardClass}
        role="dialog"
        aria-modal="true"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Griffleiste: einziger Startpunkt der Drag-Geste */}
        <div
          className="cursor-grab active:cursor-grabbing select-none pt-1"
          onPointerDown={e => controls.start(e)}
          aria-hidden
        >
          <div className="mx-auto w-10 h-1 rounded-full bg-border" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
