import DateSelect from '../components/ui/DateSelect';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { syncVerantwortliche } from '@/lib/spartenSync';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper } from '@/lib/roles';
import {
  Calendar, Clock, MapPin, Plus, Users, Wallet, 
  Send, ChevronLeft, ChevronRight, Edit, Trash2, 
  Check, X, AlertCircle, MessageSquare, Repeat,
  Euro, UserCheck, ArrowLeft, Save, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';

export default function SpartenDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Core State
  const [gruppe, setGruppe] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [termine, setTermine] = useState([]);
  const [auslagen, setAuslagen] = useState([]);
  const [alleMitglieder, setAlleMitglieder] = useState([]);
  const [myMitglied, setMyMitglied] = useState(null);
  const [splatHistorie, setSplatHistorie] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('uebersicht');

  // Modals & Forms State
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [editingTermin, setEditingTermin] = useState(null);
  const [terminForm, setTerminForm] = useState({
    titel: '',
    typ: 'Probe',
    datum: '',
    uhrzeit: '',
    endzeit: '',
    ort: '',
    beschreibung: '',
    wiederkehrend: false,
    intervall_typ: 'woechentlich',
    enddatum: ''
  });

  const [showAuslageModal, setShowAuslageModal] = useState(false);
  const [editingAuslage, setEditingAuslage] = useState(null);
  const [auslageForm, setAuslageForm] = useState({
    mitglied_id: '',
    betrag: '',
    beschreibung: '',
    datum: '',
    typ: 'Einzelerstattung',
    notizen: '',
    selectedAnteile: {} // { mitgliedId: boolean }
  });

  const [showVerantwortlicherModal, setShowVerantwortlicherModal] = useState(false);
  const [verantwortlicheSelection, setVerantwortlicheSelection] = useState({}); // { mitgliedId: boolean }
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [savingVerantwortliche, setSavingVerantwortliche] = useState(false);

  // Spartenleiter-Historie (Admin-Bearbeitung)
  const [showHistorieModal, setShowHistorieModal] = useState(false);
  const [histEditingId, setHistEditingId] = useState(null); // null = neuer Eintrag
  const [histForm, setHistForm] = useState({ modus: 'mitglied', mitglied_id: '', mitglied_name: '', von_datum: '', bis_datum: '' });
  const [histSearchTerm, setHistSearchTerm] = useState('');
  const [savingHistorie, setSavingHistorie] = useState(false);

  const [nachrichtText, setNachrichtText] = useState('');
  const [nachrichtStatus, setNachrichtStatus] = useState(null);

  // Load Data function
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load main group
      const g = await base44.entities.Haesgruppe.get(id);
      if (!g) {
        throw new Error('Gruppe nicht gefunden.');
      }
      setGruppe(g);

      // Fetch all members to filter locally (guarantees correct inclusion across all fields)
      const allMembers = await base44.entities.Mitglied.list('nachname', 1000);
      setAlleMitglieder(allMembers);

      // Filter members belonging to this group
      const gruppenMitglieder = allMembers.filter(m => 
        !m.archiviert && (m.haesgruppe_id === id || (m.haesgruppen_ids && m.haesgruppen_ids.includes(id)))
      );
      setMitglieder(gruppenMitglieder);

      // Spartenleiter-Historie (Amtszeiten) laden — darf das Laden der
      // Gruppe niemals blockieren (z. B. wenn Entität noch nicht bereit)
      let hist = [];
      try {
        hist = await base44.entities.SpartenleiterHistorie.filter({ haesgruppe_id: id }) || [];

        // Self-Healing: Aktuelle Verantwortliche ohne offene Amtszeit nachtragen
        // (dokumentiert den Bestand, falls die Zuweisung vor Einführung der Historie erfolgte)
        if (isAdmin(user)) {
          const aktuelleV = (g.verantwortliche_ids || []).filter(vId => allMembers.some(m => m.id === vId));

          // Self-Healing (2): Profil-Konsistenz reparieren — falls der zentrale Sync
          // bei der Zuweisung nicht griff (z. B. still fehlgeschlagen), app_rolle
          // und spartenleiter_haesgruppen_ids hier nachziehen. Vorstände/Kassierer
          // werden nicht degradiert, nur einfache Mitglieder befördert.
          await Promise.all(aktuelleV.map(async vId => {
            const m = allMembers.find(x => x.id === vId);
            const ids = m.spartenleiter_haesgruppen_ids || (m.spartenleiter_haesgruppe_id ? [m.spartenleiter_haesgruppe_id] : []);
            const patch = {};
            if (!ids.includes(id)) patch.spartenleiter_haesgruppen_ids = [...new Set([...ids, id])];
            if ((m.app_rolle || 'mitglied') === 'mitglied') patch.app_rolle = 'spartenleiter';
            if (Object.keys(patch).length > 0) {
              try {
                await base44.entities.Mitglied.update(m.id, patch);
              } catch (e) {
                console.error('Self-Healing (Profil) fehlgeschlagen:', m.id, e);
              }
            }
          }));

          const fehlende = aktuelleV.filter(vId => !hist.some(h => h.mitglied_id === vId && !h.bis_datum));
          if (fehlende.length > 0) {
            const heute = new Date().toISOString();
            await Promise.all(fehlende.map(vId => {
              const m = allMembers.find(x => x.id === vId);
              return base44.entities.SpartenleiterHistorie.create({
                mitglied_id: vId,
                mitglied_name: [m.vorname, m.nachname].filter(Boolean).join(' '),
                haesgruppe_id: id,
                haesgruppe_name: g.name || '',
                von_datum: heute,
                bis_datum: '',
              }).catch(() => {});
            }));
            const erg = await base44.entities.SpartenleiterHistorie.filter({ haesgruppe_id: id });
            hist.push(...(erg || []).filter(h2 => !hist.some(h3 => h3.id === h2.id)));
          }
        }
      } catch (histErr) {
        console.warn('Spartenleiter-Historie nicht verfügbar:', histErr);
        hist = [];
      }

      setSplatHistorie([...hist].sort((a, b) => (b.von_datum || '').localeCompare(a.von_datum || '')));

      // Fetch appointments and expenses
      const t = await base44.entities.SpartenTermin.filter({ haesgruppe_id: id });
      setTermine(t || []);

      const a = await base44.entities.SpartenAuslage.filter({ haesgruppe_id: id });
      setAuslagen(a || []);

      // Current user's Mitglied record
      if (user) {
        const myMitgliedRecord = (await base44.entities.Mitglied.filter({ user_id: user.id }))[0];
        setMyMitglied(myMitgliedRecord || null);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Sparten-Dashboards:', err);
      setError(err.message || 'Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, user]);

  // Compute permissions
  const canEdit = useMemo(() => {
    if (!user || !myMitglied) return false;
    if (isAdmin(user) || user.role === 'vorstand' || user.role === 'stellv_vorstand') return true;
    if (user.role === 'spartenleiter' && myMitglied.spartenleiter_haesgruppen_ids?.includes(id)) return true;
    return false;
  }, [user, myMitglied, id]);

  // Tab 1: stats computation
  const stats = useMemo(() => {
    const mitgliederCount = mitglieder.length;
    
    // Find next upcoming appointment
    const nowStr = new Date().toISOString().split('T')[0];
    const upcoming = termine
      .filter(t => t.datum >= nowStr)
      .sort((a, b) => a.datum.localeCompare(b.datum));
    const naechsterTermin = upcoming.length > 0 ? upcoming[0].datum : 'Keiner';

    // Offene Auslagen
    const offene = auslagen.filter(a => a.status === 'Offen');
    const offeneCount = offene.length;
    const offeneSum = offene.reduce((sum, a) => sum + (Number(a.betrag) || 0), 0);

    return {
      mitgliederCount,
      naechsterTermin,
      offeneCount,
      offeneSum,
      whatsappStatus: 'Verbunden'
    };
  }, [mitglieder, termine, auslagen]);

  // Termine Handlers
  const handleOpenTerminModal = (termin = null) => {
    if (termin) {
      setEditingTermin(termin);
      setTerminForm({
        titel: termin.titel || '',
        typ: termin.typ || 'Probe',
        datum: termin.datum || '',
        uhrzeit: termin.uhrzeit || '',
        endzeit: termin.endzeit || '',
        ort: termin.ort || '',
        beschreibung: termin.beschreibung || '',
        wiederkehrend: termin.wiederkehrend || false,
        intervall_typ: termin.intervall_typ || 'woechentlich',
        enddatum: termin.enddatum || ''
      });
    } else {
      setEditingTermin(null);
      setTerminForm({
        titel: '',
        typ: 'Probe',
        datum: '',
        uhrzeit: '',
        endzeit: '',
        ort: '',
        beschreibung: '',
        wiederkehrend: false,
        intervall_typ: 'woechentlich',
        enddatum: ''
      });
    }
    setShowTerminModal(true);
  };

  const handleSaveTermin = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const payload = {
        haesgruppe_id: id,
        titel: terminForm.titel,
        typ: terminForm.typ,
        datum: terminForm.datum,
        uhrzeit: terminForm.uhrzeit,
        endzeit: terminForm.endzeit,
        ort: terminForm.ort,
        beschreibung: terminForm.beschreibung,
        wiederkehrend: terminForm.wiederkehrend,
        intervall_typ: terminForm.wiederkehrend ? terminForm.intervall_typ : undefined,
        enddatum: terminForm.wiederkehrend ? terminForm.enddatum : undefined
      };

      if (editingTermin) {
        await base44.entities.SpartenTermin.update(editingTermin.id, payload);
      } else {
        await base44.entities.SpartenTermin.create(payload);
      }
      setShowTerminModal(false);
      toast.success(editingTermin ? 'Termin aktualisiert' : 'Termin erstellt');
      loadData();
    } catch (err) {
      toast.error('Fehler beim Speichern des Termins: ' + err.message);
    }
  };

  const handleDeleteTermin = async (terminId) => {
    if (!canEdit) return;
    if (!confirm('Möchtest du diesen Termin wirklich löschen?')) return;
    try {
      await base44.entities.SpartenTermin.delete(terminId);
      toast.success('Termin gelöscht');
      loadData();
    } catch (err) {
      toast.error('Fehler beim Löschen: ' + err.message);
    }
  };
  // Auslagen Handlers
  const handleOpenAuslageModal = (auslage = null) => {
    if (auslage) {
      setEditingAuslage(auslage);
      const initialSelected = {};
      if (auslage.anteile) {
        Object.keys(auslage.anteile).forEach(mId => {
          initialSelected[mId] = true;
        });
      }
      setAuslageForm({
        mitglied_id: auslage.mitglied_id || '',
        betrag: auslage.betrag || '',
        beschreibung: auslage.beschreibung || '',
        datum: auslage.datum || '',
        typ: auslage.typ || 'Einzelerstattung',
        notizen: auslage.notizen || '',
        selectedAnteile: initialSelected
      });
    } else {
      setEditingAuslage(null);
      const defaultMitgliedId = mitglieder[0]?.id || '';
      const initialSelected = {};
      mitglieder.forEach(m => {
        initialSelected[m.id] = true;
      });

      setAuslageForm({
        mitglied_id: defaultMitgliedId,
        betrag: '',
        beschreibung: '',
        datum: new Date().toISOString().split('T')[0],
        typ: 'Einzelerstattung',
        notizen: '',
        selectedAnteile: initialSelected
      });
    }
    setShowAuslageModal(true);
  };

  const handleSaveAuslage = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      const selectedIds = Object.keys(auslageForm.selectedAnteile).filter(k => auslageForm.selectedAnteile[k]);
      
      let anteile = null;
      if (auslageForm.typ === 'Umlage' && selectedIds.length > 0) {
        const betragProPerson = Number(auslageForm.betrag) / selectedIds.length;
        anteile = {};
        selectedIds.forEach(mId => {
          anteile[mId] = {
            betrag: Number(betragProPerson.toFixed(2)),
            bezahlt: false
          };
        });
      }

      const payload = {
        haesgruppe_id: id,
        mitglied_id: auslageForm.mitglied_id,
        betrag: Number(auslageForm.betrag),
        beschreibung: auslageForm.beschreibung,
        datum: auslageForm.datum,
        typ: auslageForm.typ,
        notizen: auslageForm.notizen,
        anteile: anteile
      };

      if (editingAuslage) {
        await base44.entities.SpartenAuslage.update(editingAuslage.id, payload);
      } else {
        await base44.entities.SpartenAuslage.create(payload);
      }
      setShowAuslageModal(false);
      toast.success(editingAuslage ? 'Auslage aktualisiert' : 'Auslage erstellt');
      loadData();
    } catch (err) {
      toast.error('Fehler beim Speichern der Auslage: ' + err.message);
    }
  };

  const handleUpdateAuslageStatus = async (auslage, newStatus) => {
    if (!canEdit) return;
    try {
      await base44.entities.SpartenAuslage.update(auslage.id, {
        status: newStatus,
        erstattungsdatum: newStatus === 'Erstattet' ? new Date().toISOString().split('T')[0] : undefined
      });
      loadData();
    } catch (err) {
      toast.error('Fehler beim Aktualisieren des Status: ' + err.message);
    }
  };

  const handleToggleAnteilBezahlt = async (auslage, mitgliedId) => {
    if (!canEdit) return;
    try {
      const updatedAnteile = { ...auslage.anteile };
      if (updatedAnteile[mitgliedId]) {
        updatedAnteile[mitgliedId] = {
          ...updatedAnteile[mitgliedId],
          bezahlt: !updatedAnteile[mitgliedId].bezahlt
        };
      }
      await base44.entities.SpartenAuslage.update(auslage.id, {
        anteile: updatedAnteile
      });
      loadData();
    } catch (err) {
      toast.error('Fehler beim Aktualisieren des Umlagenstatus: ' + err.message);
    }
  };

  // Verantwortliche (Admin Assignment) Handlers
  const handleOpenVerantwortlicherModal = () => {
    const initialSelection = {};
    if (gruppe && gruppe.verantwortliche_ids) {
      gruppe.verantwortliche_ids.forEach(vId => {
        initialSelection[vId] = true;
      });
    }
    setVerantwortlicheSelection(initialSelection);
    setMemberSearchTerm('');
    setShowVerantwortlicherModal(true);
  };

  const handleSaveVerantwortliche = async () => {
    const selectedIds = Object.keys(verantwortlicheSelection).filter(k => verantwortlicheSelection[k]);
    setSavingVerantwortliche(true);
    try {
      // Zentraler Sync: Gruppe + Mitglied-Rechte + Login-Rollen
      // (haesgruppe.verantwortliche_ids, spartenleiter_haesgruppen_ids,
      //  app_rolle und verknüpfter User.role — überall konsistent)
      const alteIds = gruppe?.verantwortliche_ids?.length
        ? gruppe.verantwortliche_ids
        : (gruppe?.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
      const result = await syncVerantwortliche({
        gruppeId: id,
        alteIds,
        neueIds: selectedIds,
        mitglieder: alleMitglieder,
      });
      if (result.promoted.length > 0) {
        toast.success(`${result.promoted.length} neue Spartenleiter-Berechtigung vergeben`);
      }

      setShowVerantwortlicherModal(false);
      toast.success('Verantwortliche aktualisiert');
      loadData();
    } catch (err) {
      toast.error('Fehler beim Speichern der Verantwortlichen: ' + err.message);
    } finally {
      setSavingVerantwortliche(false);
    }
  };

  // Spartenleiter-Historie (Admin) Handlers
  const reloadHistorie = async () => {
    try {
      const hist = await base44.entities.SpartenleiterHistorie.filter({ haesgruppe_id: id }) || [];
      setSplatHistorie([...hist].sort((a, b) => (b.von_datum || '').localeCompare(a.von_datum || '')));
    } catch (err) {
      console.warn('Historie konnte nicht geladen werden:', err);
    }
  };

  const handleOpenHistorieNeu = () => {
    setHistEditingId(null);
    setHistForm({ modus: 'mitglied', mitglied_id: '', mitglied_name: '', von_datum: '', bis_datum: '' });
    setHistSearchTerm('');
    setShowHistorieModal(true);
  };

  const handleOpenHistorieEdit = (h) => {
    setHistEditingId(h.id);
    setHistForm({
      modus: h.mitglied_id ? 'mitglied' : 'freitext',
      mitglied_id: h.mitglied_id || '',
      mitglied_name: h.mitglied_name || '',
      von_datum: (h.von_datum || '').slice(0, 10),
      bis_datum: (h.bis_datum || '').slice(0, 10),
    });
    setHistSearchTerm('');
    setShowHistorieModal(true);
  };

  const handleSaveHistorieEintrag = async () => {
    let name = (histForm.mitglied_name || '').trim();
    if (histForm.modus === 'mitglied') {
      const m = alleMitglieder.find(x => x.id === histForm.mitglied_id);
      if (!m) { toast.error('Bitte ein Mitglied auswählen.'); return; }
      name = [m.vorname, m.nachname].filter(Boolean).join(' ');
    }
    if (!name) { toast.error('Bitte einen Namen eingeben.'); return; }
    if (!histForm.von_datum) { toast.error('Bitte den Anfang der Amtszeit angeben.'); return; }
    if (histForm.bis_datum && histForm.bis_datum < histForm.von_datum) {
      toast.error('Das Ende der Amtszeit liegt vor dem Anfang.');
      return;
    }
    setSavingHistorie(true);
    try {
      const data = {
        mitglied_id: histForm.modus === 'mitglied' ? histForm.mitglied_id : '',
        mitglied_name: name,
        haesgruppe_id: id,
        haesgruppe_name: gruppe?.name || '',
        von_datum: histForm.von_datum,
        bis_datum: histForm.bis_datum || '',
      };
      if (histEditingId) {
        await base44.entities.SpartenleiterHistorie.update(histEditingId, data);
      } else {
        await base44.entities.SpartenleiterHistorie.create(data);
      }
      toast.success(histEditingId ? 'Historien-Eintrag aktualisiert' : 'Historien-Eintrag hinzugefügt');
      setShowHistorieModal(false);
      reloadHistorie();
    } catch (err) {
      toast.error('Fehler beim Speichern: ' + err.message);
    } finally {
      setSavingHistorie(false);
    }
  };

  const handleDeleteHistorieEintrag = async (histId) => {
    if (!window.confirm('Diesen Historien-Eintrag wirklich löschen?')) return;
    try {
      await base44.entities.SpartenleiterHistorie.delete(histId);
      toast.success('Eintrag gelöscht');
      if (histEditingId === histId) setShowHistorieModal(false);
      reloadHistorie();
    } catch (err) {
      toast.error('Fehler beim Löschen: ' + err.message);
    }
  };

  const histFilteredMembers = useMemo(() => {
    if (!histSearchTerm.trim()) return alleMitglieder;
    const search = histSearchTerm.toLowerCase();
    return alleMitglieder.filter(m =>
      `${m.vorname} ${m.nachname}`.toLowerCase().includes(search)
    );
  }, [alleMitglieder, histSearchTerm]);

  // Tab 5: Sending notifications
  const handleSendAppNotification = async () => {
    if (!nachrichtText.trim()) return;
    try {
      setNachrichtStatus({ type: 'loading', message: 'Sende Benachrichtigungen...' });
      
      for (const m of mitglieder) {
        await base44.entities.Benachrichtigung.create({
          mitglied_id: m.id,
          titel: `Nachricht aus ${gruppe.name}`,
          nachricht: nachrichtText,
          typ: 'Info',
          gelesen: false
        });
      }

      setNachrichtStatus({ type: 'success', message: 'Erfolgreich an alle Gruppenmitglieder gesendet!' });
      setNachrichtText('');
    } catch (err) {
      setNachrichtStatus({ type: 'error', message: 'Fehler beim Senden: ' + err.message });
    }
  };

  // Filtered members list in Admin Assignment Modal
  const filteredAllMembers = useMemo(() => {
    if (!memberSearchTerm.trim()) return alleMitglieder;
    const search = memberSearchTerm.toLowerCase();
    return alleMitglieder.filter(m => 
      `${m.vorname} ${m.nachname}`.toLowerCase().includes(search)
    );
  }, [alleMitglieder, memberSearchTerm]);
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground">Lade Dashboard...</p>
      </div>
    );
  }

  if (error || !gruppe) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <AlertCircle className="w-16 h-16 text-primary mb-4" />
        <h1 className="text-2xl font-oswald uppercase tracking-wide mb-2">Fehler beim Laden</h1>
        <p className="text-muted-foreground mb-6 max-w-md">{error || 'Die Haesgruppe konnte nicht gefunden werden.'}</p>
        <button 
          onClick={() => navigate('/sparten')}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/50 text-foreground rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Zurück zur Übersicht
        </button>
      </div>
    );
  }

  const tabClass = (tab) => 
    `flex items-center gap-2 px-4 py-3 border-b-2 font-oswald uppercase tracking-wide text-sm whitespace-nowrap transition-colors ${
      activeTab === tab 
        ? 'border-primary text-primary bg-primary/5' 
        : 'border-transparent text-muted-foreground hover:text-white hover:bg-secondary/20'
    }`;

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* HEADER BAR */}
      <div className="border-b border-border bg-card sticky top-0 z-10 px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/sparten')}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              title="Zurück zu Sparten"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-2xl sm:text-3xl font-oswald uppercase tracking-wide text-white font-bold">
                  {gruppe.name}
                </h1>
                {gruppe.farbe && (
                  <span 
                    className="w-4 h-4 rounded-full border border-border inline-block" 
                    style={{ backgroundColor: gruppe.farbe }}
                    title={`Farbe: ${gruppe.farbe}`}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold font-oswald">
                  {gruppe.typ || 'Häsgruppe'}
                </span>
                {!gruppe.aktiv && (
                  <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold font-oswald">
                    Inaktiv
                  </span>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => handleOpenTerminModal()}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-foreground rounded-lg text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Termin hinzufügen
              </button>
              <button 
                onClick={() => handleOpenAuslageModal()}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/50 border border-border text-foreground rounded-lg text-sm font-semibold transition-colors"
              >
                <Euro className="w-4 h-4" /> Auslage eintragen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* HORIZONTAL SCROLLABLE TABS */}
      <div className="border-b border-border bg-card overflow-x-auto scrollbar-none">
        <div className="max-w-6xl mx-auto flex px-4 md:px-8">
          <button onClick={() => setActiveTab('uebersicht')} className={tabClass('uebersicht')}>
            <Users className="w-4 h-4" /> Übersicht
          </button>
          <button onClick={() => setActiveTab('termine')} className={tabClass('termine')}>
            <Calendar className="w-4 h-4" /> Termine
          </button>
          <button onClick={() => setActiveTab('auslagen')} className={tabClass('auslagen')}>
            <Wallet className="w-4 h-4" /> Auslagen
          </button>
          <button onClick={() => setActiveTab('mitglieder')} className={tabClass('mitglieder')}>
            <Users className="w-4 h-4" /> Mitglieder
          </button>
          <button onClick={() => setActiveTab('nachricht')} className={tabClass('nachricht')}>
            <MessageSquare className="w-4 h-4" /> Nachricht
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8">
        {/* TAB 1: ÜBERSICHT */}
        {activeTab === 'uebersicht' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:p-6">
              <div className="bg-card border border-border rounded-xl p-4 sm:p-6 md:col-span-2 space-y-4">
                <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-2">
                  Gruppen-Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider">Name</span>
                    <span className="text-white font-semibold text-base">{gruppe.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider">Typ</span>
                    <span className="text-white font-semibold text-base">{gruppe.typ || 'Häsgruppe'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider">Beschreibung</span>
                    <p className="text-white mt-1 leading-relaxed">{gruppe.beschreibung || 'Keine Beschreibung hinterlegt.'}</p>
                  </div>
                </div>

                {/* Aktuelle Verantwortliche */}
                <div className="pt-4 border-t border-border">
                  <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-2">Verantwortliche (Spartenleiter)</span>
                  {alleMitglieder.filter(m => gruppe.verantwortliche_ids?.includes(m.id)).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Keine Verantwortlichen zugewiesen.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {alleMitglieder.filter(m => gruppe.verantwortliche_ids?.includes(m.id)).map(leader => (
                        <Link key={leader.id} to={`/mitglieder/${leader.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors">
                          <UserCheck size={12} /> {leader.vorname} {leader.nachname}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {isAdmin(user) && (
                  <div className="pt-4 border-t border-border flex justify-end">
                    <button 
                      onClick={handleOpenVerantwortlicherModal}
                      className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/50 border border-border rounded-lg text-sm text-white font-semibold transition-colors"
                    >
                      <UserCheck className="w-4 h-4 text-primary" /> Verantwortliche zuweisen
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
                <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-2">
                  Verantwortliche
                </h3>
                {alleMitglieder.filter(m => gruppe.verantwortliche_ids?.includes(m.id)).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Keine Spartenleiter zugewiesen.</p>
                ) : (
                  <div className="space-y-3">
                    {alleMitglieder.filter(m => gruppe.verantwortliche_ids?.includes(m.id)).map(leader => (
                      <Link key={leader.id} to={`/mitglieder/${leader.id}`} className="flex items-center gap-3 hover:bg-secondary/30 rounded-lg p-1 -m-1 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-bold text-primary font-oswald">
                          {leader.vorname?.[0]}{leader.nachname?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{leader.vorname} {leader.nachname}</div>
                          <div className="text-xs text-muted-foreground">Spartenleiter</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Spartenleiter-Historie */}
                {(splatHistorie.length > 0 || isAdmin(user)) && (
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground block text-xs uppercase tracking-wider">Spartenleiter-Historie</span>
                      {isAdmin(user) && (
                        <button
                          onClick={handleOpenHistorieNeu}
                          className="flex items-center gap-1 text-xs text-primary hover:text-white font-semibold transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Verwalten
                        </button>
                      )}
                    </div>
                    {splatHistorie.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">Noch keine Einträge.</p>
                    )}
                    <div className="space-y-1.5">
                      {splatHistorie.map(h => {
                        const aktiv = !h.bis_datum;
                        return (
                          <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className={aktiv ? 'text-white font-semibold' : 'text-muted-foreground'}>
                              {aktiv && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />}
                              {h.mitglied_name || 'Unbekannt'}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {h.von_datum ? new Date(h.von_datum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) : '–'}
                              {' – '}
                              {aktiv ? 'heute' : (h.bis_datum ? new Date(h.bis_datum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) : '?')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-muted-foreground text-xs block uppercase tracking-wider font-semibold mb-1">Mitglieder</span>
                <span className="text-2xl sm:text-3xl font-bold text-white font-oswald">{stats.mitgliederCount}</span>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-muted-foreground text-xs block uppercase tracking-wider font-semibold mb-1">Nächster Termin</span>
                <span className="text-xl font-bold text-white font-oswald">
                  {stats.naechsterTermin !== 'Keiner' 
                    ? new Date(stats.naechsterTermin).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : 'Keiner'
                  }
                </span>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-muted-foreground text-xs block uppercase tracking-wider font-semibold mb-1">Offene Auslagen</span>
                <span className="text-2xl sm:text-3xl font-bold text-primary font-oswald">
                  {stats.offeneCount}
                </span>
                <span className="text-xs text-muted-foreground block mt-1">
                  Gesamt: {stats.offeneSum.toFixed(2)} €
                </span>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <span className="text-muted-foreground text-xs block uppercase tracking-wider font-semibold mb-1">WhatsApp-Status</span>
                <span className="text-lg font-bold text-green-500 font-oswald flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  Verbunden
                </span>
              </div>
            </div>
          </div>
        )}
        {/* TAB 2: TERMINE */}
        {activeTab === 'termine' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-oswald uppercase tracking-wide text-white">
                Spaten-Termine
              </h2>
              {canEdit && (
                <button 
                  onClick={() => handleOpenTerminModal()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Termin hinzufügen
                </button>
              )}
            </div>

            {termine.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                Keine Termine für diese Gruppe eingetragen.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...termine]
                  .sort((a, b) => b.datum.localeCompare(a.datum))
                  .map(t => {
                    let Icon = Calendar;
                    if (t.typ === 'Probe') Icon = Repeat;
                    if (t.typ === 'Besprechung') Icon = Users;

                    return (
                      <div key={t.id} className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between hover:bg-secondary/30 transition-colors">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block">
                                  {t.typ}
                                </span>
                                <h4 className="text-lg font-bold text-white leading-snug mt-0.5">{t.titel}</h4>
                              </div>
                            </div>

                            {t.wiederkehrend && (
                              <span className="text-xs bg-primary/10 border border-primary/30 text-primary px-2 py-1 rounded-full uppercase tracking-wider font-semibold font-oswald">
                                {t.intervall_typ === 'woechentlich' ? 'Wöchentlich' : t.intervall_typ === '14taegig' ? '14-tägig' : 'Monatlich'}
                              </span>
                            )}
                          </div>

                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>{new Date(t.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            </div>
                            {(t.uhrzeit || t.endzeit) && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span>{t.uhrzeit || '--:--'}{t.endzeit ? ` bis ${t.endzeit} Uhr` : ' Uhr'}</span>
                              </div>
                            )}
                            {t.ort && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span className="text-white font-medium">{t.ort}</span>
                              </div>
                            )}
                            {t.beschreibung && (
                              <p className="text-muted-foreground text-xs leading-relaxed mt-2 border-t border-border/60 pt-2 italic">
                                "{t.beschreibung}"
                              </p>
                            )}
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border/60">
                            <button 
                              onClick={() => handleOpenTerminModal(t)}
                              className="p-1.5 text-muted-foreground hover:text-white hover:bg-secondary rounded-lg transition-colors"
                              title="Termin bearbeiten"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteTermin(t.id)}
                              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                              title="Termin löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AUSLAGEN */}
        {activeTab === 'auslagen' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-oswald uppercase tracking-wide text-white">
                Umlagen & Auslagen
              </h2>
              {canEdit && (
                <button 
                  onClick={() => handleOpenAuslageModal()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Auslage eintragen
                </button>
              )}
            </div>

            {auslagen.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                Keine Auslagen oder Umlagen für diese Gruppe eingetragen.
              </div>
            ) : (
              <div className="space-y-4">
                {[...auslagen]
                  .sort((a, b) => b.datum.localeCompare(a.datum))
                  .map(a => {
                    const payer = alleMitglieder.find(m => m.id === a.mitglied_id);
                    const isUmlage = a.typ === 'Umlage';
                    
                    let totalAnteileCount = 0;
                    let paidAnteileCount = 0;
                    if (isUmlage && a.anteile) {
                      const keys = Object.keys(a.anteile);
                      totalAnteileCount = keys.length;
                      paidAnteileCount = keys.filter(k => a.anteile[k].bezahlt).map(k => a.anteile[k]).length;
                    }

                    return (
                      <div key={a.id} className="bg-card border border-border rounded-xl p-5 hover:bg-secondary/20 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-primary/10 border border-primary/30 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold font-oswald">
                                {a.typ || 'Auslage'}
                              </span>
                              
                              <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold font-oswald ${
                                a.status === 'Erstattet' 
                                  ? 'bg-green-500/10 border border-green-500/30 text-green-500' 
                                  : a.status === 'Storniert' 
                                  ? 'bg-red-500/10 border border-red-500/30 text-red-500' 
                                  : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500'
                              }`}>
                                {a.status || 'Offen'}
                              </span>
                            </div>

                            <h4 className="text-lg font-bold text-white mt-1">{a.beschreibung}</h4>
                            <div className="text-xs text-muted-foreground">
                              Verauslagt von <span className="text-white font-medium">{payer ? `${payer.vorname} ${payer.nachname}` : 'Unbekannt'}</span> am {new Date(a.datum).toLocaleDateString('de-DE')}
                            </div>
                            {a.notizen && (
                              <p className="text-xs text-muted-foreground italic mt-2">"{a.notizen}"</p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="text-2xl font-bold text-white font-oswald">
                              {Number(a.betrag).toFixed(2)} €
                            </span>
                            
                            {canEdit && (
                              <div className="flex gap-1.5 mt-2">
                                {a.status === 'Offen' && (
                                  <>
                                    <button 
                                      onClick={() => handleUpdateAuslageStatus(a, 'Erstattet')}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-600/30 rounded-lg text-xs font-semibold transition-colors"
                                    >
                                      <Check className="w-3 h-3" /> Erstattet
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateAuslageStatus(a, 'Storniert')}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/30 rounded-lg text-xs font-semibold transition-colors"
                                    >
                                      <X className="w-3 h-3" /> Stornieren
                                    </button>
                                  </>
                                )}
                                <button 
                                  onClick={() => handleOpenAuslageModal(a)}
                                  className="p-1 text-muted-foreground hover:text-white hover:bg-secondary rounded-lg transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isUmlage && a.anteile && (
                          <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <div>
                              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1">
                                <span>Umlagen-Bezahlstatus</span>
                                <span>{paidAnteileCount} von {totalAnteileCount} bezahlt</span>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-primary h-full transition-all duration-300"
                                  style={{ width: `${(paidAnteileCount / totalAnteileCount) * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {Object.keys(a.anteile).map(mId => {
                                const targetMitglied = alleMitglieder.find(m => m.id === mId);
                                const anteil = a.anteile[mId];
                                if (!targetMitglied) return null;

                                return (
                                  <div 
                                    key={mId} 
                                    className="flex items-center justify-between p-2 bg-secondary/60 rounded-lg border border-border/80 text-xs"
                                  >
                                    <span className="text-white truncate max-w-[120px]" title={`${targetMitglied.vorname} ${targetMitglied.nachname}`}>
                                      {targetMitglied.vorname} {targetMitglied.nachname[0]}.
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground font-medium">{anteil.betrag.toFixed(2)} €</span>
                                      <button
                                        disabled={!canEdit}
                                        onClick={() => handleToggleAnteilBezahlt(a, mId)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                          anteil.bezahlt 
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 hover:bg-yellow-500/20'
                                        }`}
                                      >
                                        {anteil.bezahlt ? 'Bezahlt' : 'Offen'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
        {/* TAB 4: MITGLIEDER */}
        {activeTab === 'mitglieder' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-oswald uppercase tracking-wide text-white">
                Gruppenmitglieder
              </h2>
              {isAdmin(user) && (
                <button 
                  onClick={handleOpenVerantwortlicherModal}
                  className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/50 border border-border text-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-primary" /> Verantwortliche zuweisen
                </button>
              )}
            </div>

            {mitglieder.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                Keine Mitglieder in dieser Gruppe eingetragen.
              </div>
            ) : (
              (() => {
                const STATUS_SEKTIONEN = [
                  { titel: 'Aktiv',        status: ['Aktiv'] },
                  { titel: 'Passiv',        status: ['Passiv', 'Passiv mit Häs', 'Leihäs'] },
                  { titel: 'Kinder',        status: ['Kleinkind 0-3', 'Kinder 4-10'] },
                  { titel: 'Jugendliche',   status: ['Jugendliche 11-14', 'Jungaktive 15-17'] },
                  { titel: 'Ehrenmitglieder', status: ['Ehrenmitglied'] },
                ];
                const erfassteStatus = new Set(STATUS_SEKTIONEN.flatMap(s => s.status));
                const sonstige = mitglieder.filter(m => !erfassteStatus.has(m.mitgliedsstatus) && m.mitgliedsstatus !== 'Verstorben');
                const renderMitglied = (m) => {
                  const isSplat = gruppe.verantwortliche_ids?.includes(m.id);
                  return (
                    <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center font-bold text-white font-oswald border border-border">
                          {m.vorname?.[0]}{m.nachname?.[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to={`/mitglieder/${m.id}`} className="font-semibold text-white text-sm hover:text-primary transition-colors">
                              {m.vorname} {m.nachname}
                            </Link>
                            {isSplat && (
                              <span className="text-[10px] bg-primary/15 border border-primary/40 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                Leiter
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {m.ort || 'Kein Wohnort hinterlegt'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        {m.mobiltelefon ? (
                          <span className="text-xs text-muted-foreground font-medium">{m.mobiltelefon}</span>
                        ) : m.email ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{m.email}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Keine Kontaktinfo</span>
                        )}
                      </div>
                    </div>
                  );
                };
                return (
                  <div className="space-y-6">
                    {STATUS_SEKTIONEN.map(sektion => {
                      const sm = mitglieder.filter(m => sektion.status.includes(m.mitgliedsstatus));
                      if (sm.length === 0) return null;
                      return (
                        <div key={sektion.titel}>
                          <h3 className="text-sm font-oswald uppercase tracking-wide text-muted-foreground mb-3">
                            {sektion.titel} <span className="text-muted-foreground">({sm.length})</span>
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {sm.map(renderMitglied)}
                          </div>
                        </div>
                      );
                    })}
                    {sonstige.length > 0 && (
                      <div>
                        <h3 className="text-sm font-oswald uppercase tracking-wide text-muted-foreground mb-3">
                          Weitere <span className="text-muted-foreground">({sonstige.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {sonstige.map(renderMitglied)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* TAB 5: NACHRICHT */}
        {activeTab === 'nachricht' && (
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 space-y-6">
            <h2 className="text-2xl font-oswald uppercase tracking-wide text-white border-b border-border pb-2">
              Nachricht an die Gruppe
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">Deine Nachricht</label>
                <textarea
                  rows={6}
                  value={nachrichtText}
                  onChange={(e) => setNachrichtText(e.target.value)}
                  placeholder="Schreibe hier wichtige Infos, Treffpunkte, Probe-Änderungen oder Sonstiges..."
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-4 text-white text-sm placeholder-neutral-600 transition-colors resize-none"
                />
              </div>

              {nachrichtStatus && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border text-sm ${
                  nachrichtStatus.type === 'success' 
                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                    : nachrichtStatus.type === 'error'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-primary/10 border-primary/30 text-primary'
                }`}>
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">{nachrichtStatus.type === 'loading' ? 'Bitte warten' : nachrichtStatus.type === 'success' ? 'Erfolg' : 'Fehler'}</span>
                    <span>{nachrichtStatus.message}</span>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-secondary/60 p-3 rounded-lg border border-border/80">
                Die Nachricht wird an <span className="text-white font-bold">{mitglieder.length} Gruppenmitglieder</span> adressiert. Jedes Mitglied erhält eine In-App Benachrichtigung direkt auf das Handy.
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSendAppNotification}
                  disabled={!nachrichtText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:hover:bg-primary text-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <Send className="w-4 h-4" /> An alle Gruppenmitglieder (App)
                </button>
                <button
                  onClick={() => toast.info('WhatsApp Integration wird demnächst für deine Zunft freigeschaltet!')}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-secondary hover:bg-secondary/50 border border-border text-foreground rounded-lg text-sm font-semibold transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-green-500" /> An WhatsApp-Gruppe senden
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TERMIN MODAL */}
      {showTerminModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-4 sm:p-6 relative">
            <button 
              onClick={() => setShowTerminModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-3 mb-4">
              {editingTermin ? 'Termin bearbeiten' : 'Neuer Sparten-Termin'}
            </h3>

            <form onSubmit={handleSaveTermin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Titel *</label>
                <input
                  type="text"
                  required
                  value={terminForm.titel}
                  onChange={(e) => setTerminForm({ ...terminForm, titel: e.target.value })}
                  placeholder="z.B. Marsch-Probe"
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Typ</label>
                  <select
                    value={terminForm.typ}
                    onChange={(e) => setTerminForm({ ...terminForm, typ: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  >
                    <option value="Probe">Probe</option>
                    <option value="Auftritt">Auftritt</option>
                    <option value="Besprechung">Besprechung</option>
                    <option value="Ausflug">Ausflug</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Datum *</label>
                  <DateSelect
                    required
                    value={terminForm.datum}
                    onChange={(e) => setTerminForm({ ...terminForm, datum: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Uhrzeit (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="19:00"
                    value={terminForm.uhrzeit}
                    onChange={(e) => setTerminForm({ ...terminForm, uhrzeit: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Endzeit (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="21:00"
                    value={terminForm.endzeit}
                    onChange={(e) => setTerminForm({ ...terminForm, endzeit: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ort</label>
                <input
                  type="text"
                  placeholder="z.B. Zunftheim, Frommern"
                  value={terminForm.ort}
                  onChange={(e) => setTerminForm({ ...terminForm, ort: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Beschreibung</label>
                <textarea
                  rows={2}
                  placeholder="Optionale Details zum Termin..."
                  value={terminForm.beschreibung}
                  onChange={(e) => setTerminForm({ ...terminForm, beschreibung: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors resize-none"
                />
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={terminForm.wiederkehrend}
                    onChange={(e) => setTerminForm({ ...terminForm, wiederkehrend: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary bg-background"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">Wiederkehrender Termin</span>
                </label>

                {terminForm.wiederkehrend && (
                  <div className="grid grid-cols-2 gap-4 bg-secondary/40 p-3 rounded-lg border border-border/80">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Intervall</label>
                      <select
                        value={terminForm.intervall_typ}
                        onChange={(e) => setTerminForm({ ...terminForm, intervall_typ: e.target.value })}
                        className="w-full bg-background border border-border text-white text-xs rounded-lg px-2 py-1.5"
                      >
                        <option value="woechentlich">Wöchentlich</option>
                        <option value="14taegig">14-tägig</option>
                        <option value="monatlich">Monatlich</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Enddatum</label>
                      <DateSelect
                        value={terminForm.enddatum}
                        onChange={(e) => setTerminForm({ ...terminForm, enddatum: e.target.value })}
                        className="w-full bg-background border border-border text-white text-xs rounded-lg px-2 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowTerminModal(false)}
                  className="flex-1 py-2 border border-border hover:bg-secondary text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary hover:bg-primary/80 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* AUSLAGE MODAL */}
      {showAuslageModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-4 sm:p-6 relative">
            <button 
              onClick={() => setShowAuslageModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-3 mb-4">
              {editingAuslage ? 'Auslage bearbeiten' : 'Neue Auslage eintragen'}
            </h3>

            <form onSubmit={handleSaveAuslage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Verauslagt von (Mitglied) *</label>
                <select
                  required
                  value={auslageForm.mitglied_id}
                  onChange={(e) => setAuslageForm({ ...auslageForm, mitglied_id: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                >
                  <option value="" disabled>Mitglied auswählen...</option>
                  {mitglieder.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.vorname} {m.nachname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Betrag (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={auslageForm.betrag}
                    onChange={(e) => setAuslageForm({ ...auslageForm, betrag: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Datum *</label>
                  <DateSelect
                    required
                    value={auslageForm.datum}
                    onChange={(e) => setAuslageForm({ ...auslageForm, datum: e.target.value })}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Beschreibung / Zweck *</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Notenständer, Bastelmaterial..."
                  value={auslageForm.beschreibung}
                  onChange={(e) => setAuslageForm({ ...auslageForm, beschreibung: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Typ</label>
                <select
                  value={auslageForm.typ}
                  onChange={(e) => setAuslageForm({ ...auslageForm, typ: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                >
                  <option value="Einzelerstattung">Einzelerstattung (Verein zahlt zurück)</option>
                  <option value="Umlage">Umlage (Mitglieder teilen sich Kosten)</option>
                </select>
              </div>

              {auslageForm.typ === 'Umlage' && (
                <div className="border border-border bg-secondary/40 p-4 rounded-lg space-y-3">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Beteiligte Personen auswählen
                  </span>
                  
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2">
                    {mitglieder.map(m => {
                      const isSelected = !!auslageForm.selectedAnteile[m.id];
                      return (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const updated = { ...auslageForm.selectedAnteile };
                              updated[m.id] = e.target.checked;
                              setAuslageForm({ ...auslageForm, selectedAnteile: updated });
                            }}
                            className="rounded border-border text-primary focus:ring-primary bg-background"
                          />
                          <span className="text-white truncate">
                            {m.vorname} {m.nachname}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      Gewählt: {Object.values(auslageForm.selectedAnteile).filter(Boolean).length} Personen
                    </span>
                    <span className="text-white font-bold">
                      Pro Person:{' '}
                      {Object.values(auslageForm.selectedAnteile).filter(Boolean).length > 0
                        ? (Number(auslageForm.betrag || 0) / Object.values(auslageForm.selectedAnteile).filter(Boolean).length).toFixed(2)
                        : '0.00'}{' '}
                      €
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Interne Notizen</label>
                <textarea
                  rows={2}
                  placeholder="Zusätzliche Infos, Kassennotizen..."
                  value={auslageForm.notizen}
                  onChange={(e) => setAuslageForm({ ...auslageForm, notizen: e.target.value })}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAuslageModal(false)}
                  className="flex-1 py-2 border border-border hover:bg-secondary text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary hover:bg-primary/80 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERANTWORTLICHER MODAL */}
      {showVerantwortlicherModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-4 sm:p-6 relative">
            <button 
              onClick={() => setShowVerantwortlicherModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-3 mb-4">
              Verantwortliche (Spartenleiter) zuweisen
            </h3>

            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Mitglied suchen..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-2">
                {filteredAllMembers.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Keine passenden Mitglieder gefunden.</p>
                ) : (
                  filteredAllMembers.map(m => {
                    const isChecked = !!verantwortlicheSelection[m.id];
                    return (
                      <label 
                        key={m.id} 
                        className="flex items-center justify-between p-2 rounded hover:bg-secondary/40 transition-colors cursor-pointer text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = { ...verantwortlicheSelection };
                              updated[m.id] = e.target.checked;
                              setVerantwortlicheSelection(updated);
                            }}
                            className="rounded border-border text-primary focus:ring-primary bg-background"
                          />
                          <span className="text-white font-medium">
                            {m.vorname} {m.nachname}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {m.ort || ''}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowVerantwortlicherModal(false)}
                  className="flex-1 py-2 border border-border hover:bg-secondary text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSaveVerantwortliche}
                  disabled={savingVerantwortliche}
                  className="flex-1 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {savingVerantwortliche ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Speichert…</>
                  ) : (
                    <><Save className="w-4 h-4" /> Speichern</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SPARTENLEITER-HISTORIE MODAL */}
      {showHistorieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="relative bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowHistorieModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-oswald uppercase tracking-wide text-white border-b border-border pb-3 mb-4">
              Spartenleiter-Historie
            </h3>

            {/* Formular: neuer/aktueller Eintrag */}
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => setHistForm(f => ({ ...f, modus: 'mitglied' }))}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${histForm.modus === 'mitglied' ? 'bg-primary text-white border-primary' : 'bg-secondary/50 text-muted-foreground border-border hover:text-white'}`}>
                  Mitglied
                </button>
                <button type="button"
                  onClick={() => setHistForm(f => ({ ...f, modus: 'freitext' }))}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${histForm.modus === 'freitext' ? 'bg-primary text-white border-primary' : 'bg-secondary/50 text-muted-foreground border-border hover:text-white'}`}>
                  Freitext
                </button>
              </div>

              {histForm.modus === 'mitglied' ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Mitglied suchen..."
                    value={histSearchTerm}
                    onChange={(e) => setHistSearchTerm(e.target.value)}
                    className="w-full bg-background border border-border hover:border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                  <div className="max-h-44 overflow-y-auto space-y-1 pr-2">
                    {histFilteredMembers.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-3">
                        Kein passendes Mitglied gefunden — nutze „Freitext“ für Personen ohne Datensatz.
                      </p>
                    ) : (
                      histFilteredMembers.map(m => (
                        <button type="button" key={m.id}
                          onClick={() => setHistForm(f => ({ ...f, mitglied_id: m.id }))}
                          className={`w-full flex items-center justify-between p-2 rounded transition-colors text-sm text-left ${histForm.mitglied_id === m.id ? 'bg-primary/20 border border-primary/50' : 'border border-transparent hover:bg-secondary/40'}`}>
                          <span className="text-white font-medium truncate">{m.vorname} {m.nachname}</span>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{m.archiviert ? 'Ehemalig' : (m.ort || '')}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Name (frei)</label>
                  <input
                    type="text"
                    placeholder="z. B. Max Mustermann"
                    value={histForm.mitglied_name}
                    onChange={(e) => setHistForm(f => ({ ...f, mitglied_name: e.target.value }))}
                    className="w-full bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded-lg px-3 py-2 text-white text-sm transition-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Für frühere Spartenleiter ohne Mitgliedsdatensatz (z. B. ausgetreten oder verstorben).</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Amt seit *</label>
                  <DateSelect name="von_datum" value={histForm.von_datum}
                    onChange={(e) => setHistForm(f => ({ ...f, von_datum: e.target.value }))}
                    className="w-full bg-background border border-border focus:border-primary rounded-lg px-2 py-1.5 text-white text-sm"
                    minYear={1950} maxYear={new Date().getFullYear() + 1} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Amt bis (leer = heute)</label>
                  <DateSelect name="bis_datum" value={histForm.bis_datum}
                    onChange={(e) => setHistForm(f => ({ ...f, bis_datum: e.target.value }))}
                    className="w-full bg-background border border-border focus:border-primary rounded-lg px-2 py-1.5 text-white text-sm"
                    minYear={1950} maxYear={new Date().getFullYear() + 1} />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-border">
                <button type="button" onClick={() => setShowHistorieModal(false)}
                  className="flex-1 py-2 border border-border hover:bg-secondary text-white font-semibold text-sm rounded-lg transition-colors">
                  Abbrechen
                </button>
                <button type="button" onClick={handleSaveHistorieEintrag} disabled={savingHistorie}
                  className="flex-1 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
                  {savingHistorie ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Speichert…</>
                  ) : (
                    <><Save className="w-4 h-4" /> {histEditingId ? 'Aktualisieren' : 'Hinzufügen'}</>
                  )}
                </button>
              </div>
            </div>

            {/* Bestehende Einträge verwalten */}
            <div className="mt-6 pt-4 border-t border-border">
              <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-2">Bestehende Einträge</span>
              {splatHistorie.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Noch keine Einträge.</p>
              ) : (
                <div className="space-y-1">
                  {splatHistorie.map(h => {
                    const aktiv = !h.bis_datum;
                    return (
                      <div key={h.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className={`text-sm truncate ${aktiv ? 'text-white font-semibold' : 'text-muted-foreground'}`}>
                            {aktiv && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 shrink-0" />}
                            {h.mitglied_name || 'Unbekannt'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {h.von_datum ? new Date(h.von_datum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) : '–'}
                            {' – '}
                            {aktiv ? 'heute' : (h.bis_datum ? new Date(h.bis_datum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) : '?')}
                          </span>
                          <button type="button" onClick={() => handleOpenHistorieEdit(h)}
                            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-white transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteHistorieEintrag(h.id)}
                            className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}