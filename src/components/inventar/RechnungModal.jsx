import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Download, Send, Settings, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ladeRechnungsdaten, speichereRechnungsdaten, naechsteRechnungsnummer,
  erzeugeRechnungsPdf, betragVon,
} from '@/lib/rechnung';

/**
 * Rechnung zu einer Ausleihe: Empfänger prüfen, Vereinsdaten pflegen,
 * PDF erzeugen und herunterladen oder per E-Mail verschicken.
 */
export default function RechnungModal({ ausleihe, ausruestung, empfaenger, onClose, onGespeichert }) {
  const betrag = betragVon(ausleihe, ausruestung);
  const [daten, setDaten] = useState(null);
  const [zeigeDaten, setZeigeDaten] = useState(false);
  const [empf, setEmpf] = useState({
    name: empfaenger?.name || '',
    strasse: empfaenger?.strasse || '',
    plz: empfaenger?.plz || '',
    ort: empfaenger?.ort || '',
    email: empfaenger?.email || '',
  });
  const [nummer, setNummer] = useState(ausleihe?.rechnungsnummer || '');
  const [datum, setDatum] = useState(ausleihe?.rechnungsdatum || new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ladeRechnungsdaten().then((d) => {
      setDaten(d);
      const fehlt = !d.steuernummer && !d.ust_id || !d.strasse;
      setZeigeDaten(fehlt);
    });
  }, []);

  const setD = (feld, wert) => setDaten((p) => ({ ...p, [feld]: wert }));

  const datenSpeichern = async () => {
    try {
      await speichereRechnungsdaten(daten);
      toast.success('Rechnungsdaten gespeichert.');
      setZeigeDaten(false);
    } catch (e) {
      toast.error('Speichern fehlgeschlagen.');
    }
  };

  const bauePdf = async () => {
    const nr = nummer || await naechsteRechnungsnummer();
    if (!nummer) setNummer(nr);
    const doc = await erzeugeRechnungsPdf({
      daten,
      nummer: nr,
      rechnungsdatum: datum,
      empfaenger: empf,
      zeitraum: { von: ausleihe?.von_datum, bis: ausleihe?.bis_datum, tage: betrag.tage },
      position: ausruestung?.name || 'Ausleihgegenstand',
      gesamt: betrag.gesamt,
      kaution: Number(ausruestung?.verleih_kaution || 0),
      zweck: ausleihe?.zweck || '',
      notiz: ausleihe?.notizen || '',
      modus: betrag.modus,
    });
    // Rechnungsnummer + Datum an der Ausleihe festhalten (fortlaufend, nachvollziehbar)
    if (ausleihe?.id) {
      try {
        await base44.entities.Ausleihe.update(ausleihe.id, { rechnungsnummer: nr, rechnungsdatum: datum });
        onGespeichert?.({ rechnungsnummer: nr, rechnungsdatum: datum, id: ausleihe.id });
      } catch (e) { console.warn('Rechnungsdaten an Ausleihe:', e); }
    }
    return { doc, nr, dateiname: `Rechnung_${nr}.pdf` };
  };

  const herunterladen = async () => {
    setBusy(true);
    try {
      const { doc, dateiname } = await bauePdf();
      doc.save(dateiname);
      toast.success('Rechnung erstellt.');
    } catch (e) {
      console.error('Rechnung:', e);
      toast.error('Rechnung konnte nicht erstellt werden.');
    }
    setBusy(false);
  };

  const perMailSenden = async () => {
    if (!empf.email) { toast.error('Keine E-Mail-Adresse beim Empfänger hinterlegt.'); return; }
    setBusy(true);
    try {
      const { doc, nr, dateiname } = await bauePdf();
      const blob = doc.output('blob');
      const datei = new File([blob], dateiname, { type: 'application/pdf' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: datei });
      await base44.functions.invoke('sendeRechnung', {
        ausleihe_id: ausleihe?.id, email: empf.email, name: empf.name,
        rechnungsnummer: nr, pdf_url: file_url, betrag: betrag.gesamt,
        gegenstand: ausruestung?.name || '', von: ausleihe?.von_datum, bis: ausleihe?.bis_datum,
      });
      toast.success(`Rechnung ${nr} per E-Mail an ${empf.email} gesendet.`);
      onClose?.();
    } catch (e) {
      console.error('Rechnung senden:', e);
      toast.error('Versand fehlgeschlagen: ' + (e?.response?.data?.error || e?.message || 'Unbekannter Fehler'));
    }
    setBusy(false);
  };

  if (!daten) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 max-w-lg w-full max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-oswald font-semibold text-lg uppercase tracking-wide text-foreground">Rechnung erstellen</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-3 py-2 rounded-lg bg-secondary/60 border border-border text-xs text-muted-foreground mb-3">
          {ausruestung?.name} · {betrag.modus === 'veranstaltung'
            ? `pauschal ${betrag.gesamt.toFixed(2).replace('.', ',')} € für den Zeitraum`
            : `${betrag.einzelpreis.toFixed(2).replace('.', ',')} € pro Tag × ${betrag.tage} = ${betrag.gesamt.toFixed(2).replace('.', ',')} €`}
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Rechnungs-Nr.</label>
              <input value={nummer} onChange={(e) => setNummer(e.target.value)} placeholder="wird automatisch vergeben"
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Rechnungsdatum</label>
              <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">Empfänger</p>
          {[['name', 'Name'], ['strasse', 'Straße'], ['plz', 'PLZ'], ['ort', 'Ort'], ['email', 'E-Mail']].map(([feld, label]) => (
            <div key={feld} className="grid grid-cols-[90px_1fr] items-center gap-2">
              <label className="text-[11px] text-muted-foreground">{label}</label>
              <input value={empf[feld]} onChange={(e) => setEmpf((p) => ({ ...p, [feld]: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
          ))}

          <button onClick={() => setZeigeDaten(!zeigeDaten)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline pt-1">
            <Settings size={12} /> Vereinsdaten für Rechnungen {zeigeDaten ? 'ausblenden' : 'bearbeiten'}
          </button>

          {zeigeDaten && (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/40">
              {(!daten.steuernummer && !daten.ust_id) && (
                <p className="text-[11px] text-yellow-400 flex items-start gap-1.5">
                  <AlertCircle size={11} className="mt-0.5 shrink-0" />
                  Ohne Steuernummer bzw. USt-IdNr. ist die Rechnung nicht vollständig (Pflichtangabe nach § 14 UStG).
                </p>
              )}
              {[
                ['firma', 'Verein'], ['strasse', 'Straße'], ['plz', 'PLZ'], ['ort', 'Ort'],
                ['steuernummer', 'Steuernummer'], ['ust_id', 'USt-IdNr.'], ['iban', 'IBAN'], ['bic', 'BIC'],
                ['bank', 'Bank'], ['vertreten_durch', 'Vertreten durch'], ['email', 'E-Mail'], ['telefon', 'Telefon'],
                ['registergericht', 'Registergericht'], ['registersnummer', 'Registernummer'], ['zahlungsziel_tage', 'Zahlungsziel (Tage)'],
              ].map(([feld, label]) => (
                <div key={feld} className="grid grid-cols-[110px_1fr] items-center gap-2">
                  <label className="text-[11px] text-muted-foreground">{label}</label>
                  <input value={daten[feld] ?? ''} onChange={(e) => setD(feld, e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={!!daten.kleinunternehmer} onChange={(e) => setD('kleinunternehmer', e.target.checked)} />
                Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer)
              </label>
              <button onClick={datenSpeichern}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary/90">
                <Save size={12} /> Vereinsdaten speichern
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={herunterladen} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-secondary border border-border text-sm font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50">
            <Download size={14} /> {busy ? '…' : 'PDF herunterladen'}
          </button>
          <button onClick={perMailSenden} disabled={busy || !empf.email}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            <Send size={14} /> Per E-Mail senden
          </button>
        </div>
      </div>
    </div>
  );
}
