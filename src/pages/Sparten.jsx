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

  const TYPEN = ['Alle', 'Häsgruppe', 'Tanzgruppe', 'Musikgruppe', 'Sonstige'];

  const filtered = gruppen.filter(g =>
    filterTyp === 'Alle' || g.typ === filterTyp || (!g.typ && filterTyp === 'Häsgruppe')
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sparten & Gruppen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{gruppen.length} Gruppen</p>
        </div>
        {admin && (
          <button
            onClick={() => { setEditGruppe(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Neue Gruppe
          </button>
        )}
      </div>

      {/* Typ-Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5">
        {TYPEN.map(t => (
          <button
            key={t}
            onClick={() => setFilterTyp(t)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterTyp === t ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Gruppen gefunden</p>
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