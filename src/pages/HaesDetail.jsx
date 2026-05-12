import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { ArrowLeft, Shirt, Plus, Trash2, UserCheck, UserX, Save, X, Search, Upload } from 'lucide-react';
import HaesHistorieImportModal from '@/components/haes/HaesHistorieImportModal';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS = {
  'Aktiv': 'bg-green-500/20 text-green-400',
  'Verliehen': 'bg-blue-500/20 text-blue-400',
  'Verkauft': 'bg-gray-500/20 text-gray-400',
  'Frei': 'bg-yellow-500/20 text-yellow-400',
  'Stillgelegt': 'bg-red-500/20 text-red-400',
};

export default function HaesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [haes, setHaes] = useState(null);
  const [gruppen, setGruppen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [historien, setHistorien] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showAddMitglied, setShowAddMitglied] = useState(false);
  const [newZuweisung, setNewZuweisung] = useState({ mitglied_id: '', von_datum: '', aktiv: true, notizen: '' });
  const [saving, setSaving] = useState(false);
  const [eigentuemerSuche, setEigentuemerSuche] = useState('');
  const [zuweisung_suche, setZuweisungSuche] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showHistorieImport, setShowHistorieImport] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, g, m, hist] = await Promise.all([
        base44.entities.Haes.filter({ id }),
        base44.entities.Haesgruppe.list('name', 100),
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.HaesHistorie.filter({ haes_id: id }),
      ]);
      if (h[0]) {
        setHaes(h[0]);
        setEditData(h[0]);
      }
      setGruppen(g);
      setMitglieder(m);
      setHistorien(hist.sort((a, b) => (b.von_datum || '').localeCompare(a.von_datum || '')));
    } catch (e) {}
    setLoading(false);
  };

  const getMitgliedName = (mitgliedId) => {
    const m = mitglieder.find(m => m.id === mitgliedId);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleSaveHaes = async () => {
    setSaving(true);
    try {
      await base44.entities.Haes.update(haes.id, editData);
      setHaes(editData);
      setEditing(false);
    } catch (e) {}
    setSaving(false);
  };

  const handleAddMitglied = async (alsoSetEigentuemer = false) => {
    if (!newZuweisung.mitglied_id) return;
    setSaving(true);
    try {
      await base44.functions.invoke('weiseHaesZuSicher', {
        haes_id: id,
        mitglied_id: newZuweisung.mitglied_id,
        aktion: newZuweisung.aktiv ? 'verliehen' : 'zurueckgegeben',
        datum: newZuweisung.von_datum || undefined,
        notiz: newZuweisung.notizen,
      });

      // Privateigentümer separat setzen wenn gewünscht
      if (alsoSetEigentuemer) {
        await base44.entities.Haes.update(id, { privat_eigentuemer_id: newZuweisung.mitglied_id });
      }

      setNewZuweisung({ mitglied_id: '', von_datum: '', aktiv: true, notizen: '' });
      setShowAddMitglied(false);
      setConfirmDialog(null);
      loadData();
    } catch (e) {
      console.error('Häs-Zuweisung fehlgeschlagen:', e);
      alert('Zuweisung fehlgeschlagen: ' + (e?.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const onSelectMitgliedZuweisung = (mitgliedId) => {
    setNewZuweisung(p => ({ ...p, mitglied_id: mitgliedId }));
    setZuweisungSuche('');
    // Automatik-Dialog: Falls Privateigentümer leer, fragen ob auch setzen
    if (!editData.privat_eigentuemer_id) {
      setConfirmDialog({
        type: 'zuweisung_eigentuemer',
        mitgliedId,
        mitgliedName: getMitgliedName(mitgliedId)
      });
    }
  };

  const onSelectEigentuemer = (mitgliedId) => {
    setEditData(p => ({ ...p, privat_eigentuemer_id: mitgliedId }));
    setEigentuemerSuche('');
    // Automatik-Dialog: Falls noch keine aktive Zuweisung, fragen ob anlegen
    if (historien.filter(h => h.aktiv).length === 0) {
      setConfirmDialog({
        type: 'eigentuemer_zuweisung',
        mitgliedId,
        mitgliedName: getMitgliedName(mitgliedId)
      });
    }
  };

  const handleToggleAktiv = async (historie) => {
    try {
      const neueAktion = historie.aktiv ? 'zurueckgegeben' : 'verliehen';
      await base44.functions.invoke('weiseHaesZuSicher', {
        haes_id: id,
        mitglied_id: neueAktion === 'verliehen' ? historie.mitglied_id : undefined,
        aktion: neueAktion,
      });
      loadData();
    } catch (e) {
      console.error('Status-Änderung fehlgeschlagen:', e);
      alert('Fehlgeschlagen: ' + (e?.response?.data?.error || e.message));
    }
  };

  const handleDeleteHistorie = async (historieId) => {
    if (!window.confirm('Zuweisung löschen?')) return;
    try {
      await base44.entities.HaesHistorie.delete(historieId);
      loadData();
    } catch (e) {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Häs wirklich löschen?')) return;
    try {
      await base44.entities.Haes.delete(haes.id);
      navigate('/haes');
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!haes) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Häs nicht gefunden</p>
    </div>
  );

  const aktiveZuweisungen = historien.filter(h => h.aktiv);
  const inaktiveZuweisungen = historien.filter(h => !h.aktiv);

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/haes')} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Häs #{haes.haesnummer}</h1>
          <p className="text-sm text-muted-foreground">{haes.bezeichnung || 'Keine Bezeichnung'}</p>
        </div>
        {admin && !editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="px-3 py-2 rounded-lg bg-secondary text-sm text-foreground hover:bg-border transition-colors">
              Bearbeiten
            </button>
            <button onClick={handleDelete} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="p-2 rounded-lg bg-secondary text-muted-foreground">
              <X size={18} />
            </button>
            <button onClick={handleSaveHaes} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              <Save size={14} /> {saving ? '...' : 'Speichern'}
            </button>
          </div>
        )}
      </div>

      {/* Häs Details */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Shirt size={22} className="text-primary" />
          </div>
          <div>
            <p className="font-mono font-bold text-primary text-lg">#{haes.haesnummer}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[haes.status]}`}>{haes.status}</span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Häsnummer</label>
              <input
                value={editData.haesnummer || ''}
                onChange={e => setEditData(p => ({ ...p, haesnummer: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Bezeichnung</label>
              <input
                value={editData.bezeichnung || ''}
                onChange={e => setEditData(p => ({ ...p, bezeichnung: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {['Aktiv', 'Verliehen', 'Frei', 'Verkauft', 'Stillgelegt'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditData(p => ({ ...p, status: s }))}
                    className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                      editData.status === s
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Häsgruppe</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setEditData(p => ({ ...p, haesgruppe_id: '' }))}
                  className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    !editData.haesgruppe_id
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  – Keine Gruppe
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {gruppen.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setEditData(p => ({ ...p, haesgruppe_id: g.id }))}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                        editData.haesgruppe_id === g.id
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editData.vereinseigentum || false}
                  onChange={e => setEditData(p => ({ ...p, vereinseigentum: e.target.checked, privat_eigentuemer_id: e.target.checked ? '' : p.privat_eigentuemer_id }))}
                  className="rounded"
                />
                <span className="text-sm text-foreground">Vereinseigentum</span>
              </label>
              {!editData.vereinseigentum && (
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Privateigentümer (Person)</label>
                  {editData.privat_eigentuemer_id ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {getMitgliedName(editData.privat_eigentuemer_id)[0]}
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1">{getMitgliedName(editData.privat_eigentuemer_id)}</span>
                      <button
                        onClick={() => { setEditData(p => ({ ...p, privat_eigentuemer_id: '' })); setEigentuemerSuche(''); }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Name eingeben..."
                        value={eigentuemerSuche}
                        onChange={e => setEigentuemerSuche(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                      />
                      {eigentuemerSuche.length >= 1 && (
                        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {mitglieder
                            .filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(eigentuemerSuche.toLowerCase()))
                            .slice(0, 8)
                            .map(m => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => onSelectEigentuemer(m.id)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                              >
                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                  {m.vorname?.[0]}{m.nachname?.[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                                  {m.mitgliedsstatus && <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>}
                                </div>
                              </button>
                            ))}
                          {mitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(eigentuemerSuche.toLowerCase())).length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
              <textarea
                value={editData.notizen || ''}
                onChange={e => setEditData(p => ({ ...p, notizen: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {haes.haesgruppe_id && (
              <p className="text-muted-foreground">Gruppe: <span className="text-foreground">{gruppen.find(g => g.id === haes.haesgruppe_id)?.name || '–'}</span></p>
            )}
            <p className="text-muted-foreground">
              Eigentümer:{' '}
              <span className={`font-medium ${haes.vereinseigentum ? 'text-primary' : 'text-foreground'}`}>
                {haes.vereinseigentum
                  ? '🏛 Verein'
                  : haes.privat_eigentuemer_id
                    ? `👤 ${getMitgliedName(haes.privat_eigentuemer_id)}`
                    : 'Privat (keine Person verknüpft)'}
              </span>
            </p>
            {haes.notizen && <p className="text-muted-foreground text-xs mt-2 whitespace-pre-wrap">{haes.notizen}</p>}
          </div>
        )}
      </div>

      {/* Mitglieder-Zuweisungen */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Mitglieder-Zuweisungen</h2>
          {admin && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistorieImport(true)}
                title="Historie aus Excel importieren"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:bg-border hover:text-foreground transition-colors"
              >
                <Upload size={13} /> Import
              </button>
              <button
                onClick={() => setShowAddMitglied(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={13} /> Mitglied zuweisen
              </button>
            </div>
          )}
        </div>

        {/* Aktive Zuweisungen */}
        {aktiveZuweisungen.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Aktiv</p>
            <div className="space-y-2">
              {aktiveZuweisungen.map(h => (
                <div key={h.id} className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-xl px-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {getMitgliedName(h.mitglied_id)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{getMitgliedName(h.mitglied_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      seit {h.von_datum ? format(new Date(h.von_datum), 'dd.MM.yyyy', { locale: de }) : '–'}
                    </p>
                    {h.notizen && <p className="text-xs text-muted-foreground mt-0.5">{h.notizen}</p>}
                  </div>
                  {admin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleAktiv(h)}
                        title="Auf passiv setzen"
                        className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                      >
                        <UserX size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteHistorie(h.id)}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inaktive / historische Zuweisungen */}
        {inaktiveZuweisungen.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historisch / Passiv</p>
            <div className="space-y-2">
              {inaktiveZuweisungen.map(h => (
                <div key={h.id} className="flex items-center gap-3 bg-secondary/30 border border-border rounded-xl px-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground font-bold text-xs shrink-0">
                    {getMitgliedName(h.mitglied_id)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{getMitgliedName(h.mitglied_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.von_datum ? format(new Date(h.von_datum), 'dd.MM.yyyy', { locale: de }) : '?'}
                      {h.bis_datum ? ` – ${format(new Date(h.bis_datum), 'dd.MM.yyyy', { locale: de })}` : ''}
                    </p>
                  </div>
                  {admin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleAktiv(h)}
                        title="Wieder aktivieren"
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        <UserCheck size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteHistorie(h.id)}
                        className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {historien.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Noch kein Mitglied zugewiesen</p>
        )}
      </div>

      {/* Modal: Mitglied zuweisen */}
      {showAddMitglied && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-foreground mb-4">Mitglied zuweisen</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Mitglied *</label>
                {newZuweisung.mitglied_id ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {getMitgliedName(newZuweisung.mitglied_id)[0]}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">{getMitgliedName(newZuweisung.mitglied_id)}</span>
                    <button
                      type="button"
                      onClick={() => { setNewZuweisung(p => ({ ...p, mitglied_id: '' })); setZuweisungSuche(''); }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Name eingeben..."
                      value={zuweisung_suche}
                      onChange={e => setZuweisungSuche(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    {zuweisung_suche.length >= 1 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {mitglieder
                          .filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(zuweisung_suche.toLowerCase()))
                          .slice(0, 8)
                          .map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => onSelectMitgliedZuweisung(m.id)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                            >
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {m.vorname?.[0]}{m.nachname?.[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                                {m.mitgliedsstatus && <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>}
                              </div>
                            </button>
                          ))}
                        {mitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(zuweisung_suche.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Von Datum</label>
                <input
                  type="date"
                  value={newZuweisung.von_datum}
                  onChange={e => setNewZuweisung(p => ({ ...p, von_datum: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewZuweisung(p => ({ ...p, aktiv: true }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${newZuweisung.aktiv ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-secondary text-muted-foreground'}`}
                  >
                    ✓ Aktiv
                  </button>
                  <button
                    onClick={() => setNewZuweisung(p => ({ ...p, aktiv: false }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!newZuweisung.aktiv ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-secondary text-muted-foreground'}`}
                  >
                    Passiv
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Notizen</label>
                <input
                  type="text"
                  placeholder="z.B. Leihbasis, Saison 2024..."
                  value={newZuweisung.notizen}
                  onChange={e => setNewZuweisung(p => ({ ...p, notizen: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddMitglied(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button onClick={() => handleAddMitglied()} disabled={saving || !newZuweisung.mitglied_id} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                {saving ? 'Speichern...' : 'Zuweisen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      {confirmDialog?.type === 'zuweisung_eigentuemer' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-foreground mb-2">Privateigentümer auch setzen?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmDialog.mitgliedName} wird als Mitglied zugewiesen. Auch als Privateigentümer des Häs eintragen?
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => { handleAddMitglied(false); }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium disabled:opacity-50"
              >
                Nur zuweisen
              </button>
              <button 
                onClick={() => { handleAddMitglied(true); }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Beides setzen
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistorieImport && (
        <HaesHistorieImportModal
          onClose={() => setShowHistorieImport(false)}
          onImported={() => loadData()}
        />
      )}

      {confirmDialog?.type === 'eigentuemer_zuweisung' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-foreground mb-2">Neue Zuweisung anlegen?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {confirmDialog.mitgliedName} ist als Privateigentümer eingetragen. Auch eine neue aktive Zuweisung für diese Person anlegen?
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium"
              >
                Nur Eigentümer
              </button>
              <button 
                onClick={async () => {
                  setSaving(true);
                  try {
                    await base44.functions.invoke('weiseHaesZuSicher', {
                      haes_id: id,
                      mitglied_id: confirmDialog.mitgliedId,
                      aktion: 'verliehen',
                    });
                    setConfirmDialog(null);
                    loadData();
                  } catch (e) {
                    console.error('Zuweisung fehlgeschlagen:', e);
                  }
                  setSaving(false);
                }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                Zuweisung anlegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}