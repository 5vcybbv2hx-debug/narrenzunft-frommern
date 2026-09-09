import { base44 } from '@/api/base44Client';

/**
 * Meldet ein Mitglied SICHER für eine Ausfahrt an:
 * Vor dem Anlegen wird geprüft, ob für das Mitglied bereits eine
 * AKTIVE Anmeldung (status !== 'Abgemeldet') für diese Ausfahrt existiert.
 * Damit ist garantiert, dass jedes Mitglied nur einmal pro Ausfahrt
 * aktiv angemeldet ist — egal von welcher Stelle (Detail, Liste, Kalender).
 *
 * Rückgabe: { bereitsAngemeldet: boolean, anmeldung }
 */
export async function meldeAnAusfahrtSicher({ ausfahrtId, mitgliedId, transport = 'Bus', durchAdminName = null }) {
  if (!ausfahrtId || !mitgliedId) throw new Error('ausfahrtId und mitgliedId sind erforderlich');

  const vorhandene = await base44.entities.AusfahrtAnmeldung.filter({
    ausfahrt_id: ausfahrtId,
    mitglied_id: mitgliedId,
  });
  const aktiv = (vorhandene || []).find((a) => a.status !== 'Abgemeldet');
  if (aktiv) return { bereitsAngemeldet: true, anmeldung: aktiv };

  const heute = new Date().toISOString().split('T')[0];
  const anmeldung = await base44.entities.AusfahrtAnmeldung.create({
    ausfahrt_id: ausfahrtId,
    mitglied_id: mitgliedId,
    transport,
    status: 'Angemeldet',
    angemeldet_am: heute,
    anzahl_begleitpersonen: 0,
    begleitpersonen: [],
    is_fremdangemeldet: false,
    ...(durchAdminName
      ? { durch_admin_angemeldet: true, durch_admin_name: durchAdminName }
      : {}),
  });
  return { bereitsAngemeldet: false, anmeldung };
}
