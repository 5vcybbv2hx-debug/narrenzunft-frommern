import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { ArrowLeft, Save, X } from 'lucide-react';

export default function AusfahrtNeu() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load Sparten (Häsgruppen) for the selector
  const [sparten, setSparten] = useState([]);
  const [loadingSparten, setLoadingSparten] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
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
    sparte_hat_auftritt: false,
    sparte_auftritt_id: '',
    anmeldung_start: todayStr,
    anmeldung_ende: '',
    notizen: ''
  });

  // Calculate default registration end date (3 days before event datum)
  useEffect(() => {
    if (formData.datum) {
      const eventDate = new Date(formData.datum);
      const endLimitDate = new Date(eventDate);
      endLimitDate.setDate(eventDate.getDate() - 3);
      
      const endLimitStr = endLimitDate.toISOString().split('T')[0];
      setFormData((prev) => ({
        ...prev,
        anmeldung_ende: endLimitStr
      }));
    }
  }, [formData.datum]);

  // Load Sparten on Mount
  useEffect(() => {
    async function loadSparten() {
      try {
        setLoadingSparten(true);
        // Using base44.entities.Haesgruppe to load Sparten
        const response = await base44.entities.Haesgruppe.list();
        // Fallback for different API shapes (standard array vs { data: [] })
        const listData = Array.isArray(response) ? response : (response?.data || []);
        setSparten(listData);
      } catch (err) {
        console.error('Fehler beim Laden der Häsgruppen:', err);
        setError('Häsgruppen konnten nicht geladen werden.');
      } finally {
        setLoadingSparten(false);
      }
    }
    loadSparten();
  }, []);

  // Admin Check
  if (!user || !isAdmin(user)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="bg-secondary p-8 rounded-xl max-w-md w-full border border-border text-center">
          <h2 className="text-2xl font-oswald text-primary mb-4">Zugriff verweigert</h2>
          <p className="text-muted-foreground mb-6">Sie haben keine Berechtigung, diese Seite aufzurufen. Nur Administratoren dürfen neue Ausfahrten erstellen.</p>
          <Link to="/ausfahrten" className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-opacity-90 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Form Validation and Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.titel.trim() || !formData.typ || !formData.datum || !formData.ort.trim()) {
      setError('Bitte füllen Sie alle Pflichtfelder aus (Titel, Typ, Datum und Ort).');
      return;
    }

    try {
      setSubmitting(true);

      // Determine initial status based on registration dates
      // Default initial status
      let initialStatus = 'Geplant';
      
      const today = new Date(todayStr);
      const start = formData.anmeldung_start ? new Date(formData.anmeldung_start) : null;
      const end = formData.anmeldung_ende ? new Date(formData.anmeldung_ende) : null;

      if (start && end && start <= today && today <= end) {
        initialStatus = 'Anmeldung offen';
      }

      // Prepare payload
      const payload = {
        titel: formData.titel.trim(),
        typ: formData.typ,
        datum: formData.datum,
        ort: formData.ort.trim(),
        abfahrt_zeit: formData.abfahrt_zeit,
        abfahrt_ort: formData.abfahrt_ort.trim(),
        veranstaltungsbeginn: formData.veranstaltungsbeginn || null,
        rueckfahrt_zeit: formData.rueckfahrt_zeit || null,
        aufstellung: formData.aufstellung.trim() || null,
        startnummer: formData.startnummer.trim() || null,
        busparkplatz: formData.busparkplatz.trim() || null,
        bus_kapazitaet: formData.bus_kapazitaet ? parseInt(formData.bus_kapazitaet, 10) : null,
        sparte_hat_auftritt: formData.sparte_hat_auftritt,
        sparte_auftritt_id: formData.sparte_hat_auftritt ? formData.sparte_auftritt_id : null,
        anmeldung_start: formData.anmeldung_start,
        anmeldung_ende: formData.anmeldung_ende,
        notizen: formData.notizen.trim() || null,
        status: initialStatus
      };

      // Create record
      const createdAusfahrt = await base44.entities.Ausfahrt.create(payload);
      
      // Navigate to detail page
      navigate(`/ausfahrten/${createdAusfahrt.id}`);
    } catch (err) {
      console.error('Fehler beim Erstellen der Ausfahrt:', err);
      setError('Die Ausfahrt konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/ausfahrten" className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-3xl sm:text-4xl font-oswald tracking-wide uppercase">Neue Ausfahrt</h1>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-6 bg-red-950/50 border border-primary text-red-200 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-card border border-border rounded-xl border border-border p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section: Allgemeine Informationen */}
            <div>
              <h2 className="text-lg font-oswald font-semibold border-b border-border pb-2 mb-4">Allgemeine Informationen</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Titel *</label>
                  <input
                    type="text"
                    name="titel"
                    required
                    value={formData.titel}
                    onChange={handleChange}
                    placeholder="z.B. Umzug in Frommern"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Typ *</label>
                  <select
                    name="typ"
                    required
                    value={formData.typ}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="Umzug">Umzug</option>
                    <option value="Veranstaltung">Veranstaltung</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Datum *</label>
                  <input
                    type="date"
                    name="datum"
                    required
                    value={formData.datum}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Ort *</label>
                  <input
                    type="text"
                    name="ort"
                    required
                    value={formData.ort}
                    onChange={handleChange}
                    placeholder="z.B. Frommern"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Section: Zeiten & Logistik */}
            <div>
              <h2 className="text-lg font-oswald font-semibold border-b border-border pb-2 mb-4">Zeiten & Logistik</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Abfahrt Zeit *</label>
                  <input
                    type="time"
                    name="abfahrt_zeit"
                    required
                    value={formData.abfahrt_zeit}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Abfahrt Ort</label>
                  <input
                    type="text"
                    name="abfahrt_ort"
                    value={formData.abfahrt_ort}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Veranstaltungsbeginn</label>
                  <input
                    type="time"
                    name="veranstaltungsbeginn"
                    value={formData.veranstaltungsbeginn}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Rückfahrt Zeit</label>
                  <input
                    type="time"
                    name="rueckfahrt_zeit"
                    value={formData.rueckfahrt_zeit}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Bus-Kapazität</label>
                  <input
                    type="number"
                    name="bus_kapazitaet"
                    value={formData.bus_kapazitaet}
                    onChange={handleChange}
                    placeholder="z.B. 50"
                    min="1"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Busparkplatz</label>
                  <input
                    type="text"
                    name="busparkplatz"
                    value={formData.busparkplatz}
                    onChange={handleChange}
                    placeholder="z.B. P3"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Section: Aufstellung & Programm */}
            <div>
              <h2 className="text-lg font-oswald font-semibold border-b border-border pb-2 mb-4">Aufstellung & Programm</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Aufstellung</label>
                  <input
                    type="text"
                    name="aufstellung"
                    value={formData.aufstellung}
                    onChange={handleChange}
                    placeholder="z.B. Hauptstraße"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Startnummer</label>
                  <input
                    type="text"
                    name="startnummer"
                    value={formData.startnummer}
                    onChange={handleChange}
                    placeholder="z.B. 12"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Sparte hat Auftritt */}
              <div className="mt-4 p-4 bg-secondary/25 border border-border rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="sparte_hat_auftritt"
                    checked={formData.sparte_hat_auftritt}
                    onChange={handleChange}
                    className="w-4 h-4 rounded text-primary focus:ring-primary focus:ring-offset-0 bg-[#080808] border-border"
                  />
                  <span className="text-sm font-medium">Sparte hat einen Auftritt?</span>
                </label>

                {formData.sparte_hat_auftritt && (
                  <div className="mt-3">
                    <label className="text-sm text-muted-foreground mb-1.5 block">Sparte (Häsgruppe) auswählen</label>
                    {loadingSparten ? (
                      <p className="text-xs text-muted-foreground">Spaten werden geladen...</p>
                    ) : (
                      <select
                        name="sparte_auftritt_id"
                        value={formData.sparte_auftritt_id}
                        onChange={handleChange}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="">-- Sparte auswählen --</option>
                        {sparten.map((sparte) => (
                          <option key={sparte.id} value={sparte.id}>
                            {sparte.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section: Anmeldezeitraum */}
            <div>
              <h2 className="text-lg font-oswald font-semibold border-b border-border pb-2 mb-4">Anmeldezeitraum</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Anmeldung Start *</label>
                  <input
                    type="date"
                    name="anmeldung_start"
                    required
                    value={formData.anmeldung_start}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Anmeldung Ende *</label>
                  <input
                    type="date"
                    name="anmeldung_ende"
                    required
                    value={formData.anmeldung_ende}
                    onChange={handleChange}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Section: Notizen */}
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Notizen</label>
              <textarea
                name="notizen"
                rows={4}
                value={formData.notizen}
                onChange={handleChange}
                placeholder="Weitere wichtige Informationen oder Details zur Ausfahrt..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border">
              <Link
                to="/ausfahrten"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-neutral-900 border border-border hover:bg-neutral-800 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                Abbrechen
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-primary text-white hover:bg-opacity-90 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>Speichert...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Ausfahrt erstellen
                  </>
                )}
              </button>
            </div>
            
          </form>
        </div>
      </div>
    </div>
  );
}
