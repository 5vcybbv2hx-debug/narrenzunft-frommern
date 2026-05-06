import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

export default function UmzugAbschliessenModal({ veranstaltung, onClose, onAbgeschlossen }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [buskostenErstellen, setBuskostenErstellen] = useState(false);

  const handleAbschliessen = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('umzugAbschliessen', {
        veranstaltung_id: veranstaltung.id,
        buskosten_erstellen: buskostenErstellen,
      });
      setResult(res.data);
      onAbgeschlossen && onAbgeschlossen();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Unbekannter Fehler');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-foreground text-lg">Umzug abschließen</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <>
            <div className="bg-secondary/50 border border-border rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-foreground mb-1">{veranstaltung.titel}</p>
              <p className="text-xs text-muted-foreground">{veranstaltung.datum} · {veranstaltung.ort || 'Kein Ort'}</p>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Beim Abschließen werden Anwesenheiten geprüft, Ehrungszähler aktualisiert und der Status auf „Abgeschlossen" gesetzt.
            </p>

            <label className="flex items-center gap-3 cursor-pointer mb-5 p-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/40 transition-colors">
              <input
                type="checkbox"
                checked={buskostenErstellen}
                onChange={e => setBuskostenErstellen(e.target.checked)}
                className="rounded w-4 h-4"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Buskosten automatisch erstellen</p>
                <p className="text-xs text-muted-foreground">Für alle Bus-Anmeldungen wird ein Buskostenbeitrag angelegt</p>
              </div>
            </label>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 mb-4">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium">
                Abbrechen
              </button>
              <button
                onClick={handleAbschliessen}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                {loading ? 'Wird abgeschlossen...' : 'Abschließen'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">Erfolgreich abgeschlossen</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
              <div className="bg-secondary rounded-xl p-3">
                <p className="text-xl font-bold text-primary">{result.anwesend ?? '–'}</p>
                <p className="text-xs text-muted-foreground">Anwesend</p>
              </div>
              <div className="bg-secondary rounded-xl p-3">
                <p className="text-xl font-bold text-primary">{result.ehrungen_aktualisiert ?? '–'}</p>
                <p className="text-xs text-muted-foreground">Ehrungen aktualisiert</p>
              </div>
              {result.buskosten_erstellt != null && (
                <div className="bg-secondary rounded-xl p-3 col-span-2">
                  <p className="text-xl font-bold text-primary">{result.buskosten_erstellt}</p>
                  <p className="text-xs text-muted-foreground">Buskosten erstellt</p>
                </div>
              )}
            </div>
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}