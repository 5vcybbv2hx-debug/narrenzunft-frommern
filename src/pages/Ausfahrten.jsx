import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { Bus, Plus, MapPin, Clock, Calendar, Users, ChevronRight, Search } from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, isBefore, isAfter } from 'date-fns';
import { de } from 'date-fns/locale';

export default function Ausfahrten() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ausfahrten, setAusfahrten] = useState([]);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [mitglied, setMitglied] = useState(null);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Kommend'); // 'Alle', 'Umzug', 'Veranstaltung', 'Kommend', 'Vergangen'
  const [submittingId, setSubmittingId] = useState(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch current member info if logged in
      let currentMitglied = null;
      if (user?.id) {
        const mitgliedResponse = await base44.entities.Mitglied.filter({ user_id: user.id });
        if (mitgliedResponse && mitgliedResponse.length > 0) {
          currentMitglied = mitgliedResponse[0];
          setMitglied(currentMitglied);
        }
      }

      // 2. Fetch all outings (Ausfahrten) sorted by datum ascending
      const ausfahrtenResponse = await base44.entities.Ausfahrt.filter({}, 'datum');
      setAusfahrten(ausfahrtenResponse || []);

      // 3. Fetch all registrations (Anmeldungen) to count and check own status
      const anmeldungenResponse = await base44.entities.AusfahrtAnmeldung.filter({});
      setAnmeldungen(anmeldungenResponse || []);
    } catch (error) {
      console.error('Fehler beim Laden der Ausfahrtendaten:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Handle registration (Anmeldung)
  const handleRegister = async (ausfahrtId) => {
    if (!mitglied) {
      alert('Sie müssen als Mitglied registriert sein, um sich für eine Ausfahrt anzumelden.');
      return;
    }
    setSubmittingId(ausfahrtId);
    try {
      await base44.entities.AusfahrtAnmeldung.create({
        ausfahrt_id: ausfahrtId,
        mitglied_id: mitglied.id,
        status: 'Angemeldet',
        anmeldedatum: new Date().toISOString()
      });
      // Refresh local data state
      const updatedAnmeldungen = await base44.entities.AusfahrtAnmeldung.filter({});
      setAnmeldungen(updatedAnmeldungen || []);
    } catch (error) {
      console.error('Fehler bei der Anmeldung:', error);
      alert('Bei der Anmeldung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmittingId(null);
    }
  };

  // Handle cancellation (Abmeldung)
  const handleUnregister = async (anmeldungId, ausfahrtId) => {
    if (!window.confirm('Möchten Sie sich wirklich von dieser Ausfahrt abmelden?')) {
      return;
    }
    setSubmittingId(ausfahrtId);
    try {
      await base44.entities.AusfahrtAnmeldung.delete(anmeldungId);
      // Refresh local data state
      const updatedAnmeldungen = await base44.entities.AusfahrtAnmeldung.filter({});
      setAnmeldungen(updatedAnmeldungen || []);
    } catch (error) {
      console.error('Fehler bei der Abmeldung:', error);
      alert('Bei der Abmeldung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmittingId(null);
    }
  };

  // Pre-process items with helper checks and statistics
  const processedAusfahrten = useMemo(() => {
    return ausfahrten.map(ausfahrt => {
      const ausfahrtDatum = ausfahrt.datum ? startOfDay(parseISO(ausfahrt.datum)) : null;
      
      // Calculate active registrations
      const activeAnmeldungen = anmeldungen.filter(
        a => a.ausfahrt_id === ausfahrt.id && (a.status === 'Angemeldet' || a.status === 'Eingecheckt')
      );
      const registrationCount = activeAnmeldungen.length;

      // Find registration of current logged-in member
      const ownAnmeldung = mitglied 
        ? anmeldungen.find(a => a.ausfahrt_id === ausfahrt.id && a.mitglied_id === mitglied.id)
        : null;

      // Registration window validation
      const registrationStart = ausfahrt.anmeldung_start ? startOfDay(parseISO(ausfahrt.anmeldung_start)) : null;
      const registrationEnd = ausfahrt.anmeldung_ende ? startOfDay(parseISO(ausfahrt.anmeldung_ende)) : null;
      
      const isRegistrationOpen = ausfahrt.status === 'Anmeldung offen' && 
        (!registrationStart || !isBefore(today, registrationStart)) && 
        (!registrationEnd || !isAfter(today, registrationEnd));

      // Cancellation limit calculation (datum - 3 days)
      let canUnregister = false;
      if (ownAnmeldung && ausfahrtDatum) {
        const daysDiff = differenceInDays(ausfahrtDatum, today);
        canUnregister = daysDiff >= 3;
      }

      return {
        ...ausfahrt,
        ausfahrtDatum,
        registrationCount,
        ownAnmeldung,
        isRegistrationOpen,
        canUnregister
      };
    });
  }, [ausfahrten, anmeldungen, mitglied, today]);

  // Counters for filter chips
  const counts = useMemo(() => {
    const total = processedAusfahrten.length;
    const umzug = processedAusfahrten.filter(a => a.typ === 'Umzug').length;
    const veranstaltung = processedAusfahrten.filter(a => a.typ === 'Veranstaltung').length;
    const kommend = processedAusfahrten.filter(a => a.ausfahrtDatum && !isBefore(a.ausfahrtDatum, today)).length;
    const vergangen = processedAusfahrten.filter(a => a.ausfahrtDatum && isBefore(a.ausfahrtDatum, today)).length;
    return { total, umzug, veranstaltung, kommend, vergangen };
  }, [processedAusfahrten, today]);

  // Apply Search & Chip Filters
  const filteredAusfahrten = useMemo(() => {
    return processedAusfahrten.filter(ausfahrt => {
      // 1. Search filter (by title or location)
      const matchesSearch = 
        (ausfahrt.titel?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (ausfahrt.ort?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // 2. Chip filters
      if (activeFilter === 'Alle') return true;
      if (activeFilter === 'Umzug') return ausfahrt.typ === 'Umzug';
      if (activeFilter === 'Veranstaltung') return ausfahrt.typ === 'Veranstaltung';
      if (activeFilter === 'Kommend') return ausfahrt.ausfahrtDatum && !isBefore(ausfahrt.ausfahrtDatum, today);
      if (activeFilter === 'Vergangen') return ausfahrt.ausfahrtDatum && isBefore(ausfahrt.ausfahrtDatum, today);

      return true;
    });
  }, [processedAusfahrten, searchTerm, activeFilter, today]);

  // Return loading spinner
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400 py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mb-4"></div>
        <p className="text-sm">Ausfahrten werden geladen…</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-white min-h-screen bg-background">
      {/* Header section with Oswald font */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-oswald font-semibold tracking-wide text-white uppercase">
            Unsere Ausfahrten
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Plane und verwalte deine Busausfahrten zu den nächsten Fasnetsveranstaltungen.
          </p>
        </div>

        {isAdmin(user) && (
          <Link
            to="/ausfahrten/neu"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/95 text-white font-medium px-4 py-2.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 self-start md:self-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Neue Ausfahrt</span>
          </Link>
        )}
      </div>

      {/* Sticky Search & Filters bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md py-4 border-b border-border mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Ausfahrten nach Titel oder Ort suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 md:mx-0 md:px-0">
          {[
            { id: 'Alle', label: 'Alle', count: counts.total },
            { id: 'Kommend', label: 'Kommend', count: counts.kommend },
            { id: 'Umzug', label: 'Umzüge', count: counts.umzug },
            { id: 'Veranstaltung', label: 'Veranstaltungen', count: counts.veranstaltung },
            { id: 'Vergangen', label: 'Vergangen', count: counts.vergangen },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setActiveFilter(chip.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                activeFilter === chip.id
                  ? 'bg-primary border-primary text-white'
                  : 'bg-card border-border text-gray-400 hover:text-white hover:border-gray-600'
              }`}
            >
              <span>{chip.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === chip.id ? 'bg-black/20 text-white' : 'bg-white/10 text-gray-400'
              }`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredAusfahrten.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 bg-card border border-border rounded-xl">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <Bus className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">Keine Ausfahrten gefunden</h3>
          <p className="text-gray-400 text-sm max-w-sm">
            Es konnten keine Ausfahrten für die aktuellen Filterkriterien oder Suchbegriffe gefunden werden.
          </p>
        </div>
      ) : (
        /* List of Ausfahrten Cards */
        <div className="space-y-4">
          {filteredAusfahrten.map((ausfahrt) => {
            // Badges formatting
            const typeBadgeStyle = ausfahrt.typ === 'Umzug'
              ? 'bg-primary/20 text-primary border-primary/30'
              : 'bg-blue-500/20 text-blue-400 border-blue-500/30';

            let statusBadgeStyle = 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            if (ausfahrt.status === 'Anmeldung offen') {
              statusBadgeStyle = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            } else if (ausfahrt.status === 'Anmeldung geschlossen') {
              statusBadgeStyle = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            } else if (ausfahrt.status === 'Abgeschlossen') {
              statusBadgeStyle = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            } else if (ausfahrt.status === 'Abgesagt') {
              statusBadgeStyle = 'bg-red-500/20 text-red-400 border-red-500/30';
            }

            return (
              <div 
                key={ausfahrt.id}
                className="bg-card border border-border rounded-xl hover:border-gray-700 transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 md:p-6">
                  {/* Top badges and actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeBadgeStyle}`}>
                        {ausfahrt.typ || 'Ausfahrt'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}>
                        {ausfahrt.status || 'Geplant'}
                      </span>
                    </div>

                    {/* Own Registration Status Badges */}
                    {mitglied && ausfahrt.ownAnmeldung && (
                      <div className="text-xs">
                        <span className="text-gray-400 mr-1.5">Dein Status:</span>
                        <span className={`font-semibold px-2 py-0.5 rounded-md ${
                          ausfahrt.ownAnmeldung.status === 'Angemeldet' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : ausfahrt.ownAnmeldung.status === 'Eingecheckt'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {ausfahrt.ownAnmeldung.status}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Outing Title */}
                  <h3 className="text-xl font-semibold text-white mb-4 hover:text-primary transition-colors">
                    <Link to={`/ausfahrten/${ausfahrt.id}`} className="hover:underline">
                      {ausfahrt.titel}
                    </Link>
                  </h3>

                  {/* Metadata fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-sm text-gray-300 mb-6">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span>
                        {ausfahrt.datum 
                          ? format(parseISO(ausfahrt.datum), 'eeee, dd. MMMM yyyy', { locale: de })
                          : 'Datum unbestimmt'
                        }
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span className="truncate">{ausfahrt.ort || 'Keine Ortsangabe'}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span>
                        Abfahrt: <strong className="text-white">{ausfahrt.abfahrt_zeit || '--:--'} Uhr</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4.5 h-4.5 text-gray-400 shrink-0" />
                      <span>
                        Beginn: <strong className="text-white">{ausfahrt.veranstaltungsbeginn || '--:--'} Uhr</strong>
                      </span>
                    </div>
                  </div>

                  {/* Registrations counter progress / status */}
                  <div className="flex items-center gap-2 bg-[#0d0d0d] px-4 py-2.5 rounded-lg border border-border w-fit mb-2">
                    <Users className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-gray-300 font-medium">
                      Anmeldungen: <strong className="text-white">{ausfahrt.registrationCount}</strong>
                    </span>
                  </div>
                </div>

                {/* Card action footer */}
                <div className="bg-[#0c0c0c] border-t border-border px-5 py-4 md:px-6 flex flex-wrap items-center justify-between gap-3">
                  <Link 
                    to={`/ausfahrten/${ausfahrt.id}`}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-300 hover:text-white hover:underline font-medium"
                  >
                    Details ansehen
                    <ChevronRight className="w-4 h-4" />
                  </Link>

                  {/* Registration Actions (Anmelden / Abmelden buttons) */}
                  {user && mitglied ? (
                    <div className="flex items-center gap-2">
                      {/* Register Button */}
                      {!ausfahrt.ownAnmeldung && (
                        <button
                          onClick={() => handleRegister(ausfahrt.id)}
                          disabled={!ausfahrt.isRegistrationOpen || submittingId !== null}
                          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white ${
                            ausfahrt.isRegistrationOpen
                              ? 'bg-primary hover:bg-primary/95 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                              : 'bg-gray-800 text-gray-500 border border-gray-700/50 cursor-not-allowed'
                          }`}
                        >
                          {submittingId === ausfahrt.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="animate-spin h-3.5 w-3.5 border-t-2 border-b-2 border-white rounded-full"></span>
                              Anmeldung...
                            </span>
                          ) : (
                            'Anmelden'
                          )}
                        </button>
                      )}

                      {/* Unregister Button */}
                      {ausfahrt.ownAnmeldung && (
                        <button
                          onClick={() => handleUnregister(ausfahrt.ownAnmeldung.id, ausfahrt.id)}
                          disabled={!ausfahrt.canUnregister || submittingId !== null}
                          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all border shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                            ausfahrt.canUnregister
                              ? 'bg-transparent border-red-500/40 text-red-400 hover:bg-red-500/10 cursor-pointer'
                              : 'bg-transparent border-gray-800 text-gray-600 cursor-not-allowed'
                          }`}
                          title={!ausfahrt.canUnregister ? 'Abmeldung nur bis 3 Tage vor der Ausfahrt möglich' : ''}
                        >
                          {submittingId === ausfahrt.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="animate-spin h-3.5 w-3.5 border-t-2 border-b-2 border-red-400 rounded-full"></span>
                              Abmeldung...
                            </span>
                          ) : (
                            'Abmelden'
                          )}
                        </button>
                      )}
                    </div>
                  ) : user ? (
                    <p className="text-xs text-yellow-500 italic max-w-[200px] text-right">
                      Kein verknüpftes Mitgliedskonto gefunden. Bitte Administrator kontaktieren.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      Bitte anmelden, um an Ausfahrten teilzunehmen.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}