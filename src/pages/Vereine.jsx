import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Users, Plus, Search, Edit, Trash2, Mail, Phone, Globe, MapPin, ChevronDown, ChevronUp, X, AlertTriangle, Building2 } from 'lucide-react';

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
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'verein'|'kontakt', id, name }

  useEffect(() => {
    loadVereine();
  }, []);

  const loadVereine = async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, k] = await Promise.all([
        base44.entities.ExternerVerein.list('name', 300),
        base44.entities.VereinKontakt.list('-created_date', 500),
      ]);
      setVereine((v || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setKontakte(k || []);
    } catch (e) {
      console.error('Vereine laden:', e);
      setError('Vereine konnten nicht geladen werden.');
    }
    setLoading(false);
  };

  const getKontakteForVerein = (vereinId) => kontakte.filter(k => k.verein_id === vereinId);

  const filtered = vereine.filter(v =>
    (v.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.stadt || '').toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', stadt: '', website: '', notizen: '' });
    setShowForm(true);
  };

  const openEdit = (v) => {
    setEditItem(v);
    setForm({ name: v.name || '', stadt: v.stadt || '', website: v.website || '', notizen: v.notizen || '' });
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
    } catch (e) {
      console.error('Verein speichern:', e);
      setError('Verein konnte nicht gespeichert werden.');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    try {
      if (type === 'verein') {
        await base44.entities.ExternerVerein.delete(id);
        const vereinKontakte = getKontakteForVerein(id);
        await Promise.allSettled(vereinKontakte.map(k => base44.entities.VereinKontakt.delete(k.id)));
        setVereine(prev => prev.filter(v => v.id !== id));
        setKontakte(prev => prev.filter(k => k.verein_id !== id));
      } else {
        await base44.entities.VereinKontakt.delete(id);
        setKontakte(prev => prev.filter(k => k.id !== id));
      }
    } catch (e) {
      console.error('Löschen fehlgeschlagen:', e);
      setError('Löschen fehlgeschlagen.');
    }
    setDeleteTarget(null);
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
    } catch (e) {
      console.error('Kontakt speichern:', e);
      setError('Kontakt konnte nicht gespeichert werden.');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Vereine werden geladen…</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white">Externe Vereine & Zünfte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{vereine.length} {vereine.length === 1 ? 'Eintrag' : 'Einträge'} · {kontakte.length} Kontakte</p>
        </div>
        {admin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Plus size={16} /> Verein hinzufügen
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 ml-2"><X size={16} /></button>
        </div>
      )}

      {/* Suche */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Verein oder Stadt suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.map(v => {
          const vereinKontakte = getKontakteForVerein(v.id);
          const isExpanded = expandedVerein === v.id;
          return (
            <div key={v.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-start justify-between hover:bg-neutral-900/50 cursor-pointer transition-colors" onClick={() => setExpandedVerein(isExpanded ? null : v.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-white">{v.name}</h3>
                    {v.stadt && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-muted-foreground flex items-center gap-1">
                        <MapPin size={10} /> {v.stadt}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                      {vereinKontakte.length} {vereinKontakte.length === 1 ? 'Kontakt' : 'Kontakte'}
                    </span>
                  </div>
                  {v.website && (
                    <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline flex items-center gap-1 w-fit">
                      <Globe size={13} /> Website
                    </a>
                  )}
                  {v.notizen && <p className="text-xs text-muted-foreground mt-1">{v.notizen}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {admin && (
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(v); }} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'verein', id: v.id, name: v.name }); }} className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <button className="p-1 text-muted-foreground" onClick={e => e.stopPropagation()}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-3 bg-neutral-900/30">
                  {vereinKontakte.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Kontaktpersonen eingetragen</p>
                  ) : (
                    vereinKontakte.map(k => (
                      <div key={k.id} className="bg-card border border-border rounded-lg p-3 flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm text-white">{k.name}</p>
                            {k.funktion && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary">{k.funktion}</span>}
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
                            <button onClick={() => setDeleteTarget({ type: 'kontakt', id: k.id, name: k.name })} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-900/20 transition-colors">
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
                      className="text-xs text-primary hover:text-red-400 flex items-center gap-1 font-medium"
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

      {/* Leerer State */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Building2 size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-white font-medium">Keine Vereine gefunden</p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? `Für „${search}" wurde kein Verein gefunden` : 'Noch keine Vereine angelegt'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Suche zurücksetzen
            </button>
          )}
        </div>
      )}

      {/* Kontakt Modal */}
      {showKontaktForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{editKontakt ? 'Kontakt bearbeiten' : 'Neue Kontaktperson'}</h3>
              <button onClick={() => { setShowKontaktForm(null); setEditKontakt(null); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Name *"
                value={kontaktForm.name}
                onChange={e => setKontaktForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                placeholder="Funktion (z.B. Vorsitzender)"
                value={kontaktForm.funktion}
                onChange={e => setKontaktForm(p => ({ ...p, funktion: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={kontaktForm.email}
                onChange={e => setKontaktForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="tel"
                placeholder="Telefon"
                value={kontaktForm.telefon}
                onChange={e => setKontaktForm(p => ({ ...p, telefon: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <textarea
                placeholder="Notizen"
                value={kontaktForm.notizen}
                onChange={e => setKontaktForm(p => ({ ...p, notizen: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowKontaktForm(null); setEditKontakt(null); }} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm font-medium hover:text-white transition-colors">
                Abbrechen
              </button>
              <button
                onClick={() => handleSaveKontakt(showKontaktForm)}
                disabled={saving || !kontaktForm.name}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors"
              >
                {saving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verein Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{editItem ? 'Verein bearbeiten' : 'Neuer Verein'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Vereinsname *"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                placeholder="Stadt/Ort"
                value={form.stadt}
                onChange={e => setForm(p => ({ ...p, stadt: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="url"
                placeholder="Website"
                value={form.website}
                onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <textarea
                placeholder="Notizen"
                value={form.notizen}
                onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none transition-colors"
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm font-medium hover:text-white transition-colors">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors"
              >
                {saving ? '…' : editItem ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-oswald font-semibold text-white text-lg">
                {deleteTarget.type === 'verein' ? 'Verein löschen?' : 'Kontakt löschen?'}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Möchtest du <strong className="text-white">"{deleteTarget.name}"</strong> unwiderruflich löschen?
            </p>
            {deleteTarget.type === 'verein' && (
              <p className="text-xs text-muted-foreground mb-5">
                Alle zugehörigen Kontakte werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            )}
            {deleteTarget.type === 'kontakt' && (
              <p className="text-xs text-muted-foreground mb-5">
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm font-medium hover:text-white transition-colors">
                Abbrechen
              </button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-red-900/80 text-white text-sm font-semibold hover:bg-red-900 transition-colors">
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
