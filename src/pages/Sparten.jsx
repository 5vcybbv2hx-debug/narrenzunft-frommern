import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Users, Plus, Edit, Trash2, X, Save, Search, ChevronDown, ChevronUp, UserMinus } from 'lucide-react';
import { Link } from 'react-router-dom';
import SparteFormModal from '@/components/sparten/SparteFormModal';
import Sparte from '@/components/sparten/Sparte';

export default function Sparten() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const isSpartenleiter = user?.role === 'spartenleiter';

  const [gruppen, setGruppen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [meinMitglied, setMeinMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGruppe, setEditGruppe] = useState(null);
  const [filterTyp, setFilterTyp] = useState('Alle');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const g = await base44.entities.Haesgruppe.list('name', 200);
    setGruppen(g);
    // Mitgliederliste nur für Admins und Spartenleiter laden
    if (admin || isSpartenleiter) {
      const me = await base44.auth.me();
      const [m, myMArr] = await Promise.all([
        base44.entities.Mitglied.list('nachname', 300),
        isSpartenleiter ? base44.entities.Mitglied.filter({ user_id: me?.id }) : Promise.resolve([]),
      ]);
      setMitglieder(m);
      if (myMArr[0]) setMeinMitglied(myMArr[0]);
    }
    setLoading(false);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditGruppe(null);
    loadData();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Gruppe wirklich löschen?')) return;
    await base44.entities.Haesgruppe.delete(id);
    setGruppen(prev => prev.filter(g => g.id !== id));
  };

  const TYPEN = ['Alle', 'Häsgruppe', 'Tanzgruppe', 'Sonstige'];

  const filtered = gruppen.filter(g =>
    filterTyp === 'Alle' || g.typ === filterTyp || (!g.typ && filterTyp === 'Häsgruppe')
  );

  const typCounts = {
    'Alle':       gruppen.length,
    'Häsgruppe':  gruppen.filter(g => !g.typ || g.typ === 'Häsgruppe').length,
    'Tanzgruppe': gruppen.filter(g => g.typ === 'Tanzgruppe').length,
    'Sonstige':   gruppen.filter(g => g.typ === 'Sonstige').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Gruppen werden geladen…</p>
      </div>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald font-semibold text-foreground tracking-wide">Sparten & Gruppen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{gruppen.length} Gruppen</p>
        </div>
        {admin && (
          <button
            onClick={() => { setEditGruppe(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Neue Gruppe
          </button>
        )}
      </div>

      {/* Typ-Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {TYPEN.map(t => (
          <button
            key={t}
            onClick={() => setFilterTyp(t)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterTyp === t ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'}`}
          >
            {t}
            <span className={`text-[10px] font-bold px-1 rounded-full ${filterTyp === t ? 'bg-white/20' : 'bg-secondary'}`}>
              {typCounts[t] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">Keine Gruppen gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            {filterTyp !== 'Alle' ? `Keine Gruppen vom Typ „${filterTyp}"` : 'Es wurden noch keine Gruppen angelegt'}
          </p>
          {filterTyp !== 'Alle' && (
            <button onClick={() => setFilterTyp('Alle')} className="mt-3 text-xs text-primary hover:underline">
              Filter zurücksetzen
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(gruppe => (
          <Sparte
            key={gruppe.id}
            gruppe={gruppe}
            alleMitglieder={mitglieder}
            isAdmin={admin}
            kannBearbeiten={isSpartenleiter && (
              (meinMitglied?.spartenleiter_haesgruppen_ids || []).includes(gruppe.id) ||
              meinMitglied?.spartenleiter_haesgruppe_id === gruppe.id
            )}
            onEdit={() => { setEditGruppe(gruppe); setShowForm(true); }}
            onDelete={() => handleDelete(gruppe.id)}
            onMitgliederChanged={loadData}
          />
        ))}
      </div>

      {showForm && (
        <SparteFormModal
          gruppe={editGruppe}
          onClose={() => { setShowForm(false); setEditGruppe(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}