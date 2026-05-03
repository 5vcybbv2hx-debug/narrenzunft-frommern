import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, UserMinus, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const TYP_EMOJI = {
  'Häsgruppe': '🎭',
  'Tanzgruppe': '💃',
  'Musikgruppe': '🎵',
  'Sonstige': '👥',
};

export default function Sparte({ gruppe, alleMitglieder, isAdmin, onEdit, onDelete, onMitgliederChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [suche, setSuche] = useState('');

  const gruppenMitglieder = alleMitglieder.filter(m => m.spartenleiter_haesgruppe_id === gruppe.id || false);
  // Mitglieder dieser Gruppe: alle die haesgruppe_id ODER spartenleiter_haesgruppe_id haben
  // Wir nutzen das Mitglied-Feld für die Zugehörigkeit zur Häsgruppe
  const mitglieder = alleMitglieder.filter(m => m.haesgruppe_id === gruppe.id);

  // Für die Suche: noch nicht zugeordnete Mitglieder
  const verfuegbar = alleMitglieder.filter(m =>
    !m.haesgruppe_id &&
    `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()) &&
    suche.length >= 1
  );

  const handleAdd = async (mitglied) => {
    await base44.entities.Mitglied.update(mitglied.id, { haesgruppe_id: gruppe.id });
    setSuche('');
    setShowAddSearch(false);
    onMitgliederChanged();
  };

  const handleRemove = async (mitglied) => {
    await base44.entities.Mitglied.update(mitglied.id, { haesgruppe_id: '' });
    onMitgliederChanged();
  };

  const farbe = gruppe.farbe || '#f97316';
  const emoji = TYP_EMOJI[gruppe.typ] || '👥';

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: farbe + '25', border: `1.5px solid ${farbe}50` }}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{gruppe.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: farbe + '20', color: farbe }}>
              {gruppe.typ || 'Häsgruppe'}
            </span>
            {!gruppe.aktiv && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">Inaktiv</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mitglieder.length} Mitglied{mitglieder.length !== 1 ? 'er' : ''}
            {gruppe.beschreibung && ` · ${gruppe.beschreibung}`}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
              <Edit size={15} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        )}
        <button className="p-1 text-muted-foreground shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-secondary/10">
          {mitglieder.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Noch keine Mitglieder zugeordnet</p>
          ) : (
            <div className="space-y-1.5">
              {mitglieder.map(m => (
                <div key={m.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white"
                    style={{ backgroundColor: farbe }}>
                    {m.vorname?.[0]}{m.nachname?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/mitglieder/${m.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                      {m.vorname} {m.nachname}
                    </Link>
                    <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleRemove(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0" title="Aus Gruppe entfernen">
                      <UserMinus size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div>
              {!showAddSearch ? (
                <button onClick={() => setShowAddSearch(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                  <Plus size={13} /> Mitglied hinzufügen
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Name suchen..."
                      value={suche}
                      onChange={e => setSuche(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  {verfuegbar.length > 0 && (
                    <div className="bg-card border border-border rounded-lg max-h-44 overflow-y-auto">
                      {verfuegbar.slice(0, 10).map(m => (
                        <button key={m.id} onClick={() => handleAdd(m)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-secondary transition-colors text-left border-b border-border last:border-0">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                            {m.vorname?.[0]}{m.nachname?.[0]}
                          </div>
                          <div>
                            <p className="text-sm text-foreground">{m.vorname} {m.nachname}</p>
                            <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowAddSearch(false); setSuche(''); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Abbrechen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}