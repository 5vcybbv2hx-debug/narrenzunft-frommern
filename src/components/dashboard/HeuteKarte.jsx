import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { CalendarClock, MapPin, QrCode, ChevronRight, Check } from 'lucide-react';
import QrKarussell from '@/components/ausfahrt/QrKarussell';

/**
 * Karte "Heute" auf dem Dashboard.
 *
 * Erscheint nur, wenn heute eine Ausfahrt stattfindet, und bleibt bewusst
 * schlank: pro Veranstaltung eine Zeile mit Abfahrt, Ort, eigenem Status und
 * den QR-Codes der angemeldeten Familie. Mehrere Veranstaltungen am selben Tag
 * werden als Liste untereinander gezeigt, nicht als Kacheln.
 */
function heuteISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function datumKurz(iso) {
  if (!iso) return '';
  const d = String(iso).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : '';
}

export default function HeuteKarte() {
  const { user } = useAuth();
  const [meinId, setMeinId] = useState(user?._mitglied?.id || null);
  const [tage, setTage] = useState([]); // [{ ausfahrt, anmeldungen: [{id, name, transport, status}] }]
  const [qrOffen, setQrOffen] = useState(null); // { titel, eintraege }
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    if (meinId || !user) return;
    let abbruch = false;
    (async () => {
      try {
        const treffer = await base44.entities.Mitglied.filter({ user_id: user.id });
        let m = (treffer || [])[0];
        if (!m && user.email) {
          const perMail = await base44.entities.Mitglied.filter({ email: user.email });
          m = (perMail || [])[0];
        }
        if (!abbruch && m) setMeinId(m.id);
      } catch (e) { console.error('Mitglied zu Login nicht gefunden:', e); }
    })();
    return () => { abbruch = true; };
  }, [meinId, user]);

  useEffect(() => {
    if (!meinId) return;
    let abbruch = false;
    (async () => {
      try {
        const heute = heuteISO();
        const ausfahrten = await base44.entities.Ausfahrt.filter({ datum: heute }).catch(() => []);
        const heutige = (ausfahrten || []).filter(a => a.status !== 'Abgesagt');
        if (heutige.length === 0) { if (!abbruch) { setTage([]); setGeladen(true); } return; }

        // Eigene Familie: beide Verwandtschaftsrichtungen, damit nichts fehlt.
        const [hin, zurueck] = await Promise.all([
          base44.entities.Verwandtschaft.filter({ mitglied_id: meinId }).catch(() => []),
          base44.entities.Verwandtschaft.filter({ verwandter_id: meinId }).catch(() => []),
        ]);
        const familieIds = new Set([meinId]);
        for (const v of (hin || [])) {
          if (['Kind', 'Elternteil', 'Ehepartner/in'].includes(v.beziehung)) familieIds.add(v.verwandter_id);
        }
        for (const v of (zurueck || [])) {
          if (['Kind', 'Elternteil', 'Ehepartner/in'].includes(v.beziehung)) familieIds.add(v.mitglied_id);
        }

        // Namen der Familienmitglieder
        const namen = {};
        for (const id of familieIds) {
          const m = await base44.entities.Mitglied.get(id).catch(() => null);
          if (m) namen[id] = `${m.vorname || ''} ${m.nachname || ''}`.trim();
        }

        const ergebnis = [];
        for (const a of heutige) {
          const anmeldungen = await base44.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: a.id }).catch(() => []);
          const meine = (anmeldungen || [])
            .filter(x => x.status !== 'Abgemeldet' && familieIds.has(x.mitglied_id))
            .map(x => ({
              id: x.id,
              mitglied_id: x.mitglied_id,
              name: namen[x.mitglied_id] || 'Familienmitglied',
              transport: x.transport || '',
              status: x.status || 'Angemeldet',
              istFamilie: x.mitglied_id !== meinId,
            }));
          ergebnis.push({ ausfahrt: a, anmeldungen: meine });
        }
        if (!abbruch) { setTage(ergebnis); setGeladen(true); }
      } catch (e) {
        console.error('Heute-Karte laden:', e);
        if (!abbruch) setGeladen(true);
      }
    })();
    return () => { abbruch = true; };
  }, [meinId]);

  if (!geladen || tage.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={16} className="text-primary" />
          <h3 className="font-oswald uppercase tracking-wide text-white text-sm">Heute</h3>
          <span className="ml-auto text-[11px] font-semibold text-primary">
            {tage.length === 1 ? '1 Veranstaltung' : `${tage.length} Veranstaltungen`}
          </span>
        </div>

        <div className="space-y-2">
          {tage.map(({ ausfahrt, anmeldungen }) => {
            const eingecheckt = anmeldungen.length > 0 && anmeldungen.every(a => a.status === 'Eingecheckt');
            return (
              <div key={ausfahrt.id} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">{ausfahrt.titel}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                      {ausfahrt.abfahrt_zeit && <span>Abfahrt {ausfahrt.abfahrt_zeit}</span>}
                      {ausfahrt.abfahrt_ort && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin size={10} /> {ausfahrt.abfahrt_ort}
                        </span>
                      )}
                    </p>
                  </div>
                  {eingecheckt && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0 inline-flex items-center gap-0.5">
                      <Check size={9} /> eingecheckt
                    </span>
                  )}
                </div>

                <p className="text-[11px] mt-1.5">
                  {anmeldungen.length === 0 ? (
                    <span className="text-muted-foreground">Niemand aus der Familie angemeldet.</span>
                  ) : (
                    <span className="text-foreground">
                      {anmeldungen.map(a => a.name.split(' ')[0]).join(', ')}
                      {anmeldungen.length === 1 ? ' ist' : ' sind'} angemeldet
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {anmeldungen.length > 0 && (
                    <button
                      onClick={() => setQrOffen({
                        titel: `${ausfahrt.titel}${ausfahrt.datum ? ` · ${datumKurz(ausfahrt.datum)}` : ''}`,
                        eintraege: anmeldungen,
                      })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-red-700 min-h-[36px]"
                    >
                      <QrCode size={12} /> QR-Codes
                    </button>
                  )}
                  <Link
                    to={`/ausfahrten/${ausfahrt.id}`}
                    className="inline-flex items-center gap-0.5 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    Zur Ausfahrt <ChevronRight size={11} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <QrKarussell
        open={!!qrOffen}
        onClose={() => setQrOffen(null)}
        eintraege={qrOffen?.eintraege || []}
        titel={qrOffen?.titel || ''}
      />
    </>
  );
}
