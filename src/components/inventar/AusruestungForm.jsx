import DateSelect from '../ui/DateSelect';
import { useState } from 'react';
import { X, Save, Trash2, Truck, AlertCircle, QrCode } from 'lucide-react';
import MobileSelect from '../MobileSelect';
import MitgliedLiveSuche from '../MitgliedLiveSuche';
import { verleihZustaendigeIds } from '../../lib/verleih';

const KATEGORIEN = ['Anhänger', 'Kühlanhänger', 'Bar', 'Zelt', 'Technik', 'Sonstiges'];
const ZUSTAENDE = ['Sehr gut', 'Gut', 'Ausreichend', 'Defekt'];
const FAHRZEUG_KATEGORIEN = ['Anhänger', 'Kühlanhänger'];

export default function AusruestungForm({ ausruestung, mitglieder = [], onSave, onDelete, onClose }) {
  const isNew = !ausruestung;
  const [form, setForm] = useState({
    name: '', kategorie: 'Sonstiges', beschreibung: '',
    zustand: 'Gut', standort: '', notizen: '',
    kennzeichen: '', baujahr: '', tuev_faellig: '',
    versicherungsnummer: '', versicherung_gueltig_bis: '',
    bestand: 1, verfuegbar_override: '',
    verleihbar: false, verleih_preis: 0, verleih_preis_mitglied: '', verleih_kaution: 0,
    verleih_notiz: '', verleih_verantwortlicher_id: '',
    ...ausruestung,
  });
  const istFahrzeug = FAHRZEUG_KATEGORIEN.includes(form.kategorie);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...form,
        baujahr: form.baujahr !== '' ? Number(form.baujahr) : undefined,
        bestand: form.bestand ? Number(form.bestand) : 1,
        verfuegbar_override: form.verfuegbar_override !== '' && form.verfuegbar_override != null ? Number(form.verfuegbar_override) : undefined,
        verleihbar: !!form.verleihbar,
        verleih_preis: Number(form.verleih_preis) || 0,
        verleih_preis_mitglied: form.verleih_preis_mitglied === '' || form.verleih_preis_mitglied == null
          ? form.verleih_preis : Number(form.verleih_preis_mitglied),
        verleih_kaution: Number(form.verleih_kaution) || 0,
      };
      await onSave(data);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern des Gegenstands.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-secondary border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald uppercase tracking-wide font-bold text-foreground">
            {isNew ? 'Neuer Gegenstand' : 'Gegenstand bearbeiten'}
          </h3>
          <button onClick={onClose} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-white">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-900/20 border border-red-700/30 text-sm text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Fehler</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs">Schließen</button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="z.B. Partyanhänger"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Kategorie</label>
            <div className="flex flex-wrap gap-1.5">
              {KATEGORIEN.map(k => (
                <button key={k} type="button" onClick={() => set('kategorie', k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.kategorie === k ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Zustand</label>
              <MobileSelect value={form.zustand} onChange={v => set('zustand', v)}
                options={ZUSTAENDE} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Standort</label>
              <input value={form.standort || ''} onChange={e => set('standort', e.target.value)}
                placeholder="z.B. Gerätehaus"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Bestand (Stück)</label>
              <input type="number" value={form.bestand ?? 1} onChange={e => set('bestand', e.target.value ? Number(e.target.value) : 1)}
                placeholder="z.B. 8" min="1"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Verfügbar (Override)</label>
              <input type="number" value={form.verfuegbar_override ?? ''} onChange={e => set('verfuegbar_override', e.target.value ? Number(e.target.value) : '')}
                placeholder="auto" min="0"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
            <textarea value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
            <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>

          {/* Fahrzeug-spezifische Felder */}
          {istFahrzeug && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Truck size={14} /> Fahrzeug-Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Kennzeichen</label>
                  <input value={form.kennzeichen || ''} onChange={e => set('kennzeichen', e.target.value)}
                    placeholder="z.B. VS-ZF 123"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Baujahr</label>
                  <input type="number" value={form.baujahr || ''} onChange={e => set('baujahr', e.target.value ? Number(e.target.value) : '')}
                    placeholder="z.B. 2015" min="1900" max="2099"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">TÜV / HU fällig</label>
                  <DateSelect name="tuev_faellig" value={form.tuev_faellig || ''} onChange={e => set('tuev_faellig', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Versicherung gültig bis</label>
                  <DateSelect name="versicherung_gueltig_bis" value={form.versicherung_gueltig_bis || ''} onChange={e => set('versicherung_gueltig_bis', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Versicherungsnummer</label>
                <input value={form.versicherungsnummer || ''} onChange={e => set('versicherungsnummer', e.target.value)}
                  placeholder="Police-Nr."
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          )}

          {/* Verleih per QR-Code */}
          <div className="border-t border-border pt-3 space-y-3">
            <button type="button" onClick={() => set('verleihbar', !form.verleihbar)}
              className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between transition-colors ${form.verleihbar ? 'bg-primary/15 text-primary border border-primary/40' : 'bg-secondary text-muted-foreground border border-border hover:text-white'}`}>
              <span className="flex items-center gap-2"><QrCode size={15} /> Öffentlicher Verleih per QR-Code</span>
              <span className={`w-10 h-5 rounded-full relative transition-colors ${form.verleihbar ? 'bg-primary' : 'bg-border'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.verleihbar ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>

            {form.verleihbar && (
              <div className="space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Miete pro Tag – extern (€)</label>
                    <input type="number" min="0" step="0.5" value={form.verleih_preis ?? 0} onChange={e => set('verleih_preis', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Miete pro Tag – Mitglieder (€)</label>
                    <input type="number" min="0" step="0.5" placeholder={String(form.verleih_preis ?? 0)} value={form.verleih_preis_mitglied ?? ''} onChange={e => set('verleih_preis_mitglied', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                    <p className="text-[10px] text-muted-foreground mt-1">Leer lassen = wie extern</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Kaution (€)</label>
                    <input type="number" min="0" step="0.5" value={form.verleih_kaution ?? 0} onChange={e => set('verleih_kaution', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Zuständige für Anfragen (mehrere möglich)</label>
                  {(() => {
                    const ids = verleihZustaendigeIds(form.verleih_verantwortlicher_id);
                    return (
                      <>
                        {ids.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {ids.map(id => {
                              const m = mitglieder.find(x => x.id === id);
                              return m ? (
                                <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                                  {m.vorname} {m.nachname}
                                  <button type="button" title="Zuständigen entfernen"
                                    onClick={() => set('verleih_verantwortlicher_id', ids.filter(x => x !== id).join(','))}
                                    className="hover:text-destructive transition-colors ml-0.5"><X size={11} /></button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <MitgliedLiveSuche
                          mitglieder={mitglieder.filter(m => !ids.includes(m.id))}
                          value=""
                          onSelect={(m) => set('verleih_verantwortlicher_id', [...ids, m.id].join(','))}
                          placeholder="Zuständige/n suchen…"
                        />
                      </>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Öffentliche Hinweise (auf der QR-Seite sichtbar)</label>
                  <textarea value={form.verleih_notiz || ''} onChange={e => set('verleih_notiz', e.target.value)} rows={2}
                    placeholder="z.B. Nur an Selbstabholer, Rückgabe gereinigt, Barzahlung bei Abholung…"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inline confirm UI for deletion */}
        {showConfirmDelete && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-700/30 text-xs">
            <p className="text-red-400 font-semibold mb-2 flex items-center gap-1">
              <AlertCircle size={14} /> Gegenstand wirklich entfernen?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete(ausruestung.id);
                  setShowConfirmDelete(false);
                }}
                className="px-2.5 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Ja, löschen
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-2.5 py-1.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {!isNew && !showConfirmDelete && (
            <button onClick={() => setShowConfirmDelete(true)}
              className="p-2.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-700 transition-colors">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}