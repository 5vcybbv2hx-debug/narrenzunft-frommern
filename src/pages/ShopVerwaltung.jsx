import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  Package,
  ShoppingBag,
  ClipboardList,
  Settings,
  Search,
  Plus,
  Trash2,
  Edit,
  X,
  Check,
  AlertCircle,
  Download,
  Users,
  Shirt,
  ChevronDown,
  ChevronUp,
  Wallet,
  Lock
} from 'lucide-react';

const ALLE_KATEGORIEN = ['Erwachsene', 'Garde', 'Kinder', 'Ersatzteile', 'Sonstiges'];
const ALLE_STATUS = ['Offen', 'Bezahlt', 'In Bestellung', 'Geliefert', 'Abgeholt', 'Abgeschlossen', 'Storniert'];

// Vordefinierte Größen für anklickbare Auswahl
const VORDEFINIERTE_GROESSEN = {
  Erwachsene: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '3XL', '4XL', '5XL'],
  Garde: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  Kinder: ['92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152', '158', '164', '170', '176'],
  Ersatzteile: ['Einheitsgröße', 'S', 'M', 'L', 'XL'],
  Sonstiges: ['Einheitsgröße']
};

export default function ShopVerwaltung() {
  const { user } = useAuth();

  const isAuthorized = useMemo(() => {
    if (!user) return false;
    return ['admin', 'vorstand', 'stellv_vorstand', 'spartenleiter'].includes(user.role);
  }, [user]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <Lock className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="font-oswald uppercase tracking-wide text-2xl mb-2 text-white">Kein Zugriff</h1>
          <p className="text-gray-400">Diese Seite ist nur für Administratoren, den Vorstand und Spartenleiter zugänglich.</p>
        </div>
      </div>
    );
  }

  return <ShopVerwaltungContent user={user} />;
}

function ShopVerwaltungContent({ user }) {
  const [tab, setTab] = useState('bestellungen');
  const [bestellungen, setBestellungen] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [mitglieder, setMitglieder] = useState([]);
  const [sparten, setSparten] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Artikel Modal
  const [showArtikelModal, setShowArtikelModal] = useState(false);
  const [editingArtikel, setEditingArtikel] = useState(null);
  const [formName, setFormName] = useState('');
  const [formBeschreibung, setFormBeschreibung] = useState('');
  const [formKategorie, setFormKategorie] = useState('Erwachsene');
  const [formPreis, setFormPreis] = useState('');
  const [formGroessen, setFormGroessen] = useState([]);
  const [formCustomGroesse, setFormCustomGroesse] = useState('');
  const [formArtikelNummer, setFormArtikelNummer] = useState('');
  const [formSparten, setFormSparten] = useState([]); // array of sparte_ids
  const [formAktiv, setFormAktiv] = useState(true);
  const [formSortierung, setFormSortierung] = useState('');

  const [expandedOrders, setExpandedOrders] = useState({});
  const [expandedPacklists, setExpandedPacklists] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, articlesRes, membersRes, spartenRes] = await Promise.all([
        base44.entities.ShopBestellung.list('-created_date', 500),
        base44.entities.ShopArtikel.list('sortierung', 100),
        base44.entities.Mitglied.list('nachname', 500),
        base44.entities.Sparte.list().catch(() => [])
      ]);
      setBestellungen(ordersRes || []);
      setArtikel(articlesRes || []);
      setMitglieder(membersRes || []);
      setSparten(spartenRes || []);
    } catch (err) {
      console.error('Error loading ShopVerwaltung data:', err);
      setError('Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // HELPERS
  const getMitglied = (id) => mitglieder.find((m) => m.id === id);
  const getSparteName = (id) => {
    const sp = sparten.find((s) => s.id === id);
    return sp ? sp.name || sp.bezeichnung : id || '';
  };
  const formatEuro = (n) => {
    const value = typeof n === 'number' ? n : parseFloat(n || 0);
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  };

  const exportCSV = (headers, rows, filename) => {
    const csvContent = [
      headers.join(';'),
      ...rows.map((row) => row.map((val) => `"${(val === null || val === undefined ? '' : String(val)).replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ACTIONS
  const handleStatusChange = async (bestellung, newStatus) => {
    try {
      await base44.entities.ShopBestellung.update(bestellung.id, { status: newStatus });
      setBestellungen((prev) => prev.map((o) => (o.id === bestellung.id ? { ...o, status: newStatus } : o)));
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Status konnte nicht aktualisiert werden.');
    }
  };

  const toggleArtikelAktiv = async (art) => {
    const nextVal = !art.aktiv;
    try {
      await base44.entities.ShopArtikel.update(art.id, { aktiv: nextVal });
      setArtikel((prev) => prev.map((a) => (a.id === art.id ? { ...a, aktiv: nextVal } : a)));
    } catch (err) {
      console.error('Error toggling article status:', err);
      alert('Status konnte nicht geändert werden.');
    }
  };

  const handleOpenArtikelModal = (art = null) => {
    if (art) {
      setEditingArtikel(art);
      setFormName(art.name || '');
      setFormBeschreibung(art.beschreibung || '');
      setFormKategorie(art.kategorie || 'Erwachsene');
      setFormPreis(art.preis !== undefined ? String(art.preis) : '');
      setFormGroessen(Array.isArray(art.groessen) ? art.groessen : []);
      setFormArtikelNummer(art.artikel_nummer || '');
      setFormSparten(Array.isArray(art.sparten) ? art.sparten : []);
      setFormAktiv(art.aktiv !== false);
      setFormSortierung(art.sortierung !== undefined ? String(art.sortierung) : '');
    } else {
      setEditingArtikel(null);
      setFormName(''); setFormBeschreibung(''); setFormKategorie('Erwachsene'); setFormPreis('');
      setFormGroessen([]); setFormCustomGroesse(''); setFormArtikelNummer(''); setFormSparten([]);
      setFormAktiv(true); setFormSortierung('');
    }
    setShowArtikelModal(true);
  };

  const toggleGroesse = (size) => {
    setFormGroessen((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]);
  };

  const addCustomGroesse = () => {
    const val = formCustomGroesse.trim();
    if (val && !formGroessen.includes(val)) {
      setFormGroessen((prev) => [...prev, val]);
    }
    setFormCustomGroesse('');
  };

  const toggleSparte = (sparteId) => {
    setFormSparten((prev) => prev.includes(sparteId) ? prev.filter((s) => s !== sparteId) : [...prev, sparteId]);
  };

  const handleSaveArtikel = async (e) => {
    e.preventDefault();
    if (!formName) return;

    const data = {
      name: formName,
      beschreibung: formBeschreibung,
      kategorie: formKategorie,
      preis: parseFloat(formPreis) || 0,
      groessen: formGroessen,
      artikel_nummer: formArtikelNummer,
      sparten: formSparten.length > 0 ? formSparten : null,
      aktiv: formAktiv,
      sortierung: parseInt(formSortierung, 10) || 0
    };

    try {
      if (editingArtikel) {
        await base44.entities.ShopArtikel.update(editingArtikel.id, data);
        setArtikel((prev) => prev.map((a) => (a.id === editingArtikel.id ? { ...a, ...data, id: editingArtikel.id } : a)));
      } else {
        const created = await base44.entities.ShopArtikel.create(data);
        setArtikel((prev) => [...prev, created].sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0)));
      }
      setShowArtikelModal(false);
    } catch (err) {
      console.error('Error saving article:', err);
      alert('Fehler beim Speichern des Artikels.');
    }
  };

  const handleDeleteArtikel = async (id) => {
    if (!window.confirm('Möchten Sie diesen Artikel wirklich unwiderruflich löschen?')) return;
    try {
      await base44.entities.ShopArtikel.delete(id);
      setArtikel((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Error deleting article:', err);
      alert('Fehler beim Löschen des Artikels.');
    }
  };

  // FILTERED DATA — verwendet gesamtbetrag statt gesamtpreis
  const filteredBestellungen = useMemo(() => {
    return bestellungen.filter((o) => {
      const m = getMitglied(o.mitglied_id);
      const name = m ? `${m.vorname || ''} ${m.nachname || ''}`.toLowerCase() : (o.mitglied_name || '').toLowerCase();
      const nameMatch = name.includes(search.toLowerCase());
      const statusMatch = statusFilter === 'Alle' || o.status === statusFilter;
      return nameMatch && statusMatch;
    });
  }, [bestellungen, mitglieder, search, statusFilter]);

  // PACKLISTEN — verwendet gesamtbetrag
  const packlistenData = useMemo(() => {
    const groups = {};
    bestellungen.forEach((o) => {
      if (o.status === 'Storniert') return;
      const mId = o.mitglied_id;
      if (!groups[mId]) {
        groups[mId] = { mitglied_id: mId, mitglied: getMitglied(mId), orders: [], totalItems: 0, totalAmount: 0, paymentStatus: 'Bezahlt' };
      }
      groups[mId].orders.push(o);
      const items = Array.isArray(o.positionen) ? o.positionen : [];
      groups[mId].totalItems += items.reduce((sum, item) => sum + (item.menge || 1), 0);
      groups[mId].totalAmount += o.gesamtbetrag || 0;
      if (o.status === 'Offen' || o.status === 'In Bestellung') groups[mId].paymentStatus = 'Offen';
    });
    return Object.values(groups).filter((g) => {
      const name = g.mitglied ? `${g.mitglied.vorname || ''} ${g.mitglied.nachname || ''}`.toLowerCase() : '';
      return name.includes(search.toLowerCase());
    });
  }, [bestellungen, mitglieder, search]);

  // SAMMELBESTELLUNG — verwendet einzelpreis
  const sammelbestellungData = useMemo(() => {
    const agg = {};
    bestellungen.forEach((o) => {
      if (o.status === 'Storniert') return;
      const items = Array.isArray(o.positionen) ? o.positionen : [];
      items.forEach((item) => {
        const key = `${item.artikel_name || ''}_${item.groesse || ''}`;
        if (!agg[key]) {
          agg[key] = { artikel_name: item.artikel_name || '', groesse: item.groesse || '', menge: 0, einzelpreis: item.einzelpreis || 0, gesamt: 0 };
        }
        agg[key].menge += item.menge || 1;
        agg[key].gesamt += (item.menge || 1) * (item.einzelpreis || 0);
      });
    });
    return Object.values(agg).sort((a, b) => {
      const c = a.artikel_name.localeCompare(b.artikel_name);
      return c !== 0 ? c : a.groesse.localeCompare(b.groesse);
    });
  }, [bestellungen]);

  const sammelGrandTotal = useMemo(() => sammelbestellungData.reduce((s, i) => s + i.gesamt, 0), [sammelbestellungData]);

  // EXPORTS — verwendet gesamtbetrag
  const handleExportBestellungen = () => {
    const headers = ['Bestell-ID', 'Mitglied', 'Datum', 'Gesamtbetrag', 'Zahlungsart', 'Status', 'Positionen'];
    const rows = filteredBestellungen.map((o) => {
      const m = getMitglied(o.mitglied_id);
      const mName = m ? `${m.vorname || ''} ${m.nachname || ''}` : (o.mitglied_name || 'Unbekannt');
      const date = o.created_date ? new Date(o.created_date).toLocaleDateString('de-DE') : '';
      const itemsText = Array.isArray(o.positionen) ? o.positionen.map((p) => `${p.artikel_name} (${p.groesse}): ${p.menge}x`).join(', ') : '';
      return [o.id || '', mName, date, o.gesamtbetrag || 0, o.zahlungsart || '', o.status || '', itemsText];
    });
    exportCSV(headers, rows, 'Shop_Bestellungen.csv');
  };

  const handleExportPacklisten = () => {
    const headers = ['Mitglied', 'Zahlungsstatus', 'Gesamtartikel', 'Gesamtsumme', 'Details'];
    const rows = packlistenData.map((g) => {
      const mName = g.mitglied ? `${g.mitglied.vorname || ''} ${g.mitglied.nachname || ''}` : 'Unbekannt';
      const details = g.orders.flatMap((o) => Array.isArray(o.positionen) ? o.positionen : [])
        .map((p) => `${p.fremdname || 'Eigenbedarf'} (${p.artikel_name} - ${p.groesse} - ${p.menge}x)`).join(' | ');
      return [mName, g.paymentStatus, g.totalItems, g.totalAmount, details];
    });
    exportCSV(headers, rows, 'Shop_Packlisten.csv');
  };

  const handleExportSammelbestellung = () => {
    const headers = ['Artikel', 'Größe', 'Gesamtmenge', 'Einzelpreis', 'Gesamtsumme'];
    const rows = sammelbestellungData.map((s) => [s.artikel_name, s.groesse, s.menge, s.einzelpreis, s.gesamt]);
    exportCSV(headers, rows, 'Sammelbestellung_Zusammenfassung.csv');
  };

  // Status styles
  const statusStyles = {
    'Offen': 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    'Bezahlt': 'text-green-400 bg-green-400/10 border-green-400/30',
    'In Bestellung': 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    'Geliefert': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    'Abgeholt': 'text-teal-400 bg-teal-400/10 border-teal-400/30',
    'Abgeschlossen': 'text-gray-400 bg-gray-400/10 border-gray-400/30',
    'Storniert': 'text-red-400 bg-red-400/10 border-red-400/30'
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-oswald uppercase tracking-wide text-3xl md:text-4xl text-white flex items-center gap-3">
            <Shirt className="w-8 h-8 text-primary" /> Shop-Verwaltung
          </h1>
          <p className="text-gray-400 mt-1">Clubkleidung & Bestellungen verwalten</p>
        </div>
        {tab === 'artikel' && (
          <button onClick={() => handleOpenArtikelModal(null)} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition">
            <Plus className="w-5 h-5" /> Artikel hinzufügen
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-px">
        {[
          { id: 'bestellungen', label: 'Bestellungen', icon: ShoppingBag },
          { id: 'packlisten', label: 'Packlisten', icon: ClipboardList },
          { id: 'sammel', label: 'Sammelbestellung', icon: Users },
          { id: 'artikel', label: 'Artikelverwaltung', icon: Settings }
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg font-medium transition ${active ? 'bg-primary text-white border-b-2 border-primary' : 'bg-neutral-800 text-gray-400 hover:text-white hover:bg-neutral-700'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin"></div>
          <p className="text-gray-400 mt-4">Daten werden geladen...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-primary shrink-0" />
          <p className="text-white">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* TAB: BESTELLUNGEN */}
          {tab === 'bestellungen' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Mitglied suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div className="flex gap-2 shrink-0">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm">
                    <option value="Alle">Alle Status</option>
                    {ALLE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={handleExportBestellungen} className="flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 rounded-xl border border-border hover:bg-neutral-700 transition text-sm"><Download className="w-4 h-4" /> CSV Export</button>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border flex justify-between items-center bg-neutral-900">
                  <h3 className="font-oswald uppercase tracking-wide text-lg text-white">Bestellungen ({filteredBestellungen.length})</h3>
                </div>
                {filteredBestellungen.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">Keine Bestellungen gefunden</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredBestellungen.map((o) => {
                      const m = getMitglied(o.mitglied_id);
                      const isExpanded = !!expandedOrders[o.id];
                      const dateStr = o.created_date ? new Date(o.created_date).toLocaleDateString('de-DE') : '';
                      const itemsCount = (o.positionen || []).reduce((sum, item) => sum + (item.menge || 1), 0);
                      return (
                        <div key={o.id} className="transition hover:bg-neutral-900/40">
                          <div onClick={() => setExpandedOrders((prev) => ({ ...prev, [o.id]: !prev[o.id] }))} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer">
                            <div className="flex items-start gap-3">
                              <ShoppingBag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-white text-base">{m ? `${m.vorname || ''} ${m.nachname || ''}` : (o.mitglied_name || 'Unbekannt')}</h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
                                  <span>{dateStr}</span><span>•</span><span>{itemsCount} Artikel</span><span>•</span><span>Zahlung: {o.zahlungsart || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <span className="font-semibold text-white">{formatEuro(o.gesamtbetrag || 0)}</span>
                              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusStyles[o.status] || 'text-white border-border'}`}>{o.status || 'Offen'}</span>
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="p-4 bg-neutral-900/60 border-t border-border">
                              <div className="mb-4">
                                <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Bestellte Positionen</h5>
                                <div className="space-y-2">
                                  {(o.positionen || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                                      <div>
                                        <p className="font-medium text-white">{item.menge || 1}x {item.artikel_name}</p>
                                        <p className="text-xs text-gray-400">Größe: {item.groesse} | Für: {item.fremdname || 'Eigenbedarf'}{item.sparte ? ` | Sparte: ${item.sparte}` : ''}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-white">{formatEuro(item.einzelpreis || 0)}</p>
                                        <p className="text-xs text-gray-400 font-medium">{formatEuro((item.menge || 1) * (item.einzelpreis || 0))}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {o.notiz && <div className="mb-3 p-3 bg-neutral-900 rounded-lg border border-border/60"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notiz</p><p className="text-sm text-white">{o.notiz}</p></div>}
                              {o.status !== 'Storniert' && (
                                <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/50">
                                  {o.status === 'Offen' && (
                                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(o, 'Bezahlt'); }} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition"><Check className="w-4 h-4" /> Als bezahlt markieren</button>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Status ändern:</span>
                                    <select value={o.status || 'Offen'} onChange={(e) => handleStatusChange(o, e.target.value)} className="text-xs px-2 py-1 bg-neutral-950 border border-border rounded text-white focus:outline-none">
                                      {ALLE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PACKLISTEN */}
          {tab === 'packlisten' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" placeholder="Mitglied suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <button onClick={handleExportPacklisten} className="flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 rounded-xl border border-border hover:bg-neutral-700 transition text-sm self-start"><Download className="w-4 h-4" /> CSV Export</button>
              </div>
              <div className="space-y-4">
                {packlistenData.length === 0 ? (
                  <div className="p-8 bg-card border border-border rounded-xl text-center text-gray-500">Keine Einträge gefunden</div>
                ) : (
                  packlistenData.map((group) => {
                    const isExpanded = !!expandedPacklists[group.mitglied_id];
                    const mName = group.mitglied ? `${group.mitglied.vorname || ''} ${group.mitglied.nachname || ''}` : 'Unbekannt';
                    const itemsByPerson = {};
                    group.orders.forEach((o) => {
                      (Array.isArray(o.positionen) ? o.positionen : []).forEach((p) => {
                        const personKey = p.fremdname ? p.fremdname.trim() : 'Eigenbedarf';
                        if (!itemsByPerson[personKey]) itemsByPerson[personKey] = [];
                        itemsByPerson[personKey].push(p);
                      });
                    });
                    return (
                      <div key={group.mitglied_id} className="bg-card border border-border rounded-xl overflow-hidden">
                        <div onClick={() => setExpandedPacklists((prev) => ({ ...prev, [group.mitglied_id]: !prev[group.mitglied_id] }))} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-900/30 transition">
                          <div className="flex items-start gap-3">
                            <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-white text-base">{mName}</h4>
                              <p className="text-xs text-gray-400 mt-1">{group.totalItems} Artikel insgesamt • {group.orders.length} Bestellung(en)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="font-semibold text-white">{formatEuro(group.totalAmount)}</p>
                              <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${group.paymentStatus === 'Bezahlt' ? 'text-green-400 bg-green-400/10 border-green-400/30' : 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'}`}>{group.paymentStatus}</span>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="p-4 bg-neutral-900/40 border-t border-border space-y-4">
                            {Object.entries(itemsByPerson).map(([person, items]) => (
                              <div key={person} className="border border-border/60 rounded-lg p-3 bg-neutral-900/60">
                                <h5 className="font-oswald uppercase tracking-wide text-sm text-primary mb-2 border-b border-border/40 pb-1">Für: {person === 'Eigenbedarf' ? mName : person}</h5>
                                <div className="space-y-1">
                                  {items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm py-1">
                                      <span className="text-white">{item.artikel_name} <span className="text-xs text-gray-400">({item.groesse})</span></span>
                                      <span className="text-gray-400 font-medium">x{item.menge || 1}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: SAMMELBESTELLUNG */}
          {tab === 'sammel' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-neutral-900/60 border border-border p-4 rounded-xl">
                <div>
                  <h3 className="font-oswald uppercase tracking-wide text-lg text-white">Sammelbestellung Zusammenfassung</h3>
                  <p className="text-sm text-gray-400">Übersicht aller aktiven Bestellpositionen für Lieferanten.</p>
                </div>
                <button onClick={handleExportSammelbestellung} className="flex items-center gap-2 bg-neutral-800 text-white px-4 py-2 rounded-xl border border-border hover:bg-neutral-700 transition shrink-0 text-sm"><Download className="w-4 h-4" /> Export für Lieferanten (CSV)</button>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-900 border-b border-border font-oswald uppercase tracking-wide text-sm text-gray-400">
                        <th className="p-4">Artikel Name</th><th className="p-4">Größe</th><th className="p-4 text-center">Gesamtmenge</th><th className="p-4 text-right">Einzelpreis</th><th className="p-4 text-right font-semibold text-white">Gesamtsumme</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-sm">
                      {sammelbestellungData.length === 0 ? (
                        <tr><td colSpan="5" className="p-8 text-center text-gray-500">Keine aktiven Bestellpositionen vorhanden.</td></tr>
                      ) : (
                        sammelbestellungData.map((s, idx) => (
                          <tr key={idx} className="hover:bg-neutral-900/30 transition">
                            <td className="p-4 font-medium text-white">{s.artikel_name}</td>
                            <td className="p-4 text-gray-300">{s.groesse || '—'}</td>
                            <td className="p-4 text-center font-bold text-white">{s.menge}</td>
                            <td className="p-4 text-right text-gray-400">{formatEuro(s.einzelpreis)}</td>
                            <td className="p-4 text-right font-medium text-white">{formatEuro(s.gesamt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {sammelbestellungData.length > 0 && (
                      <tfoot>
                        <tr className="bg-neutral-900 font-semibold border-t border-border">
                          <td colSpan="4" className="p-4 text-right text-gray-400 font-oswald uppercase tracking-wide text-base">Gesamtwert der Sammelbestellung:</td>
                          <td className="p-4 text-right text-primary font-oswald uppercase tracking-wide text-lg">{formatEuro(sammelGrandTotal)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ARTIKELVERWALTUNG */}
          {tab === 'artikel' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {artikel.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-card border border-border rounded-xl text-gray-500">Keine Artikel vorhanden. Erstellen Sie den ersten Artikel oben rechts.</div>
                ) : (
                  artikel.map((art) => (
                    <div key={art.id} className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div>
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary mb-1.5">{art.kategorie || 'Sonstiges'}</span>
                            <h4 className="font-oswald uppercase tracking-wide text-lg text-white leading-tight">{art.name}</h4>
                          </div>
                          <button onClick={() => toggleArtikelAktiv(art)} className={`px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full border transition ${art.aktiv ? 'bg-green-400/10 border-green-400/30 text-green-400' : 'bg-red-400/10 border-red-400/30 text-red-400'}`}>{art.aktiv ? 'Aktiv' : 'Inaktiv'}</button>
                        </div>
                        {art.artikel_nummer && <p className="text-xs text-gray-400 mb-2">Art.-Nr: {art.artikel_nummer}</p>}
                        <p className="text-sm text-gray-300 line-clamp-2 mb-3">{art.beschreibung || 'Keine Beschreibung vorhanden.'}</p>
                        <div className="mb-3">
                          <p className="text-xs text-gray-400 font-semibold mb-1">Größen:</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(art.groessen) && art.groessen.length > 0 ? art.groessen.map((sz, i) => (
                              <span key={i} className="text-xs bg-neutral-900 border border-border px-1.5 py-0.5 rounded text-white">{sz}</span>
                            )) : <span className="text-xs text-gray-500">Keine Größen definiert</span>}
                          </div>
                        </div>
                        {Array.isArray(art.sparten) && art.sparten.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-400 font-semibold mb-1">Sparte:</p>
                            <div className="flex flex-wrap gap-1">
                              {art.sparten.map((spId, i) => <span key={i} className="text-[10px] bg-neutral-800 border border-border px-1.5 py-0.5 rounded text-gray-300">{getSparteName(spId)}</span>)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pt-4 border-t border-border mt-4 flex items-center justify-between">
                        <div className="text-lg font-bold text-primary font-oswald tracking-wide">{formatEuro(art.preis || 0)}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleOpenArtikelModal(art)} className="p-1.5 bg-neutral-800 text-white rounded border border-border hover:bg-neutral-700 transition" title="Bearbeiten"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteArtikel(art.id)} className="p-1.5 bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/10 transition" title="Löschen"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ARTIKEL MODAL — mit anklickbaren Größen und Sparten-Checkboxes */}
      {showArtikelModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg my-8 relative shadow-2xl">
            <button onClick={() => setShowArtikelModal(false)} className="absolute right-4 top-4 p-1 text-gray-400 hover:text-white transition"><X className="w-5 h-5" /></button>
            <h3 className="font-oswald uppercase tracking-wide text-xl mb-4 text-white">{editingArtikel ? 'Artikel bearbeiten' : 'Artikel hinzufügen'}</h3>
            <form onSubmit={handleSaveArtikel} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Name *</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" placeholder="Zunfthose, Kapuzenjacke..." />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Beschreibung</label>
                <textarea value={formBeschreibung} onChange={(e) => setFormBeschreibung(e.target.value)} rows="2" className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm resize-none" placeholder="Details zum Material, Passform..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Kategorie</label>
                  <select value={formKategorie} onChange={(e) => setFormKategorie(e.target.value)} className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm">
                    {ALLE_KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Preis (EUR) *</label>
                  <input type="number" step="0.01" required value={formPreis} onChange={(e) => setFormPreis(e.target.value)} className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" placeholder="49.90" />
                </div>
              </div>

              {/* GRÖßEN — anklickbare Chips */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Größen (anklicken zum Auswählen)</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(VORDEFINIERTE_GROESSEN[formKategorie] || []).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => toggleGroesse(size)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formGroessen.includes(size) ? 'bg-primary text-white border-primary' : 'bg-neutral-900 border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {/* Custom Größe hinzufügen */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formCustomGroesse}
                    onChange={(e) => setFormCustomGroesse(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomGroesse(); } }}
                    placeholder="Eigene Größe hinzufügen..."
                    className="flex-1 px-3 py-1.5 bg-neutral-900 border border-border rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                  />
                  <button type="button" onClick={addCustomGroesse} className="px-3 py-1.5 bg-neutral-800 text-white rounded-lg border border-border hover:bg-neutral-700 transition text-xs flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Hinzufügen</button>
                </div>
                {/* Gewählte Größen anzeigen */}
                {formGroessen.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {formGroessen.map((sz) => (
                      <span key={sz} className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 text-primary px-2 py-1 rounded text-xs font-medium">
                        {sz}
                        <button type="button" onClick={() => toggleGroesse(sz)} className="text-primary hover:text-white"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Artikelnummer</label>
                  <input type="text" value={formArtikelNummer} onChange={(e) => setFormArtikelNummer(e.target.value)} className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" placeholder="ZF-1004" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Sortierung (Zahl)</label>
                  <input type="number" value={formSortierung} onChange={(e) => setFormSortierung(e.target.value)} className="w-full px-3 py-2 bg-neutral-900 border border-border rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-primary text-sm" placeholder="10" />
                </div>
              </div>

              {/* SPARTEN — anklickbare Checkboxes */}
              {sparten.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-400 mb-2">Sparten (optional — leer = für alle sichtbar)</label>
                  <div className="flex flex-wrap gap-2">
                    {sparten.map((sp) => {
                      const isSelected = formSparten.includes(sp.id);
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => toggleSparte(sp.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${isSelected ? 'bg-primary text-white border-primary' : 'bg-neutral-900 border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {sp.name || sp.bezeichnung || sp.id}
                        </button>
                      );
                    })}
                  </div>
                  {formSparten.length === 0 && (
                    <p className="text-[10px] text-gray-500 mt-1.5">Keine Sparte ausgewählt = Artikel ist für alle Mitglieder sichtbar.</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="formAktiv" checked={formAktiv} onChange={(e) => setFormAktiv(e.target.checked)} className="rounded bg-neutral-900 border-border text-primary focus:ring-primary focus:ring-opacity-25" />
                <label htmlFor="formAktiv" className="text-sm text-gray-300">Artikel aktiv und im Shop sichtbar</label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setShowArtikelModal(false)} className="px-4 py-2 bg-neutral-800 text-white rounded-lg hover:bg-neutral-700 transition text-sm">Abbrechen</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-red-700 transition text-sm">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
