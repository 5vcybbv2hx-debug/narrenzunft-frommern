import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Edit, Save, X, Phone, Mail, MapPin, Calendar,
  User, Shirt, Award, CreditCard, Trash2, AlertTriangle, Shield, Send, ChevronRight
} from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import { isAdmin, kannBankdatenSehn, ROLLEN_LABELS } from '@/lib/roles';
import EhrungsStatus from '@/components/mitglied/EhrungsStatus';
import AktivitaetTab from '@/components/mitglied/AktivitaetTab';
import ArbeitsdiensteMitgliedTab from '@/components/mitglied/ArbeitsdiensteMitgliedTab';

const ALLE_STATUS = ['Aktiv', 'Passiv', 'Passiv mit Häs', 'Leihäs', 'Jugendliche 11-14', 'Jungaktive 15-17', 'Kinder 4-10', 'Kleinkind 0-3', 'Ehrenmitglied'];

function getVerfuegbareStatus(geburtsdatum) {
  if (!geburtsdatum) return ALLE_STATUS;
  const alter = differenceInYears(new Date(), new Date(geburtsdatum));
  return ALLE_STATUS.filter(s => {
    if (s === 'Kleinkind 0-3') return alter <= 3;
    if (s === 'Kinder 4-10') return alter >= 4 && alter <= 10;
    if (s === 'Jugendliche 11-14') return alter >= 11 && alter <= 14;
    if (s === 'Jungaktive 15-17') return alter >= 15 && alter <= 17;
    return true; // Alle anderen immer verfügbar
  });
}

function Field({ label, value, field, type = 'text', options, editing, mitglied, onChange }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      {editing ? (
        options ? (
          <select
            value={mitglied[field] || ''}
            onChange={e => onChange(field, e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          >
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            value={mitglied[field] || ''}
            onChange={e => onChange(field, e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
          />
        )
      ) : (
        <p className="text-sm text-foreground py-1">{value || mitglied[field] || '–'}</p>
      )}
    </div>
  );
}

export default function MitgliedDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'neu';
  const admin = isAdmin(user);
  const kannBank = kannBankdatenSehn(user);

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
  const [linkedUser, setLinkedUser] = useState(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [activeTab, setActiveTab] = useState('profil');

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
      if (m[0]) {
        setMitglied(m[0]);
        // Verknüpften User laden, wenn vorhanden
        if (m[0].user_id) {
          const users = await base44.entities.User.list();
          const u = users.find(u => u.id === m[0].user_id);
          if (u) setLinkedUser(u);
        }
      }
      setHaes(h);
      setEhrungen(e);
    } catch (e) {}
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!mitglied.email) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(mitglied.email, 'mitglied');
      setInviteSent(true);
    } catch (e) {}
    setInviting(false);
  };

  const getWhatsAppLink = (telefon) => {
    if (!telefon) return null;
    // Nummer bereinigen: nur Ziffern, führende 0 → +49
    let nr = telefon.replace(/\s|-|\(|\)/g, '');
    if (nr.startsWith('0')) nr = '+49' + nr.slice(1);
    return `https://wa.me/${nr.replace('+', '')}`;
  };

  const handleRoleChange = async (newRole) => {
    if (!linkedUser) return;
    setRoleSaving(true);
    try {
      await base44.entities.User.update(linkedUser.id, { role: newRole });
      setLinkedUser(prev => ({ ...prev, role: newRole }));
    } catch (e) {}
    setRoleSaving(false);
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

  // Warnung wenn Status nicht zum Alter passt
  const statusAltersWarnung = (() => {
    if (!mitglied.geburtsdatum || !mitglied.mitgliedsstatus || alter === null) return null;
    const s = mitglied.mitgliedsstatus;
    if (s === 'Kleinkind 0-3' && alter > 3) return `Alter ${alter} passt nicht zu "Kleinkind 0–3"`;
    if (s === 'Kinder 4-10' && (alter < 4 || alter > 10)) return `Alter ${alter} passt nicht zu "Kinder 4–10"`;
    if (s === 'Jugendliche 11-14' && (alter < 11 || alter > 14)) return `Alter ${alter} passt nicht zu "Jugendliche 11–14"`;
    if (s === 'Jungaktive 15-17' && (alter < 15 || alter > 17)) return `Alter ${alter} passt nicht zu "Jungaktive 15–17"`;
    if (s === 'Aktiv' && alter < 18) return `Alter ${alter}: Mitglied ist noch nicht 18 Jahre alt`;
    return null;
  })();

  const handleFieldChange = (field, value) => setMitglied(p => ({ ...p, [field]: value }));

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
        {admin && !editing && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Edit size={14} /> Bearbeiten
            </button>
          </div>
        )}
        {admin && editing && (
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

      {/* Alters-Warnung */}
      {statusAltersWarnung && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">{statusAltersWarnung}</p>
        </div>
      )}

      {/* Avatar */}
      {!isNew && (
        <div className="flex items-center gap-4 mb-4 bg-card border border-border rounded-xl p-5">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white font-bold text-2xl overflow-hidden shrink-0">
            {mitglied.profilbild_url ? (
              <img src={mitglied.profilbild_url} alt="" className="w-full h-full object-cover" />
            ) : (
              `${mitglied.vorname?.[0] || ''}${mitglied.nachname?.[0] || ''}`
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-lg">{mitglied.vorname} {mitglied.nachname}</p>
            {alter !== null && <p className="text-sm text-muted-foreground">{alter} Jahre alt</p>}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {mitglied.mitgliedsstatus}
              </span>
              {mitglied.ort && <span className="text-xs text-muted-foreground">{mitglied.ort}</span>}
              {mitglied.eintrittsdatum && (
                <span className="text-xs text-muted-foreground">
                  seit {format(new Date(mitglied.eintrittsdatum), 'yyyy', { locale: de })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4">
          {[
            { id: 'profil', label: 'Profil' },
            { id: 'aktivitaet', label: 'Aktivität' },
            { id: 'arbeitsdienste', label: 'Arbeitsdienste' },
            { id: 'ehrungen', label: 'Ehrungen' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Aktivität */}
      {activeTab === 'aktivitaet' && !isNew && (
        <AktivitaetTab mitgliedId={mitglied.id} />
      )}

      {/* Tab: Arbeitsdienste */}
      {activeTab === 'arbeitsdienste' && !isNew && (
        <ArbeitsdiensteMitgliedTab mitgliedId={mitglied.id} />
      )}

      {/* Tab: Ehrungen */}
      {activeTab === 'ehrungen' && !isNew && (
        <EhrungsStatus mitglied={mitglied} />
      )}

      {/* Tab: Profil */}
      {(activeTab === 'profil' || isNew) && (
      <div>

      {/* Persönliche Daten */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <User size={16} className="text-primary" /> Persönliche Daten
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Vorname" field="vorname" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Nachname" field="nachname" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Geburtsdatum" field="geburtsdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="E-Mail" field="email" type="email" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <div>
            <Field label="Telefon" field="telefon" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            {!editing && mitglied.telefon && (() => {
              const waLink = getWhatsAppLink(mitglied.telefon);
              return waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp öffnen
                </a>
              ) : null;
            })()}
          </div>
          <Field label="Mitgliedsstatus" field="mitgliedsstatus" options={getVerfuegbareStatus(mitglied.geburtsdatum)} editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Eintrittsdatum" field="eintrittsdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Austrittsdatum" field="austrittsdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
        </div>
      </div>

      {/* Adresse */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Adresse
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Straße" field="strasse" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          </div>
          <Field label="PLZ" field="plz" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Ort" field="ort" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
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
      {kannBank && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard size={16} className="text-primary" /> Bankverbindung (SEPA)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Kontoinhaber" field="kontoinhaber" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            <Field label="Bank" field="bankname" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            <div className="sm:col-span-2">
              <Field label="IBAN" field="iban" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            </div>
            <Field label="Mandatnummer" field="sepa_mandatnummer" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            <Field label="Mandatdatum" field="sepa_mandatdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
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
            <Link key={h.id} to={`/haes/${h.id}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:opacity-75 transition-opacity">
              <div>
                <p className="text-sm font-medium text-foreground">Nr. {h.haesnummer}</p>
                <p className="text-xs text-muted-foreground">{h.bezeichnung}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{h.status}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* App-Zugang & Rolle */}
      {admin && !isNew && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield size={16} className="text-primary" /> App-Zugang & Rolle
          </h2>
          {linkedUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {linkedUser.full_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{linkedUser.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{linkedUser.email}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">App-Rolle</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={linkedUser.role || 'mitglied'}
                    onChange={e => handleRoleChange(e.target.value)}
                    disabled={roleSaving}
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="mitglied">Mitglied</option>
                    <option value="spartenleiter">Spartenleiter</option>
                    <option value="kassierer">Kassierer</option>
                    <option value="stellv_vorstand">Stv. Vorstand</option>
                    <option value="vorstand">Vorstand</option>
                  </select>
                  {roleSaving && <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Aktuelle Rolle: <span className="text-primary font-medium">{ROLLEN_LABELS[linkedUser.role] || linkedUser.role}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {mitglied.user_id ? 'Benutzer wird geladen...' : 'Kein App-Zugang verknüpft.'}
              </p>
              {mitglied.email && !mitglied.user_id && (
                <button
                  onClick={handleInvite}
                  disabled={inviting || inviteSent}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  <Send size={14} />
                  {inviteSent ? '✓ Einladung gesendet!' : inviting ? 'Sende...' : `Einladung senden an ${mitglied.email}`}
                </button>
              )}
              {!mitglied.email && (
                <p className="text-xs text-muted-foreground">Keine E-Mail-Adresse hinterlegt – Einladung nicht möglich.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Löschen */}
      {admin && !isNew && (
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors mt-2"
        >
          <Trash2 size={14} /> Mitglied löschen
        </button>
      )}

      </div>
      )}
    </div>
  );
}