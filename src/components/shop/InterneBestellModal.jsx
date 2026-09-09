import { useState } from 'react';
import { X, Minus, Plus, PenLine, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import MobileSelect from '@/components/MobileSelect';

/**
 * Bestell-Modal für einen Artikel der aktiven Bestellrunde.
 * - Variante (falls vorhanden) und Anzahl
 * - "Für wen" (Familienmitbestellung: freier Name, default eigenes Profil)
 * - Sparte/Logo: automatisch aus dem Profil, änderbar (Kind in anderer Gruppe)
 * - Gravur-Name: Pflicht, wenn der Artikel personalisiert wird (Becher-Laser)
 */
export default function InterneBestellModal({ artikel, runde, profil, gruppen, onClose, onSaved }) {
  const varianten = (artikel.varianten || '').split(',').map((v) => v.trim()).filter(Boolean);
  const eigeneSparte = gruppen.find((g) => g.id === profil?.haesgruppe_id);

  const [variante, setVariante] = useState(varianten[0] || '');
  const [anzahl, setAnzahl] = useState(1);
  const [fuerName, setFuerName] = useState(profil ? `${profil.vorname} ${profil.nachname}`.trim() : '');
  const [sparteId, setSparteId] = useState(profil?.haesgruppe_id || '');
  const [gravur, setGravur] = useState('');
  const [gravurManuell, setGravurManuell] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Gravur standardmäßig = Empfängername, solange der Nutzer sie nicht selbst editiert hat
  const updateFuer = (v) => {
    setFuerName(v);
    if (!gravurManuell) setGravur(v);
  };

  const save = async () => {
    if (!profil) { setError('Kein Mitgliederprofil verknüpft.'); return; }
    if (artikel.personalisierung && !gravur.trim()) {
      setError('Bitte den Namen für die Gravur angeben.');
      return;
    }
    setSaving(true);
    try {
      const sparte = gruppen.find((g) => g.id === sparteId);
      await base44.entities.InterneBestellung.create({
        runde_id: runde.id,
        mitglied_id: profil.id,
        mitglied_name: `${profil.vorname} ${profil.nachname}`.trim(),
        artikel_id: artikel.id,
        artikel_name: artikel.name,
        variante,
        sparte_id: artikel.sparte_logo ? sparteId : '',
        sparte_name: artikel.sparte_logo ? (sparte?.name || '') : '',
        fuer_name: fuerName.trim() || `${profil.vorname} ${profil.nachname}`.trim(),
        gravur_name: artikel.personalisierung ? gravur.trim() : '',
        anzahl: Number(anzahl) || 1,
        status: 'Offen',
        notiz: notiz.trim(),
      });
      toast.success('Bestellung abgegeben!');
      onSaved?.();
    } catch (e) {
      console.error(e);
      setError('Bestellung konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-oswald font-bold text-white text-lg uppercase tracking-wide">{artikel.name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{runde.titel}</p>

        <div className="space-y-4">
          {varianten.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Ausführung</label>
              <div className="flex gap-1.5">
                {varianten.map((v) => (
                  <button key={v} type="button" onClick={() => setVariante(v)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${variante === v ? 'bg-primary text-white' : 'bg-secondary border border-border text-foreground hover:bg-border'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Anzahl</label>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setAnzahl((n) => Math.max(1, n - 1))}
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-border">
                <Minus size={15} />
              </button>
              <span className="text-xl font-oswald font-bold text-foreground w-10 text-center">{anzahl}</span>
              <button type="button" onClick={() => setAnzahl((n) => Math.min(99, n + 1))}
                className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-border">
                <Plus size={15} />
              </button>
              {artikel.preis > 0 && (
                <span className="ml-auto text-sm text-primary font-semibold font-oswald">
                  {(artikel.preis * anzahl).toFixed(2).replace('.', ',')} €
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Für wen?</label>
            <input value={fuerName} onChange={(e) => updateFuer(e.target.value)}
              placeholder="z.B. Name des Kindes"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Für Familienmitbestellung: Hier den Namen eintragen, der den Artikel bekommt.
            </p>
          </div>

          {artikel.sparte_logo && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Logo / Sparte</label>
              <MobileSelect
                value={sparteId}
                onChange={(v) => setSparteId(v)}
                placeholder="– Keine Sparte –"
                options={[{ label: '– Keine Sparte –', value: '' }, ...gruppen.map((g) => ({ label: g.name, value: g.id }))]}
              />
              {eigeneSparte && sparteId === eigeneSparte.id && (
                <p className="text-xs text-muted-foreground mt-1.5">Automatisch aus deinem Profil übernommen.</p>
              )}
            </div>
          )}

          {artikel.personalisierung && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5 flex items-center gap-1.5">
                <PenLine size={12} className="text-primary" /> Name für die Gravur *
              </label>
              <input value={gravur} onChange={(e) => { setGravurManuell(true); setGravur(e.target.value); }}
                placeholder="Wird auf den Becher gelasert"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
              <p className="text-xs text-yellow-400 mt-1.5">
                Bitte prüfen – genau dieser Name wird gelasert und kann später nicht geändert werden.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Notiz (optional)</label>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
              placeholder="z.B. Anmerkung zur Abholung"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-900/20 border border-red-700/30 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
              Abbrechen
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Wird gesendet…' : 'Bestellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}