import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannAusschussSehn, isAdmin } from '@/lib/roles';
import { CheckSquare, Plus, Lock, Circle, Clock, CheckCircle2, AlertCircle, Calendar, User as UserIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import TodoForm from '@/components/todos/TodoForm';

const PRIORITAET_FARBEN = {
  'Niedrig':  'bg-neutral-700 text-neutral-300',
  'Mittel':   'bg-blue-900/30 text-blue-400 border border-blue-700/30',
  'Hoch':     'bg-primary/15 text-primary',
  'Dringend': 'bg-red-900/20 text-red-400 border border-red-700/30',
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
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await base44.auth.me();
      const [myMArr, alleTodos] = await Promise.all([
        base44.entities.Mitglied.filter({ user_id: me?.id }),
        base44.entities.Todo.list('-created_date', 500),
      ]);
      const myM = myMArr?.[0] || null;
      setMeinMitglied(myM);
      setTodos(alleTodos || []);

      const alleIds = [...new Set([
        ...(alleTodos || []).flatMap(t => t.verantwortliche_ids || []),
        ...(alleTodos || []).map(t => t.ersteller_mitglied_id).filter(Boolean),
      ])];
      if (alleIds.length > 0) {
        const mArr = await Promise.all(alleIds.map(id => base44.entities.Mitglied.filter({ id })));
        const loaded = (mArr || []).flat();
        if (myM && !loaded.find(m => m.id === myM.id)) loaded.push(myM);
        setMitglieder(loaded);
      } else if (myM) {
        setMitglieder([myM]);
      }
    } catch (e) {
      console.error('Todos laden:', e);
      setError('Aufgaben konnten nicht geladen werden.');
    }
    setLoading(false);
  };

  const sichtbareTodos = todos.filter(t => {
    if (isAdmin(user)) return true;
    if (!meinMitglied) return false;
    return (t.verantwortliche_ids || []).includes(meinMitglied.id) ||
           t.ersteller_mitglied_id === meinMitglied.id;
  });

  const gefilterteTodos = filterStatus === 'Alle'
    ? sichtbareTodos
    : sichtbareTodos.filter(t => t.status === filterStatus);

  const handleSave = async (form) => {
    const data = { ...form, ersteller_mitglied_id: meinMitglied?.id || '' };
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
    try {
      const updated = await base44.entities.Todo.update(todo.id, { status: neuerStatus });
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e) {
      console.error('Status wechseln:', e);
    }
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
        <h2 className="text-xl font-bold font-oswald uppercase tracking-wide text-white mb-2">Kein Zugriff</h2>
        <p className="text-sm text-muted-foreground">Dieser Bereich ist nur für Vorstand und Ausschuss.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin mb-3" />
      <p className="text-sm text-muted-foreground">Aufgaben werden geladen…</p>
    </div>
  );

  const offeneCount = sichtbareTodos.filter(t => t.status !== 'Erledigt').length;

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white flex items-center gap-2">
            <CheckSquare size={22} className="text-primary" /> Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {offeneCount} offen · nur für Verantwortliche sichtbar
          </p>
        </div>
        <button
          onClick={() => { setEditTodo(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-red-700 transition-colors"
        >
          <Plus size={16} /> Neue Aufgabe
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 ml-2"><AlertCircle size={16} /></button>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['Offen', 'In Bearbeitung', 'Erledigt', 'Alle'].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === f ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            {f}
            {f === 'Offen' && offeneCount > 0 && (
              <span className="ml-1 bg-primary/30 text-white px-1.5 py-0.5 rounded-full text-[10px]">{offeneCount}</span>
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
                todo.status === 'Erledigt' ? 'opacity-60 border-border' : istUeberfaellig ? 'border-red-700/40' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status-Toggle */}
                <button onClick={() => handleStatusToggle(todo)} className="mt-0.5 hover:opacity-70 transition-opacity">
                  {STATUS_ICONS[todo.status]}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${todo.status === 'Erledigt' ? 'line-through text-muted-foreground' : 'text-white'}`}>
                      {todo.titel}
                    </p>
                    <button
                      onClick={() => { setEditTodo(todo); setShowForm(true); }}
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-1"
                    >
                      <FileText size={14} />
                    </button>
                  </div>

                  {todo.beschreibung && (
                    <p className="text-xs text-muted-foreground mt-1">{todo.beschreibung}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITAET_FARBEN[todo.prioritaet] || ''}`}>
                      {todo.prioritaet}
                    </span>

                    {todo.faellig_am && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        istUeberfaellig ? 'bg-red-900/20 text-red-400 border border-red-700/30' : 'bg-neutral-800 text-muted-foreground'
                      }`}>
                        {istUeberfaellig && <AlertCircle size={9} />}
                        <Calendar size={9} /> {format(new Date(todo.faellig_am), 'dd.MM.yyyy', { locale: de })}
                      </span>
                    )}
                  </div>

                  {/* Verantwortliche */}
                  {(todo.verantwortliche_ids || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {todo.verantwortliche_ids.map(id => (
                        <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                          <UserIcon size={9} /> {getMitgliedName(id)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ersteller */}
                  {todo.ersteller_mitglied_id && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Erstellt von {getMitgliedName(todo.ersteller_mitglied_id)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {gefilterteTodos.length === 0 && (
        <div className="text-center py-12">
          <CheckSquare size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-white text-sm">
            {filterStatus === 'Erledigt' ? 'Noch nichts erledigt' : 'Keine offenen Aufgaben – alles erledigt!'}
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
