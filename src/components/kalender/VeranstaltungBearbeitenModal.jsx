import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Trash2 } from 'lucide-react';
import { VeranstaltungsDetailsForm } from '@/components/veranstaltung/VeranstaltungsDetails';
import AdresseAutocomplete from '@/components/AdresseAutocomplete';

const EMPTY_AUSWAERTIG = {
  titel: '', typ: 'Umzug', datum: '', uhrzeit: '', ort: '',
  beschreibung: '', anmeldeschluss: '', bus_erforderlich: true,
  anmeldung_aktiv: true, status: 'Geplant', bus_rueckfahrtszeit: '',
  verantwortliche_ids: [],
};

export default function VeranstaltungBearbeitenModal({ veranstaltung, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [externe_vereine, setExterneVereine] = useState([]);

  const istAuswaertig = ['Umzug', 'Abendveranstaltung'].includes(veranstaltung?.typ ?? form.typ);

  useEffect(() => {
    base44.entities.ExternerVerein.list('name', 200).then(setExterneVereine).catch(() => {});
    if (veranstaltung?.id) {
      // Echte Daten nachladen (der normalisierte Termin hat evtl. nicht alle Felder)
      base44.entities.Veranstaltung.get(veranstaltung.id)
        .then(res => { if (res) setForm({ ...res }); })
        .catch(() => setForm({ ...veranstaltung }));
    } else {
      setForm({ ...EMPTY_AUSWAERTIG });
    }
  }, [veranstaltung?.id]);

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      if (veranstaltung?.id) {
        await base44.entities.Veranstaltung.update(veranstaltung.id, form);
      } else {
        await base44.entities.Veranstaltung.create(form);
      }
      onSaved();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!veranstaltung?.id) return;
    if (!window.confirm('Termin wirklich löschen?')) return;
    await base44.entities.Veranstaltung.delete(veranstaltung.id);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-foreground text-lg">
            {veranstaltung ? 'Termin bearbeiten' : 'Neuer auswärtiger Termin'}
          </h3>
          <div className="flex items-center gap-2">
            {veranstaltung?.id && (
              <button onClick={handleDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Titel *"
            value={form.titel || ''}
            onChange={e => set('titel', e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />

          {/* Typ */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Typ</label>
            <div className="flex gap-2">
              {[{ value: 'Umzug', emoji: '🎪' }, { value: 'Abendveranstaltung', emoji: '🎭' }].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('typ', t.value)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    form.typ === t.value
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {t.emoji} {t.value}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'Geplant', emoji: '📅' }, { value: 'Aktiv', emoji: '✅' }, { value: 'Abgeschlossen', emoji: '🏁' }, { value: 'Abgesagt', emoji: '❌' }].map(s => (
                <button key={s.value} type="button" onClick={() => set('status', s.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all border ${form.status === s.value ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                  {s.emoji} {s.value}
                </button>
              ))}
            </div>
          </div>

          {/* Datum / Uhrzeit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
              <input type="date" value={form.datum || ''} onChange={e => set('datum', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Uhrzeit</label>
              <input type="time" value={form.uhrzeit || ''} onChange={e => set('uhrzeit', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <AdresseAutocomplete value={form.ort || ''} onChange={val => set('ort', val)} placeholder="Ort suchen..." />

          <textarea
            placeholder="Beschreibung (optional)"
            value={form.beschreibung || ''}
            onChange={e => set('beschreibung', e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />

          {/* Detailfelder */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
              {form.typ === 'Umzug' ? '🎪 Umzugsinfos' : '🎭 Veranstaltungsinfos'}
            </p>
            <VeranstaltungsDetailsForm data={form} onChange={set} typ={form.typ} />
          </div>

          {/* Bus-Rückfahrt */}
          {form.bus_erforderlich && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-3">🚌 Bus-Rückfahrt</p>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Rückfahrtszeit vom Heimatpunkt</label>
                <input type="time" value={form.bus_rueckfahrtszeit || ''} onChange={e => set('bus_rueckfahrtszeit', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          )}

          {/* Anmeldeschluss & Checkboxen */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Anmeldeschluss</label>
            <input type="date" value={form.anmeldeschluss || ''} onChange={e => set('anmeldeschluss', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <input type="checkbox" checked={!!form.bus_erforderlich} onChange={e => set('bus_erforderlich', e.target.checked)} className="rounded" />
              Bus erforderlich
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <input type="checkbox" checked={form.anmeldung_aktiv !== false} onChange={e => set('anmeldung_aktiv', e.target.checked)} className="rounded" />
              Anmeldung aktiv
            </label>
          </div>

          {/* Externer Verein */}
          <div className="border-t border-border pt-3">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">🤝 Einladung von Verein</label>
            <select value={form.externer_verein_id || ''} onChange={e => set('externer_verein_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
              <option value="">– Kein externer Verein –</option>
              {externe_vereine.map(v => <option key={v.id} value={v.id}>{v.name} ({v.stadt})</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel || !form.datum}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? 'Speichern...' : veranstaltung ? 'Aktualisieren' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}