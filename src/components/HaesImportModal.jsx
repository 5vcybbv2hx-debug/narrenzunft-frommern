import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Upload, AlertCircle } from 'lucide-react';

export default function HaesImportModal({ onClose }) {
  const [fileUrl, setFileUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!fileUrl) {
      setError('CSV-URL erforderlich');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('zuordneHaesNachGruppen', { csv_url: fileUrl });
      setResult(res.data);
    } catch (e) {
      setError(e.message);
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Häs nach Gruppen zuordnen</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {!result ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              CSV-URL einer Mitgliedsliste (mit Spalten Häsnummer, Maskengruppe, Vor-/Nachname)
            </p>
            <input
              type="text"
              placeholder="https://..."
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={importing || !fileUrl}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload size={14} />
              {importing ? 'Importiere...' : 'Importieren'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <p className="text-sm font-semibold text-green-400 mb-2">✓ Erfolgreich importiert</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Verarbeitet: {result.processed}/{result.total_rows}</p>
                <p>Häs-Gruppen aktualisiert: {result.haesGruppe_updated}</p>
                <p>Häs fehlgeschlagen: {result.haesGruppe_failed}</p>
                <p>Mitglieder zugewiesen: {result.mitglied_haes_assigned}</p>
                <p>Zuweisungen fehlgeschlagen: {result.mitglied_haes_failed}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium"
            >
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}