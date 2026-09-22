import { useState } from 'react';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const TYP_ICON = {
  Sitzung: '🏛️', TOP: '📋', Abstimmung: '🗳️', Beschluss: '⚖️',
  Aufgabe: '✅', Protokoll: '📝', Jahresplan: '📅',
};

export default function AuditLogListe({ logs, mitglieder, onObjektClick }) {
  const [zeigeAlle, setZeigeAlle] = useState(false);
  const list = logs || [];
  const shown = zeigeAlle ? list : list.slice(0, 8);

  const nameVon = (id) => { const m = (mitglieder || []).find(x => x.id === id); return m ? `${m.vorname} ${m.nachname}` : ''; };

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
        <History size={13} /> Änderungsverlauf
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Noch keine Einträge.</p>
      ) : (
        <div className="space-y-1.5">
          {shown.map((l) => (
            <div key={l.id} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 mt-0.5">{TYP_ICON[l.objekt_typ] || '•'}</span>
              <div className="min-w-0 flex-1">
                <span className="text-foreground font-medium">{l.aktion}</span>
                {l.details && l.details !== '{}' && l.details !== '""' && (
                  <span className="text-muted-foreground"> — {l.details.length > 60 ? l.details.slice(0, 60) + '…' : l.details}</span>
                )}
              </div>
              <span className="text-muted-foreground shrink-0 text-right">
                {nameVon(l.mitglied_id) && <span className="block truncate max-w-[100px]">{nameVon(l.mitglied_id)}</span>}
                {l.zeitpunkt && <span className="block">{format(new Date(l.zeitpunkt), 'dd.MM. HH:mm', { locale: de })}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {list.length > 8 && (
        <button onClick={() => setZeigeAlle(p => !p)} className="mt-2 text-xs text-primary hover:underline">
          {zeigeAlle ? 'Weniger' : `Alle ${list.length} anzeigen`}
        </button>
      )}
    </div>
  );
}