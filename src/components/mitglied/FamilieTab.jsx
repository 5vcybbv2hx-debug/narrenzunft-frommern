import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Plus, X, ChevronRight } from 'lucide-react';
import { differenceInYears } from 'date-fns';

export default function FamilieTab({ mitglied, isAdmin, onFamilieChanged }) {
  const [familien, setFamilien] = useState([]);
  const [familienmitglieder, setFamilienmitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNeuForm, setShowNeuForm] = useState(false);
  const [neueName, setNeueName] = useState('');

  useEffect(() => {
    loadData();
  }, [mitglied.familie_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const f = await base44.entities.Familie.list('name', 200);
      setFamilien(f);

      if (mitglied.familie_id) {
        const members = await base44.entities.Mitglied.filter({ familie_id: mitglied.familie_id });
        setFamilienmitglieder(members.filter(m => m.id !== mitglied.id));
      } else {
        setFamilienmitglieder([]);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleFamilieChange = async (familieId) => {
    setSaving(true);
    try {
      await base44.entities.Mitglied.update(mitglied.id, { familie_id: familieId || null });
      onFamilieChanged(familieId || null);
    } catch (e) {}
    setSaving(false);
  };

  const handleNeueFamilie = async () => {
    if (!neueName.trim()) return;
    setSaving(true);
    try {
      const neu = await base44.entities.Familie.create({ name: neueName.trim() });
      await base44.entities.Mitglied.update(mitglied.id, { familie_id: neu.id });
      onFamilieChanged(neu.id);
      setShowNeuForm(false);
      setNeueName('');
    } catch (e) {}
    setSaving(false);
  };

  const aktueleFamilie = familien.find(f => f.id === mitglied.familie_id);

  const getAlter = (geb) => {
    if (!geb) return null;
    return differenceInYears(new Date(), new Date(geb));
  };

  const STATUS_COLORS = {
    'Aktiv': 'text-green-400',
    'Passiv': 'text-yellow-400',
    'Kinder 4-10': 'text-pink-400',
    'Kleinkind 0-3': 'text-rose-400',
    'Jugendliche 11-14': 'text-blue-400',
    'Jungaktive 15-17': 'text-cyan-400',
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Familienzuweisung */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users size={16} className="text-primary" /> Familienzugehörigkeit
        </h2>

        {isAdmin ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Familie auswählen</label>
              <select
                value={mitglied.familie_id || ''}
                onChange={e => handleFamilieChange(e.target.value)}
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">– Keine Familie –</option>
                {familien.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            {/* Neue Familie anlegen */}
            {!showNeuForm ? (
              <button
                onClick={() => setShowNeuForm(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Plus size={13} /> Neue Familie anlegen
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="z.B. Familie Mustermann"
                  value={neueName}
                  onChange={e => setNeueName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleNeueFamilie()}
                  autoFocus
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleNeueFamilie}
                  disabled={saving || !neueName.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  {saving ? '...' : 'Erstellen'}
                </button>
                <button
                  onClick={() => { setShowNeuForm(false); setNeueName(''); }}
                  className="p-2 rounded-lg bg-secondary text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {aktueleFamilie && (
              <p className="text-xs text-muted-foreground">
                Zugewiesen zu: <span className="text-primary font-medium">{aktueleFamilie.name}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground">
            {aktueleFamilie ? aktueleFamilie.name : <span className="text-muted-foreground">Keine Familie zugewiesen</span>}
          </p>
        )}
      </div>

      {/* Familienmitglieder */}
      {mitglied.familie_id && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-4">
            Weitere Familienmitglieder
            {familienmitglieder.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">({familienmitglieder.length})</span>
            )}
          </h2>

          {familienmitglieder.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine weiteren Mitglieder in dieser Familie.</p>
          ) : (
            <div className="space-y-2">
              {familienmitglieder.map(m => {
                const alter = getAlter(m.geburtsdatum);
                return (
                  <Link
                    key={m.id}
                    to={`/mitglieder/${m.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                      {m.profilbild_url ? (
                        <img src={m.profilbild_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        `${m.vorname?.[0] || ''}${m.nachname?.[0] || ''}`
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {m.vorname} {m.nachname}
                        {alter !== null && <span className="ml-1.5 text-muted-foreground font-normal text-xs">{alter} J.</span>}
                      </p>
                      <p className={`text-xs ${STATUS_COLORS[m.mitgliedsstatus] || 'text-muted-foreground'}`}>
                        {m.mitgliedsstatus}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}