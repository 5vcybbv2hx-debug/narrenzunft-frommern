import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Loader2, AlertCircle, Phone, Mail, Snowflake, Truck, Tent, Plug, Package, Wine, CalendarDays, Euro, ArrowLeft } from 'lucide-react';
import DateSelect from '../components/ui/DateSelect';

const KATEGORIE_ICONS = {
  'Anhänger': Truck, 'Kühlanhänger': Snowflake, 'Bar': Wine,
  'Zelt': Tent, 'Technik': Plug, 'Sonstiges': Package,
};

const euro = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';

export default function VerleihAnfrage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [form, setForm] = useState({
    name: '', telefon: '', email: '', von_datum: '', bis_datum: '', zweck: '',
  });
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getVerleihInfo', { id });
        if (res.data?.error || !res.data?.name) {
          setFehler('Dieser Gegenstand ist nicht (mehr) für den Verleih freigegeben.');
        } else {
          setItem(res.data);
        }
      } catch (e) {
        setFehler('Gegenstand konnte nicht geladen werden.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const tage = () => {
    if (!form.von_datum || !form.bis_datum) return 0;
    const d1 = new Date(form.von_datum), d2 = new Date(form.bis_datum);
    const diff = Math.ceil((d2 - d1) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  };

  const submit = async () => {
    if (!form.name || !form.telefon || !form.von_datum || !form.bis_datum) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('stelleVerleihAnfrage', {
        id, website: honeypot,
        name: form.name, telefon: form.telefon, email: form.email,
        von_datum: form.von_datum, bis_datum: form.bis_datum, zweck: form.zweck,
      });
      if (res.data?.error) {
        setFehler(res.data.error);
      } else {
        setSubmitted(true);
      }
    } catch (e) {
      setFehler('Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  const IconComponent = item ? (KATEGORIE_ICONS[item.kategorie] || Package) : Package;

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center">
      {/* Top-Bar mit Zurück-Button */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b border-border w-full">
        <div className="max-w-md mx-auto flex items-center px-4 h-14">
          <button onClick={() => navigate('/verleih')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-h-[44px]">
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Zurück</span>
          </button>
        </div>
      </div>
      <div className="w-full max-w-md px-4 py-8">
      {/* Kopf */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto rounded-xl bg-primary flex items-center justify-center shadow-xl shadow-red-900/30">
          <span className="text-2xl">🎭</span>
        </div>
        <p className="font-oswald font-semibold text-white text-lg uppercase tracking-widest mt-2">Narrenzunft</p>
        <p className="text-primary text-[10px] font-semibold uppercase tracking-[0.3em]">Frommern</p>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        </div>
      )}

      {fehler && !loading && !submitted && (
        <div className="max-w-md w-full bg-red-900/20 border border-red-700/30 rounded-xl p-5 text-center">
          <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-400">{fehler}</p>
          <Link
            to="/verleih"
            className="inline-flex items-center justify-center mt-4 px-5 py-3 min-h-[44px] rounded-xl bg-primary text-white font-semibold text-sm hover:bg-red-700 transition-colors"
          >
            Alle verfügbaren Leihgegenstände ansehen →
          </Link>
        </div>
      )}

      {/* Erfolg */}
      {submitted && (
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center">
          <CheckCircle2 size={48} className="text-green-400 mx-auto mb-3" />
          <h1 className="font-oswald uppercase text-xl text-white">Anfrage erhalten!</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Vielen Dank, <strong className="text-white">{form.name}</strong>! Eure Anfrage zu <strong className="text-white">{item?.name}</strong> ist bei uns eingegangen.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Der Vorstand prüft die Anfrage und meldet sich dann bei euch unter der angegebenen Nummer.
          </p>
          <div className="mt-4 px-4 py-3 rounded-xl bg-black/30 border border-border text-xs text-muted-foreground text-left space-y-1">
            <p><span className="text-muted-foreground">Zeitraum:</span> {form.von_datum} → {form.bis_datum}</p>
            {item?.preis > 0 && <p><span className="text-muted-foreground">Miete (ca.):</span> {tage()} Tag(e) × {euro(item.preis)} = {euro(tage() * item.preis)}</p>}
            {item?.mitglied_preis != null && item?.preis > 0 && item.mitglied_preis < item.preis && (
              <p><span className="text-muted-foreground">Mitglieder:</span> <span className="text-primary font-semibold">{euro(item.mitglied_preis)} / Tag</span> — Buchung einfach über die App.</p>
            )}
            {item?.kaution > 0 && <p><span className="text-muted-foreground">Kaution:</span> {euro(item.kaution)}</p>}
          </div>
        </div>
      )}

      {/* Formular */}
      {item && !submitted && !fehler && (
        <div className="w-full max-w-md space-y-4">
          {/* Gegenstand */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {item.bild_url && (
              <img src={item.bild_url} alt={item.name} className="w-full h-44 object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-center gap-2.5">
                {!item.bild_url && (
                  <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center">
                    <IconComponent size={20} className="text-primary" />
                  </div>
                )}
                <div>
                  <h1 className="font-oswald uppercase text-xl text-white leading-tight">{item.name}</h1>
                  <p className="text-xs text-muted-foreground">{item.kategorie}</p>
                </div>
              </div>
              {item.beschreibung && <p className="text-sm text-muted-foreground mt-3">{item.beschreibung}</p>}

              <div className="grid grid-cols-2 gap-2 mt-4">
                {item.preis > 0 && (
                  <div className="px-3 py-2.5 rounded-xl bg-black/30 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Euro size={11}/> Miete pro Tag</p>
                    <p className="text-lg font-semibold text-white mt-0.5">{euro(item.preis)}</p>
                  </div>
                )}
                {item.kaution > 0 && (
                  <div className="px-3 py-2.5 rounded-xl bg-black/30 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Euro size={11}/> Kaution</p>
                    <p className="text-lg font-semibold text-white mt-0.5">{euro(item.kaution)}</p>
                  </div>
                )}
              </div>

              {item.notiz && (
                <div className="mt-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/25">
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{item.notiz}</p>
                </div>
              )}
            </div>
          </div>

          {/* Anfrage-Formular */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h2 className="font-oswald uppercase text-base text-white flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" /> Ausleihanfrage stellen
            </h2>

            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="Vor- und Nachname / Organisation"
                className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1 flex items-center gap-1"><Phone size={11} /> Telefon *</label>
                <input value={form.telefon} onChange={(e) => set('telefon', e.target.value)}
                  placeholder="Für Rückfragen"
                  className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1 flex items-center gap-1"><Mail size={11} /> E-Mail (optional)</label>
                <input value={form.email} onChange={(e) => set('email', e.target.value)}
                  placeholder="name@beispiel.de"
                  className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Von *</label>
                <DateSelect name="von_datum" value={form.von_datum}
                  onChange={(e) => set('von_datum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Bis *</label>
                <DateSelect name="bis_datum" value={form.bis_datum}
                  onChange={(e) => set('bis_datum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Wofür? (optional)</label>
              <textarea value={form.zweck} onChange={(e) => set('zweck', e.target.value)} rows={2}
                placeholder="z.B. Geburtstagsfeier, Vereinsfest…"
                className="w-full px-3 py-2.5 rounded-lg bg-black/40 border border-border text-sm text-white focus:outline-none focus:border-primary resize-none" />
            </div>

            {/* Spamschutz: unsichtbares Feld */}
            <input value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
              className="absolute opacity-0 pointer-events-none h-0 w-0" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            {item.preis > 0 && tage() > 0 && (
              <div className="px-3 py-2.5 rounded-xl bg-black/30 border border-border text-xs text-muted-foreground">
                <span className="text-muted-foreground">Geschätzte Miete:</span> {tage()} Tag(e) × {euro(item.preis)} = <span className="text-white font-semibold">{euro(tage() * item.preis)}</span>
                {item.kaution > 0 && <> + {euro(item.kaution)} Kaution</>}
              </div>
            )}

            <button onClick={submit} disabled={submitting || !form.name || !form.telefon || !form.von_datum || !form.bis_datum}
              className="w-full py-3 min-h-[48px] rounded-xl bg-primary text-white text-sm font-semibold uppercase tracking-wide hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Wird gesendet…' : 'Anfrage abschicken'}
            </button>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              Eure Daten werden nur zur Bearbeitung der Anfrage verwendet. Der Vorstand entscheidet über die Ausleihe und meldet sich telefonisch.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}