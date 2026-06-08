import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Baby, CheckCircle2, ChevronRight, RefreshCw, X, ArrowRight } from 'lucide-react';

const STATUS_FARBEN = {
  'Kleinkind 0-3':     'bg-pink-500/20 text-pink-300',
  'Kinder 4-10':       'bg-yellow-500/20 text-yellow-300',
  'Jugendliche 11-14': 'bg-primary/20 text-primary',
  'Jungaktive 15-17':  'bg-blue-500/20 text-blue-300',
  'Aktiv':             'bg-green-500/20 text-green-400',
};

export default function StatuswechselWidget() {
  const [eintraege, setEintraege] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pruefeLaeuft, setPruefeLaeuft] = useState(false);
  const [bestaetigeId, setBestaetigeId] = useState(null); // benachrichtigung id

  useEffect(() => { ladeOffene(); }, []);

  const ladeOffene = async () => {
    setLoading(true);
    try {
      const benachrichtigungen = await base44.entities.Benachrichtigung.filter({
        typ: 'Statuswechsel',
        gelesen: false,
      });
      const parsed = benachrichtigungen.map(b => {
        let daten = {};
        try { daten = JSON.parse(b.daten || '{}'); } catch {}
        return { ...b, daten };
      });
      setEintraege(parsed);
    } catch {}
    setLoading(false);
  };

  const manuellPruefen = async () => {
    setPruefeLaeuft(true);
    try {
      await base44.functions.invoke('pruefeAltersstatusWechsel', {});
      await ladeOffene();
    } catch {}
    setPruefeLaeuft(false);
  };

  const statusBestaetigen = async (eintrag, neuerStatus) => {
    setBestaetigeId(eintrag.id);
    try {
      // Mitgliedsstatus aktualisieren
      await base44.entities.Mitglied.update(eintrag.daten.mitglied_id, {
        mitgliedsstatus: neuerStatus,
      });
      // Benachrichtigung als gelesen markieren
      await base44.entities.Benachrichtigung.update(eintrag.id, { gelesen: true });
      setEintraege(prev => prev.filter(e => e.id !== eintrag.id));
    } catch {}
    setBestaetigeId(null);
  };

  const ignorieren = async (eintrag) => {
    await base44.entities.Benachrichtigung.update(eintrag.id, { gelesen: true });
    setEintraege(prev => prev.filter(e => e.id !== eintrag.id));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      {eintraege.length === 0 ? (
        <div className="flex items-center gap-2 py-3">
          <CheckCircle2 size={18} className="text-green-400" />
          <p className="text-sm text-green-400 font-medium">Alle Altersstatusangaben sind aktuell</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eintraege.map(eintrag => {
            const d = eintrag.daten;
            const isLoading = bestaetigeId === eintrag.id;
            return (
              <div key={eintrag.id} className="bg-yellow-500/5 border border-yellow-500/25 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/mitglieder/${d.mitglied_id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {d.vorname} {d.nachname}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.alter} Jahre alt · Geburtstag: {d.geburtsdatum}
                    </p>
                  </div>
                  <button
                    onClick={() => ignorieren(eintrag)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Ignorieren"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Status-Wechsel Visualisierung */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_FARBEN[d.alter_status] || 'bg-secondary text-muted-foreground'}`}>
                    {d.alter_status}
                  </span>
                  <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${STATUS_FARBEN[d.empfohlener_status] || 'bg-secondary text-muted-foreground'}`}>
                    {d.empfohlener_status}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => statusBestaetigen(eintrag, d.empfohlener_status)}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50"
                  >
                    {isLoading
                      ? <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle2 size={12} />
                    }
                    Auf „{d.empfohlener_status}" wechseln
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manuell prüfen */}
      <button
        onClick={manuellPruefen}
        disabled={pruefeLaeuft}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-secondary text-muted-foreground text-xs hover:text-foreground hover:bg-border transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={pruefeLaeuft ? 'animate-spin' : ''} />
        {pruefeLaeuft ? 'Prüfung läuft...' : 'Jetzt manuell prüfen'}
      </button>
    </div>
  );
}