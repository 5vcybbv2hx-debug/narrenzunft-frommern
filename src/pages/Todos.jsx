import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannAusschussSehn, isAdmin } from '@/lib/roles';
import { CheckSquare, Plus, Lock, Circle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import TodoForm from '@/components/todos/TodoForm';

const PRIORITAET_FARBEN = {
  'Niedrig':  'bg-gray-500/20 text-gray-400',
  'Mittel':   'bg-blue-500/20 text-blue-400',
  'Hoch':     'bg-orange-500/20 text-orange-400',
  'Dringend': 'bg-red-500/20 text-red-400',
};

const STATUS_ICONS = {
  'Offen':          <Circle size={16} className="text-yellow-400 shrink-0" />,
  'In Bearbeitung': <Clock size={16} className="text-blue-400 shrink-0" />,
  'Erledigt':       <CheckCircle2 size={16} className="text-green-400 shrink-0" />,
};

export default function Todos() {
  const { user } = useAuth();
  const hatZugriff = kannAusschussSehn(user);

  const [todos, setTodos] = useState([]);
  const [meinMitglied, setMeinMitglied] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [filterStatus, setFilterStatus] = useState('Offen');

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const me = await base44.auth.me();
    const [m, alle] = await Promise.all([
      base44.entities.Mitglied.filter({ user_id: me?.id }),
      base44.entities.Mitglied.list('nachname', 500),
    ]);
    setMeinMitglied(m[0] || null);
    setMitglieder(alle.filter(m => !m.archiviert));

    // Alle Todos laden – clientseitig nach Verantwortlichkeit filtern
    const alleTodos = await base44.entities.Todo.list('-created_date', 500);
    setTodos(alleTodos);
    setLoading(false);
  };

  // Sichtbarkeitslogik: Admin/Vorstand sieht alle; Ausschussmitglied sieht nur eigene
  const sichtbareTodos = todos.filter(t => {
    if (isAdmin(user)) return true; // Admin/Vorstand sieht alles
    if (!meinMitglied) return false;
    return (t.verantwortliche_ids || []).includes(meinMitglied.id) ||
           t.ersteller_mitglied_id === meinMitglied.id;
  });

  const gefilterteTodos = filterStatus === 'Alle'
    ? sichtbareTodos
    : sichtbareTodos.filter(t => t.status === filterStatus);

  const handleSave = async (form) => {
    const data = {
      ...form,
      ersteller_mitglied_id: meinMitglied?.id || '',
    };
    if (editTodo) {
      const updated = await base44.entities.Todo.update(editTodo.id, data);
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
    } else {
      const neu = await base44.entities.Todo.create(data);
      setTodos(prev => [neu, ...prev]);
    }
    setShowForm(false);
    setEditTodo(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.Todo.delete(id);
    setTodos(prev => prev.filter(t => t.id !== id));
    setShowForm(false);
    setEditTodo(null);
  };

  const handleStatusToggle = async (todo) => {
    const naechster = { 'Offen': 'In Bearbeitung', 'In Bearbeitung': 'Erledigt', 'Erledigt': 'Offen' };
    const neuerStatus = naechster[todo.status] || 'Offen';
    const updated = await base44.entities.Todo.update(todo.id, { status: neuerStatus });
    setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const getMitgliedName = (id) => {
    const m = mitglieder.find(m => m.id === id);
    return m ? `${m.vorname} ${m.nachname}` : '–';
  };

  const today = new Date().toISOString().split('T')[0];

  if (!hatZugriff) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock size={40} className="text-muted-foreground mb-3" />
        <h2 className="text-xl font-bold text-foreground mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und Ausschuss.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  const offeneCount = sichtbareTodos.filter(t => t.status !== 'Erledigt').length;

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare size={22} className="text-primary" /> Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {offeneCount} offen · nur für Verantwortliche sichtbar
          </p>
        </div>
        <button
          onClick={() => { setEditTodo(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Neue Aufgabe
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['Offen', 'In Bearbeitung', 'Erledigt', 'Alle'].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === f ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f}
            {f === 'Offen' && offeneCount > 0 && (
              <span className="ml-1 bg-primary/30 text-primary px-1.5 py-0.5 rounded-full text-[10px]">{offeneCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {gefilterteTodos.map(todo => {
          const istUeberfaellig = todo.faellig_am && todo.faellig_am < today && todo.status !== 'Erledigt';
          return (
            <div
              key={todo.id}
              className={`bg-card border rounded-xl p-4 transition-all ${
                todo.status === 'Erledigt' ? 'opacity-60 border-border' : istUeberfaellig ? 'border-red-500/40' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status-Toggle */}
                <button onClick={() => handleStatusToggle(todo)} className="mt-0.5 hover:opacity-70 transition-opacity">
                  {STATUS_ICONS[todo.status]}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${todo.status === 'Erledigt' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {todo.titel}
                    </p>
                    <button
                      onClick={() => { setEditTodo(todo); setShowForm(true); }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors shrink-0 p-1"
                    >
                      ✏️
                    </button>
                  </div>

                  {todo.beschreibung && (
                    <p className="text-xs text-muted-foreground mt-1">{todo.beschreibung}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITAET_FARBEN[todo.prioritaet]}`}>
                      {todo.prioritaet}
                    </span>

                    {todo.faellig_am && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        istUeberfaellig ? 'bg-red-500/20 text-red-400' : 'bg-secondary text-muted-foreground'
                      }`}>
                        {istUeberfaellig && <AlertCircle size={9} />}
                        📅 {format(new Date(todo.faellig_am), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    )}
                  </div>

                  {/* Verantwortliche */}
                  {(todo.verantwortliche_ids || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {todo.verantwortliche_ids.map(id => (
                        <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          👤 {getMitgliedName(id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gefilterteTodos.length === 0 && (
        <div className="text-center py-12">
          <CheckSquare size={40} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {filterStatus === 'Erledigt' ? 'Noch nichts erledigt' : 'Keine offenen Aufgaben – alles erledigt! 🎉'}
          </p>
        </div>
      )}

      {showForm && (
        <TodoForm
          todo={editTodo}
          mitglieder={mitglieder}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setShowForm(false); setEditTodo(null); }}
        />
      )}
    </div>
  );
}