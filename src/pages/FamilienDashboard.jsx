import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Users, Heart, Baby, Calendar, Briefcase, Shirt, Bus,
  Plus, X, Search, ChevronRight, Phone, Mail, Trash2,
  UserPlus, Check, AlertCircle, ArrowRight, Bus as BusIcon,
  Pencil
} from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { de } from 'date-fns/locale';
import { format } from 'date-fns';

const BEZIEHUNGEN = [
  'Ehepartner/in', 'Kind', 'Geschwister', 'Elternteil',
  'Großelternteil', 'Enkel', 'Onkel/Tante', 'Nichte/Neffe', 'Sonstige'
];

export default function FamilienDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [selbst, setSelbst] = useState(null);
  const [ehepartner, setEhepartner] = useState(null);
  const [kinder, setKinder] = useState([]);
  const [verwandte, setVerwandte] = useState([]);
  const [termine, setTermine] = useState([]);
  const [dienste, setDienste] = useState([]);
  const [haes, setHaes] = useState([]);
  const [ausfahrten, setAusfahrten] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addBeziehung, setAddBeziehung] = useState('Kind');
  const [suchbegriff, setSuchbegriff] = useState('');
  const [suchErgebnisse, setSuchErgebnisse] = useState([]);
  const [ausgewaehlt, setAusgewaehlt] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await base44.functions.invoke('getFamilienDashboardSicher', {});
      const data = result.data || result;
      if (data.erfolg === false) {
        setError(data.error || 'Fehler beim Laden');
        setLoading(false);
        return;
      }
      setSelbst(data.selbst);
      setEhepartner(data.ehepartner);
      setKinder(data.kinder || []);
      setVerwandte(data.verwandte || []);
      setTermine(data.termine || []);
      setDienste(data.dienste || []);
      setHaes(data.haes || []);
      setAusfahrten(data.ausfahrten || []);
      setIsAdmin(data.isAdmin || false);
    } catch (e) {
      console.error('FamilienDashboard Ladefehler:', e);
      setError(e.message || 'Fehler beim Laden der Daten');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSuche = async (q) => {
    setSuchbegriff(q);
    if (q.length < 2) { setSuchErgebnisse([]); return; }
    try {
      const res = await base44.functions.invoke('searchMitgliedSicher', { query: q });
      const results = res.data?.results || res.results || [];
      // Bereits verknüpfte IDs ausschließen
      const verknuepfteIds = new Set([
        ...(ehepartner ? [ehepartner.id] : []),
        ...kinder.map(k => k.id),
        ...verwandte.map(v => v.id),
        ...(selbst ? [selbst.id] : []),
      ]);
      setSuchErgebnisse(results.filter(m => !verknuepfteIds.has(m.id)));
    } catch (e) {
      console.error('Suche fehlgeschlagen:', e);
    }
  };

  const handleAdd = async () => {
    if (!ausgewaehlt || !selbst) return;
    setSaving(true);
    try {
      await base44.entities.Verwandtschaft.create({
        mitglied_id: selbst.id,
        verwandter_id: ausgewaehlt.id,
        beziehung: addBeziehung,
      });
      setSuccess(`${ausgewaehlt.vorname} ${ausgewaehlt.nachname} als ${addBeziehung} hinzugefügt`);
      setShowAddModal(false);
      setAusgewaehlt(null);
      setSuchbegriff('');
      setSuchErgebnisse([]);
      await loadData();
    } catch (e) {
      setError('Fehler beim Hinzufügen: ' + e.message);
    }
    setSaving(false);
  };

  const handleRemove = async (verwandterId, beziehungLabel) => {
    if (!window.confirm(`Beziehung "${beziehungLabel}" wirklich entfernen?`)) return;
    // Sicherheits-Check: ohne gültige IDs dürfen wir nicht filtern –
    // sonst ignoriert Base44 das leere Feld und löscht ALLE Verwandten.
    if (!selbst?.id || !verwandterId) {
      setError('Beziehung konnte nicht entfernt werden – fehlende ID.');
      return;
    }
    try {
      // Nur die exakte Beziehung (beide Richtungen) laden und löschen
      const [vDirect, vReverse] = await Promise.all([
        base44.entities.Verwandtschaft.filter({ mitglied_id: selbst.id, verwandter_id: verwandterId }),
        base44.entities.Verwandtschaft.filter({ mitglied_id: verwandterId, verwandter_id: selbst.id }),
      ]);
      const toDelete = [...vDirect, ...vReverse];
      if (toDelete.length === 0) {
        setError('Keine Beziehung zum Entfernen gefunden.');
        return;
      }
      for (const v of toDelete) {
        await base44.entities.Verwandtschaft.delete(v.id);
      }
      setSuccess('Beziehung entfernt');
      await loadData();
    } catch (e) {
      setError('Fehler beim Entfernen: ' + e.message);
    }
  };

  const getAlter = (geb) => geb ? differenceInYears(new Date(), new Date(geb)) : null;

  const formatDate = (d) => d ? format(new Date(d), 'dd.MM.yyyy', { locale: de }) : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium tracking-wide font-oswald uppercase text-neutral-400">Familie wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans pb-20">
      {/* Header */}
      <div className="border-b border-border bg-[#080808] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="text-primary w-8 h-8" />
            <div>
              <h1 className="text-2xl font-oswald uppercase tracking-wide leading-none">Familie</h1>
              <p className="text-xs text-neutral-400 mt-1">
                {selbst ? `${selbst.vorname} ${selbst.nachname}` : 'Lade...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowAddModal(true); setAddBeziehung('Kind'); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Hinzufügen
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {/* Error / Success */}
        {error && (
          <div className="bg-red-950 border border-red-500/30 text-red-200 p-4 rounded-xl flex items-start justify-between">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3"><Check className="w-5 h-5 text-emerald-400" /><p className="text-sm">{success}</p></div>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Ehepartner/in Sektion */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="font-oswald uppercase tracking-wide text-lg">Ehepartner/in</h2>
          </div>
          {ehepartner ? (
            <div className="bg-card border border-border rounded-xl p-5 flex items-start justify-between gap-4">
              <Link to={`/mitglieder/${ehepartner.id}`} className="flex items-start gap-3 flex-1 min-w-0 group">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
                  {ehepartner.profilbild_url
                    ? <img src={ehepartner.profilbild_url} alt="" className="w-full h-full object-cover" />
                    : `${ehepartner.vorname?.[0] || ''}${ehepartner.nachname?.[0] || ''}`}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                    {ehepartner.vorname} {ehepartner.nachname}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {ehepartner.geburtsdatum && <span className="text-xs text-neutral-400">{getAlter(ehepartner.geburtsdatum)} Jahre</span>}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium">
                      {ehepartner.mitgliedsstatus || 'Aktiv'}
                    </span>
                    {ehepartner.haesgruppe_id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                        {ehepartner.haesgruppe_id}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {ehepartner.telefon && (
                      <a href={`tel:${ehepartner.telefon}`} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-primary">
                        <Phone size={11} /> {ehepartner.telefon}
                      </a>
                    )}
                    {ehepartner.email && (
                      <a href={`mailto:${ehepartner.email}`} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-primary">
                        <Mail size={11} /> {ehepartner.email}
                      </a>
                    )}
                  </div>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(ehepartner.id, 'Ehepartner/in')}
                className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setShowAddModal(true); setAddBeziehung('Ehepartner/in'); }}
              className="w-full bg-card border border-dashed border-border rounded-xl p-5 flex items-center justify-center gap-2 text-neutral-400 hover:border-primary/30 hover:text-primary transition-all"
            >
              <UserPlus className="w-5 h-5" /> Ehepartner/in hinzufügen
            </button>
          )}
        </div>

        {/* Kinder Sektion */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Baby className="w-5 h-5 text-primary" />
            <h2 className="font-oswald uppercase tracking-wide text-lg">Kinder ({kinder.length})</h2>
          </div>
          {kinder.length === 0 ? (
            <button
              onClick={() => { setShowAddModal(true); setAddBeziehung('Kind'); }}
              className="w-full bg-card border border-dashed border-border rounded-xl p-5 flex items-center justify-center gap-2 text-neutral-400 hover:border-primary/30 hover:text-primary transition-all"
            >
              <UserPlus className="w-5 h-5" /> Kind hinzufügen
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {kinder.map(kind => {
                const alter = getAlter(kind.geburtsdatum);
                const kindTermine = termine.filter(t => (t.eingeladene_ids || []).includes(kind.id));
                const kindDienste = dienste.filter(d => d.mitglied_id === kind.id);
                const kindHaes = haes.filter(h => h.aktueller_besitzer_id === kind.id);
                const kindAusfahrten = ausfahrten.filter(a => a.mitglied_id === kind.id);
                return (
                  <div key={kind.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Link to={`/mitglieder/${kind.id}`} className="flex items-start gap-3 flex-1 min-w-0 group">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0 overflow-hidden">
                          {kind.profilbild_url
                            ? <img src={kind.profilbild_url} alt="" className="w-full h-full object-cover" />
                            : `${kind.vorname?.[0] || ''}${kind.nachname?.[0] || ''}`}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white group-hover:text-primary transition-colors truncate">
                            {kind.vorname} {kind.nachname}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {alter !== null && <span className="text-xs text-neutral-400">{alter} J.</span>}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {kind.mitgliedsstatus || 'Aktiv'}
                            </span>
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleRemove(kind.id, 'Kind')}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {/* Kurz-Stats */}
                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      <div className="bg-neutral-900/50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-sm font-bold text-primary">{kindTermine.length}</p>
                        <p className="text-[9px] text-neutral-500">Termine</p>
                      </div>
                      <div className="bg-neutral-900/50 rounded-lg px-2 py-1.5 text-center">
                        <p className="text-sm font-bold text-blue-400">{kindDienste.length}</p>
                        <p className="text-[9px] text-neutral-500">Dienste</p>
                      </div>
                      <Link to={`/mitglieder/${kind.id}`} className="bg-neutral-900/50 rounded-lg px-2 py-1.5 text-center hover:bg-neutral-800/70 transition-colors">
                        <p className="text-sm font-bold text-accent">{kindHaes.length}</p>
                        <p className="text-[9px] text-neutral-500">Häs</p>
                      </Link>
                      <Link to="/ausfahrten" className="bg-neutral-900/50 rounded-lg px-2 py-1.5 text-center hover:bg-neutral-800/70 transition-colors">
                        <p className="text-sm font-bold text-teal-400">{kindAusfahrten.length}</p>
                        <p className="text-[9px] text-neutral-500">Bus</p>
                      </Link>
                    </div>
                    {/* Aktions-Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                      <Link
                        to={`/mitglieder/${kind.id}?edit=1`}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Profil bearbeiten
                      </Link>
                      <Link
                        to="/ausfahrten"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" /> An Ausfahrt
                      </Link>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => { setShowAddModal(true); setAddBeziehung('Kind'); }}
                className="bg-card border border-dashed border-border rounded-xl p-4 flex items-center justify-center gap-2 text-neutral-400 hover:border-primary/30 hover:text-primary transition-all"
              >
                <Plus className="w-4 h-4" /> Kind hinzufügen
              </button>
            </div>
          )}
        </div>

        {/* Weitere Verwandte */}
        {verwandte.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-neutral-400" />
              <h2 className="font-oswald uppercase tracking-wide text-lg">Weitere Verwandte ({verwandte.length})</h2>
            </div>
            <div className="space-y-2">
              {verwandte.map(v => (
                <div key={v.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                  <Link to={`/mitglieder/${v.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                    <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-bold text-sm shrink-0">
                      {v.vorname?.[0] || ''}{v.nachname?.[0] || ''}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">
                        {v.vorname} {v.nachname}
                      </p>
                      <span className="text-xs text-neutral-400">{v.beziehung}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(v.id, v.beziehung)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gemeinsame Termine */}
        {termine.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-oswald uppercase tracking-wide text-base mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-primary" /> Kommende Termine
            </h2>
            <div className="space-y-2">
              {termine.slice(0, 8).map(t => {
                const fuerKind = kinder.find(k => (t.eingeladene_ids || []).includes(k.id));
                const fuerEhepartner = ehepartner && (t.eingeladene_ids || []).includes(ehepartner.id);
                return (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/30 hover:bg-neutral-900/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.titel}</p>
                      <p className="text-xs text-neutral-400">{formatDate(t.datum)}</p>
                    </div>
                    {(fuerKind || fuerEhepartner) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary ml-2 shrink-0">
                        {fuerKind ? fuerKind.vorname : ehepartner?.vorname}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gemeinsame Dienste */}
        {dienste.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-oswald uppercase tracking-wide text-base mb-3 flex items-center gap-2">
              <Briefcase size={16} className="text-primary" /> Arbeitsdienste der Familie
            </h2>
            <div className="space-y-2">
              {dienste.slice(0, 8).map((d, idx) => {
                const dienstData = d.dienst || d;
                const mid = d.mitglied_id;
                const mitglied = mid === selbst?.id ? selbst :
                  kinder.find(k => k.id === mid) || (mid ? verwandte.find(v => v.id === mid) : null) || ehepartner;
                return (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{dienstData.titel}</p>
                      <p className="text-xs text-neutral-400">{formatDate(dienstData.datum)}</p>
                    </div>
                    {mitglied && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 ml-2 shrink-0">
                        {mitglied.vorname}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-oswald uppercase tracking-wide text-lg">Verwandte/r hinzufügen</h2>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Beziehung wählen */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Beziehung</label>
              <div className="flex flex-wrap gap-1.5">
                {BEZIEHUNGEN.map(b => (
                  <button
                    key={b}
                    onClick={() => setAddBeziehung(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      addBeziehung === b ? 'bg-primary text-white' : 'bg-neutral-900 border border-border text-neutral-400 hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Suche */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Mitglied suchen</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Name eingeben..."
                  value={suchbegriff}
                  onChange={e => handleSuche(e.target.value)}
                  className="w-full bg-neutral-900 border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>
            </div>

            {/* Suchergebnisse */}
            {suchErgebnisse.length > 0 && !ausgewaehlt && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
                {suchErgebnisse.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setAusgewaehlt(m)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-neutral-900/50 hover:bg-neutral-800 border border-border/50 hover:border-primary/30 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-bold text-sm shrink-0">
                      {m.vorname?.[0] || ''}{m.nachname?.[0] || ''}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.vorname} {m.nachname}</p>
                      <p className="text-xs text-neutral-400">{m.mitgliedsstatus || ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-500 ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {/* Ausgewählt */}
            {ausgewaehlt && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                  {ausgewaehlt.vorname?.[0] || ''}{ausgewaehlt.nachname?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{ausgewaehlt.vorname} {ausgewaehlt.nachname}</p>
                  <p className="text-xs text-neutral-400">als {addBeziehung}</p>
                </div>
                <button onClick={() => setAusgewaehlt(null)} className="text-neutral-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Save */}
            <button
              onClick={handleAdd}
              disabled={!ausgewaehlt || saving}
              className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wird hinzugefügt...</>
              ) : (
                <><Plus className="w-4 h-4" /> Hinzufügen</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}