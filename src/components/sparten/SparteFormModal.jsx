import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Shield, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYPEN = ['Häsgruppe', 'Tanzgruppe', 'Musikgruppe', 'Sonstige'];
const FARBEN = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#6b7280'];

export default function SparteFormModal({ gruppe, onClose, onSaved }) {
  const isNew = !gruppe;
  const [form, setForm] = useState({
    name: gruppe?.name || '',
    beschreibung: gruppe?.beschreibung || '',
    typ: gruppe?.typ || 'Häsgruppe',
    farbe: gruppe?.farbe || '#f97316',
    aktiv: gruppe?.aktiv !== false,
    verantwortlicher_id: gruppe?.verantwortlicher_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [mitglieder, setMitglieder] = useState([]);

  useEffect(() => {
    base44.entities.Mitglied.list('nachname', 500).then(m => setMitglieder(m.filter(x => !x.archiviert)));
  }, []);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (isNew) {
      await base44.entities.Haesgruppe.create(form);
    } else {
      await base44.entities.Haesgruppe.update(gruppe.id, form);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isNew ? 'Neue Gruppe' : 'Gruppe bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Typ</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPEN.map(t => (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, typ: t }))}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${form.typ === t ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input
              type="text"
              placeholder="z.B. Garde, Showtanzgruppe..."
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
            <textarea
              placeholder="Kurze Beschreibung der Gruppe..."
              value={form.beschreibung}
              onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {FARBEN.map(f => (
                <button key={f} type="button" onClick={() => setForm(p => ({ ...p, farbe: f }))}
                  className={`w-8 h-8 rounded-full transition-all ${form.farbe === f ? 'ring-2 ring-white ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: f }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Verantwortlicher (Spartenleiter)</label>
            <select
              value={form.verantwortlicher_id}
              onChange={e => setForm(p => ({ ...p, verantwortlicher_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">– kein Verantwortlicher –</option>
              {mitglieder.map(m => (
                <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>
              ))}
            </select>
            {form.verantwortlicher_id && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary">
                <Shield size={12} />
                <span>Berechtigungen für diese Person über</span>
                <Link to="/berechtigungen" onClick={onClose} className="underline font-semibold flex items-center gap-1 hover:text-primary/80">
                  Berechtigungen <ExternalLink size={10} />
                </Link>
                <span>verwalten</span>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.aktiv} onChange={e => setForm(p => ({ ...p, aktiv: e.target.checked }))} className="rounded" />
            Gruppe aktiv
          </label>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}