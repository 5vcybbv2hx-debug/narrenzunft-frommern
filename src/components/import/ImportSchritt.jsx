import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp, Play, Eye, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const AKTION_COLORS = {
  'update': 'bg-blue-500/20 text-blue-400',
  'create': 'bg-green-500/20 text-green-400',
  'zuweisen': 'bg-green-500/20 text-green-400',
  'zuordnen': 'bg-blue-500/20 text-blue-400',
  'überspringen': 'bg-gray-500/20 text-gray-400',
  'erstellt': 'bg-green-500/20 text-green-400',
  'würde erstellt werden': 'bg-blue-500/20 text-blue-400',
  'bereits vorhanden': 'bg-gray-500/20 text-gray-400',
};

function PreviewTabelle({ data, columns }) {
  if (!data || data.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Keine Vorschau-Daten</p>;

  // Gruppen-Tabelle ist ein Array von Objekten mit 'name' und 'aktion'
  if (data[0]?.name && data[0]?.aktion) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-2 py-1.5 text-muted-foreground">Gruppenname</th>
              <th className="text-left px-2 py-1.5 text-muted-foreground">Typ</th>
              <th className="text-left px-2 py-1.5 text-muted-foreground">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="px-2 py-1.5 font-medium text-foreground">{row.name}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{row.typ}</td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${AKTION_COLORS[row.aktion] || 'bg-secondary text-muted-foreground'}`}>
                    {row.aktion}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map(col => (
              <th key={col} className="text-left px-2 py-1.5 text-muted-foreground capitalize">{col.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 30).map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-secondary/20">
              {columns.map(col => (
                <td key={col} className="px-2 py-1.5 text-foreground max-w-[200px] truncate">
                  {col === 'aktion' ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${AKTION_COLORS[row[col]] || 'bg-secondary text-muted-foreground'}`}>
                      {row[col]}
                    </span>
                  ) : (
                    <span className={row[col]?.startsWith?.('✗') ? 'text-destructive' : row[col]?.startsWith?.('✓') ? 'text-green-400' : ''}>
                      {String(row[col] ?? '–')}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 30 && (
        <p className="text-xs text-muted-foreground text-center py-2">... und {data.length - 30} weitere</p>
      )}
    </div>
  );
}

export default function ImportSchritt({ schritt }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | previewed | running | done | error

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreviewData(null);
    try {
      const res = await base44.functions.invoke(schritt.funktion, schritt.payload('preview', 0));
      const data = res.data;
      // Vorschau-Daten extrahieren
      let preview = data[schritt.previewKey] || [];
      // Bei Gruppen: zeige gruppen-Array zuerst
      if (data.gruppen) preview = data.gruppen;
      setPreviewData({ raw: data, preview });
      setStatus('previewed');
      setExpanded(true);
    } catch (e) {
      setError(e.message || 'Fehler bei der Vorschau');
      setStatus('error');
    }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!window.confirm(`Schritt "${schritt.titel}" wirklich ausführen? Dies ändert Daten in der Datenbank.`)) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('running');

    try {
      if (schritt.batched) {
        // Batched execution
        let offset = 0;
        let gesamt = { updated: 0, created: 0, haesZugewiesen: 0, zugeordnet: 0, nichtGefunden: 0 };

        while (true) {
          const res = await base44.functions.invoke(schritt.funktion, schritt.payload('execute', offset));
          const data = res.data;

          // Stats akkumulieren
          gesamt.updated += data.updated || 0;
          gesamt.created += data.created || 0;
          gesamt.haesZugewiesen += data.haesZugewiesen || 0;
          gesamt.zugeordnet += data.zugeordnet || 0;
          gesamt.nichtGefunden += data.nichtGefunden || 0;

          if (data.done || !data.next_offset) break;
          offset = data.next_offset;

          // Kurze Pause zwischen Batches
          await new Promise(r => setTimeout(r, 300));
        }

        setResult({ ...gesamt, message: 'Alle Batches abgeschlossen' });
      } else {
        const res = await base44.functions.invoke(schritt.funktion, schritt.payload('execute'));
        setResult(res.data);
      }
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Fehler bei der Ausführung');
      setStatus('error');
    }
    setLoading(false);
  };

  const statusColor = {
    idle: 'border-border',
    previewed: 'border-blue-500/40',
    running: 'border-primary/40',
    done: 'border-green-500/40',
    error: 'border-destructive/40',
  }[status];

  const statusBg = {
    done: 'bg-green-500/5',
    error: 'bg-destructive/5',
  }[status] || '';

  return (
    <div className={`bg-card border ${statusColor} ${statusBg} rounded-xl overflow-hidden transition-all`}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
          status === 'done' ? 'bg-green-500/20 text-green-400' :
          status === 'error' ? 'bg-destructive/20 text-destructive' :
          'bg-primary/20 text-primary'
        }`}>
          {status === 'done' ? <CheckCircle size={18} /> :
           status === 'error' ? <AlertCircle size={18} /> :
           schritt.nummer}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground">{schritt.titel}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{schritt.beschreibung}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Vorschau Button */}
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors disabled:opacity-50"
          >
            {loading && status !== 'running' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
            Vorschau
          </button>

          {/* Ausführen Button */}
          <button
            onClick={handleExecute}
            disabled={loading || status === 'running'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
              status === 'done'
                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {loading && status === 'running' ? <Loader2 size={13} className="animate-spin" /> :
             status === 'done' ? <RefreshCw size={13} /> : <Play size={13} />}
            {status === 'done' ? 'Erneut' : 'Ausführen'}
          </button>

          <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-muted-foreground">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Ergebnis-Banner */}
      {result && (
        <div className="mx-5 mb-3 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400 font-medium">✓ {result.message || 'Abgeschlossen'}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
            {result.updated > 0 && <span>{result.updated} aktualisiert</span>}
            {result.created > 0 && <span>{result.created} neu angelegt</span>}
            {result.haesZugewiesen > 0 && <span>{result.haesZugewiesen} Häs zugewiesen</span>}
            {result.zugeordnet > 0 && <span>{result.zugeordnet} Gruppen-Zuordnungen</span>}
            {result.nichtGefunden > 0 && <span className="text-yellow-400">{result.nichtGefunden} nicht gefunden</span>}
          </div>
        </div>
      )}

      {/* Fehler-Banner */}
      {error && (
        <div className="mx-5 mb-3 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Vorschau-Bereich */}
      {expanded && previewData && (
        <div className="border-t border-border bg-secondary/10 p-4">
          {/* Stats der Vorschau */}
          {previewData.raw && (
            <div className="flex flex-wrap gap-3 mb-3">
              {previewData.raw.message && (
                <span className="text-xs text-primary font-medium">{previewData.raw.message}</span>
              )}
              {previewData.raw.zuordnungen_gesamt > 0 && (
                <span className="text-xs text-muted-foreground">{previewData.raw.zuordnungen_gesamt} Zuordnungen gesamt</span>
              )}
              {previewData.raw.total > 0 && (
                <span className="text-xs text-muted-foreground">{previewData.raw.total} Datensätze gesamt</span>
              )}
            </div>
          )}

          {/* Gruppen-Info */}
          {previewData.raw?.gruppen && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Gruppen</p>
              <PreviewTabelle data={previewData.raw.gruppen} columns={['name', 'typ', 'aktion']} />
            </div>
          )}

          {/* Haupt-Vorschau Tabelle */}
          {previewData.preview?.length > 0 && (
            <div>
              {previewData.raw?.gruppen && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Mitglieder-Zuordnungen (Vorschau, max. 30)</p>
              )}
              <PreviewTabelle data={previewData.preview} columns={schritt.previewColumns} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}