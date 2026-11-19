import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { loeseMeinMitglied, istVerwaltung, istElternVon } from "../../shared/mitgliedBerechtigung.ts";
import { sendePush } from "../../shared/pushSenden.ts";

/**
 * U18-Begleitbestätigung (U18Begleitung-Entity) für Termine/Ausfahrten/
 * Veranstaltungen mit Pflicht-Flag (u18_begleitung_erforderlich).
 *
 * Ablauf:
 *   1. 'anlegen': Bei Anmeldung einer U18-Person wird ein Datensatz mit
 *      Begleitperson (Mitglied oder externer Name) angelegt (Status: Ausstehend).
 *      Anlegen darf: die/der U18 selbst, ein Elternteil oder Verwaltung.
 *   2. 'eltern_bestaetigen': Erziehungsberechtigte/r bestätigt
 *      (Verwandtschafts-Prüfung via istElternVon) — mit Zeitstempel.
 *   3. 'begleitung_bestaetigen': Die Begleitperson bestätigt selbst (falls
 *      Mitglied); bei externer Begleitung nur Vorstand (manuell, z. B. vor Ort).
 *   4. 'ablehnen': Die Begleitperson (oder Verwaltung) gibt den Auftrag zurück.
 *      Status 'Abgelehnt', Begleitbestätigung wird zurückgesetzt, Ablehnung mit
 *      Name + Datum in notiz vermerkt, Push an die Eltern.
 *   5. 'liste': Begleitungen eines Termins (optional typ).
 * Erst wenn Eltern UND Begleitperson bestätigt haben, ist der Status 'Bestätigt'.
 * Updates laufen im service-role (RLS update = vorstand/admin; service-role
 * bypasses RLS). _von-Felder speichern die Mitglieds-ID (verfolgbar).
 */
// Deploy-Marker (main b93dd7c): elternIdsVon liest die Verwandtschaft in der
// richtigen Richtung (Elternteil = mitglied_id), Ablehnen-Pfad nutzt denselben Helfer.
// aufsicht_pruefen loescht nur noch Auftraege, die VOR der Elternanmeldung
// entstanden sind - spaeter bewusst gesetzte Aufsichten bleiben stehen.
const jetztISO = () => new Date().toISOString();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const S = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;

    async function nameVon(id) {
      if (!id) return "";
      const m = await S.Mitglied.get(id).catch(() => null);
      return m ? `${m.vorname || ""} ${m.nachname || ""}`.trim() : "";
    }

    /** Mitglieds-IDs der Kinder eines Mitglieds (beide Richtungen). */
    async function kindIdsVon(mitgliedId) {
      if (!mitgliedId) return [];
      const [hin, zurueck] = await Promise.all([
        S.Verwandtschaft.filter({ mitglied_id: mitgliedId }).catch(() => []),
        S.Verwandtschaft.filter({ verwandter_id: mitgliedId }).catch(() => []),
      ]);
      const ids = [
        ...(hin || []).filter(v => (v.beziehung || "").toLowerCase().includes("kind")).map(v => v.verwandter_id),
        ...(zurueck || []).filter(v => (v.beziehung || "").toLowerCase().includes("elternteil")).map(v => v.mitglied_id),
      ].filter(Boolean);
      return [...new Set(ids)];
    }

    /**
     * Mitglieds-IDs der Erziehungsberechtigten eines Kindes.
     *
     * Konvention (src/lib/verwandtschaft.js): {mitglied_id: A, verwandter_id: B,
     * beziehung: "Kind"} bedeutet "B ist das Kind von A" - also ist A der
     * Elternteil. Die fruehere Fassung suchte "Elternteil" auf der Seite von
     * verwandter_id und fand deshalb NIE jemanden; Eltern bekamen keinen Push.
     */
    async function elternIdsVon(kindId) {
      if (!kindId) return [];
      const [alsKind, alsElternteil] = await Promise.all([
        S.Verwandtschaft.filter({ verwandter_id: kindId }).catch(() => []),
        S.Verwandtschaft.filter({ mitglied_id: kindId }).catch(() => []),
      ]);
      const elternRollen = /^(kind|sohn|tochter)$/i;
      const gegenRollen = /^(elternteil|mutter|vater)$/i;
      const ids = [
        ...(alsKind || [])
          .filter(v => elternRollen.test((v.beziehung || "").trim()))
          .map(v => v.mitglied_id),
        ...(alsElternteil || [])
          .filter(v => gegenRollen.test((v.beziehung || "").trim()))
          .map(v => v.verwandter_id),
      ].filter(Boolean);
      return [...new Set(ids)];
    }

    async function informiereEltern(kindId, kindName, titel, text) {
      try {
        const ids = await elternIdsVon(kindId);
        if (ids.length) await sendePush(ids, titel, text, { route: "/dashboard" });
      } catch (e) { console.error("U18-Push Eltern:", e); }
    }

    function statusVon(e) {
      const eltern = !!e.eltern_bestaetigt_am;
      const begl = !!e.begleitung_bestaetigt_am;
      return eltern && begl ? "Bestätigt" : "Ausstehend";
    }

    if (aktion === "anlegen") {
      const { typ, termin_id, u18_mitglied_id, begleit_mitglied_id, begleit_name, notiz } = body;
      if (!termin_id || !u18_mitglied_id || !typ) {
        return Response.json({ error: "typ, termin_id und u18_mitglied_id fehlen" }, { status: 400 });
      }
      if (!begleit_mitglied_id && !String(begleit_name || "").trim()) {
        return Response.json({ error: "Begleitperson fehlt (Mitglied oder Name)" }, { status: 400 });
      }
      const mein = await loeseMeinMitglied(base44, user);
      const darf = istVerwaltung(user)
        || (mein && mein.id === u18_mitglied_id)
        || (await istElternVon(base44, mein?.id, u18_mitglied_id));
      if (!darf) {
        return Response.json({ error: "Nur U18-Person selbst, Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
      }
      // Doppel-Anlage vermeiden: bestehenden Eintrag aktualisieren
      const bestehende = await S.U18Begleitung.filter({ typ, termin_id, u18_mitglied_id }).catch(() => []);
      const aktiv = (bestehende || [])[0];
      if (aktiv) {
        // Erneute Zuordnung (Wechsel der Aufsicht, Ab- und Wiederanmeldung oder
        // vorher abgelehnt): alte Bestaetigungen gelten NICHT weiter, sonst waere
        // eine fruehere Zusage automatisch wieder gueltig, ohne dass die
        // Aufsichtsperson erneut gefragt wurde. Beide Seiten bestaetigen neu.
        const neuerName = begleit_mitglied_id
          ? await nameVon(begleit_mitglied_id)
          : String(begleit_name || "").trim();
        const erg = await S.U18Begleitung.update(aktiv.id, {
          begleit_mitglied_id: begleit_mitglied_id || "",
          begleit_name: neuerName,
          eltern_bestaetigt_am: "",
          eltern_bestaetigt_von: "",
          begleitung_bestaetigt_am: "",
          begleitung_bestaetigt_von: "",
          status: "Ausstehend",
          notiz: [aktiv.notiz, "Neu zugeordnet am " + jetztISO().slice(0, 10)]
            .filter(Boolean).join(" | "),
        });
        if (begleit_mitglied_id) {
          try {
            await sendePush(
              [begleit_mitglied_id],
              "Erziehungsauftrag",
              "Du sollst " + (aktiv.u18_name || "ein Kind") + " beaufsichtigen. Bitte bestätige den Auftrag erneut.",
              { route: "/dashboard" },
            );
          } catch (e) { console.error("U18-Neuzuordnung-Push:", e); }
        }
        await informiereEltern(
          aktiv.u18_mitglied_id,
          aktiv.u18_name,
          "Aufsicht bestätigen",
          (neuerName || "Die Begleitperson") + " soll " + (aktiv.u18_name || "dein Kind") + " beaufsichtigen. Bitte bestätige erneut.",
        );
        return Response.json({ ok: true, existierend: true, zurueckgesetzt: true, id: aktiv.id, begleitung: erg });
      }
      const rec = await S.U18Begleitung.create({
        typ,
        termin_id,
        u18_mitglied_id,
        u18_name: await nameVon(u18_mitglied_id),
        begleit_mitglied_id: begleit_mitglied_id || "",
        begleit_name: begleit_mitglied_id ? await nameVon(begleit_mitglied_id) : String(begleit_name || "").trim(),
        status: "Ausstehend",
        notiz: notiz || "",
      });
      // Begleitperson sofort informieren (nur wenn sie ein App-Konto hat).
      if (rec.begleit_mitglied_id) {
        try {
          await sendePush([rec.begleit_mitglied_id], "Erziehungsauftrag",
            "Du sollst " + (rec.u18_name || "ein Kind") + " beaufsichtigen. Bitte bestaetigen.",
            { route: "/dashboard" });
        } catch (e) { console.error("U18-Push:", e); }
      }
      // Eltern muessen ebenfalls bestaetigen, also sofort informieren.
      await informiereEltern(
        rec.u18_mitglied_id,
        rec.u18_name,
        "Aufsicht bestätigen",
        (rec.begleit_name || "Die Begleitperson") + " soll " + (rec.u18_name || "dein Kind") + " beaufsichtigen. Bitte bestätige.",
      );
      return Response.json({ ok: true, id: rec.id, begleitung: rec });
    }

    if (aktion === "aufsicht_pruefen") {
      // Meldet sich ein Erziehungsberechtigter selbst zu einer Veranstaltung an,
      // faehrt eine Aufsicht mit und der Erziehungsauftrag wird nicht mehr
      // gebraucht (Vorgabe Pierre 19.11.). Der Auftrag wird geloescht und die
      // Begleitperson informiert, damit sie nicht weiter fuer das Kind plant.
      const { termin_id, mitglied_id } = body;
      if (!termin_id || !mitglied_id) {
        return Response.json({ error: "termin_id und mitglied_id fehlen" }, { status: 400 });
      }
      const mein = await loeseMeinMitglied(base44, user);
      const darf = istVerwaltung(user) || (mein && mein.id === mitglied_id);
      if (!darf) return Response.json({ error: "Nicht berechtigt" }, { status: 403 });

      // Nur wenn die Person fuer diese Veranstaltung wirklich (noch) angemeldet
      // ist - sonst wuerde ein Seitenaufruf Auftraege loeschen.
      const anmeldungen = await S.AusfahrtAnmeldung
        .filter({ ausfahrt_id: termin_id, mitglied_id })
        .catch(() => []);
      const aktiveAnmeldungen = (anmeldungen || []).filter(a => a.status !== "Abgemeldet");
      if (aktiveAnmeldungen.length === 0) {
        return Response.json({ ok: true, geloescht: 0, grund: "nicht angemeldet" });
      }
      // Wann hat sich der Elternteil angemeldet? Ein Auftrag, der DANACH
      // angelegt wurde, ist eine bewusste Entscheidung und bleibt bestehen -
      // sonst wuerde jede Anmeldung die spaetere Zuordnung wieder loeschen.
      const anmeldeZeit = Math.max(
        ...aktiveAnmeldungen.map(a => new Date(a.created_date || a.angemeldet_am || 0).getTime())
      );

      const kindIds = await kindIdsVon(mitglied_id);
      if (kindIds.length === 0) return Response.json({ ok: true, geloescht: 0 });

      const auftraege = await S.U18Begleitung.filter({ termin_id }).catch(() => []);
      const betroffen = (auftraege || []).filter(a => kindIds.includes(a.u18_mitglied_id));
      if (betroffen.length === 0) return Response.json({ ok: true, geloescht: 0 });

      let elternName = await nameVon(mitglied_id);
      let titel = "der Ausfahrt";
      if (betroffen[0]?.typ === "ausfahrt") {
        const a = await S.Ausfahrt.get(termin_id).catch(() => null);
        if (a && a.titel) titel = a.titel;
      }

      let geloescht = 0;
      let behalten = 0;
      for (const a of betroffen) {
        // Ist die Aufsicht selbst die angemeldete Person, bleibt der Auftrag
        // bestehen - sie muss ihn weiterhin bestaetigen.
        if (a.begleit_mitglied_id && a.begleit_mitglied_id === mitglied_id) continue;
        // Nach der Anmeldung bewusst zugeordnet -> nicht anfassen.
        const auftragZeit = new Date(a.created_date || 0).getTime();
        if (auftragZeit > anmeldeZeit) { behalten += 1; continue; }
        await S.U18Begleitung.delete(a.id);
        geloescht += 1;
        if (a.begleit_mitglied_id) {
          try {
            await sendePush(
              [a.begleit_mitglied_id],
              "Aufsicht nicht mehr nötig",
              (elternName || "Ein Elternteil") + " fährt bei " + titel + " selbst mit. Dein Erziehungsauftrag für " + (a.u18_name || "das Kind") + " ist damit erledigt.",
              { route: "/dashboard" },
            );
          } catch (e) { console.error("Push Aufsicht erledigt:", e); }
        }
      }
      return Response.json({ ok: true, geloescht, behalten });
    }

    if (aktion === "eltern_bestaetigen") {
      const bid = body.eintrag_id || body.begleitung_id;
      const e = bid ? await S.U18Begleitung.get(bid).catch(() => null) : null;
      if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      if (!mein) return Response.json({ error: "Kein Mitglied verknüpft" }, { status: 403 });
      const ok = istVerwaltung(user) || (await istElternVon(base44, mein.id, e.u18_mitglied_id));
      if (!ok) return Response.json({ error: "Nur Erziehungsberechtigte/r oder Verwaltung" }, { status: 403 });
      const erg = await S.U18Begleitung.update(bid, {
        eltern_bestaetigt_am: jetztISO(),
        eltern_bestaetigt_von: mein.id,
        status: statusVon({ ...e, eltern_bestaetigt_am: jetztISO() }),
      });
      // Aufsichtsperson informieren, dass der Auftrag jetzt verbindlich ist.
      if (e.begleit_mitglied_id) {
        try {
          const beide = !!(e.begleitung_bestaetigt_am);
          await sendePush([e.begleit_mitglied_id], "Erziehungsauftrag",
            "Die Eltern haben bestätigt: du beaufsichtigst " + (e.u18_name || "das Kind") + "."
              + (beide ? "" : " Bitte bestätige deinen Teil noch."),
            { route: "/dashboard" });
        } catch (err) { console.error("U18-Push Aufsicht:", err); }
      }
      return Response.json({ ok: true, id: bid, begleitung: erg });
    }

    if (aktion === "begleitung_bestaetigen") {
      const bid = body.eintrag_id || body.begleitung_id;
      const e = bid ? await S.U18Begleitung.get(bid).catch(() => null) : null;
      if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      // Regel (Pierre 19.11.): Hat die Aufsicht ein App-Konto, bestaetigt sie
      // AUSSCHLIESSLICH selbst - auch Eltern und Vorstand duerfen das nicht
      // fuer sie tun, sonst steht im Datensatz eine Zusage, die es nicht gibt.
      // Nur bei externer Begleitung (kein Konto) bestaetigt die Verwaltung.
      const hatKonto = !!e.begleit_mitglied_id;
      const istSelbst = !!mein && hatKonto && e.begleit_mitglied_id === mein.id;
      const ok = hatKonto ? istSelbst : istVerwaltung(user);
      if (!ok) {
        return Response.json({
          error: hatKonto
            ? "Die Aufsicht bestätigt selbst in der App. Eltern und Vorstand können das nicht übernehmen."
            : "Nur die Verwaltung kann eine externe Begleitung bestätigen.",
        }, { status: 403 });
      }
      const erg = await S.U18Begleitung.update(bid, {
        begleitung_bestaetigt_am: jetztISO(),
        begleitung_bestaetigt_von: mein?.id || "",
        status: statusVon({ ...e, begleitung_bestaetigt_am: jetztISO() }),
      });
      // Eltern informieren, dass die Aufsicht uebernommen hat und sie noch bestaetigen muessen.
      await informiereEltern(
        e.u18_mitglied_id,
        e.u18_name,
        "Aufsicht übernommen",
        (e.begleit_name || "Die Begleitperson") + " hat die Aufsicht für " + (e.u18_name || "dein Kind") + " übernommen. Bitte bestätige noch.",
      );
      return Response.json({ ok: true, id: bid, begleitung: erg });
    }

    if (aktion === "ablehnen") {
      const bid = body.eintrag_id || body.begleitung_id;
      const e = bid ? await S.U18Begleitung.get(bid).catch(() => null) : null;
      if (!e) return Response.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
      const mein = await loeseMeinMitglied(base44, user);
      const ok = istVerwaltung(user) || (mein && e.begleit_mitglied_id === mein.id);
      if (!ok) return Response.json({ error: "Nur die Begleitperson selbst oder Verwaltung" }, { status: 403 });
      const grund = String(body.grund || "").trim();
      const wer = ((mein && mein.vorname) || "") + " " + ((mein && mein.nachname) || "");
      const vermerk = "Abgelehnt von " + wer.trim() + " am " + jetztISO().slice(0, 10) + (grund ? ": " + grund : "");
      const erg = await S.U18Begleitung.update(bid, {
        status: "Abgelehnt",
        begleitung_bestaetigt_am: "",
        begleitung_bestaetigt_von: "",
        notiz: [e.notiz, vermerk].filter(Boolean).join(" | "),
      });
      // Eltern informieren, damit sie eine andere Aufsicht eintragen koennen
      try {
        await informiereEltern(
          e.u18_mitglied_id,
          e.u18_name,
          "Aufsicht abgelehnt",
          (wer.trim() || "Die Begleitperson") + " kann " + (e.u18_name || "dein Kind") + " nicht beaufsichtigen. Bitte jemand anderen eintragen.",
        );
      } catch (err) { console.error("U18-Ablehnung-Push:", err); }
      return Response.json({ ok: true, id: bid, begleitung: erg });
    }

    if (aktion === "liste") {
      const { termin_id, typ } = body;
      if (!termin_id) return Response.json({ error: "termin_id fehlt" }, { status: 400 });
      const q = { termin_id };
      if (typ) q.typ = typ;
      const list = await S.U18Begleitung.filter(q);
      return Response.json({ ok: true, begleitungen: list || [] });
    }

    return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
  } catch (error) {
    console.error("verwalteU18Begleitung:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}