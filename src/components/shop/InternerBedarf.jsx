import { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { kannShopVerwalten } from '@/lib/roles';
import { toast } from 'sonner';
import {
  ClipboardList, PenLine, Users, Plus, Pencil, Trash2, Download,
  Lock, Unlock, CheckCircle2, Package, XCircle, Loader2, CalendarDays, ChevronDown, Euro,
} from 'lucide-react';
import InterneBestellModal from './InterneBestellModal';
import InternerArtikelModal from './InternerArtikelModal';
import BestellrundeModal from './BestellrundeModal';
import { confirmDialog } from '@/components/ui/ConfirmProvider';

const heuteISO = () => new Date().toISOString().split('T')[0];
const formatDE = (iso) => iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('de-DE') : '';
const tageBis = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  const h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((d - h) / 86400000);
};

export default function InternerBedarf() {
  const { user } = useAuth();
  const canManage = kannShopVerwalten(user);
  const canSeeOverview = kannShopVerwalten(user);

  const [loading, setLoading] = useState(true);
  const [profil, setProfil] = useState(null);
  const [runden, setRunden] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [meine, setMeine] = useState([]);
  const [alle, setAlle] = useState([]);

  const [bestellModal, setBestellModal] = useState(null); // artikel
  const [artikelModal, setArtikelModal] = useState(null);  // 'new' | objekt
  const [rundeModal, setRundeModal] = useState(null);     // 'new' | objekt
  const [adminTab, setAdminTab] = useState('uebersicht'); // uebersicht | artikel | runde
  const [uebersichtRundeId, setUebersichtRundeId] = useState(null);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const [rundenRes, artikelRes, gruppenRes] = await Promise.all([
        base44.entities.Bestellrunde.filter({}, '-created_date'),
        base44.entities.InternerArtikel.filter({}, 'sortierung'),
        base44.entities.Haesgruppe.list('name', 200),
      ]);
      setRunden(rundenRes || []);
      setArtikel(artikelRes || []);
      setGruppen(gruppenRes || []);

      let p = null;
      if (user?.id) {
        const prof = await base44.entities.Mitglied.filter({ user_id: user.id });
        p = prof?.[0] || null;
        setProfil(p);
        if (p) {
          const meineRes = await base44.entities.InterneBestellung.filter({ mitglied_id: p.id });
          setMeine(meineRes || []);
        }
      }
      if (canSeeOverview) {
        const alleRes = await base44.entities.InterneBestellung.filter({}, '-created_date');
        setAlle(alleRes || []);
      }
    } catch (e) {
      console.error('InternerBedarf laden fehlgeschlagen:', e);
      toast.error('Interner Bedarf konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [user, canSeeOverview]);

  useEffect(() => { laden(); }, [laden]);

  // Neueste offene Runde, deren Frist noch nicht abgelaufen ist
  const heute = heuteISO();
  const offeneRunden = (runden || []).filter((r) => r.status === 'Offen');
  const bestellRunde = offeneRunden.find((r) => r.frist_datum >= heute) || null;
  const fristAbgelaufen = offeneRunden.length > 0 && !bestellRunde;
  const neuesteRunde = (runden || [])[0] || null;

  const aktiveArtikel = useMemo(
    () => (artikel || [])
      .filter((a) => a.aktiv)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de')),
    [artikel]
  );

  // Artikel nach Sparten gruppiert (jeder sieht alles, nur gruppiert)
  const artikelNachGruppen = useMemo(() => {
    const spartenVon = (a) => (a.sparten || '').split(',').map((v) => v.trim()).filter(Boolean);
    const allgemein = aktiveArtikel.filter((a) => spartenVon(a).length === 0);
    const gruppenSortiert = [...gruppen].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
    const sections = [{ key: '__allgemein', name: 'Allgemein', gruppe: null, artikel: allgemein }];
    for (const g of gruppenSortiert) {
      const list = aktiveArtikel.filter((a) => spartenVon(a).includes(g.id));
      if (list.length > 0) sections.push({ key: g.id, name: g.name, gruppe: g, artikel: list });
    }
    return sections.filter((sec) => sec.artikel.length > 0);
  }, [aktiveArtikel, gruppen]);

  const stornieren = async (b) => {
    if (!(await confirmDialog(`Bestellung "${b.artikel_name}" wirklich zurückziehen?`))) return;
    try {
      await base44.entities.InterneBestellung.delete(b.id);
      toast.success('Bestellung zurückgezogen.');
      laden();
    } catch (e) {
      console.error(e);
      toast.error('Zurückziehen fehlgeschlagen.');
    }
  };

  const rundeStatus = async (r, status) => {
    const labels = { Geschlossen: 'schließen', Bestellt: 'als bestellt markieren', Offen: 'wieder öffnen' };
    if (!(await confirmDialog(`Bestellrunde "${r.titel}" wirklich ${labels[status]}?`))) return;
    try {
      await base44.entities.Bestellrunde.update(r.id, { status });
      toast.success(`Runde ${labels[status]} – ${labels[status] === 'bestellt' ? 'Bestellliste kann exportiert werden.' : 'erledigt.'}`);
      laden();
    } catch (e) {
      console.error(e);
      toast.error('Statusänderung fehlgeschlagen.');
    }
  };

  const toggleAusgeteilt = async (b) => {
    try {
      const neu = b.status === 'Ausgeteilt' ? 'Offen' : 'Ausgeteilt';
      await base44.entities.InterneBestellung.update(b.id, { status: neu });
      laden();
    } catch (e) {
      console.error(e);
      toast.error('Aktualisieren fehlgeschlagen.');
    }
  };

  const toggleBezahlt = async (b) => {
    try {
      await base44.entities.InterneBestellung.update(b.id, { bezahlt: !b.bezahlt });
      laden();
    } catch (e) {
      console.error(e);
      toast.error('Aktualisieren fehlgeschlagen.');
    }
  };

  const artikelToggleAktiv = async (a) => {
    try {
      await base44.entities.InternerArtikel.update(a.id, { aktiv: !a.aktiv });
      laden();
    } catch (e) {
      console.error(e);
      toast.error('Aktualisieren fehlgeschlagen.');
    }
  };

  const uebersichtRunde = runden.find((r) => r.id === (uebersichtRundeId || neuesteRunde?.id)) || null;
  const uebersichtBestellungen = useMemo(
    () => (alle || []).filter((b) => b.runde_id === uebersichtRunde?.id),
    [alle, uebersichtRunde]
  );

  // Zusammenfassung: Artikel × Variante
  const zusammenfassung = useMemo(() => {
    const map = {};
    for (const b of uebersichtBestellungen) {
      const key = `${b.artikel_name}|||${b.variante || ''}`;
      map[key] = (map[key] || 0) + (b.anzahl || 1);
    }
    return Object.entries(map)
      .map(([key, sum]) => {
        const [name, variante] = key.split('|||');
        return { name, variante, sum };
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.variante.localeCompare(b.variante));
  }, [uebersichtBestellungen]);

  // Austeil-Liste: gruppiert nach Mitglied
  const austeil = useMemo(() => {
    const map = {};
    for (const b of uebersichtBestellungen) {
      const key = b.mitglied_name || 'Unbekannt';
      (map[key] = map[key] || []).push(b);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [uebersichtBestellungen]);

  const exportCSV = () => {
    if (!uebersichtBestellungen.length) return toast.error('Keine Bestellungen in dieser Runde.');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Mitglied', 'Empfänger', 'Artikel', 'Ausführung', 'Logo/Sparte', 'Anzahl', 'Gravur', 'Notiz', 'Ausgeteilt', 'Bezahlt'];
    const rows = uebersichtBestellungen.map((b) =>
      [b.mitglied_name, b.fuer_name, b.artikel_name, b.variante, b.sparte_name, b.anzahl, b.gravur_name, b.notiz, b.status === 'Ausgeteilt' ? 'Ja' : 'Nein', b.bezahlt ? 'Ja' : 'Nein']
        .map(esc).join(';')
    );
    const csv = [header.map(esc).join(';'), ...rows].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bestellliste_${(uebersichtRunde?.titel || 'Runde').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bestellliste als CSV exportiert.');
  };

  const exportRundeCSV = (runde) => {
    const bestellungen = (alle || []).filter((b) => b.runde_id === runde.id);
    if (!bestellungen.length) return toast.error('Keine Bestellungen in dieser Runde.');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Mitglied', 'Empfänger', 'Artikel', 'Ausführung', 'Logo/Sparte', 'Anzahl', 'Gravur', 'Notiz', 'Ausgeteilt', 'Bezahlt'];
    const rows = bestellungen.map((b) =>
      [b.mitglied_name, b.fuer_name, b.artikel_name, b.variante, b.sparte_name, b.anzahl, b.gravur_name, b.notiz, b.status === 'Ausgeteilt' ? 'Ja' : 'Nein', b.bezahlt ? 'Ja' : 'Nein']
        .map(esc).join(';')
    );
    const csv = [header.map(esc).join(';'), ...rows].join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bestellliste_${runde.titel.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bestellliste als CSV exportiert.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={28} className="text-primary animate-spin" />
        <p className="mt-3 text-sm text-muted-foreground font-oswald uppercase tracking-wide">Interner Bedarf wird geladen…</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Aktuelle Bestellrunde ── */}
      {bestellRunde ? (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <CalendarDays className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-oswald uppercase tracking-wide text-primary font-semibold">{bestellRunde.titel}</p>
              <p className="text-xs text-foreground mt-1">
                Bestellfrist: <span className="font-semibold">{formatDE(bestellRunde.frist_datum)}</span>
                {tageBis(bestellRunde.frist_datum) >= 0 && tageBis(bestellRunde.frist_datum) <= 14 && (
                  <span className="text-primary font-semibold"> · noch {tageBis(bestellRunde.frist_datum)} Tage</span>
                )}
              </p>
              {bestellRunde.notiz && <p className="text-xs text-muted-foreground mt-1">{bestellRunde.notiz}</p>}
            </div>
          </div>
        </div>
      ) : fristAbgelaufen ? (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-sm text-foreground">Die Bestellfrist ist abgelaufen – neue Bestellungen sind derzeit nicht möglich.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium">Aktuell läuft keine Bestellrunde.</p>
            {canManage && <p className="text-xs text-muted-foreground mt-0.5">Lege unten unter „Runde verwalten" eine neue Runde an, um Bestellungen zu öffnen.</p>}
          </div>
        </div>
      )}

      {/* ── Admin-Bereich ── */}
      {canManage && (
        <div className="bg-card border border-border rounded-xl mb-6 overflow-hidden">
          <div className="flex border-b border-border">
            {[
              { key: 'uebersicht', label: 'Bestellübersicht', icon: ClipboardList },
              { key: 'artikel', label: 'Artikel', icon: Package },
              { key: 'runde', label: 'Runde verwalten', icon: CalendarDays },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setAdminTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-oswald uppercase tracking-wide transition-colors ${adminTab === key ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon size={14} className="shrink-0" /> <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Bestellübersicht */}
            {adminTab === 'uebersicht' && (
              <div className="space-y-4">
                {runden.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Noch keine Bestellrunde angelegt.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={uebersichtRunde?.id || ''} onChange={(e) => setUebersichtRundeId(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary">
                        {runden.map((r) => (
                          <option key={r.id} value={r.id}>{r.titel} ({formatDE(r.frist_datum)}){r.status !== 'Offen' ? ` – ${r.status}` : ''}</option>
                        ))}
                      </select>
                      <button onClick={exportCSV}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors ml-auto">
                        <Download size={14} /> Bestellliste (CSV)
                      </button>
                    </div>

                    {uebersichtBestellungen.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Keine Bestellungen in dieser Runde.</p>
                    ) : (
                      <>
                        <div className="grid gap-2">
                          <p className="text-xs font-oswald uppercase tracking-wide text-muted-foreground">Gesamtbedarf</p>
                          {zusammenfassung.map((z, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/60">
                              <span className="text-sm text-foreground">
                                {z.name}{z.variante && <span className="text-muted-foreground"> · {z.variante}</span>}
                              </span>
                              <span className="text-sm font-oswald font-bold text-primary">{z.sum} Stück</span>
                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="text-xs font-oswald uppercase tracking-wide text-muted-foreground mb-2">
                            Austeilen an ({austeil.length} {austeil.length === 1 ? 'Besteller' : 'Besteller'})
                          </p>
                          <div className="space-y-2">
                            {austeil.map(([name, bestellungen]) => (
                              <div key={name} className="rounded-lg border border-border overflow-hidden">
                                <div className="px-3 py-2 bg-secondary/60 text-sm font-semibold text-foreground">{name}</div>
                                {bestellungen.map((b) => (
                                  <div key={b.id} className="px-3 py-2.5 border-t border-border flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm text-foreground">
                                        <span className="font-oswald font-bold text-primary">{b.anzahl}×</span> {b.artikel_name}
                                        {b.variante && <span className="text-muted-foreground"> · {b.variante}</span>}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                                        {b.fuer_name && b.fuer_name !== b.mitglied_name && <span>für {b.fuer_name}</span>}
                                        {b.sparte_name && <span>Logo: {b.sparte_name}</span>}
                                        {b.gravur_name && <span className="text-yellow-400">Gravur: {b.gravur_name}</span>}
                                        {b.notiz && <span>Notiz: {b.notiz}</span>}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button onClick={() => toggleBezahlt(b)} title={b.bezahlt ? 'Als nicht bezahlt markieren' : 'Als bezahlt markieren'}
                                        className={`p-2 rounded-lg transition-colors ${b.bezahlt ? 'bg-blue-500/15 text-blue-400' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                                        <Euro size={16} />
                                      </button>
                                      <button onClick={() => toggleAusgeteilt(b)} title={b.status === 'Ausgeteilt' ? 'Als offen markieren' : 'Als ausgeteilt markieren'}
                                        className={`p-2 rounded-lg transition-colors ${b.status === 'Ausgeteilt' ? 'bg-green-500/15 text-green-400' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                                        <CheckCircle2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Artikel-Verwaltung */}
            {adminTab === 'artikel' && (
              <div className="space-y-2">
                <button onClick={() => setArtikelModal('new')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Plus size={14} /> Neuer Artikel
                </button>
                {artikel.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Noch keine Artikel angelegt.</p>
                ) : (
                  artikel.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/60">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {a.name}
                          {!a.aktiv && <span className="text-xs text-muted-foreground ml-2">(inaktiv)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.kategorie}
                          {(a.sparten || '').trim()
                            ? ` · ${(a.sparten || '').split(',').map((id) => gruppen.find((g) => g.id === id.trim())?.name || '?').join(', ')}`
                            : ' · Für alle Sparten'}
                          {a.varianten && ` · ${a.varianten}`}
                          {a.personalisierung && ' · Gravur'}
                          {a.sparte_logo && ' · Sparten-Logo'}
                          {a.preis > 0 && ` · ${a.preis.toFixed(2).replace('.', ',')} €`}
                        </p>
                      </div>
                      <button onClick={() => artikelToggleAktiv(a)} title={a.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        className={`p-2 rounded-lg transition-colors ${a.aktiv ? 'text-green-400 bg-green-500/10' : 'text-muted-foreground bg-secondary hover:text-foreground'}`}>
                        {a.aktiv ? <Unlock size={14} /> : <Lock size={14} />}
                      </button>
                      <button onClick={() => setArtikelModal(a)} title="Bearbeiten"
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Runden-Verwaltung */}
            {adminTab === 'runde' && (
              <div className="space-y-2">
                <button onClick={() => setRundeModal('new')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Plus size={14} /> Neue Bestellrunde
                </button>
                {runden.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Noch keine Bestellrunde angelegt.</p>
                ) : (
                  runden.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/60">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                          {r.titel}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            r.status === 'Offen' ? 'bg-green-500/20 text-green-400'
                            : r.status === 'Bestellt' ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {r.status}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Frist: {formatDE(r.frist_datum)}</p>
                      </div>
                      {r.status === 'Offen' && (
                        <button onClick={() => rundeStatus(r, 'Geschlossen')} title="Runde schließen (keine weiteren Bestellungen)"
                          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Lock size={14} />
                        </button>
                      )}
                      {r.status === 'Geschlossen' && (
                        <>
                          <button onClick={() => rundeStatus(r, 'Bestellt')} title="Als bestellt markieren"
                            className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => rundeStatus(r, 'Offen')} title="Wieder öffnen"
                            className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <Unlock size={14} />
                          </button>
                        </>
                      )}
                      {r.status === 'Bestellt' && (
                        <button onClick={() => rundeStatus(r, 'Offen')} title="Wieder öffnen"
                          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Unlock size={14} />
                        </button>
                      )}
                      <button onClick={() => exportRundeCSV(r)} title="Bestellliste als CSV exportieren"
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-primary transition-colors">
                        <Download size={14} />
                      </button>
                      <button onClick={() => setRundeModal(r)} title="Bearbeiten"
                        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Artikel-Auswahl (Mitglieder), nach Sparten gruppiert ── */}
      {artikelNachGruppen.length > 0 && (
        <div className="space-y-8">
          {artikelNachGruppen.map((sec) => (
            <div key={sec.key}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-oswald uppercase tracking-wide text-lg text-foreground">{sec.name}</h3>
                {sec.gruppe && profil?.haesgruppe_id === sec.gruppe.id && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white uppercase tracking-wide">Deine Sparte</span>
                )}
                <span className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sec.artikel.map((a) => {
                  const bestellbar = !!bestellRunde && !!profil;
                  return (
                    <button key={`${sec.key}-${a.id}`} disabled={!bestellbar} onClick={() => setBestellModal(a)}
                      className={`bg-card border border-border rounded-xl p-4 text-left transition-all ${bestellbar ? 'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5' : 'opacity-50 cursor-not-allowed'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wide">{a.kategorie}</span>
                        {a.preis > 0 && <span className="text-base font-oswald font-bold text-primary">{a.preis.toFixed(2).replace('.', ',')} €</span>}
                      </div>
                      <h4 className="font-oswald font-medium text-base text-foreground leading-tight">{a.name}</h4>
                      {a.beschreibung && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.beschreibung}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(a.varianten || '').split(',').filter(Boolean).map((v) => (
                          <span key={v} className="px-2 py-0.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground">{v.trim()}</span>
                        ))}
                        {a.personalisierung && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs flex items-center gap-1">
                            <PenLine size={10} /> Gravur
                          </span>
                        )}
                        {a.sparte_logo && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-xs text-muted-foreground flex items-center gap-1">
                            <Users size={10} /> Sparten-Logo
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {artikelNachGruppen.length === 0 && !loading && (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Artikel</h3>
          <p className="text-muted-foreground text-sm mt-1">{canManage ? 'Lege unter „Artikel" Artikel für den internen Bedarf an.' : 'Aktuell gibt es nichts zu bestellen.'}</p>
        </div>
      )}

      {/* ── Meine Bestellungen ── */}
      {profil && (
        <div className="mt-8">
          <h3 className="font-oswald uppercase tracking-wide text-lg mb-3">Meine Bestellungen</h3>
          {meine.length === 0 ? (
            <p className="text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-4">Noch keine Bestellungen abgegeben.</p>
          ) : (
            <div className="space-y-2">
              {[...meine].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')).map((b) => {
                const runde = runden.find((r) => r.id === b.runde_id);
                // Zurückziehen möglich, solange die Runde der Bestellung noch offen ist
                const stornierbar = runde?.status === 'Offen' && b.status !== 'Ausgeteilt';
                return (
                  <div key={b.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-oswald font-bold text-primary">{b.anzahl}×</span> {b.artikel_name}
                        {b.variante && <span className="text-muted-foreground"> · {b.variante}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        {runde && <span>{runde.titel}</span>}
                        {b.fuer_name && <span>für {b.fuer_name}</span>}
                        {b.sparte_name && <span>Logo: {b.sparte_name}</span>}
                        {b.gravur_name && <span className="text-yellow-400">Gravur: {b.gravur_name}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {b.status === 'Ausgeteilt' ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-500/20 text-green-400 uppercase tracking-wide">Ausgeteilt</span>
                      ) : stornierbar ? (
                        <button onClick={() => stornieren(b)} title="Bestellung zurückziehen (Runde noch offen)"
                          className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {bestellModal && profil && bestellRunde && (
        <InterneBestellModal
          artikel={bestellModal}
          runde={bestellRunde}
          profil={profil}
          gruppen={gruppen}
          onClose={() => setBestellModal(null)}
          onSaved={() => { setBestellModal(null); laden(); }}
        />
      )}
      {artikelModal && (
        <InternerArtikelModal
          artikel={artikelModal === 'new' ? null : artikelModal}
          gruppen={gruppen}
          onClose={() => setArtikelModal(null)}
          onSaved={() => { setArtikelModal(null); laden(); }}
        />
      )}
      {rundeModal && (
        <BestellrundeModal
          runde={rundeModal === 'new' ? null : rundeModal}
          onClose={() => setRundeModal(null)}
          onSaved={() => { setRundeModal(null); laden(); }}
        />
      )}
    </div>
  );
}