import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Bus, MapPin, Clock, Calendar, Users, ChevronRight, ArrowLeft, UserPlus, CheckCircle2, Download, X } from 'lucide-react';
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

  // Registration form states for main member
  const [anzahlBegleitpersonen, setAnzahlBegleitpersonen] = useState(0);
  const [begleitpersonen, setBegleitpersonen] = useState([]);

  // Inline Fremdanmeldung form states
  const [showFremdForm, setShowFremdForm] = useState(false);
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
      const [ausfahrtRes, anmeldungenRes, mitgliederRes] = await Promise.all([
        base44.read_entities({
          entity_name: 'Ausfahrt',
          query: { id: id }
        }),
        base44.read_entities({
          entity_name: 'AusfahrtAnmeldung',
          query: { ausfahrt_id: id }
        }),
        base44.read_entities({
          entity_name: 'Mitglied'
        })
      ]);

      if (!ausfahrtRes || ausfahrtRes.length === 0) {
        setError('Ausfahrt nicht gefunden.');
      } else {
        setAusfahrt(ausfahrtRes[0]);
      }

      setAnmeldungen(anmeldungenRes || []);
      setMitglieder(mitgliederRes || []);
    } catch (err) {
      console.error('Error fetching Ausfahrt detail data:', err);
      setError('Fehler beim Laden der Ausfahrtdetails.');
    } finally {
      setLoading(false);
    }
  };

  const handleBegleitpersonenChange = (index, field, value) => {
    const updated = [...begleitpersonen];
    if (!updated[index]) updated[index] = { name: '', alter: '' };
    updated[index][field] = value;
    setBegleitpersonen(updated);
  };

  const handleFremdBegleitpersonenChange = (index, field, value) => {
    const updated = [...fremdBegleitpersonen];
    if (!updated[index]) updated[index] = { name: '', alter: '' };
    updated[index][field] = value;
    setFremdBegleitpersonen(updated);
  };

  const handleAnzahlChange = (val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setAnzahlBegleitpersonen(num);
    setBegleitpersonen(Array.from({ length: num }, (_, i) => begleitpersonen[i] || { name: '', alter: '' }));
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

  const handleRegister = async (transportType) => {
    if (!currentMitglied) {
      alert('Kein verknüpftes Mitgliedsprofil gefunden. Registrierung nicht möglich.');
      return;
    }

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const filteredBegleitpersonen = begleitpersonen.slice(0, anzahlBegleitpersonen).map(bp => ({
        name: bp.name,
        alter: parseInt(bp.alter) || null
      }));

      await base44.entities.AusfahrtAnmeldung.create({
          ausfahrt_id: id,
          mitglied_id: currentMitglied.id,
          transport: transportType,
          status: 'Angemeldet',
          angemeldet_am: todayStr,
          anzahl_begleitpersonen: anzahlBegleitpersonen,
          begleitpersonen: filteredBegleitpersonen,
          is_fremdangemeldet: false
        });

      // Reset form states and refresh
      setAnzahlBegleitpersonen(0);
      setBegleitpersonen([]);
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

  const handleExportCSV = () => {
    const activeAnmeldungen = anmeldungen.filter(a => a.status !== 'Abgemeldet');
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Name,Typ,Transport,Status,Begleitpersonen Anzahl,Begleitpersonen Details,Angemeldet Am\n';

    activeAnmeldungen.forEach(a => {
      let displayName = '';
      if (a.is_fremdangemeldet) {
        displayName = a.fremdname || 'Fremdperson';
      } else {
        const mitglied = mitglieder.find(m => m.id === a.mitglied_id);
        displayName = mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim() : 'Unbekannt';
      }

      const typeLabel = a.is_fremdangemeldet ? 'Fremdanmeldung' : 'Mitglied';
      const transport = a.transport || 'Bus';
      const status = a.status || 'Angemeldet';
      const count = a.anzahl_begleitpersonen || 0;
      
      const bpDetails = a.begleitpersonen && Array.isArray(a.begleitpersonen)
        ? a.begleitpersonen.map(p => `${p.name} (${p.alter || '?'})`).join('; ')
        : '';

      const line = `"${displayName.replace(/"/g, '""')}","${typeLabel}","${transport}","${status}",${count},"${bpDetails.replace(/"/g, '""')}","${a.angemeldet_am || ''}"`;
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

  // Sort registrations for admin view (members + non-members sorted alphabetically by name)
  const sortedRegistrations = [...activeRegistrations].sort((a, b) => {
    const nameA = a.is_fremdangemeldet ? (a.fremdname || '') : getMitgliedName(a.mitglied_id);
    const nameB = b.is_fremdangemeldet ? (b.fremdname || '') : getMitgliedName(b.mitglied_id);
    return nameA.localeCompare(nameB, 'de');
  });

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
        </div>

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
                    {ausfahrt.veranstaltungsbeginn_zeit || '--- Uhr'}
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
                    🎭 {ausfahrt.sparte_auftritt}
                  </div>
                </div>
              )}

              {ausfahrt.beschreibung && (
                <div className="mt-6 pt-6 border-t border-border">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Zusatzinformationen</span>
                  <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap">
                    {ausfahrt.beschreibung}
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
                  {ausfahrt.anmeldung_offen === false ? (
                    <div className="bg-neutral-900 border border-border rounded-xl p-4 text-center">
                      <p className="text-gray-400 text-sm font-medium">Die Anmeldung ist für diese Ausfahrt geschlossen.</p>
                    </div>
                  ) : (
                    <>
                      {/* Family members registration */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                          Familienglieder / Begleitpersonen
                        </label>
                        <select
                          value={anzahlBegleitpersonen}
                          onChange={(e) => handleAnzahlChange(e.target.value)}
                          className="w-full bg-[#121212] border border-border text-white text-sm rounded-lg p-2.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                        >
                          <option value="0">Keine Begleitpersonen</option>
                          <option value="1">1 Person</option>
                          <option value="2">2 Personen</option>
                          <option value="3">3 Personen</option>
                          <option value="4">4 Personen</option>
                        </select>
                      </div>

                      {begleitpersonen.map((bp, idx) => (
                        <div key={idx} className="space-y-2 p-3 bg-neutral-950 border border-border rounded-lg">
                          <p className="text-xs font-semibold text-gray-500">Begleitperson #{idx + 1}</p>
                          <input
                            type="text"
                            placeholder="Name"
                            value={bp.name || ''}
                            onChange={(e) => handleBegleitpersonenChange(idx, 'name', e.target.value)}
                            className="w-full bg-[#121212] border border-border text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                            required
                          />
                          <input
                            type="number"
                            placeholder="Alter"
                            value={bp.alter || ''}
                            onChange={(e) => handleBegleitpersonenChange(idx, 'alter', e.target.value)}
                            className="w-full bg-[#121212] border border-border text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </div>
                      ))}

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
                    <th className="py-3 px-4">Begleitung</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {sortedRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-gray-400">
                        Keine aktiven Anmeldungen für diese Ausfahrt gefunden.
                      </td>
                    </tr>
                  ) : (
                    sortedRegistrations.map((registration) => {
                      const isFremd = registration.is_fremdangemeldet;
                      const displayName = isFremd 
                        ? (registration.fremdname || 'Fremder Name')
                        : getMitgliedName(registration.mitglied_id);

                      return (
                        <tr key={registration.id} className="hover:bg-neutral-900/30 transition-colors">
                          <td className="py-3.5 px-4 font-medium text-white">
                            {displayName}
                            {registration.durch_admin_angemeldet && (
                              <span className="block text-[10px] text-gray-500 font-normal mt-0.5">
                                Hinzugefügt von: {registration.durch_admin_name || 'Admin'}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {isFremd ? (
                              <span className="bg-yellow-950/40 text-yellow-500 border border-yellow-800/30 px-2 py-0.5 rounded-full font-medium">
                                Extern
                              </span>
                            ) : (
                              <span className="bg-blue-950/40 text-blue-400 border border-blue-800/30 px-2 py-0.5 rounded-full font-medium">
                                Mitglied
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium">
                            {registration.transport === 'Bus' ? '🚌 Bus' : '🚗 Privat'}
                          </td>
                          <td className="py-3.5 px-4">
                            {registration.anzahl_begleitpersonen > 0 ? (
                              <div>
                                <span className="font-semibold text-white">+{registration.anzahl_begleitpersonen}</span>
                                <span className="text-gray-400 text-xs ml-1.5">
                                  ({registration.begleitpersonen?.map(p => p.name).join(', ')})
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {registration.status === 'Eingecheckt' ? (
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
                            {registration.status === 'Eingecheckt' ? (
                              <button
                                disabled
                                className="bg-neutral-800 text-gray-500 border border-border cursor-not-allowed font-semibold px-3 py-1.5 rounded-lg text-xs"
                              >
                                ✓ Eingecheckt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCheckIn(registration)}
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
      </div>
    </div>
  );
}
