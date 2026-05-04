import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannImportieren } from '@/lib/roles';
import { useNavigate } from 'react-router-dom';
import { Database, ArrowLeft, AlertTriangle, Upload, X, FileText } from 'lucide-react';

const IMPORT_SCHRITTE = [
  {
    id: 'gruppen',
    nummer: 1,
    titel: 'Sparten & Gruppen + Mitglieder-Zuordnungen',
    beschreibung: 'Gruppen aus CSV anlegen und Mitglieder den Gruppen zuordnen.',
    felder: ['gruppen_text', 'personen_text', 'mitgliedschaft_gruppen_text'],
    feldLabels: { gruppen_text: 'Gruppen CSV', personen_text: 'Personen CSV', mitgliedschaft_gruppen_text: 'Mitgliedschaft-Gruppen CSV' },
    funktion: 'importGruppenCSV',
  },
  {
    id: 'personen',
    nummer: 2,
    titel: 'Mitglieder-Stammdaten',
    beschreibung: 'Personen abgleichen: Adresse, Geburtsdatum, Telefon, E-Mail aktualisieren.',
    felder: ['personen_text', 'kontakte_text', 'adressen_text'],
    feldLabels: { personen_text: 'Personen CSV', kontakte_text: 'Kontakte CSV', adressen_text: 'Adressen CSV' },
    funktion: 'importPersonenCSV',
    batched: true,
    limit: 20,
  },
  {
    id: 'haes',
    nummer: 3,
    titel: 'Häs-Zuweisungen',
    beschreibung: 'Häs-Nummern aus CSV den richtigen Personen zuweisen.',
    felder: ['haes_text', 'personen_text', 'gruppen_text', 'mitgliedschaft_gruppen_text'],
    feldLabels: { haes_text: 'Häs CSV', personen_text: 'Personen CSV', gruppen_text: 'Gruppen CSV', mitgliedschaft_gruppen_text: 'Mitgliedschaft-Gruppen CSV' },
    funktion: 'importHaesCSV',
    batched: true,
    limit: 50,
  },
];

function DateiUpload({ label, onUploaded, uploadedName, onClear }) {
  const [reading, setReading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUploaded(ev.target.result, file.name);
      setReading(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  if (uploadedName) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
        <FileText size={14} className="text-green-400 shrink-0" />
        <span className="text-xs text-green-400 flex-1 truncate">{label}: {uploadedName} ✓</span>
        <button onClick={onClear} className="text-muted-foreground hover:text-destructive transition-colors"><X size={13} /></button>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary border border-border border-dashed cursor-pointer hover:border-primary/50 transition-colors">
      {reading ? (
        <div className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />
      ) : (
        <Upload size={14} className="text-muted-foreground shrink-0" />
      )}
      <span className="text-xs text-muted-foreground">{reading ? 'Lese...' : label + ' auswählen'}</span>
      <input type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={reading} />
    </label>
  );
}

function ImportSchritt({ schritt }) {
  const [texte, setTexte] = useState({});
  const [namen, setNamen] = useState({});
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const alleHochgeladen = schritt.felder.every(f => texte[f]);

  const buildPayload = (mode, offset = 0) => {
    const p = { mode, ...texte };
    if (schritt.batched) {
      p.offset = offset;
      p.limit = schritt.limit || 20;
    }
    return p;
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    const res = await base44.functions.invoke(schritt.funktion, buildPayload('preview', 0));
    const data = res.data;
    setPreview(data);
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!window.confirm(`Schritt "${schritt.titel}" wirklich ausführen? Dies ändert Daten in der Datenbank.`)) return;
    setLoading(true);
    setError(null);
    setResult(null);

    if (schritt.batched) {
      let offset = 0;
      let total = null;
      let gesamt = { updated: 0, created: 0, haesZugewiesen: 0 };
      while (true) {
        const res = await base44.functions.invoke(schritt.funktion, buildPayload('execute', offset));
        const data = res.data;
        if (total === null) total = data.total || 0;
        setProgress({ current: Math.min(offset + (data.processed || schritt.limit), total), total });
        gesamt.updated += data.updated || 0;
        gesamt.created += data.created || 0;
        gesamt.haesZugewiesen += data.haesZugewiesen || 0;
        if (data.done || !data.next_offset) break;
        offset = data.next_offset;
        await new Promise(r => setTimeout(r, 1500));
      }
      setProgress(null);
      setResult({ ...gesamt, message: 'Abgeschlossen' });
    } else {
      const res = await base44.functions.invoke(schritt.funktion, buildPayload('execute'));
      setResult(res.data);
    }
    setLoading(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
          {schritt.nummer}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-sm">{schritt.titel}</h3>
          <p className="text-xs text-muted-foreground">{schritt.beschreibung}</p>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {schritt.felder.map(f => (
          <DateiUpload
            key={f}
            label={schritt.feldLabels[f]}
            uploadedName={namen[f]}
            onUploaded={(text, name) => {
              setTexte(p => ({ ...p, [f]: text }));
              setNamen(p => ({ ...p, [f]: name }));
            }}
            onClear={() => {
              setTexte(p => { const n = { ...p }; delete n[f]; return n; });
              setNamen(p => { const n = { ...p }; delete n[f]; return n; });
            }}
          />
        ))}

        {/* Fortschritt */}
        {progress && (
          <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-primary">{progress.current} / {progress.total}</span>
              <span className="text-xs text-muted-foreground">{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Ergebnis */}
        {result && (
          <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 font-medium">✓ {result.message || 'Abgeschlossen'}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {result.updated > 0 && <span>{result.updated} aktualisiert</span>}
              {result.created > 0 && <span>{result.created} neu angelegt</span>}
              {result.haesZugewiesen > 0 && <span>{result.haesZugewiesen} Häs zugewiesen</span>}
              {result.nichtGefunden > 0 && <span className="text-yellow-400">{result.nichtGefunden} nicht gefunden</span>}
            </div>
          </div>
        )}

        {/* Fehler */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Vorschau */}
        {preview && (
          <div className="bg-secondary/30 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Vorschau</p>
            <p>{preview.message || `${preview.total || 0} Datensätze gefunden`}</p>
            {preview.total > 0 && (
              <p className="mt-0.5">Update: {(preview.preview || []).filter(p => p.aktion === 'update').length} · Neu: {(preview.preview || []).filter(p => p.aktion === 'create').length}</p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handlePreview}
            disabled={!alleHochgeladen || loading}
            className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:text-foreground disabled:opacity-40 transition-colors"
          >
            {loading && !progress ? 'Lade...' : 'Vorschau'}
          </button>
          <button
            onClick={handleExecute}
            disabled={!alleHochgeladen || loading}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 transition-colors"
          >
            {loading && progress ? 'Läuft...' : 'Ausführen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DatenImport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!kannImportieren(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertTriangle size={40} className="text-destructive mb-3" />
        <p className="text-foreground font-semibold">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">Nur Administratoren können Daten importieren.</p>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database size={22} className="text-primary" /> Daten-Import
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">CSV-Dateien hochladen und schrittweise importieren</p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-300">
          <strong>Wichtig:</strong> Schritte der Reihe nach ausführen. Erst Vorschau prüfen, dann ausführen.
          Schritt 1 (Gruppen) muss vor Schritt 2 und 3 abgeschlossen sein.
        </p>
      </div>

      <div className="space-y-4">
        {IMPORT_SCHRITTE.map(schritt => (
          <ImportSchritt key={schritt.id} schritt={schritt} />
        ))}
      </div>
    </div>
  );
}