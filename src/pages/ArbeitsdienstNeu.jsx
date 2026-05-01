import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save, Search, X, Users } from 'lucide-react';

export default function ArbeitsdienstNeu() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    titel: '',
    datum: '',
    uhrzeit: '',
    ort: '',
    beschreibung: '',
    benoetigte_personen: '',
    status: 'Offen',
  });
  const [saving, setSaving] = useState(false);
  const [alleMitglieder, setAlleMitglieder] = useState([]);
  const [ausgewaehlte, setAusgewaehlte] = useState([]); // { id, vorname, nachname }
  const [suchbegriff, setSuchbegriff] = useState('');

  useEffect(() => {
    base44.entities.Mitglied.list('nachname', 1000).then(setAlleMitglieder).catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      const dienst = await base44.entities.Arbeitsdienst.create({
        ...form,
        benoetigte_personen: form.benoetigte_personen ? Number(form.benoetigte_personen) : ausgewaehlte.length || undefined,
      });

      // Zuweisungen + Benachrichtigungen für alle verknüpften Mitglieder
      await Promise.all(ausgewaehlte.map(async (m) => {
        await base44.entities.ArbeitsdienstZuweisung.create({
          arbeitsdienst_id: dienst.id,
          mitglied_id: m.id,
          status: 'Offen',
        });
        await base44.entities.Benachrichtigung.create({
          mitglied_id: m.id,
          titel: 'Neuer Arbeitsdienst zugewiesen',
          nachricht: `Du wurdest für den Arbeitsdienst „${form.titel}" am ${form.datum}${form.ort ? ` in ${form.ort}` : ''} eingeteilt.`,
          typ: 'Arbeitsdienst',
          gelesen: false,
        });
      }));

      navigate('/arbeitsdienste');
    } catch (e) {}
    setSaving(false);
  };

  const verfuegbar = alleMitglieder.filter(m =>
    !ausgewaehlte.find(a => a.id === m.id) &&
    `${m.vorname} ${m.nachname}`.toLowerCase().includes(suchbegriff.toLowerCase())
  );

  const toggleMitglied = (m) => {
    setAusgewaehlte(prev => {
      if (prev.find(a => a.id === m.id)) return prev.filter(a => a.id !== m.id);
      return [...prev, m];
    });
    setSuchbegriff('');
  };

  const field = (label, fieldName, type = 'text') => (
    <div>
      <label className="text-xs text-muted-foreground font-medium block mb-1">{label}</label>
      <input
        type={type}
        value={form[fieldName] || ''}
        onChange={e => setForm(p => ({ ...p, [fieldName]: e.target.value }))}
        className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Neuer Arbeitsdienst</h1>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4 mb-4">
        {field('Titel *', 'titel')}
        <div className="grid grid-cols-2 gap-3">
          {field('Datum *', 'datum', 'date')}
          {field('Uhrzeit', 'uhrzeit', 'time')}
        </div>
        {field('Ort', 'ort')}

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Status</label>
          <div className="flex gap-2">
            {['Offen', 'In Planung', 'Abgeschlossen'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                  form.status === s
                    ? s === 'Offen' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                    : s === 'In Planung' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                    : 'bg-green-500/20 text-green-400 border-green-500/40'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-1">Beschreibung</label>
          <textarea
            value={form.beschreibung || ''}
            onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>
      </div>

      {/* Mitglieder verknüpfen */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Users size={16} className="text-primary" /> Mitglieder einteilen
          </h2>
          <div>
            <label className="text-xs text-muted-foreground mr-2">Benötigte Personen</label>
            <input
              type="number"
              min="0"
              value={form.benoetigte_personen}
              onChange={e => setForm(p => ({ ...p, benoetigte_personen: e.target.value }))}
              placeholder={ausgewaehlte.length || '–'}
              className="w-16 px-2 py-1 rounded-lg bg-secondary border border-border text-sm text-foreground text-center focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Ausgewählte Mitglieder */}
        {ausgewaehlte.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {ausgewaehlte.map(m => (
              <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30">
                <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center text-primary font-bold text-[10px]">
                  {m.vorname?.[0]}{m.nachname?.[0]}
                </div>
                <span className="text-sm font-medium text-foreground">{m.vorname} {m.nachname}</span>
                <button onClick={() => toggleMitglied(m)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Suche */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Mitglied suchen und hinzufügen..."
            value={suchbegriff}
            onChange={e => setSuchbegriff(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {suchbegriff.length >= 1 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto">
              {verfuegbar.slice(0, 8).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMitglied(m)}
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
              {verfuegbar.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Keine Ergebnisse</p>
              )}
            </div>
          )}
        </div>

        {ausgewaehlte.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {ausgewaehlte.length} Mitglied{ausgewaehlte.length !== 1 ? 'er' : ''} eingeteilt · erhalten automatisch eine Benachrichtigung
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.titel || !form.datum}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={14} /> {saving ? 'Speichern...' : 'Erstellen'}
        </button>
      </div>
    </div>
  );
}