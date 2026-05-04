import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannImportieren } from '@/lib/roles';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowLeft, AlertTriangle, Upload, X, FileText, CheckCircle, Loader2, Play, Eye } from 'lucide-react';

export default function DatenImport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [csvText, setCsvText] = useState(null);
  const [csvName, setCsvName] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  if (!kannImportieren(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertTriangle size={40} className="text-destructive mb-3" />
        <p className="text-foreground font-semibold">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">Nur Administratoren können Daten importieren.</p>
      </div>
    );
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target.result);
      setCsvName(file.name);
      setPreview(null);
      setResult(null);
      setError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await base44.functions.invoke('importMasterCSV', {
        csv_text: csvText, mode: 'preview', offset: 0, limit: 30
      });
      setPreview(res.data);
    } catch (e) {
      setError(e.message || 'Fehler bei der Vorschau');
    }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!window.confirm('Import wirklich ausführen? Alle Mitglieder werden aktualisiert und Häs-Zuweisungen gesetzt.')) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      let offset = 0;
      const limit = 30;
      let total = null;
      let gesamt = { updated: 0, created: 0, haesZugewiesen: 0, nichtGefunden: 0 };

      while (true) {
        const res = await base44.functions.invoke('importMasterCSV', {
          csv_text: csvText, mode: 'execute', offset, limit
        });
        const data = res.data;
        if (total === null) total = data.total || 0;

        gesamt.updated += data.updated || 0;
        gesamt.created += data.created || 0;
        gesamt.haesZugewiesen += data.haesZugewiesen || 0;
        gesamt.nichtGefunden += data.nichtGefunden || 0;

        setProgress({ current: Math.min(offset + limit, total), total });

        if (data.done || !data.next_offset) break;
        offset = data.next_offset;
        await new Promise(r => setTimeout(r, 3000));
      }

      setProgress(null);
      setResult(gesamt);
    } catch (e) {
      setError(e.message || 'Fehler beim Import');
    }
    setLoading(false);
  };

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database size={22} className="text-primary" /> Master-Import
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mitglieder, Gruppen & Häs-Zuweisungen aus einer CSV</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-300">
          <strong>Wichtig:</strong> Zuerst Vorschau prüfen, dann erst ausführen. Der Import aktualisiert alle Mitglieder und setzt Häs-Zuweisungen.
        </p>
      </div>

      {/* Datei Upload */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h3 className="font-semibold text-foreground mb-3">1. CSV-Datei auswählen</h3>
        {csvName ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <FileText size={14} className="text-green-400 shrink-0" />
            <span className="text-xs text-green-400 flex-1 truncate">{csvName} ✓</span>
            <button onClick={() => { setCsvText(null); setCsvName(null); setPreview(null); setResult(null); }}
              className="text-muted-foreground hover:text-destructive transition-colors">
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 px-4 py-4 rounded-xl bg-secondary border border-border border-dashed cursor-pointer hover:border-primary/50 transition-colors">
            <Upload size={20} className="text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">CSV-Datei auswählen</p>
              <p className="text-xs text-muted-foreground">master_mitglieder_vollstaendig.csv</p>
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>
        )}
      </div>

      {/* Aktionen */}
      {csvText && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h3 className="font-semibold text-foreground mb-3">2. Import starten</h3>
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-border disabled:opacity-50 transition-colors"
            >
              {loading && !progress ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
              Vorschau (erste 30)
            </button>
            <button
              onClick={handleExecute}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {loading && progress ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Import ausführen
            </button>
          </div>
        </div>
      )}

      {/* Fortschritt */}
      {progress && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-primary font-medium">Verarbeite... {progress.current} / {progress.total}</span>
            <span className="text-xs text-muted-foreground">{Math.round((progress.current / progress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-green-400" />
            <p className="text-sm font-semibold text-green-400">Import abgeschlossen!</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-card rounded-lg p-2">
              <p className="text-xl font-bold text-foreground">{result.updated}</p>
              <p className="text-xs text-muted-foreground">aktualisiert</p>
            </div>
            <div className="bg-card rounded-lg p-2">
              <p className="text-xl font-bold text-foreground">{result.created}</p>
              <p className="text-xs text-muted-foreground">neu angelegt</p>
            </div>
            <div className="bg-card rounded-lg p-2">
              <p className="text-xl font-bold text-foreground">{result.haesZugewiesen}</p>
              <p className="text-xs text-muted-foreground">Häs zugewiesen</p>
            </div>
            <div className="bg-card rounded-lg p-2">
              <p className="text-xl font-bold text-yellow-400">{result.nichtGefunden}</p>
              <p className="text-xs text-muted-foreground">nicht gefunden</p>
            </div>
          </div>
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Vorschau */}
      {preview && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">Vorschau — erste {preview.preview?.length} von {preview.total} Personen</h3>
          </div>

          {/* Gruppen-Info */}
          {preview.gruppen && (
            <div className="px-4 py-3 border-b border-border bg-secondary/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gruppen</p>
              <div className="flex flex-wrap gap-2">
                {preview.gruppen.map((g, i) => (
                  <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${g.aktion === 'bereits vorhanden' ? 'bg-secondary text-muted-foreground' : 'bg-green-500/20 text-green-400'}`}>
                    {g.name} ({g.aktion})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground">Person</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Aktion</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Gruppen</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Häs</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview?.map((p, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-3 py-1.5 font-medium text-foreground">{p.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.status}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.aktion === 'update' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                        {p.aktion}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.gruppen || '–'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.haes || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}