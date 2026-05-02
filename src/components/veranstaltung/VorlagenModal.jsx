import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  X, Plus, Trash2, Save, Copy, LayoutTemplate,
  ShoppingCart, CheckSquare, FileEdit, FileText
} from 'lucide-react';

const TYPEN = ['Einkaufsliste', 'Checkliste', 'Notiz', 'Nachbericht', 'Sonstiges'];

const TYP_COLORS = {
  'Einkaufsliste': 'bg-green-500/20 text-green-400',
  'Checkliste':    'bg-blue-500/20 text-blue-400',
  'Notiz':         'bg-yellow-500/20 text-yellow-400',
  'Nachbericht':   'bg-purple-500/20 text-purple-400',
  'Sonstiges':     'bg-gray-500/20 text-gray-400',
};

const TYP_ICONS = {
  'Einkaufsliste': ShoppingCart,
  'Checkliste':    CheckSquare,
  'Notiz':         FileEdit,
  'Nachbericht':   FileText,
  'Sonstiges':     FileText,
};

export default function VorlagenModal({ vorlagen, onAnwenden, onClose, onVorlagenChanged, saving }) {
  const [ansicht, setAnsicht] = useState('liste'); // 'liste' | 'neu'
  const [editVorlage, setEditVorlage] = useState(null);
  const [form, setForm] = useState({ titel: '', typ: 'Checkliste', inhalt: '', beschreibung: '' });
  const [formSaving, setFormSaving] = useState(false);

  const openNeu = () => {
    setEditVorlage(null);
    setForm({ titel: '', typ: 'Checkliste', inhalt: '', beschreibung: '' });
    setAnsicht('neu');
  };

  const openEdit = (v) => {
    setEditVorlage(v);
    setForm({ titel: v.titel, typ: v.typ, inhalt: v.inhalt || '', beschreibung: v.beschreibung || '' });
    setAnsicht('neu');
  };

  const handleSaveVorlage = async () => {
    if (!form.titel) return;
    setFormSaving(true);
    try {
      if (editVorlage) {
        await base44.entities.DokumentVorlage.update(editVorlage.id, form);
      } else {
        await base44.entities.DokumentVorlage.create(form);
      }
      onVorlagenChanged();
      setAnsicht('liste');
    } catch (e) {}
    setFormSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Vorlage löschen?')) return;
    await base44.entities.DokumentVorlage.delete(id);
    onVorlagenChanged();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={16} className="text-primary" />
            <h3 className="font-bold text-foreground">
              {ansicht === 'neu' ? (editVorlage ? 'Vorlage bearbeiten' : 'Neue Vorlage') : 'Dokumentvorlagen'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {ansicht === 'liste' && (
              <button onClick={openNeu}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Plus size={13} /> Neue Vorlage
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Listenansicht */}
        {ansicht === 'liste' && (
          <div className="p-6">
            {vorlagen.length === 0 ? (
              <div className="text-center py-10">
                <LayoutTemplate size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">Noch keine Vorlagen</p>
                <p className="text-xs text-muted-foreground">Erstelle wiederverwendbare Dokumentvorlagen, z.B. eine Standard-Einkaufsliste.</p>
                <button onClick={openNeu} className="mt-3 text-sm text-primary hover:underline">Erste Vorlage erstellen</button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Wähle eine Vorlage aus, um sie als Dokument für diese Veranstaltung zu übernehmen.</p>
                {vorlagen.map(v => {
                  const Icon = TYP_ICONS[v.typ] || FileText;
                  return (
                    <div key={v.id} className="flex items-start gap-3 bg-secondary/40 border border-border rounded-xl p-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TYP_COLORS[v.typ] || TYP_COLORS['Sonstiges']}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{v.titel}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYP_COLORS[v.typ] || TYP_COLORS['Sonstiges']}`}>{v.typ}</span>
                        </div>
                        {v.beschreibung && <p className="text-xs text-muted-foreground mt-1">{v.beschreibung}</p>}
                        {v.inhalt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">{v.inhalt}</p>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => onAnwenden(v)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          <Copy size={11} /> Verwenden
                        </button>
                        <button onClick={() => openEdit(v)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors text-center">
                          <FileEdit size={12} />
                        </button>
                        <button onClick={() => handleDelete(v.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors text-center">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Neu/Bearbeiten Formular */}
        {ansicht === 'neu' && (
          <div className="p-6 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Titel *</label>
              <input value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                placeholder="z.B. Standard-Einkaufsliste Sonnwendfeier"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Kurzbeschreibung</label>
              <input value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
                placeholder="z.B. Für Feste mit ca. 100 Personen"
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
              <label className="text-xs text-muted-foreground font-medium block mb-1">Vorlagen-Inhalt</label>
              <textarea
                value={form.inhalt}
                onChange={e => setForm(p => ({ ...p, inhalt: e.target.value }))}
                rows={10}
                placeholder="Inhalt der Vorlage, z.B.:&#10;- 50x Bier (0,5l)&#10;- 30x Wasser&#10;- 20x Softdrinks&#10;- Grillkohle&#10;- Grillanzünder"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none font-mono"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setAnsicht('liste')} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Zurück</button>
              <button onClick={handleSaveVorlage} disabled={formSaving || !form.titel}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} /> {formSaving ? '...' : 'Vorlage speichern'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}