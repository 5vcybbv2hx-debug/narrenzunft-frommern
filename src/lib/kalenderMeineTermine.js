// Nur direkt verknüpfte Kinder und Ehepartner, nicht sämtliche Verwandte.
// Die Beziehung kann in beiden Richtungen in der Tabelle stehen.
export function familienIdsAusVerwandtschaft(beziehungen, selbstId) {
  const ids = new Set();
  for (const b of beziehungen || []) {
    if (b.mitglied_id === selbstId && ['Kind', 'Ehepartner/in'].includes(b.beziehung) && b.verwandter_id) {
      ids.add(b.verwandter_id);
    } else if (b.verwandter_id === selbstId && ['Elternteil', 'Ehepartner/in'].includes(b.beziehung) && b.mitglied_id) {
      ids.add(b.mitglied_id);
    }
  }
  ids.delete(selbstId);
  return [...ids];
}

// Die Terminliste ist bereits durch getKalenderSicher auf sichtbare Termine begrenzt.
// Zusätzliche Anmeldedaten dürfen nur für selbst und explizit verknüpfte Familie
// geladen werden; eine Anmeldung darf keine unsichtbaren Termine einblenden.
export function angemeldeteIdsFuerTermin(termin, erlaubteIds, kalenderAnmeldungen, teilnahmen, ausfahrtAnmeldungen) {
  const ids = new Set();
  if (termin._ausfahrt_id) {
    for (const a of ausfahrtAnmeldungen) {
      if (a.ausfahrt_id === termin._ausfahrt_id && a.status !== 'Abgemeldet' && erlaubteIds.has(a.mitglied_id)) ids.add(a.mitglied_id);
    }
  } else if (termin._veranstaltung_id) {
    for (const a of teilnahmen) {
      if (a.veranstaltung_id === termin._veranstaltung_id && !['Abgesagt', 'Abgemeldet'].includes(a.status) && erlaubteIds.has(a.mitglied_id)) ids.add(a.mitglied_id);
    }
  } else {
    for (const a of kalenderAnmeldungen) {
      if (a.termin_id === termin.id && ['Angemeldet', 'Warteliste'].includes(a.status) && erlaubteIds.has(a.mitglied_id)) ids.add(a.mitglied_id);
    }
  }
  return [...ids];
}
