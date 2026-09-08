import { useState } from 'react';
import { X, CalendarDays } from 'lucide-react';
import DateSelect from '@/components/ui/DateSelect';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

/** Bestellrunde anlegen/bearbeiten (Admin): Titel, Frist, Notiz. */
export default function BestellrundeModal({ runde, onClose, onSaved }) {
  const [titel, setTitel] = useState(runde?.titel || '');
  const [frist, setFrist] = useState(runde?.frist_datum || '');
  const [notiz, setNotiz] = useState(runde?.notiz || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!titel.trim()) return toast.error('Bitte einen Titel angeben.');
    if (!frist) return toast.error('Bitte eine Bestellfrist festlegen.');
    setSaving(true);
    try {
      const data = { titel: titel.trim(), frist_datum: frist, notiz: notiz.trim() };
      if (runde?.id) await base44.entities.Bestellrunde.update(runde.id, data);
      else await base44.entities.Bestellrunde.create({ ...data, status: 'Offen' });
      toast.success(runde?.id ? 'Bestellrunde aktualisiert.' : 'Bestellrunde angelegt.');
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
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-oswald font-bold text-white text-lg uppercase tracking-wide flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            {runde?.id ? 'Bestellrunde bearbeiten' : 'Neue Bestellrunde'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Titel</label>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="z.B. Becher-Bestellung 2026"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Bestellfrist</label>
            <DateSelect value={frist} onChange={(e) => setFrist(e.target.value)} name="frist_datum" />
            <p className="text-xs text-muted-foreground mt-1.5">
              Mitglieder können bis einschließlich dieses Tages bestellen.
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1.5">Notiz an die Mitglieder (optional)</label>
            <textarea
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              rows={3}
              placeholder="z.B. Abholung und Bezahlung beim nächsten Häsabend"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
              Abbrechen
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
