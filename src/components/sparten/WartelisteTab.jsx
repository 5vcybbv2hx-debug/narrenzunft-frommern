import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, ArrowUp, ArrowDown, Check, Trash2, Loader2, ListOrdered } from 'lucide-react';

/**
 * WartelisteTab – Interessenten mit Kontaktdaten (Kinder UND Erwachsene),
 * pro Gruppe. Nur für Verantwortliche und Vorstand sichtbar.
 * Speichern über verwalteTanzDaten, typ 'warteliste' (Berechtigungsprüfung
 * serverseitig). Reihenfolge = Warteposition, "Aufgenommen" schließt ab.
 */
export default function WartelisteTab({ gruppeId }) {
  const [eintraege, setEintraege] = useState([]);
  const [laden, setLaden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', kontakt: '', geburtsdatum: '', eltern_name: '', notiz: '' });

  const ladenFn = async () => {
    setLaden(true);
    try {
      const e = await base44.entities.Warteliste.filter({ haesgruppe_id: gruppeId });
      const sortiert = [...(e || [])].sort((a, b) => (a.status === 'Wartend' ? 0 : 1) - (b.status === 'Wartend' ? 0 : 1) || (a.position ?? 99) - (b.position ?? 99));
      setEintraege(sortiert);
    } catch (e) {
      console.error('Warteliste:', e);
      toast.error('Warteliste konnte nicht geladen werden.');
    } finally { setLaden(false); }
  };

  useEffect(() => { ladenFn(); /* eslint-disable-line */ }, [gruppeId]);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke('verwalteTanzDaten', { haesgruppe_id: gruppeId, ...payload });
    if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
  };

  const anlegen = async () => {
    if (!form.name.trim()) { toast.error('Bitte einen Namen eintragen.'); return; }
    setBusy(true);
    try {
      await invoke({ typ: 'warteliste', aktion: 'create', ...form });
      setForm({ name: '', kontakt: '', geburtsdatum: '', eltern_name: '', notiz: '' });
      await ladenFn();
      toast.success('Interessent:in auf die Warteliste gesetzt.');
    } catch (e) { toast.error(e.message || 'Anlegen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const statusSetzen = async (e, status) => {
    setBusy(true);
    try {
      await invoke({ typ: 'warteliste', aktion: 'update', eintrag_id: e.id, status });
      await ladenFn();
      toast.success(status === 'Aufgenommen' ? 'Als aufgenommen markiert.' : 'Status gesetzt.');
    } catch (err) { toast.error(err.message || 'Fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const loeschen = async (e) => {
    setBusy(true);
    try {
      await invoke({ typ: 'warteliste', aktion: 'delete', eintrag_id: e.id });
      await ladenFn();
      toast.success('Eintrag gelöscht.');
    } catch (err) { toast.error(err.message || 'Löschen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const verschieben = async (e, richtung) => {
    const wartend = eintraege.filter(x => x.status === 'Wartend');
    const i = wartend.findIndex(x => x.id === e.id);
    const j = i + richtung;
    if (i < 0 || j < 0 || j >= wartend.length) return;
    setBusy(true);
    try {
      // Positionen tauschen (nur innerhalb der Wartenden)
      await invoke({ typ: 'warteliste', aktion: 'update', eintrag_id: wartend[i].id, position: wartend[j].position });
      await invoke({ typ: 'warteliste', aktion: 'update', eintrag_id: wartend[j].id, position: wartend[i].position });
      await ladenFn();
    } catch (err) { toast.error(err.message || 'Verschieben fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const wartende = eintraege.filter(x => x.status === 'Wartend');
  const aufgenommen = eintraege.filter(x => x.status === 'Aufgenommen');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-oswald uppercase tracking-wide text-foreground flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-primary" /> Warteliste
        </h2>
        <span className="text-sm text-muted-foreground">{wartende.length} wartend · {aufgenommen.length} aufgenommen</span>
      </div>
      <p className="text-xs text-muted-foreground">Interessent:innen (Kinder und Erwachsene) mit Kontaktdaten. Nur für Verantwortliche sichtbar.</p>

      {/* Neu-Anlage */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Interessent:in eintragen</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name *"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          <input value={form.kontakt} onChange={e => setForm({ ...form, kontakt: e.target.value })} placeholder="Kontakt (Telefon / E-Mail)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          <input value={form.geburtsdatum} onChange={e => setForm({ ...form, geburtsdatum: e.target.value })} type="date" placeholder="Geburtsdatum"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          <input value={form.eltern_name} onChange={e => setForm({ ...form, eltern_name: e.target.value })} placeholder="Erziehungsberechtigte:r (bei U18)"
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <input value={form.notiz} onChange={e => setForm({ ...form, notiz: e.target.value })} placeholder="Notiz (z. B. Erfahrungen, Wunschtermin)"
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
        <button onClick={anlegen} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
          <Plus className="w-4 h-4" /> Auf Warteliste
        </button>
      </div>

      {laden ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Warteliste…
        </div>
      ) : wartende.length === 0 && aufgenommen.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Noch keine Interessent:innen eingetragen.
        </div>
      ) : (
        <>
          {wartende.length > 0 && (
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
              {wartende.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[e.kontakt, e.geburtsdatum, e.eltern_name].filter(Boolean).join(' · ')}
                    </p>
                    {e.notiz && <p className="text-xs text-muted-foreground italic truncate">{e.notiz}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => verschieben(e, -1)} disabled={busy || i === 0} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30" title="Nach vorne"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => verschieben(e, 1)} disabled={busy || i === wartende.length - 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30" title="Nach hinten"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => statusSetzen(e, 'Aufgenommen')} disabled={busy} className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/10" title="Aufgenommen"><Check className="w-4 h-4" /></button>
                    <button onClick={() => loeschen(e)} disabled={busy} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {aufgenommen.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Aufgenommen (abgeschlossen)</p>
              <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {aufgenommen.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-xs flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{[e.kontakt, e.eltern_name].filter(Boolean).join(' · ')}</p>
                    </div>
                    <button onClick={() => loeschen(e)} disabled={busy} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
