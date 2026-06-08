import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Briefcase, Plus, Trash2, Users, Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'In Planung': 'bg-blue-500/20 text-blue-400',
  'Abgeschlossen': 'bg-green-500/20 text-green-400',
};

const EMPTY_DIENST = {
  titel: '',
  datum: '',
  uhrzeit: '',
  ort: '',
  beschreibung: '',
  benoetigte_personen: '',
  status: 'Offen',
};

export default function ArbeitsdienstTab({ veranstaltung, isAdmin }) {
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_DIENST);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (veranstaltung?.id) loadDienste();
  }, [veranstaltung?.id]);

  const loadDienste = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Arbeitsdienst.filter({ veranstaltung_id: veranstaltung.id });
      setDienste(data);
      if (data.length > 0) {
        const allZuweisungen = await Promise.all(
          data.map(d => base44.entities.ArbeitsdienstZuweisung.filter({ arbeitsdienst_id: d.id }))
        );
        setZuweisungen(allZuweisungen.flat());
      }
    } catch (e) {}
    setLoading(false);
  };

  const getZuweisungen = (dienstId) => zuweisungen.filter(z => z.arbeitsdienst_id === dienstId && z.status !== 'Abgesagt');

  const getBesetzungsStatus = (d) => {
    const count = getZuweisungen(d.id).length;
    const needed = d.benoetigte_personen;
    if (!needed) return null;
    if (count >= needed) return 'voll';
    if (count > 0) return 'teil';
    return 'leer';
  };

  const handleCreate = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      await base44.entities.Arbeitsdienst.create({
        ...form,
        veranstaltung_id: veranstaltung.id,
        benoetigte_personen: form.benoetigte_personen ? Number(form.benoetigte_personen) : undefined,
      });
      setForm(EMPTY_DIENST);
      setShowForm(false);
      await loadDienste();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Arbeitsdienst wirklich löschen?')) return;
    try {
      await base44.entities.Arbeitsdienst.delete(id);
      setDienste(prev => prev.filter(d => d.id !== id));
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{dienste.length} Arbeitsdienst(e) für diese Veranstaltung</p>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(true); setForm({ ...EMPTY_DIENST, datum: veranstaltung.datum || '' }); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Hinzufügen
          </button>
        )}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 mb-4 space-y-3">
          <h4 className="font-semibold text-foreground text-sm">Neuer Arbeitsdienst</h4>
          <input
            type="text"
            placeholder="Titel *"
            value={form.titel}
            onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={form.datum}
              onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="time"
              value={form.uhrzeit}
              onChange={e => setForm(p => ({ ...p, uhrzeit: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Ort"
              value={form.ort}
              onChange={e => setForm(p => ({ ...p, ort: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="number"
              placeholder="Benötigte Personen"
              value={form.benoetigte_personen}
              onChange={e => setForm(p => ({ ...p, benoetigte_personen: e.target.value }))}
              className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <textarea
            placeholder="Beschreibung (optional)"
            value={form.beschreibung}
            onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-sm font-medium border border-border"
            >
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.titel || !form.datum}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {dienste.map(d => {
          const count = getZuweisungen(d.id).length;
          const besetzung = getBesetzungsStatus(d);
          const pct = d.benoetigte_personen ? Math.min(100, Math.round((count / d.benoetigte_personen) * 100)) : null;
          return (
          <div key={d.id} className={`bg-card border rounded-xl p-4 ${besetzung === 'voll' ? 'border-green-500/30' : besetzung === 'leer' && d.benoetigte_personen ? 'border-orange-500/30' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground text-sm">{d.titel}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                  {besetzung === 'voll' && <CheckCircle size={13} className="text-green-400" />}
                  {besetzung === 'leer' && d.benoetigte_personen > 0 && <AlertCircle size={13} className="text-orange-400" />}
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                  {d.datum && <span className="flex items-center gap-1"><Clock size={10} /> {d.datum}{d.uhrzeit ? ` · ${d.uhrzeit}` : ''}</span>}
                  {d.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {d.ort}</span>}
                  <span className={`flex items-center gap-1 font-medium ${besetzung === 'voll' ? 'text-green-400' : besetzung === 'leer' && d.benoetigte_personen ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    <Users size={10} /> {count}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''}
                  </span>
                </div>
                {pct !== null && (
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                {d.beschreibung && <p className="text-xs text-muted-foreground mt-1">{d.beschreibung}</p>}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {dienste.length === 0 && !showForm && (
        <div className="text-center py-10">
          <Briefcase size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Arbeitsdienste für diese Veranstaltung</p>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(true); setForm({ ...EMPTY_DIENST, datum: veranstaltung.datum || '' }); }}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Ersten Arbeitsdienst erstellen
            </button>
          )}
        </div>
      )}
    </div>
  );
}