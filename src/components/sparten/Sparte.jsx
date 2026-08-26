import { Edit, Trash2, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYP_META = {
  'Häsgruppe':   { icon: '👕', farbe: '#EA2525' },
  'Tanzgruppe':  { icon: '💃', farbe: '#F59E0B' },
  'Musikgruppe': { icon: '🎵', farbe: '#8B5CF6' },
  'Sonstige':    { icon: '👥', farbe: '#6B7280' },
};

const STATUS_GRUPPEN = [
  { label: 'Aktiv',   status: ['Aktiv'],                              color: 'text-green-400' },
  { label: 'Passiv',  status: ['Passiv', 'Passiv mit Häs', 'Leihäs'], color: 'text-yellow-400' },
  { label: 'Kinder',  status: ['Kleinkind 0-3', 'Kinder 4-10'],       color: 'text-pink-400' },
  { label: 'Jugend',  status: ['Jugendliche 11-14', 'Jungaktive 15-17'], color: 'text-blue-400' },
  { label: 'Ehren',   status: ['Ehrenmitglied'],                      color: 'text-purple-400' },
];

export default function Sparte({ gruppe, alleMitglieder, isAdmin, kannBearbeiten, onEdit, onDelete }) {
  // Mitglieder dieser Gruppe
  const mitglieder = alleMitglieder.filter(m =>
    (m.haesgruppen_ids || []).includes(gruppe.id) || m.haesgruppe_id === gruppe.id
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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${farbe}` }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: farbe + '20', border: `1.5px solid ${farbe}50` }}>
          {typMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
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

          {/* Status-Aufschlüsselung */}
          <div className="flex flex-wrap gap-1 mt-1">
            {statusBreakdown.map(g => (
              <span key={g.label} className={`text-[10px] px-1.5 py-0.5 rounded-full bg-secondary ${g.color}`}>
                {g.count} {g.label}
              </span>
            ))}
          </div>
        </div>

        {/* Admin Buttons */}
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Edit size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}