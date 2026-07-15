import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannInventarSehn, isAdmin } from '@/lib/roles';
import { Package, Plus, Lock, ChevronRight, Calendar, CheckCircle2, Clock, XCircle, Globe, User, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import AusruestungKarte from '@/components/inventar/AusruestungKarte';
import AusruestungForm from '@/components/inventar/AusruestungForm';
import AusleiheForm from '@/components/inventar/AusleiheForm';

export default function Inventar() {
  const { user } = useAuth();
  const hatZugriff = kannInventarSehn(user);
  const admin = isAdmin(user);

  const [ausruestungen, setAusruestungen] = useState([]);
  const [ausleihen, setAusleihen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [externePersonen, setExternePersonen] = useState([]);
  const [meinMitglied, setMeinMitglied] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('uebersicht');
  const [showAusruestungForm, setShowAusruestungForm] = useState(false);
  const [editAusruestung, setEditAusruestung] = useState(null);
  const [showAusleiheForm, setShowAusleiheForm] = useState(false);
  const [selectedAusruestung, setSelectedAusruestung] = useState(null);
  const [editAusleihe, setEditAusleihe] = useState(null);

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await base44.auth.me();
      const [a, al, ep, myMArr] = await Promise.all([
        base44.entities.Ausruestung.list('name', 200),
        base44.entities.Ausleihe.list('-von_datum', 300),
        admin ? base44.entities.ExternePerson.list('name', 200) : Promise.resolve([]),
        base44.entities.Mitglied.filter({ user_id: me?.id }),
      ]);
      setAusruestungen(a.filter(x => x.aktiv !== false));
      setAusleihen(al);
      setExternePersonen(ep);
      setMeinMitglied(myMArr[0] || null);
      // Mitgliedernamen nur für Admins laden (für Ausleiher-Anzeige und Form)
      if (admin) {
        const m = await base44.entities.Mitglied.list('nachname', 500);
        setMitglieder(m.filter(x => !x.archiviert));
      }
    } catch (err) {
      console.error(err);
      setError('Fehler beim Laden des Inventars. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  // Für jede Ausrüstung: ist sie heute ausgeliehen?
  const getAktuelleAusleihe = (ausruestungId) =>
    ausleihen.find(al =>
      al.ausruestung_id === ausruestungId &&
      al.von_datum <= today &&
      al.bis_datum >= today &&
      ['Reserviert', 'Ausgeliehen'].includes(al.status)
    );

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const getAusleiherName = (al) => {
    if (al.ausleiher_typ === 'extern') {
      const ep = externePersonen.find(p => p.id === al.ausleiher_extern_id);
      return ep ? `${ep.name}${ep.organisation ? ` (${ep.organisation})` : ''}` : '–';
    }
    return getMitgliedName(al.ausleiher_mitglied_id);
  };

  const handleAusruestungSave = async (form) => {
    setError(null);
    try {
      if (editAusruestung) {
        const updated = await base44.entities.Ausruestung.update(editAusruestung.id, form);
        setAusruestungen(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const neu = await base44.entities.Ausruestung.create({ ...form, aktiv: true });
        setAusruestungen(prev => [...prev, neu]);
      }
      setShowAusruestungForm(false);
      setEditAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern des Gegenstands.');
    }
  };

  const handleAusruestungDelete = async (id) => {
    setError(null);
    try {
      await base44.entities.Ausruestung.update(id, { aktiv: false });
      setAusruestungen(prev => prev.filter(a => a.id !== id));
      setShowAusruestungForm(false);
      setEditAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen des Gegenstands.');
    }
  };

  const handleAusleiheStart = (ausruestung) => {
    setSelectedAusruestung(ausruestung);
    setEditAusleihe(null);
    setShowAusleiheForm(true);
  };

  const handleAusleiheEdit = (ausleihe) => {
    setEditAusleihe(ausleihe);
    setSelectedAusruestung(ausruestungen.find(a => a.id === ausleihe.ausruestung_id) || null);
    setShowAusleiheForm(true);
  };

  const handleAusleihesSave = async (form) => {
    setError(null);
    try {
      if (editAusleihe) {
        const updated = await base44.entities.Ausleihe.update(editAusleihe.id, form);
        setAusleihen(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const neu = await base44.entities.Ausleihe.create({
          ...form,
          verantwortlicher_id: meinMitglied?.id || '',
        });
        setAusleihen(prev => [neu, ...prev]);
      }
      setShowAusleiheForm(false);
      setEditAusleihe(null);
      setSelectedAusruestung(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Speichern der Ausleihe.');
    }
  };

  const handleAusleiheDelete = async (id) => {
    setError(null);
    try {
      await base44.entities.Ausleihe.delete(id);
      setAusleihen(prev => prev.filter(a => a.id !== id));
      setShowAusleiheForm(false);
      setEditAusleihe(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Löschen der Ausleihe.');
    }
  };

  const aktuelleAusleihen = ausleihen.filter(al =>
    ['Reserviert', 'Ausgeliehen'].includes(al.status) && al.bis_datum >= today
  );
  const vergangeneAusleihen = ausleihen.filter(al =>
    al.status === 'Zurückgegeben' || al.bis_datum < today
  ).slice(0, 30);

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-oswald uppercase text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und berechtigte Personen.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground font-medium">Inventar wird geladen…</span>
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {error && (
        <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-red-900/20 border border-red-700/30 text-sm text-red-400">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Fehler aufgetreten</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs">Schließen</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-oswald uppercase tracking-wide text-white flex items-center gap-2">
            <Package size={22} className="text-primary" /> Inventar & Verleih
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ausruestungen.length} Gegenstände · {aktuelleAusleihen.length} aktive Ausleihen
          </p>
        </div>
        {admin && (
          <button
            onClick={() => { setEditAusruestung(null); setShowAusruestungForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Plus size={16} /> Gegenstand
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800 rounded-xl p-1 mb-5">
        {[
          { id: 'uebersicht', label: 'Übersicht', icon: Package },
          { id: 'ausleihen', label: `Ausleihen (${aktuelleAusleihen.length})`, icon: Clock },
          { id: 'historie', label: 'Historie', icon: Calendar },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-white'}`}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ÜBERSICHT */}
      {activeTab === 'uebersicht' && (
        <div className="space-y-3">
          {ausruestungen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Package size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine Gegenstände angelegt</p>
            </div>
          )}
          {ausruestungen.map(a => (
            <AusruestungKarte
              key={a.id}
              ausruestung={a}
              aktuelleAusleihe={getAktuelleAusleihe(a.id)}
              getMitgliedName={getMitgliedName}
              isAdmin={admin}
              onEdit={() => { setEditAusruestung(a); setShowAusruestungForm(true); }}
              onAusleihen={() => handleAusleiheStart(a)}
              ausleiherName={getAusleiherName(getAktuelleAusleihe(a.id) || {})}
            />
          ))}
        </div>
      )}

      {/* AKTIVE AUSLEIHEN */}
      {activeTab === 'ausleihen' && (
        <div className="space-y-2">
          {aktuelleAusleihen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Calendar size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Keine aktiven Ausleihen</p>
            </div>
          )}
          {aktuelleAusleihen.map(al => {
            const ausruestung = ausruestungen.find(a => a.id === al.ausruestung_id);
            return (
              <AusleiheKarte
                key={al.id}
                ausleihe={al}
                ausruestung={ausruestung}
                ausleiherName={getAusleiherName(al)}
                today={today}
                onClick={() => handleAusleiheEdit(al)}
              />
            );
          })}
        </div>
      )}

      {/* HISTORIE */}
      {activeTab === 'historie' && (
        <div className="space-y-2">
          {vergangeneAusleihen.length === 0 && (
            <div className="text-center py-12 bg-card border border-border rounded-xl">
              <Clock size={36} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Ausleihen</p>
            </div>
          )}
          {vergangeneAusleihen.map(al => {
            const ausruestung = ausruestungen.find(a => a.id === al.ausruestung_id);
            return (
              <AusleiheKarte
                key={al.id}
                ausleihe={al}
                ausruestung={ausruestung}
                ausleiherName={getAusleiherName(al)}
                today={today}
                onClick={() => handleAusleiheEdit(al)}
                vergangen
              />
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAusruestungForm && (
        <AusruestungForm
          ausruestung={editAusruestung}
          onSave={handleAusruestungSave}
          onDelete={handleAusruestungDelete}
          onClose={() => { setShowAusruestungForm(false); setEditAusruestung(null); }}
        />
      )}

      {showAusleiheForm && (
        <AusleiheForm
          ausleihe={editAusleihe}
          ausruestung={selectedAusruestung}
          ausruestungen={ausruestungen}
          mitglieder={mitglieder}
          ausleihen={ausleihen}
          meinMitglied={meinMitglied}
          onSave={handleAusleihesSave}
          onDelete={handleAusleiheDelete}
          onClose={() => { setShowAusleiheForm(false); setEditAusleihe(null); setSelectedAusruestung(null); }}
        />
      )}
    </div>
  );
}

function AusleiheKarte({ ausleihe, ausruestung, ausleiherName, today, onClick, vergangen }) {
  const STATUS_STYLE = {
    'Reserviert':     'bg-blue-900/20 text-blue-400 border border-blue-700/30',
    'Ausgeliehen':    'bg-primary/20 text-primary border border-primary/30',
    'Zurückgegeben':  'bg-green-900/20 text-green-400 border border-green-700/30',
    'Abgesagt':       'bg-neutral-700 text-gray-400',
  };
  const istUeberfaellig = ausleihe.bis_datum < today && ausleihe.status === 'Ausgeliehen';

  return (
    <button onClick={onClick} className={`w-full bg-card border rounded-xl p-4 text-left hover:border-primary/40 transition-all ${istUeberfaellig ? 'border-red-700/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{ausruestung?.name || '–'}</p>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {ausleihe.ausleiher_typ === 'extern' ? <Globe size={13} className="inline" /> : <User size={13} className="inline" />}
            <span className="text-white">{ausleiherName}</span>
            {ausleihe.zweck && <span className="text-white">· {ausleihe.zweck}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Calendar size={13} className="inline" />
            <span className="text-white">{ausleihe.von_datum} → {ausleihe.bis_datum}</span>
            {istUeberfaellig && (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <AlertTriangle size={12} /> Überfällig!
              </span>
            )}
          </div>
          {ausleihe.schadensbericht && (
            <div className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              <span>{ausleihe.schadensbericht}</span>
            </div>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[ausleihe.status]}`}>
          {ausleihe.status}
        </span>
      </div>
    </button>
  );
}
