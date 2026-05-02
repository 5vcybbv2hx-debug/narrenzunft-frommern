import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ArrowLeft, Plus, X, Save, Trash2, ChevronUp, ChevronDown,
  Users, ClipboardList, Vote, CheckCircle2, Circle, Clock, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const ANWESENHEIT_FARBEN = {
  'Anwesend':      'bg-green-500/20 text-green-400',
  'Entschuldigt':  'bg-yellow-500/20 text-yellow-400',
  'Unentschuldigt':'bg-red-500/20 text-red-400',
};

const TOP_STATUS_FARBEN = {
  'Offen':     'bg-yellow-500/20 text-yellow-400',
  'Besprochen':'bg-green-500/20 text-green-400',
  'Vertagt':   'bg-gray-500/20 text-gray-400',
};

const STIMME_FARBEN = {
  'Ja':         'bg-green-500/20 text-green-400 border border-green-500/30',
  'Nein':       'bg-red-500/20 text-red-400 border border-red-500/30',
  'Enthaltung': 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

export default function SitzungDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'vorstand' || user?.role === 'stellv_vorstand';
  
  // Zugriffsschutz: nur Ausschuss-Rollen
  const hatZugriff = ['vorstand', 'stellv_vorstand', 'spartenleiter', 'admin'].includes(user?.role);

  const [termin, setTermin] = useState(null);
  const [ausschussMitglieder, setAusschussMitglieder] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [anwesenheiten, setAnwesenheiten] = useState([]);
  const [tops, setTops] = useState([]);
  const [abstimmungen, setAbstimmungen] = useState([]);
  const [stimmen, setStimmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('anwesenheit');

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [t, am, m, anw, tp, abs, st] = await Promise.all([
      base44.entities.KalenderTermin.filter({ id }),
      base44.entities.AusschussMitglied.filter({ aktiv: true }),
      base44.entities.Mitglied.list('nachname', 500),
      base44.entities.SitzungsAnwesenheit.filter({ termin_id: id }),
      base44.entities.Tagesordnungspunkt.filter({ termin_id: id }),
      base44.entities.Abstimmung.filter({ termin_id: id }),
      base44.entities.AbstimmungsStimme.list('-created_date', 500),
    ]);
    setTermin(t[0] || null);
    setAusschussMitglieder(am);
    setMitglieder(m);
    setAnwesenheiten(anw);
    setTops(tp.sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0)));
    setAbstimmungen(abs);
    setStimmen(st);
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  // Anwesenheit
  const getAnwesenheit = (mitgliedId) => anwesenheiten.find(a => a.mitglied_id === mitgliedId);

  const handleAnwesenheit = async (mitgliedId, status) => {
    const vorh = getAnwesenheit(mitgliedId);
    if (vorh) {
      await base44.entities.SitzungsAnwesenheit.update(vorh.id, { status });
      setAnwesenheiten(prev => prev.map(a => a.id === vorh.id ? { ...a, status } : a));
    } else {
      const neu = await base44.entities.SitzungsAnwesenheit.create({ termin_id: id, mitglied_id: mitgliedId, status });
      setAnwesenheiten(prev => [...prev, neu]);
    }
  };

  // Anwesende für Quorum
  const anwesend = anwesenheiten.filter(a => a.status === 'Anwesend').length;
  const quorum = ausschussMitglieder.length > 0 ? Math.ceil(ausschussMitglieder.length / 2) : 0;

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und Ausschuss zugänglich.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

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
          <h1 className="text-xl font-bold text-foreground truncate">{termin.titel}</h1>
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

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5 overflow-x-auto">
        {[
          { id: 'anwesenheit', label: `👥 Anwesenheit` },
          { id: 'tops', label: `📋 TOP (${tops.length})` },
          { id: 'abstimmungen', label: `🗳️ Abstimmungen (${abstimmungen.length})` },
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
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition-all border ${status === s ? ANWESENHEIT_FARBEN[s] + ' border-current/30' : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
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
function TopsTab({ terminId, tops, setTops, mitglieder, isAdmin }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titel: '', beschreibung: '', verantwortlicher_id: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editNotizen, setEditNotizen] = useState({});

  const handleCreate = async () => {
    if (!form.titel) return;
    setSaving(true);
    const neu = await base44.entities.Tagesordnungspunkt.create({
      ...form, termin_id: terminId, reihenfolge: tops.length + 1, status: 'Offen'
    });
    setTops(prev => [...prev, neu]);
    setForm({ titel: '', beschreibung: '', verantwortlicher_id: '' });
    setShowForm(false);
    setSaving(false);
  };

  const handleStatus = async (top, status) => {
    await base44.entities.Tagesordnungspunkt.update(top.id, { status });
    setTops(prev => prev.map(t => t.id === top.id ? { ...t, status } : t));
  };

  const handleNotizen = async (top) => {
    await base44.entities.Tagesordnungspunkt.update(top.id, { notizen: editNotizen[top.id] ?? top.notizen });
    setTops(prev => prev.map(t => t.id === top.id ? { ...t, notizen: editNotizen[top.id] ?? t.notizen } : t));
  };

  const handleDelete = async (topId) => {
    await base44.entities.Tagesordnungspunkt.delete(topId);
    setTops(prev => prev.filter(t => t.id !== topId));
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
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
          <select value={form.verantwortlicher_id} onChange={e => setForm(p => ({ ...p, verantwortlicher_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="">Verantwortlich (optional)</option>
            {mitglieder.map(m => <option key={m.id} value={m.id}>{m.vorname} {m.nachname}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg bg-card text-muted-foreground text-sm border border-border">Abbrechen</button>
            <button onClick={handleCreate} disabled={saving || !form.titel}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
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
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
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
  const [form, setForm] = useState({ titel: '', beschreibung: '', angenommen_ab: 50 });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const handleCreate = async () => {
    if (!form.titel) return;
    setSaving(true);
    const neu = await base44.entities.Abstimmung.create({ ...form, termin_id: terminId, status: 'Offen' });
    setAbstimmungen(prev => [...prev, neu]);
    setForm({ titel: '', beschreibung: '', angenommen_ab: 50 });
    setShowForm(false);
    setSaving(false);
  };

  const getStimmenFuerAbstimmung = (abstimmungId) => stimmen.filter(s => s.abstimmung_id === abstimmungId);

  const handleStimme = async (abstimmungId, mitgliedId, stimme) => {
    const vorh = stimmen.find(s => s.abstimmung_id === abstimmungId && s.mitglied_id === mitgliedId);
    if (vorh) {
      await base44.entities.AbstimmungsStimme.update(vorh.id, { stimme });
      setStimmen(prev => prev.map(s => s.id === vorh.id ? { ...s, stimme } : s));
    } else {
      const neu = await base44.entities.AbstimmungsStimme.create({ abstimmung_id: abstimmungId, mitglied_id: mitgliedId, stimme });
      setStimmen(prev => [...prev, neu]);
    }
  };

  const handleAbschliessen = async (abs) => {
    const st = getStimmenFuerAbstimmung(abs.id);
    const ja = st.filter(s => s.stimme === 'Ja').length;
    const gesamt = st.filter(s => s.stimme !== 'Enthaltung').length;
    const prozent = gesamt > 0 ? (ja / gesamt) * 100 : 0;
    const ergebnis = prozent > (abs.angenommen_ab || 50) ? 'Angenommen' : 'Abgelehnt';
    await base44.entities.Abstimmung.update(abs.id, { status: 'Abgeschlossen', ergebnis });
    setAbstimmungen(prev => prev.map(a => a.id === abs.id ? { ...a, status: 'Abgeschlossen', ergebnis } : a));
  };

  const handleDelete = async (absId) => {
    if (!window.confirm('Abstimmung löschen?')) return;
    await base44.entities.Abstimmung.delete(absId);
    setAbstimmungen(prev => prev.filter(a => a.id !== absId));
  };

  return (
    <div>
      {isAdmin && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
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
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
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
                                className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${stimme?.stimme === s ? STIMME_FARBEN[s] : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'}`}>
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