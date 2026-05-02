import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Users, Plus, Search, Edit, Trash2, Mail, Phone, Globe, MapPin, ChevronRight, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function Vereine() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [vereine, setVereine] = useState([]);
  const [kontakte, setKontakte] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showKontaktForm, setShowKontaktForm] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [editKontakt, setEditKontakt] = useState(null);
  const [form, setForm] = useState({ name: '', stadt: '', website: '', notizen: '' });
  const [kontaktForm, setKontaktForm] = useState({ name: '', email: '', telefon: '', funktion: '', notizen: '' });
  const [saving, setSaving] = useState(false);
  const [expandedVerein, setExpandedVerein] = useState(null);

  useEffect(() => {
    loadVereine();
  }, []);

  const loadVereine = async () => {
    setLoading(true);
    try {
      const [v, k] = await Promise.all([
        base44.entities.ExternerVerein.list('name', 500),
        base44.entities.VereinKontakt.list('-created_date', 1000),
      ]);
      setVereine(v.sort((a, b) => a.name.localeCompare(b.name)));
      setKontakte(k);
    } catch (e) {}
    setLoading(false);
  };

  const getKontakteForVerein = (vereinId) => kontakte.filter(k => k.verein_id === vereinId);

  const filtered = vereine.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.stadt?.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', stadt: '', website: '', notizen: '' });
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
      // Auch alle Kontakte löschen
      const vereinKontakte = getKontakteForVerein(id);
      await Promise.all(vereinKontakte.map(k => base44.entities.VereinKontakt.delete(k.id)));
      setVereine(prev => prev.filter(v => v.id !== id));
      setKontakte(prev => prev.filter(k => k.verein_id !== id));
    } catch (e) {}
  };

  const handleSaveKontakt = async (vereinId) => {
    if (!kontaktForm.name) return;
    setSaving(true);
    try {
      if (editKontakt) {
        await base44.entities.VereinKontakt.update(editKontakt.id, kontaktForm);
        setKontakte(prev => prev.map(k => k.id === editKontakt.id ? { ...k, ...kontaktForm } : k));
      } else {
        const neu = await base44.entities.VereinKontakt.create({ ...kontaktForm, verein_id: vereinId });
        setKontakte(prev => [...prev, neu]);
      }
      setShowKontaktForm(null);
      setEditKontakt(null);
      setKontaktForm({ name: '', email: '', telefon: '', funktion: '', notizen: '' });
    } catch (e) {}
    setSaving(false);
  };

  const handleDeleteKontakt = async (id) => {
    if (!window.confirm('Kontakt löschen?')) return;
    try {
      await base44.entities.VereinKontakt.delete(id);
      setKontakte(prev => prev.filter(k => k.id !== id));
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
        {filtered.map(v => {
          const vereinKontakte = getKontakteForVerein(v.id);
          const isExpanded = expandedVerein === v.id;
          return (
            <div key={v.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-start justify-between hover:bg-secondary/30 cursor-pointer" onClick={() => setExpandedVerein(isExpanded ? null : v.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{v.name}</h3>
                    {v.stadt && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-1"><MapPin size={10} /> {v.stadt}</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{vereinKontakte.length}</span>
                  </div>
                  {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"><Globe size={13} /> Website</a>}
                  {v.notizen && <p className="text-xs text-muted-foreground mt-1">{v.notizen}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {admin && (
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <button className="p-1 text-muted-foreground">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
                  {vereinKontakte.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Kontaktpersonen eingetragen</p>
                  ) : (
                    vereinKontakte.map(k => (
                      <div key={k.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-foreground">{k.name}</p>
                            {k.funktion && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{k.funktion}</span>}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                            {k.email && <a href={`mailto:${k.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail size={11} /> {k.email}</a>}
                            {k.telefon && <a href={`tel:${k.telefon}`} className="text-primary hover:underline flex items-center gap-1"><Phone size={11} /> {k.telefon}</a>}
                          </div>
                          {k.notizen && <p className="text-xs text-muted-foreground mt-1">{k.notizen}</p>}
                        </div>
                        {admin && (
                          <div className="flex gap-1 shrink-0 ml-2">
                            <button onClick={() => { setEditKontakt(k); setKontaktForm(k); setShowKontaktForm(v.id); }} className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                              <Edit size={14} />
                            </button>
                            <button onClick={() => handleDeleteKontakt(k.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {admin && (
                    <button
                      onClick={() => { setEditKontakt(null); setKontaktForm({ name: '', email: '', telefon: '', funktion: '', notizen: '' }); setShowKontaktForm(v.id); }}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
                    >
                      <Plus size={14} /> Kontakt hinzufügen
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Vereine gefunden</p>
        </div>
      )}

      {/* Kontakt Modal */}
      {showKontaktForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">{editKontakt ? 'Kontakt bearbeiten' : 'Neue Kontaktperson'}</h3>
              <button onClick={() => { setShowKontaktForm(null); setEditKontakt(null); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name *"
                value={kontaktForm.name}
                onChange={e => setKontaktForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                placeholder="Funktion (z.B. Vorsitzender)"
                value={kontaktForm.funktion}
                onChange={e => setKontaktForm(p => ({ ...p, funktion: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={kontaktForm.email}
                onChange={e => setKontaktForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={kontaktForm.telefon}
                onChange={e => setKontaktForm(p => ({ ...p, telefon: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Notizen"
                value={kontaktForm.notizen}
                onChange={e => setKontaktForm(p => ({ ...p, notizen: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowKontaktForm(null); setEditKontakt(null); }} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">
                Abbrechen
              </button>
              <button
                onClick={() => handleSaveKontakt(showKontaktForm)}
                disabled={saving || !kontaktForm.name}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {saving ? '...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verein Form Modal */}
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