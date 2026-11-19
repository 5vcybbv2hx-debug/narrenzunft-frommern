import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Stammdaten der eigenen Gruppe bearbeiten (Name, Beschreibung, Farbe).
 *
 * Läuft über die sichere Backend-Function aktualisiereGruppeSicher, weil
 * Haesgruppe per RLS nur für Vorstand/Admin schreibbar ist. Spartenleiter
 * dürfen damit ihre EIGENE Gruppe pflegen; Anlegen, Löschen, Typ und
 * Aktiv-Status bleiben der Führung vorbehalten.
 */
const FARBEN = ['#EA2525', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function GruppeBearbeitenModal({ gruppe, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: gruppe?.name || '',
    beschreibung: gruppe?.beschreibung || '',
    farbe: gruppe?.farbe || '#EA2525',
  });
  const [saving, setSaving] = useState(false);

  const speichern = async () => {
    if (form.name.trim().length < 2) { toast.error('Bitte einen Namen mit mindestens 2 Zeichen angeben.'); return; }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('aktualisiereGruppeSicher', {
        gruppeId: gruppe.id,
        name: form.name,
        beschreibung: form.beschreibung,
        farbe: form.farbe,
      });
      const data = res?.data ?? res;
      if (data?.error) throw new Error(data.error);
      toast.success('Gruppe gespeichert.');
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-xl bg-card border border-border p-4 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-oswald text-lg uppercase tracking-wide text-foreground">Gruppe bearbeiten</h3>
            <p className="text-[11px] text-muted-foreground">Name, Beschreibung und Farbe eurer Sparte</p>
          </div>
          <button onClick={onClose} className="p-1.5 -m-1.5 text-muted-foreground hover:text-foreground" aria-label="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Name</label>
          <input
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary min-h-[42px]"
            placeholder="z. B. Hexengruppe"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
          <textarea
            value={form.beschreibung}
            onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
            placeholder="Kurz, wer dazugehört und was die Gruppe macht"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Farbe</label>
          <div className="flex flex-wrap items-center gap-2">
            {FARBEN.map(f => (
              <button
                key={f}
                onClick={() => setForm(p => ({ ...p, farbe: f }))}
                aria-label={`Farbe ${f}`}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${form.farbe?.toLowerCase() === f.toLowerCase() ? 'border-foreground scale-110' : 'border-border'}`}
                style={{ backgroundColor: f }}
              />
            ))}
            <input
              value={form.farbe}
              onChange={e => setForm(p => ({ ...p, farbe: e.target.value }))}
              className="w-24 px-2 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              placeholder="#EA2525"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm border border-border min-h-[42px]"
          >
            Abbrechen
          </button>
          <button
            onClick={speichern}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 min-h-[42px]"
          >
            <Save size={14} /> {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
// Ende GruppeBearbeitenModal