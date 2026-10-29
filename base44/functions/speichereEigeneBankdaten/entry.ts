import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Selbstauskunft: Ein angemeldetes Mitglied pflegt seine EIGENE Bankverbindung
 * inklusive SEPA-Lastschriftmandat. Mitglieder haben keinen Schreibzugriff auf
 * die geschützte Entity — deshalb läuft es über diese Function.
 *
 * Regeln:
 *  - nur das eigene Profil (Mitglied mit user_id = eigener Login)
 *  - Eltern dürfen für ihre Kinder eintragen (Verwandtschaft)
 *  - IBAN wird geprüft, Mandatstext muss bestätigt werden
 *  - Vorstand/Kassierer werden benachrichtigt
 */
function ibanNormalisieren(iban: string): string {
  return String(iban || '').replace(/\s+/g, '').toUpperCase();
}
function ibanGueltig(iban: string): boolean {
  const s = ibanNormalisieren(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const umgestellt = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = /[A-Z]/.test(zeichen) ? String(zeichen.charCodeAt(0) - 55) : zeichen;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const iban = ibanNormalisieren(body.iban || '');
    const mitgliedId = String(body.mitglied_id || '');

    if (!mitgliedId) return Response.json({ error: 'Kein Profil angegeben' }, { status: 400 });
    if (!iban) return Response.json({ error: 'Bitte eine IBAN angeben' }, { status: 400 });
    if (!ibanGueltig(iban)) {
      return Response.json({ error: 'Die IBAN ist ungültig (Prüfsumme stimmt nicht).' }, { status: 400 });
    }
    if (!body.mandat_bestaetigt) {
      return Response.json({ error: 'Bitte das SEPA-Lastschriftmandat bestätigen.' }, { status: 400 });
    }

    // Darf der Aufrufer für dieses Mitglied schreiben?
    const [eigenArr, zielArr] = await Promise.all([
      S.Mitglied.filter({ user_id: user.id }).catch(() => []),
      S.Mitglied.filter({ id: mitgliedId }).catch(() => []),
    ]);
    const eigen = eigenArr?.[0] || null;
    const ziel = zielArr?.[0] || null;
    if (!ziel) return Response.json({ error: 'Profil nicht gefunden' }, { status: 404 });

    let erlaubt = eigen?.id === ziel.id;
    if (!erlaubt && eigen) {
      const verw = await S.Verwandtschaft.filter({ mitglied_id: eigen.id }).catch(() => []);
      erlaubt = (verw || []).some((v: any) => v.verwandter_id === ziel.id);
    }
    if (!erlaubt) {
      return Response.json({ error: 'Du kannst nur deine eigene Bankverbindung (oder die deines Kindes) hinterlegen.' }, { status: 403 });
    }

    const daten = {
      mitglied_id: ziel.id,
      kontoinhaber: String(body.kontoinhaber || `${ziel.vorname || ''} ${ziel.nachname || ''}`).trim(),
      bankname: String(body.bankname || '').trim(),
      bic: String(body.bic || '').trim().toUpperCase(),
      iban,
      sepa_mandatnummer: `NZF-${ziel.mitgliedsnummer || ziel.id.slice(-6)}-${new Date().getFullYear()}`,
      sepa_mandatdatum: new Date().toISOString().slice(0, 10),
      notizen: `Selbstauskunft über die App (${new Date().toLocaleDateString('de-DE')})${eigen?.id !== ziel.id ? ' durch Erziehungsberechtigte/n' : ''}`,
    };

    const vorhanden = await S.MitgliedBankverbindung.filter({ mitglied_id: ziel.id }).catch(() => []);
    const gespeichert = vorhanden?.[0]
      ? await S.MitgliedBankverbindung.update(vorhanden[0].id, daten)
      : await S.MitgliedBankverbindung.create(daten);

    // Vorstand/Kassierer informieren (nicht blockierend)
    base44.functions.invoke('sendNotification', {
      aktion: 'senden',
      empfaenger: 'kassierer',
      titel: 'Neue Bankverbindung hinterlegt',
      nachricht: `${ziel.vorname} ${ziel.nachname} hat seine Bankverbindung hinterlegt.`,
      route: '/finanzen',
    }).catch(() => {});

    return Response.json({ ok: true, bankverbindung: { iban: gespeichert.iban, kontoinhaber: gespeichert.kontoinhaber, sepa_mandatdatum: gespeichert.sepa_mandatdatum } });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
