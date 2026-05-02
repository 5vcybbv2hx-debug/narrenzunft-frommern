import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Edit, Save, X, Phone, Mail, MapPin, Calendar,
  User, Shirt, Award, CreditCard, Trash2, AlertTriangle, Shield, Send, ChevronRight, Plus, Search, MessageCircle
} from 'lucide-react';
import { format, differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import { isAdmin, kannBankdatenSehn, ROLLEN_LABELS, istNurMitglied, kannMitgliedProfilSehn } from '@/lib/roles';
import EhrungsStatus from '@/components/mitglied/EhrungsStatus';
import AdresseAutocomplete from '@/components/AdresseAutocomplete';
import AktivitaetTab from '@/components/mitglied/AktivitaetTab';
import ArbeitsdiensteMitgliedTab from '@/components/mitglied/ArbeitsdiensteMitgliedTab';
import FamilieTab from '@/components/mitglied/FamilieTab';

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
  const [accessDenied, setAccessDenied] = useState(false);
  const [haes, setHaes] = useState([]);
  const [ehrungen, setEhrungen] = useState([]);
  const [linkedUser, setLinkedUser] = useState(null);
  const [haesgruppen, setHaesgruppen] = useState([]);
  const [roleSaving, setRoleSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [activeTab, setActiveTab] = useState('profil');
  const [showHaesModal, setShowHaesModal] = useState(false);
  const [allHaes, setAllHaes] = useState([]);
  const [haessuche, setHaessuche] = useState('');
  const [assigningHaes, setAssigningHaes] = useState(false);

  useEffect(() => {
    if (!isNew) loadMitglied();
    base44.entities.Haesgruppe.list('name', 50).then(setHaesgruppen).catch(() => {});
    base44.entities.Haes.list('haesnummer', 500).then(setAllHaes).catch(() => {});
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
        // Zugriffsschutz: Mitglied darf nur eigenes Profil sehen
        if (istNurMitglied(user)) {
          const me = await base44.auth.me();
          const myM = await base44.entities.Mitglied.filter({ user_id: me?.id });
          if (!kannMitgliedProfilSehn(user, myM[0], m[0])) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
        }
        setMitglied(m[0]);
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
      // inviteUser akzeptiert nur "user" oder "admin" – Feinrolle wird via app_rolle gesetzt
      const baseRolle = ['vorstand', 'stellv_vorstand'].includes(mitglied.app_rolle) ? 'admin' : 'user';
      await base44.users.inviteUser(mitglied.email, baseRolle);
      const today = new Date().toISOString().split('T')[0];
      await base44.entities.Mitglied.update(mitglied.id, { einladung_gesendet_am: today });
      setMitglied(p => ({ ...p, einladung_gesendet_am: today }));
      setInviteSent(true);
    } catch (e) {}
    setInviting(false);
  };

  const handleAppRolleChange = async (newRole) => {
    // Immer auf dem Mitglied-Datensatz speichern
    setMitglied(p => ({ ...p, app_rolle: newRole }));
    await base44.entities.Mitglied.update(mitglied.id, { app_rolle: newRole });
    // Falls bereits ein User verknüpft: auch dort direkt setzen
    if (linkedUser) {
      setRoleSaving(true);
      try {
        await base44.entities.User.update(linkedUser.id, { role: newRole });
        setLinkedUser(prev => ({ ...prev, role: newRole }));
      } catch (e) {}
      setRoleSaving(false);
    }
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

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">Du hast keine Berechtigung, dieses Mitgliederprofil zu öffnen.</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 rounded-lg bg-secondary text-sm text-foreground hover:bg-border transition-colors">
          Zurück
        </button>
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
            { id: 'familie', label: 'Familie' },
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

      {/* Tab: Familie */}
      {activeTab === 'familie' && !isNew && (
        <FamilieTab
          mitglied={mitglied}
          isAdmin={admin}
          onFamilieChanged={(familieId) => setMitglied(p => ({ ...p, familie_id: familieId }))}
        />
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
          <Field label="Mitgliedsstatus" field="mitgliedsstatus" options={getVerfuegbareStatus(mitglied.geburtsdatum)} editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          {editing && (
            <>
              <Field label="E-Mail" field="email" type="email" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
              <Field label="Telefon" field="telefon" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            </>
          )}
          <Field label="Eintrittsdatum" field="eintrittsdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Austrittsdatum" field="austrittsdatum" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <Field label="Hochzeitstag" field="hochzeitstag" type="date" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">Umzüge vor Digitalisierung</label>
            {editing ? (
              <input
                type="number"
                min="0"
                value={mitglied.umzuege_vor_digitalisierung || 0}
                onChange={e => handleFieldChange('umzuege_vor_digitalisierung', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              />
            ) : (
              <p className="text-sm text-foreground py-1">{mitglied.umzuege_vor_digitalisierung || 0} Umzüge (historisch)</p>
            )}
            {editing && <p className="text-xs text-muted-foreground mt-1">Anzahl Erwachsenen-Umzüge vor Einführung dieser App</p>}
          </div>
        </div>
      </div>

      {/* Kontakt */}
      {!isNew && !editing && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Phone size={16} className="text-primary" /> Kontakt
          </h2>
          <div className="flex flex-col gap-2">
            {mitglied.email && (
              <a
                href={`mailto:${mitglied.email}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Mail size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">E-Mail</p>
                  <p className="text-sm font-medium text-foreground truncate">{mitglied.email}</p>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </a>
            )}
            {mitglied.telefon && (
              <>
                <a
                  href={`tel:${mitglied.telefon}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <Phone size={18} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="text-sm font-medium text-foreground truncate">{mitglied.telefon}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </a>
                {(() => {
                  const waLink = getWhatsAppLink(mitglied.telefon);
                  return waLink ? (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 hover:border-green-500/50 hover:bg-green-500/15 transition-all"
                    >
                      <MessageCircle size={18} className="text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-500">WhatsApp</p>
                        <p className="text-sm font-medium text-green-400">Direktnachricht</p>
                      </div>
                      <ChevronRight size={16} className="text-green-400 shrink-0" />
                    </a>
                  ) : null;
                })()}
              </>
            )}
            {!mitglied.email && !mitglied.telefon && (
              <p className="text-sm text-muted-foreground text-center py-4">Keine Kontaktdaten hinterlegt</p>
            )}
          </div>
        </div>
      )}

      {/* Adresse */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> Adresse
        </h2>
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Adresse suchen</label>
              <AdresseAutocomplete
                value=""
                onChange={(val, addr) => {
                  if (addr) {
                    const strasse = [addr.road, addr.house_number].filter(Boolean).join(' ');
                    handleFieldChange('strasse', strasse || mitglied.strasse);
                    handleFieldChange('plz', addr.postcode || mitglied.plz);
                    handleFieldChange('ort', addr.city || addr.town || addr.village || addr.municipality || mitglied.ort);
                  }
                }}
                placeholder="Adresse suchen und übernehmen..."
              />
              <p className="text-xs text-muted-foreground mt-1">Suche befüllt die Felder automatisch – oder manuell eingeben:</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="Straße & Hausnummer" field="strasse" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
              </div>
              <Field label="PLZ" field="plz" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
              <Field label="Ort" field="ort" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {mitglied.strasse && <p className="text-sm text-foreground">{mitglied.strasse}</p>}
            {(mitglied.plz || mitglied.ort) && <p className="text-sm text-foreground">{[mitglied.plz, mitglied.ort].filter(Boolean).join(' ')}</p>}
            {!mitglied.strasse && !mitglied.ort && <p className="text-sm text-muted-foreground">–</p>}
            {mitglied.strasse && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([mitglied.strasse, mitglied.plz, mitglied.ort].filter(Boolean).join(' '))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1"
              >
                <MapPin size={11} /> Navigation öffnen
              </a>
            )}
          </div>
        )}
      </div>

      {/* Notfallkontakt */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          🚨 Notfallkontakt
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" field="notfallkontakt_name" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
          <div>
            <Field label="Telefon" field="notfallkontakt_telefon" editing={editing} mitglied={mitglied} onChange={handleFieldChange} />
            {!editing && mitglied.notfallkontakt_telefon && (
              <a href={`tel:${mitglied.notfallkontakt_telefon}`} className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:text-primary/80 transition-colors">
                📞 Anrufen
              </a>
            )}
          </div>
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
      {!isNew && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Shirt size={16} className="text-primary" /> Häs ({haes.length})
            </h2>
            {admin && (
              <button
                onClick={() => setShowHaesModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus size={13} /> Zuweisen
              </button>
            )}
          </div>
          {haes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch kein Häs zugewiesen</p>
          ) : (
            haes.map(h => (
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
            ))
          )}
        </div>
      )}

      {/* App-Zugang & Rolle */}
      {admin && !isNew && (
        <div className="bg-card border border-border rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <Shield size={16} className="text-primary" /> App-Zugang & Rolle
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Rolle jetzt festlegen – wird beim ersten Login automatisch übernommen.
          </p>

          {/* Verknüpfter User (falls vorhanden) */}
          {linkedUser && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 mb-4">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {linkedUser.full_name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{linkedUser.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{linkedUser.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium shrink-0">Aktiv</span>
            </div>
          )}

          {/* Rollen-Kacheln – immer sichtbar */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { value: 'mitglied', label: 'Mitglied', desc: 'Grundzugang', icon: '👤' },
              { value: 'elternkonto', label: 'Elternkonto', desc: 'Für Erziehungsberechtigte', icon: '👨‍👩‍👧' },
              { value: 'spartenleiter', label: 'Spartenleiter', desc: 'Dienste & Check-In', icon: '📋' },
              { value: 'kassierer', label: 'Kassierer', desc: 'Finanzen & Beiträge', icon: '💰' },
              { value: 'stellv_vorstand', label: 'Stv. Vorstand', desc: 'Vollzugriff (ohne Admin)', icon: '🎭' },
              { value: 'vorstand', label: 'Vorstand', desc: 'Vollzugriff', icon: '👑' },
            ].map(rolle => {
              const currentRole = linkedUser ? (linkedUser.role || 'mitglied') : (mitglied.app_rolle || 'mitglied');
              const isSelected = currentRole === rolle.value;
              return (
                <button
                  key={rolle.value}
                  onClick={() => handleAppRolleChange(rolle.value)}
                  disabled={roleSaving}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-50 ${
                    isSelected
                      ? 'bg-primary/15 border-primary'
                      : 'bg-secondary/40 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span className="text-base shrink-0">{rolle.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-primary' : ''}`}>{rolle.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{rolle.desc}</p>
                  </div>
                  {isSelected && <div className="ml-auto w-2 h-2 rounded-full bg-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          {/* Häsgruppe für Spartenleiter */}
          {(mitglied.app_rolle === 'spartenleiter' || linkedUser?.role === 'spartenleiter') && (
            <div className="mb-3">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Zuständige Häsgruppe</label>
              <select
                value={mitglied.spartenleiter_haesgruppe_id || ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  handleFieldChange('spartenleiter_haesgruppe_id', val);
                  await base44.entities.Mitglied.update(mitglied.id, { spartenleiter_haesgruppe_id: val });
                }}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">– keine Gruppe zugeordnet –</option>
                {haesgruppen.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {roleSaving && (
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
              <div className="w-3 h-3 border-2 border-border border-t-primary rounded-full animate-spin" />
              Wird gespeichert...
            </div>
          )}

          {/* Einladung – nur wenn noch kein User verknüpft */}
          {!linkedUser && (
            <div className="border-t border-border pt-3 space-y-2">
              {mitglied.einladung_gesendet_am && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-yellow-400 text-xs">📧</span>
                  <p className="text-xs text-yellow-400">
                    Einladung gesendet am {format(new Date(mitglied.einladung_gesendet_am), 'dd.MM.yyyy', { locale: de })} – noch nicht angemeldet
                  </p>
                </div>
              )}
              {mitglied.email ? (
                <button
                  onClick={handleInvite}
                  disabled={inviting || inviteSent}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 w-full justify-center"
                >
                  <Send size={14} />
                  {inviteSent ? '✓ Einladung gesendet!' : inviting ? 'Sende...' : mitglied.einladung_gesendet_am ? 'Einladung erneut senden' : `Einladung senden an ${mitglied.email}`}
                </button>
              ) : (
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

      {/* Häs Zuweisungs-Modal */}
      {showHaesModal && !isNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Häs zuweisen</h3>
              <button onClick={() => { setShowHaesModal(false); setHaessuche(''); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Häs-Nummer oder Bezeichnung..."
                  value={haessuche}
                  onChange={e => setHaessuche(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allHaes
                  .filter(h =>
                    !haes.some(m => m.id === h.id) &&
                    (haessuche === '' ||
                      h.haesnummer.toLowerCase().includes(haessuche.toLowerCase()) ||
                      (h.bezeichnung || '').toLowerCase().includes(haessuche.toLowerCase()))
                  )
                  .slice(0, 20)
                  .map(h => (
                    <button
                      key={h.id}
                      onClick={async () => {
                        setAssigningHaes(true);
                        try {
                          const heute = new Date().toISOString().split('T')[0];
                          await base44.entities.HaesHistorie.create({
                            haes_id: h.id,
                            mitglied_id: mitglied.id,
                            von_datum: heute,
                            aktiv: true,
                            notizen: '',
                          });
                          await base44.entities.Haes.update(h.id, {
                            aktueller_besitzer_id: mitglied.id,
                            status: 'Verliehen',
                          });
                          setShowHaesModal(false);
                          setHaessuche('');
                          loadMitglied();
                        } catch (e) {}
                        setAssigningHaes(false);
                      }}
                      disabled={assigningHaes}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary border border-border text-left transition-colors disabled:opacity-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {h.haesnummer[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">#{h.haesnummer}</p>
                        {h.bezeichnung && <p className="text-xs text-muted-foreground truncate">{h.bezeichnung}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{h.status}</span>
                    </button>
                  ))}
                {allHaes.filter(h =>
                  !haes.some(m => m.id === h.id) &&
                  (haessuche === '' ||
                    h.haesnummer.toLowerCase().includes(haessuche.toLowerCase()) ||
                    (h.bezeichnung || '').toLowerCase().includes(haessuche.toLowerCase()))
                ).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Keine verfügbaren Häs gefunden</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}