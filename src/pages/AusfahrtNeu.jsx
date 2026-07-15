import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { ArrowLeft, Save, X } from 'lucide-react';

export default function AusfahrtNeu() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sparten, setSparten] = useState([]);
  const [loadingSparten, setLoadingSparten] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    titel: '',
    typ: 'Umzug',
    datum: '',
    ort: '',
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
    anmeldung_start: todayStr,
    anmeldung_ende: '',
    notizen: ''
  });

  // Auto: Anmelde-Ende = 3 Tage vor Event
  useEffect(() => {
    if (formData.datum) {
      const d = new Date(formData.datum);
      d.setDate(d.getDate() - 3);
      setFormData(prev => ({ ...prev, anmeldung_ende: d.toISOString().split('T')[0] }));
    }
  }, [formData.datum]);

  // Sparten laden
  useEffect(() => {
    (async () => {
      try {
        const resp = await base44.entities.Haesgruppe.list('name', 200);
        setSparten(Array.isArray(resp) ? resp : (resp?.data || []));
      } catch (e) {
        console.error('Sparten laden:', e);
        // Nicht blockieren — Sparten sind optional
      } finally {
        setLoadingSparten(false);
      }
    })();
  }, []);

  if (!user || !isAdmin(user)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-sm text-center">
          <h2 className="text-xl font-oswald font-semibold text-foreground mb-3">Zugriff verweigert</h2>
          <p className="text-sm text-muted-foreground mb-5">Nur Administratoren dürfen Ausfahrten erstellen.</p>
          <Link to="/ausfahrten" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
            <ArrowLeft size={16} /> Zurück
          </Link>
        </div>
      </div>
    );
  }

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

      const today = new Date(todayStr);
      const start = formData.anmeldung_start ? new Date(formData.anmeldung_start) : null;
      const end = formData.anmeldung_ende ? new Date(formData.anmeldung_ende) : null;
      let initialStatus = 'Geplant';
      if (start && end && start <= today && today <= end) initialStatus = 'Anmeldung offen';

      // Payload — nur Felder mit Werten senden, undefined für leere Optionals
      const payload = {
        titel: formData.titel.trim(),
        typ: formData.typ,
        datum: formData.datum,
        ort: formData.ort.trim(),
        abfahrt_zeit: formData.abfahrt_zeit,
        abfahrt_ort: formData.abfahrt_ort.trim(),
        veranstaltungsbeginn: formData.veranstaltungsbeginn || undefined,
        rueckfahrt_zeit: formData.rueckfahrt_zeit || undefined,
        aufstellung: formData.aufstellung.trim() || undefined,
        startnummer: formData.startnummer.trim() || undefined,
        busparkplatz: formData.busparkplatz.trim() || undefined,
        bus_kapazitaet: formData.bus_kapazitaet ? Number(formData.bus_kapazitaet) : undefined,
        sparte_auftritt: formData.sparte_auftritt,
        sparte_id: formData.sparte_auftritt && formData.sparte_id ? formData.sparte_id : undefined,
        anmeldung_start: formData.anmeldung_start,
        anmeldung_ende: formData.anmeldung_ende,
        notizen: formData.notizen.trim() || undefined,
        status: initialStatus
      };

      const created = await base44.entities.Ausfahrt.create(payload);
      if (!created?.id) throw new Error('Keine ID vom Server erhalten');
      navigate(`/ausfahrten/${created.id}`);
    } catch (err) {
      console.error('Fehler beim Erstellen:', err);
      // Zeige die echte Fehlermeldung
      const msg = err?.response?.data?.message || err?.message || 'Unbekannter Fehler';
      setError(`Speichern fehlgeschlagen: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";
  const labelClass = "text-sm text-muted-foreground mb-1.5 block";

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ausfahrten" className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Neue Ausfahrt</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Umzug oder Veranstaltung erstellen</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:text-foreground shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-card border border-border rounded-xl p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Allgemein */}
          <div>
            <h2 className="text-base font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Allgemeine Informationen</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Titel *</label>
                <input type="text" name="titel" required value={formData.titel} onChange={handleChange}
                  placeholder="z.B. Fackelumzug Balingen" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Typ *</label>
                <select name="typ" required value={formData.typ} onChange={handleChange} className={inputClass}>
                  <option value="Umzug">Umzug</option>
                  <option value="Veranstaltung">Veranstaltung</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Datum *</label>
                <input type="date" name="datum" required value={formData.datum} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Ort *</label>
                <input type="text" name="ort" required value={formData.ort} onChange={handleChange}
                  placeholder="z.B. Balingen" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Zeiten */}
          <div>
            <h2 className="text-base font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Zeiten & Logistik</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Abfahrt *</label>
                <input type="time" name="abfahrt_zeit" value={formData.abfahrt_zeit} onChange={handleChange} className={inputClass} />
              </div>
              <div className="col-span-2 sm:col-span-2">
                <label className={labelClass}>Abfahrt Ort</label>
                <input type="text" name="abfahrt_ort" value={formData.abfahrt_ort} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Veranst.-beginn</label>
                <input type="time" name="veranstaltungsbeginn" value={formData.veranstaltungsbeginn} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Rückfahrt</label>
                <input type="time" name="rueckfahrt_zeit" value={formData.rueckfahrt_zeit} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Bus-Kapazität</label>
                <input type="number" name="bus_kapazitaet" value={formData.bus_kapazitaet} onChange={handleChange}
                  placeholder="50" min="1" className={inputClass} />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelClass}>Busparkplatz</label>
                <input type="text" name="busparkplatz" value={formData.busparkplatz} onChange={handleChange}
                  placeholder="z.B. P3" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Aufstellung */}
          <div>
            <h2 className="text-base font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Aufstellung & Programm</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass}>Aufstellung</label>
                <input type="text" name="aufstellung" value={formData.aufstellung} onChange={handleChange}
                  placeholder="z.B. Hauptstraße" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Startnummer</label>
                <input type="text" name="startnummer" value={formData.startnummer} onChange={handleChange}
                  placeholder="z.B. 12" className={inputClass} />
              </div>
            </div>

            {/* Sparte Auftritt */}
            <div className="p-3 bg-secondary/30 border border-border rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" name="sparte_auftritt" checked={formData.sparte_auftritt} onChange={handleChange}
                  className="w-4 h-4 rounded accent-[#EA2525]" />
                <span className="text-sm font-medium text-foreground">Sparte hat einen Auftritt</span>
              </label>
              {formData.sparte_auftritt && (
                <div className="mt-3">
                  {loadingSparten ? (
                    <p className="text-xs text-muted-foreground">Sparten werden geladen…</p>
                  ) : (
                    <select name="sparte_id" value={formData.sparte_id} onChange={handleChange} className={inputClass}>
                      <option value="">— Sparte auswählen —</option>
                      {sparten.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Anmeldezeitraum */}
          <div>
            <h2 className="text-base font-oswald font-semibold text-foreground border-b border-border pb-2 mb-4">Anmeldezeitraum</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Anmeldung Start *</label>
                <input type="date" name="anmeldung_start" required value={formData.anmeldung_start} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Anmeldung Ende *</label>
                <input type="date" name="anmeldung_ende" required value={formData.anmeldung_ende} onChange={handleChange} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Das Ende wird automatisch auf 3 Tage vor dem Event gesetzt.</p>
          </div>

          {/* Notizen */}
          <div>
            <label className={labelClass}>Notizen</label>
            <textarea name="notizen" rows={3} value={formData.notizen} onChange={handleChange}
              placeholder="Weitere Informationen…" className={inputClass + " resize-y"} />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Link to="/ausfahrten" className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground text-center transition-colors">
              Abbrechen
            </Link>
            <button type="submit" disabled={submitting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {submitting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Speichert…</>
              ) : (
                <><Save size={16} /> Ausfahrt erstellen</>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}