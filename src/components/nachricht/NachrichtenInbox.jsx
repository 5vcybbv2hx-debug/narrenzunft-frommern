import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function NachrichtenInbox({ empfaengerId }) {
  const [nachrichten, setNachrichten] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadData();
  }, [empfaengerId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const n = await base44.entities.Nachricht.filter({ empfaenger_mitglied_id: empfaengerId });
      const sorted = n.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setNachrichten(sorted);
      // Nur die tatsächlichen Absender laden
      const absenderIds = [...new Set(sorted.map(x => x.absender_mitglied_id).filter(Boolean))];
      if (absenderIds.length > 0) {
        const absender = await Promise.all(
          absenderIds.map(id => base44.entities.Mitglied.filter({ id }))
        );
        setMitglieder(absender.flat());
      }
    } catch (e) {}
    setLoading(false);
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const handleMarkRead = async (nachricht) => {
    const updateData = { gelesen: true };
    if (!nachricht.gelesen) {
      updateData.gelesen_am = new Date().toISOString().split('T')[0];
    }
    await base44.entities.Nachricht.update(nachricht.id, updateData);
    setNachrichten(prev =>
      prev.map(n => n.id === nachricht.id ? { ...n, ...updateData } : n)
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Nachricht löschen?')) return;
    await base44.entities.Nachricht.delete(id);
    setNachrichten(prev => prev.filter(n => n.id !== id));
  };

  const ungelesene = nachrichten.filter(n => !n.gelesen).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Mail size={14} /> {nachrichten.length} Nachricht{nachrichten.length !== 1 ? 'en' : ''}
          </p>
          {ungelesene > 0 && (
            <p className="text-xs text-yellow-400 mt-0.5">{ungelesene} ungelesen</p>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {nachrichten.length === 0 ? (
          <div className="text-center py-8">
            <Mail size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Keine Nachrichten</p>
          </div>
        ) : (
          nachrichten.map(n => {
            const isExpanded = expandedId === n.id;
            return (
              <div
                key={n.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  n.gelesen
                    ? 'bg-secondary/30 border-border opacity-70'
                    : 'bg-card border-yellow-500/30'
                }`}
              >
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : n.id);
                    if (!n.gelesen) handleMarkRead(n);
                  }}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{n.betreff}</h3>
                      {!n.gelesen && <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Von: {getMitgliedName(n.absender_mitglied_id)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(n.created_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                  </div>
                  <button
                    onClick={e => e.stopPropagation()}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/50 space-y-3">
                    <div className="bg-secondary/50 rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap">
                      {n.inhalt}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        {n.gelesen && (
                          <span className="flex items-center gap-1">
                            <Check size={12} /> Gelesen: {format(new Date(n.gelesen_am), 'dd.MM.yyyy', { locale: de })}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}