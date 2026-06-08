import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Bus, MapPin, Clock, Phone, Navigation, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

function NavButton({ adresse, label }) {
  if (!adresse) return null;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
    >
      <Navigation size={12} /> Navigation öffnen
    </a>
  );
}

function InfoBlock({ color, emoji, title, children }) {
  const borders = {
    orange: 'border-orange-500/40 bg-orange-500/5',
    blue: 'border-blue-500/40 bg-blue-500/5',
    purple: 'border-purple-500/40 bg-purple-500/5',
    green: 'border-green-500/40 bg-green-500/5',
    gray: 'border-border bg-secondary/30',
  };
  const texts = {
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
    gray: 'text-muted-foreground',
  };
  return (
    <div className={`border rounded-xl px-5 py-4 ${borders[color] || borders.gray}`}>
      <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${texts[color] || texts.gray}`}>{emoji} {title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm mb-1">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

export default function BusfahrerInfo() {
  const { token } = useParams();
  const [veranstaltung, setVeranstaltung] = useState(null);
  const [busfahrer, setBusfahrer] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await base44.entities.Veranstaltung.filter({ busfahrer_token: token });
      if (!results[0]) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const v = results[0];
      setVeranstaltung(v);

      // Bus-Anmeldungen laden
      const teilnahmen = await base44.entities.Teilnahme.filter({ veranstaltung_id: v.id });
      const busAnmeldungen = teilnahmen.filter(t => t.bus && ['Angemeldet', 'Bestätigt', 'Anwesend'].includes(t.status));
      setBusfahrer(busAnmeldungen);

      // Mitglieder für Namen laden
      const m = await base44.entities.Mitglied.list('nachname', 500);
      setMitglieder(m);
    } catch (e) {
      setNotFound(true);
    }
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">🚌</div>
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Lade Busfahrer-Infos...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={48} className="text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Link ungültig</h1>
        <p className="text-muted-foreground text-sm">Dieser Busfahrer-Link ist nicht gültig oder wurde deaktiviert.</p>
      </div>
    </div>
  );

  const isUmzug = veranstaltung.typ === 'Umzug';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary px-5 py-6 text-center">
        <div className="text-4xl mb-2">🚌</div>
        <h1 className="text-xl font-bold text-primary-foreground">{veranstaltung.titel}</h1>
        <p className="text-primary-foreground/80 text-sm mt-1">
          {format(new Date(veranstaltung.datum), 'EEEE, d. MMMM yyyy', { locale: de })}
          {veranstaltung.uhrzeit && ` · ${veranstaltung.uhrzeit} Uhr`}
        </p>
        <div className="mt-2">
          <span className="inline-block px-3 py-1 rounded-full bg-primary-foreground/20 text-primary-foreground text-xs font-semibold">
            Busfahrer-Infos
          </span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Busparkplatz */}
        {(veranstaltung.busparkplatz_adresse || veranstaltung.busparkplatz_treffzeit) && (
          <InfoBlock color="orange" emoji="🅿️" title="Busparkplatz / Treffpunkt">
            <InfoRow label="Treffzeit" value={veranstaltung.busparkplatz_treffzeit ? veranstaltung.busparkplatz_treffzeit + ' Uhr' : null} />
            <InfoRow label="Adresse" value={veranstaltung.busparkplatz_adresse} />
            <NavButton adresse={veranstaltung.busparkplatz_adresse} />
          </InfoBlock>
        )}

        {/* Umzug: Aufstellung */}
        {isUmzug && (veranstaltung.umzugsaufstellung_ort || veranstaltung.umzugsaufstellung_zeit) && (
          <InfoBlock color="blue" emoji="📋" title="Aufstellungsort">
            <InfoRow label="Zeit" value={veranstaltung.umzugsaufstellung_zeit ? veranstaltung.umzugsaufstellung_zeit + ' Uhr' : null} />
            <InfoRow label="Adresse" value={veranstaltung.umzugsaufstellung_ort} />
            <NavButton adresse={veranstaltung.umzugsaufstellung_ort} />
          </InfoBlock>
        )}

        {/* Umzug: Festakt */}
        {isUmzug && (veranstaltung.festakt_ort || veranstaltung.festakt_adresse) && (
          <InfoBlock color="purple" emoji="🎉" title="Festakt / Abschluss">
            <InfoRow label="Beginn" value={veranstaltung.festakt_zeit ? veranstaltung.festakt_zeit + ' Uhr' : null} />
            <InfoRow label="Ort" value={veranstaltung.festakt_ort} />
            <InfoRow label="Adresse" value={veranstaltung.festakt_adresse} />
            <NavButton adresse={veranstaltung.festakt_adresse || veranstaltung.festakt_ort} />
          </InfoBlock>
        )}

        {/* Abendveranstaltung: Ort */}
        {!isUmzug && veranstaltung.veranstaltungsort_adresse && (
          <InfoBlock color="green" emoji="📍" title="Veranstaltungsort">
            <InfoRow label="Ort" value={veranstaltung.ort} />
            <InfoRow label="Adresse" value={veranstaltung.veranstaltungsort_adresse} />
            <InfoRow label="Einlass" value={veranstaltung.einlass_zeit ? veranstaltung.einlass_zeit + ' Uhr' : null} />
            <InfoRow label="Beginn" value={veranstaltung.beginn_zeit ? veranstaltung.beginn_zeit + ' Uhr' : null} />
            <NavButton adresse={veranstaltung.veranstaltungsort_adresse} />
          </InfoBlock>
        )}

        {/* Ansprechpartner */}
        {veranstaltung.kontakt_vor_ort && (
          <InfoBlock color="green" emoji="📞" title="Ansprechpartner vor Ort">
            <p className="text-sm text-foreground font-medium">{veranstaltung.kontakt_vor_ort}</p>
          </InfoBlock>
        )}

        {/* Allgemeine Hinweise */}
        {veranstaltung.hinweise && (
          <InfoBlock color="gray" emoji="📝" title="Hinweise">
            <p className="text-sm text-foreground whitespace-pre-line">{veranstaltung.hinweise}</p>
          </InfoBlock>
        )}

        {/* Bus-Passagierliste */}
        {busfahrer.length > 0 && (
          <InfoBlock color="blue" emoji="👥" title={`Passagiere (${busfahrer.length})`}>
            <div className="space-y-1.5">
              {busfahrer.map((t, idx) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-5 text-right text-xs">{idx + 1}.</span>
                  <span className="text-foreground">{getMitgliedName(t.mitglied_id)}</span>
                  {t.bus_anwesend && <span className="text-xs text-green-400 ml-auto">✓ eingecheckt</span>}
                </div>
              ))}
            </div>
          </InfoBlock>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-muted-foreground">🎭 Narrenzunft · Gute Fahrt!</p>
        </div>
      </div>
    </div>
  );
}