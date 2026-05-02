import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Users, Plus, Search, Edit, Trash2, Mail, Phone, Globe, MapPin, ChevronRight, X } from 'lucide-react';

export default function Vereine() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [vereine, setVereine] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', stadt: '', telefon: '', email: '', kontaktperson: '', website: '', notizen: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadVereine();
  }, []);

  const loadVereine = async () => {
    setLoading(true);
    try {
      const v = await base44.entities.ExternerVerein.list('name', 500);
      setVereine(v.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {}
    setLoading(false);
  };

  const filtered = vereine.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.stadt?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', stadt: '', telefon: '', email: '', kontaktperson: '', website: '', notizen: '' });
    setShowForm(true);
  };

  const openEdit = (v) => {
    setEditItem(v);
    setForm(v);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editItem) {
        await base44.entities.ExternerVerein.update(editItem.id, form);
      } else {
        await base44.entities.ExternerVerein.create(form);
      }
      setShowForm(false);
      loadVereine();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Verein wirklich löschen?')) return;
    try {
      await base44.entities.ExternerVerein.delete(id);
      setVereine(prev => prev.filter(v => v.id !== id));
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Externe Vereine & Zünfte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{vereine.length} Kontakte</p>
        </div>
        {admin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Verein hinzufügen
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Verein oder Stadt suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        {filtered.map(v => (
          <div key={v.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">{v.name}</h3>
                  {v.stadt && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {v.stadt}</span>}
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {v.kontaktperson && <span>👤 {v.kontaktperson}</span>}
                  {v.email && <a href={`mailto:${v.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={13} /> {v.email}</a>}
                  {v.telefon && <a href={`tel:${v.telefon}`} className="text-primary hover:underline flex items-center gap-1"><Phone size={13} /> {v.telefon}</a>}
                  {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><Globe size={13} /> Website</a>}
                </div>
                {v.notizen && <p className="text-xs text-muted-foreground mt-2">{v.notizen}</p>}
              </div>
              {admin && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(v)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Vereine gefunden</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editItem ? 'Verein bearbeiten' : 'Neuer Verein'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Vereinsname *"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Stadt/Ort"
                value={form.stadt}
                onChange={e => setForm(p => ({ ...p, stadt: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Kontaktperson"
                value={form.kontaktperson}
                onChange={e => setForm(p => ({ ...p, kontaktperson: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={form.telefon}
                onChange={e => setForm(p => ({ ...p, telefon: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="url"
                placeholder="Website"
                value={form.website}
                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Notizen"
                value={form.notizen}
                onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {saving ? '...' : editItem ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}