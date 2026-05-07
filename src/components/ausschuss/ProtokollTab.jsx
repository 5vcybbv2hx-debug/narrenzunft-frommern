import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, X, Save, Trash2, FileText, Upload, Eye, EyeOff, Download, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const EMPTY_FORM = {
  titel: '',
  inhalt: '',
  datum: new Date().toISOString().split('T')[0],
  termin_id: '',
  veroeffentlicht: false,
  datei_url: '',
  datei_name: '',
  autor_mitglied_id: '',
};

export default function ProtokollTab({ termine, mitglieder }) {
  const [protokolle, setProtokolle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProtokoll, setEditProtokoll] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await base44.entities.Protokoll.list('-datum', 100);
      setProtokolle(p);
    } catch (e) {}
    setLoading(false);
  };

  const getSitzungsName = (terminId) => {
    const t = termine.find(t => t.id === terminId);
    return t ? t.titel : null;
  };

  const getAutorName = (mitgliedId) => {
    const m = mitglieder.find(m => m.id === mitgliedId);
    return m ? `${m.vorname} ${m.nachname}` : null;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Protokoll wirklich löschen?')) return;
    await base44.entities.Protokoll.delete(id);
    setProtokolle(prev => prev.filter(p => p.id !== id));
  };

  const handleToggleVeroeffentlicht = async (p) => {
    const updated = await base44.entities.Protokoll.update(p.id, { veroeffentlicht: !p.veroeffentlicht });
    setProtokolle(prev => prev.map(x => x.id === p.id ? { ...x, veroeffentlicht: !x.veroeffentlicht } : x));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { setEditProtokoll(null); setShowModal(true); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> Protokoll
        </button>
      </div>

      <div className="space-y-2">
        {protokolle.length === 0 && (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Noch keine Protokolle erfasst</p>
          </div>
        )}
        {protokolle.map(p => (
          <div key={p.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-semibold text-foreground">{p.titel}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.veroeffentlicht ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                    {p.veroeffentlicht ? '✓ Veröffentlicht' : 'Entwurf'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>📅 {format(new Date(p.datum), 'dd.MM.yyyy', { locale: de })}</span>
                  {getSitzungsName(p.termin_id) && <span>📋 {getSitzungsName(p.termin_id)}</span>}
                  {getAutorName(p.autor_mitglied_id) && <span>✍️ {getAutorName(p.autor_mitglied_id)}</span>}
                </div>
                {p.datei_name && (
                  <a
                    href={p.datei_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline"
                  >
                    <Download size={12} /> {p.datei_name}
                  </a>
                )}
                {p.inhalt && !p.datei_url && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 whitespace-pre-wrap">{p.inhalt}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => handleToggleVeroeffentlicht(p)}
                  title={p.veroeffentlicht ? 'Als Entwurf markieren' : 'Veröffentlichen'}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  {p.veroeffentlicht ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={() => { setEditProtokoll(p); setShowModal(true); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ProtokollModal
          protokoll={editProtokoll}
          termine={termine}
          mitglieder={mitglieder}
          onClose={() => { setShowModal(false); setEditProtokoll(null); }}
          onSaved={() => { setShowModal(false); setEditProtokoll(null); loadData(); }}
        />
      )}
    </div>
  );
}

function ProtokollModal({ protokoll, termine, mitglieder, onClose, onSaved }) {
  const isNew = !protokoll;
  const [form, setForm] = useState({ ...EMPTY_FORM, ...protokoll });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modus, setModus] = useState(protokoll?.datei_url ? 'datei' : 'text');
  const fileRef = useRef(null);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('datei_url', file_url);
      set('datei_name', file.name);
    } catch (err) {}
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    const data = { ...form };
    if (modus === 'datei') { data.inhalt = ''; }
    if (modus === 'text') { data.datei_url = ''; data.datei_name = ''; }
    try {
      if (isNew) await base44.entities.Protokoll.create(data);
      else await base44.entities.Protokoll.update(protokoll.id, data);
      onSaved();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Protokoll löschen?')) return;
    await base44.entities.Protokoll.delete(protokoll.id);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isNew ? 'Neues Protokoll' : 'Protokoll bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <input
            type="text" placeholder="Titel *" value={form.titel}
            onChange={e => set('titel', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sitzung</label>
              <select value={form.termin_id || ''} onChange={e => set('termin_id', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                <option value="">–</option>
                {termine.map(t => <option key={t.id} value={t.id}>{t.titel} ({t.datum})</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Verfasser</label>
            <select value={form.autor_mitglied_id || ''} onChange={e => set('autor_mitglied_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
              <option value="">–</option>
              {mitglieder.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
            </select>
          </div>

          {/* Modus Toggle */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Protokoll als</label>
            <div className="flex gap-1 bg-secondary rounded-lg p-1">
              <button type="button" onClick={() => setModus('text')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${modus === 'text' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                <FileText size={14} /> Text verfassen
              </button>
              <button type="button" onClick={() => setModus('datei')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${modus === 'datei' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
                <Upload size={14} /> Datei hochladen
              </button>
            </div>
          </div>

          {modus === 'text' && (
            <textarea
              placeholder="Protokolltext..."
              value={form.inhalt || ''}
              onChange={e => set('inhalt', e.target.value)}
              rows={10}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-y font-mono"
            />
          )}

          {modus === 'datei' && (
            <div>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.odt,.txt" className="hidden" onChange={handleFileUpload} />
              {form.datei_url ? (
                <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <FileText size={18} className="text-green-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium truncate">{form.datei_name}</p>
                    <a href={form.datei_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Vorschau öffnen</a>
                  </div>
                  <button onClick={() => { set('datei_url', ''); set('datei_name', ''); }} className="text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-4 border-border border-t-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={24} />
                      <span className="text-sm font-medium">Datei auswählen</span>
                      <span className="text-xs">PDF, Word, ODT, TXT</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.veroeffentlicht} onChange={e => set('veroeffentlicht', e.target.checked)} className="rounded" />
            ✓ Protokoll veröffentlichen (für alle Ausschussmitglieder sichtbar)
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          {!isNew && (
            <button onClick={handleDelete} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel || !form.datum}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}