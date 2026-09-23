import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Plus, Save, Trash2, ChevronUp, ChevronDown,
  Users, ClipboardList, Vote, CheckCircle2, Lock,
  FileText, Eye, EyeOff, Edit, Download, Gavel, ListPlus, Zap, Send, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import MobileSelect from '@/components/MobileSelect';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import { ProtokollModal } from '@/components/ausschuss/ProtokollTab';
import { ausschussAktion } from '@/lib/ausschussAktionen';
import toast from 'react-hot-toast';

const ANWESENHEIT_FARBEN = {
  'Anwesend':      'bg-green-500/20 text-green-400',
  'Entschuldigt':  'bg-yellow-500/20 text-yellow-400',
  'Unentschuldigt':'bg-red-500/20 text-red-400',
};

const TOP_STATUS_FARBEN = {
  'Offen':     'bg-yellow-500/20 text-yellow-400',
  'Besprochen':'bg-green-500/20 text-green-400',
  'Vertagt':   'bg-gray-500/20 text-muted-foreground',
};

const STIMME_FARBEN = {
  'Ja':         'bg-green-500/20 text-green-400 border border-green-500/30',
  'Nein':       'bg-red-500/20 text-red-400 border border-red-500/30',
  'Enthaltung': 'bg-gray-500/20 text-muted-foreground border border-gray-500/30',
};

export default function SitzungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Sichtbarkeit kommt ausschließlich aus der serverseitig geprüften Ausschuss-Funktion.
  const [hatZugriff, setHatZugriff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ladeFehler, setLadeFehler] = useState('');

  const [termin, setTermin] = useState(null);
  const [ausschussMitglieder, setAusschussMitglieder] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [anwesenheiten, setAnwesenheiten] = useState([]);
  const [tops, setTops] = useState([]);
  const [abstimmungen, setAbstimmungen] = useState([]);
  const [stimmen, setStimmen] = useState([]);
  const [protokolle, setProtokolle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('anwesenheit');
  const [liveModus, setLiveModus] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    setLadeFehler('');
    try {
      const res = await base44.functions.invoke('getAusschussDataSicher', {});
      const data = res.data || {};
      if (data.error) throw new Error(data.message || data.error);
      const t = (data.termine || []).find(x => x.id === id);
      // Anwesenheit ist für angemeldete Mitglieder lesbar; die Ausschussprüfung
      // läuft zuerst über das Backend und verhindert den Zugriff auf andere Termine.
      const anw = t ? await base44.entities.SitzungsAnwesenheit.filter({ termin_id: id }) : [];
      const abs = (data.abstimmungen || []).filter(a => a.termin_id === id);
      const absIds = new Set(abs.map(a => a.id));
      setTermin(t || null);
      setAusschussMitglieder(data.ausschussMitglieder || []);
      setMitglieder(data.mitglieder || []);
      setAnwesenheiten(anw || []);
      setTops((data.tops || []).filter(x => x.termin_id === id).sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0)));
      setAbstimmungen(abs);
      setStimmen((data.stimmen || []).filter(v => absIds.has(v.abstimmung_id)));
      setProtokolle((data.protokolle || []).filter(p => p.termin_id === id));
      setIsAdmin(!!data.canManage);
      setHatZugriff(true);
    } catch (e) {
      setHatZugriff(false);
      setLadeFehler(e?.response?.status === 403 ? 'Kein Zugriff' : 'Sitzungsdaten konnten nicht geladen werden');
      console.error('Sitzung laden:', e);
    } finally {
      setLoading(false);
    }
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  // Anwesenheit
  const getAnwesenheit = (mitgliedId) => anwesenheiten.find(a => a.mitglied_id === mitgliedId);

  const handleAnwesenheit = async (mitgliedId, status) => {
    try {
      const { anwesenheit } = await ausschussAktion('sitzung_anwesenheit', { termin_id: id, mitglied_id: mitgliedId, status });
      const vorh = getAnwesenheit(mitgliedId);
      if (vorh) setAnwesenheiten(prev => prev.map(a => a.id === vorh.id ? { ...a, status } : a));
      else setAnwesenheiten(prev => [...prev, anwesenheit]);
    } catch (e) { toast.error(e.message || 'Anwesenheit konnte nicht gespeichert werden'); }
  };

  // Anwesende für Quorum
  const anwesend = anwesenheiten.filter(a => a.status === 'Anwesend').length;
  const quorum = ausschussMitglieder.length > 0 ? Math.ceil(ausschussMitglieder.length / 2) : 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold text-foreground mb-2 font-oswald uppercase tracking-wide">{ladeFehler || 'Kein Zugriff'}</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und Ausschuss zugänglich.</p>
      </div>
    );
  }

  if (!termin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Sitzung nicht gefunden</p>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/ausschuss')} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate font-oswald uppercase tracking-wide">{termin.titel}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(termin.datum), 'EEEE, d. MMMM yyyy', { locale: de })}
            {termin.startzeit && ` · ${termin.startzeit}`}
            {termin.ort && ` · ${termin.ort}`}
          </p>
        </div>
      </div>

      {/* Quorum-Info */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border ${anwesend >= quorum ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
        <Users size={16} className={anwesend >= quorum ? 'text-green-400' : 'text-yellow-400'} />
        <p className="text-sm font-medium text-foreground">
          {anwesend} von {ausschussMitglieder.length} Mitgliedern anwesend
          {quorum > 0 && ` · Quorum: ${quorum}`}
        </p>
        {anwesend >= quorum && quorum > 0 && (
          <span className="ml-auto text-xs text-green-400 font-semibold">✓ Beschlussfähig</span>
        )}
        {anwesend < quorum && quorum > 0 && (
          <span className="ml-auto text-xs text-yellow-400 font-semibold">⚠ Nicht beschlussfähig</span>
        )}
      </div>

      {/* Sitzungs-Lifecycle */}
      {isAdmin && (
        <SitzungsLifecycle termin={termin} isAdmin={isAdmin} onAenderung={loadData} />
      )}

      {/* Live-Modus Toggle */}
      {isAdmin && (
        <div className="mb-4">
          <button onClick={() => setLiveModus(l => !l)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${liveModus ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:border-primary/40'}`}>
            <Zap size={15} /> {liveModus ? 'Live-Modus aktiv — Tippe zum Beenden' : 'Live-Modus starten'}
          </button>
        </div>
      )}

      {/* Live-Modus Ansicht */}
      {liveModus && isAdmin && (
        <LiveModus termin={termin} tops={tops} abstimmungen={abstimmungen} stimmen={stimmen} ausschussMitglieder={ausschussMitglieder} getMitgliedName={getMitgliedName} isAdmin={isAdmin} onAenderung={loadData} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5 overflow-x-auto">
        {[
          { id: 'anwesenheit', label: `👥 Anwesenheit` },
          { id: 'tops', label: `📋 TOP (${tops.length})` },
          { id: 'abstimmungen', label: `🗳️ Abstimmungen (${abstimmungen.length})` },
          { id: 'protokoll', label: protokolle.length > 0 ? `📝 Protokoll ✓` : `📝 Protokoll` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ANWESENHEIT */}
      {activeTab === 'anwesenheit' && (
        <AnwesenheitTab
          ausschussMitglieder={ausschussMitglieder}
          getMitgliedName={getMitgliedName}
          getAnwesenheit={getAnwesenheit}
          onAnwesenheit={handleAnwesenheit}
          isAdmin={isAdmin}
        />
      )}

      {/* TAGESORDNUNG */}
      {activeTab === 'tops' && (
        <TopsTab
          terminId={id}
          tops={tops}
          setTops={setTops}
          mitglieder={mitglieder}
          isAdmin={isAdmin}
          onAenderung={loadData}
        />
      )}

      {/* ABSTIMMUNGEN */}
      {activeTab === 'abstimmungen' && (
        <AbstimmungenTab
          terminId={id}
          abstimmungen={abstimmungen}
          setAbstimmungen={setAbstimmungen}
          ausschussMitglieder={ausschussMitglieder}
          getMitgliedName={getMitgliedName}
          stimmen={stimmen}
          setStimmen={setStimmen}
          isAdmin={isAdmin}
        />
      )}

      {/* PROTOKOLL */}
      {activeTab === 'protokoll' && (
        <SitzungsProtokollTab
          termin={termin}
          protokolle={protokolle}
          mitglieder={mitglieder}
          ausschussIds={ausschussMitglieder.map(a => a.mitglied_id)}
          onSaved={loadData}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─── Protokoll Tab (direkt in der Sitzung) ─────────────────────────
function SitzungsProtokollTab({ termin, protokolle, mitglieder, ausschussIds, onSaved, isAdmin }) {
  const [showModal, setShowModal] = useState(false);
  const [editP, setEditP] = useState(null);

  const handleToggleVeroeffentlicht = async (p) => {
    try {
      await ausschussAktion('protokoll_freigabe', { protokoll_id: p.id, freigabestatus: p.veroeffentlicht ? 'Entwurf' : 'Veröffentlicht' });
      onSaved();
    } catch (e) { toast.error(e.message || 'Protokollstatus konnte nicht geändert werden'); }
  };

  // Noch kein Protokoll → Leitaktion direkt anbieten
  if (protokolle.length === 0) {
  const handleEntwurf = async () => {
  try {
  await ausschussAktion('protokoll_entwurf', { termin_id: termin.id });
  toast.success('Protokoll-Entwurf vorbereitet');
  onSaved();
  } catch (e) { toast.error(e.message || 'Entwurf fehlgeschlagen'); }
  };
  return (
  <div className="text-center py-12 bg-card border border-border rounded-xl">
  <FileText size={36} className="text-muted-foreground/40 mx-auto mb-3" />
  <p className="text-foreground font-medium">Noch kein Protokoll</p>
  <p className="text-sm text-muted-foreground mt-1 mb-5">Protokoll direkt aus der Sitzung heraus erstellen — Titel und Datum sind bereits ausgefüllt.</p>
  {isAdmin && <div className="flex flex-col sm:flex-row gap-2 justify-center">
    <button
      onClick={handleEntwurf}
      className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
    >
      <FileText size={16} /> Entwurf vorbereiten
    </button>
    <button
      onClick={() => { setEditP(null); setShowModal(true); }}
      className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-secondary text-foreground text-sm font-semibold border border-border hover:border-primary/40 transition-colors"
    >
      <Plus size={16} /> Leeres Protokoll
    </button>
  </div>}
        {isAdmin && showModal && (
          <ProtokollModal
            protokoll={null}
            prefill={{ termin_id: termin.id, titel: termin.titel, datum: termin.datum }}
            termine={[termin]}
            mitglieder={mitglieder}
            ausschussIds={ausschussIds}
            onClose={() => setShowModal(false)}
            onSaved={() => { setShowModal(false); onSaved(); }}
          />
        )}
      </div>
    );
  }

  // Bestehende(s) Protokoll(e) anzeigen — inline, ohne Umweg über den Ausschuss-Tab
  return (
    <div className="space-y-3">
      {protokolle.map(p => (
        <div key={p.id} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-foreground">{p.titel}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.veroeffentlicht ? 'bg-green-500/20 text-green-400' : 'bg-secondary text-muted-foreground'}`}>
                  {p.veroeffentlicht ? '✓ Veröffentlicht' : 'Entwurf'}
                </span>
              </div>
              {p.datei_name && (
                <a
                  href={p.datei_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-1 text-xs text-primary hover:underline"
                >
                  <Download size={12} /> {p.datei_name}
                </a>
              )}
            </div>
            {isAdmin && <div className="flex gap-1 shrink-0">
              <button
                onClick={() => handleToggleVeroeffentlicht(p)}
                title={p.veroeffentlicht ? 'Als Entwurf markieren' : 'Veröffentlichen'}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                {p.veroeffentlicht ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                onClick={() => { setEditP(p); setShowModal(true); }}
                title="Bearbeiten"
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Edit size={15} />
              </button>
            </div>}
          </div>
          {p.inhalt && !p.datei_url && (
            <p className="text-sm text-foreground/90 mt-3 whitespace-pre-wrap leading-relaxed">{p.inhalt}</p>
          )}
        </div>
      ))}

      {isAdmin && showModal && (
        <ProtokollModal
          protokoll={editP}
          termine={[termin]}
          mitglieder={mitglieder}
          ausschussIds={ausschussIds}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onSaved(); }}
        />
      )}
    </div>
  );
}

// ─── Anwesenheit Tab ───────────────────────────────────────────────
function AnwesenheitTab({ ausschussMitglieder, getMitgliedName, getAnwesenheit, onAnwesenheit, isAdmin }) {
  if (ausschussMitglieder.length === 0) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <Users size={32} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Noch keine Ausschussmitglieder angelegt</p>
        <p className="text-xs text-muted-foreground mt-1">Im Tab "Ausschussmitglieder" Mitglieder verwalten</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ausschussMitglieder.map(am => {
        const anw = getAnwesenheit(am.mitglied_id);
        const status = anw?.status || null;
        return (
          <div key={am.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {getMitgliedName(am.mitglied_id)[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{getMitgliedName(am.mitglied_id)}</p>
              <p className="text-xs text-muted-foreground">{am.rolle}</p>
            </div>
            {isAdmin ? (
              <div className="flex gap-1 shrink-0">
                {['Anwesend', 'Entschuldigt', 'Unentschuldigt'].map(s => (
                  <button key={s} onClick={() => onAnwesenheit(am.mitglied_id, s)}
                    className={`px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-medium transition-all border ${status === s ? ANWESENHEIT_FARBEN[s] + ' border-current/30' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                    {s === 'Anwesend' ? '✓' : s === 'Entschuldigt' ? 'E' : '✗'}
                  </button>
                ))}
              </div>
            ) : (
              status && (
                <span className={`text-xs px-2 py-1 rounded-full ${ANWESENHEIT_FARBEN[status]}`}>{status}</span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TOPs Tab ───────────────────────────────────────────────────────
function TopsTab({ terminId, tops, setTops, mitglieder, isAdmin, onAenderung }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titel: '', beschreibung: '', verantwortlicher_id: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editNotizen, setEditNotizen] = useState({});
  const [busy, setBusy] = useState(null);

  const abstimmungAnlegen = async (top) => {
    const titel = window.prompt('Titel der Abstimmung?', top.titel);
    if (!titel) return;
    setBusy(top.id + '-abs');
    try {
      await ausschussAktion('top_abstimmung_anlegen', { top_id: top.id, titel });
      toast.success('Abstimmung angelegt');
      onAenderung();
    } catch (e) { toast.error(e.message); }
    setBusy(null);
  };
  const aufgabeErzeugen = async (top) => {
    setBusy(top.id + '-auf');
    try {
      await ausschussAktion('aufgabe_anlegen', { top_id: top.id, titel: `Aufgabe zu: ${top.titel}`, termin_id: terminId });
      toast.success('Aufgabe angelegt');
      onAenderung();
    } catch (e) { toast.error(e.message); }
    setBusy(null);
  };

  const handleCreate = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      const { top } = await ausschussAktion('top_anlegen', { ...form, termin_id: terminId });
      setTops(prev => [...prev, top]);
      setForm({ titel: '', beschreibung: '', verantwortlicher_id: '' });
      setShowForm(false);
      onAenderung?.();
    } catch (e) { toast.error(e.message || 'TOP konnte nicht angelegt werden'); }
    finally { setSaving(false); }
  };

  const handleStatus = async (top, status) => {
    try {
      await ausschussAktion('top_status', { top_id: top.id, status });
      setTops(prev => prev.map(t => t.id === top.id ? { ...t, status } : t));
    } catch (e) { toast.error(e.message || 'TOP-Status konnte nicht gespeichert werden'); }
  };

  const handleNotizen = async (top) => {
    try {
      const notizen = editNotizen[top.id] ?? top.notizen;
      await ausschussAktion('top_notiz', { top_id: top.id, notizen });
      setTops(prev => prev.map(t => t.id === top.id ? { ...t, notizen } : t));
    } catch (e) { toast.error(e.message || 'TOP-Notiz konnte nicht gespeichert werden'); }
  };

  const handleDelete = async (topId) => {
    if (!(await confirmDialog('Diesen Tagesordnungspunkt wirklich löschen?'))) return;
    try {
      await ausschussAktion('top_loeschen', { top_id: topId });
      setTops(prev => prev.filter(t => t.id !== topId));
      onAenderung?.();
    } catch (e) { toast.error(e.message || 'TOP konnte nicht gelöscht werden'); }
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> TOP hinzufügen
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 mb-3 space-y-2">
          <input type="text" placeholder="Titel *" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          <textarea placeholder="Beschreibung (optional)" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={2} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          <MobileSelect value={form.verantwortlicher_id} onChange={v => setForm(p => ({ ...p, verantwortlicher_id: v }))}
            placeholder="Verantwortlich (optional)"
            options={[{ label: 'Verantwortlich (optional)', value: '' }, ...mitglieder.map(m => ({ label: `${m.vorname} ${m.nachname}`, value: m.id }))]} />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-sm border border-border">Abbrechen</button>
            <button onClick={handleCreate} disabled={saving || !form.titel}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
              {saving ? '...' : 'Hinzufügen'}
            </button>
          </div>
        </div>
      )}

      {tops.length === 0 && !showForm && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <ClipboardList size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Tagesordnungspunkte</p>
        </div>
      )}

      <div className="space-y-2">
        {tops.map((top, i) => (
          <div key={top.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{top.titel}</p>
                {top.beschreibung && <p className="text-xs text-muted-foreground truncate">{top.beschreibung}</p>}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${TOP_STATUS_FARBEN[top.status]}`}>{top.status}</span>
              <button onClick={() => setExpandedId(expandedId === top.id ? null : top.id)}
                className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0">
                {expandedId === top.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {expandedId === top.id && (
              <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                {isAdmin && (
                  <div className="flex gap-2">
                    {['Offen', 'Besprochen', 'Vertagt'].map(s => (
                      <button key={s} onClick={() => handleStatus(top, s)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${top.status === s ? TOP_STATUS_FARBEN[s] + ' border-current/30' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => abstimmungAnlegen(top)} disabled={busy === top.id + '-abs'}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"><Vote size={12} /> Abstimmung</button>
                    <button onClick={() => aufgabeErzeugen(top)} disabled={busy === top.id + '-auf'}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"><ListPlus size={12} /> Aufgabe</button>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Protokollnotiz</label>
                  <textarea
                    value={editNotizen[top.id] !== undefined ? editNotizen[top.id] : (top.notizen || '')}
                    onChange={e => setEditNotizen(p => ({ ...p, [top.id]: e.target.value }))}
                    rows={3}
                    disabled={!isAdmin}
                    placeholder="Ergebnis, Notizen..."
                    className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none disabled:opacity-60"
                  />
                  {isAdmin && (
                    <div className="flex justify-between mt-2">
                      <button onClick={() => handleDelete(top.id)}
                        className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1">
                        <Trash2 size={12} /> Löschen
                      </button>
                      <button onClick={() => handleNotizen(top)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                        <Save size={12} /> Notiz speichern
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Abstimmungen Tab ───────────────────────────────────────────────
function AbstimmungenTab({ terminId, abstimmungen, setAbstimmungen, ausschussMitglieder, getMitgliedName, stimmen, setStimmen, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titel: '', beschreibung: '', angenommen_ab: 51 });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const handleCreate = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      const { abstimmung } = await ausschussAktion('abstimmung_anlegen', { ...form, termin_id: terminId });
      setAbstimmungen(prev => [...prev, abstimmung]);
      setForm({ titel: '', beschreibung: '', angenommen_ab: 50 });
      setShowForm(false);
    } catch (e) { toast.error(e.message || 'Abstimmung konnte nicht angelegt werden'); }
    finally { setSaving(false); }
  };

  const getStimmenFuerAbstimmung = (abstimmungId) => stimmen.filter(s => s.abstimmung_id === abstimmungId);

  const handleStimme = async (abstimmungId, mitgliedId, stimme) => {
    try {
      const vorh = stimmen.find(s => s.abstimmung_id === abstimmungId && s.mitglied_id === mitgliedId);
      const { stimme: rec } = await ausschussAktion('abstimmung_stimme_fuer', { abstimmung_id: abstimmungId, mitglied_id: mitgliedId, stimme });
      if (vorh) setStimmen(prev => prev.map(s => s.id === vorh.id ? { ...s, stimme } : s));
      else setStimmen(prev => [...prev, rec]);
    } catch (e) { toast.error(e.message || 'Stimme konnte nicht gespeichert werden'); }
  };

  const handleAbschliessen = async (abs) => {
    try {
      const { ergebnis } = await ausschussAktion('abstimmung_abschliessen', { abstimmung_id: abs.id });
      setAbstimmungen(prev => prev.map(a => a.id === abs.id ? { ...a, status: 'Abgeschlossen', ergebnis } : a));
    } catch (e) { toast.error(e.message || 'Abstimmung konnte nicht abgeschlossen werden'); }
  };

  const handleDelete = async (absId) => {
    if (!(await confirmDialog('Abstimmung wirklich löschen?'))) return;
    try {
      await ausschussAktion('abstimmung_loeschen', { abstimmung_id: absId });
      setAbstimmungen(prev => prev.filter(a => a.id !== absId));
    } catch (e) { toast.error(e.message || 'Abstimmung konnte nicht gelöscht werden'); }
  };

  const [busyBeschluss, setBusyBeschluss] = useState(null);
  const handleBeschlussErzeugen = async (abs) => {
    setBusyBeschluss(abs.id);
    try {
      await ausschussAktion('beschluss_aus_abstimmung', { abstimmung_id: abs.id });
      toast.success('Beschluss erzeugt');
      setAbstimmungen(prev => prev.map(a => a.id === abs.id ? { ...a, beschluss_id: 'erzeugt' } : a));
    } catch (e) { toast.error(e.message || 'Beschluss konnte nicht erzeugt werden'); }
    setBusyBeschluss(null);
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Abstimmung
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-secondary border border-border rounded-xl p-4 mb-3 space-y-2">
          <input type="text" placeholder="Titel *" value={form.titel} onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          <textarea placeholder="Beschreibung / Antrag" value={form.beschreibung} onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={2} className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Angenommen ab (% Ja-Stimmen)</label>
            <input type="number" min="1" max="100" value={form.angenommen_ab} onChange={e => setForm(p => ({ ...p, angenommen_ab: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-sm border border-border">Abbrechen</button>
            <button onClick={handleCreate} disabled={saving || !form.titel}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
              {saving ? '...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {abstimmungen.length === 0 && !showForm && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Vote size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Noch keine Abstimmungen</p>
        </div>
      )}

      <div className="space-y-2">
        {abstimmungen.map(abs => {
          const absStimmen = getStimmenFuerAbstimmung(abs.id);
          const ja = absStimmen.filter(s => s.stimme === 'Ja').length;
          const nein = absStimmen.filter(s => s.stimme === 'Nein').length;
          const enthalten = absStimmen.filter(s => s.stimme === 'Enthaltung').length;
          const abgeschlossen = abs.status === 'Abgeschlossen';

          return (
            <div key={abs.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{abs.titel}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-green-400">✓ {ja}</span>
                    <span className="text-red-400">✗ {nein}</span>
                    <span className="text-muted-foreground">∼ {enthalten}</span>
                    {abgeschlossen && abs.ergebnis && (
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${abs.ergebnis === 'Angenommen' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {abs.ergebnis}
                      </span>
                    )}
                  </div>
                </div>
                {abgeschlossen && abs.ergebnis === 'Angenommen' && !abs.beschluss_id && isAdmin && (
                  <button onClick={() => handleBeschlussErzeugen(abs)} disabled={busyBeschluss === abs.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-semibold shrink-0 flex items-center gap-1">
                    <Gavel size={12} /> {busyBeschluss === abs.id ? '…' : 'Beschluss'}
                  </button>
                )}
                {abgeschlossen && abs.beschluss_id && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0 flex items-center gap-1"><Gavel size={10} /> Beschluss</span>
                )}
                {!abgeschlossen && isAdmin && (
                  <button onClick={() => handleAbschliessen(abs)}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold shrink-0">
                    Abschließen
                  </button>
                )}
                <button onClick={() => setExpandedId(expandedId === abs.id ? null : abs.id)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0">
                  {expandedId === abs.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {expandedId === abs.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
                  {abs.beschreibung && <p className="text-sm text-muted-foreground">{abs.beschreibung}</p>}

                  {/* Namentliche Abstimmung */}
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Namentliche Abstimmung</p>
                  {ausschussMitglieder.map(am => {
                    const stimme = absStimmen.find(s => s.mitglied_id === am.mitglied_id);
                    return (
                      <div key={am.id} className="flex items-center gap-2">
                        <span className="text-sm text-foreground flex-1 truncate">{getMitgliedName(am.mitglied_id)}</span>
                        {!abgeschlossen && isAdmin ? (
                          <div className="flex gap-1 shrink-0">
                            {['Ja', 'Nein', 'Enthaltung'].map(s => (
                              <button key={s} onClick={() => handleStimme(abs.id, am.mitglied_id, s)}
                                className={`px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold border transition-all ${stimme?.stimme === s ? STIMME_FARBEN[s] : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
                                {s === 'Enthaltung' ? '∼' : s === 'Ja' ? '✓' : '✗'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${stimme ? STIMME_FARBEN[stimme.stimme] : 'bg-secondary text-muted-foreground'}`}>
                            {stimme?.stimme || '–'}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {isAdmin && !abgeschlossen && (
                    <button onClick={() => handleDelete(abs.id)}
                      className="text-xs text-destructive flex items-center gap-1 mt-2">
                      <Trash2 size={12} /> Abstimmung löschen
                    </button>
                  )}
                </div>
                )}
                </div>
                );
                })}
                </div>
                </div>
                );
                }

                // ─── Sitzungs-Lifecycle ────────────────────────────────────────────
                const SITZUNGS_PHASEN = ['Entwurf', 'Eingeladen', 'Läuft', 'Nachbereitung', 'Abgeschlossen', 'Abgesagt'];

                function SitzungsLifecycle({ termin, isAdmin, onAenderung }) {
                const [busy, setBusy] = useState(null);
                const status = termin?.sitzungs_status || 'Entwurf';

                const aendere = async (neu) => {
                setBusy(neu);
                try {
                await ausschussAktion('sitzung_status', { termin_id: termin.id, sitzungs_status: neu });
                toast.success(`Status: ${neu}`);
                onAenderung();
                } catch (e) { toast.error(e.message || 'Statusänderung fehlgeschlagen'); }
                setBusy(null);
                };

                const einladen = async () => {
                setBusy('Eingeladen');
                try {
                await ausschussAktion('sitzung_einladen', { termin_id: termin.id });
                toast.success('Einladung markiert als gesendet');
                onAenderung();
                } catch (e) { toast.error(e.message || 'Einladen fehlgeschlagen'); }
                setBusy(null);
                };

                const sperren = async () => {
                setBusy('sperren');
                try {
                await ausschussAktion('tops_sperren', { termin_id: termin.id, tops_gesperrt: !termin.tops_gesperrt });
                onAenderung();
                } catch (e) { toast.error(e.message || 'Sperren fehlgeschlagen'); }
                setBusy(null);
                };

                if (!isAdmin) return null;

                return (
                <div className="bg-card border border-border rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ShieldCheck size={14} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sitzungs-Phase</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{status}</span>
                {termin.tops_gesperrt && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500">Agenda gesperrt</span>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                {SITZUNGS_PHASEN.map(p => (
                <button key={p} onClick={() => aendere(p)} disabled={busy === p || status === p}
                className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${status === p ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40'}`}>
                {busy === p ? '…' : p}
                </button>
                ))}
                </div>
                <div className="flex gap-2 mt-2">
                <button onClick={einladen} disabled={busy === 'Eingeladen'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-primary/20 transition-colors">
                <Send size={12} /> Einladung gesendet
                </button>
                <button onClick={sperren} disabled={busy === 'sperren'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-semibold hover:bg-primary/20 transition-colors">
                <Lock size={12} /> {termin.tops_gesperrt ? 'Agenda entsperren' : 'Agenda sperren'}
                </button>
                </div>
                </div>
                );
                }

                // ─── Live-Modus ────────────────────────────────────────────────────
                function LiveModus({ termin, tops, abstimmungen, stimmen, ausschussMitglieder, getMitgliedName, isAdmin, onAenderung }) {
                const [idx, setIdx] = useState(0);
                const [busy, setBusy] = useState(null);
                const aktiverTop = tops[idx];
                const offen = tops.filter(t => t.status === 'Offen');
                const fortschritt = tops.length > 0 ? Math.round((tops.filter(t => t.status !== 'Offen').length / tops.length) * 100) : 0;

                const anwesend = 0; // vereinfacht im Live-Modus
                const quorum = ausschussMitglieder.length > 0 ? Math.ceil(ausschussMitglieder.length / 2) : 0;

                const topAbs = aktiverTop ? abstimmungen.filter(a => a.top_id === aktiverTop.id) : [];

                const setTopStatus = async (status) => {
                setBusy(status);
                try {
                await ausschussAktion('top_status', { top_id: aktiverTop.id, status });
                onAenderung();
                } catch (e) { toast.error(e.message); }
                setBusy(null);
                };

                const abstimmungAnlegen = async () => {
                const titel = window.prompt('Titel der Abstimmung?', aktiverTop?.titel || '');
                if (!titel) return;
                setBusy('abstimmung');
                try {
                await ausschussAktion('top_abstimmung_anlegen', { top_id: aktiverTop.id, titel });
                toast.success('Abstimmung angelegt');
                onAenderung();
                } catch (e) { toast.error(e.message); }
                setBusy(null);
                };

                const beschlussErzeugen = async (abs) => {
                if (abs.ergebnis !== 'Angenommen') { toast.error('Nur angenommene Abstimmungen werden Beschluss'); return; }
                setBusy('beschluss');
                try {
                await ausschussAktion('beschluss_aus_abstimmung', { abstimmung_id: abs.id });
                toast.success('Beschluss erzeugt');
                onAenderung();
                } catch (e) { toast.error(e.message); }
                setBusy(null);
                };

                const aufgabeErzeugen = async () => {
                setBusy('aufgabe');
                try {
                await ausschussAktion('aufgabe_anlegen', { top_id: aktiverTop.id, titel: `Aufgabe zu: ${aktiverTop.titel}`, termin_id: termin.id });
                toast.success('Aufgabe angelegt');
                onAenderung();
                } catch (e) { toast.error(e.message); }
                setBusy(null);
                };

                return (
                <div className="bg-card border border-primary/40 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                <Zap size={16} className="text-primary" />
                <span className="font-oswald uppercase tracking-wide text-foreground">Live-Modus</span>
                </div>
                <div className="text-xs text-muted-foreground">{anwesend}/{ausschussMitglieder.length} anwesend · Quorum {quorum}</div>
                </div>
                <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Fortschritt</span>
                <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${fortschritt}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{fortschritt}%</span>
                </div>
                {tops.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Keine TOPs — zuerst Tagesordnung anlegen.</p>
                ) : (
                <>
                <div className="flex items-center justify-between gap-2">
                <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-40 hover:bg-primary/20 transition-colors"><ChevronUp size={16} /></button>
                <span className="text-xs text-muted-foreground">TOP {idx + 1} / {tops.length} · {offen.length} offen</span>
                <button onClick={() => setIdx(i => Math.min(tops.length - 1, i + 1))} disabled={idx === tops.length - 1}
                className="p-2 rounded-lg bg-secondary text-foreground disabled:opacity-40 hover:bg-primary/20 transition-colors"><ChevronDown size={16} /></button>
                </div>

                {aktiverTop && (
                <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{aktiverTop.titel}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${TOP_STATUS_FARBEN[aktiverTop.status]}`}>{aktiverTop.status}</span>
                </div>
                {aktiverTop.beschreibung && <p className="text-xs text-muted-foreground">{aktiverTop.beschreibung}</p>}

                {isAdmin && (
                <div className="flex gap-1.5 flex-wrap">
                 <button onClick={() => setTopStatus('Besprochen')} disabled={busy === 'Besprochen'}
                   className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-semibold hover:bg-green-600/30 transition-colors"><CheckCircle2 size={12} /> Besprochen</button>
                 <button onClick={() => setTopStatus('Vertagt')} disabled={busy === 'Vertagt'}
                   className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors">Vertagen</button>
                 <button onClick={abstimmungAnlegen} disabled={busy === 'abstimmung'}
                   className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"><Vote size={12} /> Abstimmung</button>
                 <button onClick={aufgabeErzeugen} disabled={busy === 'aufgabe'}
                   className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors"><ListPlus size={12} /> Aufgabe</button>
                </div>
                )}

                {topAbs.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1.5">
                 {topAbs.map(a => {
                   const ja = stimmen.filter(s => s.abstimmung_id === a.id && s.stimme === 'Ja').length;
                   const nein = stimmen.filter(s => s.abstimmung_id === a.id && s.stimme === 'Nein').length;
                   return (
                     <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                       <span className="text-foreground truncate">{a.titel}</span>
                       <span className="text-muted-foreground shrink-0">✓{ja} ✗{nein} {a.ergebnis ? `→ ${a.ergebnis}` : ''}</span>
                       {isAdmin && a.ergebnis === 'Angenommen' && (
                         <button onClick={() => beschlussErzeugen(a)} disabled={busy === 'beschluss'}
                           className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-white text-[10px] font-semibold hover:bg-primary/90 transition-colors"><Gavel size={10} /> Beschluss</button>
                       )}
                     </div>
                   );
                 })}
                </div>
                )}
                </div>
                )}
                </>
                )}
                </div>
                );
                }