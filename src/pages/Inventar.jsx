import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannInventarSehn, isAdmin } from '@/lib/roles';
import { Package, Plus, Lock, ChevronRight, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
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
    setLoading(false);
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
    if (editAusruestung) {
      const updated = await base44.entities.Ausruestung.update(editAusruestung.id, form);
      setAusruestungen(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      const neu = await base44.entities.Ausruestung.create({ ...form, aktiv: true });
      setAusruestungen(prev => [...prev, neu]);
    }
    setShowAusruestungForm(false);
    setEditAusruestung(null);
  };

  const handleAusruestungDelete = async (id) => {
    await base44.entities.Ausruestung.update(id, { aktiv: false });
    setAusruestungen(prev => prev.filter(a => a.id !== id));
    setShowAusruestungForm(false);
    setEditAusruestung(null);
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
  };

  const handleAusleiheDelete = async (id) => {
    await base44.entities.Ausleihe.delete(id);
    setAusleihen(prev => prev.filter(a => a.id !== id));
    setShowAusleiheForm(false);
    setEditAusleihe(null);
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
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und berechtigte Personen.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-9 h-9 border-[3px] border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package size={22} className="text-primary" /> Inventar & Verleih
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ausruestungen.length} Gegenstände · {aktuelleAusleihen.length} aktive Ausleihen
          </p>
        </div>
        {admin && (
          <button
            onClick={() => { setEditAusruestung(null); setShowAusruestungForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Gegenstand
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5">
        {[
          { id: 'uebersicht', label: '📦 Übersicht' },
          { id: 'ausleihen', label: `📋 Ausleihen (${aktuelleAusleihen.length})` },
          { id: 'historie', label: '🕐 Historie' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
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
    'Reserviert':     'bg-blue-500/20 text-blue-400',
    'Ausgeliehen':    'bg-orange-500/20 text-orange-400',
    'Zurückgegeben':  'bg-green-500/20 text-green-400',
    'Abgesagt':       'bg-gray-500/20 text-gray-400',
  };
  const istUeberfaellig = ausleihe.bis_datum < today && ausleihe.status === 'Ausgeliehen';

  return (
    <button onClick={onClick} className={`w-full bg-card border rounded-xl p-4 text-left hover:border-primary/40 transition-all ${istUeberfaellig ? 'border-red-500/40' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{ausruestung?.name || '–'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ausleihe.ausleiher_typ === 'extern' ? '🌐' : '👤'} {ausleiherName}
            {ausleihe.zweck && ` · ${ausleihe.zweck}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            📅 {ausleihe.von_datum} → {ausleihe.bis_datum}
            {istUeberfaellig && <span className="ml-2 text-red-400 font-medium">⚠ Überfällig!</span>}
          </p>
          {ausleihe.schadensbericht && (
            <p className="text-xs text-red-400 mt-1">🔴 {ausleihe.schadensbericht}</p>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLE[ausleihe.status]}`}>
          {ausleihe.status}
        </span>
      </div>
    </button>
  );
}