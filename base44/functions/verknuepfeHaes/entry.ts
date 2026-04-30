import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Manuelle Zuordnung: Häsnummer -> [Vorname, Nachname]
// Basierend auf der Originalliste (nur Häs mit Besitzern, nicht Vereinshäs/Frei)
const HAES_BESITZER = {
  // Brennnesseln (0001-0052)
  "0001": ["Peter", "Wager"],
  "0002": ["Armin", "Gogoll"],
  "0003": ["Kai", "Müller"],
  "0004": ["Christian", "Lämmle"],
  "0005": ["Rainer", "Müller"],
  "0006": ["Hansjörg", "Armbruster"],
  "0007": ["Andreas", "Schüttler"],
  "0008": ["Timo", "Rebholz"],
  "0009": ["Martin", "Knopf"],
  "0010": ["Stefan", "Müller"],
  "0011": ["Tobias", "Keiler"],
  "0012": ["Benjamin", "Faigle"],
  "0013": ["Christian", "Maier"],
  "0014": ["Stefan", "Sautter"],
  "0015": ["Holger", "Gogoll"],
  "0016": ["Jürgen", "Fröhlich"],
  "0017": ["Erwin", "Rempfer"],
  "0018": ["Manfred", "Sautter"],
  "0019": ["Erwin", "Seiffert"],
  "0020": ["Klaus", "Bitzer"],
  "0021": ["Stefan", "Ott"],
  "0022": ["Wolfgang", "Mink"],
  "0023": ["Helmut", "Löffler"],
  "0024": ["Jürgen", "Stocker"],
  "0025": ["Michael", "Haigis"],
  "0026": ["Robert", "Bitzer"],
  "0027": ["Jürgen", "Müller"],
  "0028": ["Steffen", "Armbruster"],
  "0029": ["Klaus-Dieter", "Pischang"],
  "0030": ["Stefan", "Haigis"],
  "0031": ["Achim", "Maier"],
  "0032": ["Klaus", "Stoll"],
  "0033": ["Sascha", "Strobel"],
  "0034": ["Jürgen", "Zimmermann"],
  "0035": ["Harald", "Sautter"],
  "0036": ["Udo", "Enns"],
  "0037": ["Arno", "Bitzer"],
  "0038": ["Andreas", "Knopf"],
  "0039": ["Jochen", "Holweger"],
  "0040": ["Markus", "Holweger"],
  "0041": ["Udo", "Kopf"],
  "0042": ["Werner", "Strobel"],
  "0043": ["Thomas", "Strobel"],
  "0044": ["Frank", "Bitzer"],
  "0045": ["Bernd", "Luippold"],
  "0046": ["Rolf", "Sautter"],
  "0047": ["Helmut", "Strobel"],
  "0048": ["Werner", "Mink"],
  "0049": ["Markus", "Rebholz"],
  "0050": ["Dieter", "Seiffert"],
  "0051": ["Klaus", "Mink"],
  "0052": ["Martin", "Rempfer"],
  // Hexen (0053-0099)
  "0055": ["Gisela", "Maute"],
  "0056": ["Sibylle", "Wager"],
  "0057": ["Elfriede", "Schlereth"],
  "0058": ["Anneliese", "Braun"],
  "0059": ["Elvira", "Netillard"],
  "0061": ["Erika", "Müller"],
  "0062": ["Inge", "Koch"],
  "0063": ["Elke", "Schlegel"],
  "0064": ["Ursula", "Andrzejczak"],
  "0065": ["Christine", "Ferscha"],
  "0066": ["Isolde", "Schwarz"],
  "0067": ["Irene", "Haigis"],
  "0068": ["Ramona", "Knor"],
  "0069": ["Ann-Katrin", "Enns"],
  "0070": ["Verena", "Teufel"],
  "0071": ["Claudia", "Seiffert"],
  "0072": ["Sandra", "Ott"],
  "0073": ["Sonja", "Schauer"],
  "0074": ["Patricia", "Bonni"],
  "0075": ["Karolin", "Wiener-Starowski"],
  "0076": ["Daniela", "Strobel"],
  "0077": ["Sandra", "Zimmermann"],
  "0078": ["Ulrike", "Zimmermann"],
  "0079": ["Anett", "Knopf"],
  "0080": ["Stefanie", "Steiner"],
  "0081": ["Antje", "Teufel"],
  "0082": ["Chiara", "Faigle"],
  "0083": ["Verena", "Teufel"],
  "0084": ["Karola", "Stange"],
  "0085": ["Viktoria", "Habfast"],
  "0086": ["Myriam", "Feder"],
  "0087": ["Vanessa", "Eppler"],
  "0088": ["Tina", "Breitenbauch"],
  "0089": ["Nicole", "Rau"],
  "0090": ["Janine", "Krebs"],
  "0091": ["Katja", "Danhammer"],
  "0092": ["Veronika", "Werner"],
  "0093": ["Mona", "Willkommen"],
  "0094": ["Sarah", "Götz"],
  "0095": ["Christine", "Roth"],
  "0096": ["Verena", "Matthes"],
  "0097": ["Jeanette", "Lörch"],
  "0098": ["Ameli", "Rödler"],
  "0099": ["Sandra", "Hugendubel"],
  // Garde (0100-0149)
  "0100": ["Bernd", "Strobel"],
  "0101": ["Hans", "Uhl"],
  "0102": ["Walter", "Wilks"],
  "0103": ["Rudolf", "Hetzel"],
  "0104": ["Herbert", "Kopf"],
  "0105": ["Rainer", "Lacher"],
  "0106": ["Günther", "Meinhold"],
  "0107": ["Aron", "Zimmermann"],
  "0108": ["Manfred", "Pischang"],
  "0109": ["Bernd", "Wolfer"],
  "0110": ["Alexander", "Uhl"],
  "0111": ["Jan", "Koch"],
  "0112": ["Alfonso", "Gerardi"],
  "0113": ["Marcus", "Pfeffer"],
  "0114": ["Thomas", "Stingel"],
  // Zäpfle Bomber (0150-0199)
  "0150": ["Rainer", "Schrejäck"],
  "0151": ["Andrea", "Hintz"],
  "0152": ["Petra", "Stengel"],
  "0153": ["Jutta", "Riffel"],
  "0154": ["Stefanie", "Wizemann-Strauch"],
  "0155": ["Johanna", "Hugendubel"],
  "0156": ["Dominique", "Hermle"],
  "0157": ["Nadine", "Schmid"],
  "0158": ["Oksana", "Singer"],
  "0159": ["Kathrin", "Haubennestel"],
  "0160": ["Anna", "Winterholer"],
  "0161": ["Nancy", "Uhl"],
  "0162": ["Yvonne", "Kislat"],
  "0163": ["Katarzyna", "Dziuba"],
  "0164": ["Verena", "Luippold"],
  "0165": ["Ilona", "Joos"],
  "0166": ["Sandra", "Hugendubel"],
  "0167": ["Jasmin", "Linder-Garcia"],
  "0168": ["Maria", "Bognar"],
  "0169": ["Denise", "Kindl"],
  "0170": ["Sarah", "Fink"],
  "0171": ["Dominik", "Steiner"],
  "0172": ["Peter", "Rieger"],
  "0173": ["Maurice", "Schreyer"],
  "0174": ["Nancy", "Uhl"],
  "0175": ["Johanna", "Hugendubel"],
  // Passiv mit Häs
  "0053": ["Melanie", "Stehle"],
  "0060": ["Laura", "Arcuri"],
  "0115": ["Steffen", "Lohrmann"],
  "0116": ["Hardy", "Glaser"],
  "0117": ["Heike", "Ulbricht"],
  "0119": ["Daniel", "Coskovic"],
  "0120": ["Timo", "Bisinger"],
  "0121": ["Tobias", "Bisinger"],
  "0122": ["Robert", "Stehle"],
  "0123": ["Jürgen", "Bossert"],
  "0054": ["Erika", "Müller"],
  // Pierre Hugendubel (der erste angelegte Benutzer)
  "208": ["Pierre", "Hugendubel"],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Alle Mitglieder laden
    const mitglieder = await base44.asServiceRole.entities.Mitglied.list('nachname', 1000);
    
    // Index: "vorname nachname" -> id (lowercase für matching)
    const mitgliedIndex = {};
    for (const m of mitglieder) {
      const key = `${m.vorname} ${m.nachname}`.toLowerCase();
      mitgliedIndex[key] = m.id;
    }

    // Alle Häs laden
    const alleHaes = await base44.asServiceRole.entities.Haes.list('haesnummer', 1000);
    
    const haesIndex = {};
    for (const h of alleHaes) {
      haesIndex[h.haesnummer] = h;
    }

    const ergebnisse = [];
    const fehler = [];

    // Für jede Zuordnung
    for (const [haesnummer, [vorname, nachname]] of Object.entries(HAES_BESITZER)) {
      const haes = haesIndex[haesnummer];
      if (!haes) {
        fehler.push(`Häs ${haesnummer} nicht gefunden`);
        continue;
      }
      
      const key = `${vorname} ${nachname}`.toLowerCase();
      const mitgliedId = mitgliedIndex[key];
      
      if (!mitgliedId) {
        fehler.push(`Mitglied "${vorname} ${nachname}" nicht gefunden`);
        continue;
      }

      // Nur updaten wenn noch nicht gesetzt
      if (haes.aktueller_besitzer_id === mitgliedId) {
        ergebnisse.push(`${haesnummer}: bereits gesetzt (${vorname} ${nachname})`);
        continue;
      }

      await base44.asServiceRole.entities.Haes.update(haes.id, {
        aktueller_besitzer_id: mitgliedId
      });
      ergebnisse.push(`✓ ${haesnummer} → ${vorname} ${nachname}`);
    }

    return Response.json({
      gesetzt: ergebnisse.filter(e => e.startsWith('✓')).length,
      bereits_gesetzt: ergebnisse.filter(e => e.includes('bereits')).length,
      fehler: fehler,
      details: ergebnisse
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});