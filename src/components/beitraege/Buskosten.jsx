import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bus, Plus, ChevronDown, ChevronUp, X, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const STATUS_COLORS = {
  'Offen': 'bg-yellow-500/20 text-yellow-400',
  'Bezahlt': 'bg-green-500/20 text-green-400',
  'Erlassen': 'bg-gray-500/20 text-gray-400',
};

export default function Buskosten({ isAdmin }) {
  const [veranstaltungen, setVeranstaltungen] = useState([]);
  const [buskostenbeitraege, setBuskostenbeitraege] = useState([]);
  const [teilnahmen, setTeilnahmen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [showAddModal, setShowAddModal] = useState(null); // veranstaltung_id
  const [addForm, setAddForm] = useState({ betrag: 10, mitglied_ids: [], alle_busfahrer: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, b, t, m] = await Promise.all([
        base44.entities.Veranstaltung.list('datum', 500),
        base44.entities.Buskostenbeitrag.list('-created_date', 1000),
        base44.entities.Teilnahme.list('-created_date', 2000),
        base44.entities.Mitglied.list('nachname', 500),
      ]);
      // Nur Veranstaltungen mit Bus
      setVeranstaltungen(v.filter(x => x.bus_erforderlich).sort((a, b) => b.datum.localeCompare(a.datum)));
      setBuskostenbeitraege(b);
      setTeilnahmen(t);
      setMitglieder(m);
    } catch (e) {}
    setLoading(false);
  };

  const getBeitrageFuerVeranstaltung = (vid) => buskostenbeitraege.filter(b => b.veranstaltung_id === vid);
  const getBusfahrerFuerVeranstaltung = (vid) => teilnahmen.filter(t => t.veranstaltung_id === vid && t.bus === true);
  const getMitglied = (id) => mitglieder.find(m => m.id === id);

  const handleMarkBezahlt = async (beitrag) => {
    const updated = await base44.entities.Buskostenbeitrag.update(beitrag.id, {
      zahlungsstatus: 'Bezahlt',
      zahlungsdatum: new Date().toISOString().split('T')[0],
    });
    setBuskostenbeitraege(prev => prev.map(b => b.id === beitrag.id ? { ...b, zahlungsstatus: 'Bezahlt', zahlungsdatum: updated.zahlungsdatum } : b));
  };

  const handleErlassen = async (beitrag) => {
    await base44.entities.Buskostenbeitrag.update(beitrag.id, { zahlungsstatus: 'Erlassen' });
    setBuskostenbeitraege(prev => prev.map(b => b.id === beitrag.id ? { ...b, zahlungsstatus: 'Erlassen' } : b));
  };

  const handleDelete = async (beitragId) => {
    await base44.entities.Buskostenbeitrag.delete(beitragId);
    setBuskostenbeitraege(prev => prev.filter(b => b.id !== beitragId));
  };

  const handleErstelleBeitraege = async (veranstaltungId) => {
    setSaving(true);
    try {
      const busfahrer = getBusfahrerFuerVeranstaltung(veranstaltungId);
      const bereitsErstellt = getBeitrageFuerVeranstaltung(veranstaltungId).map(b => b.mitglied_id);

      let mitgliedIds;
      if (addForm.alle_busfahrer) {
        mitgliedIds = busfahrer.map(t => t.mitglied_id).filter(id => !bereitsErstellt.includes(id));
      } else {
        mitgliedIds = addForm.mitglied_ids.filter(id => !bereitsErstellt.includes(id));
      }

      if (mitgliedIds.length === 0) {
        setShowAddModal(null);
        setSaving(false);
        return;
      }

      const neue = mitgliedIds.map(mid => ({
        veranstaltung_id: veranstaltungId,
        mitglied_id: mid,
        betrag: addForm.betrag,
        zahlungsstatus: 'Offen',
      }));

      const created = await base44.entities.Buskostenbeitrag.bulkCreate(neue);
      setBuskostenbeitraege(prev => [...prev, ...created]);
      setShowAddModal(null);
    } catch (e) {}
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Gesamtstatistik
  const totalOffen = buskostenbeitraege.filter(b => b.zahlungsstatus === 'Offen').reduce((s, b) => s + (b.betrag || 0), 0);
  const totalBezahlt = buskostenbeitraege.filter(b => b.zahlungsstatus === 'Bezahlt').reduce((s, b) => s + (b.betrag || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-green-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Bezahlt</p>
          <p className="text-xl font-bold text-green-400 mt-1">{totalBezahlt.toFixed(0)} €</p>
        </div>
        <div className="bg-card border border-yellow-500/20 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Offen</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">{totalOffen.toFixed(0)} €</p>
        </div>
      </div>

      {/* Veranstaltungen */}
      {veranstaltungen.length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Bus size={36} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Keine Busveranstaltungen vorhanden</p>
        </div>
      )}

      <div className="space-y-2">
        {veranstaltungen.map(v => {
          const beitraege = getBeitrageFuerVeranstaltung(v.id);
          const busfahrer = getBusfahrerFuerVeranstaltung(v.id);
          const isOpen = expanded === v.id;
          const offen = beitraege.filter(b => b.zahlungsstatus === 'Offen').length;
          const bezahlt = beitraege.filter(b => b.zahlungsstatus === 'Bezahlt').length;

          return (
            <div key={v.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : v.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] text-muted-foreground">{format(new Date(v.datum), 'MMM', { locale: de })}</span>
                  <span className="text-sm font-bold text-primary">{format(new Date(v.datum), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{v.titel}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Bus size={10} /> {busfahrer.length} Busfahrer</span>
                    {beitraege.length > 0 && (
                      <>
                        <span className="text-green-400">{bezahlt} bezahlt</span>
                        {offen > 0 && <span className="text-yellow-400">{offen} offen</span>}
                      </>
                    )}
                  </div>
                </div>
                {isOpen ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-3 bg-secondary/10">
                  {/* Beiträge erstellen */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setAddForm({ betrag: 10, mitglied_ids: [], alle_busfahrer: true });
                        setShowAddModal(v.id);
                      }}
                      className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      <Plus size={13} /> Buskosten-Beiträge erstellen
                    </button>
                  )}

                  {/* Beiträge Liste */}
                  {beitraege.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Noch keine Beiträge erfasst</p>
                  ) : (
                    <div className="space-y-1.5">
                      {beitraege.map(b => {
                        const m = getMitglied(b.mitglied_id);
                        return (
                          <div key={b.id} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{m ? `${m.vorname} ${m.nachname}` : '–'}</p>
                            </div>
                            <span className="text-sm font-semibold text-foreground shrink-0">{b.betrag} €</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[b.zahlungsstatus]}`}>{b.zahlungsstatus}</span>
                            {isAdmin && b.zahlungsstatus === 'Offen' && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => handleMarkBezahlt(b)} className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20">✓</button>
                                <button onClick={() => handleErlassen(b)} className="text-xs px-2 py-1 rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20">–</button>
                              </div>
                            )}
                            {isAdmin && (
                              <button onClick={() => handleDelete(b.id)} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors shrink-0">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Beiträge erstellen */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Buskosten-Beiträge erstellen</h3>
              <button onClick={() => setShowAddModal(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-1">Pauschalbetrag pro Person</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={addForm.betrag}
                    onChange={e => setAddForm(p => ({ ...p, betrag: parseFloat(e.target.value) || 0 }))}
                    className="w-28 px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="text-sm text-muted-foreground">€</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium block mb-2">Für wen?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddForm(p => ({ ...p, alle_busfahrer: true }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${addForm.alle_busfahrer ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border'}`}
                  >
                    Alle Busfahrer ({getBusfahrerFuerVeranstaltung(showAddModal).length})
                  </button>
                  <button
                    onClick={() => setAddForm(p => ({ ...p, alle_busfahrer: false }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${!addForm.alle_busfahrer ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary text-muted-foreground border-border'}`}
                  >
                    Manuell auswählen
                  </button>
                </div>
              </div>

              {!addForm.alle_busfahrer && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2 bg-secondary/30">
                  {getBusfahrerFuerVeranstaltung(showAddModal).map(t => {
                    const m = getMitglied(t.mitglied_id);
                    if (!m) return null;
                    const selected = addForm.mitglied_ids.includes(m.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setAddForm(p => ({
                          ...p,
                          mitglied_ids: selected ? p.mitglied_ids.filter(id => id !== m.id) : [...p.mitglied_ids, m.id]
                        }))}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${selected ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-foreground'}`}
                      >
                        {selected && <Check size={12} />}
                        {m.vorname} {m.nachname}
                      </button>
                    );
                  })}
                  {getBusfahrerFuerVeranstaltung(showAddModal).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Keine Busanmeldungen</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddModal(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm font-medium">Abbrechen</button>
              <button
                onClick={() => handleErstelleBeitraege(showAddModal)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Erstelle...' : 'Beiträge erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}