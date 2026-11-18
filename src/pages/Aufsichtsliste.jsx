import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Printer, ShieldCheck, AlertTriangle, Check, Clock, XCircle } from 'lucide-react';
import { istU18 } from '@/lib/u18Begleitung';
import { kannAusfahrtCheckin } from '@/lib/roles';

/**
 * Aufsichtsliste für den Bus (Vorstand, Busverantwortliche).
 *
 * Zeigt zu jeder angemeldeten U18-Person, wer die Aufsicht hat und ob beide
 * Seiten bestätigt haben. Kinder ohne Aufsicht werden ausdrücklich gelistet -
 * genau die braucht man an der Bustür. Druckansicht ist bewusst hell und
 * schwarz auf weiß, damit sie am Bus lesbar ist.
 */
function datumKurz(iso) {
  if (!iso) return '';
  const d = String(iso).slice(0, 10).split('-');
  return d.length === 3 ? `${d[2]}.${d[1]}.${d[0]}` : '';
}

export default function Aufsichtsliste() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ausfahrt, setAusfahrt] = useState(null);
  const [zeilen, setZeilen] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    let abbruch = false;
    (async () => {
      try {
        const a = await base44.entities.Ausfahrt.get(id).catch(() => null);
        if (!a) { if (!abbruch) setLaden(false); return; }
        if (!abbruch) setAusfahrt(a);

        const [anmeldungen, auftraege, mitglieder] = await Promise.all([
          base44.entities.AusfahrtAnmeldung.filter({ ausfahrt_id: id }).catch(() => []),
          base44.entities.U18Begleitung.filter({ termin_id: id }).catch(() => []),
          base44.entities.Mitglied.list('nachname', 1000).catch(() => []),
        ]);
        const mMap = {};
        for (const m of (mitglieder || [])) mMap[m.id] = m;
        const offeneAuftraege = (auftraege || []).filter(x => x.typ === 'ausfahrt');

        const rows = [];
        for (const anm of (anmeldungen || [])) {
          if (anm.status === 'Abgemeldet' || !anm.mitglied_id) continue;
          const m = mMap[anm.mitglied_id];
          if (!m) continue;
          if (!istU18(m.geburtsdatum, a.datum)) continue;
          const auftrag = offeneAuftraege.find(x => x.u18_mitglied_id === anm.mitglied_id);
          rows.push({
            kind: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
            kindId: m.id,
            aufsicht: auftrag?.begleit_name || '',
            status: auftrag ? (auftrag.status || 'Ausstehend') : 'Ohne Aufsicht',
            elternAm: auftrag?.eltern_bestaetigt_am || '',
            aufsichtAm: auftrag?.begleitung_bestaetigt_am || '',
            checkin: anm.status === 'Eingecheckt',
            notiz: auftrag?.notiz || '',
          });
        }
        rows.sort((x, y) => x.kind.localeCompare(y.kind, 'de'));
        if (!abbruch) { setZeilen(rows); setLaden(false); }
      } catch (e) {
        console.error('Aufsichtsliste:', e);
        if (!abbruch) setLaden(false);
      }
    })();
    return () => { abbruch = true; };
  }, [id]);

  const bestaetigt = zeilen.filter(z => z.status === 'Bestätigt').length;
  const offen = zeilen.filter(z => z.status === 'Ausstehend').length;
  const ohne = zeilen.filter(z => z.status === 'Ohne Aufsicht').length;
  const abgegeben = zeilen.filter(z => z.status === 'Abgelehnt').length;

  // Zugriff: Verwaltung oder Busverantwortliche dieser Ausfahrt.
  const [meinId, setMeinId] = useState(user?._mitglied?.id || null);
  useEffect(() => {
    if (meinId || !user) return;
    let abbruch = false;
    (async () => {
      try {
        const t = await base44.entities.Mitglied.filter({ user_id: user.id });
        let m = (t || [])[0];
        if (!m && user.email) {
          const perMail = await base44.entities.Mitglied.filter({ email: user.email });
          m = (perMail || [])[0];
        }
        if (!abbruch && m) setMeinId(m.id);
      } catch (e) { /* egal, Zugriff wird unten verweigert */ }
    })();
    return () => { abbruch = true; };
  }, [meinId, user]);

  const istVerwaltung = kannAusfahrtCheckin(user);
  const istBusverantwortlich = !!meinId && (ausfahrt?.bus_verantwortliche || []).includes(meinId);
  const darfSehen = istVerwaltung || istBusverantwortlich;

  if (laden) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!ausfahrt) {
    return (
      <div className="px-4 py-10 text-center text-muted-foreground text-sm">
        Ausfahrt nicht gefunden. <Link to="/ausfahrten" className="text-primary underline">Zurück</Link>
      </div>
    );
  }

  if (!darfSehen) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Die Aufsichtsliste sehen nur der Vorstand und die Busverantwortlichen dieser Ausfahrt.
        </p>
        <Link to={`/ausfahrten/${id}`} className="inline-block mt-3 text-sm text-primary underline">Zurück zur Ausfahrt</Link>
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 max-w-4xl mx-auto">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .aufsicht-nicht-drucken { display: none !important; }
          .aufsicht-print { position: static !important; color: #000 !important; background: #fff !important; }
          .aufsicht-print * { color: #000 !important; background: #fff !important; border-color: #999 !important; box-shadow: none !important; }
          .aufsicht-print table { border-collapse: collapse; width: 100%; font-size: 11pt; }
          .aufsicht-print th, .aufsicht-print td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
          .aufsicht-print thead { display: table-header-group; }
          .aufsicht-print tr { page-break-inside: avoid; }
          @page { size: A4 portrait; margin: 12mm; }
        }
      `}</style>

      <div className="aufsicht-nicht-drucken flex items-center justify-between gap-2 mb-4 flex-wrap">
        <Link to={`/ausfahrten/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[36px]">
          <ArrowLeft size={16} /> Zurück zur Ausfahrt
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-red-700 min-h-[40px]"
        >
          <Printer size={15} /> Drucken
        </button>
      </div>

      <div className="aufsicht-print bg-card border border-border rounded-xl p-4">
        <div className="flex items-start gap-2 mb-1">
          <ShieldCheck size={18} className="text-primary mt-0.5 shrink-0" />
          <div>
            <h1 className="font-oswald uppercase tracking-wide text-lg text-foreground">Aufsichtsliste</h1>
            <p className="text-sm text-foreground">{ausfahrt.titel}</p>
            <p className="text-xs text-muted-foreground">
              {datumKurz(ausfahrt.datum)}
              {ausfahrt.abfahrt_zeit ? ` · Abfahrt ${ausfahrt.abfahrt_zeit}` : ''}
              {ausfahrt.abfahrt_ort ? ` · ${ausfahrt.abfahrt_ort}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 my-3 text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
            <Check size={10} /> {bestaetigt} bestätigt
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            <Clock size={10} /> {offen} offen
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle size={10} /> {ohne} ohne Aufsicht
          </span>
          {abgegeben > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              <XCircle size={10} /> {abgegeben} abgegeben
            </span>
          )}
        </div>

        {zeilen.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Keine U18-Personen für diese Ausfahrt angemeldet.
          </p>
        ) : (
          <>
            {/* Mobil: Karten */}
            <div className="sm:hidden space-y-2">
              {zeilen.map(z => (
                <div key={z.kindId} className="border border-border rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{z.kind}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      z.status === 'Bestätigt' ? 'bg-green-500/20 text-green-400'
                        : z.status === 'Ohne Aufsicht' || z.status === 'Abgelehnt' ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {z.status === 'Abgelehnt' ? 'Abgegeben' : z.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Aufsicht: {z.aufsicht || <span className="text-red-400">fehlt</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Eltern {z.elternAm ? datumKurz(z.elternAm) : 'offen'} · Aufsicht {z.aufsichtAm ? datumKurz(z.aufsichtAm) : 'offen'}
                    {z.checkin ? ' · eingecheckt' : ''}
                  </p>
                </div>
              ))}
            </div>

            {/* Desktop und Druck: Tabelle */}
            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-2">Kind</th>
                  <th className="py-2 pr-2">Aufsicht</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Eltern</th>
                  <th className="py-2 pr-2">Aufsicht</th>
                  <th className="py-2">Check-in</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map(z => (
                  <tr key={z.kindId} className="border-b border-border/60">
                    <td className="py-2 pr-2 text-foreground font-medium">{z.kind}</td>
                    <td className="py-2 pr-2 text-foreground">{z.aufsicht || <span className="text-red-400">fehlt</span>}</td>
                    <td className="py-2 pr-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        z.status === 'Bestätigt' ? 'bg-green-500/20 text-green-400'
                          : z.status === 'Ohne Aufsicht' || z.status === 'Abgelehnt' ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {z.status === 'Abgelehnt' ? 'Abgegeben' : z.status}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">{z.elternAm ? datumKurz(z.elternAm) : 'offen'}</td>
                    <td className="py-2 pr-2 text-muted-foreground">{z.aufsichtAm ? datumKurz(z.aufsichtAm) : 'offen'}</td>
                    <td className="py-2 text-muted-foreground">{z.checkin ? 'ja' : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="text-[10px] text-muted-foreground mt-3">
          Stand: {datumKurz(new Date().toISOString())}
          {istVerwaltung ? '' : ' · Nur Ansicht'}
        </p>
      </div>
    </div>
  );
}
