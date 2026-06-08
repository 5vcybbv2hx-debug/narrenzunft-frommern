import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  FileText, Plus, X, Save, Trash2, Upload, Download,
  ShoppingCart, CheckSquare, FileEdit, Sparkles, Loader2, LayoutTemplate
} from 'lucide-react';
import VorlagenModal from './VorlagenModal';

const TYP_ICONS = {
  'Einkaufsliste': ShoppingCart,
  'Checkliste':    CheckSquare,
  'Notiz':         FileEdit,
  'Nachbericht':   FileText,
  'Sonstiges':     FileText,
};

const TYP_COLORS = {
  'Einkaufsliste': 'bg-green-500/20 text-green-400',
  'Checkliste':    'bg-blue-500/20 text-blue-400',
  'Notiz':         'bg-yellow-500/20 text-yellow-400',
  'Nachbericht':   'bg-purple-500/20 text-purple-400',
  'Sonstiges':     'bg-gray-500/20 text-gray-400',
};

const TYPEN = ['Einkaufsliste', 'Checkliste', 'Notiz', 'Nachbericht', 'Sonstiges'];

export default function DokumenteTab({ veranstaltung, isAdmin, veranstaltungsName }) {
  const [dokumente, setDokumente] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showVorlagenModal, setShowVorlagenModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [form, setForm] = useState({ titel: '', typ: 'Notiz', inhalt: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErgebnis, setAiErgebnis] = useState(null);

  useEffect(() => { loadDokumente(); loadVorlagen(); }, [veranstaltung.id]);

  const loadDokumente = async () => {
    setLoading(true);
    try {
      const docs = await base44.entities.VeranstaltungsDokument.filter({ veranstaltung_id: veranstaltung.id });
      setDokumente(docs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (e) {}
    setLoading(false);
  };

  const loadVorlagen = async () => {
    try {
      const v = await base44.entities.DokumentVorlage.list('titel', 100);
      setVorlagen(v);
    } catch (e) {}
  };

  const handleVorlageAnwenden = async (vorlage) => {
    setSaving(true);
    try {
      await base44.entities.VeranstaltungsDokument.create({
        veranstaltung_id: veranstaltung.id,
        titel: vorlage.titel,
        typ: vorlage.typ,
        inhalt: vorlage.inhalt || '',
      });
      loadDokumente();
      setShowVorlagenModal(false);
    } catch (e) {}
    setSaving(false);
  };

  const openNew = () => {
    setEditDoc(null);
    setForm({ titel: '', typ: 'Notiz', inhalt: '' });
    setShowForm(true);
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setForm({ titel: doc.titel, typ: doc.typ, inhalt: doc.inhalt || '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      if (editDoc) {
        await base44.entities.VeranstaltungsDokument.update(editDoc.id, form);
      } else {
        await base44.entities.VeranstaltungsDokument.create({
          ...form,
          veranstaltung_id: veranstaltung.id,
        });
      }
      setShowForm(false);
      loadDokumente();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Dokument löschen?')) return;
    await base44.entities.VeranstaltungsDokument.delete(id);
    loadDokumente();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.VeranstaltungsDokument.create({
        veranstaltung_id: veranstaltung.id,
        titel: file.name.replace(/\.[^/.]+$/, ''),
        typ: 'Sonstiges',
        inhalt: '',
        datei_url: file_url,
        datei_name: file.name,
      });
      loadDokumente();
    } catch (e) {}
    setUploading(false);
    e.target.value = '';
  };

  const handleAiAnalyse = async () => {
    setAiLoading(true);
    setAiErgebnis(null);
    try {
      // Alle Dokumente zu gleichnamigen Veranstaltungen laden
      const alleVeranstaltungen = await base44.entities.Veranstaltung.list('datum', 500);
      const gleichnamige = alleVeranstaltungen.filter(v =>
        v.titel.toLowerCase().includes(veranstaltungsName?.toLowerCase()?.split(' ')[0] || '') &&
        v.id !== veranstaltung.id
      );

      let kontext = `Aktuelle Veranstaltung: ${veranstaltung.titel} (${veranstaltung.datum})\n\n`;
      kontext += `Aktuelle Dokumente:\n`;
      dokumente.forEach(d => {
        kontext += `- ${d.typ}: ${d.titel}\n${d.inhalt ? d.inhalt + '\n' : ''}`;
      });

      if (gleichnamige.length > 0) {
        const vorjahresDoks = await Promise.all(
          gleichnamige.slice(0, 3).map(v =>
            base44.entities.VeranstaltungsDokument.filter({ veranstaltung_id: v.id })
          )
        );
        vorjahresDoks.forEach((doks, i) => {
          if (doks.length > 0) {
            kontext += `\nVorjahresveranstaltung (${gleichnamige[i].datum}):\n`;
            doks.forEach(d => {
              kontext += `- ${d.typ}: ${d.titel}\n${d.inhalt ? d.inhalt + '\n' : ''}`;
            });
          }
        });
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Du bist Planungsassistent für einen Fastnachtsverein. Analysiere die folgenden Dokumente zu einer Vereinsveranstaltung und gib konkrete, praktische Planungshinweise auf Deutsch. Fokus auf: Was könnte vergessen worden sein? Was hat sich bewährt? Was könnte effizienter gemacht werden?\n\n${kontext}`,
        response_json_schema: {
          type: 'object',
          properties: {
            zusammenfassung: { type: 'string' },
            hinweise: { type: 'array', items: { type: 'string' } },
            checkliste_vorschlag: { type: 'array', items: { type: 'string' } },
          }
        }
      });
      setAiErgebnis(result);
    } catch (e) {}
    setAiLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{dokumente.length} Dokumente</p>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => setShowVorlagenModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-border transition-colors"
              >
                <LayoutTemplate size={14} /> Vorlage
              </button>
              <label className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'bg-secondary text-muted-foreground' : 'bg-secondary text-foreground hover:bg-border'}`}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Lädt...' : 'Datei'}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
              <button
                onClick={openNew}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} /> Neu
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dokumente Liste */}
      {dokumente.length === 0 ? (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <FileText size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Dokumente</p>
          {isAdmin && <button onClick={openNew} className="mt-2 text-sm text-primary hover:underline">Erstes Dokument erstellen</button>}
        </div>
      ) : (
        <div className="space-y-2">
          {dokumente.map(doc => {
            const Icon = TYP_ICONS[doc.typ] || FileText;
            return (
              <div key={doc.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TYP_COLORS[doc.typ] || TYP_COLORS['Sonstiges']}`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{doc.titel}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYP_COLORS[doc.typ] || TYP_COLORS['Sonstiges']}`}>{doc.typ}</span>
                    </div>
                    {doc.inhalt && (
                      <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap line-clamp-4">{doc.inhalt}</p>
                    )}
                    {doc.datei_url && (
                      <a href={doc.datei_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
                        <Download size={11} /> {doc.datei_name || 'Datei öffnen'}
                      </a>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(doc)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <FileEdit size={14} />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KI-Analyse */}
      {dokumente.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">KI-Planungsanalyse</p>
            </div>
            <button
              onClick={handleAiAnalyse}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? 'Analysiere...' : 'Analysieren'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Vergleicht Dokumente mit Vorjahren und gibt Planungshinweise.</p>

          {aiErgebnis && (
            <div className="mt-4 space-y-3">
              {aiErgebnis.zusammenfassung && (
                <p className="text-sm text-foreground bg-secondary/50 rounded-lg px-3 py-2">{aiErgebnis.zusammenfassung}</p>
              )}
              {aiErgebnis.hinweise?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">💡 Hinweise</p>
                  <ul className="space-y-1">
                    {aiErgebnis.hinweise.map((h, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="text-primary shrink-0">•</span> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiErgebnis.checkliste_vorschlag?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">✅ Checklisten-Vorschlag</p>
                  <ul className="space-y-1">
                    {aiErgebnis.checkliste_vorschlag.map((item, i) => (
                      <li key={i} className="text-sm text-foreground flex gap-2">
                        <span className="text-green-400 shrink-0">☐</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vorlagen Modal */}
      {showVorlagenModal && (
        <VorlagenModal
          vorlagen={vorlagen}
          onAnwenden={handleVorlageAnwenden}
          onClose={() => setShowVorlagenModal(false)}
          onVorlagenChanged={loadVorlagen}
          saving={saving}
        />
      )}

      {/* Formular Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editDoc ? 'Dokument bearbeiten' : 'Neues Dokument'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Titel *</label>
                <input value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                  placeholder="z.B. Einkaufsliste Getränke"
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1.5">Typ</label>
                <div className="flex flex-wrap gap-1.5">
                  {TYPEN.map(t => (
                    <button key={t} type="button" onClick={() => setForm(p => ({ ...p, typ: t }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.typ === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Inhalt</label>
                <textarea
                  value={form.inhalt}
                  onChange={e => setForm(p => ({ ...p, inhalt: e.target.value }))}
                  rows={8}
                  placeholder="Notizen, Listen, Mengen, Hinweise..."
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Abbrechen</button>
              <button onClick={handleSave} disabled={saving || !form.titel}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} /> {saving ? '...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}