import { useState } from 'react';
import { X, Save, Trash2, Search } from 'lucide-react';

const PRIORITAET_FARBEN = {
  'Niedrig':  'bg-gray-500/20 text-gray-400',
  'Mittel':   'bg-blue-500/20 text-blue-400',
  'Hoch':     'bg-orange-500/20 text-orange-400',
  'Dringend': 'bg-red-500/20 text-red-400',
};

export default function TodoForm({ todo, mitglieder, onSave, onDelete, onClose }) {
  const isNew = !todo;
  const [form, setForm] = useState({
    titel: '',
    beschreibung: '',
    status: 'Offen',
    prioritaet: 'Mittel',
    faellig_am: '',
    verantwortliche_ids: [],
    notizen: '',
    ...todo,
  });
  const [suche, setSuche] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const addVerantwortlicher = (id) => {
    if (!form.verantwortliche_ids.includes(id)) {
      set('verantwortliche_ids', [...form.verantwortliche_ids, id]);
    }
    setSuche('');
  };

  const removeVerantwortlicher = (id) => {
    set('verantwortliche_ids', form.verantwortliche_ids.filter(v => v !== id));
  };

  const getMitglied = (id) => mitglieder.find(m => m.id === id);

  const suchErgebnisse = suche.length > 0
    ? mitglieder.filter(m =>
        !form.verantwortliche_ids.includes(m.id) &&
        `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())
      ).slice(0, 6)
    : [];

  const handleSave = async () => {
    if (!form.titel || form.verantwortliche_ids.length === 0) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Aufgabe wirklich löschen?')) return;
    await onDelete(todo.id);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {/* Titel */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Titel *</label>
            <input
              type="text"
              placeholder="Aufgabe beschreiben..."
              value={form.titel}
              onChange={e => set('titel', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
            <textarea
              placeholder="Details..."
              value={form.beschreibung || ''}
              onChange={e => set('beschreibung', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Status & Priorität */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {['Offen', 'In Bearbeitung', 'Erledigt'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Priorität</label>
              <select
                value={form.prioritaet}
                onChange={e => set('prioritaet', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {['Niedrig', 'Mittel', 'Hoch', 'Dringend'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Fällig */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Fällig am</label>
            <input
              type="date"
              value={form.faellig_am || ''}
              onChange={e => set('faellig_am', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {/* Verantwortliche – Pflichtfeld */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">
              Verantwortliche * <span className="text-muted-foreground font-normal">(mind. 1 Person erforderlich)</span>
            </label>

            {/* Ausgewählte */}
            {form.verantwortliche_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.verantwortliche_ids.map(id => {
                  const m = getMitglied(id);
                  if (!m) return null;
                  return (
                    <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      {m.vorname} {m.nachname}
                      <button onClick={() => removeVerantwortlicher(id)} className="hover:text-destructive ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Suche */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Person suchen..."
                value={suche}
                onChange={e => setSuche(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {suchErgebnisse.length > 0 && (
              <div className="mt-1 bg-popover border border-border rounded-xl overflow-hidden">
                {suchErgebnisse.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addVerantwortlicher(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary transition-colors border-b border-border last:border-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    <span className="text-foreground">{m.vorname} {m.nachname}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.mitgliedsstatus}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notizen */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
            <textarea
              value={form.notizen || ''}
              onChange={e => set('notizen', e.target.value)}
              rows={2}
              placeholder="Weitere Hinweise..."
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {!isNew && (
            <button onClick={handleDelete} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.titel || form.verantwortliche_ids.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>

        {form.verantwortliche_ids.length === 0 && form.titel && (
          <p className="text-xs text-destructive mt-2 text-center">Bitte mindestens eine verantwortliche Person zuweisen.</p>
        )}
      </div>
    </div>
  );
}