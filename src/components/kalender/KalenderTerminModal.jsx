import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Trash2 } from 'lucide-react';

const TERMINARTEN = ['Umzug','Abendveranstaltung','Arbeitsdienst','Ausschusssitzung','Vorstandssitzung','Jugendtermin','Gruppen-Termin','Intern','Sonstiges'];
const SICHTBARKEITEN = [
  { value: 'alle', label: 'Alle Mitglieder' },
  { value: 'admin', label: 'Nur Admin/Vorstand' },
  { value: 'ausschuss', label: 'Nur Ausschuss' },
  { value: 'verantwortliche', label: 'Nur Verantwortliche' },
  { value: 'haesgruppe', label: 'Nur bestimmte Häsgruppe' },
  { value: 'eingeladen', label: 'Nur Eingeladene' },
];

export default function KalenderTerminModal({ termin, onClose, onSaved }) {
  const isNew = !termin;
  const [form, setForm] = useState({
    titel: '', beschreibung: '', datum: '', startzeit: '', endzeit: '',
    ort: '', terminart: 'Intern', sichtbarkeit: 'alle',
    abonnierbar: true, anmeldbar: false, anmeldeschluss: '', max_teilnehmer: '',
    status: 'Geplant',
    ...termin,
  });
  const [saving, setSaving] = useState(false);
  const [haesgruppen, setHaesgruppen] = useState([]);

  useEffect(() => {
    base44.entities.Haesgruppe.list('name', 100).then(setHaesgruppen).catch(() => {});
  }, []);

  const set = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.KalenderTermin.create(form);
      } else {
        await base44.entities.KalenderTermin.update(termin.id, form);
      }
      onSaved();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Termin wirklich löschen?')) return;
    await base44.entities.KalenderTermin.delete(termin.id);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-foreground text-lg">{isNew ? 'Neuer Termin' : 'Termin bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="text" placeholder="Titel *" value={form.titel}
            onChange={e => set('titel', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />

          {/* Terminart */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Terminart</label>
            <div className="flex flex-wrap gap-1.5">
              {TERMINARTEN.map(art => (
                <button key={art} type="button" onClick={() => set('terminart', art)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.terminart === art ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                  {art}
                </button>
              ))}
            </div>
          </div>

          {/* Datum & Zeiten */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Startzeit</label>
              <input type="time" value={form.startzeit} onChange={e => set('startzeit', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Endzeit</label>
              <input type="time" value={form.endzeit} onChange={e => set('endzeit', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <input type="text" placeholder="Ort" value={form.ort} onChange={e => set('ort', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />

          <textarea placeholder="Beschreibung" value={form.beschreibung} onChange={e => set('beschreibung', e.target.value)}
            rows={2} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />

          {/* Sichtbarkeit */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Sichtbarkeit</label>
            <select value={form.sichtbarkeit} onChange={e => set('sichtbarkeit', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
              {SICHTBARKEITEN.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {form.sichtbarkeit === 'haesgruppe' && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Häsgruppe</label>
              <select value={form.haesgruppe_id || ''} onChange={e => set('haesgruppe_id', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                <option value="">Bitte wählen...</option>
                {haesgruppen.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
            <div className="flex gap-2">
              {['Geplant','Aktiv','Abgeschlossen','Abgesagt'].map(s => (
                <button key={s} type="button" onClick={() => set('status', s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${form.status === s ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Optionen */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <input type="checkbox" checked={form.abonnierbar} onChange={e => set('abonnierbar', e.target.checked)} className="rounded" />
              Abonnierbar (ICS)
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <input type="checkbox" checked={form.anmeldbar} onChange={e => set('anmeldbar', e.target.checked)} className="rounded" />
              Anmeldung möglich
            </label>
          </div>

          {form.anmeldbar && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Anmeldeschluss</label>
                <input type="date" value={form.anmeldeschluss || ''} onChange={e => set('anmeldeschluss', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Max. Teilnehmer</label>
                <input type="number" min="0" value={form.max_teilnehmer || ''} onChange={e => set('max_teilnehmer', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          {!isNew && (
            <button onClick={handleDelete} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel || !form.datum}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : isNew ? 'Erstellen' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}