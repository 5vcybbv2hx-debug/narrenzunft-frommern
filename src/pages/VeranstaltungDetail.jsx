import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Edit, Save, X, Calendar, MapPin, Clock, Users,
  Bus, Check, XCircle, Search, Trash2, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPEN = ['Umzug', 'Abendveranstaltung', 'Intern', 'Arbeitsdienst'];
const STATUS_LIST = ['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgesagt'];

export default function VeranstaltungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'neu';
  const isAdmin = user?.role === 'admin';

  const [veranstaltung, setVeranstaltung] = useState({
    titel: '', typ: 'Umzug', datum: '', uhrzeit: '', ort: '',
    beschreibung: '', anmeldeschluss: '', max_teilnehmer: '',
    bus_erforderlich: false, anmeldung_aktiv: true, status: 'Geplant'
  });
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [meineTeilnahme, setMeineTeilnahme] = useState(null);
  const [searchMember, setSearchMember] = useState('');
  const [myMitglied, setMyMitglied] = useState(null);
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (!isNew) loadData();
    loadMitglieder();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, t] = await Promise.all([
        base44.entities.Veranstaltung.filter({ id }),
        base44.entities.Teilnahme.filter({ veranstaltung_id: id }),
      ]);
      if (v[0]) setVeranstaltung(v[0]);
      setTeilnahmen(t);

      // Find my Mitglied
      const me = await base44.auth.me();
      const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
      if (myM[0]) {
        setMyMitglied(myM[0]);
        const mine = t.find(t => t.mitglied_id === myM[0].id);
        setMeineTeilnahme(mine || null);
      }
    } catch (e) {}
    setLoading(false);
  };

  const loadMitglieder = async () => {
    try {
      const data = await base44.entities.Mitglied.list('nachname', 500);
      setMitglieder(data);
    } catch (e) {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.Veranstaltung.create(veranstaltung);
        navigate('/veranstaltungen');
      } else {
        await base44.entities.Veranstaltung.update(veranstaltung.id, veranstaltung);
        setEditing(false);
      }
    } catch (e) {}
    setSaving(false);
  };

  const handleAnmelden = async (bus = false) => {
    if (!myMitglied) return;
    try {
      const t = await base44.entities.Teilnahme.create({
        veranstaltung_id: id,
        mitglied_id: myMitglied.id,
        status: 'Angemeldet',
        bus
      });
      setMeineTeilnahme(t);
      loadData();
    } catch (e) {}
  };

  const handleAbsagen = async () => {
    if (!meineTeilnahme) return;
    try {
      await base44.entities.Teilnahme.update(meineTeilnahme.id, { status: 'Abgesagt' });
      loadData();
    } catch (e) {}
  };

  const toggleAnwesenheit = async (teilnahme) => {
    try {
      const newStatus = teilnahme.status === 'Anwesend' ? 'Bestätigt' : 'Anwesend';
      await base44.entities.Teilnahme.update(teilnahme.id, { status: newStatus });
      setTeilnahmen(prev => prev.map(t => t.id === teilnahme.id ? { ...t, status: newStatus } : t));
    } catch (e) {}
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const filteredTeilnahmen = teilnahmen.filter(t => {
    const name = getMitgliedName(t.mitglied_id).toLowerCase();
    return name.includes(searchMember.toLowerCase());
  });

  const Field = ({ label, field, type = 'text', options }) => (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      {editing ? (
        options ? (
          <select
            value={veranstaltung[field] || ''}
            onChange={e => setVeranstaltung(p => ({ ...p, [field]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={veranstaltung[field] || false}
              onChange={e => setVeranstaltung(p => ({ ...p, [field]: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-foreground">{label}</span>
          </label>
        ) : (
          <input
            type={type}
            value={veranstaltung[field] || ''}
            onChange={e => setVeranstaltung(p => ({ ...p, [field]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
        )
      ) : (
        <p className="text-sm text-foreground py-1">
          {type === 'checkbox' ? (veranstaltung[field] ? 'Ja' : 'Nein') : (veranstaltung[field] || '–')}
        </p>
      )}
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const angemeldete = teilnahmen.filter(t => ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status));
  const anwesende = teilnahmen.filter(t => t.status === 'Anwesend');

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{isNew ? 'Neue Veranstaltung' : veranstaltung.titel}</h1>
          {!isNew && veranstaltung.datum && (
            <p className="text-sm text-muted-foreground">
              {format(new Date(veranstaltung.datum), 'EEEE, d. MMMM yyyy', { locale: de })}
            </p>
          )}
        </div>
        {isAdmin && !editing && !isNew && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            <Edit size={14} /> Bearbeiten
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); if (isNew) navigate(-1); }} className="p-2 rounded-lg bg-secondary text-muted-foreground">
              <X size={18} />
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              <Save size={14} /> {saving ? '...' : 'Speichern'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
          {['info', 'teilnahmen', 'check-in'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'info' ? 'Info' : tab === 'teilnahmen' ? `Teilnahmen (${angemeldete.length})` : 'Check-In'}
            </button>
          ))}
        </div>
      )}

      {/* Info Tab */}
      {(activeTab === 'info' || isNew) && (
        <div className="space-y-4">
          {/* Meine Anmeldung */}
          {!isNew && myMitglied && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-foreground mb-3">Meine Anmeldung</h3>
              {meineTeilnahme ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-sm font-medium ${meineTeilnahme.status === 'Abgesagt' ? 'text-red-400' : 'text-green-400'}`}>
                      {meineTeilnahme.status}
                    </span>
                    {meineTeilnahme.bus && <span className="ml-2 text-xs text-blue-400">🚌 Bus</span>}
                  </div>
                  {meineTeilnahme.status !== 'Abgesagt' && (
                    <button onClick={handleAbsagen} className="text-sm text-destructive hover:text-destructive/80 transition-colors">
                      Absagen
                    </button>
                  )}
                </div>
              ) : veranstaltung.anmeldung_aktiv ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnmelden(false)}
                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Anmelden
                  </button>
                  {veranstaltung.bus_erforderlich && (
                    <button
                      onClick={() => handleAnmelden(true)}
                      className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Bus size={14} /> Mit Bus
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Anmeldung geschlossen</p>
              )}
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Titel" field="titel" />
              </div>
              <Field label="Typ" field="typ" options={TYPEN} />
              <Field label="Status" field="status" options={STATUS_LIST} />
              <Field label="Datum" field="datum" type="date" />
              <Field label="Uhrzeit" field="uhrzeit" type="time" />
              <Field label="Ort" field="ort" />
              <Field label="Anmeldeschluss" field="anmeldeschluss" type="date" />
              <Field label="Max. Teilnehmer" field="max_teilnehmer" type="number" />
              <div className="sm:col-span-2 flex gap-6">
                <Field label="Bus erforderlich" field="bus_erforderlich" type="checkbox" />
                <Field label="Anmeldung aktiv" field="anmeldung_aktiv" type="checkbox" />
              </div>
            </div>
          </div>

          {(editing || veranstaltung.beschreibung) && (
            <div className="bg-card border border-border rounded-xl p-5">
              <label className="text-xs text-muted-foreground font-medium block mb-2">Beschreibung</label>
              {editing ? (
                <textarea
                  value={veranstaltung.beschreibung || ''}
                  onChange={e => setVeranstaltung(p => ({ ...p, beschreibung: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">{veranstaltung.beschreibung}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Teilnahmen Tab */}
      {activeTab === 'teilnahmen' && !isNew && (
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Name suchen..."
              value={searchMember}
              onChange={e => setSearchMember(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            {filteredTeilnahmen.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                  {getMitgliedName(t.mitglied_id)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{getMitgliedName(t.mitglied_id)}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'Anwesend' ? 'bg-green-500/20 text-green-400' :
                      t.status === 'Abgesagt' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>{t.status}</span>
                    {t.bus && <span className="text-xs text-blue-400 flex items-center gap-0.5"><Bus size={10} /> Bus</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => toggleAnwesenheit(t)}
                    className={`p-2 rounded-lg transition-colors ${
                      t.status === 'Anwesend' ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-In Tab */}
      {activeTab === 'check-in' && !isNew && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-primary">{anwesende.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Anwesend</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-3xl font-bold text-foreground">{angemeldete.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Angemeldet</p>
            </div>
          </div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Name oder Häsnummer suchen..."
              value={searchMember}
              onChange={e => setSearchMember(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-2">
            {filteredTeilnahmen
              .filter(t => ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status))
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleAnwesenheit(t)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-4 border transition-all ${
                    t.status === 'Anwesend'
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    t.status === 'Anwesend' ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {t.status === 'Anwesend' ? <CheckCircle size={20} /> : getMitgliedName(t.mitglied_id)[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{getMitgliedName(t.mitglied_id)}</p>
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                  </div>
                  {t.bus && <Bus size={16} className="text-blue-400 shrink-0" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}