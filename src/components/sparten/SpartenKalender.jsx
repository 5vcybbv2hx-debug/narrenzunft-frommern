import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, X, Save, Trash2, Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYP_FARBEN = {
  'Probe':       'bg-blue-500/20 text-blue-400',
  'Auftritt':    'bg-primary/20 text-primary',
  'Besprechung': 'bg-purple-500/20 text-purple-400',
  'Ausflug':     'bg-green-500/20 text-green-400',
  'Sonstiges':   'bg-gray-500/20 text-gray-400',
};

const LEER = { titel: '', typ: 'Probe', datum: '', uhrzeit: '', endzeit: '', ort: '', beschreibung: '' };

export default function SpartenKalender({ gruppe, kannBearbeiten }) {
  const [termine, setTermine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTermin, setEditTermin] = useState(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadTermine();
  }, [gruppe.id]);

  const loadTermine = async () => {
    setLoading(true);
    const data = await base44.entities.SpartenTermin.filter({ haesgruppe_id: gruppe.id });
    setTermine(data.sort((a, b) => a.datum.localeCompare(b.datum)));
    setLoading(false);
  };

  const openNew = () => {
    setEditTermin(null);
    setForm(LEER);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditTermin(t);
    setForm(t);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    if (editTermin) {
      await base44.entities.SpartenTermin.update(editTermin.id, form);
    } else {
      await base44.entities.SpartenTermin.create({ ...form, haesgruppe_id: gruppe.id });
    }
    setSaving(false);
    setShowForm(false);
    loadTermine();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Termin löschen?')) return;
    await base44.entities.SpartenTermin.delete(id);
    setTermine(prev => prev.filter(t => t.id !== id));
  };

  const kommend = termine.filter(t => t.datum >= today);
  const vergangen = termine.filter(t => t.datum < today);

  if (loading) return <div className="py-6 flex justify-center"><div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {kannBearbeiten && (
        <div className="flex justify-end">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Termin hinzufügen
          </button>
        </div>
      )}

      {kommend.length === 0 && vergangen.length === 0 && (
        <div className="text-center py-10">
          <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Termine geplant</p>
        </div>
      )}

      {kommend.length > 0 && (
        <div className="space-y-2">
          {kommend.map(t => (
            <TerminKarte key={t.id} termin={t} kannBearbeiten={kannBearbeiten} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {vergangen.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vergangene Termine</p>
          <div className="space-y-2 opacity-60">
            {vergangen.slice().reverse().slice(0, 5).map(t => (
              <TerminKarte key={t.id} termin={t} kannBearbeiten={kannBearbeiten} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editTermin ? 'Termin bearbeiten' : 'Neuer Termin'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Titel *"
                value={form.titel}
                onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <div className="grid grid-cols-2 gap-2">
                {['Probe', 'Auftritt', 'Besprechung', 'Ausflug', 'Sonstiges'].map(typ => (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, typ }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${form.typ === typ ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}
                  >
                    {typ}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
                  <input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Uhrzeit</label>
                  <input type="time" value={form.uhrzeit} onChange={e => setForm(p => ({ ...p, uhrzeit: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <input
                type="text"
                placeholder="Ort (optional)"
                value={form.ort}
                onChange={e => setForm(p => ({ ...p, ort: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Beschreibung (optional)"
                value={form.beschreibung}
                onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              {editTermin && (
                <button onClick={() => handleDelete(editTermin.id)} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button onClick={handleSave} disabled={saving || !form.titel || !form.datum}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save size={14} /> {saving ? '...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TerminKarte({ termin: t, kannBearbeiten, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-[9px] text-muted-foreground">{format(new Date(t.datum), 'MMM', { locale: de })}</span>
        <span className="text-sm font-bold text-primary">{format(new Date(t.datum), 'd')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{t.titel}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYP_FARBEN[t.typ]}`}>{t.typ}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          {t.uhrzeit && <span className="flex items-center gap-1"><Clock size={10} /> {t.uhrzeit}{t.endzeit ? `–${t.endzeit}` : ''}</span>}
          {t.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {t.ort}</span>}
        </div>
      </div>
      {kannBearbeiten && (
        <button onClick={() => onEdit(t)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 text-xs">
          ✏️
        </button>
      )}
    </div>
  );
}