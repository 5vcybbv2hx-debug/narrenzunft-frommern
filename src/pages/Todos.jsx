import { useState, useEffect, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannAusschussSehn, isAdmin } from '@/lib/roles';
import { CheckSquare, Plus, Lock, Circle, Clock, CheckCircle2, AlertCircle, Calendar, User as UserIcon, Search, ChevronDown, ListChecks } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';
import TodoForm from '@/components/todos/TodoForm';

const PRIO_RANK = { 'Dringend': 0, 'Hoch': 1, 'Mittel': 2, 'Niedrig': 3 };

const PRIO_FARBEN = {
  'Niedrig':  'bg-secondary text-muted-foreground',
  'Mittel':   'bg-blue-900/30 text-blue-400 border border-blue-700/30',
  'Hoch':     'bg-primary/15 text-primary',
  'Dringend': 'bg-red-900/20 text-red-400 border border-red-700/30',
};

export default function Todos() {
  const { user } = useAuth();
  const hatZugriff = kannAusschussSehn(user);
  const binAdmin = isAdmin(user);

  const [todos, setTodos] = useState([]);
  const [meinMitglied, setMeinMitglied] = useState(null);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTodo, setEditTodo] = useState(null);
  const [filter, setFilter] = useState('Aktiv');   // 'Aktiv' | 'Überfällig' | 'Meine' | 'Erledigt' | 'Alle'
  const [suche, setSuche] = useState('');
  const [showErledigt, setShowErledigt] = useState(false);
  const [error, setError] = useState(null);

  // Letzten Nicht-Erledigt-Status merken, damit beim Abhaken zurückgesprungen werden kann
  const letzteStatus = useRef({});

  useEffect(() => {
    if (!hatZugriff) return;
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [myMArr, alleTodos, alleM] = await Promise.all([
        base44.entities.Mitglied.filter({ user_id: user?.id }).catch(() => []),
        base44.entities.Todo.list('-created_date', 500),
        base44.entities.Mitglied.list('nachname', 1000).catch(() => []),
      ]);
      const myM = myMArr?.[0] || null;
      setMeinMitglied(myM);
      setTodos(alleTodos || []);
      setMitglieder(alleM || []);
    } catch (e) {
      console.error('Todos laden:', e);
      setError('Aufgaben konnten nicht geladen werden.');
    }
    setLoading(false);
  };

  // ── Sichtbarkeit: Admins sehen alles, andere nur eigene + selbst erstellte ──
  const sichtbareTodos = useMemo(() => todos.filter(t => {
    if (binAdmin) return true;
    if (!meinMitglied) return false;
    return (t.verantwortliche_ids || []).includes(meinMitglied.id) ||
           t.ersteller_mitglied_id === meinMitglied.id;
  }), [todos, binAdmin, meinMitglied]);

  const today = new Date().toISOString().split('T')[0];
  const istUeberfaellig = (t) => t.faellig_am && t.faellig_am < today && t.status !== 'Erledigt';
  const istMeins = (t) => meinMitglied && (t.verantwortliche_ids || []).includes(meinMitglied.id);

  // ── Zähler für die Filter-Kacheln ──
  const counts = useMemo(() => {
    const aktiv = sichtbareTodos.filter(t => t.status !== 'Erledigt');
    return {
      'Aktiv': aktiv.length,
      'Überfällig': aktiv.filter(istUeberfaellig).length,
      'Meine': aktiv.filter(istMeins).length,
      'Erledigt': sichtbareTodos.filter(t => t.status === 'Erledigt').length,
      'Alle': sichtbareTodos.length,
    };
  }, [sichtbareTodos]);

  // ── Intelligente Sortierung: Überfällig vor Priorität vor Datum vor Alter ──
  const sortiereSmart = (a, b) => {
    const ueA = istUeberfaellig(a) ? 0 : 1;
    const ueB = istUeberfaellig(b) ? 0 : 1;
    if (ueA !== ueB) return ueA - ueB;
    const pA = PRIO_RANK[a.prioritaet] ?? 3;
    const pB = PRIO_RANK[b.prioritaet] ?? 3;
    if (pA !== pB) return pA - pB;
    const dA = a.faellig_am || '9999-12-31';
    const dB = b.faellig_am || '9999-12-31';
    if (dA !== dB) return dA.localeCompare(dB);
    return (b.created_date || '').localeCompare(a.created_date || '');
  };

  // ── Filter + Suche ──
  const gefilterteTodos = useMemo(() => {
    let liste = sichtbareTodos;
    if (filter === 'Aktiv') liste = liste.filter(t => t.status !== 'Erledigt');
    else if (filter === 'Überfällig') liste = liste.filter(istUeberfaellig);
    else if (filter === 'Meine') liste = liste.filter(istMeins);
    else if (filter === 'Erledigt') liste = liste.filter(t => t.status === 'Erledigt');

    const q = suche.trim().toLowerCase();
    if (q) liste = liste.filter(t =>
      `${t.titel} ${t.beschreibung || ''}`.toLowerCase().includes(q)
    );

    // 'Alle': Erledigte ans Ende, Rest smart sortiert
    if (filter === 'Alle') {
      const aktiv = liste.filter(t => t.status !== 'Erledigt').sort(sortiereSmart);
      const erledigt = liste.filter(t => t.status === 'Erledigt')
        .sort((a, b) => (b.faellig_am || b.created_date || '').localeCompare(a.faellig_am || a.created_date || ''));
      return { aktiv, erledigt };
    }
    return { aktiv: [...liste].sort(sortiereSmart), erledigt: [] };
  }, [sichtbareTodos, filter, suche]);

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

  // Smart-Checkbox: haken = erledigt, aufheben = zurück zum letzten Status
  const handleErledigtToggle = async (todo) => {
    const neuerStatus = todo.status === 'Erledigt'
      ? (letzteStatus.current[todo.id] || 'Offen')
      : 'Erledigt';
    if (todo.status !== 'Erledigt') letzteStatus.current[todo.id] = todo.status;
    try {
      const updated = await base44.entities.Todo.update(todo.id, { status: neuerStatus });
      setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e) {
      console.error('Status wechseln:', e);
    }
  };

  // Status-Chip: wechselt zwischen Offen und In Bearbeitung
  const handleStatusCycle = async (todo) => {
    if (todo.status === 'Erledigt') return;
    const neuerStatus = todo.status === 'Offen' ? 'In Bearbeitung' : 'Offen';
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

  // Relative Fälligkeits-Anzeige
  const faelligChip = (t) => {
    if (!t.faellig_am) return null;
    const tage = differenceInCalendarDays(new Date(t.faellig_am), new Date(today));
    const datum = format(new Date(t.faellig_am), 'dd.MM.yyyy', { locale: de });
    if (t.status === 'Erledigt') return { text: datum, cls: 'bg-secondary text-muted-foreground' };
    if (tage < 0) return { text: `${datum} · ${Math.abs(tage)} Tag${Math.abs(tage) === 1 ? '' : 'e'} überfällig`, cls: 'bg-red-900/20 text-red-400 border border-red-700/30' };
    if (tage === 0) return { text: 'Heute fällig', cls: 'bg-amber-500/15 text-amber-400' };
    if (tage === 1) return { text: 'Morgen fällig', cls: 'bg-secondary text-muted-foreground' };
    if (tage <= 7) return { text: `In ${tage} Tagen · ${datum}`, cls: 'bg-secondary text-muted-foreground' };
    return { text: datum, cls: 'bg-secondary text-muted-foreground' };
  };

  // ── Kacheln (Filter-Shortcuts) ──
  const kacheln = [
    { key: 'Aktiv', label: 'Aktiv', count: counts['Aktiv'], active: filter === 'Aktiv' },
    { key: 'Überfällig', label: 'Überfällig', count: counts['Überfällig'], active: filter === 'Überfällig', warn: true },
    ...(binAdmin ? [{ key: 'Meine', label: 'Mir zugewiesen', count: counts['Meine'], active: filter === 'Meine' }] : []),
    { key: 'Erledigt', label: 'Erledigt', count: counts['Erledigt'], active: filter === 'Erledigt' },
    { key: 'Alle', label: 'Alle', count: counts['Alle'], active: filter === 'Alle' },
  ];

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

  const renderTodo = (todo) => {
    const ueberfaellig = istUeberfaellig(todo);
    const chip = faelligChip(todo);
    const istErledigt = todo.status === 'Erledigt';
    return (
      <div
        key={todo.id}
        className={`bg-card border rounded-xl p-4 transition-all ${
          istErledigt ? 'opacity-55 border-border'
          : ueberfaellig ? 'border-red-700/40 hover:border-red-500/60'
          : 'border-border hover:border-primary/40'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Smart-Checkbox */}
          <button
            onClick={() => handleErledigtToggle(todo)}
            title={istErledigt ? 'Als offen markieren' : 'Als erledigt markieren'}
            className="mt-0.5 hover:scale-110 transition-transform shrink-0"
          >
            {istErledigt
              ? <CheckCircle2 size={20} className="text-green-400" />
              : ueberfaellig
                ? <Circle size={20} className="text-red-400" />
                : <Circle size={20} className="text-yellow-400/80 hover:text-yellow-300" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${istErledigt ? 'line-through text-muted-foreground' : 'text-white'}`}>
                {todo.titel}
              </p>
              <button
                onClick={() => { setEditTodo(todo); setShowForm(true); }}
                title="Bearbeiten"
                className="text-muted-foreground hover:text-primary transition-colors shrink-0 p-1"
              >
                <CheckSquare size={14} />
              </button>
            </div>

            {todo.beschreibung && (
              <p className="text-xs text-muted-foreground mt-1">{todo.beschreibung}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {/* Priorität */}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIO_FARBEN[todo.prioritaet] || ''}`}>
                {todo.prioritaet}
              </span>

              {/* Status-Chip (klickbar: Offen ↔ In Bearbeitung) */}
              {!istErledigt && (
                <button
                  onClick={() => handleStatusCycle(todo)}
                  title="Status wechseln"
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 transition-colors ${
                    todo.status === 'In Bearbeitung'
                      ? 'bg-blue-900/30 text-blue-400 border border-blue-700/30 hover:bg-blue-900/50'
                      : 'bg-secondary text-muted-foreground hover:text-white'
                  }`}
                >
                  {todo.status === 'In Bearbeitung' ? <Clock size={9} /> : <Circle size={9} className="fill-current" />}
                  {todo.status}
                </button>
              )}

              {/* Fälligkeit (relativ) */}
              {chip && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${chip.cls}`}>
                  {ueberfaellig ? <AlertCircle size={9} /> : <Calendar size={9} />} {chip.text}
                </span>
              )}
            </div>

            {/* Verantwortliche */}
            {(todo.verantwortliche_ids || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {todo.verantwortliche_ids.map(id => (
                  <span key={id} className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    meinMitglied?.id === id ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary/80'
                  }`}>
                    <UserIcon size={9} /> {getMitgliedName(id)}
                  </span>
                ))}
              </div>
            )}

            {todo.ersteller_mitglied_id && todo.ersteller_mitglied_id !== meinMitglied?.id && (
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                Erstellt von {getMitgliedName(todo.ersteller_mitglied_id)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const keineErgebnisse = gefilterteTodos.aktiv.length === 0 && !(filter === 'Alle' && showErledigt && gefilterteTodos.erledigt.length > 0);

  return (
    <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold font-oswald uppercase tracking-wide text-white flex items-center gap-2">
            <CheckSquare size={22} className="text-primary" /> Aufgaben
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts['Aktiv']} aktiv{counts['Überfällig'] > 0 && ` · ${counts['Überfällig']} überfällig`}
            {binAdmin && counts['Meine'] > 0 && ` · ${counts['Meine']} dir zugewiesen`}
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
          <button onClick={loadData} className="shrink-0 ml-2 underline hover:text-white">Erneut versuchen</button>
        </div>
      )}

      {/* Statistik-Kacheln als Filter-Shortcuts */}
      <div className={`grid grid-cols-3 gap-2 mb-4 ${binAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {kacheln.map(k => (
          <button
            key={k.key}
            onClick={() => setFilter(k.key)}
            className={`rounded-xl border p-3 text-left transition-all ${
              k.active
                ? 'bg-primary/15 border-primary text-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/50'
            } ${!k.active && k.warn && k.count > 0 ? 'border-red-700/40' : ''}`}
          >
            <p className={`text-xl font-bold font-oswald ${k.active ? 'text-primary' : k.warn && k.count > 0 ? 'text-red-400' : 'text-white'}`}>
              {k.count}
            </p>
            <p className="text-[11px] uppercase tracking-wide font-oswald">{k.label}</p>
          </button>
        ))}
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Aufgaben durchsuchen…"
          value={suche}
          onChange={e => setSuche(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-card border border-border text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* Aktive Aufgaben */}
      {keineErgebnisse ? (
        <div className="text-center py-12">
          <ListChecks size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-white text-sm mb-1">
            {suche.trim() ? 'Keine Treffer für deine Suche' :
             filter === 'Erledigt' ? 'Noch nichts erledigt' :
             filter === 'Überfällig' ? 'Nichts überfällig — top!' :
             filter === 'Meine' ? 'Keine Aufgaben an dich vergeben' :
             'Keine offenen Aufgaben — alles erledigt!'}
          </p>
          {(filter !== 'Alle' || suche.trim()) && (
            <button
              onClick={() => { setFilter('Alle'); setSuche(''); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {gefilterteTodos.aktiv.map(renderTodo)}
        </div>
      )}

      {/* Erledigt (einklappbar, in 'Alle'-Ansicht) */}
      {filter === 'Alle' && gefilterteTodos.erledigt.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowErledigt(p => !p)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/60 border border-border text-xs text-muted-foreground hover:text-white transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${showErledigt ? 'rotate-180' : ''}`} />
            {showErledigt ? 'Erledigte ausblenden' : `${gefilterteTodos.erledigt.length} erledigte anzeigen`}
          </button>
          {showErledigt && (
            <div className="space-y-2 mt-2">
              {gefilterteTodos.erledigt.map(renderTodo)}
            </div>
          )}
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
