import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Check, X, Euro, AlertCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'Erstattet': 'bg-green-500/20 text-green-400',
  'Storniert': 'bg-red-500/20 text-red-400',
};

const EMPTY_AUSLAGE = {
  mitglied_id: '',
  betrag: '',
  beschreibung: '',
  datum: new Date().toISOString().split('T')[0],
  status: 'Offen',
  notizen: '',
};

export default function AuslagenTab({ gruppeId, isAdmin }) {
  const [auslagen, setAuslagen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_AUSLAGE);
  const [saving, setSaving] = useState(false);
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [gruppeId]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOffen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([
        base44.entities.SpartenAuslage.filter({ haesgruppe_id: gruppeId }),
        base44.entities.Mitglied.list('nachname', 500),
      ]);
      setAuslagen(a.sort((x, y) => y.datum.localeCompare(x.datum)));
      setMitglieder(m);
    } catch (e) {}
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleCreate = async () => {
    if (!form.mitglied_id || !form.betrag) return;
    setSaving(true);
    try {
      await base44.entities.SpartenAuslage.create({
        ...form,
        haesgruppe_id: gruppeId,
        betrag: parseFloat(form.betrag),
      });
      setForm(EMPTY_AUSLAGE);
      setShowForm(false);
      await loadData();
    } catch (e) {}
    setSaving(false);
  };

  const handleStatusChange = async (auslage, newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'Erstattet') {
      updateData.erstattungsdatum = new Date().toISOString().split('T')[0];
    }
    await base44.entities.SpartenAuslage.update(auslage.id, updateData);
    setAuslagen(prev => prev.map(a => a.id === auslage.id ? { ...a, ...updateData } : a));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Auslage löschen?')) return;
    await base44.entities.SpartenAuslage.delete(id);
    setAuslagen(prev => prev.filter(a => a.id !== id));
  };

  const offene = auslagen.filter(a => a.status === 'Offen');
  const offenerBetrag = offene.reduce((sum, a) => sum + (a.betrag || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-5 h-5 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">{auslagen.length} Auslage(n)</p>
          {offenerBetrag > 0 && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-yellow-400 mt-1">
              <AlertCircle size={13} /> {offenerBetrag.toFixed(2)} € offen
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Auslage
          </button>
        )}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-secondary/50 border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div ref={containerRef} className="relative">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Wer hat ausgelegt? *</label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Name suchen..."
                  value={suche}
                  onChange={e => { setSuche(e.target.value); setOffen(true); }}
                  onFocus={() => setOffen(true)}
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {offen && suche.length >= 1 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                  {mitglieder
                    .filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()))
                    .slice(0, 8)
                    .map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setForm(p => ({ ...p, mitglied_id: m.id }));
                          setSuche(`${m.vorname} ${m.nachname}`);
                          setOffen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary border-b border-border last:border-0 transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                          {m.vorname?.[0]}{m.nachname?.[0]}
                        </div>
                        {m.vorname} {m.nachname}
                      </button>
                    ))}
                  {mitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase())).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Keine Ergebnisse</p>
                  )}
                </div>
              )}

              {form.mitglied_id && (
                <div className="flex items-center gap-2 px-3 py-1.5 mt-1.5 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
                    {mitglieder.find(m => m.id === form.mitglied_id)?.vorname?.[0]}{mitglieder.find(m => m.id === form.mitglied_id)?.nachname?.[0]}
                  </div>
                  <span className="text-xs text-foreground">{mitglieder.find(m => m.id === form.mitglied_id)?.vorname} {mitglieder.find(m => m.id === form.mitglied_id)?.nachname}</span>
                  <button onClick={() => { setForm(p => ({ ...p, mitglied_id: '' })); setSuche(''); }} className="ml-auto p-0.5 text-muted-foreground hover:text-destructive">
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Betrag € *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.betrag}
                onChange={e => setForm(p => ({ ...p, betrag: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Wofür? *</label>
            <input
              type="text"
              value={form.beschreibung}
              onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
              placeholder="z.B. Material, Getränke..."
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Datum</label>
              <input
                type="date"
                value={form.datum}
                onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
              <input
                type="text"
                value={form.notizen}
                onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-xs font-medium border border-border">
              Abbrechen
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.mitglied_id || !form.betrag}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
            >
              {saving ? '...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {auslagen.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Noch keine Auslagen</p>
        )}
        {auslagen.map(a => (
          <div key={a.id} className={`bg-card border rounded-lg p-3 transition-all ${a.status === 'Offen' ? 'border-yellow-500/20' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{getMitgliedName(a.mitglied_id)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.beschreibung}</p>
                {a.notizen && <p className="text-[10px] text-muted-foreground italic mt-1">{a.notizen}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-foreground flex items-center gap-1 justify-end">
                  <Euro size={12} /> {a.betrag.toFixed(2)}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block ${STATUS_COLORS[a.status]}`}>
                  {a.status}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{format(new Date(a.datum), 'dd.MM.yyyy', { locale: de })}</span>
              {a.status === 'Erstattet' && <span>Erstattet: {format(new Date(a.erstattungsdatum), 'dd.MM.yyyy', { locale: de })}</span>}
              {isAdmin && (
                <div className="flex gap-1">
                  {a.status === 'Offen' && (
                    <button
                      onClick={() => handleStatusChange(a, 'Erstattet')}
                      className="p-1 rounded text-green-400 hover:bg-green-500/10 transition-colors"
                      title="Als erstattet markieren"
                    >
                      <Check size={12} />
                    </button>
                  )}
                  {a.status !== 'Storniert' && (
                    <button
                      onClick={() => handleStatusChange(a, 'Storniert')}
                      className="p-1 rounded text-orange-400 hover:bg-orange-500/10 transition-colors"
                      title="Stornieren"
                    >
                      <X size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Löschen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}