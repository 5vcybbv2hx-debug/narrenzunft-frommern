import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, CheckSquare, FileText, Lock, Plus, X, Save,
  Trash2, ChevronRight, Circle, CheckCircle2, Clock, Users,
  AlertTriangle, Calendar, MapPin, User as UserIcon, Gavel, Vote, Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import AusschussMitgliederTab from '@/components/ausschuss/AusschussMitgliederTab';
import ProtokollTab from '@/components/ausschuss/ProtokollTab';
import { kannAusschussSehn } from '@/lib/roles';

const PRIO_FARBEN = {
  'Niedrig':  'bg-neutral-700 text-neutral-300',
  'Mittel':   'bg-blue-900/30 text-blue-400 border border-blue-700/30',
  'Hoch':     'bg-primary/15 text-primary',
  'Dringend': 'bg-red-900/20 text-red-400 border border-red-700/30',
};

const STATUS_ICONS = {
  'Offen':          <Circle size={14} className="text-yellow-400" />,
  'In Bearbeitung': <Clock size={14} className="text-blue-400" />,
  'Erledigt':       <CheckCircle2 size={14} className="text-green-400" />,
  'Abgebrochen':    <X size={14} className="text-red-400" />,
};

const BESCHLUSS_STATUS_FARBEN = {
  'Offen':     'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30',
  'Umgesetzt': 'bg-green-900/20 text-green-400 border border-green-700/30',
  'Verworfen': 'bg-red-900/20 text-red-400 border border-red-700/30',
};

const TABS = [
  { id: 'sitzungen', label: 'Sitzungen', icon: ClipboardList },
  { id: 'aufgaben', label: 'Offene Punkte', icon: CheckSquare },
  { id: 'beschluesse', label: 'Beschlüsse', icon: Gavel },
  { id: 'abstimmungen', label: 'Abstimmungen', icon: Vote },
  { id: 'protokolle', label: 'Protokolle', icon: FileText },
  { id: 'mitglieder', label: 'Ausschuss', icon: Users },
];

export default function Ausschuss() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sitzungen');
  const isAdmin = kannAusschussSehn(user);
  const [termine, setTermine] = useState([]);
  const [aufgaben, setAufgaben] = useState([]);
  const [beschluesse, setBeschluesse] = useState([]);
  const [abstimmungen, setAbstimmungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAufgabeModal, setShowAufgabeModal] = useState(false);
  const [showBeschlussModal, setShowBeschlussModal] = useState(false);
  const [showSitzungModal, setShowSitzungModal] = useState(false);
  const [showAbstimmungModal, setShowAbstimmungModal] = useState(false);
  const [editAbstimmung, setEditAbstimmung] = useState(null);
  const [editAufgabe, setEditAufgabe] = useState(null);
  const [editBeschluss, setEditBeschluss] = useState(null);

  const hatZugriff = kannAusschussSehn(user);

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getAusschussDataSicher', {});
      const data = res.data;
      setTermine(data.termine || []);
      setAufgaben(data.aufgaben || []);
      setBeschluesse(data.beschluesse || []);
      setMitglieder(data.mitglieder || []);
      const abs = await base44.entities.Abstimmung.list('-created_date', 200);
      setAbstimmungen(abs || []);
    } catch (e) {
      console.error('Ausschuss laden:', e);
      setError('Ausschussdaten konnten nicht geladen werden.');
    }
    setLoading(false);
  };

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und Ausschuss zugänglich.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Ausschussdaten werden geladen…</p>
    </div>
  );

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const kommendeSitzungen = termine.filter(t => t.datum >= today).slice(0, 5);
  const vergangeneSitzungen = termine.filter(t => t.datum < today).slice().reverse().slice(0, 10);

  const offeneAufgaben = aufgaben.filter(a => a.status !== 'Erledigt' && a.status !== 'Abgebrochen');
  const erledigteAufgaben = aufgaben.filter(a => a.status === 'Erledigt');

  const tabBadges = { aufgaben: offeneAufgaben.length };

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-primary" />
            <span className="text-xs text-primary font-semibold uppercase tracking-wide">Vertraulich</span>
          </div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white">Ausschussbereich</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Nur für Vorstand & Ausschuss</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 ml-2"><X size={16} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const badge = tabBadges[tab.id];
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-card text-white shadow' : 'text-muted-foreground hover:text-white'}`}>
              <Icon size={14} />
              {tab.label}
              {badge ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold">{badge}</span> : null}
            </button>
          );
        })}
      </div>

      {/* SITZUNGEN */}
      {activeTab === 'sitzungen' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowSitzungModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors">
              <Plus size={15} /> Neue Sitzung
            </button>
          </div>
          {kommendeSitzungen.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kommende Sitzungen</h3>
              <div className="space-y-2">
                {kommendeSitzungen.map(t => (
                  <SitzungsKarte key={t.id} termin={t} aufgaben={aufgaben.filter(a => a.termin_id === t.id)} />
                ))}
              </div>
            </div>
          )}
          {kommendeSitzungen.length === 0 && (
            <div className="text-center py-10 bg-card border border-border rounded-xl">
              <ClipboardList size={32} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-white">Keine kommenden Sitzungen</p>
              <p className="text-xs text-muted-foreground mt-1">Sitzungen im Kalender als „Ausschusssitzung" anlegen</p>
            </div>
          )}
          {vergangeneSitzungen.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Vergangene Sitzungen</h3>
              <div className="space-y-2 opacity-70">
                {vergangeneSitzungen.map(t => (
                  <SitzungsKarte key={t.id} termin={t} aufgaben={aufgaben.filter(a => a.termin_id === t.id)} vergangen />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABSTIMMUNGEN */}
      {activeTab === 'abstimmungen' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditAbstimmung(null); setShowAbstimmungModal(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors">
              <Plus size={15} /> Abstimmung
            </button>
          </div>
          <div className="space-y-2">
            {abstimmungen.map(a => {
              const sitzung = termine.find(t => t.id === a.termin_id);
              return (
                <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-white">{a.titel}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.status === 'Abgeschlossen' ? 'bg-green-900/20 text-green-400 border border-green-700/30' : 'bg-yellow-900/20 text-yellow-400 border border-yellow-700/30'}`}>
                        {a.status}
                      </span>
                      {a.ergebnis && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.ergebnis === 'Angenommen' ? 'bg-green-900/20 text-green-400 border border-green-700/30' : 'bg-red-900/20 text-red-400 border border-red-700/30'}`}>
                          {a.ergebnis}
                        </span>
                      )}
                    </div>
                    {a.beschreibung && <p className="text-xs text-muted-foreground">{a.beschreibung}</p>}
                    {sitzung && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><ClipboardList size={11} /> {sitzung.titel} · {sitzung.datum}</p>}
                  </div>
                  <button onClick={() => { setEditAbstimmung(a); setShowAbstimmungModal(true); }}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <FileText size={14} />
                  </button>
                </div>
              );
            })}
          </div>
          {abstimmungen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Vote size={32} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-white">Noch keine Abstimmungen erfasst</p>
            </div>
          )}
        </div>
      )}

      {/* PROTOKOLLE */}
      {activeTab === 'protokolle' && (
        <ProtokollTab termine={termine} mitglieder={mitglieder} />
      )}

      {/* AUSSCHUSSMITGLIEDER */}
      {activeTab === 'mitglieder' && (
        <AusschussMitgliederTab mitglieder={mitglieder} isAdmin={isAdmin} />
      )}

      {/* AUFGABEN */}
      {activeTab === 'aufgaben' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3 text-sm">
              <span className="text-yellow-400 font-semibold">{offeneAufgaben.length} offen</span>
              <span className="text-green-400 font-semibold">{erledigteAufgaben.length} erledigt</span>
            </div>
            <button onClick={() => { setEditAufgabe(null); setShowAufgabeModal(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors">
              <Plus size={15} /> Offener Punkt
            </button>
          </div>
          <div className="space-y-2">
            {aufgaben.map(a => (
              <div key={a.id} className={`bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 ${a.status === 'Erledigt' ? 'opacity-50' : ''}`}>
                <div className="shrink-0">{STATUS_ICONS[a.status] || STATUS_ICONS['Offen']}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${a.status === 'Erledigt' ? 'line-through text-muted-foreground' : 'text-white'}`}>{a.titel}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIO_FARBEN[a.prioritaet] || ''}`}>{a.prioritaet}</span>
                    {a.faellig_am && <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {format(new Date(a.faellig_am), 'dd.MM.yyyy')}</span>}
                    {a.verantwortlicher_id && <span className="text-xs text-muted-foreground flex items-center gap-1"><UserIcon size={10} /> {getMitgliedName(a.verantwortlicher_id)}</span>}
                  </div>
                </div>
                <button onClick={() => { setEditAufgabe(a); setShowAufgabeModal(true); }}
                  className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <FileText size={14} />
                </button>
              </div>
            ))}
          </div>
          {aufgaben.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <CheckSquare size={32} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-white">Noch keine offenen Punkte</p>
            </div>
          )}
        </div>
      )}

      {/* BESCHLÜSSE */}
      {activeTab === 'beschluesse' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setEditBeschluss(null); setShowBeschlussModal(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors">
              <Plus size={15} /> Beschluss
            </button>
          </div>
          <div className="space-y-2">
            {beschluesse.map(b => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-white">{b.titel}</p>
                      {b.vertraulich && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-700/30 flex items-center gap-1"><Lock size={9} /> Vertraulich</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${BESCHLUSS_STATUS_FARBEN[b.status] || ''}`}>{b.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{format(new Date(b.datum), 'dd.MM.yyyy', { locale: de })}</p>
                    {b.inhalt && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{b.inhalt}</p>}
                  </div>
                  <button onClick={() => { setEditBeschluss(b); setShowBeschlussModal(true); }}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <FileText size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {beschluesse.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Gavel size={32} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-white">Noch keine Beschlüsse erfasst</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAufgabeModal && (
        <AufgabeModal
          aufgabe={editAufgabe}
          mitglieder={mitglieder}
          termine={termine}
          onClose={() => { setShowAufgabeModal(false); setEditAufgabe(null); }}
          onSaved={() => { setShowAufgabeModal(false); setEditAufgabe(null); loadData(); }}
        />
      )}
      {showAbstimmungModal && (
        <AbstimmungModal
          abstimmung={editAbstimmung}
          termine={termine}
          onClose={() => { setShowAbstimmungModal(false); setEditAbstimmung(null); }}
          onSaved={() => { setShowAbstimmungModal(false); setEditAbstimmung(null); loadData(); }}
        />
      )}
      {showSitzungModal && (
        <SitzungModal
          onClose={() => setShowSitzungModal(false)}
          onSaved={() => { setShowSitzungModal(false); loadData(); }}
        />
      )}
      {showBeschlussModal && (
        <BeschlussModal
          beschluss={editBeschluss}
          termine={termine}
          onClose={() => { setShowBeschlussModal(false); setEditBeschluss(null); }}
          onSaved={() => { setShowBeschlussModal(false); setEditBeschluss(null); loadData(); }}
        />
      )}
    </div>
  );
}

function SitzungsKarte({ termin, aufgaben, vergangen }) {
  const navigate = useNavigate();
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
      <button onClick={() => navigate(`/ausschuss/sitzung/${termin.id}`)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-[9px] text-muted-foreground uppercase">{format(new Date(termin.datum + 'T12:00:00'), 'MMM', { locale: de })}</span>
          <span className="text-sm font-bold text-primary font-oswald">{format(new Date(termin.datum + 'T12:00:00'), 'd')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{termin.titel}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {termin.startzeit && <span className="flex items-center gap-1"><Clock size={10} /> {termin.startzeit}{termin.endzeit ? `–${termin.endzeit}` : ''}</span>}
            {termin.ort && <span className="flex items-center gap-1"><MapPin size={10} /> {termin.ort}</span>}
            {aufgaben.length > 0 && <span className="text-primary flex items-center gap-1"><ClipboardList size={10} /> {aufgaben.length} Aufgaben</span>}
          </div>
        </div>
        <ChevronRight size={15} className="text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}

/* === Shared Delete Confirm === */
function DeleteBar({ show, onConfirm, onCancel, deleting }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/30">
      <AlertTriangle size={14} className="text-red-400 shrink-0" />
      <span className="text-xs text-red-400 flex-1">Wirklich löschen?</span>
      <button onClick={onCancel} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-white">Abbrechen</button>
      <button onClick={onConfirm} disabled={deleting} className="text-xs px-3 py-1 rounded bg-red-900/80 text-white font-medium disabled:opacity-50">{deleting ? '…' : 'Löschen'}</button>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-border text-sm text-white focus:outline-none focus:border-primary transition-colors";
const selectCls = inputCls;
const labelCls = "text-xs text-muted-foreground block mb-1";

function AufgabeModal({ aufgabe, mitglieder, termine, onClose, onSaved }) {
  const isNew = !aufgabe;
  const [form, setForm] = useState({
    titel: '', beschreibung: '', status: 'Offen', prioritaet: 'Mittel',
    faellig_am: '', verantwortlicher_id: '', termin_id: '', notizen: '',
    ...aufgabe,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      if (isNew) await base44.entities.Ausschussaufgabe.create(form);
      else await base44.entities.Ausschussaufgabe.update(aufgabe.id, form);
      onSaved();
    } catch (e) {
      console.error('Aufgabe speichern:', e);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Ausschussaufgabe.delete(aufgabe.id);
      onSaved();
    } catch (e) {
      console.error('Aufgabe löschen:', e);
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{isNew ? 'Neuer offener Punkt' : 'Offenen Punkt bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Titel *" value={form.titel} onChange={e => set('titel', e.target.value)} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={selectCls}>
                {['Offen','In Bearbeitung','Erledigt','Abgebrochen'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priorität</label>
              <select value={form.prioritaet} onChange={e => set('prioritaet', e.target.value)} className={selectCls}>
                {['Niedrig','Mittel','Hoch','Dringend'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fällig am</label>
            <input type="date" value={form.faellig_am || ''} onChange={e => set('faellig_am', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Verantwortlich</label>
            <select value={form.verantwortlicher_id || ''} onChange={e => set('verantwortlicher_id', e.target.value)} className={selectCls}>
              <option value="">–</option>
              {mitglieder.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Zugehörige Sitzung</label>
            <select value={form.termin_id || ''} onChange={e => set('termin_id', e.target.value)} className={selectCls}>
              <option value="">–</option>
              {termine.map(t => <option key={t.id} value={t.id}>{t.titel} ({t.datum})</option>)}
            </select>
          </div>
          <textarea placeholder="Notizen" value={form.notizen || ''} onChange={e => set('notizen', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>
        {confirmDelete && <div className="mt-3"><DeleteBar show={true} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} deleting={deleting} /></div>}
        <div className="flex gap-2 mt-4">
          {!isNew && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={16} /></button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm hover:text-white transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AbstimmungModal({ abstimmung, termine, onClose, onSaved }) {
  const isNew = !abstimmung;
  const [form, setForm] = useState({
    titel: '', beschreibung: '', status: 'Offen', angenommen_ab: 50, termin_id: '',
    antwort_optionen: [],
    ...abstimmung,
  });
  const [neueOption, setNeueOption] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const addOption = () => {
    const val = neueOption.trim();
    if (!val) return;
    set('antwort_optionen', [...(form.antwort_optionen || []), val]);
    setNeueOption('');
  };

  const removeOption = (idx) => {
    set('antwort_optionen', (form.antwort_optionen || []).filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      if (isNew) await base44.entities.Abstimmung.create(form);
      else await base44.entities.Abstimmung.update(abstimmung.id, form);
      onSaved();
    } catch (e) {
      console.error('Abstimmung speichern:', e);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Abstimmung.delete(abstimmung.id);
      onSaved();
    } catch (e) {
      console.error('Abstimmung löschen:', e);
    }
    setDeleting(false);
  };

  const optionen = form.antwort_optionen || [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{isNew ? 'Neue Abstimmung' : 'Abstimmung bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Titel *" value={form.titel} onChange={e => set('titel', e.target.value)} className={inputCls} />
          <textarea placeholder="Beschreibung / Antrag" value={form.beschreibung || ''} onChange={e => set('beschreibung', e.target.value)} rows={3} className={`${inputCls} resize-none`} />
          <div>
            <label className="text-xs text-muted-foreground font-medium block mb-1">
              Antwortoptionen <span className="font-normal">(leer = Standard: Ja / Nein / Enthaltung)</span>
            </label>
            {optionen.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {optionen.map((opt, idx) => (
                  <span key={idx} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium">
                    {opt}
                    <button type="button" onClick={() => removeOption(idx)} className="hover:text-red-400 transition-colors ml-0.5"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="Neue Option hinzufügen…" value={neueOption}
                onChange={e => setNeueOption(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                className={inputCls} />
              <button type="button" onClick={addOption}
                className="px-3 py-2 rounded-lg bg-primary/20 text-primary text-sm font-semibold hover:bg-primary/30 transition-colors">
                <Plus size={15} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={selectCls}>
                {['Offen','Abgeschlossen'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Angenommen ab (%)</label>
              <input type="number" min="1" max="100" value={form.angenommen_ab} onChange={e => set('angenommen_ab', Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Zugehörige Sitzung</label>
            <select value={form.termin_id || ''} onChange={e => set('termin_id', e.target.value)} className={selectCls}>
              <option value="">–</option>
              {termine.map(t => <option key={t.id} value={t.id}>{t.titel} ({t.datum})</option>)}
            </select>
          </div>
        </div>
        {confirmDelete && <div className="mt-3"><DeleteBar show={true} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} deleting={deleting} /></div>}
        <div className="flex gap-2 mt-4">
          {!isNew && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={16} /></button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm hover:text-white transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SitzungModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    titel: '', datum: format(new Date(), 'yyyy-MM-dd'), startzeit: '', endzeit: '', ort: '', beschreibung: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleDatumChange = (val) => {
    setForm(p => ({
      ...p,
      datum: val,
      titel: val ? `Ausschusssitzung ${val.split('-').reverse().join('.')}` : p.titel,
    }));
  };
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    setError(null);
    try {
      await base44.entities.KalenderTermin.create({
        ...form,
        terminart: 'Ausschusssitzung',
        sichtbarkeit: 'ausschuss',
        status: 'Geplant',
      });
      onSaved();
    } catch (e) {
      console.error('Sitzung erstellen:', e);
      setError('Sitzung konnte nicht erstellt werden.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-oswald uppercase tracking-wide text-white">Neue Sitzung</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X size={16} /></button>
        </div>
        {error && <div className="mb-3 p-3 rounded-lg bg-red-900/20 border border-red-700/30 text-sm text-red-400">{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Datum *</label>
              <input type="date" value={form.datum} onChange={e => handleDatumChange(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Uhrzeit</label>
              <input type="time" value={form.startzeit} onChange={e => set('startzeit', e.target.value)} className={inputCls} />
            </div>
          </div>
          <input type="text" placeholder="Ort (optional)" value={form.ort} onChange={e => set('ort', e.target.value)} className={inputCls} />
          <textarea placeholder="Beschreibung (optional)" value={form.beschreibung} onChange={e => set('beschreibung', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm hover:text-white transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.datum}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {saving ? '…' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BeschlussModal({ beschluss, termine, onClose, onSaved }) {
  const isNew = !beschluss;
  const [form, setForm] = useState({
    titel: '', inhalt: '', datum: format(new Date(), 'yyyy-MM-dd'),
    status: 'Offen', vertraulich: false, termin_id: '', notizen: '',
    ...beschluss,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      if (isNew) await base44.entities.Beschluss.create(form);
      else await base44.entities.Beschluss.update(beschluss.id, form);
      onSaved();
    } catch (e) {
      console.error('Beschluss speichern:', e);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await base44.entities.Beschluss.delete(beschluss.id);
      onSaved();
    } catch (e) {
      console.error('Beschluss löschen:', e);
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold font-oswald uppercase tracking-wide text-white">{isNew ? 'Neuer Beschluss' : 'Beschluss bearbeiten'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <input type="text" placeholder="Titel *" value={form.titel} onChange={e => set('titel', e.target.value)} className={inputCls} />
          <textarea placeholder="Inhalt / Beschlusstext" value={form.inhalt || ''} onChange={e => set('inhalt', e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Datum *</label>
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={selectCls}>
                {['Offen','Umgesetzt','Verworfen'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Zugehörige Sitzung</label>
            <select value={form.termin_id || ''} onChange={e => set('termin_id', e.target.value)} className={selectCls}>
              <option value="">–</option>
              {termine.map(t => <option key={t.id} value={t.id}>{t.titel} ({t.datum})</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
            <input type="checkbox" checked={form.vertraulich} onChange={e => set('vertraulich', e.target.checked)} className="rounded" />
            <Lock size={12} className="text-red-400" /> Vertraulich
          </label>
        </div>
        {confirmDelete && <div className="mt-3"><DeleteBar show={true} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} deleting={deleting} /></div>}
        <div className="flex gap-2 mt-4">
          {!isNew && !confirmDelete && <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-900/30 transition-colors"><Trash2 size={16} /></button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-neutral-800 text-muted-foreground text-sm hover:text-white transition-colors">Abbrechen</button>
          <button onClick={handleSave} disabled={saving || !form.titel}
            className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-red-700 transition-colors">
            {saving ? '…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
