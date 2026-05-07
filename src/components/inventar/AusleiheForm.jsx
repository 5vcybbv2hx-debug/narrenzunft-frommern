import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Save, Trash2, Search, AlertTriangle, Users, UserPlus, Plus } from 'lucide-react';

const STATUS_OPTIONEN = ['Reserviert', 'Ausgeliehen', 'Zurückgegeben', 'Abgesagt'];

const EMPTY_EXTERN = { name: '', organisation: '', telefon: '', email: '', adresse: '', notizen: '' };

export default function AusleiheForm({ ausleihe, ausruestung, ausruestungen, mitglieder, ausleihen, meinMitglied, onSave, onDelete, onClose }) {
  const isNew = !ausleihe;
  const [form, setForm] = useState({
    ausruestung_id: ausruestung?.id || '',
    ausleiher_typ: 'mitglied',
    ausleiher_mitglied_id: meinMitglied?.id || '',
    ausleiher_extern_id: '',
    von_datum: '',
    bis_datum: '',
    zweck: '',
    status: 'Reserviert',
    schadensbericht: '',
    notizen: '',
    ...ausleihe,
  });
  const [suche, setSuche] = useState('');
  const [externSuche, setExternSuche] = useState('');
  const [externPersonen, setExternPersonen] = useState([]);
  const [externDropdownOffen, setExternDropdownOffen] = useState(false);
  const [showNeuExtern, setShowNeuExtern] = useState(false);
  const [neuExtern, setNeuExtern] = useState(EMPTY_EXTERN);
  const [saving, setSaving] = useState(false);
  const [savingExtern, setSavingExtern] = useState(false);
  const externRef = useRef(null);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    base44.entities.ExternePerson.list('name', 200).then(setExternPersonen).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (externRef.current && !externRef.current.contains(e.target)) setExternDropdownOffen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getMitglied = (id) => mitglieder.find(m => m.id === id);
  const getExternPerson = (id) => externPersonen.find(p => p.id === id);

  const suchErgebnisse = suche.length > 0
    ? mitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 5)
    : [];

  const externSuchErgebnisse = externSuche.length > 0
    ? externPersonen.filter(p => `${p.name} ${p.organisation || ''}`.toLowerCase().includes(externSuche.toLowerCase())).slice(0, 6)
    : externPersonen.slice(0, 6);

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
  const externPerson = getExternPerson(form.ausleiher_extern_id);

  const canSave = form.ausruestung_id && form.von_datum && form.bis_datum &&
    (form.ausleiher_typ === 'mitglied' ? form.ausleiher_mitglied_id : form.ausleiher_extern_id);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handleCreateExtern = async () => {
    if (!neuExtern.name) return;
    setSavingExtern(true);
    try {
      const created = await base44.entities.ExternePerson.create(neuExtern);
      setExternPersonen(prev => [...prev, created]);
      set('ausleiher_extern_id', created.id);
      setShowNeuExtern(false);
      setNeuExtern(EMPTY_EXTERN);
    } catch (e) {}
    setSavingExtern(false);
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

          {/* Ausleiher Typ Toggle */}
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Ausleiher *</label>
            <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-3">
              <button
                type="button"
                onClick={() => set('ausleiher_typ', 'mitglied')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${form.ausleiher_typ === 'mitglied' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Users size={14} /> Mitglied
              </button>
              <button
                type="button"
                onClick={() => set('ausleiher_typ', 'extern')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${form.ausleiher_typ === 'extern' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <UserPlus size={14} /> Externe Person
              </button>
            </div>

            {/* Mitglied suchen */}
            {form.ausleiher_typ === 'mitglied' && (
              <>
                {ausleiher ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {ausleiher.vorname?.[0]}{ausleiher.nachname?.[0]}
                    </div>
                    <span className="text-sm text-primary font-medium flex-1">{ausleiher.vorname} {ausleiher.nachname}</span>
                    <button onClick={() => set('ausleiher_mitglied_id', '')} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Mitglied suchen..." value={suche} onChange={e => setSuche(e.target.value)}
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
              </>
            )}

            {/* Externe Person */}
            {form.ausleiher_typ === 'extern' && (
              <div>
                {externPerson ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold shrink-0">
                      {externPerson.name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground font-medium">{externPerson.name}</p>
                      {externPerson.organisation && <p className="text-xs text-muted-foreground">{externPerson.organisation}</p>}
                    </div>
                    <button onClick={() => set('ausleiher_extern_id', '')} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
                  </div>
                ) : (
                  <div ref={externRef} className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Externe Person suchen..."
                      value={externSuche}
                      onChange={e => { setExternSuche(e.target.value); setExternDropdownOffen(true); }}
                      onFocus={() => setExternDropdownOffen(true)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    {externDropdownOffen && (
                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                        {externSuchErgebnisse.map(p => (
                          <button key={p.id} onClick={() => { set('ausleiher_extern_id', p.id); setExternDropdownOffen(false); setExternSuche(''); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary border-b border-border last:border-0">
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-[10px] font-bold shrink-0">
                              {p.name?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{p.name}</p>
                              {p.organisation && <p className="text-xs text-muted-foreground">{p.organisation}</p>}
                            </div>
                          </button>
                        ))}
                        {externSuchErgebnisse.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-2">Keine Ergebnisse</p>
                        )}
                        <button
                          onClick={() => { setShowNeuExtern(true); setExternDropdownOffen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-primary hover:bg-primary/10 border-t border-border font-medium"
                        >
                          <Plus size={14} /> Neue externe Person anlegen
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Neue externe Person anlegen */}
                {showNeuExtern && (
                  <div className="mt-3 p-3 bg-secondary/50 border border-border rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-foreground">Neue externe Person</p>
                    <input
                      type="text" placeholder="Name *" value={neuExtern.name}
                      onChange={e => setNeuExtern(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    <input
                      type="text" placeholder="Organisation / Verein" value={neuExtern.organisation}
                      onChange={e => setNeuExtern(p => ({ ...p, organisation: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text" placeholder="Telefon" value={neuExtern.telefon}
                        onChange={e => setNeuExtern(p => ({ ...p, telefon: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                      />
                      <input
                        type="email" placeholder="E-Mail" value={neuExtern.email}
                        onChange={e => setNeuExtern(p => ({ ...p, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowNeuExtern(false)} className="flex-1 py-2 rounded-lg bg-card border border-border text-xs text-muted-foreground">Abbrechen</button>
                      <button onClick={handleCreateExtern} disabled={savingExtern || !neuExtern.name}
                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                        {savingExtern ? '...' : 'Anlegen & auswählen'}
                      </button>
                    </div>
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

          {form.status === 'Zurückgegeben' && (
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
          <button onClick={handleSave} disabled={saving || !canSave}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}