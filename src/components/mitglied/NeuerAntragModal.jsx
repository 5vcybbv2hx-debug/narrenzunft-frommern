import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronRight, ChevronLeft, CheckCircle2, UserPlus, Loader2 } from 'lucide-react';

const SPARTEN = ['Brennnesseln', 'Hexen', 'Zäpfle Bomber', 'Garde'];
const STEPS = ['Persönliches', 'Adresse & Kontakt', 'Sparte & SEPA', 'Abschluss'];

const EMPTY = {
  vorname: '', nachname: '', geburtsdatum: '',
  strasse: '', plz: '', ort: '',
  telefon: '', handy: '', email: '',
  sparte: '', eintrittsdatum: new Date().toISOString().split('T')[0],
  sepa_kontoinhaber: '', sepa_iban: '', sepa_bic: '',
  sepa_ort: '', sepa_datum: new Date().toISOString().split('T')[0],
};

export default function NeuerAntragModal({ onClose, onMitgliedAngelegt }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...EMPTY });
  const [submitting, setSubmitting] = useState(false);
  const [antragId, setAntragId] = useState(null);
  const [done, setDone] = useState(false); // nur Antrag gespeichert
  const [mitgliedAngelegt, setMitgliedAngelegt] = useState(false);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleAntragSpeichern = async () => {
    setSubmitting(true);
    try {
      const antrag = await base44.entities.Mitgliedsantrag.create({
        ...form,
        status: 'In Bearbeitung',
      });
      setAntragId(antrag.id);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMitgliedAnlegen = async () => {
    setSubmitting(true);
    try {
      // Antrag speichern falls noch nicht geschehen
      let aId = antragId;
      if (!aId) {
        const antrag = await base44.entities.Mitgliedsantrag.create({
          ...form,
          status: 'In Bearbeitung',
        });
        aId = antrag.id;
        setAntragId(aId);
      }

      // Mitglied anlegen
      const mitglied = await base44.entities.Mitglied.create({
        vorname: form.vorname,
        nachname: form.nachname,
        geburtsdatum: form.geburtsdatum,
        strasse: form.strasse,
        plz: form.plz,
        ort: form.ort,
        telefon: form.telefon || form.handy,
        email: form.email,
        eintrittsdatum: form.eintrittsdatum,
        iban: form.sepa_iban,
        kontoinhaber: form.sepa_kontoinhaber,
        mitgliedsstatus: 'Aktiv',
      });

      // Antrag mit Mitglied verknüpfen & Status setzen
      await base44.entities.Mitgliedsantrag.update(aId, {
        mitglied_id: mitglied.id,
        status: 'Angelegt',
      });

      setMitgliedAngelegt(true);
      setDone(true);
      onMitgliedAngelegt?.();
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = step === 0 ? (form.vorname && form.nachname) : true;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-lg">Neuer Mitgliedsantrag</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Schritt {step + 1} von {STEPS.length}: <span className="text-foreground">{STEPS[step]}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Fortschrittsbalken */}
        <div className="flex gap-1 px-6 pt-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* STEP 0 */}
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vorname *" value={form.vorname} onChange={v => set('vorname', v)} />
                <Field label="Nachname *" value={form.nachname} onChange={v => set('nachname', v)} />
              </div>
              <Field label="Geburtsdatum" type="date" value={form.geburtsdatum} onChange={v => set('geburtsdatum', v)} />
              <Field label="Eintrittsdatum (ab)" type="date" value={form.eintrittsdatum} onChange={v => set('eintrittsdatum', v)} />
            </>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <Field label="Straße & Hausnummer" value={form.strasse} onChange={v => set('strasse', v)} />
              <div className="grid grid-cols-3 gap-2">
                <Field label="PLZ" value={form.plz} onChange={v => set('plz', v)} />
                <div className="col-span-2"><Field label="Ort" value={form.ort} onChange={v => set('ort', v)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefon" value={form.telefon} onChange={v => set('telefon', v)} />
                <Field label="Handy" value={form.handy} onChange={v => set('handy', v)} />
              </div>
              <Field label="E-Mail" type="email" value={form.email} onChange={v => set('email', v)} />
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-2">Gewünschte Sparte</label>
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
                <Field label="Kontoinhaber & Anschrift" value={form.sepa_kontoinhaber} onChange={v => set('sepa_kontoinhaber', v)} placeholder="Max Mustermann, Musterstr. 1, 72336..." />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IBAN" value={form.sepa_iban} onChange={v => set('sepa_iban', v.toUpperCase())} mono placeholder="DE00 0000..." />
                  <Field label="BIC" value={form.sepa_bic} onChange={v => set('sepa_bic', v.toUpperCase())} mono />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ort Unterzeichnung" value={form.sepa_ort} onChange={v => set('sepa_ort', v)} />
                  <Field label="Datum" type="date" value={form.sepa_datum} onChange={v => set('sepa_datum', v)} />
                </div>
              </div>
            </>
          )}

          {/* STEP 3: Zusammenfassung */}
          {step === 3 && !done && (
            <>
              <div className="bg-secondary rounded-xl p-4 space-y-1.5 text-sm">
                <SumRow label="Name" value={`${form.vorname} ${form.nachname}`} />
                {form.geburtsdatum && <SumRow label="Geb." value={form.geburtsdatum} />}
                {form.strasse && <SumRow label="Adresse" value={`${form.strasse}, ${form.plz} ${form.ort}`} />}
                {form.email && <SumRow label="E-Mail" value={form.email} />}
                {form.telefon && <SumRow label="Telefon" value={form.telefon} />}
                {form.sparte && <SumRow label="Sparte" value={form.sparte} highlight />}
                {form.sepa_iban && <SumRow label="IBAN" value={form.sepa_iban} mono />}
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs text-muted-foreground">
                Mit dem Anlegen wird ein digitaler Mitgliedsantrag gespeichert. Du kannst das Mitglied direkt anlegen oder den Antrag zunächst nur speichern.
              </div>
            </>
          )}

          {/* Erfolgsmeldung */}
          {done && (
            <div className="text-center py-6">
              <CheckCircle2 size={48} className="text-green-400 mx-auto mb-3" />
              {mitgliedAngelegt ? (
                <>
                  <h3 className="font-bold text-foreground text-lg mb-1">Mitglied angelegt!</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>{form.vorname} {form.nachname}</strong> wurde als Mitglied angelegt und der Antrag gespeichert.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-bold text-foreground text-lg mb-1">Antrag gespeichert!</h3>
                  <p className="text-sm text-muted-foreground">
                    Der Antrag von <strong>{form.vorname} {form.nachname}</strong> wurde gespeichert und kann unter „Mitgliedsanträge" verwaltet werden.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 pb-6 flex gap-2">
          {done ? (
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Schließen
            </button>
          ) : (
            <>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-medium">
                  <ChevronLeft size={15} /> Zurück
                </button>
              )}

              {step < STEPS.length - 1 && (
                <button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  Weiter <ChevronRight size={15} />
                </button>
              )}

              {step === STEPS.length - 1 && (
                <>
                  <button
                    onClick={handleAntragSpeichern}
                    disabled={submitting || !form.vorname || !form.nachname}
                    className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? '...' : 'Nur Antrag speichern'}
                  </button>
                  <button
                    onClick={handleMitgliedAnlegen}
                    disabled={submitting || !form.vorname || !form.nachname}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                    Mitglied anlegen
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, mono }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function SumRow({ label, value, highlight, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${highlight ? 'font-semibold text-primary' : 'text-foreground'} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}