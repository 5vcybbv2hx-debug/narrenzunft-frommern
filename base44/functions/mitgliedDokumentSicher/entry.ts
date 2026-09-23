import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { istVorstand, loeseMeinMitglied } from "../../shared/mitgliedBerechtigung.ts";

/**
 * Sichere Verwaltung geschützter Vereinsdokumente pro Mitglied.
 *
 * Dokumente liegen im PRIVATE Storage (UploadPrivateFile → file_uri, NICHT öffentlich).
 * Download nur via zeitlich begrenzter signierter URL, und nur nach Auth-Prüfung.
 *
 * Aktionen (alle nur Verwaltung / Vorstand):
 *  - liste:        Dokumente eines Mitglieds auflisten.
 *  - anlegen:      Metadaten speichern (file_uri kam von Frontend via UploadPrivateFile).
 *  - signed_url:   Signierte Download-URL erzeugen (Gültigkeit 5 min).
 *  - loeschen:      Dokument + Metadatensatz entfernen (nur Admin/Vorstand).
 *
 * Legacy antrag_pdf_url (öffentliche URL) wird im Frontend direkt angezeigt;
 * neue Dokumente gehen ausschließlich über diesen privaten Pfad.
 */
const heuteISO = () => new Date().toISOString().split("T")[0];
const DOKUMENT_TYPEN = new Set(["Antrag", "Einverständnis", "Bescheinigung", "Austritt", "Sonstiges"]);

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!istVorstand(user)) {
      return Response.json({ error: "Access Denied", message: "Nur Vorstand/Admin/Stv." }, { status: 403 });
    }
    const S = base44.asServiceRole.entities;
    const I = base44.asServiceRole.integrations.Core;
    const body = await req.json().catch(() => ({}));
    const { aktion } = body;
    if (!aktion) return Response.json({ error: "Keine Aktion" }, { status: 400 });

    const meinMitglied = await loeseMeinMitglied(base44, user);

    switch (aktion) {
      case "liste": {
        const { mitglied_id } = body;
        if (!mitglied_id) return Response.json({ error: "mitglied_id fehlt" }, { status: 400 });
        const docs = await S.MitgliedDokument.filter({ mitglied_id });
        return Response.json({ dokumente: docs || [] });
      }
      case "anlegen": {
        const { mitglied_id, typ, name, beschreibung, file_uri, datei_groesse, datum } = body;
        if (!mitglied_id || !typ || !name || !file_uri) {
          return Response.json({ error: "Pflichtfelder fehlen (mitglied_id, typ, name, file_uri)" }, { status: 400 });
        }
        if (!DOKUMENT_TYPEN.has(typ) || typeof name !== "string" || !name.trim() || name.length > 180) {
          return Response.json({ error: "Ungültiger Dokumenttyp oder Dateiname" }, { status: 400 });
        }
        if (typeof file_uri !== "string" || !file_uri.trim() || /^https?:\/\//i.test(file_uri)) {
          return Response.json({ error: "file_uri muss eine gültige private Storage-URI sein" }, { status: 400 });
        }
        const groesse = Number(datei_groesse || 0);
        if (!Number.isFinite(groesse) || groesse < 0 || groesse > 15 * 1024 * 1024) {
          return Response.json({ error: "Ungültige Dateigröße (max. 15 MB)" }, { status: 400 });
        }
        const ziel = await S.Mitglied.get(mitglied_id).catch(() => null);
        if (!ziel) return Response.json({ error: "Mitglied nicht gefunden" }, { status: 404 });
        // Nur registrieren, wenn der private Speicher diese Datei tatsächlich signieren kann.
        // Ein frei erfundener String darf keinen defekten Dokumenteintrag erzeugen.
        try {
          const probe = await I.CreateFileSignedUrl({ file_uri, expires_in: 60 });
          if (!(probe?.signed_url || probe?.data?.signed_url)) throw new Error("No signed URL");
        } catch {
          return Response.json({ error: "Private Datei nicht gefunden oder URI ungültig" }, { status: 400 });
        }
        const doc = await S.MitgliedDokument.create({
          mitglied_id, typ, name,
          beschreibung: beschreibung || "",
          file_uri,
          datei_groesse: groesse,
          datum: datum || heuteISO(),
          hochgeladen_von_id: meinMitglied?.id || "",
          ist_legacy_public: false,
        });
        await S.MitgliedEreignis.create({
          mitglied_id, typ: "Notiz", datum: heuteISO(),
          titel: `Dokument hinzugefügt: ${name}`,
          beschreibung: typ,
          erstellt_von_id: meinMitglied?.id || "",
        }).catch(() => {});
        return Response.json({ dokument: doc });
      }
      case "signed_url": {
        const { dokument_id } = body;
        if (!dokument_id) return Response.json({ error: "dokument_id fehlt" }, { status: 400 });
        const doc = await S.MitgliedDokument.get(dokument_id).catch(() => null);
        if (!doc) return Response.json({ error: "Dokument nicht gefunden" }, { status: 404 });
        if (!doc.file_uri || /^https?:\/\//i.test(doc.file_uri)) {
          return Response.json({ error: "Keine private Datei-URI vorhanden" }, { status: 400 });
        }
        let res;
        try {
          res = await I.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 300 });
        } catch {
          return Response.json({ error: "Private Datei nicht mehr abrufbar" }, { status: 404 });
        }
        const signed_url = res?.signed_url || res?.data?.signed_url;
        if (!signed_url) return Response.json({ error: "Signierte URL konnte nicht erzeugt werden" }, { status: 500 });
        return Response.json({ signed_url, name: doc.name });
      }
      case "loeschen": {
        const { dokument_id } = body;
        if (!dokument_id) return Response.json({ error: "dokument_id fehlt" }, { status: 400 });
        if (user.role !== "admin" && user.role !== "vorstand") {
          return Response.json({ error: "Nur Admin/Vorstand darf löschen" }, { status: 403 });
        }
        const doc = await S.MitgliedDokument.get(dokument_id).catch(() => null);
        if (doc) {
          await S.MitgliedEreignis.create({
            mitglied_id: doc.mitglied_id, typ: "Notiz", datum: heuteISO(),
            titel: `Dokument entfernt: ${doc.name}`,
            erstellt_von_id: meinMitglied?.id || "",
          }).catch(() => {});
        }
        await S.MitgliedDokument.delete(dokument_id);
        return Response.json({ ok: true, dokument_id });
      }
      default:
        return Response.json({ error: "Unbekannte Aktion: " + aktion }, { status: 400 });
    }
  } catch (error) {
    console.error("mitgliedDokumentSicher:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}