import { useState } from 'react';
import { X, Save, Trash2 } from 'lucide-react';

const KATEGORIEN = ['Anhänger', 'Kühlanhänger', 'Bar', 'Zelt', 'Technik', 'Sonstiges'];
const ZUSTAENDE = ['Sehr gut', 'Gut', 'Ausreichend', 'Defekt'];
const FAHRZEUG_KATEGORIEN = ['Anhänger', 'Kühlanhänger'];

export default function AusruestungForm({ ausruestung, onSave, onDelete, onClose }) {
  const isNew = !ausruestung;
  const [form, setForm] = useState({
    name: '', kategorie: 'Sonstiges', beschreibung: '',
    zustand: 'Gut', standort: '', notizen: '',
    kennzeichen: '', baujahr: '', tuev_faellig: '',
    versicherungsnummer: '', versicherung_gueltig_bis: '',
    ...ausruestung,
  });
  const istFahrzeug = FAHRZEUG_KATEGORIEN.includes(form.kategorie);
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const data = { ...form, baujahr: form.baujahr !== '' ? Number(form.baujahr) : undefined };
    await onSave(data);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isNew ? 'Neuer Gegenstand' : 'Gegenstand bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="z.B. Partyanhänger"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Kategorie</label>
            <div className="flex flex-wrap gap-1.5">
              {KATEGORIEN.map(k => (
                <button key={k} type="button" onClick={() => set('kategorie', k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.kategorie === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Zustand</label>
              <select value={form.zustand} onChange={e => set('zustand', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                {ZUSTAENDE.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Standort</label>
              <input value={form.standort || ''} onChange={e => set('standort', e.target.value)}
                placeholder="z.B. Gerätehaus"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
            <textarea value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
            <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>

          {/* Fahrzeug-spezifische Felder */}
          {istFahrzeug && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">🚛 Fahrzeug-Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Kennzeichen</label>
                  <input value={form.kennzeichen || ''} onChange={e => set('kennzeichen', e.target.value)}
                    placeholder="z.B. VS-ZF 123"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Baujahr</label>
                  <input type="number" value={form.baujahr || ''} onChange={e => set('baujahr', e.target.value ? Number(e.target.value) : '')}
                    placeholder="z.B. 2015" min="1900" max="2099"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">TÜV / HU fällig</label>
                  <input type="date" value={form.tuev_faellig || ''} onChange={e => set('tuev_faellig', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Versicherung gültig bis</label>
                  <input type="date" value={form.versicherung_gueltig_bis || ''} onChange={e => set('versicherung_gueltig_bis', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Versicherungsnummer</label>
                <input value={form.versicherungsnummer || ''} onChange={e => set('versicherungsnummer', e.target.value)}
                  placeholder="Police-Nr."
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          {!isNew && (
            <button onClick={() => { if (window.confirm('Gegenstand wirklich entfernen?')) onDelete(ausruestung.id); }}
              className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}