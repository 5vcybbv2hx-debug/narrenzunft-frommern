import { useState } from 'react';
import { X, Save, Trash2, Search, AlertTriangle } from 'lucide-react';

const STATUS_OPTIONEN = ['Reserviert', 'Ausgeliehen', 'Zurückgegeben', 'Abgesagt'];

export default function AusleiheForm({ ausleihe, ausruestung, ausruestungen, mitglieder, ausleihen, meinMitglied, onSave, onDelete, onClose }) {
  const isNew = !ausleihe;
  const [form, setForm] = useState({
    ausruestung_id: ausruestung?.id || '',
    ausleiher_mitglied_id: meinMitglied?.id || '',
    von_datum: '',
    bis_datum: '',
    zweck: '',
    status: 'Reserviert',
    schadensbericht: '',
    notizen: '',
    ...ausleihe,
  });
  const [suche, setSuche] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const getMitglied = (id) => mitglieder.find(m => m.id === id);

  const suchErgebnisse = suche.length > 0
    ? mitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 5)
    : [];

  // Konflikt-Check: gibt es bereits eine Ausleihe in diesem Zeitraum?
  const konflikt = form.ausruestung_id && form.von_datum && form.bis_datum
    ? ausleihen.find(al =>
        al.ausruestung_id === form.ausruestung_id &&
        al.id !== ausleihe?.id &&
        ['Reserviert', 'Ausgeliehen'].includes(al.status) &&
        al.von_datum <= form.bis_datum &&
        al.bis_datum >= form.von_datum
      )
    : null;

  const gewaehlteAusruestung = ausruestungen.find(a => a.id === form.ausruestung_id);
  const ausleiher = getMitglied(form.ausleiher_mitglied_id);

  const handleSave = async () => {
    if (!form.ausruestung_id || !form.ausleiher_mitglied_id || !form.von_datum || !form.bis_datum) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">{isNew ? 'Ausleihe eintragen' : 'Ausleihe bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          {/* Gegenstand */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Gegenstand *</label>
            <select value={form.ausruestung_id} onChange={e => set('ausruestung_id', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
              <option value="">– bitte wählen –</option>
              {ausruestungen.map(a => <option key={a.id} value={a.id}>{a.name} ({a.kategorie})</option>)}
            </select>
          </div>

          {/* Ausleiher */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Ausleiher *</label>
            {ausleiher && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                  {ausleiher.vorname?.[0]}{ausleiher.nachname?.[0]}
                </div>
                <span className="text-sm text-primary font-medium flex-1">{ausleiher.vorname} {ausleiher.nachname}</span>
                <button onClick={() => set('ausleiher_mitglied_id', '')} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
              </div>
            )}
            {!ausleiher && (
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Person suchen..." value={suche} onChange={e => setSuche(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                {suchErgebnisse.length > 0 && (
                  <div className="mt-1 bg-popover border border-border rounded-xl overflow-hidden">
                    {suchErgebnisse.map(m => (
                      <button key={m.id} onClick={() => { set('ausleiher_mitglied_id', m.id); setSuche(''); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary border-b border-border last:border-0">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                          {m.vorname?.[0]}{m.nachname?.[0]}
                        </div>
                        <span className="text-foreground">{m.vorname} {m.nachname}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zeitraum */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Von *</label>
              <input type="date" value={form.von_datum} onChange={e => set('von_datum', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Bis *</label>
              <input type="date" value={form.bis_datum} onChange={e => set('bis_datum', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
          </div>

          {/* Konflikt-Warnung */}
          {konflikt && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">
                <strong>Konflikt!</strong> {gewaehlteAusruestung?.name} ist von {konflikt.von_datum} bis {konflikt.bis_datum} bereits vergeben.
              </p>
            </div>
          )}

          {/* Zweck & Status */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Zweck / Veranstaltung</label>
            <input value={form.zweck || ''} onChange={e => set('zweck', e.target.value)}
              placeholder="z.B. Dorffest"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
              {STATUS_OPTIONEN.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Schadensbericht bei Rückgabe */}
          {(form.status === 'Zurückgegeben') && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Schadensbericht (optional)</label>
              <textarea value={form.schadensbericht || ''} onChange={e => set('schadensbericht', e.target.value)} rows={2}
                placeholder="Schäden oder Besonderheiten bei Rückgabe..."
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
            <textarea value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {!isNew && (
            <button onClick={() => { if (window.confirm('Ausleihe löschen?')) onDelete(ausleihe.id); }}
              className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.ausruestung_id || !form.ausleiher_mitglied_id || !form.von_datum || !form.bis_datum}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}