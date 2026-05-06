import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, Save, LayoutTemplate, Edit, Bus, Clock, MapPin, Briefcase } from 'lucide-react';

const TYP_OPTIONEN = ['Umzug', 'Abendveranstaltung', 'Intern', 'Arbeitsdienst', 'Fest'];

export default function VeranstaltungsvorlagenModal({ onClose }) {
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ansicht, setAnsicht] = useState('liste'); // 'liste' | 'form'
  const [editVorlage, setEditVorlage] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const [saving, setSaving] = useState(false);

  function defaultForm() {
    return {
      name: '', typ: 'Intern', ort: '', uhrzeit: '', beschreibung: '',
      bus_erforderlich: false, anmeldung_aktiv: true,
      busparkplatz_adresse: '', busparkplatz_treffzeit: '', hinweise: '',
      arbeitsdienst_vorlagen: [],
    };
  }

  useEffect(() => { loadVorlagen(); }, []);

  const loadVorlagen = async () => {
    setLoading(true);
    const data = await base44.entities.Veranstaltungsvorlage.list('name', 100);
    setVorlagen(data);
    setLoading(false);
  };

  const openNeu = () => {
    setEditVorlage(null);
    setForm(defaultForm());
    setAnsicht('form');
  };

  const openEdit = (v) => {
    setEditVorlage(v);
    setForm({
      name: v.name || '', typ: v.typ || 'Intern', ort: v.ort || '',
      uhrzeit: v.uhrzeit || '', beschreibung: v.beschreibung || '',
      bus_erforderlich: v.bus_erforderlich || false,
      anmeldung_aktiv: v.anmeldung_aktiv !== false,
      busparkplatz_adresse: v.busparkplatz_adresse || '',
      busparkplatz_treffzeit: v.busparkplatz_treffzeit || '',
      hinweise: v.hinweise || '',
      arbeitsdienst_vorlagen: v.arbeitsdienst_vorlagen || [],
    });
    setAnsicht('form');
  };

  const handleArbeitsdienstVorlageChange = (idx, field, value) => {
    setForm(p => {
      const liste = [...(p.arbeitsdienst_vorlagen || [])];
      liste[idx] = { ...liste[idx], [field]: value };
      return { ...p, arbeitsdienst_vorlagen: liste };
    });
  };

  const handleArbeitsdienstVorlageAdd = () => {
    setForm(p => ({
      ...p,
      arbeitsdienst_vorlagen: [...(p.arbeitsdienst_vorlagen || []), { titel: '', beschreibung: '', benoetigte_personen: '' }],
    }));
  };

  const handleArbeitsdienstVorlageRemove = (idx) => {
    setForm(p => ({
      ...p,
      arbeitsdienst_vorlagen: (p.arbeitsdienst_vorlagen || []).filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    if (editVorlage) {
      await base44.entities.Veranstaltungsvorlage.update(editVorlage.id, form);
    } else {
      await base44.entities.Veranstaltungsvorlage.create(form);
    }
    setSaving(false);
    await loadVorlagen();
    setAnsicht('liste');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Vorlage löschen?')) return;
    await base44.entities.Veranstaltungsvorlage.delete(id);
    setVorlagen(prev => prev.filter(v => v.id !== id));
  };

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={16} className="text-primary" />
            <h3 className="font-bold text-foreground">
              {ansicht === 'form' ? (editVorlage ? 'Vorlage bearbeiten' : 'Neue Vorlage') : 'Veranstaltungsvorlagen'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {ansicht === 'liste' && (
              <button onClick={openNeu}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                <Plus size={13} /> Neue Vorlage
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Liste */}
        {ansicht === 'liste' && (
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : vorlagen.length === 0 ? (
              <div className="text-center py-10">
                <LayoutTemplate size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">Noch keine Vorlagen</p>
                <p className="text-xs text-muted-foreground">Erstelle Vorlagen für wiederkehrende Veranstaltungstypen.</p>
                <button onClick={openNeu} className="mt-3 text-sm text-primary hover:underline">Erste Vorlage erstellen</button>
              </div>
            ) : (
              <div className="space-y-2">
                {vorlagen.map(v => (
                  <div key={v.id} className="bg-secondary/40 border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{v.name}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{v.typ}</span>
                        {v.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {v.ort}</span>}
                        {v.uhrzeit && <span className="flex items-center gap-1"><Clock size={10} /> {v.uhrzeit}</span>}
                        {v.bus_erforderlich && <span className="flex items-center gap-1"><Bus size={10} /> Bus</span>}
                      </div>
                      {v.beschreibung && <p className="text-xs text-muted-foreground mt-1.5">{v.beschreibung}</p>}
                      {v.arbeitsdienst_vorlagen?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Briefcase size={10} /> {v.arbeitsdienst_vorlagen.length} Arbeitsdienst{v.arbeitsdienst_vorlagen.length !== 1 ? 'e' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openEdit(v)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => handleDelete(v.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formular */}
        {ansicht === 'form' && (
          <div className="p-6 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="z.B. Sonnwendfeier Standard"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Typ</label>
              <div className="flex flex-wrap gap-1.5">
                {TYP_OPTIONEN.map(t => (
                  <button key={t} type="button" onClick={() => set('typ', t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.typ === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
                <input value={form.ort} onChange={e => set('ort', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Uhrzeit</label>
                <input type="time" value={form.uhrzeit} onChange={e => set('uhrzeit', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
              <textarea value={form.beschreibung} onChange={e => set('beschreibung', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Hinweise</label>
              <textarea value={form.hinweise} onChange={e => set('hinweise', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input type="checkbox" checked={form.bus_erforderlich} onChange={e => set('bus_erforderlich', e.target.checked)} className="rounded" />
                Bus erforderlich
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input type="checkbox" checked={form.anmeldung_aktiv} onChange={e => set('anmeldung_aktiv', e.target.checked)} className="rounded" />
                Anmeldung aktiv
              </label>
            </div>
            {form.bus_erforderlich && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Busparkplatz</label>
                  <input value={form.busparkplatz_adresse} onChange={e => set('busparkplatz_adresse', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Treffzeit</label>
                  <input type="time" value={form.busparkplatz_treffzeit} onChange={e => set('busparkplatz_treffzeit', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
            )}
            {/* Arbeitsdienst-Vorlagen */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Briefcase size={12} /> Arbeitsdienste ({(form.arbeitsdienst_vorlagen || []).length})
                </p>
                <button onClick={handleArbeitsdienstVorlageAdd}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                  <Plus size={12} /> Hinzufügen
                </button>
              </div>
              <div className="space-y-2">
                {(form.arbeitsdienst_vorlagen || []).map((ad, idx) => (
                  <div key={idx} className="bg-secondary/50 border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={ad.titel || ''}
                        onChange={e => handleArbeitsdienstVorlageChange(idx, 'titel', e.target.value)}
                        placeholder="Titel *"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <input
                        type="number"
                        min="0"
                        value={ad.benoetigte_personen || ''}
                        onChange={e => handleArbeitsdienstVorlageChange(idx, 'benoetigte_personen', e.target.value ? Number(e.target.value) : '')}
                        placeholder="Pers."
                        className="w-16 px-2 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                      <button onClick={() => handleArbeitsdienstVorlageRemove(idx)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                    <input
                      value={ad.beschreibung || ''}
                      onChange={e => handleArbeitsdienstVorlageChange(idx, 'beschreibung', e.target.value)}
                      placeholder="Beschreibung (optional)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
                {(form.arbeitsdienst_vorlagen || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Noch keine Arbeitsdienste definiert</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setAnsicht('liste')} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm">Zurück</button>
              <button onClick={handleSave} disabled={saving || !form.name}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} /> {saving ? '...' : 'Speichern'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}