import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { differenceInYears } from 'date-fns';

// Status-Farben (konsistent mit Mitglieder-Liste)
const STATUS_COLORS = {
  'Aktiv':              '#4ade80',
  'Passiv':             '#eab308',
  'Passiv mit Häs':     '#EA2525',
  'Leihäs':             '#94a3b8',
  'Ehrenmitglied':      '#a78bfa',
  'Jugendliche 11-14':  '#60a5fa',
  'Jungaktive 15-17':   '#22d3ee',
  'Kinder 4-10':        '#f472b6',
  'Kleinkind 0-3':      '#fb7185',
  'Verstorben':         '#6b7280',
};

const STATUS_ORDER = [
  'Aktiv', 'Passiv', 'Passiv mit Häs', 'Leihäs', 'Ehrenmitglied',
  'Jungaktive 15-17', 'Jugendliche 11-14', 'Kinder 4-10', 'Kleinkind 0-3', 'Verstorben',
];

const ALTERS_GRUPPEN = [
  { label: 'Kleinkinder 0–3',   min: 0,  max: 3,   color: '#fb7185' },
  { label: 'Kinder 4–10',       min: 4,  max: 10,  color: '#f472b6' },
  { label: 'Jugendliche 11–14', min: 11, max: 14,  color: '#60a5fa' },
  { label: 'Jungaktive 15–17',  min: 15, max: 17,  color: '#22d3ee' },
  { label: 'Erwachsene 18–39',  min: 18, max: 39,  color: '#4ade80' },
  { label: 'Erwachsene 40–59',  min: 40, max: 59,  color: '#eab308' },
  { label: 'Senioren 60+',      min: 60, max: 200, color: '#fb923c' },
];

const PASSIV_STATUS = ['Passiv', 'Passiv mit Häs', 'Leihäs'];

/** Kleine Kachel mit Kennzahl */
function StatTile({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-secondary/60 border border-border px-3 py-2.5 text-center">
      <p className="text-xl font-oswald font-semibold tabular-nums" style={accent ? { color: accent } : undefined}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

/** Horizontale Balken-Zeile */
function BarRow({ label, count, total, color, onClick, highlight }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-md text-left transition-colors ${onClick ? 'hover:bg-secondary/50 cursor-pointer' : ''}`}
    >
      <span className={`text-xs truncate flex-1 min-w-0 ${highlight ? 'font-semibold' : 'text-foreground/90'}`}>{label}</span>
      <div className="w-24 sm:w-36 h-2 rounded-full bg-secondary overflow-hidden shrink-0">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-14 text-right">
        {count}
        {total > 0 && <span className="text-muted-foreground/60"> · {Math.round(pct)}%</span>}
      </span>
    </Tag>
  );
}

/** Sektions-Label */
function SectionLabel({ children }) {
  return (
    <p className="text-[11px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">{children}</p>
  );
}

export default function MitgliederStatistik({ mitglieder, gruppenMap, onStatusFilter }) {
  const [open, setOpen] = useState(true);

  const s = useMemo(() => {
    const aktive = mitglieder.filter(m => !m.archiviert);

    // ── Status-Verteilung ──
    const statusCounts = {};
    aktive.forEach(m => {
      const st = m.mitgliedsstatus || 'Ohne Status';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    const statusVerteilung = STATUS_ORDER
      .filter(st => statusCounts[st])
      .map(st => ({ status: st, count: statusCounts[st] }))
      .concat(
        Object.keys(statusCounts)
          .filter(st => !STATUS_ORDER.includes(st))
          .map(st => ({ status: st, count: statusCounts[st] }))
      );

    // ── Altersgruppen (aus Geburtsdatum) ──
    const alters = aktive
      .map(m => m.geburtsdatum ? differenceInYears(new Date(), new Date(m.geburtsdatum)) : null)
      .filter(a => a !== null && !isNaN(a));
    const altersVerteilung = ALTERS_GRUPPEN.map(g => ({
      ...g,
      count: alters.filter(a => a >= g.min && a <= g.max).length,
    }));
    const avgAlter = alters.length > 0 ? Math.round(alters.reduce((a, b) => a + b, 0) / alters.length) : null;

    // ── Sparten-Verteilung (Aktiv/Passiv der Erwachsenen) ──
    const spartenData = {};
    aktive.forEach(m => {
      const ids = m.haesgruppen_ids?.length ? m.haesgruppen_ids : (m.haesgruppe_id ? [m.haesgruppe_id] : []);
      const isAktiv = m.mitgliedsstatus === 'Aktiv';
      const isPassiv = PASSIV_STATUS.includes(m.mitgliedsstatus);
      if (!isAktiv && !isPassiv) return;
      ids.forEach(id => {
        const g = gruppenMap[id];
        if (!g?.name) return;
        if (!spartenData[id]) spartenData[id] = { id, name: g.name, farbe: g.farbe, aktiv: 0, passiv: 0 };
        if (isAktiv) spartenData[id].aktiv++;
        else spartenData[id].passiv++;
      });
    });
    const spartenVerteilung = Object.values(spartenData)
      .sort((a, b) => (b.aktiv + b.passiv) - (a.aktiv + a.passiv));

    // ── Eintritte pro Jahr (letzte 10 Jahre) ──
    const aktJahr = new Date().getFullYear();
    const eintritte = [];
    for (let j = aktJahr - 9; j <= aktJahr; j++) {
      eintritte.push({
        jahr: j,
        count: aktive.filter(m => parseInt(m.eintrittsdatum?.substring(0, 4)) === j).length,
      });
    }
    const maxEintritt = Math.max(1, ...eintritte.map(e => e.count));

    // ── Kennzahlen ──
    const aktivCount = statusCounts['Aktiv'] || 0;
    const passivCount = PASSIV_STATUS.reduce((sum, st) => sum + (statusCounts[st] || 0), 0);
    const kinderJugend = ['Kleinkind 0-3', 'Kinder 4-10', 'Jugendliche 11-14', 'Jungaktive 15-17']
      .reduce((sum, st) => sum + (statusCounts[st] || 0), 0);
    const ehrenmitglieder = statusCounts['Ehrenmitglied'] || 0;

    return {
      gesamt: aktive.length,
      aktivCount, passivCount, kinderJugend, ehrenmitglieder,
      statusVerteilung, altersVerteilung, avgAlter,
      spartenVerteilung, eintritte, maxEintritt,
    };
  }, [mitglieder, gruppenMap]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
      {/* Header (klickbar zum Auf-/Zuklappen) */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-border hover:bg-secondary/40 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-primary" />
          <h3 className="font-oswald font-semibold text-foreground text-sm tracking-wide">Mitglieder-Statistik</h3>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{s.gesamt} Mitglieder</p>
          {open ? <ChevronUp size={14} className="text-muted-foreground group-hover:text-primary transition-colors" /> 
                : <ChevronDown size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-5">
          {/* Kennzahlen-Kacheln */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            <StatTile label="Gesamt" value={s.gesamt} />
            <StatTile label="Aktiv" value={s.aktivCount} accent="#4ade80" />
            <StatTile label="Passiv" value={s.passivCount} accent="#eab308" />
            <StatTile label="Kinder & Jugend" value={s.kinderJugend} accent="#60a5fa" />
            <StatTile label="Ø Alter" value={s.avgAlter !== null ? `${s.avgAlter} J.` : '–'} />
          </div>

          {/* Status + Altersgruppen */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <SectionLabel>Status-Verteilung</SectionLabel>
              <div className="space-y-0.5">
                {s.statusVerteilung.map(v => (
                  <BarRow
                    key={v.status}
                    label={v.status}
                    count={v.count}
                    total={s.gesamt}
                    color={STATUS_COLORS[v.status] || '#EA2525'}
                    highlight={v.status === 'Aktiv'}
                    onClick={onStatusFilter ? () => onStatusFilter(v.status) : undefined}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">Tipp: Auf eine Zeile tippen, um die Liste zu filtern.</p>
            </div>

            <div>
              <SectionLabel>Altersgruppen</SectionLabel>
              <div className="space-y-0.5">
                {s.altersVerteilung.map(g => (
                  <BarRow
                    key={g.label}
                    label={g.label}
                    count={g.count}
                    total={s.gesamt}
                    color={g.color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Sparten + Eintritte */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <SectionLabel>Häsgruppen / Sparten (Aktiv · Passiv)</SectionLabel>
              <div className="space-y-1">
                {s.spartenVerteilung.length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">Keine Gruppen-Zuordnungen vorhanden.</p>
                )}
                {s.spartenVerteilung.map(g => {
                  const gesamt = g.aktiv + g.passiv;
                  const aktivPct = gesamt > 0 ? (g.aktiv / gesamt) * 100 : 0;
                  return (
                    <Link
                      key={g.id}
                      to={`/sparte/${g.id}`}
                      className="block py-1.5 px-1.5 -mx-1.5 rounded-md hover:bg-secondary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs truncate flex-1 min-w-0 group-hover:text-primary transition-colors">{g.name}</span>
                        <div className="w-24 sm:w-36 h-2 rounded-full overflow-hidden bg-secondary shrink-0 flex">
                          <div className="h-full" style={{ width: `${aktivPct}%`, backgroundColor: g.farbe || '#4ade80' }} />
                          <div className="h-full bg-border" style={{ width: `${100 - aktivPct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-20 text-right">
                          <strong style={{ color: g.farbe || '#4ade80' }}>{g.aktiv}</strong> · <strong className="text-muted-foreground/70">{g.passiv}</strong>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Eintritte pro Jahr</SectionLabel>
              <div className="flex items-end gap-1.5 h-24 pt-1">
                {s.eintritte.map(e => (
                  <div key={e.jahr} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <span className="text-[10px] tabular-nums text-muted-foreground">{e.count > 0 ? e.count : ''}</span>
                    <div
                      className="w-full rounded-t-sm bg-primary/80 hover:bg-primary transition-colors"
                      style={{ height: `${Math.max((e.count / s.maxEintritt) * 100, e.count > 0 ? 6 : 2)}%` }}
                      title={`${e.count} Eintritte in ${e.jahr}`}
                    />
                    <span className="text-[9px] tabular-nums text-muted-foreground/70 truncate w-full text-center">{`'${String(e.jahr).slice(2)}`}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[10px] text-muted-foreground/70">Letzte 10 Jahre</p>
                <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                  Insgesamt {s.eintritte.reduce((sum, e) => sum + e.count, 0)} Eintritte
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
