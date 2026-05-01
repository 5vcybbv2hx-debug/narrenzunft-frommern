import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannCheckinDurchfuehren, isAdmin as checkAdmin } from '@/lib/roles';
import {
  ArrowLeft, Edit, Save, X, Calendar, MapPin, Clock, Users,
  Bus, Check, XCircle, Search, Trash2, CheckCircle, Send, Link, Copy, RefreshCw
} from 'lucide-react';
import ArbeitsdienstTab from '@/components/veranstaltung/ArbeitsdienstTab';
import AdresseAutocomplete from '@/components/AdresseAutocomplete';
import { VeranstaltungsDetailsForm, VeranstaltungsDetailsView } from '@/components/veranstaltung/VeranstaltungsDetails';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYPEN = ['Umzug', 'Abendveranstaltung', 'Intern', 'Arbeitsdienst', 'Fest'];
const STATUS_LIST = ['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgesagt'];

export default function VeranstaltungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === 'neu';
  const isAdmin = checkAdmin(user);
  const kannCheckin = kannCheckinDurchfuehren(user);

  const [veranstaltung, setVeranstaltung] = useState({
    titel: '', typ: 'Intern', datum: '', uhrzeit: '', ort: '',
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
  const [busFilter, setBusFilter] = useState('alle');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);

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

  /**
   * Check-In: Setzt Anwesenheit auf "Anwesend" (bestätigt) oder zurück.
   * Nur "Anwesend" zählt für Umzugsehrungen.
   */
  const toggleAnwesenheit = async (teilnahme) => {
    try {
      const newStatus = teilnahme.status === 'Anwesend' ? 'Angemeldet' : 'Anwesend';
      await base44.entities.Teilnahme.update(teilnahme.id, { status: newStatus });
      setTeilnahmen(prev => prev.map(t => t.id === teilnahme.id ? { ...t, status: newStatus } : t));
    } catch (e) {}
  };

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    try {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await base44.entities.Veranstaltung.update(veranstaltung.id, { busfahrer_token: token });
      setVeranstaltung(prev => ({ ...prev, busfahrer_token: token }));
    } catch (e) {}
    setGeneratingToken(false);
  };

  const handleCopyBusLink = () => {
    const url = `${window.location.origin}/busfahrer/${veranstaltung.busfahrer_token}`;
    navigator.clipboard.writeText(url);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  const handleSendInfobrief = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await base44.functions.invoke('sendeInfobrief', { veranstaltung_id: id });
      setSendResult(res.data);
    } catch (e) {
      setSendResult({ error: e.message });
    }
    setSending(false);
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
  // "Anwesend" = einziger Status der für Ehrungen zählt
  const anwesende = teilnahmen.filter(t => t.status === 'Anwesend');
  const abgesagte = teilnahmen.filter(t => t.status === 'Abgesagt');

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
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-4 overflow-x-auto">
          {[
            { id: 'info', label: 'Info' },
            { id: 'teilnahmen', label: `Teilnahmen (${angemeldete.length})` },
            { id: 'check-in', label: 'Check-In' },
            { id: 'bus', label: `Bus (${teilnahmen.filter(t => t.bus).length})` },
            { id: 'arbeitsdienste', label: '🛠 Dienste' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
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
              ) : (() => {
                // #5 – Anmeldeschluss erzwingen
                const heute = new Date().toISOString().split('T')[0];
                const schlussVorbei = veranstaltung.anmeldeschluss && heute > veranstaltung.anmeldeschluss;
                const anmeldungMoeglich = veranstaltung.anmeldung_aktiv && !schlussVorbei;
                if (anmeldungMoeglich) {
                  return (
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
                  );
                }
                return (
                  <div className="py-2 px-3 rounded-lg bg-secondary text-center">
                    <p className="text-sm text-muted-foreground font-medium">
                      {schlussVorbei ? `⏰ Anmeldeschluss war ${veranstaltung.anmeldeschluss}` : 'Anmeldung geschlossen'}
                    </p>
                    {isAdmin && (
                      <p className="text-xs text-primary mt-0.5">Admins können weiterhin manuell hinzufügen</p>
                    )}
                  </div>
                );
              })()}
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
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Ort</label>
                {editing ? (
                  <AdresseAutocomplete
                    value={veranstaltung.ort || ''}
                    onChange={(val) => setVeranstaltung(p => ({ ...p, ort: val }))}
                    placeholder="Ort suchen..."
                  />
                ) : (
                  <p className="text-sm text-foreground py-1">{veranstaltung.ort || '–'}</p>
                )}
              </div>
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

          {/* Typ-spezifische Detailinfos */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-foreground mb-4">
              {veranstaltung.typ === 'Umzug' ? '🎪 Umzugsinfos' : veranstaltung.typ === 'Abendveranstaltung' ? '🎭 Veranstaltungsinfos' : veranstaltung.typ === 'Fest' ? '🎉 Festinfos' : '📋 Details'}
            </h2>
            {editing ? (
              <VeranstaltungsDetailsForm
                data={veranstaltung}
                onChange={(field, val) => setVeranstaltung(p => ({ ...p, [field]: val }))}
                typ={veranstaltung.typ}
              />
            ) : (
              <VeranstaltungsDetailsView data={veranstaltung} />
            )}
          </div>

          {/* Busfahrer-Link – nur für Admins */}
          {isAdmin && !isNew && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Bus size={16} className="text-primary" /> Busfahrer-Zugang
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Erstelle einen öffentlichen Link mit allen Busfahrer-Infos – ohne Login, ideal für eigene und fremde Busfahrer.
              </p>
              {veranstaltung.busfahrer_token ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border">
                    <Link size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {window.location.origin}/busfahrer/{veranstaltung.busfahrer_token}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyBusLink}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Copy size={14} />
                      {tokenCopied ? '✓ Kopiert!' : 'Link kopieren'}
                    </button>
                    <button
                      onClick={handleGenerateToken}
                      disabled={generatingToken}
                      title="Neuen Link generieren (macht alten Link ungültig)"
                      className="px-3 py-2.5 rounded-xl bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">⚠ Neuer Link macht den alten ungültig.</p>
                </div>
              ) : (
                <button
                  onClick={handleGenerateToken}
                  disabled={generatingToken}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Bus size={14} />
                  {generatingToken ? 'Wird erstellt...' : 'Busfahrer-Link erstellen'}
                </button>
              )}
            </div>
          )}

          {/* Infobrief versenden – nur für Admins, nur bei existierenden Veranstaltungen */}
          {isAdmin && !isNew && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Send size={16} className="text-primary" /> Infobrief versenden
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Sendet alle eingetragenen Infos als formatierten Infobrief per E-Mail an alle {angemeldete.length} angemeldeten Mitglieder mit E-Mail-Adresse.
              </p>
              {sendResult && (
                <div className={`mb-3 px-4 py-2.5 rounded-lg text-sm ${sendResult.error ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                  {sendResult.error ? `❌ Fehler: ${sendResult.error}` : `✓ ${sendResult.message}`}
                </div>
              )}
              <button
                onClick={handleSendInfobrief}
                disabled={sending || angemeldete.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {sending ? 'Wird gesendet...' : `Infobrief an ${angemeldete.length} Mitglieder senden`}
              </button>
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

      {/* Bus Check-In Tab – #4 */}
      {activeTab === 'bus' && !isNew && (
        <div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-sm text-blue-400">
            🚌 Bus-Anwesenheit und Umzugsteilnahme werden <strong>separat</strong> erfasst. Bitte beide bestätigen.
          </div>

          {/* Bus Filter */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'alle', label: 'Alle Busfahrer' },
              { id: 'unbestaetigt', label: 'Nicht bestätigt' },
            ].map(f => (
              <button key={f.id} onClick={() => setBusFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${busFilter === f.id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Bus Statistik */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{teilnahmen.filter(t => t.bus).length}</p>
              <p className="text-xs text-muted-foreground">Bus angemeldet</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{teilnahmen.filter(t => t.bus && t.bus_anwesend).length}</p>
              <p className="text-xs text-muted-foreground">Bus bestätigt</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{teilnahmen.filter(t => t.bus && !t.bus_anwesend).length}</p>
              <p className="text-xs text-muted-foreground">Ausstehend</p>
            </div>
          </div>

          <div className="space-y-2">
            {teilnahmen
              .filter(t => t.bus)
              .filter(t => busFilter === 'unbestaetigt' ? !t.bus_anwesend : true)
              .filter(t => {
                const name = getMitgliedName(t.mitglied_id).toLowerCase();
                return name.includes(searchMember.toLowerCase());
              })
              .map(t => (
                <div key={t.id} className={`flex items-center gap-3 rounded-xl px-4 py-3.5 border transition-all ${t.bus_anwesend ? 'bg-green-500/10 border-green-500/30' : 'bg-card border-border'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${t.bus_anwesend ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {getMitgliedName(t.mitglied_id)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{getMitgliedName(t.mitglied_id)}</p>
                    <p className={`text-xs mt-0.5 ${t.bus_anwesend ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {t.bus_anwesend ? '✓ Im Bus bestätigt' : '🚌 Angemeldet, noch nicht bestätigt'}
                    </p>
                  </div>
                  {kannCheckin && (
                    <button
                      onClick={async () => {
                        const newVal = !t.bus_anwesend;
                        await base44.entities.Teilnahme.update(t.id, { bus_anwesend: newVal });
                        setTeilnahmen(prev => prev.map(p => p.id === t.id ? { ...p, bus_anwesend: newVal } : p));
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${t.bus_anwesend ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                    >
                      {t.bus_anwesend ? '✓ Da' : 'Bestätigen'}
                    </button>
                  )}
                </div>
              ))}
            {teilnahmen.filter(t => t.bus).length === 0 && (
              <div className="text-center py-12">
                <Bus size={40} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Keine Busanmeldungen</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Arbeitsdienste Tab */}
      {activeTab === 'arbeitsdienste' && !isNew && (
        <ArbeitsdienstTab veranstaltung={veranstaltung} isAdmin={isAdmin} />
      )}

      {/* Check-In Tab */}
      {activeTab === 'check-in' && !isNew && (
        <div>
          {/* Statuslegende */}
          <div className="bg-card border border-border rounded-xl p-3 mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Status-Bedeutung</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-foreground">Anwesend bestätigt</span>
                <span className="text-muted-foreground">(zählt für Ehrung)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-foreground">Angemeldet</span>
                <span className="text-muted-foreground">(zählt nicht)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-foreground">Abgesagt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bus size={10} className="text-blue-400" />
                <span className="text-foreground">Bus angemeldet</span>
              </div>
            </div>
          </div>

          {/* Statistik */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{anwesende.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Anwesend ✓</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{angemeldete.length - anwesende.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nicht eingecheckt</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{abgesagte.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Abgesagt</p>
            </div>
          </div>

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

          {/* Angemeldete Liste */}
          <div className="space-y-2">
            {filteredTeilnahmen
              .filter(t => ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status))
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => kannCheckin && toggleAnwesenheit(t)}
                  disabled={!kannCheckin}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-4 border transition-all ${
                    t.status === 'Anwesend'
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-card border-border hover:border-primary/50'
                  } ${!kannCheckin ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    t.status === 'Anwesend' ? 'bg-green-500/20 text-green-400' : 'bg-primary/20 text-primary'
                  }`}>
                    {t.status === 'Anwesend' ? <CheckCircle size={20} /> : getMitgliedName(t.mitglied_id)[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-foreground">{getMitgliedName(t.mitglied_id)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${
                        t.status === 'Anwesend' ? 'text-green-400' : 'text-muted-foreground'
                      }`}>
                        {t.status === 'Anwesend' ? '✓ Anwesend bestätigt' : t.status}
                      </span>
                      {t.bus && <span className="text-xs text-blue-400 flex items-center gap-0.5"><Bus size={10} /> Bus</span>}
                    </div>
                  </div>
                  {kannCheckin && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      t.status === 'Anwesend' ? 'bg-green-500/30' : 'bg-secondary'
                    }`}>
                      <Check size={16} className={t.status === 'Anwesend' ? 'text-green-400' : 'text-muted-foreground'} />
                    </div>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}