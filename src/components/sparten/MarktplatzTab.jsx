import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { Store, Plus, Trash2, Check, X, Pencil, Power } from 'lucide-react';

/**
 * MarktplatzTab – Kleinanzeigen innerhalb der Gruppe (von Verantwortlichen
 * aktivierbar). Jede/r darf Angebote einstellen; bearbeiten/löschen darf die/
 * der Anbieter:in selbst (RLS) und die Verwaltung.
 */
export default function MarktplatzTab({ gruppe, gruppeId, myMitglied, alleMitglieder, canEditGruppe, onGruppeGeaendert }) {
  const { user } = useAuth();
  const [angebote, setAngebote] = useState([]);
  const [laden, setLaden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [neu, setNeu] = useState(null); // { titel, beschreibung, preis }
  const [bearbeite, setBearbeite] = useState(null);

  const istVorstand = ['admin', 'vorstand', 'stellv_vorstand'].includes(user?.role);
  const aktiv = gruppe?.marktplatz_aktiv === true;

  const ladenFn = async () => {
    setLaden(true);
    try {
      const a = await base44.entities.MarktplatzAngebot.filter({ haesgruppe_id: gruppeId });
      setAngebote((a || []).filter(x => x.status !== 'Entfernt'));
    } catch (e) {
      console.error('Marktplatz:', e);
      toast.error('Marktplatz konnte nicht geladen werden.');
    } finally { setLaden(false); }
  };

  useEffect(() => { ladenFn(); /* eslint-disable-line */ }, [gruppeId]);

  const nameVon = (id) => {
    const m = (alleMitglieder || []).find(x => x.id === id);
    return m ? [m.vorname, m.nachname].filter(Boolean).join(' ') : 'Unbekannt';
  };

  const umschalten = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('verwalteTanzDaten', {
        typ: 'marktplatz', aktion: 'update', haesgruppe_id: gruppeId,
        marktplatz_aktiv: !aktiv,
      });
      if (res?.data?.error || res?.error) throw new Error(res?.data?.error || res?.error);
      toast.success(!aktiv ? 'Marktplatz aktiviert.' : 'Marktplatz deaktiviert.');
      onGruppeGeaendert?.();
    } catch (e) { toast.error(e.message || 'Umschalten fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const speichern = async () => {
    const form = bearbeite || neu;
    if (!form?.titel?.trim()) { toast.error('Bitte einen Titel eingeben.'); return; }
    setBusy(true);
    try {
      const payload = {
        haesgruppe_id: gruppeId,
        mitglied_id: myMitglied.id,
        mitglied_name: nameVon(myMitglied.id),
        titel: form.titel.trim(),
        beschreibung: (form.beschreibung || '').trim(),
        preis: form.preis === '' || form.preis === undefined ? '' : Number(form.preis),
        status: 'Aktiv',
      };
      if (bearbeite) await base44.entities.MarktplatzAngebot.update(bearbeite.id, payload);
      else await base44.entities.MarktplatzAngebot.create(payload);
      setNeu(null); setBearbeite(null);
      await ladenFn();
      toast.success(bearbeite ? 'Angebot aktualisiert.' : 'Angebot eingestellt.');
    } catch (e) { toast.error(e.message || 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const statusSetzen = async (a, status) => {
    setBusy(true);
    try {
      await base44.entities.MarktplatzAngebot.update(a.id, { status });
      await ladenFn();
      toast.success(status === 'Verkauft' ? 'Als verkauft markiert.' : 'Angebot entfernt.');
    } catch (e) { toast.error(e.message || 'Fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const loeschen = async (a) => {
    setBusy(true);
    try {
      await base44.entities.MarktplatzAngebot.delete(a.id);
      await ladenFn();
      toast.success('Angebot gelöscht.');
    } catch (e) { toast.error(e.message || 'Löschen fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const darfBearbeiten = (a) => istVorstand || (myMitglied && a.mitglied_id === myMitglied.id);
  const aktive = angebote.filter(a => a.status === 'Aktiv');
  const verkauft = angebote.filter(a => a.status === 'Verkauft');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-oswald uppercase tracking-wide text-foreground flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" /> Marktplatz
        </h2>
        {canEditGruppe && (
          <button onClick={umschalten} disabled={busy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${aktiv ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-secondary text-muted-foreground border-border'}`}>
            <Power className="w-3.5 h-3.5" /> {aktiv ? 'Aktiv' : 'Deaktiviert'}
          </button>
        )}
      </div>

      {!aktiv ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Der Marktplatz ist deaktiviert. {canEditGruppe ? 'Mit dem Schalter oben aktivierst du ihn für die Gruppe.' : 'Verantwortliche können ihn aktivieren.'}
        </div>
      ) : (
        <>
          {myMitglied && !neu && !bearbeite && (
            <button onClick={() => setNeu({ titel: '', beschreibung: '', preis: '' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Angebot einstellen
            </button>
          )}

          {(neu || bearbeite) && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{bearbeite ? 'Angebot bearbeiten' : 'Neues Angebot'}</p>
              <input value={(bearbeite || neu).titel} onChange={e => (bearbeite ? setBearbeite({ ...bearbeite, titel: e.target.value }) : setNeu({ ...neu, titel: e.target.value }))} placeholder="Titel (z. B. Sweatjacke Gr. M)"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              <textarea value={(bearbeite || neu).beschreibung} onChange={e => (bearbeite ? setBearbeite({ ...bearbeite, beschreibung: e.target.value }) : setNeu({ ...neu, beschreibung: e.target.value }))} rows={3} placeholder="Beschreibung / Zustand"
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              <div className="flex gap-2">
                <input type="number" step="0.01" min="0" value={(bearbeite || neu).preis ?? ''} onChange={e => (bearbeite ? setBearbeite({ ...bearbeite, preis: e.target.value }) : setNeu({ ...neu, preis: e.target.value }))} placeholder="Preis (€, leer = VB/geschenkt)"
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                <button onClick={speichern} disabled={busy}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">Speichern</button>
                <button onClick={() => { setNeu(null); setBearbeite(null); }}
                  className="px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {laden ? (
            <p className="text-sm text-muted-foreground">Lade Angebote…</p>
          ) : aktive.length === 0 && verkauft.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
              Noch keine Angebote. Stell als Erstes etwas ein!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aktive.map(a => (
                <div key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{a.titel}</h3>
                    <span className="text-sm font-bold text-primary shrink-0">{a.preis === '' || a.preis === undefined ? 'VB' : `${Number(a.preis).toFixed(2)} €`}</span>
                  </div>
                  {a.beschreibung && <p className="text-xs text-muted-foreground whitespace-pre-line">{a.beschreibung}</p>}
                  <p className="text-[10px] text-muted-foreground">von {a.mitglied_name || nameVon(a.mitglied_id)}</p>
                  {darfBearbeiten(a) && (
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={() => setBearbeite({ ...a })} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-[11px] hover:text-primary"><Pencil className="w-3 h-3" /> Bearbeiten</button>
                      <button onClick={() => statusSetzen(a, 'Verkauft')} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500/15 text-green-400 text-[11px] font-medium"><Check className="w-3 h-3" /> Verkauft</button>
                      <button onClick={() => loeschen(a)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-[11px] hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              ))}
              {verkauft.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Verkauft</p>
                  <div className="space-y-1">
                    {verkauft.map(a => (
                      <div key={a.id} className="flex items-center gap-2 text-xs bg-card border border-border rounded-lg px-3 py-2">
                        <Check className="w-3 h-3 text-green-400 shrink-0" />
                        <span className="text-muted-foreground line-through flex-1 truncate">{a.titel}</span>
                        <span className="text-muted-foreground shrink-0">{a.mitglied_name || nameVon(a.mitglied_id)}</span>
                        {darfBearbeiten(a) && <button onClick={() => loeschen(a)} disabled={busy} className="p-1 rounded-lg text-muted-foreground hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
