import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { CreditCard, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { fmtDatum } from '@/lib/datum';

/** IBAN prüfen (Modulo 97) — identisch zur Backend-Prüfung. */
function ibanGueltig(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const umgestellt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = /[A-Z]/.test(zeichen) ? String(zeichen.charCodeAt(0) - 55) : zeichen;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

/**
 * Selbstauskunft: Mitglieder (und Eltern für ihre Kinder) hinterlegen ihre
 * Bankverbindung inklusive SEPA-Lastschriftmandat selbst.
 */
export default function MeineBankdaten() {
  const { user } = useAuth();
  const [laden, setLaden] = useState(true);
  const [personen, setPersonen] = useState([]);
  const [ziel, setZiel] = useState('');
  const [form, setForm] = useState({ kontoinhaber: '', iban: '', bic: '', bankname: '', mandat: false });
  const [busy, setBusy] = useState(false);
  const [gespeichert, setGespeichert] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke('getMeinProfilSicher', {});
        const eigene = res?.data?.mitglied ? [res.data.mitglied] : [];
        let kinder = [];
        if (res?.data?.verwandte?.length) {
          kinder = res.data.verwandte.filter((v) => v.rolle === 'Kind' || v.beziehung === 'Kind');
        }
        const liste = [...eigene, ...kinder];
        setPersonen(liste);
        if (liste[0]) setZiel(liste[0].id);
      } catch (e) {
        console.error('Profil laden:', e);
      }
      setLaden(false);
    })();
  }, []);

  const gewaehlt = personen.find((p) => p.id === ziel);
  const ibanOk = ibanGueltig(form.iban);

  const speichern = async () => {
    if (!ziel) return;
    if (!ibanOk) { toast.error('Die IBAN ist ungültig (Prüfsumme stimmt nicht).'); return; }
    if (!form.mandat) { toast.error('Bitte das Lastschriftmandat bestätigen.'); return; }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('speichereEigeneBankdaten', {
        mitglied_id: ziel,
        kontoinhaber: form.kontoinhaber,
        iban: form.iban,
        bic: form.bic,
        bankname: form.bankname,
        mandat_bestaetigt: true,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      setGespeichert(res.data?.bankverbindung || null);
      toast.success('Bankverbindung hinterlegt. Danke!');
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Speichern fehlgeschlagen.');
    }
    setBusy(false);
  };

  if (laden) return <div className="p-6 text-sm text-muted-foreground">Wird geladen…</div>;

  if (gespeichert) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <Check className="w-7 h-7 text-green-400" />
        </div>
        <h1 className="font-oswald text-xl uppercase tracking-wide text-foreground">Bankverbindung hinterlegt</h1>
        <p className="text-sm text-muted-foreground">
          {gespeichert.kontoinhaber} · {gespeichert.iban}
          {gespeichert.sepa_mandatdatum ? ` · Mandat vom ${fmtDatum(gespeichert.sepa_mandatdatum)}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">Der Kassierer sieht die Daten und zieht die Beiträge künftig per Lastschrift ein.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <h1 className="font-oswald text-xl uppercase tracking-wide text-foreground flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary" /> Bankverbindung
      </h1>

      {!personen.length ? (
        <p className="text-sm text-muted-foreground">Dein Konto ist noch keinem Mitgliedsprofil zugeordnet. Bitte wende dich an den Vorstand.</p>
      ) : (
        <>
          {personen.length > 1 && (
            <div>
              <label className="text-[11px] text-muted-foreground">Für wen?</label>
              <select value={ziel} onChange={(e) => setZiel(e.target.value)}
                className="w-full px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
                {personen.map((p) => (
                  <option key={p.id} value={p.id}>{p.vorname} {p.nachname}</option>
                ))}
              </select>
            </div>
          )}
          {gewaehlt && <p className="text-xs text-muted-foreground">Profil: {gewaehlt.vorname} {gewaehlt.nachname}</p>}

          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Kontoinhaber</label>
              <input value={form.kontoinhaber} onChange={(e) => setForm((p) => ({ ...p, kontoinhaber: e.target.value }))}
                placeholder={`${gewaehlt?.vorname || ''} ${gewaehlt?.nachname || ''}`.trim()}
                className="w-full px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">IBAN</label>
              <input value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value.toUpperCase() }))}
                placeholder="DE00 0000 0000 0000 0000 00"
                className="w-full px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground font-mono" />
              {form.iban && !ibanOk && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1"><AlertCircle size={11} /> IBAN ungültig</p>
              )}
              {form.iban && ibanOk && (
                <p className="text-[11px] text-green-400 flex items-center gap-1 mt-1"><Check size={11} /> IBAN plausibel</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">BIC (optional)</label>
                <input value={form.bic} onChange={(e) => setForm((p) => ({ ...p, bic: e.target.value.toUpperCase() }))}
                  className="w-full px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground font-mono" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Bank (optional)</label>
                <input value={form.bankname} onChange={(e) => setForm((p) => ({ ...p, bankname: e.target.value }))}
                  className="w-full px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Ich ermächtige die Narrenzunft Frommern e.V., Zahlungen von meinem Konto mittels Lastschrift einzuziehen.
              Zugleich weise ich mein Kreditinstitut an, die von der Narrenzunft auf mein Konto gezogenen Lastschriften einzulösen.
              Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten
              Betrages verlangen. Es gelten dabei die mit meinem Kreditinstitut vereinbarten Bedingungen.
            </p>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="checkbox" checked={form.mandat} onChange={(e) => setForm((p) => ({ ...p, mandat: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-primary" />
              Mandat erteilen und Daten speichern
            </label>
          </div>

          <button onClick={speichern} disabled={busy || !ibanOk || !form.mandat}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
            {busy ? 'Speichere…' : 'Bankverbindung speichern'}
          </button>

          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" />
            Die Daten sehen nur Kassierer, Vorstand, Stellvertreter und Admin. Andere Mitglieder haben keinen Zugriff.
          </p>
        </>
      )}
    </div>
  );
}
