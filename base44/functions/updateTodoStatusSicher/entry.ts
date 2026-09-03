import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ erfolg: false, fehler: 'Nicht angemeldet.' }, { status: 401 });

    const body = await req.json();
    const todoId = body?.todo_id;
    const status = body?.status;

    if (!todoId || !status) {
      return Response.json({ erfolg: false, fehler: 'todo_id und status erforderlich.' }, { status: 400 });
    }
    if (!['Offen', 'In Bearbeitung', 'Erledigt'].includes(status)) {
      return Response.json({ erfolg: false, fehler: 'Ungültiger Status.' }, { status: 400 });
    }

    // Aufgabe laden (Service-Role, um auch fremde Datensätze zu lesen)
    const todo = await base44.asServiceRole.entities.Todo.get(todoId);
    if (!todo) {
      return Response.json({ erfolg: false, fehler: 'Aufgabe nicht gefunden.' }, { status: 404 });
    }

    // Berechtigung: Vorstand/Admin, Ersteller, ODER zugewiesenes Mitglied
    const isFuehrung = ['vorstand', 'stellv_vorstand', 'admin'].includes(user.role);
    const isErsteller = todo.created_by_id === user.id;
    let isZugewiesen = false;
    if (!isFuehrung && !isErsteller) {
      const eigeneMitglieder = await base44.asServiceRole.entities.Mitglied.filter({ user_id: user.id });
      const m = eigeneMitglieder && eigeneMitglieder.length > 0 ? eigeneMitglieder[0] : null;
      if (m && Array.isArray(todo.verantwortliche_ids) && todo.verantwortliche_ids.includes(m.id)) {
        isZugewiesen = true;
      }
    }

    if (!isFuehrung && !isErsteller && !isZugewiesen) {
      return Response.json({ erfolg: false, fehler: 'Keine Berechtigung für diese Aufgabe.' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Todo.update(todoId, { status });
    return Response.json({ erfolg: true, status, todo_id: todoId });
  } catch (e) {
    console.error('updateTodoStatusSicher:', e);
    return Response.json({ erfolg: false, fehler: e?.message || 'Serverfehler.' }, { status: 500 });
  }
});