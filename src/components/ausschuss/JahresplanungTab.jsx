import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { jahresplanGenerieren } from '@/lib/ausschussAktionen';
import { Plus, X, Trash2, Repeat, Sparkles, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import DateSelect from '@/components/ui/DateSelect';
import MitgliedLiveSuche from '@/components/MitgliedLiveSuche';
import MobileSelect from '@/components/MobileSelect';
import { format } from 'date-fns';

const PRIO = ['Niedrig', 'Mittel', 'Hoch', 'Dringend'];
const WIEDERHOLUNG = ['Jährlich', 'Einmalig'];
const MONATE = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}`, value: i + 1 }));

export default function JahresplanungTab({ plaene, mitglieder, canManage, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [generiereJahr, setGeneriereJahr] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(leerForm());
  function leerForm() {
    return { titel: '', beschreibung: '', monat: 1, tag: 1, verantwortlicher_id: '', prioritaet: 'Mittel', aktiv: true, wiederholung: 'Jährlich', jahr: '', kategorie: '' };
  }
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const openNew = () => { setEdit(null); setForm(leerForm()); setShowForm(true); };
  const openEdit = (p) => { setEdit(p); setForm({ titel: p.titel, beschreibung: p.beschreibung || '', monat: p.monat || 1, tag: p.tag || 1, verantwortlicher_id: p.verantwortlicher_id || '', prioritaet: p.prioritaet || 'Mittel', aktiv: p.aktiv !== false, wiederholung: p.wiederholung || 'Jährlich', jahr: p.jahr || '', kategorie: p.kategorie || '' }); setShowForm(true); };

  const handleSave = async () => {
    if (!form.titel) return;
    setSaving(true);
    try {
      const payload = { ...form, monat: Number(form.monat) || 1, tag: Number(form.tag) || 1, jahr: form.jahr ? Number(form.jahr) : null };
      if (edit) await base44.entities.AusschussJahresplan.update(edit.id, payload);
      else await base44.entities.AusschussJahresplan.create(payload);
      toast.success(edit ? 'Plan aktualisiert' : 'Plan angelegt');
      setShowForm(false);
      onSaved();
    } catch (e) {
      toast.error('Speichern fehlgeschlagen: ' + e.message);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('Diesen Jahresplan-Punkt wirklich löschen?'))) return;
    try { await base44.entities.AusschussJahresplan.delete(id); toast.success('Gelöscht'); onSaved(); }
    catch (e) { toast.error('Löschen fehlgeschlagen'); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await jahresplanGenerieren(Number(generiereJahr));
      toast.success(`${res.erzeugt} Aufgabe(n) für ${res.jahr} erzeugt`);
      onSaved();
    } catch (e) { toast.error(e.message); }
    setGenerating(false);
  };

  const getMitgliedName = (id) => { const m = (mitglieder || []).find(x => x.id === id); return m ? `${m.vorname} ${m.nachname}` : '–'; };

  const aktiv = (plaene || []).filter(p => p.aktiv !== false);
  const inaktiv = (plaene || []).filter(p => p.aktiv === false);

  const Row = ({ p }) => (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Repeat size={13} className="text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground truncate">{p.titel}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{p.wiederholung || 'Jährlich'}</span>
            {!p.aktiv && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500">Inaktiv</span>}
          </div>
          {p.beschreibung && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.beschreibung}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Calendar size={11} /> {String(p.monat || 1).padStart(2, '0')}.{String(p.tag || 1).padStart(2, '0')}{p.wiederholung === 'Einmalig' && p.jahr ? `.${p.jahr}` : ''}</span>
            {p.verantwortlicher_id && <span>{getMitgliedName(p.verantwortlicher_id)}</span>}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{p.prioritaet || 'Mittel'}</span>
            {p.zuletzt_generiert_jahr && <span className="text-green-400">generiert {p.zuletzt_generiert_jahr}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">Bearb.</button>
            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Generator */}
      {canManage && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide font-oswald mb-3 flex items-center gap-2">
            <Sparkles size={15} className="text-primary" /> Aufgaben aus Jahresplan erzeugen
          </h3>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Zieljahr</label>
              <input type="number" value={generiereJahr} onChange={e => setGeneriereJahr(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <button onClick={handleGenerate} disabled={generating}
              className="px-4 py-2.5 min-h-[44px] rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {generating ? '…' : 'Erzeugen'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Erzeugt für jeden aktiven Plan eine Aufgabe mit passender Fälligkeit. Duplikatsicher: pro Jahr nur einmal.</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Wiederkehrende Punkte ({plaene?.length || 0})</h3>
        {canManage && (
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Neu
          </button>
        )}
      </div>

      {aktiv.length > 0 && <div className="space-y-2">{aktiv.map(p => <Row key={p.id} p={p} />)}</div>}
      {inaktiv.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Inaktiv</p>
          <div className="space-y-2 opacity-60">{inaktiv.map(p => <Row key={p.id} p={p} />)}</div>
        </div>
      )}
      {(plaene || []).length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-xl">
          <Repeat size={32} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-foreground">Noch keine Jahresplan-Punkte</p>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold font-oswald uppercase tracking-wide text-foreground">{edit ? 'Plan bearbeiten' : 'Neuer Jahresplan-Punkt'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Titel *" value={form.titel} onChange={e => set('titel', e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              <textarea placeholder="Beschreibung (optional)" value={form.beschreibung} onChange={e => set('beschreibung', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary resize-none" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Monat</label>
                  <MobileSelect value={form.monat} onChange={v => set('monat', v)} options={MONATE} className="w-full" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Tag</label>
                  <input type="number" min="1" max="31" value={form.tag} onChange={e => set('tag', e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Priorität</label>
                  <MobileSelect value={form.prioritaet} onChange={v => set('prioritaet', v)} options={PRIO} className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Verantwortlich</label>
                <MitgliedLiveSuche mitglieder={mitglieder}
                  value={(() => { const m = (mitglieder || []).find(x => x.id === form.verantwortlicher_id); return m ? `${m.vorname} ${m.nachname}` : ''; })()}
                  onSelect={(m) => set('verantwortlicher_id', m.id)} onClear={() => set('verantwortlicher_id', '')}
                  placeholder="Verantwortlichen suchen…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Wiederholung</label>
                  <MobileSelect value={form.wiederholung} onChange={v => set('wiederholung', v)} options={WIEDERHOLUNG} className="w-full" />
                </div>
                {form.wiederholung === 'Einmalig' && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Zieljahr</label>
                    <input type="number" value={form.jahr} onChange={e => set('jahr', e.target.value)}
                      className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
                  </div>
                )}
              </div>
              <input type="text" placeholder="Kategorie (optional)" value={form.kategorie} onChange={e => set('kategorie', e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary" />
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input type="checkbox" checked={form.aktiv} onChange={e => set('aktiv', e.target.checked)} className="rounded" /> Aktiv
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-lg bg-secondary text-muted-foreground text-sm hover:text-foreground transition-colors">Abbrechen</button>
              <button onClick={handleSave} disabled={saving || !form.titel}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">{saving ? '…' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}