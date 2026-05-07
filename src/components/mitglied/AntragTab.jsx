import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Download, Trash2, X, CheckCircle2 } from 'lucide-react';

/**
 * Tab im Mitgliedsprofil für den ausgefüllten Mitgliedsantrag (PDF-Upload)
 * und Anzeige digitaler Anträge die diesem Mitglied zugeordnet sind.
 */
export default function AntragTab({ mitglied, isAdmin }) {
  const [antragPdfUrl, setAntragPdfUrl] = useState(mitglied.antrag_pdf_url || null);
  const [antragPdfName, setAntragPdfName] = useState(mitglied.antrag_pdf_name || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [digitalerAntrag, setDigitalerAntrag] = useState(null);
  const [loadingAntrag, setLoadingAntrag] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => {
    setAntragPdfUrl(mitglied.antrag_pdf_url || null);
    setAntragPdfName(mitglied.antrag_pdf_name || null);
    loadDigitalerAntrag();
  }, [mitglied.id]);

  const loadDigitalerAntrag = async () => {
    setLoadingAntrag(true);
    try {
      const antraege = await base44.entities.Mitgliedsantrag.filter({ mitglied_id: mitglied.id });
      if (antraege.length > 0) setDigitalerAntrag(antraege[0]);
    } catch (e) {}
    setLoadingAntrag(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAntragPdfUrl(file_url);
      setAntragPdfName(file.name);
      // Automatisch am Mitglied speichern
      setSaving(true);
      await base44.entities.Mitglied.update(mitglied.id, {
        antrag_pdf_url: file_url,
        antrag_pdf_name: file.name,
      });
      setSaving(false);
    } catch (err) {
      alert('Upload fehlgeschlagen: ' + err.message);
    }
    setUploading(false);
  };

  const handleRemovePdf = async () => {
    if (!window.confirm('PDF-Antrag entfernen?')) return;
    setSaving(true);
    await base44.entities.Mitglied.update(mitglied.id, {
      antrag_pdf_url: null,
      antrag_pdf_name: null,
    });
    setAntragPdfUrl(null);
    setAntragPdfName(null);
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* PDF Antrag */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
          <FileText size={16} className="text-primary" /> Ausgefüllter Mitgliedsantrag (PDF)
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Hier kann der unterschriebene, eingescannte Antrag hochgeladen werden.
        </p>

        {antragPdfUrl ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={20} className="text-green-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{antragPdfName || 'Antrag.pdf'}</p>
              <a href={antragPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                <Download size={11} /> Öffnen / Herunterladen
              </a>
            </div>
            {isAdmin && (
              <button onClick={handleRemovePdf} disabled={saving}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ) : (
          isAdmin ? (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
              >
                {uploading ? (
                  <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={24} />
                    <span className="text-sm font-medium">PDF oder Scan hochladen</span>
                    <span className="text-xs">.pdf, .png, .jpg</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Kein Antrag hochgeladen.
            </div>
          )
        )}
      </div>

      {/* Digitaler Antrag */}
      {!loadingAntrag && digitalerAntrag && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <FileText size={16} className="text-blue-400" /> Digitaler Antrag
          </h3>
          <div className="space-y-1.5 text-sm">
            <DigRow label="Sparte" value={digitalerAntrag.sparte} />
            <DigRow label="E-Mail" value={digitalerAntrag.email} />
            <DigRow label="IBAN" value={digitalerAntrag.sepa_iban} mono />
            <DigRow label="Status" value={digitalerAntrag.status} />
            {digitalerAntrag.notizen && <DigRow label="Notizen" value={digitalerAntrag.notizen} />}
          </div>
        </div>
      )}
    </div>
  );
}

function DigRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}