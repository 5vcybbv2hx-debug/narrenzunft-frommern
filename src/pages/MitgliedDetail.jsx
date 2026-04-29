import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Edit, Save, X, Phone, Mail, MapPin, Calendar,
  User, Shirt, Award, CreditCard, Trash2, Camera
} from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';

const MITGLIEDSSTATUS = ['Aktiv', 'Passiv', 'Passiv mit Häs', 'Leihäs', 'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3', 'Ehrenmitglied'];

export default function MitgliedDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'neu';
  const isAdmin = user?.role === 'admin';

  const [mitglied, setMitglied] = useState({
    vorname: '', nachname: '', strasse: '', plz: '', ort: '',
    telefon: '', email: '', geburtsdatum: '', eintrittsdatum: '',
    austrittsdatum: '', mitgliedsstatus: 'Aktiv', notizen: '',
    iban: '', kontoinhaber: '', sepa_mandatnummer: '', bankname: ''
  });
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [haes, setHaes] = useState([]);
  const [ehrungen, setEhrungen] = useState([]);

  useEffect(() => {
    if (!isNew) loadMitglied();
  }, [id]);

  const loadMitglied = async () => {
    setLoading(true);
    try {
      const [m, h, e] = await Promise.all([
        base44.entities.Mitglied.filter({ id }),
        base44.entities.Haes.filter({ aktueller_besitzer_id: id }),
        base44.entities.Ehrung.filter({ mitglied_id: id }),
      ]);
      if (m[0]) setMitglied(m[0]);
      setHaes(h);
      setEhrungen(e);
    } catch (e) {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.Mitglied.create(mitglied);
        navigate('/mitglieder');
      } else {
        await base44.entities.Mitglied.update(mitglied.id, mitglied);
        setEditing(false);
      }
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Mitglied wirklich löschen?')) return;
    try {
      await base44.entities.Mitglied.delete(mitglied.id);
      navigate('/mitglieder');
    } catch (e) {}
  };

  const alter = mitglied.geburtsdatum ? differenceInYears(new Date(), new Date(mitglied.geburtsdatum)) : null;

  const Field = ({ label, value, field, type = 'text', options }) => (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      {editing ? (
        options ? (
          <select
            value={mitglied[field] || ''}
            onChange={e => setMitglied(p => ({ ...p, [field]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={mitglied[field] || ''}
            onChange={e => setMitglied(p => ({ ...p, [field]: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
        )
      ) : (
        <p className="text-sm text-foreground py-1">{value || mitglied[field] || '–'}</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">
            {isNew ? 'Neues Mitglied' : `${mitglied.vorname} ${mitglied.nachname}`}
          </h1>
          {alter !== null && <p className="text-sm text-muted-foreground">{alter} Jahre alt</p>}
        </div>
        {isAdmin && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Edit size={14} /> Bearbeiten
            </button>
          </div>
        )}
        {editing && (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); if (isNew) navigate(-1); }}
              className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        )}
      </div>

      {/* Avatar */}
      {!isNew && (
        <div className="flex items-center gap-4 mb-6 bg-card border border-border rounded-xl p-5">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl overflow-hidden">
            {mitglied.profilbild_url ? (
              <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
            ) : (
              `${mitglied.vorname?.[0] || ''}${mitglied.nachname?.[0] || ''}`
            )}
          </div>
          <div>
            <p className="font-bold text-foreground text-lg">{mitglied.vorname} {mitglied.nachname}</p>
            <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium">
              {mitglied.mitgliedsstatus}
            </span>
          </div>
        </div>
      )}

      {/* Persönliche Daten */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <User size={16} className="text-primary" /> Persönliche Daten
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vorname" field="vorname" />
          <Field label="Nachname" field="nachname" />
          <Field label="Geburtsdatum" field="geburtsdatum" type="date" />
          <Field label="E-Mail" field="email" type="email" />
          <Field label="Telefon" field="telefon" />
          <Field label="Mitgliedsstatus" field="mitgliedsstatus" options={MITGLIEDSSTATUS} />
          <Field label="Eintrittsdatum" field="eintrittsdatum" type="date" />
          <Field label="Austrittsdatum" field="austrittsdatum" type="date" />
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Adresse
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Straße" field="strasse" />
          </div>
          <Field label="PLZ" field="plz" />
          <Field label="Ort" field="ort" />
        </div>
      </div>

      {/* Notizen */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4">Notizen</h2>
        {editing ? (
          <textarea
            value={mitglied.notizen || ''}
            onChange={e => setMitglied(p => ({ ...p, notizen: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap">{mitglied.notizen || 'Keine Notizen'}</p>
        )}
      </div>

      {/* Bankverbindung */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-primary" /> Bankverbindung (SEPA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Kontoinhaber" field="kontoinhaber" />
            <Field label="Bank" field="bankname" />
            <div className="sm:col-span-2">
              <Field label="IBAN" field="iban" />
            </div>
            <Field label="Mandatnummer" field="sepa_mandatnummer" />
            <Field label="Mandatdatum" field="sepa_mandatdatum" type="date" />
          </div>
        </div>
      )}

      {/* Häs */}
      {!isNew && haes.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shirt size={16} className="text-primary" /> Häs ({haes.length})
          </h2>
          {haes.map(h => (
            <div key={h.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">Nr. {h.haesnummer}</p>
                <p className="text-xs text-muted-foreground">{h.bezeichnung}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{h.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ehrungen */}
      {!isNew && ehrungen.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award size={16} className="text-primary" /> Ehrungen ({ehrungen.length})
          </h2>
          {ehrungen.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{e.typ} – {e.wert}</p>
                {e.datum && <p className="text-xs text-muted-foreground">{format(new Date(e.datum), 'dd.MM.yyyy')}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                e.status === 'Verliehen' ? 'bg-green-500/20 text-green-400' :
                e.status === 'Genehmigt' ? 'bg-blue-500/20 text-blue-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>{e.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Löschen */}
      {isAdmin && !isNew && (
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors mt-2"
        >
          <Trash2 size={14} /> Mitglied löschen
        </button>
      )}
    </div>
  );
}