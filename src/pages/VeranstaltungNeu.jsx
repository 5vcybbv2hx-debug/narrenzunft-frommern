import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';
import {
  ArrowLeft, Save, Plus, X, ChevronDown, ChevronUp,
  Bookmark, Briefcase, Trash2
} from 'lucide-react';
import AdresseAutocomplete from '@/components/AdresseAutocomplete';

const TYPEN = ['Intern', 'Fest', 'Arbeitsdienst', 'Umzug', 'Abendveranstaltung'];
const STATUS_LIST = ['Geplant', 'Aktiv', 'Abgeschlossen', 'Abgesagt'];

const EMPTY_FORM = {
  titel: '', typ: 'Intern', datum: '', uhrzeit: '', ort: '',
  beschreibung: '', anmeldeschluss: '', bus_erforderlich: false,
  anmeldung_aktiv: true, status: 'Geplant',
};

export default function VeranstaltungNeu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [arbeitsdienste, setArbeitsdienste] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showVorlagen, setShowVorlagen] = useState(false);
  const [showSaveVorlage, setShowSaveVorlage] = useState(false);
  const [vorlagenName, setVorlagenName] = useState('');
  const [savingVorlage, setSavingVorlage] = useState(false);
  const [showArbeitsdienste, setShowArbeitsdienste] = useState(false);

  useEffect(() => {
    base44.entities.Veranstaltungsvorlage.list('name', 100).then(setVorlagen).catch(() => {});
  }, []);

  const applyVorlage = (vorlage) => {
    setForm(prev => ({
      ...prev,
      titel: vorlage.name,
      typ: vorlage.typ || prev.typ,
      ort: vorlage.ort || prev.ort,
      uhrzeit: vorlage.uhrzeit || prev.uhrzeit,
      beschreibung: vorlage.beschreibung || prev.beschreibung,
      bus_erforderlich: vorlage.bus_erforderlich ?? prev.bus_erforderlich,
      anmeldung_aktiv: vorlage.anmeldung_aktiv ?? prev.anmeldung_aktiv,
      hinweise: vorlage.hinweise || prev.hinweise,
      busparkplatz_adresse: vorlage.busparkplatz_adresse || prev.busparkplatz_adresse,
      busparkplatz_treffzeit: vorlage.busparkplatz_treffzeit || prev.busparkplatz_treffzeit,
    }));
    // Arbeitsdienst-Vorlagen übernehmen
    if (vorlage.arbeitsdienst_vorlagen?.length) {
      setArbeitsdienste(vorlage.arbeitsdienst_vorlagen.map(a => ({ ...a })));
      setShowArbeitsdienste(true);
    }
    setShowVorlagen(false);
  };

  const handleSaveVorlage = async () => {
    if (!vorlagenName.trim()) return;
    setSavingVorlage(true);
    try {
      await base44.entities.Veranstaltungsvorlage.create({
        name: vorlagenName.trim(),
        typ: form.typ,
        ort: form.ort,
        uhrzeit: form.uhrzeit,
        beschreibung: form.beschreibung,
        bus_erforderlich: form.bus_erforderlich,
        anmeldung_aktiv: form.anmeldung_aktiv,
        hinweise: form.hinweise,
        busparkplatz_adresse: form.busparkplatz_adresse,
        busparkplatz_treffzeit: form.busparkplatz_treffzeit,
        arbeitsdienst_vorlagen: arbeitsdienste.length ? arbeitsdienste : undefined,
      });
      const updated = await base44.entities.Veranstaltungsvorlage.list('name', 100);
      setVorlagen(updated);
      setShowSaveVorlage(false);
      setVorlagenName('');
    } catch (e) {}
    setSavingVorlage(false);
  };

  const handleDeleteVorlage = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Veranstaltungsvorlage.delete(id);
    setVorlagen(prev => prev.filter(v => v.id !== id));
  };

  const addArbeitsdienst = () => {
    setArbeitsdienste(prev => [...prev, { titel: '', beschreibung: '', benoetigte_personen: '' }]);
  };

  const removeArbeitsdienst = (idx) => {
    setArbeitsdienste(prev => prev.filter((_, i) => i !== idx));
  };

  const updateArbeitsdienst = (idx, field, value) => {
    setArbeitsdienste(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (!form.titel || !form.datum) return;
    setSaving(true);
    try {
      const veranstaltung = await base44.entities.Veranstaltung.create(form);
      // Arbeitsdienste anlegen
      if (arbeitsdienste.length > 0) {
        await Promise.all(
          arbeitsdienste
            .filter(a => a.titel.trim())
            .map(a => base44.entities.Arbeitsdienst.create({
              titel: a.titel,
              beschreibung: a.beschreibung,
              benoetigte_personen: a.benoetigte_personen ? Number(a.benoetigte_personen) : undefined,
              datum: form.datum,
              ort: form.ort,
              status: 'Offen',
              veranstaltung_id: veranstaltung.id,
            }))
        );
      }
      navigate(`/veranstaltungen/${veranstaltung.id}`);
    } catch (e) {}
    setSaving(false);
  };

  return (
    <div className="px-4 lg:px-6 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground flex-1">Neue Veranstaltung</h1>
        {/* Als Vorlage speichern */}
        {admin && (
          <button
            onClick={() => setShowSaveVorlage(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors"
          >
            <Bookmark size={14} /> Vorlage speichern
          </button>
        )}
      </div>

      {/* Vorlage auswählen */}
      {vorlagen.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowVorlagen(!showVorlagen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-medium hover:bg-primary/15 transition-colors"
          >
            <span className="flex items-center gap-2"><Bookmark size={15} /> Vorlage verwenden</span>
            {showVorlagen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showVorlagen && (
            <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
              {vorlagen.map(v => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0 cursor-pointer"
                  onClick={() => applyVorlage(v)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.typ}{v.ort ? ` · ${v.ort}` : ''}{v.arbeitsdienst_vorlagen?.length ? ` · ${v.arbeitsdienst_vorlagen.length} Arbeitsdienst(e)` : ''}</p>
                  </div>
                  {admin && (
                    <button
                      onClick={(e) => handleDeleteVorlage(v.id, e)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hauptformular */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4 mb-4">
        <input
          type="text"
          placeholder="Titel *"
          value={form.titel}
          onChange={e => setForm(p => ({ ...p, titel: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
        />

        {/* Typ */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-2">Typ</label>
          <div className="flex gap-2 flex-wrap">
            {TYPEN.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(p => ({ ...p, typ: t }))}
                className={`flex-1 min-w-[100px] py-2 rounded-lg text-sm font-medium transition-all border ${
                  form.typ === t
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs text-muted-foreground font-medium block mb-2">Status</label>
          <div className="flex gap-2 flex-wrap">
            {STATUS_LIST.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 min-w-[90px] py-2 rounded-lg text-sm font-medium transition-all border ${
                  form.status === s
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-secondary text-muted-foreground border-border hover:border-primary/40'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Datum *</label>
            <input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Uhrzeit</label>
            <input type="time" value={form.uhrzeit} onChange={e => setForm(p => ({ ...p, uhrzeit: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Ort</label>
          <AdresseAutocomplete value={form.ort} onChange={val => setForm(p => ({ ...p, ort: val }))} placeholder="Ort suchen..." />
        </div>

        <textarea
          placeholder="Beschreibung (optional)"
          value={form.beschreibung}
          onChange={e => setForm(p => ({ ...p, beschreibung: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none"
        />

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Anmeldeschluss</label>
          <input type="date" value={form.anmeldeschluss || ''} onChange={e => setForm(p => ({ ...p, anmeldeschluss: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.bus_erforderlich} onChange={e => setForm(p => ({ ...p, bus_erforderlich: e.target.checked }))} className="rounded" />
            Bus erforderlich
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
            <input type="checkbox" checked={form.anmeldung_aktiv} onChange={e => setForm(p => ({ ...p, anmeldung_aktiv: e.target.checked }))} className="rounded" />
            Anmeldung aktiv
          </label>
        </div>
      </div>

      {/* Arbeitsdienste */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <button
          onClick={() => setShowArbeitsdienste(!showArbeitsdienste)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-primary" />
            <span className="font-semibold text-foreground text-sm">Arbeitsdienste anlegen</span>
            {arbeitsdienste.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{arbeitsdienste.length}</span>
            )}
          </div>
          {showArbeitsdienste ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </button>

        {showArbeitsdienste && (
          <div className="mt-4 space-y-3">
            {arbeitsdienste.map((a, idx) => (
              <div key={idx} className="bg-secondary/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Titel *"
                    value={a.titel}
                    onChange={e => updateArbeitsdienst(idx, 'titel', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <button onClick={() => removeArbeitsdienst(idx)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Beschreibung (optional)"
                  value={a.beschreibung}
                  onChange={e => updateArbeitsdienst(idx, 'beschreibung', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <input
                  type="number"
                  placeholder="Benötigte Personen"
                  min="0"
                  value={a.benoetigte_personen}
                  onChange={e => updateArbeitsdienst(idx, 'benoetigte_personen', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            <button
              onClick={addArbeitsdienst}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <Plus size={15} /> Arbeitsdienst hinzufügen
            </button>
            {arbeitsdienste.length > 0 && (
              <p className="text-xs text-muted-foreground">Werden mit dem Datum und Ort der Veranstaltung automatisch angelegt.</p>
            )}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button onClick={() => navigate(-1)} className="flex-1 py-2.5 rounded-xl bg-secondary text-muted-foreground text-sm font-medium">
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.titel || !form.datum}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={14} /> {saving ? 'Erstellen...' : 'Veranstaltung erstellen'}
        </button>
      </div>

      {/* Modal: Als Vorlage speichern */}
      {showSaveVorlage && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-foreground mb-1">Als Vorlage speichern</h3>
            <p className="text-xs text-muted-foreground mb-4">Typ, Ort, Zeiten und Arbeitsdienste werden gespeichert.</p>
            <input
              type="text"
              placeholder="Vorlagenname (z.B. Jahreshauptversammlung)"
              value={vorlagenName}
              onChange={e => setVorlagenName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowSaveVorlage(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button
                onClick={handleSaveVorlage}
                disabled={savingVorlage || !vorlagenName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {savingVorlage ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}