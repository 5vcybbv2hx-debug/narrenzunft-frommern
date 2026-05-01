import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Bus, Car, Clock, MapPin, Check, Plus, X, Edit, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { VeranstaltungsDetailsForm, VeranstaltungsDetailsView } from '@/components/veranstaltung/VeranstaltungsDetails';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const EMPTY_FORM = {
  titel: '', typ: 'Umzug', datum: '', uhrzeit: '', ort: '',
  beschreibung: '', anmeldeschluss: '', bus_erforderlich: false,
  anmeldung_aktiv: true, status: 'Geplant',
};

export default function Umzuege() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [umzuege, setUmzuege] = useState([]);
  const [meineAnmeldungen, setMeineAnmeldungen] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = neu, sonst Objekt
  const [form, setForm] = useState({ ...EMPTY_FORM, bus_rueckfahrtszeit: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Veranstaltung.list('datum', 500);
      const extern = data.filter(v => v.typ === 'Umzug' || v.typ === 'Abendveranstaltung');
      setUmzuege(extern.sort((a, b) => a.datum.localeCompare(b.datum)));

      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) {
        setMyMitglied(myM[0]);
        const anmeldungen = await base44.entities.Teilnahme.filter({ mitglied_id: myM[0].id });
        setMeineAnmeldungen(anmeldungen);
      }
    } catch (e) {}
    setLoading(false);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({
      titel: '', typ: 'Umzug', datum: '', uhrzeit: '', ort: '',
      beschreibung: '', anmeldeschluss: '', bus_erforderlich: false,
      anmeldung_aktiv: true, status: 'Geplant', bus_rueckfahrtszeit: ''
    });
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditItem(u);
    setForm({
      titel: u.titel || '', typ: u.typ || 'Umzug', datum: u.datum || '',
      uhrzeit: u.uhrzeit || '', ort: u.ort || '', beschreibung: u.beschreibung || '',
      anmeldeschluss: u.anmeldeschluss || '', bus_erforderlich: u.bus_erforderlich || false,
      anmeldung_aktiv: u.anmeldung_aktiv !== false, status: u.status || 'Geplant',
      bus_rueckfahrtszeit: u.bus_rueckfahrtszeit || ''
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      if (editItem) {
        await base44.entities.Veranstaltung.update(editItem.id, form);
      } else {
        await base44.entities.Veranstaltung.create(form);
      }
      setShowForm(false);
      await loadData();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Termin wirklich löschen?')) return;
    try {
      await base44.entities.Veranstaltung.delete(id);
      setUmzuege(prev => prev.filter(u => u.id !== id));
    } catch (e) {}
  };

  const getMeineAnmeldung = (veranstaltungId) =>
    meineAnmeldungen.find(a => a.veranstaltung_id === veranstaltungId);

  const handleAnmelden = async (veranstaltungId, bus = false) => {
    if (!myMitglied) return;
    try {
      const t = await base44.entities.Teilnahme.create({
        veranstaltung_id: veranstaltungId, mitglied_id: myMitglied.id, status: 'Angemeldet', bus
      });
      setMeineAnmeldungen(prev => [...prev, t]);
    } catch (e) {}
  };

  const handleAbsagen = async (teilnahme) => {
    try {
      await base44.entities.Teilnahme.update(teilnahme.id, { status: 'Abgesagt' });
      setMeineAnmeldungen(prev => prev.map(a => a.id === teilnahme.id ? { ...a, status: 'Abgesagt' } : a));
    } catch (e) {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const kommende = umzuege.filter(u => u.datum >= today);
  const vergangene = umzuege.filter(u => u.datum < today);

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auswärtige Termine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Umzüge & Abendveranstaltungen · {kommende.length} kommend</p>
        </div>
        {admin && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> <span className="hidden sm:inline">Neuer Termin</span>
          </button>
        )}
      </div>

      {/* Kommende */}
      {kommende.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kommende Termine</h2>
          <div className="space-y-3">
            {kommende.map(u => {
              const anmeldung = getMeineAnmeldung(u.id);
              const isAngemeldet = anmeldung && anmeldung.status !== 'Abgesagt';
              return (
                <div key={u.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] text-muted-foreground">{format(new Date(u.datum), 'MMM', { locale: de })}</span>
                        <span className="text-xl font-bold text-primary">{format(new Date(u.datum), 'd')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{u.titel}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${u.typ === 'Umzug' ? 'bg-primary/20 text-primary' : 'bg-purple-500/20 text-purple-400'}`}>
                            {u.typ}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {u.uhrzeit && <span className="flex items-center gap-1"><Clock size={11} /> {u.uhrzeit}</span>}
                          {u.ort && <span className="flex items-center gap-1"><MapPin size={11} /> {u.ort}</span>}
                        </div>
                        {isAngemeldet && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Angemeldet</span>
                            {anmeldung?.bus && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1"><Bus size={10} /> Bus</span>}
                          </div>
                        )}
                        {/* Detailinfos-Toggle */}
                        <button
                          onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                          className="flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          {expandedId === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {expandedId === u.id ? 'Infos einklappen' : 'Infos anzeigen'}
                        </button>
                      </div>
                      {admin && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailinfos ausgeklappt */}
                  {expandedId === u.id && (
                    <div className="px-4 pb-3">
                      <VeranstaltungsDetailsView data={u} />
                    </div>
                  )}

                  {myMitglied && u.anmeldung_aktiv && (
                    <div className="px-4 pb-4">
                      {!isAngemeldet ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleAnmelden(u.id, false)} className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:bg-border transition-colors flex items-center justify-center gap-2">
                            <Car size={14} /> Mit Auto
                          </button>
                          <button onClick={() => handleAnmelden(u.id, true)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                            <Bus size={14} /> Mit Bus
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-green-500/10 border border-green-500/20">
                            <Check size={14} className="text-green-400" />
                            <span className="text-sm text-green-400 font-medium">Angemeldet {anmeldung?.bus ? '· 🚌 Bus' : '· 🚗 Auto'}</span>
                          </div>
                          <button onClick={() => handleAbsagen(anmeldung)} className="w-full py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors">
                            Absagen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vergangene */}
      {vergangene.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vergangene Termine</h2>
          <div className="space-y-2">
            {vergangene.slice().reverse().slice(0, 10).map(u => (
              <div key={u.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 opacity-70">
                <div className="w-10 h-10 rounded-lg bg-secondary flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-muted-foreground">{format(new Date(u.datum), 'MMM', { locale: de })}</span>
                  <span className="text-sm font-bold text-muted-foreground">{format(new Date(u.datum), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.titel}</p>
                  {u.ort && <p className="text-xs text-muted-foreground truncate">{u.ort}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {getMeineAnmeldung(u.id)?.status === 'Anwesend' && <Check size={14} className="text-green-400" />}
                  {admin && (
                    <button onClick={() => handleDelete(u.id)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {umzuege.length === 0 && (
        <div className="text-center py-12">
          <Bus size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Keine auswärtigen Termine gefunden</p>
          {admin && <button onClick={openNew} className="mt-3 text-sm text-primary hover:underline">Ersten Termin erstellen</button>}
        </div>
      )}

      {/* Erstellen / Bearbeiten Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground text-lg">{editItem ? 'Termin bearbeiten' : 'Neuer auswärtiger Termin'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Titel *"
                value={form.titel}
                onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Typ</label>
                <div className="flex gap-2">
                  {[{ value: 'Umzug', emoji: '🎪' }, { value: 'Abendveranstaltung', emoji: '🎭' }].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, typ: t.value }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                        form.typ === t.value
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {t.emoji} {t.value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'Geplant', emoji: '📅' },
                    { value: 'Aktiv', emoji: '✅' },
                    { value: 'Abgeschlossen', emoji: '🏁' },
                    { value: 'Abgesagt', emoji: '❌' },
                  ].map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, status: s.value }))}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                        form.status === s.value
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {s.emoji} {s.value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
                  <input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Uhrzeit</label>
                  <input type="time" value={form.uhrzeit} onChange={e => setForm(p => ({ ...p, uhrzeit: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Bus-Rückfahrtszeit (vom Heimatpunkt zurück)</label>
                <input type="time" value={form.bus_rueckfahrtszeit} onChange={e => setForm(p => ({ ...p, bus_rueckfahrtszeit: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <input
                type="text"
                placeholder="Ort"
                value={form.ort}
                onChange={e => setForm(p => ({ ...p, ort: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
              <textarea
                placeholder="Beschreibung (optional)"
                value={form.beschreibung}
                onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
              />

              {/* Typ-spezifische Detailfelder */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
                  {form.typ === 'Umzug' ? '🎪 Umzugsinfos' : '🎭 Veranstaltungsinfos'}
                </p>
                <VeranstaltungsDetailsForm
                  data={form}
                  onChange={(field, val) => setForm(p => ({ ...p, [field]: val }))}
                  typ={form.typ}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Anmeldeschluss</label>
                <input type="date" value={form.anmeldeschluss} onChange={e => setForm(p => ({ ...p, anmeldeschluss: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input type="checkbox" checked={form.bus_erforderlich} onChange={e => setForm(p => ({ ...p, bus_erforderlich: e.target.checked }))} className="rounded" />
                  Bus erforderlich
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input type="checkbox" checked={form.anmeldung_aktiv} onChange={e => setForm(p => ({ ...p, anmeldung_aktiv: e.target.checked }))} className="rounded" />
                  Anmeldung aktiv
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.titel || !form.datum}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={14} /> {saving ? 'Speichern...' : editItem ? 'Aktualisieren' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}