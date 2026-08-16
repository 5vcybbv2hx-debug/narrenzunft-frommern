export default async function createTestAusfahrt(req, res) {
  const base44 = req.base44;
  
  try {
    const existing = await base44.asServiceRole.entities.Ausfahrt.filter({
      titel: 'TEST: Fasnetsumzug Frommern'
    });
    
    if (existing && existing.length > 0) {
      return res.json({ success: true, message: 'Test-Ausfahrt existiert bereits', ausfahrt_id: existing[0].id });
    }
    
    const ausfahrt = await base44.asServiceRole.entities.Ausfahrt.create({
      titel: 'TEST: Fasnetsumzug Frommern',
      typ: 'Umzug',
      datum: '2026-09-15',
      ort: 'Frommern',
      abfahrt_ort: 'Schulhof Frommern',
      abfahrt_zeit: '13:00',
      veranstaltungsbeginn: '14:30',
      rueckfahrt_zeit: '18:00',
      bus_kapazitaet: 50,
      anmeldung_start: '2026-08-01',
      anmeldung_ende: '2026-09-12',
      status: 'Anmeldung offen',
      aufstellung: 'Schulhof',
      notizen: 'TEST-Ausfahrt fuer Rollen- und Anmeldesystem-Test.'
    });
    
    res.json({ success: true, message: 'Test-Ausfahrt erstellt', ausfahrt_id: ausfahrt.id });
  } catch (err) {
    console.error('Error creating test ausfahrt:', err);
    res.status(500).json({ success: false, error: err.message || 'Unbekannter Fehler' });
  }
}
