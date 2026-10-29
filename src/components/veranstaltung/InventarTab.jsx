import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Package, Plus, Trash2, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import MobileSelect from '@/components/MobileSelect';
import { fmtDatum } from '@/lib/datum';

/**
 * Inventar für die eigene Veranstaltung: Vereins-Ausrüstung direkt reservieren.
 *
 * Legt Ausleihen an (status 'Reserviert') mit veranstaltung_id — dadurch ist der
 * Gegenstand am Veranstaltungstag für andere Verleih-Anfragen belegt und taucht
 * in der Inventar-Liste auf. Verfügbarkeit wird über Zeitraum-Überlappung geprüft.
 */
export default function InventarTab({ veranstaltung, meinMitglied, kannBearbeiten }) {
  const [ausruestungen, setAusruestungen] = useState([]);
  const [reservierungen, setReservierungen] = useState([]);
  const [alleAusleihen, setAlleAusleihen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [itemId, setItemId] = useState('');
  const [anzahl, setAnzahl] = useState('1');
  const [busy, setBusy] = useState(false);

  const datum = veranstaltung?.datum || '';

  const lade = async () => {
    setLoading(true);
    setFehler(null);
    try {
      const [ausr, res, all] = await Promise.all([
        base44.entities.Ausruestung.list('name', 500).catch(() => []),
        base44.entities.Ausleihe.filter({ veranstaltung_id: veranstaltung.id }).catch(() => []),
        base44.entities.Ausleihe.list('-von_datum', 500).catch(() => []),
      ]);
      setAusruestungen((ausr || []).filter(a => a.aktiv !== false));
      setReservierungen(res || []);
      setAlleAusleihen(all || []);
    } catch (e) {
      console.error('Inventar laden:', e);
      setFehler('Inventar konnte nicht geladen werden.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (veranstaltung?.id) lade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veranstaltung?.id]);

  // Belegung am Veranstaltungstag (Zeitraum-Überlappung, inkl. dieser Reservierungen)
  const belegtAm = useMemo(() => (ausruestungId) => alleAusleihen
    .filter(al => al.ausruestung_id === ausruestungId
      && ['Reserviert', 'Ausgeliehen'].includes(al.status)
      && al.von_datum && al.bis_datum && datum
      && al.von_datum <= datum && al.bis_datum >= datum)
    .reduce((sum, al) => sum + (al.anzahl || 1), 0), [alleAusleihen, datum]);

  const freiFuer = (a) => Math.max(0, (a.bestand ?? 1) - belegtAm(a.id));

  const nameVon = (id) => ausruestungen.find(a => a.id === id)?.name || 'Unbekannt';

  const optionen = useMemo(() => [
    { label: '– Gegenstand wählen –', value: '' },
    ...ausruestungen
      .filter(a => (a.bestand ?? 1) > 0)
      .map(a => ({ label: `${a.name} · ${freiFuer(a)} von ${a.bestand ?? 1} frei`, value: a.id })),
  ], [ausruestungen, belegtAm]); // eslint-disable-line react-hooks/exhaustive-deps

  const reservieren = async () => {
    if (!itemId) { toast.error('Bitte einen Gegenstand wählen.'); return; }
    if (!datum) { toast.error('Die Veranstaltung hat noch kein Datum.'); return; }
    const gewaehlt = ausruestungen.find(a => a.id === itemId);
    const stueck = Math.max(1, parseInt(anzahl, 10) || 1);
    const frei = gewaehlt ? freiFuer(gewaehlt) : 0;
    if (stueck > frei) {
      toast.error(`Nur ${frei} Stück von „${gewaehlt?.name}" frei am ${fmtDatum(datum)}.`);
      return;
    }
    setBusy(true);
    try {
      const neu = await base44.entities.Ausleihe.create({
        ausruestung_id: itemId,
        ausleiher_typ: 'intern',
        ausleiher_mitglied_id: meinMitglied?.id || '',
        veranstaltung_id: veranstaltung.id,
        von_datum: datum,
        bis_datum: datum,
        zweck: `Veranstaltung: ${veranstaltung.titel || ''}`.trim(),
        status: 'Reserviert',
        anzahl: stueck,
        verantwortlicher_id: meinMitglied?.id || '',
      });
      setReservierungen(prev => [neu, ...prev]);
      setAlleAusleihen(prev => [neu, ...prev]);
      setItemId('');
      setAnzahl('1');
      toast.success('Inventar für die Veranstaltung reserviert.');
    } catch (e) {
      console.error('Reservieren:', e);
      toast.error('Reservieren fehlgeschlagen: ' + (e?.response?.data?.message || e?.message || 'Unbekannter Fehler'));
    }
    setBusy(false);
  };

  const aufheben = async (res) => {
    if (!(await confirmDialog(`Reservierung „${nameVon(res.ausruestung_id)}" (${res.anzahl || 1} Stück) aufheben?`))) return;
    try {
      await base44.entities.Ausleihe.delete(res.id);
      setReservierungen(prev => prev.filter(r => r.id !== res.id));
      setAlleAusleihen(prev => prev.filter(r => r.id !== res.id));
      toast.success('Reservierung aufgehoben.');
    } catch (e) {
      console.error('Reservierung aufheben:', e);
      toast.error('Aufheben fehlgeschlagen.');
    }
  };

  if (loading) return <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground">Inventar wird geladen…</div>;
  if (fehler) return <div className="bg-card border border-border rounded-xl p-6 text-sm text-red-400">{fehler}</div>;

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-secondary/60 border border-border flex items-start gap-2">
        <Info size={14} className="text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Hier reservierte Gegenstände sind am Veranstaltungstag
          {datum ? ` (${fmtDatum(datum)})` : ''} für den Verein geblockt — externe Verleih-Anfragen sehen sie als nicht verfügbar.
        </p>
      </div>

      {kannBearbeiten && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package size={15} className="text-primary" /> Gegenstand reservieren
          </h3>
          <MobileSelect value={itemId} onChange={setItemId} options={optionen} placeholder="– Gegenstand wählen –" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stück</span>
            <input
              type="number" min="1" step="1" inputMode="numeric"
              value={anzahl} onChange={(e) => setAnzahl(e.target.value)}
              className="w-20 px-2 py-1.5 min-h-[40px] rounded-md bg-background border border-border text-sm text-foreground text-right focus:outline-none focus:border-primary"
            />
            <button
              onClick={reservieren} disabled={busy || !itemId || !datum}
              className="flex-1 py-2 min-h-[40px] rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> {busy ? 'Reserviere…' : 'Reservieren'}
            </button>
          </div>
          {!datum && (
            <p className="text-xs text-yellow-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> Erst das Veranstaltungsdatum setzen, dann reservieren.
            </p>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Reserviert für diese Veranstaltung ({reservierungen.length})
        </h3>
        {reservierungen.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Noch nichts reserviert.</p>
        ) : (
          <div className="space-y-1.5">
            {reservierungen.map(res => (
              <div key={res.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{nameVon(res.ausruestung_id)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {res.anzahl || 1} Stück · {fmtDatum(res.von_datum)}
                    {res.status ? ` · ${res.status}` : ''}
                  </p>
                </div>
                {kannBearbeiten && (
                  <button
                    onClick={() => aufheben(res)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    title="Reservierung aufheben"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
