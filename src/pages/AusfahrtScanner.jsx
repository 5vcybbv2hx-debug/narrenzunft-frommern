import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isDeveloper, kannCheckinDurchfuehren } from '@/lib/roles';
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, AlertTriangle, Users, QrCode, Calendar, Search, Volume2, VolumeX } from 'lucide-react';
import { format, parseISO, isToday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AusfahrtScanner() {
  const { id } = useParams();
  const { user } = useAuth();

  const [ausfahrt, setAusfahrt] = useState(null);
  const [anmeldungen, setAnmeldungen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [scannerError, setScannerError] = useState(null);
  const [startPending, setStartPending] = useState(false);
  const [flash, setFlash] = useState(null);
  const [soundAn, setSoundAn] = useState(true);
  const audioCtxRef = useRef(null);
  const flashTimerRef = useRef(null);

  // Akustisches + haptisches Feedback: Wer abspannt, muss während der Busfahrt
  // NICHT aufs Display oder die grüne Leuchte schauen — Erfolg/Fehler ist hörbar,
  // fühlbar (Vibration) und als kurzes großes Banner sichtbar.
  const playBeep = (erfolg) => {
    if (soundAn) {
      try {
        if (!audioCtxRef.current) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          audioCtxRef.current = new AC();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        if (erfolg) {
          // Aufsteigender Doppel-Beep = Bestätigung
          [[880, now, 0.09], [1318.5, now + 0.1, 0.14]].forEach(([freq, start, dur]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.3, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + dur + 0.02);
          });
        } else {
          // Tiefer, langer Brummton = Fehler/Warnung
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 196;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch { /* Ton ist Nice-to-have */ }
    }
    try {
      if (navigator.vibrate) navigator.vibrate(erfolg ? 90 : [150, 80, 150]);
    } catch { /* nicht überall unterstützt (z.B. iOS) */ }
  };

  const showFlash = (erfolg, name) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash({ erfolg, name });
    flashTimerRef.current = setTimeout(() => setFlash(null), 1600);
  };
  const [manuellerFilter, setManuellerFilter] = useState('');
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

  // ── Berechtigungslogik ──
  const currentMitglied = mitglieder.find(m => m.user_id === user?.id || m.email === user?.email);
  const isBusverantwortlicher = ausfahrt?.bus_verantwortliche?.includes(currentMitglied?.id);

  // Vorstand / Admin / Spartenleiter können immer scannen (über kannCheckinDurchfuehren aus roles.js)
  const hasGeneralAccess = kannCheckinDurchfuehren(user) || isAdmin(user) || isDeveloper(user);

  // Busverantwortliche nur am Ausfahrttag
  const isAusfahrtTag = () => {
    if (!ausfahrt?.datum) return false;
    try {
      const eventDate = parseISO(ausfahrt.datum);
      return isToday(eventDate);
    } catch { return false; }
  };

  const canScan = hasGeneralAccess || (isBusverantwortlicher && isAusfahrtTag());

  // Namen aller für diese Ausfahrt eingetragenen Busverantwortlichen
  const busverantwortlicheNamen = (ausfahrt?.bus_verantwortliche || [])
    .map(vid => {
      const m = mitglieder.find(m => m.id === vid);
      return m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : null;
    })
    .filter(Boolean);

  const getMitgliedName = (mitgliedId) => {
    const m = mitglieder.find(m => m.id === mitgliedId);
    return m ? `${m.vorname || ''} ${m.nachname || ''}`.trim() : 'Unbekannt';
  };

  const activeAnmeldungen = anmeldungen.filter(a => a.status !== 'Abgemeldet');
  const gefilterteAnmeldungen = manuellerFilter.trim()
    ? activeAnmeldungen.filter(r => {
        const name = r.is_fremdangemeldet
          ? (r.fremdname || 'Fremdperson')
          : getMitgliedName(r.mitglied_id);
        return name.toLowerCase().includes(manuellerFilter.trim().toLowerCase());
      })
    : activeAnmeldungen;
  const eingechecktCount = activeAnmeldungen.filter(a => a.status === 'Eingecheckt').length;
  const gesamtCount = activeAnmeldungen.length;

  const handleScanResult = useCallback(async (decodedText) => {
    if (lastScan && lastScan.id === decodedText && Date.now() - lastScan.timestamp < 3000) {
      return;
    }
    setLastScan({ id: decodedText, timestamp: Date.now() });

    try {
      const response = await base44.functions.invoke('checkinAusfahrt', {
        anmeldung_id: decodedText,
        erwartete_ausfahrt_id: id,
        eingeloggter_name: user?.full_name || user?.email || 'Busverantwortlicher'
      });
      const result = response.data || response;

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
      playBeep(!!result.erfolg);
      showFlash(!!result.erfolg, newEntry.name);

      if (result.erfolg) {
        // Lokales Update statt vollständigem Neuladen – fühlt sich instant an
        setAnmeldungen(prev => prev.map(a => a.id === decodedText ? { ...a, status: 'Eingecheckt', eingecheckt_am: new Date().toISOString(), eingecheckt_von: user?.full_name || '' } : a));
      }
    } catch (err) {
      console.error('Check-in API error:', err);
      playBeep(false);
      showFlash(false, 'Netzwerkfehler');
      setScanResults(prev => [{
        id: decodedText,
        name: 'Fehler',
        erfolg: false,
        fehler: 'Netzwerkfehler beim Check-in',
        timestamp: new Date().toLocaleTimeString('de-DE')
      }, ...prev].slice(0, 30));
    }
  }, [lastScan, user, mitglieder, soundAn]);

  const handleManualCheckin = useCallback(async (reg) => {
    const prevStatus = reg.status;
    // Optimistisch sofort als eingecheckt markieren
    setAnmeldungen(prev => prev.map(a => a.id === reg.id ? { ...a, status: 'Eingecheckt', eingecheckt_am: new Date().toISOString(), eingecheckt_von: user?.full_name || '' } : a));
    setLastScan({ id: reg.id, timestamp: Date.now() });
    try {
      const response = await base44.functions.invoke('checkinAusfahrt', {
        anmeldung_id: reg.id,
        erwartete_ausfahrt_id: id,
        eingeloggter_name: user?.full_name || user?.email || 'Busverantwortlicher'
      });
      const result = response.data || response;
      const name = reg.is_fremdangemeldet ? (reg.fremdname || 'Fremdperson') : getMitgliedName(reg.mitglied_id);
      playBeep(!!result.erfolg);
      showFlash(!!result.erfolg, name);
      setScanResults(prev => [{
        id: reg.id,
        name,
        erfolg: !!result.erfolg,
        fehler: result.fehler,
        timestamp: new Date().toLocaleTimeString('de-DE')
      }, ...prev].slice(0, 30));
      if (!result.erfolg) {
        // Rollback bei Fehler
        setAnmeldungen(prev => prev.map(a => a.id === reg.id ? { ...a, status: prevStatus } : a));
      }
    } catch (err) {
      setAnmeldungen(prev => prev.map(a => a.id === reg.id ? { ...a, status: prevStatus } : a));
      playBeep(false);
      showFlash(false, 'Netzwerkfehler');
      setScanResults(prev => [{
        id: reg.id,
        name: reg.is_fremdangemeldet ? (reg.fremdname || 'Fremdperson') : getMitgliedName(reg.mitglied_id),
        erfolg: false,
        fehler: 'Netzwerkfehler beim Check-in',
        timestamp: new Date().toLocaleTimeString('de-DE')
      }, ...prev].slice(0, 30));
    }
  }, [user, mitglieder, soundAn]);

  const startScanner = () => {
    setScannerError(null);

    // AudioContext beim Button-Tap anlegen/entsperren — iOS erlaubt Ton nur nach Nutzer-Geste
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!audioCtxRef.current) audioCtxRef.current = new AC();
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      }
    } catch { /* ignoriert */ }

    // Vorabprüfungen, bevor der Container gerendert und die Kamera angefragt wird
    if (!window.isSecureContext) {
      setScannerError('Die Kamera funktioniert nur über eine sichere Verbindung (https). Bitte die Seite über https aufrufen.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError('Dieser Browser unterstützt keinen Kamera-Zugriff. Bitte einen aktuellen Browser (Chrome, Safari) verwenden oder die manuelle Liste unten nutzen.');
      return;
    }

    // scanning=true rendert den #qr-reader-Container; der Effect startet die Kamera,
    // sobald das Element im DOM existiert
    setScanning(true);
    setStartPending(true);
  };

  // Kamera-Start — läuft erst, nachdem React den #qr-reader-Container gerendert hat.
  // (Html5Qrcode benötigt das Element bei new Html5Qrcode(...) im DOM, sonst crasht es,
  // bevor überhaupt die Browser-Kamera-Berechtigung angefragt wird.)
  useEffect(() => {
    if (!startPending) return;
    setStartPending(false);

    let cancelled = false;
    (async () => {
      let html5QrCode;
      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;

        const screenWidth = window.innerWidth || 375;
        const qrboxSize = Math.min(250, Math.floor(screenWidth * 0.7));
        const qrConfig = {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true }
        };

        try {
          // Zuerst Rückkamera versuchen (Standard für QR-Check-in)
          await html5QrCode.start(
            { facingMode: 'environment' },
            qrConfig,
            (decodedText) => handleScanResult(decodedText),
            undefined
          );
        } catch (envErr) {
          // Manche Geräte (z.B. Laptops) kennen 'environment' nicht — Fallback Standardkamera
          console.warn('Rückkamera nicht verfügbar, versuche Standardkamera:', envErr);
          await html5QrCode.start(
            { facingMode: 'user' },
            qrConfig,
            (decodedText) => handleScanResult(decodedText),
            undefined
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Scanner start error:', err);
        const name = err?.name || '';
        const msg = err?.message || '';
        let text = 'Kamera konnte nicht gestartet werden.';
        if (name === 'NotAllowedError' || /permission/i.test(msg)) {
          text = 'Kamera-Zugriff wurde verweigert. Bitte in den Browser-Einstellungen die Kamera-Berechtigung für diese Seite erlauben und erneut versuchen.';
        } else if (name === 'NotFoundError') {
          text = 'Es wurde keine Kamera auf diesem Gerät gefunden. Bitte die manuelle Liste unten nutzen.';
        } else if (name === 'NotReadableError') {
          text = 'Die Kamera wird bereits von einer anderen App oder einem anderen Tab verwendet. Bitte diese schließen und erneut versuchen.';
        } else if (name === 'OverconstrainedError') {
          text = 'Die Kamera-Einstellungen werden von diesem Gerät nicht unterstützt.';
        } else if (name === 'SecurityError') {
          text = 'Kamera-Zugriff wurde aus Sicherheitsgründen blockiert (nur über https möglich).';
        }
        setScannerError(text);
        setScanning(false);
        if (html5QrCodeRef.current) {
          try { await html5QrCodeRef.current.clear(); } catch { /* bereits verworfen */ }
          html5QrCodeRef.current = null;
        }
      }
    })();

    return () => { cancelled = true; };
  }, [startPending, handleScanResult]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) { console.error('Stop scanner error:', e); }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => { /* scanner already stopped */ });
      }
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
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
        <p className="text-muted-foreground font-medium">Scanner wird vorbereitet…</p>
      </div>
    );
  }

  if (error || !ausfahrt) {
    return (
      <div className="min-h-[60vh] p-6">
        <div className="max-w-2xl mx-auto">
          <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-muted-foreground hover:text-white mb-6">
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
    // Differenzierte Meldung: Busverantwortlicher aber nicht am Ausfahrttag
    const isBusButNotToday = isBusverantwortlicher && !isAusfahrtTag();
    return (
      <div className="min-h-[60vh] p-6">
        <div className="max-w-2xl mx-auto">
          <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-muted-foreground hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Ausfahrt
          </Link>
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">
              {isBusButNotToday ? 'Noch nicht möglich' : 'Keine Berechtigung'}
            </p>
            {isBusButNotToday ? (
              <>
                <p className="text-muted-foreground text-sm mb-2">
                  Du bist als Busverantwortlicher eingetragen, aber der QR-Scanner ist erst <strong className="text-primary">am Tag der Ausfahrt</strong> verfügbar.
                </p>
                <p className="text-muted-foreground text-xs flex items-center justify-center gap-1.5 mt-3">
                  <Calendar className="w-4 h-4" /> {formatDisplayDate(ausfahrt.datum)}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Du bist nicht als Busverantwortlicher für diese Ausfahrt eingetragen. Nur Vorstände, Admins, Spartenleiter und zugewiesene Busverantwortliche (am Ausfahrtstag) haben Zugriff.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] pb-12">
      {/* Großes Feedback-Banner: kurz sichtbar nach jedem Scan — auch aus dem Augenwinkel.
          Blockiert nichts (pointer-events-none), Kamera läuft darunter weiter. */}
      {flash && (
        <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none px-4 pt-4">
          <div className={`max-w-md mx-auto rounded-xl border p-4 flex items-center gap-3 shadow-2xl ${
            flash.erfolg ? 'bg-green-600 border-green-300' : 'bg-red-600 border-red-300'
          }`}>
            {flash.erfolg
              ? <CheckCircle2 className="w-7 h-7 shrink-0 text-white" />
              : <XCircle className="w-7 h-7 shrink-0 text-white" />}
            <div className="min-w-0">
              <p className="font-oswald uppercase font-bold text-lg leading-tight text-white truncate">{flash.name}</p>
              <p className="text-sm text-white/80">{flash.erfolg ? 'Eingecheckt' : 'Nicht eingecheckt'}</p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <Link to={`/ausfahrten/${id}`} className="inline-flex items-center text-muted-foreground hover:text-white mb-6 transition-colors">
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
              <p className="text-muted-foreground text-sm">{ausfahrt.titel}</p>
            </div>
          </div>
          <p className="text-muted-foreground text-xs mt-2">{formatDisplayDate(ausfahrt.datum)}</p>
          {(busverantwortlicheNamen.length > 0 || ausfahrt?.bus_verantwortliche?.length > 0) && (
            <p className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              Busverantwortliche:{' '}
              {busverantwortlicheNamen.length > 0
                ? busverantwortlicheNamen.join(', ')
                : `${ausfahrt.bus_verantwortliche.length} eingetragen`}
            </p>
          )}
          {isBusverantwortlicher && (
            <p className="text-primary text-xs mt-2 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Du bist für diese Ausfahrt als Busverantwortlicher eingetragen
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-white">{gesamtCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Angemeldet</p>
          </div>
          <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-green-400">{eingechecktCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Eingecheckt</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold font-oswald text-primary">{gesamtCount - eingechecktCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Offen</p>
          </div>
        </div>

        {/* Scanner */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          {scannerError && (
            <div className="mb-4 rounded-xl bg-red-950/30 border border-red-800/40 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{scannerError}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Alternativ kannst du Teilnehmer weiterhin über die manuelle Liste unten einchecken.
              </p>
            </div>
          )}
          {!scanning ? (
            <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {soundAn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                Ton- & Vibrations-Feedback {soundAn ? 'an' : 'aus'} — du musst nicht aufs Display schauen
              </p>
              <button
                onClick={() => setSoundAn(!soundAn)}
                className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
                title={soundAn ? 'Feedback stummschalten' : 'Feedback einschalten'}
              >
                {soundAn ? 'Stumm' : 'Ton an'}
              </button>
            </div>
            <button
              onClick={startScanner}
              className="w-full bg-primary hover:bg-red-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-3 text-base"
            >
              <ScanLine className="w-6 h-6" /> {scannerError ? 'Erneut versuchen' : 'Scanner starten'}
            </button>
            </>
          ) : (
            <div className="space-y-4">
              <div id="qr-reader" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-black aspect-square" ref={scannerRef} />
              <button
                onClick={stopScanner}
                className="w-full bg-secondary hover:bg-border text-foreground border border-border font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
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
                  <span className="text-xs text-muted-foreground shrink-0">{result.timestamp}</span>
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
            <span className="text-xs text-muted-foreground">{eingechecktCount} / {gesamtCount} eingecheckt</span>
          </div>
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={manuellerFilter}
              onChange={(e) => setManuellerFilter(e.target.value)}
              placeholder="Name suchen…"
              className="w-full pl-9 pr-8 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            {manuellerFilter && (
              <button
                onClick={() => setManuellerFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                title="Suche leeren"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {gefilterteAnmeldungen.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Keine aktiven Anmeldungen.</p>
            ) : (
              gefilterteAnmeldungen.map(reg => {
                const name = reg.is_fremdangemeldet
                  ? (reg.fremdname || 'Fremdperson')
                  : getMitgliedName(reg.mitglied_id);
                const isEingecheckt = reg.status === 'Eingecheckt';
                return (
                  <button
                    key={reg.id}
                    onClick={() => handleManualCheckin(reg)}
                    disabled={isEingecheckt}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isEingecheckt
                        ? 'bg-green-950/20 border-green-800/40 cursor-not-allowed'
                        : 'bg-secondary border-border hover:border-primary/40 cursor-pointer'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isEingecheckt ? 'bg-green-900/50' : 'bg-secondary'
                    }`}>
                      {isEingecheckt
                        ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                        : <Users className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isEingecheckt ? 'text-muted-foreground' : 'text-white'}`}>
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground">
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