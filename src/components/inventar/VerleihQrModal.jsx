import { X, QrCode, ExternalLink, Printer } from 'lucide-react';

export default function VerleihQrModal({ ausruestung, onClose }) {
  const url = `${window.location.origin}/verleih/${ausruestung.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(url)}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-secondary border border-border rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald uppercase tracking-wide font-bold text-foreground flex items-center gap-2">
            <QrCode size={16} className="text-primary" /> QR-Code: {ausruestung.name}
          </h3>
          <button onClick={onClose} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="bg-white rounded-xl p-3 w-fit mx-auto">
          <img src={qrUrl} alt={`QR-Code für ${ausruestung.name}`} className="w-52 h-52" />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-3 leading-relaxed">
          Ausdrucken (möglichst groß, min. 5×5 cm) und witterungsgeschützt auf dem Gegenstand anbringen.
          Wer scannt, sieht Beschreibung, Preise und kann direkt eine Anfrage stellen.
        </p>

        <div className="mt-4 space-y-2">
          <a href={qrUrl} target="_blank" rel="noopener noreferrer"
            className="w-full py-2.5 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
            <Printer size={15} /> QR-Bild öffnen / drucken
          </a>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="w-full py-2.5 min-h-[44px] rounded-lg bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors">
            <ExternalLink size={15} /> Anfrage-Seite testen
          </a>
        </div>

        <div className="mt-3 px-3 py-2 rounded-lg bg-secondary border border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Link</p>
          <p className="text-[11px] text-muted-foreground break-all mt-0.5">{url}</p>
        </div>
      </div>
    </div>
  );
}
