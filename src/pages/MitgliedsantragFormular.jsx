import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';

const SPARTEN = ['Brennnesseln', 'Hexen', 'Zäpfle Bomber', 'Garde'];

const STEPS = ['Persönliches', 'Adresse & Kontakt', 'Sparte & SEPA', 'Abschluss'];

export default function MitgliedsantragFormular() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    vorname: '', nachname: '', geburtsdatum: '',
    strasse: '', plz: '', ort: '',
    telefon: '', handy: '', email: '',
    sparte: '', eintrittsdatum: new Date().toISOString().split('T')[0],
    sepa_kontoinhaber: '', sepa_iban: '', sepa_bic: '',
    sepa_ort: '', sepa_datum: new Date().toISOString().split('T')[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [eingereichtVon, setEingereichtVon] = useState(null);

  useEffect(() => {
    // Eingereichter Benutzer ermitteln (optional – Vorstand/Spartenleiter)
    base44.auth.me().then(u => setEingereichtVon(u)).catch(() => {});
    // Mitglied des Users laden um ID zu ermitteln
  }, []);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let eingereichtVonMitgliedId = null;
      if (eingereichtVon) {
        const mitglieder = await base44.entities.Mitglied.filter({ user_id: eingereichtVon.id });
        if (mitglieder[0]) eingereichtVonMitgliedId = mitglieder[0].id;
      }
      await base44.entities.Mitgliedsantrag.create({
        ...form,
        status: 'Neu',
        eingereicht_von_mitglied_id: eingereichtVonMitgliedId,
      });
      setSubmitted(true);
    } catch (e) {
      setError('Fehler beim Einreichen. Bitte erneut versuchen.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 size={52} className="text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Antrag eingereicht!</h2>
          <p className="text-muted-foreground text-sm">
            Der Mitgliedsantrag von <strong className="text-foreground">{form.vorname} {form.nachname}</strong> wurde erfolgreich gespeichert.
            Der Vorstand wird ihn prüfen und sich melden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-2xl font-bold text-foreground">Mitgliedsantrag</h1>
          <p className="text-sm text-muted-foreground mt-1">Narrenzunft Frommern e.V.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex items-center gap-1">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-border'}`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-5">Schritt {step + 1} von {STEPS.length}: <span className="text-foreground font-medium">{STEPS[step]}</span></p>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">

          {/* STEP 0: Persönliches */}
          {step === 0 && (
            <>
              <h2 className="font-bold text-foreground">Persönliche Daten</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Vorname *</label>
                  <input value={form.vorname} onChange={e => set('vorname', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Nachname *</label>
                  <input value={form.nachname} onChange={e => set('nachname', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Geburtsdatum</label>
                <input type="date" value={form.geburtsdatum} onChange={e => set('geburtsdatum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Eintrittsdatum (ab)</label>
                <input type="date" value={form.eintrittsdatum} onChange={e => set('eintrittsdatum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          {/* STEP 1: Adresse & Kontakt */}
          {step === 1 && (
            <>
              <h2 className="font-bold text-foreground">Adresse & Kontakt</h2>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Straße</label>
                <input value={form.strasse} onChange={e => set('strasse', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">PLZ</label>
                  <input value={form.plz} onChange={e => set('plz', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
                  <input value={form.ort} onChange={e => set('ort', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Telefon</label>
                  <input value={form.telefon} onChange={e => set('telefon', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Handy</label>
                  <input value={form.handy} onChange={e => set('handy', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">E-Mail</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          {/* STEP 2: Sparte & SEPA */}
          {step === 2 && (
            <>
              <h2 className="font-bold text-foreground">Sparte & SEPA-Mandat</h2>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-2">Gewünschte Sparte *</label>
                <div className="grid grid-cols-2 gap-2">
                  {SPARTEN.map(s => (
                    <button key={s} type="button" onClick={() => set('sparte', s)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all ${form.sparte === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">SEPA-Lastschriftmandat</p>
                <p className="text-xs text-muted-foreground">Gläubiger-ID: DE 76 ZZZ0 0000 7381 29</p>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Name & Anschrift Kontoinhaber</label>
                  <input value={form.sepa_kontoinhaber} onChange={e => set('sepa_kontoinhaber', e.target.value)}
                    placeholder="Max Mustermann, Musterstr. 1, 72336 Balingen"
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">IBAN</label>
                    <input value={form.sepa_iban} onChange={e => set('sepa_iban', e.target.value.toUpperCase())}
                      placeholder="DE00 0000 ..."
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">BIC</label>
                    <input value={form.sepa_bic} onChange={e => set('sepa_bic', e.target.value.toUpperCase())}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Ort Unterzeichnung</label>
                    <input value={form.sepa_ort} onChange={e => set('sepa_ort', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">Datum</label>
                    <input type="date" value={form.sepa_datum} onChange={e => set('sepa_datum', e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 3: Abschluss */}
          {step === 3 && (
            <>
              <h2 className="font-bold text-foreground">Zusammenfassung</h2>
              <div className="space-y-2 text-sm">
                <div className="bg-secondary rounded-xl p-4 space-y-1.5">
                  <p><span className="text-muted-foreground">Name:</span> <span className="font-medium text-foreground">{form.vorname} {form.nachname}</span></p>
                  {form.geburtsdatum && <p><span className="text-muted-foreground">Geb.:</span> <span className="text-foreground">{form.geburtsdatum}</span></p>}
                  {form.strasse && <p><span className="text-muted-foreground">Adresse:</span> <span className="text-foreground">{form.strasse}, {form.plz} {form.ort}</span></p>}
                  {form.email && <p><span className="text-muted-foreground">E-Mail:</span> <span className="text-foreground">{form.email}</span></p>}
                  {form.handy && <p><span className="text-muted-foreground">Handy:</span> <span className="text-foreground">{form.handy}</span></p>}
                  {form.sparte && <p><span className="text-muted-foreground">Sparte:</span> <span className="font-semibold text-primary">{form.sparte}</span></p>}
                  {form.sepa_iban && <p><span className="text-muted-foreground">IBAN:</span> <span className="font-mono text-foreground">{form.sepa_iban}</span></p>}
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground">
                  Mit dem Einreichen erkenne ich die Satzung der Narrenzunft Frommern e.V. sowie alle dazugehörigen Verordnungen an. Ich erteile das SEPA-Lastschriftmandat für den jährlichen Mitgliedsbeitrag.
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-5">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium hover:bg-border transition-colors">
              <ChevronLeft size={16} /> Zurück
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 0 && (!form.vorname || !form.nachname)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Weiter <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.vorname || !form.nachname}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Wird eingereicht...' : 'Antrag einreichen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}