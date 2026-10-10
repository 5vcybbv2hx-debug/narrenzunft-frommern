import { useState, useRef, useEffect, useCallback } from 'react';
import { Drama, ListOrdered, Music, ChevronDown, Pause, Square } from 'lucide-react';
import FigurenTab from './FigurenTab';
import AblaufTab from './AblaufTab';
import MusikTab from './MusikTab';

/**
 * TanzTab – Figuren, Ablauf und Musik/Zeitmarker auf EINER Seite.
 *
 * Die drei Bereiche sind als Accordion aufgebaut: Immer nur der Abschnitt
 * ist aufgeklappt, an dem gerade gearbeitet wird (Rest bleibt kurz).
 * Alle drei bleiben aber eingehängt (nur per CSS versteckt), damit die
 * Musik WEITERLÄUFT, während z. B. im Ablauf sortiert wird — gesteuert
 * über die kleine Player-Leiste.
 *
 * Der zuletzt geöffnete Abschnitt wird pro Gruppe gemerkt (localStorage)
 * und beim Wiederkehren automatisch wieder aufgeklappt.
 */

const ABSCHNITTE = [
  { id: 'figuren', label: 'Figuren', sub: 'Aufstellungen & Figuren-Bibliothek', Icon: Drama },
  { id: 'ablauf', label: 'Ablauf', sub: 'Reihenfolge der Tanzschritte', Icon: ListOrdered },
  { id: 'musik', label: 'Musik & Zeitmarker', sub: 'Stücke, Marker & Üben-Loop', Icon: Music },
];

const SPEICHER_KEY = (gruppeId) => `nzf_tanz_abschnitt_${gruppeId}`;

export default function TanzTab({ gruppeId, alleMitglieder, canEdit }) {
  const [offen, setOffen] = useState(() => {
    try { return localStorage.getItem(SPEICHER_KEY(gruppeId)) || 'figuren'; } catch { return 'figuren'; }
  });

  // Sprungwunsch aus Figuren/Ablauf: {musik_id, zeit} → Musik-Abschnitt spielt den Teil im Loop
  const [uebungswunsch, setUebungswunsch] = useState(null);

  // Spielstand der Musik: {musikId, titel, playing} — gemeldet vom MusikTab
  const [spielstand, setSpielstand] = useState(null);
  // Fernbedienung für die Player-Leiste: {toggle, stop} — vom MusikTab registriert
  const playerApi = useRef(null);

  const oeffne = useCallback((abschnitt) => {
    setOffen(abschnitt);
    try { localStorage.setItem(SPEICHER_KEY(gruppeId), abschnitt); } catch { /* localStorage optional */ }
  }, [gruppeId]);

  // Sprungwunsch aus Figuren/Ablauf: Musik-Abschnitt aufklappen und Abschnitt üben
  const uebeMusik = useCallback((musik_id, zeit) => {
    setUebungswunsch({ musik_id, zeit });
    oeffne('musik');
  }, [oeffne]);

  const wunschVerbraucht = useCallback(() => setUebungswunsch(null), []);

  // Beim Gruppenwechsel: gemerkten Abschnitt neu laden, Spielstand zurücksetzen
  useEffect(() => {
    try { setOffen(localStorage.getItem(SPEICHER_KEY(gruppeId)) || 'figuren'); } catch { setOffen('figuren'); }
    setSpielstand(null);
  }, [gruppeId]);

  const musikLaeuft = spielstand?.playing === true;

  return (
    <div className="space-y-3">
      {/* Abschnitts-Header (Accordion) */}
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {ABSCHNITTE.map(({ id, label, sub, Icon }) => {
          const istOffen = offen === id;
          return (
            <div key={id}>
              <button
                onClick={() => !istOffen && oeffne(id)}
                aria-expanded={istOffen}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${istOffen ? 'bg-primary/10' : 'hover:bg-secondary'}`}
              >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${istOffen ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary border-border text-muted-foreground'}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-white">{label}</span>
                  <span className="block text-xs text-muted-foreground truncate">{sub}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${istOffen ? 'rotate-180' : ''}`} />
              </button>
              {/* Inhalt bleibt immer eingehängt (nur versteckt), damit laufende Musik nicht stoppt */}
              <div className={istOffen ? 'p-4' : 'hidden'}>
                {id === 'figuren' && (
                  <FigurenTab gruppeId={gruppeId} alleMitglieder={alleMitglieder} canEdit={canEdit} onUebeMusik={uebeMusik} />
                )}
                {id === 'ablauf' && (
                  <AblaufTab gruppeId={gruppeId} canEdit={canEdit} onUebeMusik={uebeMusik} />
                )}
                {id === 'musik' && (
                  <MusikTab gruppeId={gruppeId} canEdit={canEdit} uebungswunsch={uebungswunsch} onWunschVerbraucht={wunschVerbraucht} playerApi={playerApi} onSpielstand={setSpielstand} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini-Player: sichtbar, solange Musik läuft und der Musik-Abschnitt gerade zu ist */}
      {musikLaeuft && offen !== 'musik' && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-20 md:bottom-6 z-40 flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border border-primary/40 bg-card shadow-lg max-w-[92vw]">
          <Music className="w-4 h-4 text-primary shrink-0 animate-pulse" />
          <button onClick={() => oeffne('musik')} className="text-xs font-medium text-white truncate max-w-[40vw]" title="Musik-Abschnitt öffnen">
            {spielstand.titel}
          </button>
          <button
            onClick={() => playerApi.current?.toggle()}
            className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary/90"
            title="Pause / Weiter"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => playerApi.current?.stop()}
            className="w-8 h-8 rounded-full bg-secondary border border-border text-muted-foreground flex items-center justify-center shrink-0 hover:text-white"
            title="Stoppen"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
