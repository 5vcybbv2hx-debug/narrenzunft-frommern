import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Check, Save } from 'lucide-react';

const SCHLUESSEL = 'busverantwortliche';

export default function BusverantwortlicheModal({ mitglieder, onClose }) {
  const [selected, setSelected] = useState([]);
  const [einstellungId, setEinstellungId] = useState(null);
  const [suche, setSuche] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.AppEinstellung.filter({ schluessel: SCHLUESSEL });
    if (data[0]) {
      setEinstellungId(data[0].id);
      setSelected(data[0].wert_ids || []);
    }
    setLoading(false);
  };

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    if (einstellungId) {
      await base44.entities.AppEinstellung.update(einstellungId, { wert_ids: selected });
    } else {
      await base44.entities.AppEinstellung.create({ schluessel: SCHLUESSEL, wert_ids: selected });
    }
    setSaving(false);
    onClose(selected);
  };

  const aktive = mitglieder.filter(m => ['Aktiv', 'Passiv mit Häs'].includes(m.mitgliedsstatus));
  const gefiltert = aktive.filter(m =>
    `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-bold text-foreground">🚌 Busverantwortliche</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Diese Personen können bei allen Terminen die Anwesenheit erfassen.</p>
          </div>
          <button onClick={() => onClose(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Ausgewählte */}
        {selected.length > 0 && (
          <div className="px-5 pt-3 shrink-0">
            <p className="text-xs text-muted-foreground mb-2">Ausgewählt ({selected.length}):</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map(id => {
                const m = mitglieder.find(m => m.id === id);
                return m ? (
                  <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                    {m.vorname} {m.nachname}
                    <button onClick={() => toggle(id)} className="hover:text-destructive transition-colors ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Suche */}
        <div className="px-5 py-3 shrink-0">
          <input
            type="text"
            placeholder="Mitglied suchen..."
            value={suche}
            onChange={e => setSuche(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-1">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-[3px] border-border border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {!loading && gefiltert.map(m => {
            const isSelected = selected.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                  isSelected ? 'bg-primary/10 border-primary/30' : 'bg-secondary/30 border-transparent hover:border-border'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                  <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                </div>
                {isSelected && <Check size={15} className="text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}