import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Save, X, Settings } from 'lucide-react';

const DEFAULT_SAETZE = {
  'Aktiv': 60,
  'Passiv': 30,
  'Passiv mit Häs': 45,
  'Leihäs': 40,
  'Jugendliche 11-14': 20,
  'Jungaktive 15-17': 25,
  'Kinder 4-10': 15,
  'Kleinkind 0-3': 0,
  'Ehrenmitglied': 0,
};

export default function BeitraegeEinstellungen({ onClose, onSaved }) {
  const [saetze, setSaetze] = useState(DEFAULT_SAETZE);
  const [einstellung, setEinstellung] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.AppEinstellung.filter({ schluessel: 'beitraege_saetze' }).then(res => {
      if (res[0]?.wert_json) {
        setSaetze({ ...DEFAULT_SAETZE, ...res[0].wert_json });
        setEinstellung(res[0]);
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (einstellung) {
        await base44.entities.AppEinstellung.update(einstellung.id, { wert_json: saetze });
      } else {
        await base44.entities.AppEinstellung.create({ schluessel: 'beitraege_saetze', wert_json: saetze });
      }
      onSaved(saetze);
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Beitragssätze anpassen</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Diese Beträge werden beim Generieren der Jahresbeiträge verwendet.
        </p>

        <div className="space-y-2">
          {Object.entries(saetze).map(([status, betrag]) => (
            <div key={status} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-secondary/50 rounded-lg">
              <label className="text-sm text-foreground flex-1">{status}</label>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min="0"
                  value={betrag}
                  onChange={e => setSaetze(p => ({ ...p, [status]: parseFloat(e.target.value) || 0 }))}
                  className="w-20 px-2 py-1.5 rounded-lg bg-card border border-border text-sm text-foreground text-right focus:outline-none focus:border-primary"
                />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            </div>
          ))}
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