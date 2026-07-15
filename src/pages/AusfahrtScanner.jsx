import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, AlertTriangle, Users, Bus, QrCode } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AusfahrtScanner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [ausfahrt, setAusfahrt] = useState(null);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ausfahrtRes, anmeldungenRes, mitgliederRes] = await Promise.all([
        base44.entities.Ausfahrt.get(id),
        base44.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: id }),
        base44.entities.Mitglied.list('-nachname', 500)
      ]);
      setAusfahrt(ausfahrtRes);
      setAnmeldungen(anmeldungenRes || []);
      setMitglieder(mitgliederRes || []);
    } catch (err) {
      console.error('Scanner data fetch error:', err);
      setError('Fehler beim Laden der Ausfahrt-Daten.');
    } finally {
      setLoading(false);
    }
  };

  // Prüfe ob User Busverantwortlicher oder Admin ist
  const currentMitglied = mitglieder.find(m => m.user_id === user?.id || m.email === user?.email);
  const isBusverantwortlicher = ausfahrt?.bus_verantwortliche?.includes(currentMitglied?.id);
  const canScan = isAdmin(user) || isBusverantwortlicher;

  const getMitgliedName = (mitgliedId) => {
    const m = mitglieder.find(m => m.id === mitgliedId);
    return m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : 'Unbekannt';
  };

  const activeAnmeldungen = anmeldungen.filter(a => a.status !== 'Abgemeldet');
  const eingechecktCount = activeAnmeldungen.filter(a => a.status === 'Eingecheckt').length;
  constgesamtCount = activeAnmeldungen.length;

  const handleScanResult = useCallback(async (decodedText) => {
    // Verhindere Mehrfach-Scan derselben ID innerhalb kurzem Zeitraum
    if (lastScan && lastScan.id === decodedText && Date.now() - lastScan.timestamp < 3000) {
      return;
    }
    setLastScan({ id: decodedText, timestamp: Date.now() });

    try {
      // API-Aufruf an die checkinAusfahrt Backend-Function
      const response = await fetch(`/api/apps/${import.meta.env.VITE_BASE44_APP_ID}/functions/checkinAusfahrt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anmeldung_id: decodedText,
          eingeloggter_name: user?.full_name || user?.email || 'Busverantwortlicher'
        })
      });
      const result = await response.json();

      const newEntry = {
        id: decodedText,
        name: result.anmeldung
          ? (result.anmeldung.is_fremdangemeldet
              ? result.anmeldung.fremdname
              : getMitgliedName(result.anmeldung.mitglied_id))
          : 'Unbekannt',
        erfolg: result.erfolg,
        fehler: result.fehler,
        timestamp: new Date().toLocaleTimeString('de-DE')
      };

      setScanResults(prev => [newEntry, ...prev].slice(0, 30));

      if (result.erfolg) {
        fetchData(); // Aktualisiere Anmeldungs-Liste
      }
    } catch (err) {
      console.error('Check-in API error:', err);
      setScanResults(prev => [{
        id: decodedText,
        name: 'Fehler',
        erfolg: false,
        fehler: 'Netzwerkfehler beim Check-in',
        timestamp: new Date().toLocaleTimeString('de-DE')
      }, ...prev].slice(0, 30));
    }
  }, [lastScan, user, mitglieder]);

  const startScanner = async () => {
    try {
      // Dynamically load html5-qrcode from CDN
      if (!window.Html5Qrcode) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const html5QrCode = new window.Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      const qrConfig = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        qrConfig,
        (decodedText) => handleScanResult(decodedText),
        undefined
      );
      setScanning(true);
    } catch (err) {
      console.error('Scanner start error:', err);
      setError('Kamera konnte nicht gestartet werden. Bitte Browser-Berechtigungen prüfen.');
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Stop scanner error:', e);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try { return format(parseISO(dateStr), 'EEEE, d. MMMM yyyy', { locale: de }); }
    catch { return dateStr; }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-400 font-medium">Scanner wird vorbereitet…</p>
      </div>
    );
  }

  if (error || !ausfahrt) {
    return (
      <div className="min-h-[60vh] p-6">
        <div className="max-w-2xl mx-auto">
          <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Ausfahrt
          </Link>
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-red-500 font-medium">{error || 'Ausfahrt nicht gefunden.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canScan) {
    return (
      <div className="min-h-[60vh] p-6">
        <div className="max-w-2xl mx-auto">
          <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-gray-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Ausfahrt
          </Link>
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">Keine Berechtigung</p>
            <p className="text-gray-400 text-sm">Du bist nicht als Busverantwortlicher für diese Ausfahrt eingetragen.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] pb-12">
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Ausfahrt
        </Link>

        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white">
                QR Check-in
              </h1>
              <p className="text-gray-400 text-sm">{ausfahrt.titel}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-2">{formatDisplayDate(ausfahrt.datum)}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-white">{gesamtCount}</p>
            <p className="text-xs text-gray-500 mt-1">Angemeldet</p>
          </div>
          <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-green-400">{eingechecktCount}</p>
            <p className="text-xs text-gray-500 mt-1">Eingecheckt</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-primary">{gesamtCount - eingechecktCount}</p>
            <p className="text-xs text-gray-500 mt-1">Offen</p>
          </div>
        </div>

        {/* Scanner */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          {!scanning ? (
            <button
              onClick={startScanner}
              className="w-full bg-primary hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-base"
            >
              <ScanLine className="w-6 h-6" /> Scanner starten
            </button>
          ) : (
            <div className="space-y-4">
              <div id="qr-reader" className="w-full rounded-xl overflow-hidden bg-black" ref={scannerRef} />
              <button
                onClick={stopScanner}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white border border-border font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" /> Scanner stoppen
              </button>
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResults.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h2 className="text-sm font-bold font-oswald uppercase tracking-wider text-white mb-4">
              Scan-Ergebnisse ({scanResults.length})
            </h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {scanResults.map((result, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    result.erfolg
                      ? 'bg-green-950/20 border-green-800/40'
                      : 'bg-red-950/20 border-red-800/40'
                  }`}
                >
                  {result.erfolg ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{result.name}</p>
                    <p className={`text-xs ${result.erfolg ? 'text-green-500' : 'text-red-500'}`}>
                      {result.erfolg ? 'Erfolgreich eingecheckt' : result.fehler || 'Fehler'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">{result.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anmeldungs-Liste (Fallback) */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold font-oswald uppercase tracking-wider text-white">
              Manuelle Check-in Liste
            </h2>
            <span className="text-xs text-gray-500">{eingechecktCount} / {gesamtCount} eingecheckt</span>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {activeAnmeldungen.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">Keine aktiven Anmeldungen.</p>
            ) : (
              activeAnmeldungen.map(reg => {
                const name = reg.is_fremdangemeldet
                  ? (reg.fremdname || 'Fremdperson')
                  : getMitgliedName(reg.mitglied_id);
                const isEingecheckt = reg.status === 'Eingecheckt';
                return (
                  <button
                    key={reg.id}
                    onClick={() => handleScanResult(reg.id)}
                    disabled={isEingecheckt}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isEingecheckt
                        ? 'bg-green-950/20 border-green-800/40 cursor-not-allowed'
                        : 'bg-neutral-900 border-border hover:border-primary/40 cursor-pointer'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isEingecheckt ? 'bg-green-900/50' : 'bg-neutral-800'
                    }`}>
                      {isEingecheckt
                        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                        : <Users className="w-4 h-4 text-gray-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isEingecheckt ? 'text-gray-500' : 'text-white'}`}>
                        {name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {reg.transport === 'Bus' ? '🚌 Bus' : '🚗 Privat'}
                        {reg.anzahl_begleitpersonen > 0 && ` · +${reg.anzahl_begleitpersonen} Begleitung`}
                      </p>
                    </div>
                    {!isEingecheckt && (
                      <span className="text-xs font-semibold text-primary shrink-0">Einchecken</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
