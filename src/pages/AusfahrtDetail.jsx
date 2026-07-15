import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Bus, MapPin, Clock, Calendar, Users, ChevronRight, ArrowLeft, UserPlus, CheckCircle2, Download, X, Pencil, Trash2, Ban, AlertTriangle, QrCode, ScanLine } from 'lucide-react';
import AusfahrtEditModal from '@/components/ausfahrt/AusfahrtEditModal';
import { format, parseISO, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AusfahrtDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ausfahrt, setAusfahrt] = useState(null);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sparten, setSparten] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showBusVwModal, setShowBusVwModal] = useState(false);
  const [selectedBusVw, setSelectedBusVw] = useState([]);

  // Inline Fremdanmeldung form states
  const [showFremdForm, setShowFremdForm] = useState(false);
  const [verwandtschaften, setVerwandtschaften] = useState([]);
  const [ausgewaehlteFamilienmitglieder, setAusgewaehlteFamilienmitglieder] = useState([]);
  const [fremdName, setFremdName] = useState('');
  const [fremdTransport, setFremdTransport] = useState('Bus');
  const [fremdAnzahlBegleitpersonen, setFremdAnzahlBegleitpersonen] = useState(0);
  const [fremdBegleitpersonen, setFremdBegleitpersonen] = useState([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Load Ausfahrt, Anmeldungen, and Mitglieder in parallel
      const [ausfahrtRes, anmeldungenRes, mitgliederRes, spartenRes] = await Promise.all([
        base44.entities.Ausfahrt.get(id),
        base44.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: id }),
        base44.entities.Mitglied.list('-nachname', 500),
        base44.entities.Haesgruppe.list('name', 200)
      ]);

      // Verwandtschaft des aktuellen Mitglieds laden
      let verwandt = [];
      try {
        verwandt = await base44.entities.Verwandtschaft.list('mitglied_id', 500);
      } catch (e) {
        console.error('Verwandtschaft laden:', e);
      }

      if (!ausfahrtRes) {
        setError('Ausfahrt nicht gefunden.');
      } else {
        setAusfahrt(ausfahrtRes);
      }

      setAnmeldungen(anmeldungenRes || []);
      setMitglieder(mitgliederRes || []);
      setSparten(spartenRes || []);
      setVerwandtschaften(verwandt || []);
    } catch (err) {
      console.error('Error fetching Ausfahrt detail data:', err);
      setError('Fehler beim Laden der Ausfahrtdetails.');
    } finally {
      setLoading(false);
    }
  };

  const handleFremdBegleitpersonenChange = (index, field, value) => {
    const updated = [...fremdBegleitpersonen];
    if (!updated[index]) updated[index] = { name: '', alter: '' };
    updated[index][field] = value;
    setFremdBegleitpersonen(updated);
  };

  const handleFremdAnzahlChange = (val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setFremdAnzahlBegleitpersonen(num);
    setFremdBegleitpersonen(Array.from({ length: num }, (_, i) => fremdBegleitpersonen[i] || { name: '', alter: '' }));
  };

  // Find membership registration
  const currentMitglied = mitglieder.find(m => m.user_id === user?.id || m.email === user?.email);
  const myRegistration = currentMitglied 
    ? anmeldungen.find(a => a.mitglied_id === currentMitglied.id && a.status !== 'Abgemeldet')
    : null;

  // Ist aktueller User Busverantwortlicher?
  const isBusverantwortlicher = ausfahrt?.bus_verantwortliche?.includes(currentMitglied?.id);
  const kannScannen = isAdmin(user) || isBusverantwortlicher;

  // Familienmitglieder des aktuellen Mitglieds (nur Ehepartner/in und Kind)
  const familienmitglieder = currentMitglied
    ? verwandtschaften
        .filter(v => v.mitglied_id === currentMitglied.id && ['Ehepartner/in', 'Kind'].includes(v.beziehung))
        .map(v => {
          const verwandtesMitglied = mitglieder.find(m => m.id === v.verwandter_id);
          return {
            id: v.verwandter_id,
            name: verwandtesMitglied ? `${verwandtesMitglied.vorname || ''} ${verwandtesMitglied.nachname || ''}`.trim() : 'Unbekannt',
            beziehung: v.beziehung,
            alter: verwandtesMitglied?.geburtsdatum ? (() => {
              try {
                const bd = new Date(verwandtesMitglied.geburtsdatum);
                const diff = Date.now() - bd.getTime();
                return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
              } catch { return null; }
            })() : null
          };
        })
    : [];

  const toggleFamilienmitglied = (mitgliedId) => {
    setAusgewaehlteFamilienmitglieder(prev =>
      prev.includes(mitgliedId)
        ? prev.filter(id => id !== mitgliedId)
        : [...prev, mitgliedId]
    );
  };

  const handleRegister = async (transportType) => {
    if (!currentMitglied) {
      alert('Kein verknüpftes Mitgliedsprofil gefunden. Registrierung nicht möglich.');
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const selectedBegleitpersonen = familienmitglieder
        .filter(fm => ausgewaehlteFamilienmitglieder.includes(fm.id))
        .map(fm => ({
          name: fm.name,
          alter: fm.alter,
          mitglied_id: fm.id
        }));

      await base44.entities.AusfahrtAnmeldung.create({
          ausfahrt_id: id,
          mitglied_id: currentMitglied.id,
          transport: transportType,
          status: 'Angemeldet',
          angemeldet_am: todayStr,
          anzahl_begleitpersonen: selectedBegleitpersonen.length,
          begleitpersonen: selectedBegleitpersonen,
          is_fremdangemeldet: false
        });

      // Reset form states and refresh
      setAusgewaehlteFamilienmitglieder([]);
      fetchData();
    } catch (err) {
      console.error('Error during registration:', err);
      alert('Registrierung fehlgeschlagen.');
    }
  };

  const handleDeregister = async () => {
    if (!myRegistration) return;

    const ausfahrtDate = ausfahrt?.datum ? parseISO(ausfahrt.datum) : new Date();
    const diffDays = differenceInDays(ausfahrtDate, new Date());

    if (diffDays < 3) {
      alert('Abmeldung ist nur bis 3 Tage vor der Ausfahrt möglich.');
      return;
    }

    if (!confirm('Möchtest du dich wirklich von dieser Ausfahrt abmelden?')) {
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await base44.entities.AusfahrtAnmeldung.update(myRegistration.id, {
          status: 'Abgemeldet',
          abgemeldet_am: todayStr
        });
      fetchData();
    } catch (err) {
      console.error('Error during deregistration:', err);
      alert('Abmeldung fehlgeschlagen.');
    }
  };

  const handleFremdanmeldung = async (e) => {
    e.preventDefault();
    if (!fremdName.trim()) {
      alert('Bitte geben Sie einen Namen ein.');
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const filteredFremdBegleitpersonen = fremdBegleitpersonen.slice(0, fremdAnzahlBegleitpersonen).map(bp => ({
        name: bp.name,
        alter: parseInt(bp.alter) || null
      }));

      await base44.entities.AusfahrtAnmeldung.create({
          ausfahrt_id: id,
          mitglied_id: null,
          transport: fremdTransport,
          status: 'Angemeldet',
          angemeldet_am: todayStr,
          anzahl_begleitpersonen: fremdAnzahlBegleitpersonen,
          begleitpersonen: filteredFremdBegleitpersonen,
          is_fremdangemeldet: true,
          fremdname: fremdName,
          durch_admin_angemeldet: true,
          durch_admin_name: user?.full_name || user?.email || 'Admin'
        });

      // Reset form and refresh
      setFremdName('');
      setFremdTransport('Bus');
      setFremdAnzahlBegleitpersonen(0);
      setFremdBegleitpersonen([]);
      setShowFremdForm(false);
      fetchData();
    } catch (err) {
      console.error('Error during Fremdanmeldung:', err);
      alert('Fremdanmeldung fehlgeschlagen.');
    }
  };

  const handleCheckIn = async (registration) => {
    try {
      const nowIso = new Date().toISOString();
      await base44.entities.AusfahrtAnmeldung.update(registration.id, {
          status: 'Eingecheckt',
          eingecheckt_am: nowIso,
          eingecheckt_von: user?.full_name || user?.email || 'Admin'
        });
      fetchData();
    } catch (err) {
      console.error('Error during check-in:', err);
      alert('Check-in fehlgeschlagen.');
    }
  };

  const handleBegleitpersonCheckIn = async (parentId, begleitIndex) => {
    try {
      const parent = anmeldungen.find(a => a.id === parentId);
      if (!parent || !parent.begleitpersonen) return;
      const updatedBp = [...parent.begleitpersonen];
      if (!updatedBp[begleitIndex]) return;
      updatedBp[begleitIndex] = {
        ...updatedBp[begleitIndex],
        eingecheckt: !updatedBp[begleitIndex].eingecheckt,
        eingecheckt_am: new Date().toISOString(),
        eingecheckt_von: user?.full_name || user?.email || 'Admin'
      };
      await base44.entities.AusfahrtAnmeldung.update(parentId, {
        begleitpersonen: updatedBp
      });
      fetchData();
    } catch (err) {
      console.error('Error during Begleitperson check-in:', err);
      alert('Check-in fehlgeschlagen.');
    }
  };

  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Name,Typ,Transport,Status,Angemeldet Am\n';

    sortedRegistrations.forEach(entry => {
      const typeLabel = entry.isFremd ? 'Extern' : entry.isBegleitperson ? 'Begleitung' : 'Mitglied';
      const transport = entry.transport || 'Bus';
      const status = entry.status || 'Angemeldet';
      const parent = anmeldungen.find(a => a.id === entry.parentId);
      const angemeldetAm = parent?.angemeldet_am || '';
      const line = `"${entry.name.replace(/"/g, '""')}","${typeLabel}","${transport}","${status}","${angemeldetAm}"`;
      csvContent += line + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Anmeldungen_Ausfahrt_${id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAbsagen = async () => {
    if (!confirm('Soll diese Ausfahrt wirklich abgesagt werden? Alle Anmeldungen bleiben erhalten, aber die Ausfahrt wird als abgesagt markiert.')) return;
    try {
      await base44.entities.Ausfahrt.update(id, { status: 'Abgesagt' });
      fetchData();
    } catch (err) {
      alert('Absagen fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
    }
  };

  const handleDelete = async () => {
    try {
      // Zuerst alle verknüpften Anmeldungen löschen
      const relatedAnmeldungen = await base44.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: id });
      if (relatedAnmeldungen && relatedAnmeldungen.length > 0) {
        await base44.entities.AusfahrtAnmeldung.deleteMany({ ausfahrt_id: id });
      }
      await base44.entities.Ausfahrt.delete(id);
      navigate('/ausfahrten');
    } catch (err) {
      alert('Löschen fehlgeschlagen: ' + (err?.message || 'Unbekannter Fehler'));
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-400 font-medium">Ausfahrt wird geladen…</p>
      </div>
    );
  }

  if (error || !ausfahrt) {
    return (
      <div className="min-h-[60vh] p-6">
        <div className="max-w-4xl mx-auto">
          <Link to="/ausfahrten" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Übersicht
          </Link>
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium mb-4">{error || 'Ausfahrt nicht gefunden.'}</p>
            <Link to="/ausfahrten" className="bg-primary hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors">
              Zurück zu den Ausfahrten
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active registrations calculations
  const activeRegistrations = anmeldungen.filter(a => a.status !== 'Abgemeldet');
  const busPassengersCount = activeRegistrations
    .filter(a => a.transport === 'Bus')
    .reduce((sum, current) => sum + 1 + (current.anzahl_begleitpersonen || 0), 0);

  const capacityLimit = ausfahrt.bus_kapazitaet || 50;
  const progressPercentage = Math.min(100, (busPassengersCount / capacityLimit) * 100);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'EEEE, d. MMMM yyyy', { locale: de });
    } catch {
      return dateStr;
    }
  };

  const getMitgliedName = (mitgliedId) => {
    const mitglied = mitglieder.find(m => m.id === mitgliedId);
    return mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim() : 'Unbekanntes Mitglied';
  };

  // Flatten registrations: Hauptmitglied + jede Begleitperson als eigener Eintrag
  const flatRegistrations = [];
  activeRegistrations.forEach(reg => {
    const mainName = reg.is_fremdangemeldet
      ? (reg.fremdname || 'Fremder Name')
      : getMitgliedName(reg.mitglied_id);
    // Hauptperson
    flatRegistrations.push({
      id: reg.id,
      parentId: reg.id,
      name: mainName,
      isFremd: reg.is_fremdangemeldet,
      isBegleitperson: false,
      begleitIndex: -1,
      transport: reg.transport,
      status: reg.status,
      durchAdmin: reg.durch_admin_angemeldet,
      durchAdminName: reg.durch_admin_name,
      beziehung: null
    });
    // Begleitpersonen als eigene Einträge
    if (reg.begleitpersonen && Array.isArray(reg.begleitpersonen)) {
      reg.begleitpersonen.forEach((bp, idx) => {
        flatRegistrations.push({
          id: `${reg.id}_bp_${idx}`,
          parentId: reg.id,
          name: bp.name || 'Unbekannt',
          isFremd: reg.is_fremdangemeldet,
          isBegleitperson: true,
          begleitIndex: idx,
          transport: reg.transport,
          status: bp.eingecheckt ? 'Eingecheckt' : reg.status,
          durchAdmin: reg.durch_admin_angemeldet,
          durchAdminName: reg.durch_admin_name,
          beziehung: bp.beziehung || null,
          alter: bp.alter || null
        });
      });
    }
  });

  // Sort by name
  const sortedRegistrations = flatRegistrations.sort((a, b) =>
    a.name.localeCompare(b.name, 'de')
  );

  const isDeregisterAvailable = myRegistration && (
    ausfahrt.datum ? differenceInDays(parseISO(ausfahrt.datum), new Date()) >= 3 : false
  );

  return (
    <div className="min-h-[60vh] pb-12">
      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Back Link */}
        <Link to="/ausfahrten" className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zu allen Ausfahrten
        </Link>

        {/* Hero Card */}
        <div className="bg-card border border-border rounded-xl p-6 md:p-8 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-block bg-primary/20 text-primary border border-primary/30 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 uppercase tracking-wider">
                {ausfahrt.typ || 'Ausfahrt'}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold font-oswald tracking-wide uppercase text-white mb-2">
                {ausfahrt.titel}
              </h1>
              <p className="text-gray-400 flex items-center text-sm md:text-base">
                <Calendar className="w-4 h-4 mr-2 text-primary" />
                {formatDisplayDate(ausfahrt.datum)}
              </p>
              {ausfahrt.ort && (
                <p className="text-gray-400 flex items-center text-sm md:text-base mt-1">
                  <MapPin className="w-4 h-4 mr-2 text-primary" />
                  {ausfahrt.ort}
                </p>
              )}
            </div>
            
            {/* Bus Capacity Progress */}
            <div className="bg-[#121212] border border-border p-4 rounded-xl min-w-[240px]">
              <div className="flex justify-between text-sm mb-1.5 font-medium">
                <span className="text-gray-400">Bus-Auslastung:</span>
                <span className="text-white">{busPassengersCount} / {capacityLimit} Plätze</span>
              </div>
              <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Admin Action Buttons */}
          {isAdmin(user) && (
            <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-border">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Pencil size={14} /> Bearbeiten
              </button>
              {ausfahrt.status !== 'Abgesagt' && (
                <button
                  onClick={handleAbsagen}
                  className="inline-flex items-center gap-2 bg-yellow-900/30 hover:bg-yellow-900/50 text-yellow-400 border border-yellow-700/40 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <Ban size={14} /> Absagen
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedBusVw(ausfahrt.bus_verantwortliche || []);
                  setShowBusVwModal(true);
                }}
                className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Users size={14} /> Busverantwortliche
              </button>
              {kannScannen && (
                <a
                  href={\`/ausfahrten/\${id}/scanner\`}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <ScanLine size={14} /> QR-Scanner
                </a>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-700/40 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={14} /> Löschen
              </button>
            </div>
          )}
        </div>

        {/* Abgesagt Banner */}
        {ausfahrt.status === 'Abgesagt' && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 mb-6 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-red-400 font-semibold text-sm">Diese Ausfahrt wurde abgesagt.</p>
              <p className="text-red-300/60 text-xs mt-0.5">Alle Anmeldungen bleiben bestehen, aber die Ausfahrt findet nicht statt.</p>
            </div>
          </div>
        )}

        {/* Info Grid & Registration Column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Main Info Box */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold font-oswald uppercase tracking-wider border-b border-border pb-3 mb-4">
                Ablauf & Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Abfahrt</h3>
                  <p className="text-white font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary shrink-0" />
                    {ausfahrt.abfahrt_zeit || '--- Uhr'}
                  </p>
                  <p className="text-gray-400 text-sm ml-6 mt-0.5">
                    {ausfahrt.abfahrt_ort || '---'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Veranstaltungsbeginn</h3>
                  <p className="text-white font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary shrink-0" />
                    {ausfahrt.veranstaltungsbeginn || '--- Uhr'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rückfahrt</h3>
                  <p className="text-white font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-primary shrink-0" />
                    {ausfahrt.rueckfahrt_zeit || '--- Uhr'}
                  </p>
                </div>

                {ausfahrt.aufstellung && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Aufstellung</h3>
                    <p className="text-white font-medium">
                      {ausfahrt.aufstellung}
                    </p>
                  </div>
                )}

                {ausfahrt.startnummer && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Startnummer</h3>
                    <p className="text-white font-medium bg-neutral-800/50 inline-block px-3 py-1 rounded border border-border text-sm">
                      #{ausfahrt.startnummer}
                    </p>
                  </div>
                )}

                {ausfahrt.busparkplatz && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Busparkplatz</h3>
                    <p className="text-white font-medium flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-primary shrink-0" />
                      {ausfahrt.busparkplatz}
                    </p>
                  </div>
                )}
              </div>

              {ausfahrt.sparte_auftritt && (
                <div className="mt-6 pt-6 border-t border-border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Sparte mit Auftritt</span>
                  <div className="inline-block bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
                    🎭 {sparten.find(s => s.id === ausfahrt.sparte_id)?.name || 'Auftritt'}
                  </div>
                </div>
              )}

              {ausfahrt.notizen && (
                <div className="mt-6 pt-6 border-t border-border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Zusatzinformationen</span>
                  <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                    {ausfahrt.notizen}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Registration Section */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold font-oswald uppercase tracking-wider border-b border-border pb-3 mb-4">
                Anmeldung
              </h2>

              {myRegistration ? (
                // Already registered
                <div className="space-y-4">
                  <div className="bg-green-950/20 border border-green-800/40 p-4 rounded-xl">
                    <p className="text-sm text-green-400 font-semibold mb-1 flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Du bist angemeldet!
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      <span className="font-medium text-gray-300">Transport:</span> {myRegistration.transport === 'Bus' ? '🚌 Mit dem Bus' : '🚗 Privat'}
                    </p>
                    {myRegistration.anzahl_begleitpersonen > 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        <span className="font-medium text-gray-300">Begleitpersonen ({myRegistration.anzahl_begleitpersonen}):</span>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          {myRegistration.begleitpersonen?.map((bp, i) => (
                            <li key={i}>{bp.name} {bp.alter ? `(${bp.alter} Jahre)` : ''}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* QR Code Button */}
                  <button
                    onClick={() => setShowQR(true)}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-primary" /> Mein QR-Code anzeigen
                  </button>

                  {isDeregisterAvailable ? (
                    <button
                      onClick={handleDeregister}
                      className="w-full bg-transparent hover:bg-neutral-900 border border-red-500/50 hover:border-red-500 text-red-500 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                    >
                      Abmelden
                    </button>
                  ) : (
                    <p className="text-xs text-gray-500 text-center italic">
                      Abmeldung ist nur bis 3 Tage vor der Ausfahrt möglich.
                    </p>
                  )}
                </div>
              ) : (
                // Not registered yet
                <div className="space-y-4">
                  {ausfahrt.status !== 'Anmeldung offen' ? (
                    <div className="bg-neutral-900 border border-border rounded-xl p-4 text-center">
                      <p className="text-gray-400 text-sm font-medium">Die Anmeldung ist für diese Ausfahrt geschlossen.</p>
                    </div>
                  ) : (
                    <>
                      {/* Familienmitglieder als Begleitpersonen — nur Ehepartner/in und Kind */}
                      {familienmitglieder.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Familienmitglieder / Begleitpersonen
                          </label>
                          <div className="space-y-2">
                            {familienmitglieder.map(fm => (
                              <label
                                key={fm.id}
                                className="flex items-center gap-3 p-3 bg-neutral-950 border border-border rounded-lg cursor-pointer hover:border-primary/40 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={ausgewaehlteFamilienmitglieder.includes(fm.id)}
                                  onChange={() => toggleFamilienmitglied(fm.id)}
                                  className="w-4 h-4 rounded accent-[#EA2525]"
                                />
                                <div className="flex-1">
                                  <p className="text-sm text-white font-medium">{fm.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {fm.beziehung}
                                    {fm.alter ? ` · ${fm.alter} Jahre` : ''}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 grid grid-cols-1 gap-2.5">
                        <button
                          onClick={() => handleRegister('Bus')}
                          className="w-full bg-primary hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Bus className="w-4 h-4" /> Mit Bus fahren
                        </button>
                        <button
                          onClick={() => handleRegister('Privat')}
                          className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
                        >
                          Privat fahren
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Admin section */}
        {isAdmin(user) && (
          <div className="bg-card border border-border rounded-xl p-6 mt-8">
            <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-bold font-oswald uppercase tracking-wider text-white">
                  Mitgliederverwaltung & Check-in
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  Verwalte Anmeldungen, trage externe Personen ein und exportiere Listen.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFremdForm(!showFremdForm)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Fremdperson anmelden
                </button>
                <button
                  onClick={handleExportCSV}
                  className="bg-primary hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> CSV Export
                </button>
              </div>
            </div>

            {/* Inline Fremdanmeldung form */}
            {showFremdForm && (
              <form onSubmit={handleFremdanmeldung} className="bg-[#121212] border border-border rounded-xl p-5 mb-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <span className="font-semibold text-sm">Fremdperson hinzufügen (Nicht-App-User)</span>
                  <button type="button" onClick={() => setShowFremdForm(false)} className="text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Voller Name</label>
                    <input
                      type="text"
                      value={fremdName}
                      onChange={(e) => setFremdName(e.target.value)}
                      placeholder="z.B. Max Mustermann"
                      className="w-full bg-[#1c1c1c] border border-border text-white text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-primary focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Transportart</label>
                    <select
                      value={fremdTransport}
                      onChange={(e) => setFremdTransport(e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-border text-white text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="Bus">Busfahrt</option>
                      <option value="Privat">Privatfahrt</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Begleitpersonen Anzahl</label>
                    <select
                      value={fremdAnzahlBegleitpersonen}
                      onChange={(e) => handleFremdAnzahlChange(e.target.value)}
                      className="w-full bg-[#1c1c1c] border border-border text-white text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="0">Keine</option>
                      <option value="1">1 Person</option>
                      <option value="2">2 Personen</option>
                      <option value="3">3 Personen</option>
                    </select>
                  </div>
                </div>

                {fremdBegleitpersonen.map((bp, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-neutral-900 border border-border rounded-lg">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Begleitung #{idx+1} Name</label>
                      <input
                        type="text"
                        placeholder="Name"
                        value={bp.name || ''}
                        onChange={(e) => handleFremdBegleitpersonenChange(idx, 'name', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-border text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Begleitung #{idx+1} Alter</label>
                      <input
                        type="number"
                        placeholder="Alter"
                        value={bp.alter || ''}
                        onChange={(e) => handleFremdBegleitpersonenChange(idx, 'alter', e.target.value)}
                        className="w-full bg-[#1c1c1c] border border-border text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFremdForm(false)}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                  >
                    Eintragen
                  </button>
                </div>
              </form>
            )}

            {/* Registrations List / Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Anmeldetyp</th>
                    <th className="py-3 px-4">Transport</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {sortedRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-gray-400">
                        Keine aktiven Anmeldungen für diese Ausfahrt gefunden.
                      </td>
                    </tr>
                  ) : (
                    sortedRegistrations.map((entry) => {
                      return (
                        <tr key={entry.id} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-white">
                            {entry.name}
                            {entry.isBegleitperson && entry.beziehung && (
                              <span className="ml-2 text-xs text-gray-500 font-normal">
                                ({entry.beziehung}{entry.alter ? `, ${entry.alter} J.` : ''})
                              </span>
                            )}
                            {entry.durchAdmin && (
                              <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                                Hinzugefügt von: {entry.durchAdminName || 'Admin'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {entry.isFremd ? (
                              <span className="bg-yellow-950/40 text-yellow-500 border border-yellow-800/30 px-2 py-0.5 rounded-full font-medium">
                                Extern
                              </span>
                            ) : entry.isBegleitperson ? (
                              <span className="bg-purple-950/40 text-purple-400 border border-purple-800/30 px-2 py-0.5 rounded-full font-medium">
                                Begleitung
                              </span>
                            ) : (
                              <span className="bg-blue-950/40 text-blue-400 border border-blue-800/30 px-2 py-0.5 rounded-full font-medium">
                                Mitglied
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            {entry.transport === 'Bus' ? '🚌 Bus' : '🚗 Privat'}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {entry.status === 'Eingecheckt' ? (
                              <span className="bg-green-950/40 text-green-400 border border-green-800/30 px-2.5 py-1 rounded-full font-semibold flex items-center w-fit gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Eingecheckt
                              </span>
                            ) : (
                              <span className="bg-neutral-800 text-gray-300 border border-border px-2.5 py-1 rounded-full font-medium">
                                Angemeldet
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {entry.status === 'Eingecheckt' ? (
                              <button
                                onClick={() => entry.isBegleitperson
                                  ? handleBegleitpersonCheckIn(entry.parentId, entry.begleitIndex)
                                  : null}
                                disabled={!entry.isBegleitperson}
                                className={`${entry.isBegleitperson ? 'bg-transparent hover:bg-neutral-900 text-yellow-500 border border-yellow-500/40' : 'bg-neutral-800 text-gray-500 border border-border cursor-not-allowed'} font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors`}
                              >
                                {entry.isBegleitperson ? 'Auschecken' : '✓ Eingecheckt'}
                              </button>
                            ) : (
                              <button
                                onClick={() => entry.isBegleitperson
                                  ? handleBegleitpersonCheckIn(entry.parentId, entry.begleitIndex)
                                  : handleCheckIn({ id: entry.parentId })}
                                className="bg-primary hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors"
                              >
                                Einchecken
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <AusfahrtEditModal
            ausfahrt={ausfahrt}
            sparten={sparten}
            onSave={() => { setShowEditModal(false); fetchData(); }}
            onClose={() => setShowEditModal(false)}
          />
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-900/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="font-oswald font-semibold text-foreground text-lg">Ausfahrt löschen?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Möchtest du <strong className="text-foreground">"{ausfahrt.titel}"</strong> unwiderruflich löschen?
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                Alle Anmeldungen ({anmeldungen.length}) werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium hover:text-foreground transition-colors">
                  Abbrechen
                </button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors">
                  Löschen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQR && myRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowQR(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-oswald uppercase tracking-wider text-white">Dein Check-in QR</h3>
              <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4 text-center">
              Zeige diesen Code dem Busverantwortlichen beim Einsteigen.
            </p>
            <div className="flex justify-center mb-4">
              <img
                src={\`https://api.qrserver.com/v1/create-qr-code/?size=250x250&bgcolor=ffffff&data=\${encodeURIComponent(myRegistration.id)}\`}
                alt="QR Code"
                className="rounded-xl"
              />
            </div>
            <p className="text-center text-sm text-gray-300 font-medium">{getMitgliedName(myRegistration.mitglied_id)}</p>
            {myRegistration.transport && (
              <p className="text-center text-xs text-gray-500 mt-1">
                {myRegistration.transport === 'Bus' ? '🚌 Bus' : '🚗 Privat'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Busverantwortliche Modal */}
      {showBusVwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowBusVwModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold font-oswald uppercase tracking-wider text-white">Busverantwortliche</h3>
              <button onClick={() => setShowBusVwModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Wähle Mitglieder, die den QR-Check-in durchführen dürfen.
            </p>
            <div className="space-y-2 mb-4">
              {mitglieder.filter(m => m.mitgliedsstatus === 'Aktiv').sort((a,b) => (a.nachname||'').localeCompare(b.nachname||'')).map(m => (
                <label key={m.id} className="flex items-center gap-3 p-2.5 bg-neutral-900 border border-border rounded-lg cursor-pointer hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={selectedBusVw.includes(m.id)}
                    onChange={() => setSelectedBusVw(prev =>
                      prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                    )}
                    className="w-4 h-4 accent-[#EA2525]"
                  />
                  <span className="text-sm text-white">{m.vorname || ''} {m.nachname || ''}</span>
                </label>
              ))}
            </div>
            <button
              onClick={saveBusVerantwortliche}
              className="w-full bg-primary hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              Speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
