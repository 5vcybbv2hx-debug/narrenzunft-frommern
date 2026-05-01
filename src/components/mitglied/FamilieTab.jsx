import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Plus, X, ChevronRight, Phone, Mail, Trash2, Search } from 'lucide-react';
import { differenceInYears } from 'date-fns';

const BEZIEHUNGEN = [
  'Elternteil', 'Kind', 'Geschwister', 'Großelternteil',
  'Enkel', 'Onkel/Tante', 'Nichte/Neffe', 'Ehepartner/in', 'Sonstige'
];

// Gruppierung für die Anzeige
const GRUPPEN = [
  { label: '👴 Großeltern', typen: ['Großelternteil'] },
  { label: '👨‍👩‍ Eltern / Partner', typen: ['Elternteil', 'Ehepartner/in'] },
  { label: '👫 Geschwister', typen: ['Geschwister'] },
  { label: '👶 Kinder', typen: ['Kind'] },
  { label: '🧒 Enkel', typen: ['Enkel'] },
  { label: '👨‍👧 Onkel / Tante', typen: ['Onkel/Tante'] },
  { label: '👦 Nichten / Neffen', typen: ['Nichte/Neffe'] },
  { label: '📎 Sonstige', typen: ['Sonstige'] },
];

const BEZIEHUNG_FARBEN = {
  'Elternteil': 'bg-blue-500/20 text-blue-400',
  'Kind': 'bg-green-500/20 text-green-400',
  'Geschwister': 'bg-purple-500/20 text-purple-400',
  'Großelternteil': 'bg-orange-500/20 text-orange-400',
  'Enkel': 'bg-teal-500/20 text-teal-400',
  'Onkel/Tante': 'bg-yellow-500/20 text-yellow-400',
  'Nichte/Neffe': 'bg-pink-500/20 text-pink-400',
  'Ehepartner/in': 'bg-red-500/20 text-red-400',
  'Sonstige': 'bg-gray-500/20 text-gray-400',
};

export default function FamilieTab({ mitglied, isAdmin }) {
  const [verwandtschaften, setVerwandtschaften] = useState([]);
  const [alleMitglieder, setAlleMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ verwandter_id: '', beziehung: 'Elternteil', notizen: '' });
  const [suchbegriff, setSuchbegriff] = useState('');
  const [ausgewaehlt, setAusgewaehlt] = useState(null); // { id, vorname, nachname }

  useEffect(() => {
    loadData();
  }, [mitglied.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, m] = await Promise.all([
        // Beziehungen in beide Richtungen laden
        base44.entities.Verwandtschaft.filter({ mitglied_id: mitglied.id }),
        base44.entities.Mitglied.list('nachname', 1000),
      ]);
      // Auch umgekehrte Beziehungen laden (wo dieses Mitglied der Verwandte ist)
      const vUmgekehrt = await base44.entities.Verwandtschaft.filter({ verwandter_id: mitglied.id });
      setVerwandtschaften([...v, ...vUmgekehrt]);
      setAlleMitglieder(m);
    } catch (e) {}
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.verwandter_id || !form.beziehung) return;
    setSaving(true);
    try {
      await base44.entities.Verwandtschaft.create({
        mitglied_id: mitglied.id,
        verwandter_id: form.verwandter_id,
        beziehung: form.beziehung,
        notizen: form.notizen || undefined,
      });
      setForm({ verwandter_id: '', beziehung: 'Elternteil', notizen: '' });
      setShowForm(false);
      await loadData();
    } catch (e) {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Beziehung wirklich entfernen?')) return;
    try {
      await base44.entities.Verwandtschaft.delete(id);
      setVerwandtschaften(prev => prev.filter(v => v.id !== id));
    } catch (e) {}
  };

  const getMitglied = (id) => alleMitglieder.find(m => m.id === id);
  const getAlter = (geb) => geb ? differenceInYears(new Date(), new Date(geb)) : null;

  // Beziehung aus Sicht dieses Mitglieds ermitteln
  const getBeziehungLabel = (v) => {
    if (v.mitglied_id === mitglied.id) return v.beziehung;
    // Umgekehrte Richtung – Gegenbezeichnung
    const umkehr = {
      'Elternteil': 'Kind',
      'Kind': 'Elternteil',
      'Geschwister': 'Geschwister',
      'Großelternteil': 'Enkel',
      'Enkel': 'Großelternteil',
      'Onkel/Tante': 'Nichte/Neffe',
      'Nichte/Neffe': 'Onkel/Tante',
      'Ehepartner/in': 'Ehepartner/in',
      'Sonstige': 'Sonstige',
    };
    return umkehr[v.beziehung] || v.beziehung;
  };

  const getVerwandterMitgliedId = (v) =>
    v.mitglied_id === mitglied.id ? v.verwandter_id : v.mitglied_id;

  // Bereits verknüpfte IDs (für Dropdown-Filter)
  const verknuepfteIds = new Set(verwandtschaften.map(v => getVerwandterMitgliedId(v)));
  const verfuegbareMitglieder = alleMitglieder.filter(m => m.id !== mitglied.id && !verknuepfteIds.has(m.id));

  // Nach Gruppen sortieren
  const gruppenMitDaten = GRUPPEN.map(gruppe => ({
    ...gruppe,
    eintraege: verwandtschaften.filter(v => gruppe.typen.includes(getBeziehungLabel(v))),
  })).filter(g => g.eintraege.length > 0);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Verwandtschafts-Gruppen */}
      {gruppenMitDaten.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Users size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Noch keine Verwandtschaften eingetragen.</p>
        </div>
      )}

      {gruppenMitDaten.map(gruppe => (
        <div key={gruppe.label} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-sm font-semibold text-foreground">{gruppe.label}</h3>
          </div>
          <div className="divide-y divide-border">
            {gruppe.eintraege.map(v => {
              const verwandterId = getVerwandterMitgliedId(v);
              const beziehungLabel = getBeziehungLabel(v);
              const m = getMitglied(verwandterId);
              if (!m) return null;
              const alter = getAlter(m.geburtsdatum);
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                    {m.profilbild_url
                      ? <img src={m.profilbild_url} alt="" className="w-full h-full object-cover" />
                      : `${m.vorname?.[0] || ''}${m.nachname?.[0] || ''}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/mitglieder/${m.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {m.vorname} {m.nachname}
                      </Link>
                      {alter !== null && <span className="text-xs text-muted-foreground">{alter} J.</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BEZIEHUNG_FARBEN[beziehungLabel] || 'bg-gray-500/20 text-gray-400'}`}>
                        {beziehungLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {m.telefon && (
                        <a href={`tel:${m.telefon}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <Phone size={11} /> {m.telefon}
                        </a>
                      )}
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <Mail size={11} /> {m.email}
                        </a>
                      )}
                    </div>
                    {v.notizen && <p className="text-xs text-muted-foreground mt-0.5 italic">{v.notizen}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/mitglieder/${m.id}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Beziehung hinzufügen */}
      {isAdmin && (
        <div className="bg-card border border-border rounded-xl p-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus size={16} /> Verwandtschaft hinzufügen
            </button>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Neue Verwandtschaft</h3>

              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Mitglied *</label>
                {ausgewaehlt ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {ausgewaehlt.vorname?.[0]}{ausgewaehlt.nachname?.[0]}
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">{ausgewaehlt.vorname} {ausgewaehlt.nachname}</span>
                    <button onClick={() => { setAusgewaehlt(null); setForm(p => ({ ...p, verwandter_id: '' })); setSuchbegriff(''); }}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Name eingeben..."
                      value={suchbegriff}
                      onChange={e => setSuchbegriff(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    {suchbegriff.length >= 1 && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {verfuegbareMitglieder
                          .filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suchbegriff.toLowerCase()))
                          .slice(0, 10)
                          .map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setAusgewaehlt(m);
                                setForm(p => ({ ...p, verwandter_id: m.id }));
                                setSuchbegriff('');
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors text-left"
                            >
                              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {m.vorname?.[0]}{m.nachname?.[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</p>
                                {m.mitgliedsstatus && <p className="text-xs text-muted-foreground">{m.mitgliedsstatus}</p>}
                              </div>
                            </button>
                          ))}
                        {verfuegbareMitglieder.filter(m => `${m.vorname} ${m.nachname}`.toLowerCase().includes(suchbegriff.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Beziehung (von diesem Mitglied aus) *</label>
                <select
                  value={form.beziehung}
                  onChange={e => setForm(p => ({ ...p, beziehung: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  {BEZIEHUNGEN.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Notiz (optional)</label>
                <input
                  type="text"
                  value={form.notizen}
                  onChange={e => setForm(p => ({ ...p, notizen: e.target.value }))}
                  placeholder="z.B. Stiefvater, Pflegeeltern..."
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setForm({ verwandter_id: '', beziehung: 'Elternteil', notizen: '' }); setAusgewaehlt(null); setSuchbegriff(''); }}
                  className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.verwandter_id}
                  className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Speichern...' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}