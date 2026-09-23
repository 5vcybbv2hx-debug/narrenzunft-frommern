import { useState } from 'react';
import { Search, CheckSquare, Gavel, FileText, CalendarClock, AlertTriangle, ChevronRight, ListChecks } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * Ausschuss-Cockpit — erster Tab.
 * Kacheln als klickbare Filter/Shortcuts; globale Suche über alle Objekte.
 */
export default function CockpitTab({ data, onNavigate, onOpenSitzung, onFilterAufgaben, canManage }) {
  const [suche, setSuche] = useState('');
  const { termine, aufgaben, beschluesse, protokolle, antraege, veranstaltungen, tops, abstimmungen, currentMitgliedId, mitglieder } = data;

  const today = format(new Date(), 'yyyy-MM-dd');
  const sitzungen = termine || [];

  const naechsteSitzung = sitzungen.find(t => t.datum >= today) || sitzungen[sitzungen.length - 1] || null;
  const naechsteTops = naechsteSitzung ? (tops || []).filter(t => t.termin_id === naechsteSitzung.id) : [];
  const agendaFortschritt = naechsteTops.length > 0
    ? Math.round((naechsteTops.filter(t => t.status !== 'Offen').length / naechsteTops.length) * 100)
    : 0;

  const ueberfaelligeAufgaben = (aufgaben || []).filter(a => a.status !== 'Erledigt' && a.status !== 'Abgebrochen' && a.faellig_am && a.faellig_am < today);
  const offeneBeschluesse = (beschluesse || []).filter(b => b.status === 'Offen');
  const fehlendeProtokolle = sitzungen.filter(t => t.datum < today && !(protokolle || []).some(p => p.termin_id === t.id));
  const offeneAntraege = (antraege || []).filter(a => a.status === 'Eingereicht' || a.status === 'In Pruefung' || !a.status);
  const nachbereitung = (veranstaltungen || []).filter(v => v.nachbereitung_status === 'Ausstehend');
  const meineAufgaben = (aufgaben || []).filter(a => a.verantwortlicher_id === currentMitgliedId && a.status !== 'Erledigt' && a.status !== 'Abgebrochen');

  // Globale Suche
  const q = suche.trim().toLowerCase();
  const treffer = [];
  if (q.length >= 2) {
    const inFeld = (val) => String(val || '').toLowerCase().includes(q);
    const mitgliedName = (id) => { const m = (mitglieder || []).find(x => x.id === id); return m ? `${m.vorname} ${m.nachname}` : ''; };
    (sitzungen || []).forEach(t => { if (inFeld(t.titel) || inFeld(t.beschreibung) || inFeld(t.ort)) treffer.push({ typ: 'Sitzung', id: t.id, label: t.titel, sub: format(new Date(t.datum), 'dd.MM.yyyy'), go: () => onOpenSitzung(t.id) }); });
    (tops || []).forEach(t => { if (inFeld(t.titel) || inFeld(t.beschreibung) || inFeld(t.notizen)) treffer.push({ typ: 'TOP', id: t.id, label: t.titel, sub: inFeld(t.notizen) ? 'Notiz' : '', go: () => onOpenSitzung(t.termin_id) }); });
    (beschluesse || []).forEach(b => { if (inFeld(b.titel) || inFeld(b.inhalt) || inFeld(b.notizen)) treffer.push({ typ: 'Beschluss', id: b.id, label: b.titel, sub: b.beschlussnummer || '', go: () => onNavigate('beschluesse') }); });
    (aufgaben || []).forEach(a => { if (inFeld(a.titel) || inFeld(a.beschreibung) || inFeld(a.notizen) || inFeld(a.fortschritt_notiz) || inFeld(mitgliedName(a.verantwortlicher_id))) treffer.push({ typ: 'Aufgabe', id: a.id, label: a.titel, sub: a.status, go: () => onNavigate('aufgaben') }); });
    (protokolle || []).forEach(p => { if (inFeld(p.titel) || inFeld(p.inhalt)) treffer.push({ typ: 'Protokoll', id: p.id, label: p.titel, sub: format(new Date(p.datum), 'dd.MM.yyyy'), go: () => onNavigate('protokolle') }); });
    (antraege || []).forEach(a => { if (inFeld(a.vorname) || inFeld(a.nachname) || inFeld(a.email)) treffer.push({ typ: 'Antrag', id: a.id, label: `${a.vorname || ''} ${a.nachname || ''}`.trim(), sub: a.status, go: () => onNavigate('antraege') }); });
  }

  const Kachel = ({ icon: Icon, label, count, warn, accent, onClick }) => (
    <button onClick={onClick}
      className={`text-left bg-card border rounded-xl p-3 transition-colors hover:border-primary/40 ${warn && count > 0 ? 'border-red-700/40' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <Icon size={16} className={warn && count > 0 ? 'text-red-400' : accent ? 'text-primary' : 'text-muted-foreground'} />
        <span className={`text-2xl font-bold font-oswald ${warn && count > 0 ? 'text-red-400' : 'text-foreground'}`}>{count}</span>
      </div>
      <p className="text-[11px] uppercase tracking-wide font-oswald text-muted-foreground leading-tight">{label}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Suche */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" placeholder="Sitzungen, TOPs, Beschlüsse, Aufgaben, Protokolle, Anträge durchsuchen…"
          value={suche} onChange={e => setSuche(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
      </div>

      {q.length >= 2 && (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {treffer.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Keine Treffer für „{suche}"</p>
          ) : (
            treffer.slice(0, 30).map((t, i) => (
              <button key={i} onClick={t.go} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40 transition-colors">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase font-semibold shrink-0">{t.typ}</span>
                <span className="flex-1 min-w-0 text-sm text-foreground truncate">{t.label}</span>
                {t.sub && <span className="text-xs text-muted-foreground shrink-0 truncate">{t.sub}</span>}
                <ChevronRight size={14} className="text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      )}

      {q.length < 2 && (
        <>
          {/* Nächste Sitzung */}
          {naechsteSitzung && (
            <button onClick={() => onOpenSitzung(naechsteSitzung.id)}
              className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wide font-oswald text-primary">Nächste Sitzung</span>
                <span className="text-xs text-muted-foreground">{format(new Date(naechsteSitzung.datum), 'EEE d. MMM yyyy', { locale: de })}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{naechsteSitzung.titel}</p>
              {naechsteSitzung.sitzungs_status && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{naechsteSitzung.sitzungs_status}</span>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Agenda-Fortschritt</span>
                  <span>{naechsteTops.length} TOPs · {agendaFortschritt}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div className="bg-primary h-full transition-all" style={{ width: `${agendaFortschritt}%` }} />
                </div>
              </div>
            </button>
          )}

          {/* Kacheln */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Kachel icon={ListChecks} label="Meine Aufgaben" count={meineAufgaben.length} accent onClick={() => onFilterAufgaben('meine')} />
            <Kachel icon={AlertTriangle} label="Überfällige Aufgaben" count={ueberfaelligeAufgaben.length} warn onClick={() => onFilterAufgaben('ueberfaellig')} />
            <Kachel icon={Gavel} label="Offene Beschlüsse" count={offeneBeschluesse.length} warn={false} accent onClick={() => onNavigate('beschluesse')} />
            <Kachel icon={FileText} label="Fehlende Protokolle" count={fehlendeProtokolle.length} warn onClick={() => onNavigate('sitzungen')} />
            {canManage && <Kachel icon={FileText} label="Offene Anträge" count={offeneAntraege.length} warn={offeneAntraege.length > 0} onClick={() => onNavigate('antraege')} />}
            <Kachel icon={CalendarClock} label="Nachbereitung" count={nachbereitung.length} warn={nachbereitung.length > 0} onClick={() => onNavigate('sitzungen')} />
          </div>

          {/* Meine Aufgaben Liste */}
          {meineAufgaben.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Meine Aufgaben</h3>
              <div className="space-y-2">
                {meineAufgaben.slice(0, 5).map(a => (
                  <button key={a.id} onClick={() => onFilterAufgaben('meine')}
                    className="w-full text-left bg-card border border-border rounded-xl px-4 py-2.5 hover:border-primary/40 transition-colors flex items-center gap-3">
                    <CheckSquare size={14} className="text-primary shrink-0" />
                    <span className="flex-1 text-sm text-foreground truncate">{a.titel}</span>
                    {a.faellig_am && <span className={`text-xs ${a.faellig_am < today ? 'text-red-400' : 'text-muted-foreground'}`}>{format(new Date(a.faellig_am), 'dd.MM.')}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}