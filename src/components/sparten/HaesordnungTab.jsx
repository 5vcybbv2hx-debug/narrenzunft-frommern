import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Shirt, Pencil, Plus, ArrowUp, ArrowDown, Trash2, X, Save, Loader2, Building2, User as UserIcon } from 'lucide-react';

/**
 * HaesordnungTab – Häsordnung im Sinne von KLEIDERORDNUNG:
 * Die verbindliche Liste der Hästeile, aus denen das komplette Häs einer
 * Gruppe besteht (z. B. Jacke, Hose, Handschuhe, Schuhe) — inkl. wer das
 * Teil beschafft (Verein / Selbstbeschaffung).
 *
 * Lesbar für alle mit Gruppenzugriff; pflegen dürfen Verantwortliche der
 * Gruppe und Vorstand (verwalteTanzDaten, typ 'haesordnung').
 * Speicherformat: Haesgruppe.haesordnung = JSON-Array
 * [{ titel, beschreibung, beschaffung: 'verein'|'selbst', notiz }]
 */
const parseOrdnung = (raw) => {
  try { const a = JSON.parse(raw || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : []; } catch { return []; }
};

export default function HaesordnungTab({ gruppe, canEdit }) {
  const [ordnung, setOrdnung] = useState(() => parseOrdnung(gruppe?.haesordnung));
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setOrdnung(parseOrdnung(gruppe?.haesordnung)); }, [gruppe?.haesordnung]);

  const speichern = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'haesordnung', aktion: 'update', haesgruppe_id: gruppe.id,
        haesordnung: JSON.stringify(ordnung.filter(x => x.titel?.trim())),
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      setEdit(false);
      toast.success('Häsordnung gespeichert.');
    } catch (e) {
      toast.error(e.message || 'Speichern fehlgeschlagen.');
    } finally { setBusy(false); }
  };

  const teilAendern = (i, feld, wert) => {
    setOrdnung(v => v.map((x, j) => (i === j ? { ...x, [feld]: wert } : x)));
  };

  const verschieben = (i, richtung) => {
    const j = i + richtung;
    if (j < 0 || j >= ordnung.length) return;
    setOrdnung(v => { const n = [...v]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-oswald uppercase tracking-wide text-foreground flex items-center gap-2">
          <Shirt className="w-5 h-5 text-primary" /> Häsordnung
        </h2>
        <span className="text-sm text-muted-foreground">{ordnung.length} {ordnung.length === 1 ? 'Hästeil' : 'Hästeile'}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Kleiderordnung: Diese Teile gehören zum kompletten Häs der Gruppe.
        {canEdit && !edit && ' Pflegen mit „Bearbeiten“.'}
      </p>

      {!edit ? (
        ordnung.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
            Noch keine Häsordnung hinterlegt.{canEdit && ' Lege mit „Bearbeiten“ die zugehörigen Hästeile fest.'}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {ordnung.map((t, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.titel}</p>
                  {t.beschreibung && <p className="text-xs text-muted-foreground">{t.beschreibung}</p>}
                  {t.notiz && <p className="text-xs text-muted-foreground italic">{t.notiz}</p>}
                </div>
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  t.beschaffung === 'selbst'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-secondary text-muted-foreground border border-border'}`}>
                  {t.beschaffung === 'selbst' ? <><UserIcon className="w-2.5 h-2.5" /> Selbst</> : <><Building2 className="w-2.5 h-2.5" /> Verein</>}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {ordnung.map((t, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input value={t.titel || ''} onChange={e => teilAendern(i, 'titel', e.target.value)} placeholder="Hästeil (z. B. Gardejacke)"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                <button onClick={() => verschieben(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30" title="Nach vorne"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => verschieben(i, 1)} disabled={i === ordnung.length - 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30" title="Nach hinten"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => setOrdnung(v => v.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400" title="Entfernen"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <input value={t.beschreibung || ''} onChange={e => teilAendern(i, 'beschreibung', e.target.value)} placeholder="Beschreibung (Farbe, Schnitt, Details…)"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button onClick={() => teilAendern(i, 'beschaffung', 'verein')}
                    className={`px-2.5 py-1.5 text-xs font-medium ${t.beschaffung !== 'selbst' ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                    Verein
                  </button>
                  <button onClick={() => teilAendern(i, 'beschaffung', 'selbst')}
                    className={`px-2.5 py-1.5 text-xs font-medium ${t.beschaffung === 'selbst' ? 'bg-amber-500 text-white' : 'bg-secondary text-muted-foreground'}`}>
                    Selbstbeschaffung
                  </button>
                </div>
                <input value={t.notiz || ''} onChange={e => teilAendern(i, 'notiz', e.target.value)} placeholder="Notiz (z. B. Bezugsquelle)"
                  className="flex-1 min-w-32 px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
              </div>
            </div>
          ))}
          <button onClick={() => setOrdnung(v => [...v, { titel: '', beschreibung: '', beschaffung: 'verein', notiz: '' }])}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25">
            <Plus className="w-4 h-4" /> Hästeil hinzufügen
          </button>
          <div className="flex gap-2 pt-2">
            <button onClick={speichern} disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
            </button>
            <button onClick={() => { setOrdnung(parseOrdnung(gruppe?.haesordnung)); setEdit(false); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm">
              <X className="w-4 h-4" /> Abbrechen
            </button>
          </div>
        </div>
      )}

      {canEdit && !edit && (
        <button onClick={() => setEdit(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25">
          <Pencil className="w-3.5 h-3.5" /> Bearbeiten
        </button>
      )}
    </div>
  );
}
