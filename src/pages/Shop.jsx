import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Check,
  X,
  Search,
  ChevronRight,
  User,
  Wallet,
  CreditCard,
  Package,
  Shirt,
  AlertCircle
} from 'lucide-react';

const ALLE_KATEGORIEN = ['Alle', 'Erwachsene', 'Garde', 'Kinder', 'Ersatzteile', 'Sonstiges'];
const ZAHLUNGSART_UEBERWEISUNG = 'Überweisung';
const ZAHLUNGSART_BAR = 'Bar';

export default function Shop() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [artikel, setArtikel] = useState([]);
  const [mitglied, setMitglied] = useState(null);
  const [familienMitglieder, setFamilienMitglieder] = useState([]);
  const [meineBestellungen, setMeineBestellungen] = useState([]);
  const [gruppenMap, setGruppenMap] = useState({}); // haesgruppe_id -> name

  const [activeTab, setActiveTab] = useState('shop');
  const [selectedKategorie, setSelectedKategorie] = useState('Alle');
  const [selectedGruppe, setSelectedGruppe] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');

  const [warenkorb, setWarenkorb] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(ZAHLUNGSART_UEBERWEISUNG);
  const [checkoutNote, setCheckoutNote] = useState('');

  const [selectedSizes, setSelectedSizes] = useState({});
  const [quantities, setQuantities] = useState({});
  const [fuerWenSelections, setFuerWenSelections] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeArticles = await base44.entities.ShopArtikel.filter({ aktiv: true });
      const sorted = (activeArticles || []).sort((a, b) => (a.sortierung || 0) - (b.sortierung || 0));
      setArtikel(sorted);

      const me = await base44.auth.me();
      if (!me) throw new Error('Benutzer nicht authentifiziert');

      const own = await base44.entities.Mitglied.filter({ user_id: me.id });
      const myMitglied = own && own[0];
      if (!myMitglied) throw new Error('Kein verknüpfter Mitgliedsdatensatz gefunden.');
      setMitglied(myMitglied);

      // Haesgruppen laden (das SIND die Sparten)
      const gruppen = await base44.entities.Haesgruppe.list('name', 200);
      const gMap = {};
      (gruppen || []).forEach((g) => { gMap[g.id] = g.name || g.bezeichnung || ''; });
      setGruppenMap(gMap);

      const iSizes = {}, iQty = {}, iFuer = {};
      sorted.forEach((art) => {
        if (art.groessen && art.groessen.length > 0) iSizes[art.id] = art.groessen[0];
        iQty[art.id] = 1;
        iFuer[art.id] = myMitglied.id;
      });
      setSelectedSizes(iSizes);
      setQuantities(iQty);
      setFuerWenSelections(iFuer);

      if (myMitglied.familie_id) {
        const fam = await base44.entities.Mitglied.filter({ familie_id: myMitglied.familie_id });
        setFamilienMitglieder((fam || []).filter((m) => m.id !== myMitglied.id));
      }

      const orders = await base44.entities.ShopBestellung.filter({ mitglied_id: myMitglied.id });
      setMeineBestellungen(
        (orders || []).sort((a, b) => {
          const dA = a.created_date ? new Date(a.created_date).getTime() : 0;
          const dB = b.created_date ? new Date(b.created_date).getTime() : 0;
          return dB - dA;
        })
      );
    } catch (err) {
      console.error('Error loading shop data:', err);
      setError(err.message || 'Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getGruppenName = (gruppenId) => {
    if (!gruppenId) return '';
    return gruppenMap[gruppenId] || '';
  };

  const getMitgliedInfo = (id) => {
    if (!mitglied) return null;
    if (mitglied.id === id) {
      return {
        id: mitglied.id,
        name: `${mitglied.vorname} ${mitglied.nachname} (Ich selbst)`,
        rawName: `${mitglied.vorname} ${mitglied.nachname}`,
        gruppen_id: mitglied.haesgruppe_id,
        gruppen_name: getGruppenName(mitglied.haesgruppe_id)
      };
    }
    const found = familienMitglieder.find((m) => m.id === id);
    if (found) {
      return {
        id: found.id,
        name: `${found.vorname} ${found.nachname}`,
        rawName: `${found.vorname} ${found.nachname}`,
        gruppen_id: found.haesgruppe_id,
        gruppen_name: getGruppenName(found.haesgruppe_id)
      };
    }
    return null;
  };

  const availableGruppen = useMemo(() => {
    const ids = new Set();
    artikel.forEach((art) => {
      if (art.sparten && Array.isArray(art.sparten)) art.sparten.forEach((sp) => ids.add(sp));
    });
    if (mitglied?.haesgruppe_id) ids.add(mitglied.haesgruppe_id);
    familienMitglieder.forEach((m) => { if (m.haesgruppe_id) ids.add(m.haesgruppe_id); });
    return Array.from(ids).map((id) => ({ id, name: getGruppenName(id) })).filter((s) => s.name);
  }, [artikel, mitglied, familienMitglieder, gruppenMap]);

  const filteredArtikel = useMemo(() => {
    return artikel.filter((art) => {
      if (selectedKategorie !== 'Alle' && art.kategorie !== selectedKategorie) return false;
      if (selectedGruppe !== 'Alle') {
        const artSparten = art.sparten && Array.isArray(art.sparten) ? art.sparten : [];
        if (artSparten.length > 0 && !artSparten.includes(selectedGruppe)) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        if (!art.name?.toLowerCase().includes(q) && !art.beschreibung?.toLowerCase().includes(q)) return false;
      }
      const targetMitgliedId = fuerWenSelections[art.id] || mitglied?.id;
      const targetMitglied = getMitgliedInfo(targetMitgliedId);
      if (art.sparten && Array.isArray(art.sparten) && art.sparten.length > 0) {
        if (!targetMitglied || !art.sparten.includes(targetMitglied.gruppen_id)) return false;
      }
      return true;
    });
  }, [artikel, selectedKategorie, selectedGruppe, searchQuery, fuerWenSelections, mitglied, familienMitglieder, gruppenMap]);

  const totalCartAmount = useMemo(() => warenkorb.reduce((t, i) => t + (i.einzelpreis * i.menge), 0), [warenkorb]);
  const totalCartCount = useMemo(() => warenkorb.reduce((t, i) => t + i.menge, 0), [warenkorb]);

  const handleAddToCart = (art) => {
    const selectedSize = selectedSizes[art.id];
    if (!selectedSize && art.groessen && art.groessen.length > 0) {
      setError('Bitte wähle eine Größe aus.');
      return;
    }
    const qty = quantities[art.id] || 1;
    const recipientId = fuerWenSelections[art.id] || mitglied?.id;
    const recipientInfo = getMitgliedInfo(recipientId);
    if (!recipientInfo) { setError('Ausgewähltes Mitglied konnte nicht zugeordnet werden.'); return; }

    // Sparte/Gruppe automatisch aus dem Empfänger ziehen — das ist der Design-Kennzeichner!
    const gruppenId = recipientInfo.gruppen_id || '';
    const gruppenName = recipientInfo.gruppen_name || '';

    const newItem = {
      artikel_id: art.id,
      artikel_name: art.name,
      groesse: selectedSize || 'Unisize',
      menge: qty,
      einzelpreis: art.preis || 0,
      fremdname: recipientId === mitglied.id ? '' : recipientInfo.rawName,
      fuer_mitglied_id: recipientId === mitglied.id ? '' : recipientId,
      typ: art.kategorie || 'Allgemein',
      // Sparte als Design-Kennzeichner — wichtig für Sammelbestellung und Packliste
      sparte: gruppenName,
      sparte_id: gruppenId,
      mitglied_id: recipientId
    };

    const existingIndex = warenkorb.findIndex((item) =>
      item.artikel_id === newItem.artikel_id && item.groesse === newItem.groesse && item.mitglied_id === newItem.mitglied_id
    );
    if (existingIndex > -1) {
      const updated = [...warenkorb];
      updated[existingIndex].menge += newItem.menge;
      setWarenkorb(updated);
    } else {
      setWarenkorb([...warenkorb, newItem]);
    }
    setQuantities((prev) => ({ ...prev, [art.id]: 1 }));
    const sparteText = gruppenName ? ` (${gruppenName})` : '';
    setSuccessMessage(`"${art.name}"${sparteText} wurde in den Warenkorb gelegt.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const updateCartItemQuantity = (index, delta) => {
    const updated = [...warenkorb];
    const newQty = updated[index].menge + delta;
    if (newQty <= 0) updated.splice(index, 1);
    else updated[index].menge = newQty;
    setWarenkorb(updated);
  };

  const removeCartItem = (index) => {
    const updated = [...warenkorb];
    updated.splice(index, 1);
    setWarenkorb(updated);
  };

  const cartGroupedByMember = useMemo(() => {
    const groups = {};
    warenkorb.forEach((item) => {
      const memberInfo = getMitgliedInfo(item.mitglied_id);
      const name = memberInfo ? memberInfo.name : 'Unbekannt';
      const sparte = memberInfo ? memberInfo.gruppen_name : '';
      const key = item.mitglied_id;
      if (!groups[key]) groups[key] = { name, sparte, items: [] };
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [warenkorb, mitglied, familienMitglieder, gruppenMap]);

  const handleCheckoutSubmit = async () => {
    if (warenkorb.length === 0) { setError('Dein Warenkorb ist leer.'); return; }
    setLoading(true);
    setError(null);
    try {
      const memberName = mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : 'Unbekannt';
      const orderPayload = {
        mitglied_id: mitglied.id,
        mitglied_name: memberName,
        saison: '2026',
        status: 'Offen',
        gesamtbetrag: totalCartAmount,
        zahlungsart: paymentMethod,
        positionen: warenkorb,
        notiz: checkoutNote,
        frist_datum: '2026-09-15'
      };
      await base44.entities.ShopBestellung.create(orderPayload);
      setWarenkorb([]);
      setCheckoutNote('');
      setCheckoutSuccess(true);
      setShowCheckout(false);
      const updatedOrders = await base44.entities.ShopBestellung.filter({ mitglied_id: mitglied.id });
      setMeineBestellungen(
        (updatedOrders || []).sort((a, b) => {
          const dA = a.created_date ? new Date(a.created_date).getTime() : 0;
          const dB = b.created_date ? new Date(b.created_date).getTime() : 0;
          return dB - dA;
        })
      );
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message || 'Die Bestellung konnte nicht abgeschickt werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    setLoading(true);
    setError(null);
    try {
      await base44.entities.ShopBestellung.update(orderId, { status: 'Storniert' });
      const updatedOrders = await base44.entities.ShopBestellung.filter({ mitglied_id: mitglied.id });
      setMeineBestellungen(
        (updatedOrders || []).sort((a, b) => {
          const dA = a.created_date ? new Date(a.created_date).getTime() : 0;
          const dB = b.created_date ? new Date(b.created_date).getTime() : 0;
          return dB - dA;
        })
      );
      setSuccessMessage('Bestellung wurde erfolgreich storniert.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error cancelling order:', err);
      setError('Fehler beim Stornieren der Bestellung.');
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpand = (orderId) => setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Offen': return 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30';
      case 'Bezahlt': return 'bg-green-400/10 text-green-400 border border-green-400/30';
      case 'In Bestellung': return 'bg-blue-400/10 text-blue-400 border border-blue-400/30';
      case 'Geliefert': return 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30';
      case 'Abgeholt': return 'bg-teal-400/10 text-teal-400 border border-teal-400/30';
      case 'Abgeschlossen': return 'bg-neutral-600/10 text-gray-400 border border-neutral-600/30';
      case 'Storniert': return 'bg-red-400/10 text-red-400 border border-red-400/30';
      default: return 'bg-neutral-700/10 text-white border border-neutral-700/30';
    }
  };

  if (loading && artikel.length === 0 && !mitglied) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium tracking-wide font-oswald uppercase text-neutral-400">Shop wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans pb-32">
      <div className="border-b border-border bg-[#080808] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="text-primary w-8 h-8" />
            <div>
              <h1 className="text-2xl font-oswald uppercase tracking-wide leading-none">Vereinsshop</h1>
              <p className="text-xs text-neutral-400 mt-1">Kleidungsbestellungen für Narrenzunft Frommern</p>
            </div>
          </div>
          {!showCheckout && !checkoutSuccess && (
            <div className="flex items-center gap-3">
              {warenkorb.length > 0 && (
                <button onClick={() => setShowCheckout(true)} className="relative flex items-center gap-2 bg-neutral-900 border border-border px-3 py-1.5 rounded-xl hover:bg-neutral-800 transition">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{totalCartCount}</span>
                  <span className="text-xs text-neutral-400">{totalCartAmount.toFixed(2)} €</span>
                </button>
              )}
              <div className="flex bg-neutral-900 border border-border p-1 rounded-xl">
                <button onClick={() => { setActiveTab('shop'); setShowCheckout(false); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'shop' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'}`}>Katalog</button>
                <button onClick={() => { setActiveTab('bestellungen'); setShowCheckout(false); }} className={`px-4 py-1.5 rounded-lg text-sm font-medium relative transition-all ${activeTab === 'bestellungen' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'}`}>
                  Bestellungen
                  {meineBestellungen.length > 0 && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-300 rounded-full">{meineBestellungen.length}</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && (
          <div className="bg-red-950 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex items-start justify-between">
            <div className="flex gap-3"><AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" /><div><p className="font-semibold text-sm">Fehler aufgetreten</p><p className="text-xs mt-1 text-red-300">{error}</p></div></div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 p-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3"><Check className="w-5 h-5 text-emerald-400" /><p className="text-sm font-medium">{successMessage}</p></div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        )}

        {checkoutSuccess ? (
          <div className="max-w-md mx-auto text-center py-12 px-4 bg-card border border-border rounded-xl mt-8">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-8 h-8" /></div>
            <h2 className="text-2xl font-oswald uppercase tracking-wide mb-2">Bestellung abgeschickt!</h2>
            <p className="text-neutral-400 text-sm mb-6">Vielen Dank für deine Bestellung. Sie wurde erfasst und wird von unseren Zeugwarten geprüft.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setCheckoutSuccess(false); setActiveTab('shop'); }} className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors">Weiter einkaufen</button>
              <button onClick={() => { setCheckoutSuccess(false); setActiveTab('bestellungen'); }} className="w-full bg-neutral-800 text-white border border-border py-2.5 rounded-xl font-medium text-sm hover:bg-neutral-700 transition-colors">Meine Bestellungen ansehen</button>
            </div>
          </div>
        ) : showCheckout ? (
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl overflow-hidden mt-2">
            <div className="border-b border-border p-4 bg-neutral-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2"><ShoppingCart className="text-primary w-5 h-5" /><h2 className="font-oswald uppercase tracking-wide text-lg">Kasse &amp; Bestellung</h2></div>
              <button onClick={() => setShowCheckout(false)} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Artikelübersicht</h3>
                {cartGroupedByMember.map((group, gIdx) => (
                  <div key={gIdx} className="bg-neutral-900/40 border border-border/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 border-b border-border/40 pb-2">
                      <User className="w-4 h-4 text-primary" /><div className="text-sm font-semibold">{group.name}</div>
                      {group.sparte && <span className="text-[10px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary">{group.sparte}</span>}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item, itemIdx) => {
                        const cartIdx = warenkorb.indexOf(item);
                        return (
                          <div key={itemIdx} className="flex justify-between items-center text-sm py-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <button onClick={() => updateCartItemQuantity(cartIdx, -1)} className="text-neutral-400 hover:text-white"><Minus className="w-3.5 h-3.5" /></button>
                              <span className="text-neutral-400 font-mono text-xs">{item.menge}x</span>
                              <button onClick={() => updateCartItemQuantity(cartIdx, 1)} className="text-neutral-400 hover:text-white"><Plus className="w-3.5 h-3.5" /></button>
                              <span className="truncate">{item.artikel_name}</span>
                              <span className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">{item.groesse}</span>
                              {item.sparte && <span className="text-[10px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary">{item.sparte}</span>}
                              <button onClick={() => removeCartItem(cartIdx)} className="text-red-400 hover:text-red-300 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="font-semibold text-neutral-200">{(item.einzelpreis * item.menge).toFixed(2)} €</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Notiz an den Zeugwart (optional)</label>
                <textarea value={checkoutNote} onChange={(e) => setCheckoutNote(e.target.value)} placeholder="Besondere Wünsche, Anmerkungen oder Fragen..." className="w-full h-24 bg-neutral-900 border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary/50 text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Zahlungsart wählen</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === ZAHLUNGSART_UEBERWEISUNG ? 'border-primary bg-primary/5' : 'border-border bg-neutral-900/30 hover:bg-neutral-900/50'}`}>
                    <input type="radio" name="payment_method" value={ZAHLUNGSART_UEBERWEISUNG} checked={paymentMethod === ZAHLUNGSART_UEBERWEISUNG} onChange={() => setPaymentMethod(ZAHLUNGSART_UEBERWEISUNG)} className="sr-only" />
                    <CreditCard className={`w-6 h-6 ${paymentMethod === ZAHLUNGSART_UEBERWEISUNG ? 'text-primary' : 'text-neutral-400'}`} /><span className="text-xs font-medium">Überweisung</span>
                  </label>
                  <label className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${paymentMethod === ZAHLUNGSART_BAR ? 'border-primary bg-primary/5' : 'border-border bg-neutral-900/30 hover:bg-neutral-900/50'}`}>
                    <input type="radio" name="payment_method" value={ZAHLUNGSART_BAR} checked={paymentMethod === ZAHLUNGSART_BAR} onChange={() => setPaymentMethod(ZAHLUNGSART_BAR)} className="sr-only" />
                    <Wallet className={`w-6 h-6 ${paymentMethod === ZAHLUNGSART_BAR ? 'text-primary' : 'text-neutral-400'}`} /><span className="text-xs font-medium">Barzahlung</span>
                  </label>
                </div>
              </div>
              <div className="bg-neutral-900 border border-border p-3.5 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-400 leading-normal">Die Bestellfrist endet am <span className="text-neutral-200 font-semibold">15.09.2026</span>. Deine Bestellung ist verbindlich. Der Aufdruck/Stick wird automatisch nach deiner Sparte bestimmt.</p>
              </div>
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div><p className="text-xs text-neutral-400 uppercase tracking-wider">Gesamtsumme</p><p className="text-3xl font-oswald uppercase tracking-wide text-primary">{totalCartAmount.toFixed(2)} €</p></div>
                <button onClick={handleCheckoutSubmit} disabled={loading} className="bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50">
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-5 h-5" />} Bestellung abschicken
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'shop' ? (
          <>
            <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {ALLE_KATEGORIEN.map((kat) => (
                  <button key={kat} onClick={() => setSelectedKategorie(kat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors ${selectedKategorie === kat ? 'bg-primary text-white' : 'bg-neutral-900 border border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}>{kat}</button>
                ))}
              </div>
              {availableGruppen.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wide">Sparte/Design:</span>
                  <button onClick={() => setSelectedGruppe('Alle')} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${selectedGruppe === 'Alle' ? 'bg-primary text-white border-primary' : 'bg-neutral-900 border-border text-neutral-400 hover:text-white'}`}>Alle</button>
                  {availableGruppen.map((sp) => (
                    <button key={sp.id} onClick={() => setSelectedGruppe(sp.id)} className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${selectedGruppe === sp.id ? 'bg-primary text-white border-primary' : 'bg-neutral-900 border-border text-neutral-400 hover:text-white'}`}>{sp.name}</button>
                  ))}
                </div>
              )}
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input type="text" placeholder="Suchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-neutral-900 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary/50" />
              </div>
            </div>

            {filteredArtikel.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <Package className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Artikel verfügbar</h3>
                <p className="text-neutral-400 text-sm mt-1">Es konnten keine Artikel für deine Auswahl gefunden werden.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArtikel.map((art) => {
                  const selectedSize = selectedSizes[art.id] || '';
                  const qty = quantities[art.id] || 1;
                  const currentRecipient = fuerWenSelections[art.id] || mitglied?.id;
                  const inCartCount = warenkorb.filter((item) => item.artikel_id === art.id && item.mitglied_id === currentRecipient).reduce((total, item) => total + item.menge, 0);
                  const recipientInfo = getMitgliedInfo(currentRecipient);
                  const showSparteHint = recipientInfo && recipientInfo.gruppen_name;
                  return (
                    <div key={art.id} className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between transition-all hover:border-primary/20">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] bg-neutral-900 border border-border px-2 py-0.5 rounded-full text-neutral-400 font-medium uppercase tracking-wider">{art.kategorie || 'Allgemein'}</span>
                          {inCartCount > 0 && <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider flex items-center gap-1"><Check className="w-3 h-3" /> Im Warenkorb ({inCartCount})</span>}
                        </div>
                        <h3 className="text-lg font-oswald uppercase tracking-wide font-bold line-clamp-1">{art.name}</h3>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 min-h-[2rem]">{art.beschreibung || 'Keine Beschreibung verfügbar.'}</p>
                        {art.sparten && art.sparten.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] text-primary uppercase font-bold tracking-wide">Nur für Sparte:</span>
                            {art.sparten.map((sp) => (<span key={sp} className="text-[9px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary">{getGruppenName(sp)}</span>))}
                          </div>
                        )}
                        {art.groessen && art.groessen.length > 0 && (
                          <div className="mt-4">
                            <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Größe wählen:</label>
                            <div className="flex flex-wrap gap-1.5">
                              {art.groessen.map((size) => (
                                <button key={size} onClick={() => setSelectedSizes((prev) => ({ ...prev, [art.id]: size }))} className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${selectedSize === size ? 'bg-primary text-white border-primary' : 'bg-neutral-900 border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'}`}>{size}</button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-4">
                          <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Für wen bestellen?</label>
                          <select value={currentRecipient} onChange={(e) => setFuerWenSelections((prev) => ({ ...prev, [art.id]: e.target.value }))} className="w-full bg-neutral-900 border border-border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50">
                            <option value={mitglied?.id}>Ich selbst{mitglied?.haesgruppe_id ? ` (${getGruppenName(mitglied.haesgruppe_id) || ''})` : ''}</option>
                            {familienMitglieder.map((fam) => (<option key={fam.id} value={fam.id}>{fam.vorname} {fam.nachname} ({getGruppenName(fam.haesgruppe_id) || 'Keine Sparte'})</option>))}
                          </select>
                          {showSparteHint && (
                            <p className="text-[10px] text-primary mt-1.5 flex items-center gap-1">
                              <Shirt className="w-3 h-3" /> Design/Aufdruck: {recipientInfo.gruppen_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-5 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-oswald uppercase tracking-wide text-primary font-bold">{(art.preis || 0).toFixed(2)} €</span>
                          <div className="flex items-center bg-neutral-900 border border-border rounded-lg overflow-hidden">
                            <button onClick={() => setQuantities((prev) => ({ ...prev, [art.id]: Math.max(1, (prev[art.id] || 1) - 1) }))} className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                            <span className="px-3 text-xs font-semibold font-mono">{qty}</span>
                            <button onClick={() => setQuantities((prev) => ({ ...prev, [art.id]: (prev[art.id] || 1) + 1 }))} className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <button onClick={() => handleAddToCart(art)} className="w-full bg-primary text-white font-medium py-2 rounded-xl text-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"><ShoppingCart className="w-4 h-4" /> In den Warenkorb</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-oswald uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2"><ShoppingBag className="text-primary w-5 h-5" /> Bisherige Bestellungen</h2>
            {meineBestellungen.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <ShoppingBag className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Noch keine Bestellungen</h3>
                <p className="text-neutral-400 text-sm mt-1">Du hast bisher noch keine Bestellungen in diesem Shop aufgegeben.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meineBestellungen.map((ord) => {
                  const isExpanded = expandedOrders[ord.id];
                  const orderDate = ord.created_date ? new Date(ord.created_date).toLocaleDateString('de-DE') : 'Unbekannt';
                  const positionenCount = ord.positionen ? ord.positionen.reduce((t, i) => t + i.menge, 0) : 0;
                  const canCancel = ord.status === 'Offen';
                  return (
                    <div key={ord.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <div onClick={() => toggleOrderExpand(ord.id)} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-900/30 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2"><span className="font-semibold text-sm">Bestellung vom {orderDate}</span><span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-border">Saison {ord.saison || '2026'}</span></div>
                          <p className="text-xs text-neutral-400">{positionenCount} {positionenCount === 1 ? 'Artikel' : 'Artikel'} · Gesamtsumme: <span className="text-primary font-bold">{(ord.gesamtbetrag || 0).toFixed(2)} €</span></p>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadgeClass(ord.status)}`}>{ord.status}</span>
                          <ChevronRight className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-neutral-900/30 space-y-4">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Bestellte Positionen</h4>
                            {(ord.positionen || []).map((pos, posIdx) => (
                              <div key={posIdx} className="flex justify-between items-start text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                <div>
                                  <div className="flex items-center gap-2"><span className="font-semibold">{pos.menge}x {pos.artikel_name}</span><span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] text-neutral-300">{pos.groesse}</span></div>
                                  <p className="text-neutral-400 text-[10px] mt-0.5">Für: {pos.fremdname || 'Eigenbedarf'}{pos.sparte ? ` · Sparte/Design: ${pos.sparte}` : ''}{' · '}Einzelpreis: {(pos.einzelpreis || 0).toFixed(2)} €</p>
                                </div>
                                <div className="text-right"><p className="text-neutral-200 font-semibold">{((pos.einzelpreis || 0) * (pos.menge || 1)).toFixed(2)} €</p></div>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="text-neutral-400">Zahlungsart: <span className="text-white font-medium">{ord.zahlungsart || 'N/A'}</span></span>
                            {ord.notiz && <span className="text-neutral-400">Notiz: <span className="text-white">{ord.notiz}</span></span>}
                          </div>
                          {canCancel && <button onClick={() => handleCancelOrder(ord.id)} className="flex items-center gap-1.5 bg-red-600/10 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 rounded-lg hover:bg-red-600/20 transition"><X className="w-4 h-4" /> Bestellung stornieren</button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
