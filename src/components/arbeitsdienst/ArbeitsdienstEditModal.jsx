import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Trash2, Search, Bookmark, GripVertical } from 'lucide-react';

const ZUWEISUNG_STATUS = ['Offen', 'Bestätigt', 'Erledigt', 'Abgesagt', 'Nicht erledigt'];

const STATUS_COLORS = {
  'Offen':          'bg-secondary text-muted-foreground',
  'Bestätigt':      'bg-blue-500/20 text-blue-400',
  'Erledigt':       'bg-green-500/20 text-green-400',
  'Abgesagt':       'bg-red-500/20 text-red-400',
  'Nicht erledigt': 'bg-orange-500/20 text-orange-400',
};

export default function ArbeitsdienstEditModal({ dienst, mitglieder, zuweisungen: initialZuweisungen, onClose, onSaved }) {
  const [form, setForm] = useState({ ...dienst });
  const [saving, setSaving] = useState(false);
  const [zuweisungen, setZuweisungen] = useState(initialZuweisungen);
  const [suche, setSuche] = useState('');
  const [ausgewaehlt, setAusgewaehlt] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [vorlagen, setVorlagen] = useState([]);
  const [selectedVorlage, setSelectedVorlage] = useState('');
  const [vorlageSaving, setVorlageSaving] = useState(false);
  const [vorlageSaved, setVorlageSaved] = useState(false);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    base44.entities.Veranstaltungsvorlage.list('name', 100).then(setVorlagen).catch(() => {});
  }, []);

  // Sync wenn onSaved neue zuweisungen liefert
  useEffect(() => { setZuweisungen(initialZuweisungen); }, [initialZuweisungen]);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const zugewieseneIds = new Set(zuweisungen.map(z => z.mitglied_id));

  const verfuegbar = mitglieder.filter(m =>
    !zugewieseneIds.has(m.id) &&
    (suche.length === 0 || `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()))
  );

  const handleDragStart = (e, mitgliedId) => {
    setDraggedId(mitgliedId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropEingeteilt = async (e) => {
    e.preventDefault();
    if (!draggedId) return;
    
    if (zugewieseneIds.has(draggedId)) {
      setDraggedId(null);
      return; // Already assigned
    }
    
    setAdding(true);
    try {
      const neu = await base44.entities.ArbeitsdienstZuweisung.create({
        arbeitsdienst_id: dienst.id,
        mitglied_id: draggedId,
        status: 'Offen',
      });
      setZuweisungen(prev => [...prev, neu]);
    } catch (e) {}
    setAdding(false);
    setDraggedId(null);
  };

  const handleDropVerfuegbar = async (e) => {
    e.preventDefault();
    if (!draggedId) return;
    
    const zuweisung = zuweisungen.find(z => z.mitglied_id === draggedId);
    if (zuweisung) {
      try {
        await base44.entities.ArbeitsdienstZuweisung.delete(zuweisung.id);
        setZuweisungen(prev => prev.filter(z => z.id !== zuweisung.id));
      } catch (e) {}
    }
    setDraggedId(null);
  };

  const handleRemove = async (zuweisungId) => {
    await base44.entities.ArbeitsdienstZuweisung.delete(zuweisungId);
    setZuweisungen(prev => prev.filter(z => z.id !== zuweisungId));
  };

  const handleZuweisungStatus = async (z, newStatus) => {
    await base44.entities.ArbeitsdienstZuweisung.update(z.id, { status: newStatus });
    setZuweisungen(prev => prev.map(zw => zw.id === z.id ? { ...zw, status: newStatus } : zw));
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Arbeitsdienst.update(dienst.id, {
      titel: form.titel, datum: form.datum, uhrzeit: form.uhrzeit,
      ort: form.ort, beschreibung: form.beschreibung,
      benoetigte_personen: form.benoetigte_personen, status: form.status,
    });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!window.confirm('Arbeitsdienst wirklich löschen?')) return;
    await base44.entities.Arbeitsdienst.delete(dienst.id);
    onSaved();
  };

  const handleUebertrageInVorlage = async () => {
    if (!selectedVorlage) return;
    setVorlageSaving(true);
    const vorlage = vorlagen.find(v => v.id === selectedVorlage);
    if (vorlage) {
      const vorhandene = vorlage.arbeitsdienst_vorlagen || [];
      const idx = vorhandene.findIndex(a => a.titel?.toLowerCase() === form.titel?.toLowerCase());
      const neuer = { titel: form.titel, beschreibung: form.beschreibung || '', benoetigte_personen: form.benoetigte_personen || '' };
      const aktualisiert = idx >= 0 ? vorhandene.map((a, i) => i === idx ? neuer : a) : [...vorhandene, neuer];
      await base44.entities.Veranstaltungsvorlage.update(selectedVorlage, { arbeitsdienst_vorlagen: aktualisiert });
      setVorlageSaved(true);
      setTimeout(() => setVorlageSaved(false), 2500);
    }
    setVorlageSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h3 className="font-bold text-foreground text-lg">Arbeitsdienst bearbeiten</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {/* Body: 2 Spalten */}
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Linke Spalte: Stammdaten + Vorlage */}
          <div className="lg:w-80 lg:border-r border-border p-5 space-y-3 overflow-y-auto shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</p>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Titel</label>
              <input value={form.titel} onChange={e => set('titel', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Datum</label>
                <input type="date" value={form.datum || ''} onChange={e => set('datum', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Uhrzeit</label>
                <input type="time" value={form.uhrzeit || ''} onChange={e => set('uhrzeit', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
              <input value={form.ort || ''} onChange={e => set('ort', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Personen</label>
                <input type="number" min="0" value={form.benoetigte_personen || ''} onChange={e => set('benoetigte_personen', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
                <select value={form.status || 'Offen'} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                  {['Offen', 'In Planung', 'Abgeschlossen'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
              <textarea value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)}
                rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>

            {/* Vorlage */}
            {vorlagen.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Bookmark size={12} /> In Vorlage übertragen
                </p>
                <div className="flex gap-2">
                  <select value={selectedVorlage} onChange={e => setSelectedVorlage(e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary">
                    <option value="">Vorlage wählen...</option>
                    {vorlagen.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <button onClick={handleUebertrageInVorlage} disabled={!selectedVorlage || vorlageSaving}
                    className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0">
                    {vorlageSaved ? '✓' : vorlageSaving ? '...' : 'OK'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rechte Spalte: Drag & Drop Einteilung */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden border-t lg:border-t-0 border-border">

            {/* Verfügbare Mitglieder */}
            <div className="flex-1 flex flex-col border-r border-border min-h-0">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Verfügbar ({verfuegbar.length})
                </p>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={suche}
                    onChange={e => setSuche(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">💡 Ziehe Mitglieder nach rechts</p>
              </div>
              <div 
                className="flex-1 overflow-y-auto px-2 pb-2 min-h-0"
                onDragOver={handleDragOver}
                onDrop={handleDropVerfuegbar}
              >
                {verfuegbar.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">Alle eingeteilt</p>
                )}
                {verfuegbar.map(m => (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, m.id)}
                    onDragEnd={() => setDraggedId(null)}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 cursor-move border transition-all ${
                      draggedId === m.id ? 'opacity-50 bg-secondary border-border' : 'hover:bg-secondary bg-secondary/30 border-border/50'
                    }`}
                  >
                    <GripVertical size={12} className="text-muted-foreground shrink-0" />
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{m.vorname} {m.nachname}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{m.mitgliedsstatus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Eingeteilt */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-4 pb-2 shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Eingeteilt ({zuweisungen.length}{form.benoetigte_personen ? `/${form.benoetigte_personen}` : ''})
                </p>
                <p className="text-[10px] text-muted-foreground">💡 Ziehe zurück nach links</p>
              </div>
              <div 
                className="flex-1 overflow-y-auto px-2 pb-2 min-h-0 bg-primary/5 rounded-lg"
                onDragOver={handleDragOver}
                onDrop={handleDropEingeteilt}
              >
                {zuweisungen.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">Noch niemand eingeteilt</p>
                )}
                {zuweisungen.map(z => {
                  const m = mitglieder.find(m => m.id === z.mitglied_id);
                  return (
                    <div 
                      key={z.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, z.mitglied_id)}
                      onDragEnd={() => setDraggedId(null)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 group cursor-move border transition-all ${
                        draggedId === z.mitglied_id ? 'opacity-50 bg-card border-primary/20' : 'hover:bg-secondary/50 bg-card border-primary/20'
                      }`}
                    >
                      <GripVertical size={12} className="text-muted-foreground shrink-0" />
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                        {m?.vorname?.[0]}{m?.nachname?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{m ? `${m.vorname} ${m.nachname}` : '–'}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[z.status] || STATUS_COLORS['Offen']}`}>
                          {z.status}
                        </span>
                      </div>
                      <select
                        value={z.status}
                        onChange={e => handleZuweisungStatus(z, e.target.value)}
                        className="text-[10px] px-1.5 py-1 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary shrink-0"
                        onDragStart={e => e.stopPropagation()}
                      >
                        {ZUWEISUNG_STATUS.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => handleRemove(z.id)} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={handleDelete} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}