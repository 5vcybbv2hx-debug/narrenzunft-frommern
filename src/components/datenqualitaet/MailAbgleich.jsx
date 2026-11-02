import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Upload, Check, AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const normal = (t) => String(t || '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z]/g, '');

/**
 * Mailadressen-Abgleich: eine gepflegte Liste (Excel/CSV) gegen die Profile prüfen
 * und die Adressen aus der Liste übernehmen. Zeigt vorher jede Änderung an.
 *
 * Erwartetes Format je Zeile: Nachname, Vorname, E-Mail (Tab, Semikolon oder Komma).
 */
export default function MailAbgleich({ mitglieder = [], onChanged }) {
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState('');
  const [pruefung, setPruefung] = useState(null);
  const [busy, setBusy] = useState(false);

  const aktive = useMemo(() => mitglieder.filter((m) => !m.archiviert), [mitglieder]);

  const parse = () => {
    const zeilen = text.split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
    const ergebnis = [];

    for (const zeile of zeilen) {
      const teile = zeile.split(/[\t;,]|\s{2,}/).map((t) => t.trim()).filter(Boolean);
      if (!teile.length) continue;
      if (/^nachname$/i.test(teile[0])) continue;

      const mail = teile.find((t) => EMAIL_RE.test(t)) || '';
      const namen = teile.filter((t) => t !== mail);
      if (!namen.length && !mail) continue;

      let treffer = [];
      if (mail) {
        treffer = aktive.filter((m) => (m.email || '').trim().toLowerCase() === mail.toLowerCase());
      }
      if (!treffer.length && namen.length) {
        const nachname = normal(namen[0]);
        const vorname = normal(namen[1] || '');
        treffer = aktive.filter((m) => {
          if (normal(m.nachname) !== nachname) return false;
          if (!vorname) return true;
          const vn = normal(m.vorname);
          return vn.startsWith(vorname) || vorname.startsWith(vn) || vn.startsWith(vorname.slice(0, 4));
        });
      }

      ergebnis.push({
        zeile,
        mail,
        namen,
        treffer,
        mitglied: treffer.length === 1 ? treffer[0] : null,
        status: treffer.length === 1 ? 'treffer' : treffer.length > 1 ? 'mehrdeutig' : 'unbekannt',
      });
    }

    // Adressen, die schon an einem anderen Profil hängen
    const mailBesitzer = new Map();
    aktive.forEach((m) => {
      const e = (m.email || '').trim().toLowerCase();
      if (e) {
        if (!mailBesitzer.has(e)) mailBesitzer.set(e, []);
        mailBesitzer.get(e).push(m);
      }
    });

    const aenderungen = [];
    const warnungen = [];
    for (const e of ergebnis) {
      if (!e.mitglied || !e.mail) continue;
      const alt = (e.mitglied.email || '').trim();
      if (alt.toLowerCase() === e.mail.toLowerCase()) continue;
      const fremd = (mailBesitzer.get(e.mail.toLowerCase()) || []).filter((m) => m.id !== e.mitglied.id);
      aenderungen.push({
        id: e.mitglied.id,
        name: `${e.mitglied.vorname || ''} ${e.mitglied.nachname || ''}`.trim(),
        alt,
        neu: e.mail,
        fremd: fremd.map((m) => `${m.vorname} ${m.nachname}`.trim()),
      });
      if (fremd.length) {
        warnungen.push(`${e.mail} hängt aktuell auch an ${fremd.map((m) => `${m.vorname} ${m.nachname}`.trim()).join(', ')}`);
      }
    }

    setPruefung({
      zeilen: ergebnis.length,
      treffer: ergebnis.filter((e) => e.status === 'treffer').length,
      mehrdeutig: ergebnis.filter((e) => e.status === 'mehrdeutig'),
      unbekannt: ergebnis.filter((e) => e.status === 'unbekannt'),
      ohneMailInListe: ergebnis.filter((e) => e.status === 'treffer' && !e.mail),
      aenderungen,
      warnungen,
      auswahl: Object.fromEntries(aenderungen.map((a, i) => [i, true])),
    });
  };

  const uebernehmen = async () => {
    if (!pruefung) return;
    const zuTun = pruefung.aenderungen.filter((_, i) => pruefung.auswahl[i]);
    if (!zuTun.length) { toast.error('Keine Änderung ausgewählt.'); return; }
    setBusy(true);
    let ok = 0;
    const fehler = [];
    for (const a of zuTun) {
      try {
        await base44.entities.Mitglied.update(a.id, { email: a.neu });
        ok += 1;
      } catch (err) {
        fehler.push(`${a.name}: ${err?.message || 'Fehler'}`);
      }
    }
    setBusy(false);
    toast.success(`${ok} Mailadresse${ok === 1 ? '' : 'n'} aktualisiert${fehler.length ? `, ${fehler.length} fehlgeschlagen` : ''}`);
    setPruefung((p) => ({ ...p, ergebnis: { ok, fehler } }));
    onChanged?.();
  };

  const zeile = (a, i) => (
    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
      <input
        type="checkbox"
        checked={Boolean(pruefung.auswahl[i])}
        onChange={(e) => setPruefung((p) => ({ ...p, auswahl: { ...p.auswahl, [i]: e.target.checked } }))}
        className="mt-1 w-4 h-4 accent-primary shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground truncate">{a.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {a.alt ? <span className="line-through">{a.alt}</span> : <span className="italic">leer</span>}
          {' → '}
          <span className="text-green-400">{a.neu}</span>
        </p>
        {a.fremd.length > 0 && (
          <p className="text-[11px] text-yellow-400 flex items-center gap-1">
            <AlertTriangle size={10} /> hängt auch an {a.fremd.join(', ')}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <button onClick={() => setOffen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2">
          <Mail size={16} className="text-primary" />
          <span>
            <span className="block text-sm font-semibold text-foreground">Mailadressen aus Liste abgleichen</span>
            <span className="block text-[11px] text-muted-foreground">Gepflegte Liste einfügen, Abweichungen prüfen, übernehmen</span>
          </span>
        </span>
        {offen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {offen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setPruefung(null); }}
            rows={5}
            placeholder={'Bechtold\tNicole\tnicole.bechtold@web.de\nBitzer\tHeinz\t'}
            className="w-full px-2 py-1.5 rounded-md bg-secondary border border-border text-xs text-foreground font-mono"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              Spalten: Nachname, Vorname, E-Mail. Kopfzeile wird übersprungen.
            </p>
            <button onClick={parse} disabled={!text.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold disabled:opacity-40">
              <Upload size={12} /> Prüfen
            </button>
          </div>

          {pruefung && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                {pruefung.zeilen} Zeilen · {pruefung.treffer} eindeutig zugeordnet · {pruefung.aenderungen.length} Abweichungen
              </p>

              {pruefung.aenderungen.length > 0 && (
                <div className="rounded-lg border border-border bg-secondary/40 p-2 max-h-72 overflow-y-auto">
                  {pruefung.aenderungen.map(zeile)}
                </div>
              )}

              {pruefung.ohneMailInListe.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Ohne Adresse in der Liste ({pruefung.ohneMailInListe.length}): {pruefung.ohneMailInListe.map((e) => e.namen.join(' ')).join(', ')}
                </p>
              )}
              {pruefung.mehrdeutig.length > 0 && (
                <p className="text-[11px] text-yellow-400">
                  Mehrdeutig ({pruefung.mehrdeutig.length}): {pruefung.mehrdeutig.map((e) => e.namen.join(' ') || e.zeile).join(', ')}
                </p>
              )}
              {pruefung.unbekannt.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Kein Profil gefunden ({pruefung.unbekannt.length}): {pruefung.unbekannt.map((e) => e.namen.join(' ') || e.zeile).join(', ')}
                </p>
              )}

              {pruefung.ergebnis && (
                <div className="rounded-lg border border-green-700/40 bg-green-900/20 px-3 py-2 text-xs text-green-300 flex items-center gap-1.5">
                  <Check size={13} /> {pruefung.ergebnis.ok} übernommen
                  {pruefung.ergebnis.fehler.length > 0 && ` · ${pruefung.ergebnis.fehler.length} fehlgeschlagen`}
                </div>
              )}

              {pruefung.aenderungen.length > 0 && (
                <button onClick={uebernehmen} disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {busy ? 'Übernimmt…' : `${Object.values(pruefung.auswahl).filter(Boolean).length} Änderungen übernehmen`}
                </button>
              )}

              {pruefung.aenderungen.length === 0 && (
                <p className="text-xs text-green-400 flex items-center gap-1.5">
                  <Check size={13} /> Alle Adressen in der Liste stimmen mit den Profilen überein.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// Gegenstück zu EmailZuordnung: dort Dubletten, hier eingehende Listen.