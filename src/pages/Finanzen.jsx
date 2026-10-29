import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannBankdatenSehn } from '@/lib/roles';
import { fmtDatum } from '@/lib/datum';
import { Wallet, Search, Download, Save, AlertCircle, Check, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import KassenbuchTab from '@/components/finanzen/KassenbuchTab';
import { kannKasseSehn, kannKasseBuchen } from '@/lib/roles';

const euro = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';

/**
 * Finanzbereich — Stufe 2: Kassenbuch, SEPA-Mandate und Lastschriftlauf.
 * Zugriff: Vorstand, Stellv., Kassierer, Kassenprüfer (nur lesend), Admin.
 */
export default function Finanzen() {
  const { user } = useAuth();
  const darf = kannBankdatenSehn(user) || kannKasseSehn(user);
  const darfBuchen = kannKasseBuchen(user);
  const istPruefer = darf && !darfBuchen;

  const [tab, setTab] = useState('kasse');
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [daten, setDaten] = useState(null); // { konfiguration, zeilen, mit_mandat, ohne_mandat }
  const [suche, setSuche] = useState('');
  const [nurOhne, setNurOhne] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(null);
  const [konfOffen, setKonfOffen] = useState(false);
  const [konf, setKonf] = useState(null);
  const [beitraege, setBeitraege] = useState([]);
  const [laufJahr, setLaufJahr] = useState(new Date().getFullYear());
  const [faelligkeit, setFaelligkeit] = useState('');
  const [auswahl, setAuswahl] = useState({});
  const [laufErgebnis, setLaufErgebnis] = useState(null);
  const [busy, setBusy] = useState(false);

  const rufe = async (payload) => {
    const res = await base44.functions.invoke('verwalteSepa', payload);
    return res?.data || res;
  };

  const laden_ = async () => {
    // Kassenprüfer haben keinen SEPA-Zugriff – das Kassenbuch lädt sich selbst
    if (!darfBuchen) { setLaden(false); return; }
    setLaden(true);
    setFehler(null);
    try {
      const uebersicht = await rufe({ aktion: 'uebersicht' });
      if (uebersicht?.error) throw new Error(uebersicht.error);
      setDaten(uebersicht);
      setKonf(uebersicht.konfiguration);
      const js = await base44.entities.Beitrag.filter({ jahr: Number(laufJahr) }).catch(() => []);
      setBeitraege(js || []);
    } catch (e) {
      console.error('Finanzen:', e);
      setFehler(e?.response?.data?.error || e?.message || 'Daten konnten nicht geladen werden.');
    }
    setLaden(false);
  };

  useEffect(() => { if (darf) laden_(); }, [darf]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!darf || !darfBuchen) return;
    base44.entities.Beitrag.filter({ jahr: Number(laufJahr) }).then((d) => setBeitraege(d || [])).catch(() => setBeitraege([]));
  }, [laufJahr, darf, darfBuchen]);

  const zeilen = daten?.zeilen || [];
  const gefiltert = useMemo(() => zeilen.filter((z) => {
    if (nurOhne && z.hat_mandat) return false;
    if (!suche.trim()) return true;
    const s = suche.trim().toLowerCase();
    return z.name.toLowerCase().includes(s) || (z.iban || '').toLowerCase().includes(s) || String(z.mitgliedsnummer || '').includes(s);
  }), [zeilen, suche, nurOhne]);

  const mandatSpeichern = async () => {
    setBusy(true);
    try {
      const res = await rufe({ aktion: 'mandat_speichern', ...bearbeiten });
      if (res?.error) throw new Error(res.error);
      toast.success('Bankverbindung gespeichert.');
      setBearbeiten(null);
      await laden_();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Speichern fehlgeschlagen.');
    }
    setBusy(false);
  };

  const konfigurationSpeichern = async () => {
    setBusy(true);
    try {
      const res = await rufe({ aktion: 'konfiguration_speichern', ...konf });
      if (res?.error) throw new Error(res.error);
      toast.success('SEPA-Konfiguration gespeichert.');
      setKonfOffen(false);
      await laden_();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Speichern fehlgeschlagen.');
    }
    setBusy(false);
  };

  // Offene Beiträge des Jahres mit Mandat als Vorschlag
  const offene = useMemo(() => {
    const mitMandat = new Map(zeilen.map((z) => [z.mitglied_id, z]));
    return beitraege
      .filter((b) => ['Offen', 'Überfällig'].includes(b.zahlungsstatus || 'Offen'))
      .filter((b) => (b.betrag || 0) > 0)
      .map((b) => {
        const z = mitMandat.get(b.mitglied_id);
        return {
          id: b.id,
          mitglied_id: b.mitglied_id,
          name: z?.name || 'Unbekannt',
          betrag: b.betrag,
          verwendungszweck: `Beitrag ${b.jahr}`,
          mandat: Boolean(z?.hat_mandat),
          iban: z?.iban || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [beitraege, zeilen]);

  const ausgewaehlt = offene.filter((o) => auswahl[o.id] && o.mandat);
  const summeAuswahl = ausgewaehlt.reduce((s, o) => s + Number(o.betrag || 0), 0);

  const laufStarten = async () => {
    if (!ausgewaehlt.length) { toast.error('Keine einreichbaren Beträge ausgewählt.'); return; }
    if (!faelligkeit) { toast.error('Bitte ein Fälligkeitsdatum wählen.'); return; }
    setBusy(true);
    try {
      const res = await rufe({
        aktion: 'lastschriftlauf',
        jahr: laufJahr,
        faelligkeit,
        eintraege: ausgewaehlt.map((o) => ({ mitglied_id: o.mitglied_id, betrag: o.betrag, verwendungszweck: o.verwendungszweck })),
      });
      if (res?.error) throw new Error(res.error);
      setLaufErgebnis(res);
      const blob = new Blob([res.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SEPA_Lastschrift_${laufJahr}_${faelligkeit}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Lastschriftlauf erzeugt: ${res.anzahl} Einzüge, ${euro(res.summe)}.`);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Lastschriftlauf fehlgeschlagen.');
    }
    setBusy(false);
  };

  if (!darf) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Der Finanzbereich ist dem Vorstand und dem Kassierer vorbehalten.</p>
      </div>
    );
  }

  if (laden) return <div className="p-6 text-sm text-muted-foreground">Finanzbereich wird geladen…</div>;
  if (fehler) return <div className="p-6 text-sm text-red-400">{fehler}</div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-oswald text-2xl uppercase tracking-wide text-foreground flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> Finanzen
        </h1>
        <button onClick={laden_} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw size={13} /> Aktualisieren
        </button>
      </div>

      {/* Kennzahlen (Kassenprüfer sehen nur das Kassenbuch) */}
      {!istPruefer && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">Mandate vorhanden</p>
            <p className="text-xl font-semibold text-foreground">{daten?.mit_mandat || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">Ohne Mandat</p>
            <p className="text-xl font-semibold text-foreground">{daten?.ohne_mandat || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">Mitglieder gesamt</p>
            <p className="text-xl font-semibold text-foreground">{daten?.anzahl || 0}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground">Offene Beiträge {laufJahr}</p>
            <p className="text-xl font-semibold text-primary">{euro(offene.reduce((s, o) => s + Number(o.betrag || 0), 0))}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide">
        {(istPruefer
          ? [['kasse', 'Kassenbuch']]
          : [['kasse', 'Kassenbuch'], ['mandate', 'SEPA-Mandate'], ['lauf', 'Lastschriftlauf'], ['konfiguration', 'Einstellungen']]
        ).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === id ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'kasse' && <KassenbuchTab darfBuchen={darfBuchen} />}

      {tab === 'mandate' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, IBAN oder Mitgliedsnummer"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground" />
            </div>
            <button onClick={() => setNurOhne(!nurOhne)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border ${nurOhne ? 'bg-primary text-white border-primary' : 'bg-card border-border text-muted-foreground'}`}>
              nur ohne Mandat ({daten?.ohne_mandat || 0})
            </button>
          </div>

          <div className="space-y-1.5">
            {gefiltert.map((z) => (
              <div key={z.mitglied_id} className="bg-card border border-border rounded-xl px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {z.name}
                      {z.mitgliedsnummer ? <span className="text-muted-foreground"> · #{z.mitgliedsnummer}</span> : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {z.hat_mandat
                        ? `${z.iban}${z.kontoinhaber ? ` · ${z.kontoinhaber}` : ''}${z.sepa_mandatdatum ? ` · Mandat ${fmtDatum(z.sepa_mandatdatum)}` : ''}`
                        : 'kein Mandat hinterlegt'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {z.hat_mandat
                      ? <span className="text-green-400"><Check size={15} /></span>
                      : <span className="text-yellow-400"><AlertCircle size={15} /></span>}
                    <button onClick={() => setBearbeiten({ ...z })}
                      className="px-2 py-1 rounded-md bg-secondary border border-border text-[11px] text-muted-foreground hover:text-foreground">
                      bearbeiten
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!gefiltert.length && <p className="text-sm text-muted-foreground text-center py-6">Keine Treffer.</p>}
          </div>
        </div>
      )}

      {tab === 'lauf' && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Beitragsjahr</label>
                <input type="number" value={laufJahr} onChange={(e) => setLaufJahr(e.target.value)}
                  className="w-24 px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Fälligkeit (Einzug)</label>
                <input type="date" value={faelligkeit} onChange={(e) => setFaelligkeit(e.target.value)}
                  className="px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
              </div>
              <div className="flex-1" />
              <button onClick={laufStarten} disabled={busy || !ausgewaehlt.length || !faelligkeit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
                <Download size={14} /> pain.008 erzeugen ({ausgewaehlt.length} · {euro(summeAuswahl)})
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nur Mitglieder mit Mandat sind einreichbar. Die Datei wird heruntergeladen und bei der Bank hochgeladen;
              die Vorabankündigung an die Mitglieder muss {daten?.konfiguration?.vorabankuendigung_tage || 14} Tage vorher raus sein.
            </p>
          </div>

          <div className="space-y-1.5">
            {offene.map((o) => (
              <label key={o.id} className={`flex items-center gap-3 bg-card border rounded-xl px-3 py-2.5 ${o.mandat ? 'border-border' : 'border-yellow-700/30 opacity-70'}`}>
                <input type="checkbox" disabled={!o.mandat} checked={Boolean(auswahl[o.id])}
                  onChange={(e) => setAuswahl((p) => ({ ...p, [o.id]: e.target.checked }))}
                  className="w-4 h-4 accent-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{o.name}</p>
                  <p className="text-[11px] text-muted-foreground">{o.mandat ? o.iban : 'kein Mandat'}</p>
                </div>
                <span className="text-sm text-foreground shrink-0">{euro(o.betrag)}</span>
              </label>
            ))}
            {!offene.length && <p className="text-sm text-muted-foreground text-center py-6">Keine offenen Beiträge für {laufJahr}.</p>}
          </div>

          {laufErgebnis?.fehler?.length > 0 && (
            <div className="bg-card border border-yellow-700/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-400 mb-1">Nicht aufgenommen ({laufErgebnis.fehler.length})</p>
              {laufErgebnis.fehler.map((f, i) => <p key={i} className="text-[11px] text-muted-foreground">{f}</p>)}
            </div>
          )}
        </div>
      )}

      {tab === 'konfiguration' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2.5 max-w-xl">
          <p className="text-xs text-muted-foreground">
            Diese Angaben braucht jeder Lastschriftlauf: Gläubiger-ID der Bank, Vereins-IBAN und der Name, der auf dem Kontoauszug erscheint.
          </p>
          {[
            ['glaeubiger_id', 'Gläubiger-ID (z. B. DE98ZZZ09999999999)'],
            ['vereinsname', 'Name des Vereins (Kontoauszug)'],
            ['iban_verein', 'IBAN des Vereins'],
            ['bic_verein', 'BIC des Vereins'],
            ['vorabankuendigung_tage', 'Vorabankündigung (Tage)'],
          ].map(([feld, label]) => (
            <div key={feld}>
              <label className="text-[11px] text-muted-foreground">{label}</label>
              <input value={konf?.[feld] ?? ''} onChange={(e) => setKonf((p) => ({ ...p, [feld]: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
          ))}
          <div>
            <label className="text-[11px] text-muted-foreground">Sequenztyp</label>
            <select value={konf?.sequenz_typ || 'RCUR'} onChange={(e) => setKonf((p) => ({ ...p, sequenz_typ: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground">
              <option value="RCUR">RCUR – Folgelastschrift (Standard)</option>
              <option value="FRST">FRST – erste Lastschrift</option>
              <option value="OOFF">OOFF – einmalig</option>
              <option value="FNAL">FNAL – letzte Lastschrift</option>
            </select>
          </div>
          <button onClick={konfigurationSpeichern} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
            <Save size={14} /> Speichern
          </button>
        </div>
      )}

      {/* Mandat bearbeiten */}
      {bearbeiten && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setBearbeiten(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-oswald uppercase tracking-wide text-foreground">Bankverbindung · {bearbeiten.name}</h3>
            {[['kontoinhaber', 'Kontoinhaber'], ['iban', 'IBAN'], ['bic', 'BIC'], ['bankname', 'Bank'], ['sepa_mandatnummer', 'Mandatsreferenz']].map(([feld, label]) => (
              <div key={feld}>
                <label className="text-[11px] text-muted-foreground">{label}</label>
                <input value={bearbeiten[feld] ?? ''} onChange={(e) => setBearbeiten((p) => ({ ...p, [feld]: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
              </div>
            ))}
            <div>
              <label className="text-[11px] text-muted-foreground">Mandatsdatum</label>
              <input type="date" value={bearbeiten.sepa_mandatdatum || ''} onChange={(e) => setBearbeiten((p) => ({ ...p, sepa_mandatdatum: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBearbeiten(null)} className="flex-1 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground">Abbrechen</button>
              <button onClick={mandatSpeichern} disabled={busy} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}