import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Plus, X, Save, Trash2 } from 'lucide-react';

const ROLLEN = ['Vorsitzender', 'Stellv. Vorsitzender', 'Schriftführer', 'Kassierer', 'Beisitzer', 'Jugendleiter', 'Sonstiges'];

const ROLLE_FARBEN = {
  'Vorsitzender':        'bg-primary/20 text-primary',
  'Stellv. Vorsitzender':'bg-blue-500/20 text-blue-400',
  'Schriftführer':       'bg-purple-500/20 text-purple-400',
  'Kassierer':           'bg-green-500/20 text-green-400',
  'Beisitzer':           'bg-gray-500/20 text-gray-400',
  'Jugendleiter':        'bg-orange-500/20 text-orange-400',
  'Sonstiges':           'bg-secondary text-muted-foreground',
};

export default function AusschussMitgliederTab({ mitglieder, isAdmin }) {
  const [ausschussMitglieder, setAusschussMitglieder] = useState([]);
  const [haesgruppen, setHaesgruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ mitglied_id: '', rolle: 'Beisitzer', notizen: '' });
  const [saving, setSaving] = useState(false);
  const [suche, setSuche] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [data, gruppen] = await Promise.all([
      base44.entities.AusschussMitglied.list('-created_date', 100),
      base44.entities.Haesgruppe.list('name', 50),
    ]);
    setAusschussMitglieder(data);
    setHaesgruppen(gruppen);
    setLoading(false);
  };

  const getGruppenName = (id) => haesgruppen.find(g => g.id === id)?.name || null;

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const bereitsImAusschuss = new Set(ausschussMitglieder.map(a => a.mitglied_id));

  const verfuegbareMitglieder = mitglieder.filter(m =>
    !bereitsImAusschuss.has(m.id) &&
    (suche.length === 0 || `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()))
  );

  const handleAdd = async () => {
    if (!form.mitglied_id) return;
    setSaving(true);
    const neu = await base44.entities.AusschussMitglied.create({ ...form, aktiv: true });
    setAusschussMitglieder(prev => [...prev, neu]);
    setForm({ mitglied_id: '', rolle: 'Beisitzer', notizen: '' });
    setSuche('');
    setShowForm(false);
    setSaving(false);
  };

  const handleRolleChange = async (amId, rolle) => {
    await base44.entities.AusschussMitglied.update(amId, { rolle });
    setAusschussMitglieder(prev => prev.map(a => a.id === amId ? { ...a, rolle } : a));
  };

  const handleRemove = async (amId) => {
    if (!window.confirm('Mitglied aus dem Ausschuss entfernen?')) return;
    await base44.entities.AusschussMitglied.delete(amId);
    setAusschussMitglieder(prev => prev.filter(a => a.id !== amId));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{ausschussMitglieder.length} Ausschussmitglieder</p>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Mitglied hinzufügen
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Mitglied suchen</label>
            <input
              type="text"
              placeholder="Name eingeben..."
              value={suche}
              onChange={e => { setSuche(e.target.value); setForm(p => ({ ...p, mitglied_id: '' })); }}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
            />
            {suche.length > 0 && verfuegbareMitglieder.length > 0 && (
              <div className="mt-1 bg-card border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {verfuegbareMitglieder.slice(0, 8).map(m => (
                  <button key={m.id} onClick={() => { setForm(p => ({ ...p, mitglied_id: m.id })); setSuche(`${m.vorname} ${m.nachname}`); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-b border-border last:border-0 ${form.mitglied_id === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                      {m.vorname?.[0]}{m.nachname?.[0]}
                    </div>
                    {m.vorname} {m.nachname}
                    <span className="text-xs text-muted-foreground ml-auto">{m.mitgliedsstatus}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Rolle</label>
            <div className="flex flex-wrap gap-1.5">
              {ROLLEN.map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, rolle: r }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${form.rolle === r ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowForm(false); setSuche(''); }}
              className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-sm border border-border">Abbrechen</button>
            <button onClick={handleAdd} disabled={saving || !form.mitglied_id}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
              {saving ? '...' : 'Hinzufügen'}
            </button>
          </div>
        </div>
      )}

      {ausschussMitglieder.length === 0 && !showForm && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Users size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Ausschussmitglieder</p>
        </div>
      )}

      {/* Spartenleiter */}
      {(() => {
        const spartenleiter = mitglieder.filter(m => m.app_rolle === 'spartenleiter');
        if (spartenleiter.length === 0) return null;
        return (
          <div className="mb-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Spartenleiter</p>
            <div className="space-y-2">
              {spartenleiter.map(m => (
                <div key={m.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-sm shrink-0">
                    {m.vorname?.[0]}{m.nachname?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{m.vorname} {m.nachname}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                      {m.spartenleiter_haesgruppe_id ? `Spartenleiter · ${getGruppenName(m.spartenleiter_haesgruppe_id) || '–'}` : 'Spartenleiter'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-4 mb-4" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ausschussmitglieder</p>
          </div>
        );
      })()}

      <div className="space-y-2">
        {ausschussMitglieder.map(am => (
          <div key={am.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {getMitgliedName(am.mitglied_id)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{getMitgliedName(am.mitglied_id)}</p>
              {isAdmin ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ROLLEN.map(r => (
                    <button key={r} onClick={() => handleRolleChange(am.id, r)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${am.rolle === r ? ROLLE_FARBEN[r] || 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground hover:bg-border'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${ROLLE_FARBEN[am.rolle] || ROLLE_FARBEN['Sonstiges']}`}>{am.rolle}</span>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => handleRemove(am.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}