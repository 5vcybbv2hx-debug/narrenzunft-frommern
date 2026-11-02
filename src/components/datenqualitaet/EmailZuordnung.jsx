import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Check, AlertTriangle, Users, Phone } from 'lucide-react';
import { waEinladungsLink, waNummer } from '@/lib/whatsappEinladung';
import { toast } from 'sonner';

const alterVon = (geb) => {
  if (!geb) return null;
  const d = new Date(geb);
  if (Number.isNaN(d.getTime())) return null;
  const heute = new Date();
  let a = heute.getFullYear() - d.getFullYear();
  const m = heute.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && heute.getDate() < d.getDate())) a -= 1;
  return a;
};

/**
 * Klärt, welche Mailadresse zu welchem Profil gehört.
 * Eine Adresse darf nur an EINEM Profil hängen (sonst verknüpft die
 * automatische Anmeldung das falsche Profil). Familien teilen sich die
 * Adresse des zahlenden Erwachsenen; Kinder hängen über die Verwandtschaft dran.
 */
export default function EmailZuordnung({ mitglieder = [], onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [offen, setOffen] = useState(null);
  const [wahl, setWahl] = useState({}); // email -> mitglied_id, die die Adresse behält
  const [ohneMailOffen, setOhneMailOffen] = useState(false);

  const aktive = useMemo(() => mitglieder.filter(m => !m.archiviert), [mitglieder]);

  const gruppen = useMemo(() => {
    const map = new Map();
    for (const m of aktive) {
      const e = (m.email || '').trim().toLowerCase();
      if (!e) continue;
      if (!map.has(e)) map.set(e, []);
      map.get(e).push(m);
    }
    return [...map.entries()]
      .filter(([, liste]) => liste.length > 1)
      .map(([email, liste]) => {
        // Vorschlag: der älteste Erwachsene behält die Adresse
        const sortiert = [...liste].sort((a, b) => (alterVon(b.geburtsdatum) ?? 0) - (alterVon(a.geburtsdatum) ?? 0));
        return { email, liste, vorschlag: sortiert[0]?.id };
      })
      .sort((a, b) => b.liste.length - a.liste.length);
  }, [aktive]);

  const ohneMail = useMemo(
    () => aktive.filter(m => !(m.email || '').trim()).sort((a, b) => (a.nachname || '').localeCompare(b.nachname || '')),
    [aktive]
  );

  const zuordnen = async (gruppe) => {
    const behalten = wahl[gruppe.email] || gruppe.vorschlag;
    if (!behalten) { toast.error('Bitte zuerst auswählen, welches Profil die Adresse behält.'); return; }
    setBusyId(gruppe.email);
    try {
      for (const m of gruppe.liste) {
        if (m.id === behalten) {
          // Adresse am gewählten Profil sauber normalisieren
          if (m.email !== gruppe.email) await base44.entities.Mitglied.update(m.id, { email: gruppe.email });
        } else if ((m.email || '').trim().toLowerCase() === gruppe.email) {
          // Adresse beim Zweitprofil entfernen, Hinweis als Notiz
          const hinweis = `E-Mail gehört zu ${gruppe.liste.find(x => x.id === behalten)?.vorname || 'Hauptprofil'} (Familie)`;
          const notizen = m.notizen ? `${m.notizen}\n${hinweis}` : hinweis;
          await base44.entities.Mitglied.update(m.id, { email: '', notizen });
        }
      }
      toast.success('Zuordnung gespeichert: ' + gruppe.email);
      onChanged?.();
    } catch (e) {
      console.error('E-Mail-Zuordnung:', e);
      toast.error('Speichern fehlgeschlagen: ' + (e?.message || 'unbekannter Fehler'));
    }
    setBusyId(null);
  };

  if (!gruppen.length && !ohneMail.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm text-foreground flex items-center gap-2"><Check size={16} className="text-green-400" /> Jede Mailadresse gehört zu genau einem Profil.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Mail size={16} className="text-primary mt-0.5" />
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm">E-Mail-Zuordnung</h3>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Eine Adresse darf nur an einem Profil hängen. Familien nutzen die Adresse des Erwachsenen,
            Kinder werden über die Verwandtschaft zugeordnet.
          </p>
        </div>
      </div>

      {gruppen.map(g => {
        const behalten = wahl[g.email] || g.vorschlag;
        return (
          <div key={g.email} className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground truncate">{g.email}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-300 border border-amber-700/40 shrink-0">
                {g.liste.length} Profile
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Welches Profil behält die Adresse?</p>
            <div className="mt-2 space-y-1.5">
              {g.liste.map(m => {
                const gewaehlt = behalten === m.id;
                const a = alterVon(m.geburtsdatum);
                return (
                  <button
                    key={m.id}
                    onClick={() => setWahl(p => ({ ...p, [g.email]: m.id }))}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                      gewaehlt ? 'border-primary bg-primary/15 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${gewaehlt ? 'bg-primary border-primary' : 'border-muted-foreground'}`} />
                    <span className="flex-1 truncate">{m.vorname} {m.nachname}</span>
                    {a !== null && <span className="text-[11px] text-muted-foreground">{a} J.</span>}
                    {a !== null && a < 18 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Kind</span>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => zuordnen(g)}
              disabled={busyId === g.email}
              className="mt-2 w-full py-2.5 min-h-[44px] rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50"
            >
              {busyId === g.email ? 'Speichert…' : 'Zuordnung speichern'}
            </button>
          </div>
        );
      })}

      {ohneMail.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <button onClick={() => setOhneMailOffen(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
            <span className="text-sm font-medium text-foreground flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" /> Ohne Mailadresse ({ohneMail.length})
            </span>
            <span className="text-[11px] text-muted-foreground">{ohneMailOffen ? 'zuklappen' : 'anzeigen'}</span>
          </button>
          <p className="text-[11px] text-muted-foreground mt-1">Für diese Profile gibt es keine Einladung per Mail. Mit Telefonnummer direkt per WhatsApp anfragen.</p>
          {ohneMailOffen && (
            <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
              {ohneMail.map(m => {
                const nummer = (m.telefon || '').trim();
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                    <span className="flex-1 text-sm text-foreground truncate">{m.vorname} {m.nachname}</span>
                    {nummer ? (
                      <a
                        href={waEinladungsLink(nummer, m.vorname)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-400"
                      >
                        <Phone size={11} /> {waNummer(nummer) ? 'WhatsApp' : 'Nummer prüfen'}
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">keine Nummer</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {gruppen.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          Nach dem Zuordnen verschwinden die Profile aus der Dubletten-Liste im Einlade-Dialog.
        </p>
      )}
    </div>
  );
}
