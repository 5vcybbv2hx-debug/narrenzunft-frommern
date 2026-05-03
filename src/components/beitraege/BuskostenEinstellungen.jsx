import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Save, X, Bus } from 'lucide-react';

const DEFAULT = {
  pauschalbetrag: 10,
};

export default function BuskostenEinstellungen({ onClose, onSaved }) {
  const [form, setForm] = useState(DEFAULT);
  const [einstellung, setEinstellung] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.AppEinstellung.filter({ schluessel: 'buskosten_einstellungen' }).then(res => {
      if (res[0]?.wert_json) {
        setForm({ ...DEFAULT, ...res[0].wert_json });
        setEinstellung(res[0]);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (einstellung) {
        await base44.entities.AppEinstellung.update(einstellung.id, { wert_json: form });
      } else {
        await base44.entities.AppEinstellung.create({ schluessel: 'buskosten_einstellungen', wert_json: form });
      }
      onSaved(form);
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bus size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Buskosten Einstellungen</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Dieser Betrag wird als Vorschlag beim Erstellen neuer Buskosten-Beiträge vorausgefüllt.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Standard-Pauschalbetrag</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={form.pauschalbetrag}
                onChange={e => setForm(p => ({ ...p, pauschalbetrag: parseFloat(e.target.value) || 0 }))}
                className="w-28 px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <span className="text-sm text-muted-foreground">€ pro Person</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}