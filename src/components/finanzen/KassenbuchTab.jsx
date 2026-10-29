import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { fmtDatum } from '@/lib/datum';
import {
  Plus, Search, Download, RotateCcw, Calculator, Check,
  ArrowDownCircle, ArrowUpCircle, Wallet, FileText, X,
} from 'lucide-react';
import { toast } from 'sonner';

const euro = (v) => Number(v || 0).toFixed(2).replace('.', ',') + ' €';

const KATEGORIEN = [
  'Beiträge', 'Spenden', 'Verleih', 'Veranstaltung', 'Arbeitsdienst-Ablöse',
  'Material', 'Bewirtung', 'Fahrtkosten', 'Häs & Kleidung', 'Versicherung',
  'Bankgebühren', 'Sonstiges',
];

/**
 * Kassenbuch: Buchen, Storno, Kassensturz.
 * Grundsatz: keine Löschung — Korrekturen immer als Storno-Gegenbuchung.
 */
export default function KassenbuchTab({ darfBuchen }) {
  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [daten, setDaten] = useState(null);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [suche, setSuche] = useState('');
  const [filterArt, setFilterArt] = useState('alle');
  const [formOffen, setFormOffen] = useState(false);
  const [form, setForm] = useState({
    datum: new Date().toISOString().slice(0, 10), art: 'Einnahme', betrag: '',
    kategorie: 'Beiträge', beschreibung: '', konto: 'Barkasse', beleg_url: '',
  });
  const [storno, setStorno] = useState(null);
  const [sturz, setSturz] = useState(null);
  const [busy, setBusy] = useState(false);

  const rufe = async (payload) => {
    const res = await base44.functions.invoke('verwalteKasse', payload);
    return res?.data || res;
  };

  const laden_ = async () => {
    setLaden(true);
    setFehler(null);
    try {
      const res = await rufe({ aktion: 'uebersicht', jahr: Number(jahr) });
      if (res?.error) throw new Error(res.error);
      setDaten(res);
    } catch (e) {
      console.error('Kassenbuch:', e);
      setFehler(e?.response?.data?.error || e?.message || 'Kassenbuch konnte nicht geladen werden.');
    }
    setLaden(false);
  };

  useEffect(() => { laden_(); }, [jahr]); // eslint-disable-line react-hooks/exhaustive-deps

  const buchen = async () => {
    setBusy(true);
    try {
      const res = await rufe({ aktion: 'buchen', ...form });
      if (res?.error) throw new Error(res.error);
      toast.success(`Buchung ${res.buchung?.belegnummer} gespeichert.`);
      setFormOffen(false);
      setForm((p) => ({ ...p, betrag: '', beschreibung: '', beleg_url: '' }));
      await laden_();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Buchen fehlgeschlagen.');
    }
    setBusy(false);
  };

  const stornieren = async () => {
    setBusy(true);
    try {
      const res = await rufe({ aktion: 'stornieren', id: storno?.id, grund: storno?.grund });
      if (res?.error) throw new Error(res.error);
      toast.success(`Storno gebucht (${res.storno?.belegnummer}).`);
      setStorno(null);
      await laden_();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Storno fehlgeschlagen.');
    }
    setBusy(false);
  };

  const kassensturz = async () => {
    setBusy(true);
    try {
      const res = await rufe({ aktion: 'kassensturz', ...sturz });
      if (res?.error) throw new Error(res.error);
      toast.success(`Kassensturz gespeichert. Differenz: ${euro(res.differenz)}`);
      setSturz(null);
      await laden_();
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Kassensturz fehlgeschlagen.');
    }
    setBusy(false);
  };

  const belegHochladen = async (datei) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: datei });
      setForm((p) => ({ ...p, beleg_url: file_url }));
      toast.success('Beleg angehängt.');
    } catch (e) {
      toast.error('Beleg konnte nicht hochgeladen werden.');
    }
  };

  const buchungen = daten?.buchungen || [];
  const gefiltert = useMemo(() => buchungen.filter((b) => {
    if (filterArt !== 'alle' && b.art !== filterArt) return false;
    if (!suche.trim()) return true;
    const s = suche.trim().toLowerCase();
    return String(b.belegnummer || '').toLowerCase().includes(s)
      || String(b.beschreibung || '').toLowerCase().includes(s)
      || String(b.kategorie || '').toLowerCase().includes(s);
  }), [buchungen, suche, filterArt]);

  const exportCsv = () => {
    const kopf = ['Belegnr.', 'Datum', 'Art', 'Betrag', 'Kategorie', 'Konto', 'Beschreibung', 'Gebucht von', 'Storniert'];
    const zeilen = gefiltert.map((b) => [
      b.belegnummer, fmtDatum(b.datum), b.art, Number(b.betrag || 0).toFixed(2).replace('.', ','),
      b.kategorie, b.konto || 'Barkasse', b.beschreibung, b.gebucht_von || '', b.storniert ? 'ja' : 'nein',
    ]);
    const csv = [kopf, ...zeilen].map((z) => z.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kassenbuch_${jahr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (laden) return <div className="text-sm text-muted-foreground py-6">Kassenbuch wird geladen…</div>;
  if (fehler) return <div className="text-sm text-red-400 py-6">{fehler}</div>;

  const k = daten?.kennzahlen || {};

  return (
    <div className="space-y-3">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Barkasse Bestand</p>
          <p className="text-xl font-semibold text-foreground">{euro(k.bestand_barkasse)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Bank Bestand</p>
          <p className="text-xl font-semibold text-foreground">{euro(k.bestand_bank)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Einnahmen {jahr}</p>
          <p className="text-xl font-semibold text-green-400">{euro(k.einnahmen_jahr)}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground">Ausgaben {jahr}</p>
          <p className="text-xl font-semibold text-red-400">{euro(k.ausgaben_jahr)}</p>
        </div>
      </div>

      {/* Werkzeugleiste */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Belegnr., Text, Kategorie"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground" />
        </div>
        <select value={filterArt} onChange={(e) => setFilterArt(e.target.value)}
          className="px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
          <option value="alle">alle Buchungen</option>
          <option value="Einnahme">nur Einnahmen</option>
          <option value="Ausgabe">nur Ausgaben</option>
        </select>
        <input type="number" value={jahr} onChange={(e) => setJahr(e.target.value)}
          className="w-24 px-2 py-2 rounded-lg bg-card border border-border text-sm text-foreground" />
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground">
          <Download size={13} /> CSV
        </button>
        {darfBuchen && (
          <>
            <button onClick={() => setFormOffen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold">
              <Plus size={14} /> Buchen
            </button>
            <button onClick={() => setSturz({ datum: new Date().toISOString().slice(0, 10), konto: 'Barkasse', gezaehlt: '', notiz: '', pruefer: '' })}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
              <Calculator size={13} /> Kassensturz
            </button>
          </>
        )}
      </div>

      {/* Buchungen */}
      <div className="space-y-1.5">
        {gefiltert.map((b) => {
          const istEin = b.art === 'Einnahme';
          return (
            <div key={b.id} className={`bg-card border rounded-xl px-3 py-2.5 ${b.storniert ? 'border-border opacity-60' : 'border-border'}`}>
              <div className="flex items-center gap-2.5">
                {istEin ? <ArrowUpCircle size={16} className="text-green-400 shrink-0" /> : <ArrowDownCircle size={16} className="text-red-400 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">
                    {b.beschreibung}
                    {b.storniert && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">storniert</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.belegnummer} · {fmtDatum(b.datum)} · {b.kategorie} · {b.konto || 'Barkasse'}
                    {b.gebucht_von ? ` · ${b.gebucht_von}` : ''}
                    {b.storno_grund ? ` · Grund: ${b.storno_grund}` : ''}
                  </p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${istEin ? 'text-green-400' : 'text-red-400'}`}>
                  {istEin ? '+' : '−'}{euro(b.betrag)}
                </span>
                {darfBuchen && !b.storniert && (
                  <button onClick={() => setStorno({ id: b.id, belegnummer: b.belegnummer, grund: '' })}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Stornieren">
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
              {b.beleg_url && (
                <a href={b.beleg_url} target="_blank" rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <FileText size={11} /> Beleg ansehen
                </a>
              )}
            </div>
          );
        })}
        {!gefiltert.length && <p className="text-sm text-muted-foreground text-center py-6">Noch keine Buchungen in diesem Jahr.</p>}
      </div>

      {/* Kassenstürze */}
      {daten?.kassenstuerze?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Wallet size={13} className="text-primary" /> Kassenstürze</p>
          <div className="space-y-1">
            {daten.kassenstuerze.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-foreground">{fmtDatum(s.datum)} · {s.konto || 'Barkasse'}{s.pruefer ? ` · ${s.pruefer}` : ''}</span>
                <span className={Math.abs(Number(s.differenz || 0)) > 0.004 ? 'text-yellow-400' : 'text-green-400'}>
                  Soll {euro(s.soll)} / Ist {euro(s.gezaehlt)} → {euro(s.differenz)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buchen-Dialog */}
      {formOffen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setFormOffen(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-2.5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-oswald uppercase tracking-wide text-foreground">Buchung erfassen</h3>
              <button onClick={() => setFormOffen(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="flex gap-1.5">
              {['Einnahme', 'Ausgabe'].map((art) => (
                <button key={art} onClick={() => setForm((p) => ({ ...p, art }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${form.art === art ? 'bg-primary text-white border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {art}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Datum</label>
                <input type="date" value={form.datum} onChange={(e) => setForm((p) => ({ ...p, datum: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Betrag (€)</label>
                <input value={form.betrag} onChange={(e) => setForm((p) => ({ ...p, betrag: e.target.value }))} inputMode="decimal" placeholder="0,00"
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground text-right" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Kategorie</label>
                <select value={form.kategorie} onChange={(e) => setForm((p) => ({ ...p, kategorie: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground">
                  {KATEGORIEN.map((kat) => <option key={kat} value={kat}>{kat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Konto</label>
                <select value={form.konto} onChange={(e) => setForm((p) => ({ ...p, konto: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground">
                  <option value="Barkasse">Barkasse</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Beschreibung</label>
              <input value={form.beschreibung} onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
                placeholder="z. B. Mitgliedsbeiträge Barzahlung Häsabstauben"
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Beleg (Foto/PDF, optional)</label>
              <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files?.[0] && belegHochladen(e.target.files[0])}
                className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-secondary file:text-foreground" />
              {form.beleg_url && <p className="text-[11px] text-green-400 flex items-center gap-1 mt-1"><Check size={11} /> Beleg angehängt</p>}
            </div>
            <p className="text-[11px] text-muted-foreground">Die Belegnummer vergibt das System fortlaufend. Löschen ist nicht möglich, Korrekturen laufen über Storno.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setFormOffen(false)} className="flex-1 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground">Abbrechen</button>
              <button onClick={buchen} disabled={busy} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">Buchen</button>
            </div>
          </div>
        </div>
      )}

      {/* Storno-Dialog */}
      {storno && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setStorno(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-oswald uppercase tracking-wide text-foreground">Buchung {storno.belegnummer} stornieren</h3>
            <p className="text-xs text-muted-foreground">Es wird eine Gegenbuchung erzeugt. Die Originalbuchung bleibt mit Storno-Vermerk erhalten.</p>
            <div>
              <label className="text-[11px] text-muted-foreground">Grund (Pflicht)</label>
              <input value={storno.grund} onChange={(e) => setStorno((p) => ({ ...p, grund: e.target.value }))}
                placeholder="z. B. falscher Betrag, doppelt erfasst"
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStorno(null)} className="flex-1 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground">Abbrechen</button>
              <button onClick={stornieren} disabled={busy || !storno.grund?.trim()} className="flex-1 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold disabled:opacity-50">Stornieren</button>
            </div>
          </div>
        </div>
      )}

      {/* Kassensturz-Dialog */}
      {sturz && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSturz(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-oswald uppercase tracking-wide text-foreground">Kassensturz</h3>
            <p className="text-xs text-muted-foreground">Soll-Bestand laut Kassenbuch: <span className="text-foreground font-medium">{euro(daten?.kennzahlen?.[`bestand_${(sturz.konto || 'Barkasse').toLowerCase()}`])}</span></p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Datum</label>
                <input type="date" value={sturz.datum} onChange={(e) => setSturz((p) => ({ ...p, datum: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Konto</label>
                <select value={sturz.konto} onChange={(e) => setSturz((p) => ({ ...p, konto: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground">
                  <option value="Barkasse">Barkasse</option>
                  <option value="Bank">Bank</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Gezählter Bestand (€)</label>
              <input value={sturz.gezaehlt} onChange={(e) => setSturz((p) => ({ ...p, gezaehlt: e.target.value }))} inputMode="decimal" placeholder="0,00"
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground text-right" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Anwesende Prüfer</label>
              <input value={sturz.pruefer} onChange={(e) => setSturz((p) => ({ ...p, pruefer: e.target.value }))}
                placeholder="Namen der Kassenprüfer"
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">Notiz</label>
              <input value={sturz.notiz} onChange={(e) => setSturz((p) => ({ ...p, notiz: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-md bg-background border border-border text-sm text-foreground" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSturz(null)} className="flex-1 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground">Abbrechen</button>
              <button onClick={kassensturz} disabled={busy || sturz.gezaehlt === ''} className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
