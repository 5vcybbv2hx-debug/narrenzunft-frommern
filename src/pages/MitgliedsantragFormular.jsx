import DateSelect from '../components/ui/DateSelect';
import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SPARTEN = ['Brennnesseln', 'Hexen', 'Zäpfle Bomber', 'Garde'];

/** Alle Antragsvarianten – Auswahl erfolgt als erster Schritt im Formular. */
const TYPEN = [
  { key: 'Aktiv', label: 'Aktive Mitgliedschaft', desc: 'Mit Sparte · ab 18 Jahren · 17 € im Jahr', icon: '🎭' },
  { key: 'Passiv', label: 'Passive Mitgliedschaft', desc: 'Ohne Sparte · 17 € im Jahr', icon: '🤝' },
  { key: 'Wechsel_zu_Aktiv', label: 'Wechsel zu Aktiv', desc: 'Von passiv zu aktiv · Antrag bis 30.09. für das kommende Jahr', icon: '⬆️' },
  { key: 'Wechsel_zu_Passiv', label: 'Wechsel zu Passiv', desc: 'Von aktiv zu passiv · wirksam zum nächsten Geschäftsjahr', icon: '⬇️' },
  { key: 'Junggarde', label: 'Junggarde (Kind)', desc: 'Du wirst passives Mitglied (17 €/Jahr), dein Kind tritt der Junggarde bei', icon: '🧒' },
];
const TYP_LABEL = Object.fromEntries(TYPEN.map(t => [t.key, t.label]));
const brauchtSparte = (t) => t === 'Aktiv' || t === 'Wechsel_zu_Aktiv';
const istWechsel = (t) => t === 'Wechsel_zu_Aktiv' || t === 'Wechsel_zu_Passiv';

export default function MitgliedsantragFormular() {
  const navigate = useNavigate();
  const [step, setStep] = useState(-1); // -1 = Varianten-Auswahl
  const [form, setForm] = useState({
    antrag_typ: '', vorname: '', nachname: '', geburtsdatum: '',
    strasse: '', plz: '', ort: '',
    telefon: '', handy: '', email: '',
    kind_vorname: '', kind_nachname: '', kind_geburtsdatum: '',
    sparte: '', eintrittsdatum: new Date().toISOString().split('T')[0],
    sepa_kontoinhaber: '', sepa_iban: '', sepa_bic: '',
    sepa_ort: '', sepa_datum: new Date().toISOString().split('T')[0],
    ack_satzung: false, ack_datenschutz: false, ack_sepa: false, ack_kind: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [stepFehler, setStepFehler] = useState(null);
  const [eingereichtVon, setEingereichtVon] = useState(null);

  const typ = form.antrag_typ;

  const STEPS = useMemo(() => {
    const s = ['Antragsart', 'Persönliches', 'Adresse & Kontakt'];
    if (brauchtSparte(typ)) s.push('Sparte');
    if (typ === 'Junggarde') s.push('Kind');
    s.push('SEPA', 'Abschluss');
    return s;
  }, [typ]);

  useEffect(() => {
    base44.auth.me().then(u => setEingereichtVon(u)).catch((err) => { console.error('User laden:', err); });
  }, []);

  const set = (f, v) => { setForm(p => ({ ...p, [f]: v })); setStepFehler(null); };

  const pruefeIban = (iban) => {
    const n = (iban || '').replace(/\s/g, '').toUpperCase();
    if (!n) return true;
    if (n.length < 15 || n.length > 34 || !/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(n)) return false;
    const umgestellt = n.slice(4) + n.slice(0, 4);
    let rest = 0;
    for (const zeichen of umgestellt) {
      const wert = zeichen >= 'A' ? String(zeichen.charCodeAt(0) - 55) : zeichen;
      for (const z of wert) rest = (rest * 10 + Number(z)) % 97;
    }
    return rest === 1;
  };
  const ibanUngueltig = !!form.sepa_iban && !pruefeIban(form.sepa_iban);

  const volljaehrig = (datum) => {
    if (!datum) return false;
    const g = new Date(datum); const heute = new Date();
    let alter = heute.getFullYear() - g.getFullYear();
    const m = heute.getMonth() - g.getMonth();
    if (m < 0 || (m === 0 && heute.getDate() < g.getDate())) alter--;
    return alter >= 18;
  };

  const validiereSchritt = (nr) => {
    if (nr === 1) {
      if (!form.geburtsdatum) return 'Bitte gib dein Geburtsdatum an — wichtig für Beitrag und Zuordnung.';
      if ((typ === 'Aktiv' || typ === 'Wechsel_zu_Aktiv') && !volljaehrig(form.geburtsdatum)) {
        return 'Aktive Mitgliedschaft ist laut Satzung erst ab 18 Jahren möglich. Für Kinder und Jugendliche bitte „Junggarde" wählen.';
      }
    }
    if (nr === 2) {
      if (!form.strasse || !form.plz || !form.ort) return 'Bitte Straße, PLZ und Ort angeben.';
      if (!form.email && !form.telefon && !form.handy) return 'Bitte E-Mail oder Telefon angeben, damit wir dich erreichen können.';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Die E-Mail-Adresse sieht ungültig aus.';
    }
    if (brauchtSparte(typ) && nr === STEPS.indexOf('Sparte')) {
      if (!form.sparte) return 'Bitte wähle eine Sparte.';
    }
    if (typ === 'Junggarde' && nr === STEPS.indexOf('Kind')) {
      if (!form.kind_vorname || !form.kind_nachname) return 'Bitte Vor- und Nachname des Kindes angeben.';
      if (!form.kind_geburtsdatum) return 'Bitte das Geburtsdatum des Kindes angeben.';
    }
    if (nr === STEPS.indexOf('SEPA')) {
      if (ibanUngueltig) return 'Die IBAN ist ungültig (Prüfsumme stimmt nicht). Bitte prüfen.';
      if (form.sepa_iban && !form.sepa_kontoinhaber) return 'Bitte den Kontoinhaber zur IBAN angeben.';
    }
    if (nr === STEPS.indexOf('Abschluss')) {
      if (!form.ack_satzung) return 'Bitte die Satzung und Ordnungen bestätigen.';
      if (!form.ack_datenschutz) return 'Bitte den Datenschutz-Hinweis bestätigen.';
      if (form.sepa_iban && !form.ack_sepa) return 'Bitte das SEPA-Lastschriftmandat bestätigen.';
      if (typ === 'Junggarde' && !form.ack_kind) return 'Bitte die Anmeldung deines Kindes bestätigen.';
    }
    return null;
  };

  const weiter = () => {
    const fehler = validiereSchritt(step);
    if (fehler) { setStepFehler(fehler); return; }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    const fehler = validiereSchritt(step);
    if (fehler) { setStepFehler(fehler); return; }
    setSubmitting(true); setError(null);
    try {
      let eingereichtVonMitgliedId = null;
      if (eingereichtVon) {
        const mitglieder = await base44.entities.Mitglied.filter({ user_id: eingereichtVon.id });
        if (mitglieder[0]) eingereichtVonMitgliedId = mitglieder[0].id;
      }
      const daten = { ...form }; delete daten.ack_satzung; delete daten.ack_datenschutz; delete daten.ack_sepa; delete daten.ack_kind;
      await base44.entities.Mitgliedsantrag.create({
        ...daten,
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative">
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-h-[44px] z-10">
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">Zurück</span>
        </button>
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 size={52} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2 font-oswald uppercase tracking-wide">Antrag eingereicht!</h2>
          <p className="text-muted-foreground text-sm">
            Dein Antrag ({TYP_LABEL[typ]}{typ === 'Junggarde' ? ` für ${form.kind_vorname} ${form.kind_nachname}` : ''}) wurde gespeichert.
            Der Vorstand prüft ihn und meldet sich.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-lg mx-auto flex items-center px-4 h-14">
          <button onClick={() => (step === -1 ? navigate(-1) : setStep(s => s - 1))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">{step === -1 ? 'Zurück' : STEPS[step - 1] || 'Zurück'}</span>
          </button>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎭</div>
          <h1 className="text-2xl font-bold text-foreground font-oswald uppercase tracking-wide">Mitgliedsantrag</h1>
          <p className="text-sm text-muted-foreground mt-1">Narrenzunft Frommern e.V.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full transition-all" style={{ background: i <= step ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          {step === -1 ? 'Wähle zuerst, welchen Antrag du stellen möchtest:' : <>Schritt {step + 1} von {STEPS.length - 1}: <span className="text-foreground font-medium">{STEPS[step]}</span></>}
        </p>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">

          {/* VARIANTEN-AUSWAHL */}
          {step === -1 && (
            <>
              {TYPEN.map(t => (
                <button key={t.key} type="button" onClick={() => { set('antrag_typ', t.key); setStep(0); }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all active:scale-[0.99] ${typ === t.key ? 'border-primary bg-primary/10' : 'border-border bg-secondary hover:border-primary/40'}`}>
                  <span className="text-2xl shrink-0">{t.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-foreground">{t.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{t.desc}</span>
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </>
          )}

          {/* PERSÖNLICHES */}
          {step === 0 && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">{typ === 'Junggarde' ? 'Deine Daten (Elternteil)' : 'Persönliche Daten'}</h2>
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
                <label className="text-xs text-muted-foreground font-medium block mb-1">Geburtsdatum *</label>
                <DateSelect value={form.geburtsdatum} onChange={e => set('geburtsdatum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              {istWechsel(typ) && (
                <p className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">
                  {typ === 'Wechsel_zu_Aktiv'
                    ? 'Du bist bereits Mitglied? Der Wechsel zur aktiven Mitgliedschaft muss bis zum 30.09. beantragt sein und wird zum kommenden Geschäftsjahr wirksam.'
                    : 'Der Wechsel zur passiven Mitgliedschaft wird zum kommenden Geschäftsjahr wirksam.'}
                </p>
              )}
            </>
          )}

          {/* ADRESSE & KONTAKT */}
          {step === 1 && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">Adresse & Kontakt</h2>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Straße *</label>
                <input value={form.strasse} onChange={e => set('strasse', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">PLZ *</label>
                  <input value={form.plz} onChange={e => set('plz', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Ort *</label>
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
                <label className="text-xs text-muted-foreground font-medium block mb-1">E-Mail * <span className="text-muted-foreground/60 font-normal">(oder Telefon)</span></label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          {/* SPARTE */}
          {brauchtSparte(typ) && step === STEPS.indexOf('Sparte') && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">Gewünschte Sparte</h2>
              <div className="grid grid-cols-2 gap-2">
                {SPARTEN.map(s => (
                  <button key={s} type="button" onClick={() => set('sparte', s)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-all ${form.sparte === s ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Eintrittsdatum (ab)</label>
                <DateSelect value={form.eintrittsdatum} onChange={e => set('eintrittsdatum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          {/* KIND (JUNGGARDE) */}
          {typ === 'Junggarde' && step === STEPS.indexOf('Kind') && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">Dein Kind</h2>
              <p className="text-xs text-muted-foreground">Dein Kind tritt der Junggarde bei. Es wird über deine passive Mitgliedschaft im Verein aufgenommen (Satzung § 4).</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Vorname des Kindes *</label>
                  <input value={form.kind_vorname} onChange={e => set('kind_vorname', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Nachname des Kindes *</label>
                  <input value={form.kind_nachname} onChange={e => set('kind_nachname', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Geburtsdatum des Kindes *</label>
                <DateSelect value={form.kind_geburtsdatum} onChange={e => set('kind_geburtsdatum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          {/* SEPA */}
          {step === STEPS.indexOf('SEPA') && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">SEPA-Lastschriftmandat</h2>
              <p className="text-xs text-muted-foreground">Gläubiger-ID: DE 76 ZZZ0 0000 7381 29</p>
              {istWechsel(typ) && <p className="text-xs text-muted-foreground bg-secondary rounded-lg p-3">Nur ausfüllen, wenn sich deine Bankverbindung ändert.</p>}
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Name & Anschrift Kontoinhaber</label>
                <input value={form.sepa_kontoinhaber} onChange={e => set('sepa_kontoinhaber', e.target.value)}
                  placeholder="Max Mustermann, Musterstr. 1, 72336 Balingen"
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">IBAN</label>
                <input value={form.sepa_iban} onChange={e => set('sepa_iban', e.target.value.toUpperCase())}
                  placeholder="DE00 0000 ..."
                  className={`w-full px-3 py-2.5 rounded-lg bg-secondary border text-sm text-foreground focus:outline-none font-mono ${ibanUngueltig ? 'border-red-500/60 focus:border-red-500' : 'border-border focus:border-primary'}`} />
                {ibanUngueltig && <p className="text-xs text-red-500 mt-1">Die IBAN-Prüfsumme stimmt nicht.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">BIC</label>
                  <input value={form.sepa_bic} onChange={e => set('sepa_bic', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary font-mono" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Ort, Datum</label>
                  <DateSelect value={form.sepa_datum} onChange={e => set('sepa_datum', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
            </>
          )}

          {/* ABSCHLUSS */}
          {step === STEPS.indexOf('Abschluss') && (
            <>
              <h2 className="font-bold text-foreground font-oswald uppercase tracking-wide">Abschluss</h2>
              <p className="text-xs text-muted-foreground">Antragsart: <span className="text-foreground font-medium">{TYP_LABEL[typ]}</span></p>
              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input type="checkbox" checked={form.ack_satzung} onChange={e => set('ack_satzung', e.target.checked)} className="mt-1" />
                <span>Ich erkenne die Satzung der Narrenzunft Frommern e.V. sowie alle zugehörigen Ordnungen an. Die Satzung findest du in der App unter „Dokumente".</span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input type="checkbox" checked={form.ack_datenschutz} onChange={e => set('ack_datenschutz', e.target.checked)} className="mt-1" />
                <span>Ich stimme der Verarbeitung meiner personenbezogenen Daten gemäß § 14 der Satzung zu. Dazu gehören: Mitgliederverwaltung in elektronischer Form (EDV/Vereins-App), Übermittlung von Namen, Alter, Anschrift und Kontaktdaten an übergeordnete Verbände und Versicherungen soweit erforderlich, Veröffentlichung von Fotos und Ehrungen in Vereinsmedien — ich kann der Veröffentlichung von Einzelfotos jederzeit widersprechen. Ich habe ein Recht auf Auskunft, Berichtigung und Löschung meiner Daten.{typ === 'Junggarde' ? ' Diese Zustimmung gilt auch für die Daten meines Kindes.' : ''}</span>
              </label>
              {typ === 'Junggarde' && (
                <label className="flex items-start gap-2.5 text-sm text-foreground">
                  <input type="checkbox" checked={form.ack_kind} onChange={e => set('ack_kind', e.target.checked)} className="mt-1" />
                  <span>Ich bin sorgeberechtigt und melde mein Kind {form.kind_vorname ? `(${form.kind_vorname} ${form.kind_nachname}) ` : ''}für die Junggarde an.</span>
                </label>
              )}
              {form.sepa_iban && (
                <label className="flex items-start gap-2.5 text-sm text-foreground">
                  <input type="checkbox" checked={form.ack_sepa} onChange={e => set('ack_sepa', e.target.checked)} className="mt-1" />
                  <span>Ich erteile das SEPA-Lastschriftmandat für den jährlichen Mitgliedsbeitrag an die Narrenzunft Frommern e.V.</span>
                </label>
              )}
              <p className="text-xs text-muted-foreground">Mit dem Einreichen wird der Antrag dem Vorstand zur Entscheidung (Satzung § 4) vorgelegt.</p>
            </>
          )}

          {stepFehler && <p role="alert" className="text-sm text-red-500">{stepFehler}</p>}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

          {/* Navigation */}
          {step > -1 && (
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground text-sm font-semibold hover:bg-border transition-colors flex items-center justify-center gap-1.5">
                <ChevronLeft size={16} /> Zurück
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={weiter}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
                  Weiter <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting && <Loader2 size={16} className="animate-spin" />} Antrag einreichen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}