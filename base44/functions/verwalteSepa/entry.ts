import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * SEPA-Verwaltung für den Finanzbereich.
 * Berechtigt: admin, vorstand, stellv_vorstand, kassierer.
 *
 * Aktionen:
 *  - 'uebersicht'      : Mandate + Mitglieder ohne Mandat + Konfiguration
 *  - 'mandat_speichern': Mandat anlegen/ändern (prüft IBAN)
 *  - 'konfiguration_speichern': Gläubiger-ID, Vereinsname, Vereins-IBAN, Sequenz
 *  - 'lastschriftlauf' : erzeugt pain.008.001.08 (XML) für die übergebenen Beträge
 */
const FINANZ_ROLLEN = ['admin', 'vorstand', 'stellv_vorstand', 'kassierer'];

function ibanNormalisieren(iban: string): string {
  return String(iban || '').replace(/\s+/g, '').toUpperCase();
}

/** IBAN-Prüfung über Modulo 97 (wie im Frontend). */
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

/** XML-Sonderzeichen maskieren. */
function xml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const betragDe = (v: number) => Number(v || 0).toFixed(2);
const datumIso = (d: string) => String(d || '').slice(0, 10);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!FINANZ_ROLLEN.includes(user.role)) {
      return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
    }

    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const aktion = body.aktion || 'uebersicht';

    // ── Konfiguration (Gläubiger-ID etc.) in AppEinstellung 'sepa' ──
    const ladeKonfiguration = async () => {
      const t = await S.AppEinstellung.filter({ schluessel: 'sepa' }).catch(() => []);
      const roh = t?.[0]?.wert_json;
      const konf = typeof roh === 'string' ? JSON.parse(roh || '{}') : (roh || {});
      return {
        glaeubiger_id: konf.glaeubiger_id || '',
        vereinsname: konf.vereinsname || 'Narrenzunft Frommern e.V.',
        iban_verein: konf.iban_verein || '',
        bic_verein: konf.bic_verein || '',
        sequenz_typ: konf.sequenz_typ || 'RCUR',
        vorabankuendigung_tage: Number(konf.vorabankuendigung_tage || 14),
        eintragung_id: t?.[0]?.id || '',
      };
    };

    const alleMitglieder = async () => {
      const alle = [];
      for (let skip = 0; skip < 5000; skip += 500) {
        const seite = await S.Mitglied.list('nachname', 500, skip).catch(() => []);
        if (!Array.isArray(seite) || seite.length === 0) break;
        alle.push(...seite);
        if (seite.length < 500) break;
      }
      return alle;
    };

    if (aktion === 'konfiguration_speichern') {
      const konf = {
        glaeubiger_id: String(body.glaeubiger_id || '').trim().toUpperCase(),
        vereinsname: String(body.vereinsname || '').trim(),
        iban_verein: ibanNormalisieren(body.iban_verein || ''),
        bic_verein: String(body.bic_verein || '').trim().toUpperCase(),
        sequenz_typ: ['FRST', 'RCUR', 'OOFF', 'FNAL'].includes(body.sequenz_typ) ? body.sequenz_typ : 'RCUR',
        vorabankuendigung_tage: Number(body.vorabankuendigung_tage || 14),
      };
      if (konf.iban_verein && !ibanGueltig(konf.iban_verein)) {
        return Response.json({ error: 'Die IBAN des Vereins ist ungültig.' }, { status: 400 });
      }
      const t = await S.AppEinstellung.filter({ schluessel: 'sepa' }).catch(() => []);
      const inhalt = { schluessel: 'sepa', wert_json: JSON.stringify(konf) };
      if (t?.[0]) await S.AppEinstellung.update(t[0].id, inhalt);
      else await S.AppEinstellung.create(inhalt);
      return Response.json({ ok: true, konfiguration: konf });
    }

    if (aktion === 'mandat_speichern') {
      const mitgliedId = String(body.mitglied_id || '');
      if (!mitgliedId) return Response.json({ error: 'mitglied_id fehlt' }, { status: 400 });
      const iban = ibanNormalisieren(body.iban || '');
      if (iban && !ibanGueltig(iban)) {
        return Response.json({ error: 'Die IBAN ist ungültig (Prüfsumme stimmt nicht).' }, { status: 400 });
      }
      const daten = {
        mitglied_id: mitgliedId,
        kontoinhaber: String(body.kontoinhaber || '').trim(),
        iban,
        bic: String(body.bic || '').trim().toUpperCase(),
        bankname: String(body.bankname || '').trim(),
        sepa_mandatnummer: String(body.sepa_mandatnummer || '').trim(),
        sepa_mandatdatum: datumIso(body.sepa_mandatdatum) || '',
        notizen: String(body.notizen || '').trim(),
      };
      const t = await S.MitgliedBankverbindung.filter({ mitglied_id: mitgliedId }).catch(() => []);
      const gespeichert = t?.[0]
        ? await S.MitgliedBankverbindung.update(t[0].id, daten)
        : await S.MitgliedBankverbindung.create(daten);
      return Response.json({ ok: true, bankverbindung: gespeichert });
    }

    if (aktion === 'uebersicht') {
      const [mitglieder, bank, konfiguration] = await Promise.all([
        alleMitglieder(),
        S.MitgliedBankverbindung.list('mitglied_id', 500, 0).catch(() => []),
        ladeKonfiguration(),
      ]);
      const bankMap = new Map((bank || []).map((b: any) => [b.mitglied_id, b]));
      const zeilen = mitglieder
        .filter((m: any) => !m.archiviert)
        .map((m: any) => {
          const b: any = bankMap.get(m.id) || {};
          return {
            mitglied_id: m.id,
            name: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
            mitgliedsnummer: m.mitgliedsnummer || '',
            mitgliedsstatus: m.mitgliedsstatus || '',
            email: m.email || '',
            hat_mandat: Boolean(b.iban),
            kontoinhaber: b.kontoinhaber || '',
            iban: b.iban || '',
            bic: b.bic || '',
            bankname: b.bankname || '',
            sepa_mandatnummer: b.sepa_mandatnummer || '',
            sepa_mandatdatum: b.sepa_mandatdatum || '',
          };
        })
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'de'));
      return Response.json({
        ok: true,
        konfiguration,
        zeilen,
        anzahl: zeilen.length,
        mit_mandat: zeilen.filter((z: any) => z.hat_mandat).length,
        ohne_mandat: zeilen.filter((z: any) => !z.hat_mandat).length,
      });
    }

    if (aktion === 'lastschriftlauf') {
      const konfiguration = await ladeKonfiguration();
      const faelligkeit = datumIso(body.faelligkeit);
      const eintraege = Array.isArray(body.eintraege) ? body.eintraege : [];
      if (!faelligkeit) return Response.json({ error: 'Fälligkeitsdatum fehlt' }, { status: 400 });
      if (!eintraege.length) return Response.json({ error: 'Keine Beträge ausgewählt' }, { status: 400 });
      if (!konfiguration.glaeubiger_id) {
        return Response.json({ error: 'Gläubiger-ID fehlt — bitte zuerst die SEPA-Konfiguration speichern.' }, { status: 400 });
      }
      if (!konfiguration.iban_verein) {
        return Response.json({ error: 'Vereins-IBAN fehlt — bitte zuerst die SEPA-Konfiguration speichern.' }, { status: 400 });
      }

      const mitglieder = await alleMitglieder();
      const mitgliedMap = new Map(mitglieder.map((m: any) => [m.id, m]));
      const bank = await S.MitgliedBankverbindung.list('mitglied_id', 500, 0).catch(() => []);
      const bankMap = new Map((bank || []).map((b: any) => [b.mitglied_id, b]));

      const zahlungen: any[] = [];
      const fehler: string[] = [];
      for (const e of eintraege) {
        const m: any = mitgliedMap.get(e.mitglied_id);
        const b: any = bankMap.get(e.mitglied_id);
        const betrag = Number(String(e.betrag ?? '').replace(',', '.'));
        if (!m) { fehler.push(`Unbekanntes Mitglied ${e.mitglied_id}`); continue; }
        if (!b?.iban || !ibanGueltig(b.iban)) { fehler.push(`${m.vorname} ${m.nachname}: keine gültige IBAN`); continue; }
        if (!b.sepa_mandatnummer) { fehler.push(`${m.vorname} ${m.nachname}: Mandatsreferenz fehlt`); continue; }
        if (!(betrag > 0)) { fehler.push(`${m.vorname} ${m.nachname}: Betrag ungültig`); continue; }
        zahlungen.push({
          mitglied_id: m.id,
          name: `${m.vorname || ''} ${m.nachname || ''}`.trim(),
          iban: b.iban,
          bic: b.bic || '',
          kontoinhaber: b.kontoinhaber || `${m.vorname || ''} ${m.nachname || ''}`.trim(),
          mandat: b.sepa_mandatnummer,
          mandatdatum: b.sepa_mandatdatum || '',
          betrag,
          verwendungszweck: String(e.verwendungszweck || `Beitrag ${body.jahr || new Date().getFullYear()}`).slice(0, 140),
        });
      }

      if (!zahlungen.length) {
        return Response.json({ error: 'Kein einziger Eintrag ist einreichbar.', fehler }, { status: 400 });
      }

      const jetzt = new Date();
      const stempel = jetzt.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const msgId = `NZF-${stempel}`;
      const summe = zahlungen.reduce((s, z) => s + z.betrag, 0);

      const transaktionen = zahlungen.map((z, i) => `
      <DrctDbtTxInf>
        <PmtId><EndToEndId>${xml(msgId)}-${String(i + 1).padStart(4, '0')}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${betragDe(z.betrag)}</InstdAmt>
        ${z.bic ? `<CdtrAgt><FinInstnId><BIC>${xml(z.bic)}</BIC></FinInstnId></CdtrAgt>` : ''}
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${xml(z.mandat)}</MndtId>
            <DtOfSgntr>${xml(z.mandatdatum || datumIso(jetzt.toISOString()))}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt><FinInstnId><Oth><Id>NOTPROVIDED</Id></Oth></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${xml(z.kontoinhaber)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${xml(z.iban)}</IBAN></Id></DbtrAcct>
        <Purp><Cd>CHAR</Cd></Purp>
        <RmtInf><Ustrd>${xml(z.verwendungszweck)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`).join('');

      const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.08" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${xml(msgId)}</MsgId>
      <CreDtTm>${jetzt.toISOString().slice(0, 19)}</CreDtTm>
      <NbOfTxs>${zahlungen.length}</NbOfTxs>
      <CtrlSum>${betragDe(summe)}</CtrlSum>
      <InitgPty><Nm>${xml(konfiguration.vereinsname)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${xml(msgId)}-01</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${zahlungen.length}</NbOfTxs>
      <CtrlSum>${betragDe(summe)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>CORE</Cd></LclInstrm>
        <SeqTp>${xml(konfiguration.sequenz_typ)}</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${xml(faelligkeit)}</ReqdColltnDt>
      <Cdtr><Nm>${xml(konfiguration.vereinsname)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${xml(konfiguration.iban_verein)}</IBAN></Id></CdtrAcct>
      ${konfiguration.bic_verein ? `<CdtrAgt><FinInstnId><BIC>${xml(konfiguration.bic_verein)}</BIC></FinInstnId></CdtrAgt>` : ''}
      <ChrgsAcct><Id><IBAN>${xml(konfiguration.iban_verein)}</IBAN></Id></ChrgsAcct>
      <CdtrSchmeId>
        <Id><PrvtId><Othr>
          <Id>${xml(konfiguration.glaeubiger_id)}</Id>
          <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
        </Othr></PrvtId></Id>
      </CdtrSchmeId>${transaktionen}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

      // Lauf für Nachvollziehbarkeit protokollieren (Push an Vorstand optional)
      const protokoll = {
        datum: jetzt.toISOString(),
        faelligkeit,
        anzahl: zahlungen.length,
        summe: Number(summe.toFixed(2)),
        fehler,
        von: user.email || '',
      };

      return Response.json({ ok: true, xml: xmlString, protokoll, fehler, anzahl: zahlungen.length, summe: Number(summe.toFixed(2)) });
    }

    return Response.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
