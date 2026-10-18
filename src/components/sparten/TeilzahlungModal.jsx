import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { X, Euro, Trash2 } from 'lucide-react';

/**
 * TeilzahlungModal – Teilzahlungen auf eine SpartenAuslage erfassen.
 * Statuslogik: 0 < Summe < Betrag => 'Teilweise'; Summe >= Betrag => 'Erstattet'
 * (+ erstattungsdatum). Verantwortliche der Gruppe/Vorstand (canEdit).
 */
export const parseZahlungen = (raw) => {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};

export default function TeilzahlungModal({ auslage, onClose, onGeaendert }) {
  const [betrag, setBetrag] = useState('');
  const [notiz, setNotiz] = useState('');
  const [busy, setBusy] = useState(false);
  const [liste, setListe] = useState(() => parseZahlungen(auslage.zahlungen));

  const summe = liste.reduce((s, z) => s + (Number(z.betrag) || 0), 0);
  const gesamt = Number(auslage.betrag) || 0;
  const rest = Math.max(0, gesamt - summe);

  const hinzufuegen = async () => {
    const b = Number(betrag);
    if (!b || b <= 0) { toast.error('Bitte einen gültigen Betrag eingeben.'); return; }
    if (b > rest + 0.001) { toast.error(`Betrag übersteigt den Restbetrag (${rest.toFixed(2)} €).`); return; }
    setBusy(true);
    try {
      const neu = [...liste, { datum: new Date().toISOString().split('T')[0], betrag: b, notiz: notiz.trim() }];
      const neueSumme = neu.reduce((s, z) => s + (Number(z.betrag) || 0), 0);
      const fertig = neueSumme >= gesamt - 0.001;
      await base44.entities.SpartenAuslage.update(auslage.id, {
        zahlungen: JSON.stringify(neu),
        status: fertig ? 'Erstattet' : 'Teilweise',
        erstattungsdatum: fertig ? new Date().toISOString().split('T')[0] : undefined,
      });
      setListe(neu);
      setBetrag(''); setNotiz('');
      toast.success(fertig ? 'Auslage vollständig erstattet.' : 'Teilzahlung gespeichert.');
      onGeaendert?.();
      if (fertig) onClose();
    } catch (e) {
      toast.error(e.message || 'Teilzahlung fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const entfernen = async (idx) => {
    setBusy(true);
    try {
      const neu = liste.filter((_, i) => i !== idx);
      const neueSumme = neu.reduce((s, z) => s + (Number(z.betrag) || 0), 0);
      await base44.entities.SpartenAuslage.update(auslage.id, {
        zahlungen: JSON.stringify(neu),
        status: neueSumme <= 0.001 ? 'Offen' : 'Teilweise',
        erstattungsdatum: undefined,
      });
      setListe(neu);
      toast.success('Teilzahlung entfernt.');
      onGeaendert?.();
    } catch (e) {
      toast.error(e.message || 'Entfernen fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-xl bg-card border border-border p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-oswald text-lg text-foreground">Teilzahlungen</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground">{auslage.beschreibung}</p>

        <div className="rounded-lg bg-secondary p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Beglichen</span>
          <span className="text-sm font-semibold text-foreground">{summe.toFixed(2)} € von {gesamt.toFixed(2)} €</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${summe >= gesamt - 0.001 ? 'bg-green-500' : summe > 0 ? 'bg-yellow-500' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, gesamt > 0 ? (summe / gesamt) * 100 : 0)}%` }} />
        </div>

        {liste.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {liste.map((z, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded-lg px-2.5 py-1.5">
                <span className="text-muted-foreground shrink-0">{z.datum}</span>
                <span className="text-foreground font-semibold">{Number(z.betrag).toFixed(2)} €</span>
                {z.notiz && <span className="text-muted-foreground min-w-0 truncate flex-1">{z.notiz}</span>}
                <button onClick={() => entfernen(i)} disabled={busy} className="p-1 rounded-lg text-muted-foreground hover:text-red-400 shrink-0" title="Entfernen"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        {rest > 0.001 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Euro className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="number" step="0.01" min="0.01" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder={`Rest: ${rest.toFixed(2)}`}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <button onClick={hinzufuegen} disabled={busy || !betrag}
                className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                Erfassen
              </button>
            </div>
            <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional, z. B. Überweisung vom …)"
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
