import { useState } from 'react';
import { Edit, Trash2, UserCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYP_META = {
  'Häsgruppe':   { icon: '👕', farbe: '#EA2525' },
  'Tanzgruppe':  { icon: '💃', farbe: '#F59E0B' },
  'Musikgruppe': { icon: '🎵', farbe: '#8B5CF6' },
  'Sonstige':    { icon: '👥', farbe: '#6B7280' },
};

const STATUS_GRUPPEN = [
  { label: 'Aktiv',   status: ['Aktiv'],                              color: 'text-green-400',  bg: 'bg-green-500/10' },
  { label: 'Passiv',  status: ['Passiv', 'Passiv mit Häs', 'Leihäs'], color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { label: 'Kinder',  status: ['Kleinkind 0-3', 'Kinder 4-10'],       color: 'text-pink-400',   bg: 'bg-pink-500/10' },
  { label: 'Jugend',  status: ['Jugendliche 11-14', 'Jungaktive 15-17'], color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { label: 'Ehren',   status: ['Ehrenmitglied'],                      color: 'text-purple-400', bg: 'bg-purple-500/10' },
];

export default function Sparte({ gruppe, alleMitglieder, isAdmin, kannBearbeiten, onEdit, onDelete }) {
  const [expandedStatus, setExpandedStatus] = useState(null);

  // Mitglieder dieser Gruppe
  const mitglieder = alleMitglieder.filter(m =>
    !m.archiviert && ((m.haesgruppen_ids || []).includes(gruppe.id) || m.haesgruppe_id === gruppe.id)
  );

  // Verantwortliche (verantwortliche_ids mit Legacy-Fallback auf verantwortlicher_id)
  const verantwIds = gruppe.verantwortliche_ids?.length
    ? gruppe.verantwortliche_ids
    : (gruppe.verantwortlicher_id ? [gruppe.verantwortlicher_id] : []);
  const verantw = verantwIds.map(id => alleMitglieder.find(m => m.id === id)).filter(Boolean);

  // Status-Aufschlüsselung
  const statusBreakdown = STATUS_GRUPPEN.map(g => ({
    ...g,
    count: mitglieder.filter(m => g.status.includes(m.mitgliedsstatus)).length,
  })).filter(g => g.count > 0);

  const typKey = gruppe.typ || 'Häsgruppe';
  const typMeta = TYP_META[typKey] || TYP_META['Sonstige'];
  const farbe = gruppe.farbe || typMeta.farbe;

  // Mitglieder der aufgeklappten Status-Gruppe
  const expandedMitglieder = expandedStatus
    ? mitglieder.filter(m => expandedStatus.status.includes(m.mitgliedsstatus))
    : [];

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden transition-colors hover:border-primary/40 active:scale-[0.995]"
      style={{ borderLeft: `3px solid ${farbe}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: farbe + '20', border: `1.5px solid ${farbe}50` }}>
          {typMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-oswald font-semibold text-foreground tracking-wide">{gruppe.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: farbe + '20', color: farbe }}>
              {gruppe.typ || 'Häsgruppe'}
            </span>
            {!gruppe.aktiv && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Inaktiv</span>}
          </div>

          {/* Verantwortliche */}
          {verantw.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {verantw.map(v => (
                <Link key={v.id} to={`/mitglieder/${v.id}`}
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                  <UserCircle size={11} className="inline" /> {v.vorname} {v.nachname}
                </Link>
              ))}
            </div>
          )}

          {/* Status-Aufschlüsselung — klickbar: klappt Mitglieder auf */}
          <div className="flex flex-wrap gap-1 mt-1">
            {statusBreakdown.map(g => {
              const isOpen = expandedStatus?.label === g.label;
              return (
                <button
                  key={g.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedStatus(isOpen ? null : g);
                  }}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium transition-colors ${g.color} ${
                    isOpen ? `${g.bg} ring-1 ring-inset ring-current` : 'bg-secondary hover:bg-secondary/70'
                  }`}
                  title={`${g.label} — antippen für Mitglieder`}
                >
                  {g.count} {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Buttons — auf Mobile versteckt, da die ganze Karte klickbar ist */}
        {isAdmin && (
          <div className="hidden sm:flex gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Edit size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        )}

        {/* Klick-Hinweis: Karte öffnet die Gruppe */}
        <ChevronRight size={16} className="text-muted-foreground/50 shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>

      {/* Aufgeklappte Status-Gruppe: Mitglieder direkt auf der Karte */}
      {expandedStatus && (
        <div
          className="px-4 pb-3 pt-2 border-t border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
            {expandedStatus.label} · {expandedMitglieder.length}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {expandedMitglieder.map(m => (
              <Link
                key={m.id}
                to={`/mitglieder/${m.id}`}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary hover:bg-primary/20 text-xs text-foreground hover:text-primary transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </span>
                {m.vorname} {m.nachname}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
