import { useState } from 'react';
import { X, Save, Trash2, Search, AlertTriangle } from 'lucide-react';

const PRIORITAET_FARBEN = {
  'Niedrig':  'bg-neutral-700 text-neutral-300',
  'Mittel':   'bg-blue-900/30 text-blue-400 border border-blue-700/30',
  'Hoch':     'bg-primary/15 text-primary',
  'Dringend': 'bg-red-900/20 text-red-400 border border-red-700/30',
};

const inputCls = "w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white focus:outline-none focus:border-primary transition-colors";
const labelCls = "text-xs text-muted-foreground font-medium block mb-1";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    try {
      await onSave(form);
    } catch (e) {
      console.error('Todo speichern:', e);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await onDelete(todo.id);
    } catch (e) {
      console.error('Todo löschen:', e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          {/* Titel */}
          <div>
            <label className={labelCls}>Titel *</label>
            <input type="text" placeholder="Aufgabe beschreiben…" value={form.titel} onChange={e => set('titel', e.target.value)} className={inputCls} />
          </div>

          {/* Beschreibung */}
          <div>
            <label className={labelCls}>Beschreibung</label>
            <textarea placeholder="Details…" value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {/* Status & Priorität */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                {['Offen', 'In Bearbeitung', 'Erledigt'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priorität</label>
              <select value={form.prioritaet} onChange={e => set('prioritaet', e.target.value)} className={inputCls}>
                {['Niedrig', 'Mittel', 'Hoch', 'Dringend'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Fällig */}
          <div>
            <label className={labelCls}>Fällig am</label>
            <input type="date" value={form.faellig_am || ''} onChange={e => set('faellig_am', e.target.value)} className={inputCls} />
          </div>

          {/* Verantwortliche – Pflichtfeld */}
          <div>
            <label className={labelCls}>
              Verantwortliche * <span className="font-normal">(mind. 1 Person erforderlich)</span>
            </label>

            {form.verantwortliche_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.verantwortliche_ids.map(id => {
                  const m = getMitglied(id);
                  if (!m) return null;
                  return (
                    <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
                      {m.vorname} {m.nachname}
                      <button onClick={() => removeVerantwortlicher(id)} className="hover:text-red-400 ml-0.5"><X size={11} /></button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Suche */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" placeholder="Person suchen…" value={suche} onChange={e => setSuche(e.target.value)}
                className={`${inputCls} pl-8`} />
            </div>

            {suchErgebnisse.length > 0 && (
              <div className="mt-1 bg-popover border border-border rounded-xl overflow-hidden">
                {suchErgebnisse.map(m => (
                  <button key={m.id} onClick={() => addVerantwortlicher(m.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-800 transition-colors border-b border-border last:border-0">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    <span className="text-white">{m.vorname} {m.nachname}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.mitgliedsstatus}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notizen */}
          <div>
            <label className={labelCls}>Notizen</label>
            <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={2} placeholder="Weitere Hinweise…" className={`${inputCls} resize-none`} />
          </div>
        </div>

        {/* Delete Confirm */}
        {confirmDelete && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/30 mt-3">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-400 flex-1">Aufgabe wirklich löschen?</span>
            <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-white">Abbrechen</button>
            <button onClick={handleDelete} className="text-xs px-3 py-1 rounded bg-red-900/80 text-white font-medium">Löschen</button>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {!isNew && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm hover:text-white transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel || form.verantwortliche_ids.length === 0}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
            <Save size={14} /> {saving ? '…' : 'Speichern'}
          </button>
        </div>

        {form.verantwortliche_ids.length === 0 && form.titel && (
          <p className="text-xs text-red-400 mt-2 text-center">Bitte mindestens eine verantwortliche Person zuweisen.</p>
        )}
      </div>
    </div>
  );
}
