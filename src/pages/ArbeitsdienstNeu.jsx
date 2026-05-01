import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save } from 'lucide-react';

export default function ArbeitsdienstNeu() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    titel: '',
    datum: '',
    uhrzeit: '',
    ort: '',
    beschreibung: '',
    benoetigte_personen: '',
    status: 'Offen',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      await base44.entities.Arbeitsdienst.create({
        ...form,
        benoetigte_personen: form.benoetigte_personen ? Number(form.benoetigte_personen) : undefined,
      });
      navigate('/arbeitsdienste');
    } catch (e) {}
    setSaving(false);
  };

  const field = (label, field, type = 'text') => (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={form[field] || ''}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Neuer Arbeitsdienst</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {field('Titel *', 'titel')}

        <div className="grid grid-cols-2 gap-3">
          {field('Datum *', 'datum', 'date')}
          {field('Uhrzeit', 'uhrzeit', 'time')}
        </div>

        {field('Ort', 'ort')}
        {field('Benötigte Personen', 'benoetigte_personen', 'number')}

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
          <div className="flex gap-2">
            {['Offen', 'In Planung', 'Abgeschlossen'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                  form.status === s
                    ? s === 'Offen' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                    : s === 'In Planung' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : 'bg-green-500/20 text-green-400 border-green-500/40'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
          <textarea
            value={form.beschreibung || ''}
            onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.titel || !form.datum}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={14} /> {saving ? 'Speichern...' : 'Erstellen'}
        </button>
      </div>
    </div>
  );
}