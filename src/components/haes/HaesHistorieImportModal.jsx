import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Upload, FileText, CheckCircle2, AlertTriangle, Download } from 'lucide-react';

export default function HaesHistorieImportModal({ onClose, onImported }) {
  const [phase, setPhase] = useState('upload'); // upload | vorschau | ergebnis
  const [rows, setRows] = useState([]);
  const [ergebnis, setErgebnis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  haesnummer: { type: 'string' },
                  vorname: { type: 'string' },
                  nachname: { type: 'string' },
                  von_datum: { type: 'string' },
                  bis_datum: { type: 'string' },
                  notizen: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const data = extracted?.output?.rows || extracted?.output || [];
      setRows(Array.isArray(data) ? data : []);
      setPhase('vorschau');
    } catch (err) {
      alert('Fehler beim Lesen der Datei: ' + err.message);
    }
    setUploading(false);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await base44.functions.invoke('importHaesHistorie', { rows });
      setErgebnis(res.data);
      setPhase('ergebnis');
      if (res.data?.erfolg > 0) onImported?.();
    } catch (err) {
      alert('Fehler beim Import: ' + err.message);
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Häs-Historie importieren</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {phase === 'upload' && (
          <div className="space-y-4">
            <div className="bg-secondary/50 border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground mb-2">📋 Erwartete Spalten in der Excel-Datei:</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                <span className="text-primary">haesnummer</span><span>z.B. 42</span>
                <span className="text-primary">vorname</span><span>z.B. Hans</span>
                <span className="text-primary">nachname</span><span>z.B. Müller</span>
                <span className="text-primary">von_datum</span><span>z.B. 01.01.2010</span>
                <span className="text-primary">bis_datum</span><span>z.B. 31.12.2020 (leer = noch aktiv)</span>
                <span className="text-primary">notizen</span><span>optional</span>
              </div>
            </div>

            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
            >
              {uploading ? (
                <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={28} />
                  <span className="font-semibold">Excel oder CSV auswählen</span>
                  <span className="text-xs">.xlsx, .xls, .csv</span>
                </>
              )}
            </button>
          </div>
        )}

        {phase === 'vorschau' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText size={15} />
              <span>{fileName}</span>
              <span className="ml-auto font-semibold text-foreground">{rows.length} Zeilen erkannt</span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary sticky top-0">
                  <tr>
                    {['Häs-Nr.', 'Vorname', 'Nachname', 'Von', 'Bis', 'Notizen'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-muted-foreground font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-2 py-1.5 font-mono text-primary">{r.haesnummer}</td>
                      <td className="px-2 py-1.5">{r.vorname}</td>
                      <td className="px-2 py-1.5 font-medium">{r.nachname}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.von_datum}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.bis_datum || '–'}</td>
                      <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[80px]">{r.notizen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 50 && <p className="text-xs text-muted-foreground text-center">... und {rows.length - 50} weitere</p>}

            <div className="flex gap-2">
              <button onClick={() => setPhase('upload')} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Zurück</button>
              <button
                onClick={handleImport}
                disabled={importing || rows.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {importing ? 'Importiere...' : `${rows.length} Einträge importieren`}
              </button>
            </div>
          </div>
        )}

        {phase === 'ergebnis' && ergebnis && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                <CheckCircle2 size={24} className="text-green-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-400">{ergebnis.erfolg}</p>
                <p className="text-xs text-muted-foreground">Erfolgreich</p>
              </div>
              <div className={`border rounded-xl p-4 text-center ${ergebnis.fehler?.length > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-secondary border-border'}`}>
                <AlertTriangle size={24} className={`mx-auto mb-1 ${ergebnis.fehler?.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
                <p className={`text-2xl font-bold ${ergebnis.fehler?.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>{ergebnis.fehler?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Fehler</p>
              </div>
            </div>

            {ergebnis.fehler?.length > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-400 mb-2">Fehlerhafte Zeilen:</p>
                {ergebnis.fehler.map((f, i) => (
                  <p key={i} className="text-xs text-muted-foreground mb-1">
                    • Häs {f.row?.haesnummer} / {f.row?.nachname}: <span className="text-red-400">{f.grund}</span>
                  </p>
                ))}
              </div>
            )}

            <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
              Schließen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}