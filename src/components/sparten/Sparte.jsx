import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, UserMinus, Search, Users, Calendar, Euro } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpartenKalender from './SpartenKalender';
import AuslagenTab from './AuslagenTab';

const TYP_EMOJI = {
  'Häsgruppe': '🎭',
  'Tanzgruppe': '💃',
  'Musikgruppe': '🎵',
  'Sonstige': '👥',
};

export default function Sparte({ gruppe, alleMitglieder, isAdmin, kannBearbeiten, onEdit, onDelete, onMitgliederChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('mitglieder');
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [suche, setSuche] = useState('');

  // Mitglieder dieser Gruppe: haesgruppen_ids enthält die Gruppen-ID (mit Legacy-Fallback auf haesgruppe_id)
  const mitglieder = alleMitglieder.filter(m =>
    (m.haesgruppen_ids || []).includes(gruppe.id) || m.haesgruppe_id === gruppe.id
  );

  // Für die Suche: Mitglieder die noch NICHT in dieser Gruppe sind
  const verfuegbar = alleMitglieder.filter(m =>
    !(m.haesgruppen_ids || []).includes(gruppe.id) &&
    m.haesgruppe_id !== gruppe.id &&
    `${m.vorname} ${m.nachname}`.toLowerCase().includes(suche.toLowerCase()) &&
    suche.length >= 1
  );

  const handleAdd = async (mitglied) => {
    const aktuelle = mitglied.haesgruppen_ids || (mitglied.haesgruppe_id ? [mitglied.haesgruppe_id] : []);
    await base44.entities.Mitglied.update(mitglied.id, { haesgruppen_ids: [...aktuelle, gruppe.id] });
    setSuche('');
    setShowAddSearch(false);
    onMitgliederChanged();
  };

  const handleRemove = async (mitglied) => {
    const aktuelle = mitglied.haesgruppen_ids || (mitglied.haesgruppe_id ? [mitglied.haesgruppe_id] : []);
    await base44.entities.Mitglied.update(mitglied.id, { haesgruppen_ids: aktuelle.filter(id => id !== gruppe.id) });
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
          {gruppe.verantwortlicher_id && (() => {
            const v = alleMitglieder.find(m => m.id === gruppe.verantwortlicher_id);
            return v ? (
              <Link
                to={`/mitglieder/${v.id}`}
                onClick={e => e.stopPropagation()}
                className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                👤 {v.vorname} {v.nachname}
              </Link>
            ) : null;
          })()}
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
        <div className="border-t border-border bg-secondary/10">
          {/* Tabs */}
          <div className="flex gap-1 p-2 bg-secondary/50">
            <button
              onClick={() => setActiveTab('mitglieder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'mitglieder' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users size={12} /> Mitglieder ({mitglieder.length})
            </button>
            <button
              onClick={() => setActiveTab('kalender')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'kalender' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Calendar size={12} /> Termine
            </button>
            <button
              onClick={() => setActiveTab('auslagen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'auslagen' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Euro size={12} /> Auslagen
            </button>
            </div>

          {activeTab === 'kalender' && (
            <div className="p-4">
              <SpartenKalender gruppe={gruppe} kannBearbeiten={isAdmin || kannBearbeiten} />
            </div>
          )}

          {activeTab === 'auslagen' && (
            <div className="p-4">
              <AuslagenTab gruppeId={gruppe.id} isAdmin={isAdmin} />
            </div>
          )}

          {activeTab === 'mitglieder' && <div className="p-4 space-y-3">
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
          </div>}
        </div>
      )}
    </div>
  );
}