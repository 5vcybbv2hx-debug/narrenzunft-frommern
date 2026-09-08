import { useState } from 'react';
import { X, Package } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/** Internen Artikel anlegen/bearbeiten (Admin). */
const KATEGORIEN = ['Becher', 'Ersatzteile', 'Sonstiges'];

const Toggle = ({ label, hint, value, onChange }) => (
  <button type="button" onClick={() => onChange(!value)}
    className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-left">
    <span className="pr-3">
      <span className="text-sm text-foreground font-medium block leading-tight">{label}</span>
      {hint && <span className="text-xs text-muted-foreground leading-tight">{hint}</span>}
    </span>
    <span className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-border'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  </button>
);

export default function InternerArtikelModal({ artikel, gruppen = [], onClose, onSaved }) {
  const [name, setName] = useState(artikel?.name || '');
  const [beschreibung, setBeschreibung] = useState(artikel?.beschreibung || '');
  const [kategorie, setKategorie] = useState(artikel?.kategorie || 'Becher');
  const [varianten, setVarianten] = useState(artikel?.varianten || '');
  const [personalisierung, setPersonalisierung] = useState(artikel?.personalisierung || false);
  const [sparteLogo, setSparteLogo] = useState(artikel?.sparte_logo || false);
  const [preis, setPreis] = useState(artikel?.preis ?? 0);
  const [aktiv, setAktiv] = useState(artikel?.aktiv ?? true);
  const [spartenIds, setSpartenIds] = useState(
    (artikel?.sparten || '').split(',').map((v) => v.trim()).filter(Boolean)
  );
  const [saving, setSaving] = useState(false);

  const toggleSparte = (id) =>
    setSpartenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    if (!name.trim()) return toast.error('Bitte einen Namen angeben.');
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        beschreibung: beschreibung.trim(),
        kategorie,
        varianten: varianten.split(',').map((v) => v.trim()).filter(Boolean).join(','),
        personalisierung,
        sparte_logo: sparteLogo,
        preis: Number(preis) || 0,
        aktiv,
        sparten: spartenIds.join(','),
      };
      if (artikel?.id) await base44.entities.InternerArtikel.update(artikel.id, data);
      else await base44.entities.InternerArtikel.create(data);
      toast.success(artikel?.id ? 'Artikel aktualisiert.' : 'Artikel angelegt.');
      onSaved?.();
    } catch (e) {
      console.error(e);
      toast.error('Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald font-bold text-white text-lg uppercase tracking-wide flex items-center gap-2">
            <Package size={18} className="text-primary" />
            {artikel?.id ? 'Artikel bearbeiten' : 'Neuer Artikel'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Becher 0,3l"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Beschreibung</label>
            <textarea value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2}
              placeholder="z.B. Edelstahlbecher mit Zunft-Logo, handlich fürs Häsränke"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Kategorie</label>
            <div className="flex gap-1.5">
              {KATEGORIEN.map((k) => (
                <button key={k} type="button" onClick={() => setKategorie(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors ${kategorie === k ? 'bg-primary text-white' : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Varianten (Komma-getrennt)</label>
            <input value={varianten} onChange={(e) => setVarianten(e.target.value)} placeholder="z.B. Silber, Schwarz"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
            <p className="text-xs text-muted-foreground mt-1.5">Leer lassen, wenn der Artikel nur in einer Ausführung gibt.</p>
          </div>

          <Toggle label="Personalisierung (Gravur)" hint="Mitglied muss einen Namen zum Lasern angeben"
            value={personalisierung} onChange={setPersonalisierung} />
          <Toggle label="Sparten-Logo" hint="Logo der Sparte des Bestellers (z.B. Garde, Hexen)"
            value={sparteLogo} onChange={setSparteLogo} />

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Preis (€, optional)</label>
            <input type="number" min="0" step="0.5" value={preis} onChange={(e) => setPreis(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-colors" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Für welche Sparten?</label>
            <div className="flex flex-wrap gap-1.5">
              {gruppen.map((g) => (
                <button key={g.id} type="button" onClick={() => toggleSparte(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${spartenIds.includes(g.id) ? 'bg-primary text-white' : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'}`}>
                  {g.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {spartenIds.length === 0
                ? 'Keine Sparte gewählt = allgemein für alle (unter „Allgemein“ gelistet).'
                : 'Der Artikel erscheint in der Mitglieder-Ansicht unter den gewählten Sparten.'}
            </p>
          </div>

          <Toggle label="Aktiv" hint="Inaktive Artikel sind für Mitglieder nicht bestellbar"
            value={aktiv} onChange={setAktiv} />

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
              Abbrechen
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
