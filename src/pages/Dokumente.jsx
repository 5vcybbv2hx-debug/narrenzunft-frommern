import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { FileText, Download, Eye, EyeOff, Upload, RefreshCw, Trash2, ShieldCheck, BookOpen } from 'lucide-react';
import { confirmDialog } from '@/components/ui/ConfirmProvider';
import ZustimmungsUebersicht from '@/components/dokumente/ZustimmungsUebersicht';
import TextDokumentLeser from '@/components/dokumente/TextDokumentLeser';
import TextDokumentEditor from '@/components/dokumente/TextDokumentEditor';

const KATEGORIEN = ['Satzung', 'Datenschutz', 'Ordnung', 'Antragsformular', 'Protokoll', 'Sonstiges'];
const istVerwaltung = (u) => ['admin', 'vorstand', 'stellv_vorstand'].includes(u?.role);

const fmtDatum = (d) => (d ? new Date(d).toLocaleDateString('de-DE') : '');
const fmtGroesse = (b) => (b ? (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`) : '');

async function oeffne(doc) {
  // Synchron öffnen, damit mobile Popup-Blocker nicht greifen
  const tab = window.open('', '_blank');
  if (!tab) return toast.error('Bitte Pop-ups erlauben, um Dokumente zu öffnen.');
  tab.opener = null;
  try {
    const res = await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'signed_url', dokument_id: doc.id });
    if (!res.data?.signed_url) throw new Error('Keine URL');
    tab.location.replace(res.data.signed_url);
  } catch (e) { tab.close(); console.error('Dokument öffnen:', e); toast.error('Dokument konnte nicht geöffnet werden.'); }
}

export default function Dokumente() {
  const { user } = useAuth();
  const verwaltung = istVerwaltung(user);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState('');
  const [tab, setTab] = useState('dokumente');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ titel: '', kategorie: 'Satzung', sichtbarkeit: 'alle', stand_datum: '', file: null, rohtext: '' });
  const [modus, setModus] = useState('Datei'); // Datei | Text
  const [leseId, setLeseId] = useState(null);
  const [bearbeiteId, setBearbeiteId] = useState(null);

  const laden = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('vereinsDokumentSicher', { aktion: verwaltung ? 'liste_alle' : 'liste_oeffentlich' });
      setDocs(res.data?.dokumente || []);
      setFehler('');
    } catch (e) { console.error('Dokumente laden:', e); setFehler('Dokumente konnten nicht geladen werden.'); }
    finally { setLoading(false); }
  }, [verwaltung]);

  useEffect(() => { laden(); }, [laden]);

  async function hochladen(e) {
    e.preventDefault();
    if (!form.titel.trim()) return;
    setBusy(true);
    try {
      if (modus === 'Text') {
        if (!form.rohtext.trim()) throw new Error('Text fehlt');
        const res = await base44.functions.invoke('vereinsDokumentSicher', {
          aktion: 'text_anlegen', titel: form.titel.trim(), kategorie: form.kategorie,
          sichtbarkeit: form.sichtbarkeit, rohtext: form.rohtext, stand_datum: form.stand_datum || undefined,
        });
        const n = res.data?.absaetze?.length;
        toast.success(n ? `Text-Dokument angelegt: ${n} Absätze erkannt.` : 'Text-Dokument angelegt.');
      } else {
        if (!form.file) return;
        if (form.file.size > 25 * 1024 * 1024) throw new Error('Maximal 25 MB pro Datei.');
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: form.file });
        if (!file_uri) throw new Error('Keine URI');
        await base44.functions.invoke('vereinsDokumentSicher', {
          aktion: 'anlegen', titel: form.titel.trim(), kategorie: form.kategorie, sichtbarkeit: form.sichtbarkeit,
          stand_datum: form.stand_datum || undefined, file_uri, dateiname: form.file.name, datei_groesse: form.file.size,
        });
        toast.success('Dokument gespeichert.');
      }
      setForm({ titel: '', kategorie: 'Satzung', sichtbarkeit: 'alle', stand_datum: '', file: null, rohtext: '' });
      e.target.reset();
      await laden();
    } catch (err) { console.error('Upload:', err); toast.error(err.message || 'Dokument konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  }

  async function sichtbarkeitUmschalten(doc) {
    const neu = doc.sichtbarkeit === 'alle' ? 'ausschuss' : 'alle';
    try { await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'aktualisieren', dokument_id: doc.id, sichtbarkeit: neu }); await laden(); }
    catch (e) { console.error(e); toast.error('Änderung fehlgeschlagen.'); }
  }

  async function neueFassung(doc, file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast.error('Maximal 25 MB pro Datei.');
    const info = ['Satzung', 'Datenschutz'].includes(doc.kategorie)
      ? '\n\nAchtung: Alle Mitglieder müssen danach dem Datenschutz erneut zustimmen.' : '';
    if (!(await confirmDialog(`Neue Fassung von „${doc.titel}“ hochladen? Die alte Fassung wird archiviert.${info}`))) return;
    setBusy(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'ersetzen', dokument_id: doc.id, file_uri, dateiname: file.name, datei_groesse: file.size });
      toast.success('Neue Fassung gespeichert.'); await laden();
    } catch (e) { console.error(e); toast.error('Neue Fassung konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  }

  async function entfernen(doc) {
    if (!(await confirmDialog(`„${doc.titel}“ endgültig entfernen?`))) return;
    try { await base44.functions.invoke('vereinsDokumentSicher', { aktion: 'loeschen', dokument_id: doc.id }); await laden(); toast.success('Entfernt.'); }
    catch (e) { console.error(e); toast.error('Entfernen fehlgeschlagen (nur Vorstand/Admin).'); }
  }

  const aktuelle = docs.filter(d => d.ist_aktuell !== false);
  const archiv = docs.filter(d => d.ist_aktuell === false);

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto">
      <h1 className="font-oswald uppercase tracking-wide text-2xl text-foreground mb-1">Dokumente</h1>
      <p className="text-sm text-muted-foreground mb-4">Satzung, Ordnungen und Formulare der Narrenzunft Frommern e.V.</p>

      {verwaltung && (
        <div className="flex gap-2 mb-4">
          {[['dokumente', 'Dokumente'], ['zustimmung', 'Datenschutz-Zustimmung']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${tab === k ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:border-primary/40'}`}>{l}</button>
          ))}
        </div>
      )}

      {tab === 'zustimmung' && verwaltung ? <ZustimmungsUebersicht /> : (
        <>
          {loading && <p className="text-sm text-muted-foreground">Lädt…</p>}
          {fehler && <p role="alert" className="text-destructive text-sm">{fehler}</p>}
          {!loading && !fehler && aktuelle.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Dokumente hinterlegt.</p>}

          <ul className="space-y-2.5">
            {aktuelle.map(doc => {
              const istText = doc.typ === 'Text';
              return (
                <li key={doc.id} className="rounded-xl border border-border bg-card p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                      {istText ? <BookOpen size={19} className="text-foreground" /> : <FileText size={19} className="text-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{doc.titel}</p>
                      <p className="text-xs text-muted-foreground">
                        {istText ? 'In der App lesbar' : 'PDF/Datei'}{doc.kategorie !== 'Sonstiges' ? ` · ${doc.kategorie}` : ''}{doc.stand_datum ? ` · Stand ${fmtDatum(doc.stand_datum)}` : ''}{doc.version > 1 ? ` · Version ${doc.version}` : ''}{!istText && doc.datei_groesse ? ` · ${fmtGroesse(doc.datei_groesse)}` : ''}
                      </p>
                      {verwaltung && (
                        <p className={`text-xs mt-1 inline-flex items-center gap-1 ${doc.sichtbarkeit === 'alle' ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {doc.sichtbarkeit === 'alle' ? <><Eye size={12} /> Für alle Mitglieder sichtbar</> : <><EyeOff size={12} /> Nur Ausschuss</>}
                        </p>
                      )}
                    </div>
                    {istText ? (
                      <button onClick={() => { setBearbeiteId(null); setLeseId(leseId === doc.id ? null : doc.id); }}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white active:scale-95 transition-transform">
                        <BookOpen size={15} /> {leseId === doc.id ? 'Schließen' : 'Lesen'}
                      </button>
                    ) : (
                      <button onClick={() => oeffne(doc)} className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm text-white active:scale-95 transition-transform">
                        <Download size={15} /> Öffnen
                      </button>
                    )}
                  </div>

                  {istText && leseId === doc.id && (
                    <div className="mt-3">
                      {verwaltung && bearbeiteId === doc.id
                        ? <TextDokumentEditor doc={doc} onGeschlossen={() => setBearbeiteId(null)} onVeroeffentlicht={() => { setBearbeiteId(null); laden(); }} />
                        : <TextDokumentLeser doc={doc} verwaltung={verwaltung} onBearbeiten={() => setBearbeiteId(doc.id)} />}
                    </div>
                  )}

                  {verwaltung && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border text-xs">
                      <button onClick={() => sichtbarkeitUmschalten(doc)} className="rounded-md border border-border px-2.5 py-1.5 text-foreground hover:border-primary/40">
                        {doc.sichtbarkeit === 'alle' ? 'Auf „Nur Ausschuss“ stellen' : 'Für alle freigeben'}
                      </button>
                      {istText ? (
                        <button onClick={() => { setLeseId(doc.id); setBearbeiteId(bearbeiteId === doc.id ? null : doc.id); }}
                          className="rounded-md border border-border px-2.5 py-1.5 text-foreground hover:border-primary/40">
                          {bearbeiteId === doc.id ? 'Bearbeiten schließen' : 'Text bearbeiten'}
                        </button>
                      ) : (
                        <label className="rounded-md border border-border px-2.5 py-1.5 text-foreground hover:border-primary/40 cursor-pointer inline-flex items-center gap-1">
                          <RefreshCw size={12} /> Neue Fassung
                          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="hidden" disabled={busy}
                            onChange={e => { neueFassung(doc, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                      )}
                      <button onClick={() => entfernen(doc)} className="rounded-md border border-border px-2.5 py-1.5 text-destructive hover:border-destructive/40 inline-flex items-center gap-1">
                        <Trash2 size={12} /> Entfernen
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {verwaltung && (
            <form onSubmit={hochladen} className="mt-6 rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-oswald text-lg text-foreground flex items-center gap-2"><Upload size={16} /> Hinzufügen</h2>
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  {[['Datei', 'Datei'], ['Text', 'Text']].map(([k, l]) => (
                    <button type="button" key={k} onClick={() => setModus(k)}
                      className={`px-3 py-1.5 ${modus === k ? 'bg-primary text-white' : 'bg-background text-foreground'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} required placeholder="Titel, z.B. Satzung (Stand Mai 2023)"
                className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.kategorie} onChange={e => setForm(f => ({ ...f, kategorie: e.target.value }))} className="rounded-md border border-border bg-background p-2 text-sm text-foreground">
                  {KATEGORIEN.map(k => <option key={k}>{k}</option>)}
                </select>
                <select value={form.sichtbarkeit} onChange={e => setForm(f => ({ ...f, sichtbarkeit: e.target.value }))} className="rounded-md border border-border bg-background p-2 text-sm text-foreground">
                  <option value="alle">Für alle Mitglieder</option>
                  <option value="ausschuss">Nur Ausschuss</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Stand / Beschlussdatum (optional)</label>
                <input type="date" value={form.stand_datum} onChange={e => setForm(f => ({ ...f, stand_datum: e.target.value }))}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" />
              </div>
              {modus === 'Text' ? (
                <div>
                  <label className="text-xs text-muted-foreground">Text (aus Word/PDF kopieren – Paragrafen werden automatisch erkannt)</label>
                  <textarea value={form.rohtext} onChange={e => setForm(f => ({ ...f, rohtext: e.target.value }))} rows={8} required
                    placeholder="§ 1 Name, Sitz, Geschäftsjahr&#10;&#10;Der Verein führt die Bezeichnung …"
                    className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground leading-relaxed" />
                </div>
              ) : (
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" required onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))} className="text-xs text-foreground max-w-full" />
              )}
              <p className="text-xs text-muted-foreground flex items-start gap-1.5"><ShieldCheck size={13} className="mt-0.5 shrink-0" />Dateien liegen privat und werden nur per Kurzzeit-Link geöffnet. Keine ausgefüllten Anträge hochladen (Bankdaten). Text-Dokumente werden direkt in der App gepflegt.</p>
              <button type="submit" disabled={busy || !form.titel.trim() || (modus === 'Datei' ? !form.file : !form.rohtext.trim())} className="rounded-md bg-primary px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? 'Lädt…' : 'Hochladen'}</button>
            </form>
          )}

          {verwaltung && archiv.length > 0 && (
            <details className="mt-6">
              <summary className="text-sm text-muted-foreground cursor-pointer">Archiv ({archiv.length} ältere Fassungen)</summary>
              <ul className="mt-2 space-y-2">
                {archiv.map(doc => (
                  <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/50 p-2.5 text-sm">
                    <span className="text-foreground min-w-0 truncate">{doc.titel} · Version {doc.version || 1}{doc.stand_datum ? ` · ${fmtDatum(doc.stand_datum)}` : ''}{doc.typ === 'Text' ? ' · Text' : ''}</span>
                    {doc.typ === 'Text'
                      ? <button onClick={() => { setLeseId(doc.id); }} className="text-primary shrink-0">Lesen</button>
                      : <button onClick={() => oeffne(doc)} className="text-primary shrink-0">Öffnen</button>}
                  </li>
                ))}
              </ul>
              {archiv.some(d => d.typ === 'Text' && leseId === d.id) && (
                <div className="mt-2">
                  <TextDokumentLeser doc={archiv.find(d => d.id === leseId)} verwaltung={verwaltung} onBearbeiten={() => {}} />
                </div>
              )}
            </details>
          )}
        </>
      )}
    </div>
  );
}
