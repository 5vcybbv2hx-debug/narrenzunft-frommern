import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Kassenbuch (Stufe 2).
 *
 * Grundsätze, die hier technisch erzwungen werden:
 *  - Belegnummern werden serverseitig fortlaufend je Jahr vergeben (kein Löschen, nur Storno).
 *  - Buchungen sind unveränderlich; Korrekturen laufen über eine Stornobuchung (Gegenbuchung).
 *  - Kassenprüfer dürfen lesen, aber nicht buchen.
 *
 * Aktionen:
 *  - 'uebersicht'      : Buchungen, Bestand, Summen, Kassenstürze (optional jahr/monat Filter)
 *  - 'buchen'          : neue Buchung mit Belegnummer
 *  - 'stornieren'      : Gegenbuchung erzeugen und Original als storniert markieren
 *  - 'kassensturz'     : Zählprotokoll speichern (Soll/Ist/Differenz)
 */
const LESEN = ['admin', 'vorstand', 'stellv_vorstand', 'kassierer', 'kassenpruefer'];
const BUCHEN = ['admin', 'vorstand', 'stellv_vorstand', 'kassierer'];

const betrag = (v: any) => Math.abs(Number(String(v ?? '').replace(',', '.')) || 0);
const datumIso = (d: any) => String(d || '').slice(0, 10);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!LESEN.includes(user.role)) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });

    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const aktion = body.aktion || 'uebersicht';
    const darfBuchen = BUCHEN.includes(user.role);

    const ladeAlle = async (ent: string, sort: string) => {
      const alle = [];
      for (let skip = 0; skip < 5000; skip += 500) {
        const seite = await (S as any)[ent].list(sort, 500, skip).catch(() => []);
        if (!Array.isArray(seite) || seite.length === 0) break;
        alle.push(...seite);
        if (seite.length < 500) break;
      }
      return alle;
    };

    if (aktion === 'buchen') {
      if (!darfBuchen) return Response.json({ error: 'Kassenprüfer dürfen nicht buchen.' }, { status: 403 });
      const datum = datumIso(body.datum) || new Date().toISOString().slice(0, 10);
      const art = body.art === 'Ausgabe' ? 'Ausgabe' : 'Einnahme';
      const summe = betrag(body.betrag);
      if (!(summe > 0)) return Response.json({ error: 'Betrag muss größer als 0 sein.' }, { status: 400 });
      if (!String(body.beschreibung || '').trim()) return Response.json({ error: 'Bitte eine Beschreibung angeben.' }, { status: 400 });
      if (!String(body.kategorie || '').trim()) return Response.json({ error: 'Bitte eine Kategorie wählen.' }, { status: 400 });

      // Fortlaufende Belegnummer je Jahr
      const jahr = Number(datum.slice(0, 4));
      const vorhandene = await ladeAlle('Kassenbuchung', '-belegnummer');
      const nummern = vorhandene
        .map((b: any) => String(b.belegnummer || ''))
        .filter((n: string) => n.startsWith(String(jahr)))
        .map((n: string) => Number(String(n).split('-')[1] || 0));
      const naechste = (nummern.length ? Math.max(...nummern) : 0) + 1;
      const belegnummer = `${jahr}-${String(naechste).padStart(4, '0')}`;

      const gebucht = await S.Kassenbuchung.create({
        belegnummer,
        datum,
        art,
        betrag: Number(summe.toFixed(2)),
        kategorie: String(body.kategorie || '').trim(),
        beschreibung: String(body.beschreibung || '').trim(),
        konto: body.konto === 'Bank' ? 'Bank' : 'Barkasse',
        veranstaltung_id: body.veranstaltung_id || '',
        mitglied_id: body.mitglied_id || '',
        beleg_url: body.beleg_url || '',
        gebucht_von: `${user.full_name || user.email || ''}`,
        storniert: false,
      });
      return Response.json({ ok: true, buchung: gebucht });
    }

    if (aktion === 'stornieren') {
      if (!darfBuchen) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
      const id = String(body.id || '');
      const grund = String(body.grund || '').trim();
      if (!id) return Response.json({ error: 'Buchung fehlt' }, { status: 400 });
      if (!grund) return Response.json({ error: 'Bitte einen Storno-Grund angeben.' }, { status: 400 });
      const original = (await S.Kassenbuchung.filter({ id }))?.[0];
      if (!original) return Response.json({ error: 'Buchung nicht gefunden' }, { status: 404 });
      if (original.storniert) return Response.json({ error: 'Buchung ist bereits storniert.' }, { status: 400 });

      const datum = datumIso(body.datum) || new Date().toISOString().slice(0, 10);
      const jahr = Number(datum.slice(0, 4));
      const vorhandene = await ladeAlle('Kassenbuchung', '-belegnummer');
      const nummern = vorhandene
        .map((b: any) => String(b.belegnummer || ''))
        .filter((n: string) => n.startsWith(String(jahr)))
        .map((n: string) => Number(String(n).split('-')[1] || 0));
      const belegnummer = `${jahr}-${String((nummern.length ? Math.max(...nummern) : 0) + 1).padStart(4, '0')}`;

      const storno = await S.Kassenbuchung.create({
        belegnummer,
        datum,
        art: original.art === 'Einnahme' ? 'Ausgabe' : 'Einnahme',
        betrag: Math.abs(Number(original.betrag || 0)),
        kategorie: original.kategorie || 'Storno',
        beschreibung: `Storno zu ${original.belegnummer}: ${grund}`,
        konto: original.konto || 'Barkasse',
        gebucht_von: `${user.full_name || user.email || ''}`,
        storniert: false,
        storno_zu_id: original.id,
      });
      await S.Kassenbuchung.update(original.id, { storniert: true, storno_grund: grund });
      return Response.json({ ok: true, storno });
    }

    if (aktion === 'kassensturz') {
      if (!darfBuchen) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
      const konto = body.konto === 'Bank' ? 'Bank' : 'Barkasse';
      const gezaehlt = betrag(body.gezaehlt);
      const buchungen = await ladeAlle('Kassenbuchung', '-datum');
      // Storno läuft als Gegenbuchung: Original und Gegenbuchung zählen beide,
      // damit der Bestand nach einem Storno wieder stimmt.
      const soll = buchungen
        .filter((b: any) => (b.konto || 'Barkasse') === konto)
        .reduce((s: number, b: any) => s + (b.art === 'Ausgabe' ? -Number(b.betrag || 0) : Number(b.betrag || 0)), 0);
      const differenz = Number((gezaehlt - soll).toFixed(2));
      const sturz = await S.Kassensturz.create({
        datum: datumIso(body.datum) || new Date().toISOString().slice(0, 10),
        konto,
        soll: Number(soll.toFixed(2)),
        gezaehlt: Number(gezaehlt.toFixed(2)),
        differenz,
        notiz: String(body.notiz || '').trim(),
        gezaehlt_von: `${user.full_name || user.email || ''}`,
        pruefer: String(body.pruefer || '').trim(),
      });
      return Response.json({ ok: true, kassensturz: sturz, soll: Number(soll.toFixed(2)), differenz });
    }

    if (aktion === 'uebersicht') {
      const jahr = Number(body.jahr || new Date().getFullYear());
      const [buchungen, stuerze] = await Promise.all([
        ladeAlle('Kassenbuchung', '-datum'),
        ladeAlle('Kassensturz', '-datum'),
      ]);
      // Stornierte Buchungen bleiben im Bestand stehen – die Gegenbuchung neutralisiert sie.
      const aktiv = buchungen;
      const imJahr = aktiv.filter((b: any) => String(b.datum || '').startsWith(String(jahr)));
      const summe = (liste: any[], art: string) => Number(liste.filter((b) => b.art === art).reduce((s, b) => s + Number(b.betrag || 0), 0).toFixed(2));
      const bestand = (konto: string) => Number(aktiv
        .filter((b: any) => (b.konto || 'Barkasse') === konto)
        .reduce((s: number, b: any) => s + (b.art === 'Ausgabe' ? -Number(b.betrag || 0) : Number(b.betrag || 0)), 0).toFixed(2));

      // Kategorien-Summen im Jahr
      const kategorien: Record<string, { einnahmen: number; ausgaben: number }> = {};
      imJahr.forEach((b: any) => {
        const k = b.kategorie || 'ohne Kategorie';
        kategorien[k] = kategorien[k] || { einnahmen: 0, ausgaben: 0 };
        if (b.art === 'Ausgabe') kategorien[k].ausgaben += Number(b.betrag || 0);
        else kategorien[k].einnahmen += Number(b.betrag || 0);
      });

      return Response.json({
        ok: true,
        jahr,
        darf_buchen: darfBuchen,
        buchungen: buchungen.map((b: any) => ({ ...b })),
        kassenstuerze: stuerze,
        kennzahlen: {
          bestand_barkasse: bestand('Barkasse'),
          bestand_bank: bestand('Bank'),
          einnahmen_jahr: summe(imJahr, 'Einnahme'),
          ausgaben_jahr: summe(imJahr, 'Ausgabe'),
          saldo_jahr: Number((summe(imJahr, 'Einnahme') - summe(imJahr, 'Ausgabe')).toFixed(2)),
          anzahl_buchungen_jahr: imJahr.length,
        },
        kategorien,
      });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}