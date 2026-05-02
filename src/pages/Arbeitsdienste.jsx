import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, kannArbeitsdiensteVerwalten } from '@/lib/roles';
import { Briefcase, Plus, Calendar, MapPin, Users, Edit, X, Save, Trash2, Search, UserPlus, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'In Planung': 'bg-blue-500/20 text-blue-400',
  'Abgeschlossen': 'bg-green-500/20 text-green-400',
};

const ZUWEISUNG_COLORS = {
  'Offen':         'bg-secondary text-muted-foreground',
  'Bestätigt':     'bg-blue-500/20 text-blue-400',
  'Erledigt':      'bg-green-500/20 text-green-400',
  'Abgesagt':      'bg-red-500/20 text-red-400',
  'Nicht erledigt':'bg-orange-500/20 text-orange-400',
};

export default function Arbeitsdienste() {
  const { user } = useAuth();
  const [dienste, setDienste] = useState([]);
  const [zuweisungen, setZuweisungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Alle');
  const [editDienst, setEditDienst] = useState(null);
  const isAdminUser = isAdmin(user);
  const kannVerwalten = kannArbeitsdiensteVerwalten(user);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, z, m] = await Promise.all([
        base44.entities.Arbeitsdienst.list('datum', 200),
        base44.entities.ArbeitsdienstZuweisung.list('-created_date', 500),
        base44.entities.Mitglied.list('nachname', 500),
      ]);
      setDienste(d);
      setZuweisungen(z);
      setMitglieder(m);

      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) setMyMitglied(myM[0]);
    } catch (e) {}
    setLoading(false);
  };

  const getZuweisungen = (dienstId) => zuweisungen.filter(z => z.arbeitsdienst_id === dienstId);
  const meineZuweisung = (dienstId) => myMitglied ? zuweisungen.find(z => z.arbeitsdienst_id === dienstId && z.mitglied_id === myMitglied.id) : null;

  const handleStatusChange = async (zuweisung, newStatus) => {
    try {
      await base44.entities.ArbeitsdienstZuweisung.update(zuweisung.id, { status: newStatus });
      setZuweisungen(prev => prev.map(z => z.id === zuweisung.id ? { ...z, status: newStatus } : z));
    } catch (e) {}
  };

  const filtered = dienste
    .filter(d => {
      if (filter === 'Alle') return true;
      if (filter === 'Kommend') return d.datum >= today;
      if (filter === 'Vergangen') return d.datum < today;
      return d.status === filter;
    })
    .sort((a, b) => {
      const aKey = `${a.datum || ''}T${a.uhrzeit || '00:00'}`;
      const bKey = `${b.datum || ''}T${b.uhrzeit || '00:00'}`;
      return aKey.localeCompare(bKey);
    });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arbeitsdienste</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dienste.length} gesamt</p>
        </div>
        {kannVerwalten && (
          <Link
            to="/arbeitsdienste/neu"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Neuer Dienst</span>
          </Link>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {['Alle', 'Kommend', 'Vergangen', 'Offen', 'In Planung', 'Abgeschlossen'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(d => {
          const zuws = getZuweisungen(d.id);
          const meineZ = meineZuweisung(d.id);
          const bestaetigt = zuws.filter(z => ['Bestätigt', 'Erledigt'].includes(z.status)).length;

          return (
            <div key={d.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{d.titel}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> {format(new Date(d.datum), 'dd.MM.yyyy', { locale: de })}
                        {d.uhrzeit && ` – ${d.uhrzeit}`}
                      </span>
                      {d.ort && <span className="flex items-center gap-1"><MapPin size={11} /> {d.ort}</span>}
                      <span className="flex items-center gap-1">
                        <Users size={11} /> {zuws.filter(z => z.status !== 'Abgesagt').length}{d.benoetigte_personen ? `/${d.benoetigte_personen}` : ''} eingeteilt
                      </span>
                    </div>
                    {d.beschreibung && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{d.beschreibung}</p>
                    )}
                  </div>
                  {kannVerwalten && (
                    <button
                      onClick={() => setEditDienst(d)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Edit size={15} />
                    </button>
                  )}
                </div>

                {/* Meine Zuweisung */}
                {meineZ && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Meine Zuweisung:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange(meineZ, 'Bestätigt')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          meineZ.status === 'Bestätigt' || meineZ.status === 'Erledigt'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-400'
                        }`}
                      >
                        ✓ Bestätigen
                      </button>
                      <button
                        onClick={() => handleStatusChange(meineZ, 'Abgesagt')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          meineZ.status === 'Abgesagt'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-secondary text-muted-foreground hover:bg-red-500/10 hover:text-red-400'
                        }`}
                      >
                        ✗ Absagen
                      </button>
                    </div>
                  </div>
                )}

                {/* Zugewiesene Personen */}
                {zuws.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">Eingeteilt ({zuws.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {zuws.map(z => {
                        const m = mitglieder.find(m => m.id === z.mitglied_id);
                        return (
                          <span
                            key={z.id}
                            className={`text-xs px-2 py-0.5 rounded-full ${ZUWEISUNG_COLORS[z.status] || ZUWEISUNG_COLORS['Offen']}`}
                          >
                            {m ? `${m.vorname} ${m.nachname}` : '–'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Briefcase size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Arbeitsdienste gefunden</p>
        </div>
      )}

      {/* Edit Modal */}
      {editDienst && (
        <ArbeitsdienstEditModal
          dienst={editDienst}
          mitglieder={mitglieder}
          zuweisungen={zuweisungen.filter(z => z.arbeitsdienst_id === editDienst.id)}
          onClose={() => setEditDienst(null)}
          onSaved={() => { setEditDienst(null); loadData(); }}
        />
      )}
    </div>
  );
}

function ArbeitsdienstEditModal({ dienst, mitglieder, zuweisungen, onClose, onSaved }) {
  const [form, setForm] = useState({ ...dienst });
  const [saving, setSaving] = useState(false);
  const [suche, setSuche] = useState('');
  const [addingId, setAddingId] = useState(null);
  const [vorlagen, setVorlagen] = useState([]);
  const [selectedVorlage, setSelectedVorlage] = useState('');
  const [vorlageSaving, setVorlageSaving] = useState(false);
  const [vorlageSaved, setVorlageSaved] = useState(false);

  useEffect(() => {
    base44.entities.Veranstaltungsvorlage.list('name', 100).then(setVorlagen).catch(() => {});
  }, []);

  const handleUebertrageInVorlage = async () => {
    if (!selectedVorlage) return;
    setVorlageSaving(true);
    try {
      const vorlage = vorlagen.find(v => v.id === selectedVorlage);
      if (!vorlage) return;
      const vorhandene = vorlage.arbeitsdienst_vorlagen || [];
      // Existierenden Eintrag mit gleichem Titel ersetzen, sonst anhängen
      const idx = vorhandene.findIndex(a => a.titel?.toLowerCase() === form.titel?.toLowerCase());
      const neuerEintrag = { titel: form.titel, beschreibung: form.beschreibung || '', benoetigte_personen: form.benoetigte_personen || '' };
      const aktualisiert = idx >= 0
        ? vorhandene.map((a, i) => i === idx ? neuerEintrag : a)
        : [...vorhandene, neuerEintrag];
      await base44.entities.Veranstaltungsvorlage.update(selectedVorlage, { arbeitsdienst_vorlagen: aktualisiert });
      setVorlageSaved(true);
      setTimeout(() => setVorlageSaved(false), 2500);
    } catch (e) {}
    setVorlageSaving(false);
  };

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Arbeitsdienst.update(dienst.id, {
        titel: form.titel,
        datum: form.datum,
        uhrzeit: form.uhrzeit,
        ort: form.ort,
        beschreibung: form.beschreibung,
        benoetigte_personen: form.benoetigte_personen,
        status: form.status,
      });
      onSaved();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Arbeitsdienst wirklich löschen?')) return;
    await base44.entities.Arbeitsdienst.delete(dienst.id);
    onSaved();
  };

  const handleAddMitglied = async (mitgliedId) => {
    if (zuweisungen.find(z => z.mitglied_id === mitgliedId)) return;
    setAddingId(mitgliedId);
    try {
      await base44.entities.ArbeitsdienstZuweisung.create({
        arbeitsdienst_id: dienst.id,
        mitglied_id: mitgliedId,
        status: 'Offen',
      });
      onSaved();
    } catch (e) {}
    setAddingId(null);
    setSuche('');
  };

  const handleRemoveZuweisung = async (zuweisungId) => {
    await base44.entities.ArbeitsdienstZuweisung.delete(zuweisungId);
    onSaved();
  };

  const handleZuweisungStatus = async (z, newStatus) => {
    await base44.entities.ArbeitsdienstZuweisung.update(z.id, { status: newStatus });
    onSaved();
  };

  const zugewieseneIds = new Set(zuweisungen.map(z => z.mitglied_id));
  const suchErgebnisse = suche.length >= 1
    ? mitglieder
        .filter(m => !zugewieseneIds.has(m.id) && `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="font-bold text-foreground text-lg">Arbeitsdienst bearbeiten</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Stammdaten */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Titel</label>
              <input value={form.titel} onChange={e => set('titel', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Datum</label>
                <input type="date" value={form.datum || ''} onChange={e => set('datum', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Uhrzeit</label>
                <input type="time" value={form.uhrzeit || ''} onChange={e => set('uhrzeit', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
              <input value={form.ort || ''} onChange={e => set('ort', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Benötigte Personen</label>
                <input type="number" min="0" value={form.benoetigte_personen || ''} onChange={e => set('benoetigte_personen', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
                <select value={form.status || 'Offen'} onChange={e => set('status', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                  {['Offen', 'In Planung', 'Abgeschlossen'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
              <textarea value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)}
                rows={2} className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
            </div>
          </div>

          {/* In Veranstaltungsvorlage übertragen */}
          {vorlagen.length > 0 && (
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Bookmark size={15} className="text-primary" /> In Veranstaltungsvorlage übertragen
              </p>
              <p className="text-xs text-muted-foreground mb-2">Aktualisiert diesen Arbeitsdienst in der gewählten Vorlage (oder fügt ihn neu hinzu).</p>
              <div className="flex gap-2">
                <select
                  value={selectedVorlage}
                  onChange={e => setSelectedVorlage(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">Vorlage wählen...</option>
                  {vorlagen.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleUebertrageInVorlage}
                  disabled={!selectedVorlage || vorlageSaving}
                  className="px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  {vorlageSaved ? '✓ Gespeichert' : vorlageSaving ? '...' : 'Übertragen'}
                </button>
              </div>
            </div>
          )}

          {/* Mitglieder einteilen */}
          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <UserPlus size={15} className="text-primary" /> Mitglieder einteilen
            </p>

            {/* Aktuell eingeteilt */}
            {zuweisungen.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {zuweisungen.map(z => {
                  const m = mitglieder.find(m => m.id === z.mitglied_id);
                  return (
                    <div key={z.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                        {m?.vorname?.[0]}{m?.nachname?.[0]}
                      </div>
                      <span className="text-sm text-foreground flex-1">{m ? `${m.vorname} ${m.nachname}` : '–'}</span>
                      <select
                        value={z.status}
                        onChange={e => handleZuweisungStatus(z, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:border-primary"
                      >
                        {['Offen', 'Bestätigt', 'Erledigt', 'Abgesagt', 'Nicht erledigt'].map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => handleRemoveZuweisung(z.id)} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Suche */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Mitglied suchen und hinzufügen..."
                value={suche}
                onChange={e => setSuche(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              {suchErgebnisse.length > 0 && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  {suchErgebnisse.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleAddMitglied(m.id)}
                      disabled={addingId === m.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {m.vorname?.[0]}{m.nachname?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                        <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                      </div>
                      <Plus size={14} className="text-primary shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6">
          <button onClick={handleDelete} className="p-2.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
            <Trash2 size={16} />
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={14} /> {saving ? '...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}