import TimeSelect from '../ui/TimeSelect';
import DateSelect from '../ui/DateSelect';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save } from 'lucide-react';
import MobileSelect from '@/components/MobileSelect';

export default function AusfahrtEditModal({ ausfahrt, sparten, onSave, onClose }) {
  const [formData, setFormData] = useState({
    titel: '',
    typ: 'Umzug',
    datum: '',
    ort: '',
    bus_benoetigt: true,
    abfahrt_zeit: '13:00',
    abfahrt_ort: 'Schulhof Frommern',
    veranstaltungsbeginn: '',
    rueckfahrt_zeit: '',
    aufstellung: '',
    startnummer: '',
    busparkplatz: '',
    bus_kapazitaet: '',
    sparte_auftritt: false,
    sparte_id: '',
    anmeldung_start: '',
    anmeldung_ende: '',
    status: 'Geplant',
    notizen: ''
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ausfahrt) {
      setFormData({
        titel: ausfahrt.titel || '',
        typ: ausfahrt.typ || 'Umzug',
        datum: ausfahrt.datum || '',
        ort: ausfahrt.ort || '',
        bus_benoetigt: ausfahrt.bus_benoetigt !== false,
        abfahrt_zeit: ausfahrt.abfahrt_zeit || '13:00',
        abfahrt_ort: ausfahrt.abfahrt_ort || 'Schulhof Frommern',
        veranstaltungsbeginn: ausfahrt.veranstaltungsbeginn || '',
        rueckfahrt_zeit: ausfahrt.rueckfahrt_zeit || '',
        aufstellung: ausfahrt.aufstellung || '',
        startnummer: ausfahrt.startnummer || '',
        busparkplatz: ausfahrt.busparkplatz || '',
        bus_kapazitaet: ausfahrt.bus_kapazitaet != null ? String(ausfahrt.bus_kapazitaet) : '',
        sparte_auftritt: ausfahrt.sparte_auftritt || false,
        sparte_id: ausfahrt.sparte_id || '',
        anmeldung_start: ausfahrt.anmeldung_start || '',
        anmeldung_ende: ausfahrt.anmeldung_ende || '',
        status: ausfahrt.status || 'Geplant',
        notizen: ausfahrt.notizen || ''
      });
    }
  }, [ausfahrt]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.titel.trim() || !formData.typ || !formData.datum || !formData.ort.trim()) {
      setError('Bitte fülle alle Pflichtfelder aus (Titel, Typ, Datum, Ort).');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        titel: formData.titel.trim(),
        typ: formData.typ,
        datum: formData.datum,
        ort: formData.ort.trim(),
        bus_benoetigt: formData.bus_benoetigt,
        abfahrt_zeit: formData.bus_benoetigt ? formData.abfahrt_zeit : undefined,
        abfahrt_ort: formData.bus_benoetigt ? formData.abfahrt_ort.trim() : undefined,
        veranstaltungsbeginn: formData.veranstaltungsbeginn || undefined,
        rueckfahrt_zeit: formData.bus_benoetigt ? (formData.rueckfahrt_zeit || undefined) : undefined,
        aufstellung: formData.aufstellung.trim() || undefined,
        startnummer: formData.startnummer.trim() || undefined,
        busparkplatz: formData.bus_benoetigt ? (formData.busparkplatz.trim() || undefined) : undefined,
        bus_kapazitaet: formData.bus_benoetigt && formData.bus_kapazitaet ? Number(formData.bus_kapazitaet) : undefined,
        sparte_auftritt: formData.sparte_auftritt,
        sparte_id: formData.sparte_auftritt && formData.sparte_id ? formData.sparte_id : undefined,
        anmeldung_start: formData.anmeldung_start,
        anmeldung_ende: formData.anmeldung_ende,
        status: formData.status,
        notizen: formData.notizen.trim() || undefined
      };
      await base44.entities.Ausfahrt.update(ausfahrt.id, payload);
      onSave();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Unbekannter Fehler';
      setError(`Speichern fehlgeschlagen: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";
  const labelClass = "text-sm text-muted-foreground mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-oswald font-semibold text-foreground tracking-wide">Ausfahrt bearbeiten</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-4 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-destructive hover:text-foreground shrink-0 ml-3">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* Allgemein */}
          <div>
            <h3 className="text-sm font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Allgemeine Informationen</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Titel *</label>
                <input type="text" name="titel" required value={formData.titel} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Typ *</label>
                <MobileSelect
                  value={formData.typ}
                  onChange={v => setFormData(prev => ({ ...prev, typ: v }))}
                  options={[{ label: 'Umzug', value: 'Umzug' }, { label: 'Veranstaltung', value: 'Veranstaltung' }]}
                />
              </div>
              <div>
                <label className={labelClass}>Datum *</label>
                <DateSelect name="datum" required value={formData.datum} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ort *</label>
                <input type="text" name="ort" required value={formData.ort} onChange={handleChange} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Status</label>
                <MobileSelect
                  value={formData.status}
                  onChange={v => setFormData(prev => ({ ...prev, status: v }))}
                  options={['Geplant', 'Anmeldung offen', 'Anmeldung geschlossen', 'Abgeschlossen', 'Abgesagt']}
                />
              </div>
            </div>
          </div>

          {/* Zeiten & Logistik */}
          <div>
            <div className="flex items-center justify-between border-b border-border pb-2 mb-4">
              <h3 className="text-sm font-oswald font-semibold text-foreground">Zeiten & Logistik</h3>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" name="bus_benoetigt" checked={formData.bus_benoetigt} onChange={handleChange}
                  className="w-4 h-4 rounded accent-[#EA2525]" />
                <span className="text-sm font-medium text-foreground">Bus benötigt</span>
              </label>
            </div>
            {formData.bus_benoetigt && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className={labelClass}>Abfahrt</label>
                  <TimeSelect name="abfahrt_zeit" value={formData.abfahrt_zeit} onChange={handleChange} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Abfahrt Ort</label>
                  <input type="text" name="abfahrt_ort" value={formData.abfahrt_ort} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Rückfahrt</label>
                  <TimeSelect name="rueckfahrt_zeit" value={formData.rueckfahrt_zeit} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Bus-Kapazität</label>
                  <input type="number" name="bus_kapazitaet" value={formData.bus_kapazitaet} onChange={handleChange} placeholder="50" min="1" className={inputClass} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>Busparkplatz</label>
                  <input type="text" name="busparkplatz" value={formData.busparkplatz} onChange={handleChange} placeholder="z.B. P3" className={inputClass} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Veranst.-beginn</label>
                <TimeSelect name="veranstaltungsbeginn" value={formData.veranstaltungsbeginn} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Aufstellung & Sparte */}
          <div>
            <h3 className="text-sm font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Aufstellung & Sparte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Aufstellung</label>
                <input type="text" name="aufstellung" value={formData.aufstellung} onChange={handleChange} placeholder="z.B. Hauptstraße" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Startnummer</label>
                <input type="text" name="startnummer" value={formData.startnummer} onChange={handleChange} placeholder="z.B. 12" className={inputClass} />
              </div>
            </div>
            <div className="p-3 bg-secondary/30 border border-border rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="sparte_auftritt" checked={formData.sparte_auftritt} onChange={handleChange} className="w-4 h-4 rounded accent-[#EA2525]" />
                <span className="text-sm font-medium text-foreground">Sparte hat einen Auftritt</span>
              </label>
              {formData.sparte_auftritt && (
                <div className="mt-3">
                  <MobileSelect
                    value={formData.sparte_id}
                    onChange={v => setFormData(prev => ({ ...prev, sparte_id: v }))}
                    options={[{ label: '— Sparte auswählen —', value: '' }, ...sparten.map(s => ({ label: s.name, value: s.id }))]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Anmeldezeitraum */}
          <div>
            <h3 className="text-sm font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Anmeldezeitraum</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Anmeldung Start</label>
                <DateSelect name="anmeldung_start" value={formData.anmeldung_start} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Anmeldung Ende</label>
                <DateSelect name="anmeldung_ende" value={formData.anmeldung_ende} onChange={handleChange} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label className={labelClass}>Notizen</label>
            <textarea name="notizen" rows={3} value={formData.notizen} onChange={handleChange} placeholder="Weitere Informationen…" className={inputClass + " resize-y"} />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border sticky bottom-0 bg-card">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichert…</>
              ) : (
                <><Save size={16} /> Speichern</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}