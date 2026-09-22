import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ausschussAktion } from '@/lib/ausschussAktionen';
import { Paperclip, X, Download, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * DateienAnhang — Dateianhänge an Sitzung/TOP/Beschluss/Aufgabe/Protokoll/Abstimmung.
 * Metadaten werden als dateien-Array gespeichert (keine eigene Dokument-Entität).
 * Upload via UploadPublicFile, dann ausschussAktion 'datei_anhaengen'.
 */
export default function DateienAnhang({ objekt_typ, objekt_id, dateien, canManage, onSaved, currentMitgliedId }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !objekt_id) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      await ausschussAktion('datei_anhaengen', {
        objekt_typ, objekt_id,
        datei: { name: file.name, url: file_url, typ: file.type, groesse: file.size },
      });
      toast.success('Datei angehängt');
      onSaved?.();
    } catch (err) { toast.error('Upload fehlgeschlagen: ' + err.message); }
    setUploading(false);
    e.target.value = '';
  };

  const handleRemove = async (index) => {
    try {
      await ausschussAktion('datei_entfernen', { objekt_typ, objekt_id, index });
      toast.success('Entfernt');
      onSaved?.();
    } catch (err) { toast.error('Entfernen fehlgeschlagen'); }
  };

  const list = Array.isArray(dateien) ? dateien : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip size={12} /> Dateien ({list.length})
        </span>
        <label className="cursor-pointer flex items-center gap-1.5 text-xs text-primary hover:underline">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? 'Lade…' : 'Hochladen'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading || !objekt_id} />
        </label>
      </div>
      {list.length === 0 && <p className="text-xs text-muted-foreground italic">Keine Dateien.</p>}
      <div className="space-y-1.5">
        {list.map((d, i) => (
          <div key={i} className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
            <Download size={13} className="text-primary shrink-0" />
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-foreground truncate hover:underline">{d.name}</a>
            {canManage && (
              <button onClick={() => handleRemove(i)} className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"><X size={13} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}