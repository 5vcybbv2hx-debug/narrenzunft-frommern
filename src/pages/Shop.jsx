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
  Filter,
  ChevronRight,
  User,
  Users,
  Wallet,
  CreditCard,
  Package,
  Shirt,
  AlertCircle
} from 'lucide-react';

export default function Shop() {
  // 1. STATE declarations
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Entities & loaded records
  const [artikel, setArtikel] = useState([]);
  const [mitglied, setMitglied] = useState(null);
  const [familienMitglieder, setFamilienMitglieder] = useState([]);
  const [meineBestellungen, setMeineBestellungen] = useState([]);
  const [spartenMap, setSpartenMap] = useState({}); // id -> name mapping

  // Shop navigation & view toggles
  const [activeTab, setActiveTab] = useState('shop'); // 'shop' | 'bestellungen'
  const [selectedKategorie, setSelectedKategorie] = useState('Alle'); // 'Alle', 'Erwachsene', 'Garde', 'Kinder'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart & Checkout state
  const [warenkorb, setWarenkorb] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Ueberweisung'); // 'Bar' or 'Ueberweisung'
  const [checkoutNote, setCheckoutNote] = useState('');

  // Per-article interaction states
  // We keep track of selected size and quantity for each article_id separately.
  // We also track "für wen" member selection for each article.
  const [selectedSizes, setSelectedSizes] = useState({}); // { [artikel_id]: sizeString }
  const [quantities, setQuantities] = useState({}); // { [artikel_id]: number }
  const [fuerWenSelections, setFuerWenSelections] = useState({}); // { [artikel_id]: mitglied_id }

  // Expanded states for orders
  const [expandedOrders, setExpandedOrders] = useState({}); // { [order_id]: boolean }

  // 2. DATA LOADING ON MOUNT
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch active articles
      const activeArticles = await base44.entities.ShopArtikel.filter({ aktiv: true });
      setArtikel(activeArticles || []);

      // 2. Fetch current user
      const me = await base44.auth.me();
      if (!me) {
        throw new Error('Benutzer nicht authentifiziert');
      }

      // 3. Fetch own Mitglied record
      const ownMitgliedArray = await base44.entities.Mitglied.filter({ user_id: me.id });
      const myMitglied = ownMitgliedArray && ownMitgliedArray[0];

      if (!myMitglied) {
        throw new Error('Kein verknüpfter Mitgliedsdatensatz gefunden.');
      }
      setMitglied(myMitglied);

      // Initialize default selections for each article
      const initialSizes = {};
      const initialQuantities = {};
      const initialFuerWen = {};
      activeArticles.forEach((art) => {
        if (art.groessen && art.groessen.length > 0) {
          initialSizes[art.id] = art.groessen[0];
        }
        initialQuantities[art.id] = 1;
        initialFuerWen[art.id] = myMitglied.id; // default is self
      });
      setSelectedSizes(initialSizes);
      setQuantities(initialQuantities);
      setFuerWenSelections(initialFuerWen);

      // 4. Fetch family members if familie_id is present
      if (myMitglied.familie_id) {
        const familyList = await base44.entities.Mitglied.filter({ familie_id: myMitglied.familie_id });
        const membersExcludingSelf = (familyList || []).filter(m => m.id !== myMitglied.id);
        setFamilienMitglieder(membersExcludingSelf);
      } else {
        setFamilienMitglieder([]);
      }

      // 5. Fetch own orders
      const ownOrders = await base44.entities.ShopBestellung.filter({ mitglied_id: myMitglied.id });
      // Sort orders descending by created_date or updated_date if available
      const sortedOrders = (ownOrders || []).sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
        return dateB - dateA;
      });
      setMeineBestellungen(sortedOrders);

      // 6. Try to load Sparte entity for name resolution
      try {
        const spartenData = await base44.entities.Sparte.filter({});
        if (spartenData && spartenData.length > 0) {
          const mapping = {};
          spartenData.forEach((s) => {
            mapping[s.id] = s.name || s.bezeichnung;
          });
          setSpartenMap(mapping);
        }
      } catch (err) {
        console.warn('Sparte entity loading failed, using IDs directly:', err);
      }

    } catch (err) {
      console.error('Error loading shop data:', err);
      setError(err.message || 'Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to resolve sparte ID to Name
  const getSparteName = (sparteId) => {
    if (!sparteId) return '';
    return spartenMap[sparteId] || sparteId;
  };

  // Helper to resolve Mitglied ID to name and sparte info
  const getMitgliedInfo = (id) => {
    if (!mitglied) return null;
    if (mitglied.id === id) {
      return {
        id: mitglied.id,
        name: `${mitglied.vorname} ${mitglied.nachname} (Ich selbst)`,
        rawName: `${mitglied.vorname} ${mitglied.nachname}`,
        sparte_id: mitglied.sparte_id,
        sparte_name: getSparteName(mitglied.sparte_id)
      };
    }
    const found = familienMitglieder.find(m => m.id === id);
    if (found) {
      return {
        id: found.id,
        name: `${found.vorname} ${found.nachname}`,
        rawName: `${found.vorname} ${found.nachname}`,
        sparte_id: found.sparte_id,
        sparte_name: getSparteName(found.sparte_id)
      };
    }
    return null;
  };

  // 3. SPARTE FILTERING & GENERAL SEARCH/CATEGORY FILTER
  const filteredArtikel = useMemo(() => {
    return artikel.filter((art) => {
      // 1. General category filter (Erwachsene, Garde, Kinder)
      if (selectedKategorie !== 'Alle') {
        if (art.kategorie !== selectedKategorie) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = art.name?.toLowerCase().includes(q);
        const matchesDesc = art.beschreibung?.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) {
          return false;
        }
      }

      // 3. Sparte restriction verification based on selected recipient for this article
      const targetMitgliedId = fuerWenSelections[art.id] || mitglied?.id;
      const targetMitglied = getMitgliedInfo(targetMitgliedId);

      if (art.sparten && Array.isArray(art.sparten) && art.sparten.length > 0) {
        if (!targetMitglied || !art.sparten.includes(targetMitglied.sparte_id)) {
          return false;
        }
      }

      return true;
    });
  }, [artikel, selectedKategorie, searchQuery, fuerWenSelections, mitglied, familienMitglieder, spartenMap]);

  // Cart calculation
  const totalCartAmount = useMemo(() => {
    return warenkorb.reduce((total, item) => total + (item.einzelpreis * item.menge), 0);
  }, [warenkorb]);

  const totalCartCount = useMemo(() => {
    return warenkorb.reduce((total, item) => total + item.menge, 0);
  }, [warenkorb]);

  // Handle adding to cart
  const handleAddToCart = (art) => {
    const selectedSize = selectedSizes[art.id];
    if (!selectedSize && art.groessen && art.groessen.length > 0) {
      setError('Bitte wähle eine Größe aus.');
      return;
    }

    const qty = quantities[art.id] || 1;
    const recipientId = fuerWenSelections[art.id] || mitglied?.id;
    const recipientInfo = getMitgliedInfo(recipientId);

    if (!recipientInfo) {
      setError('Ausgewähltes Mitglied konnte nicht zugeordnet werden.');
      return;
    }

    // Build cart item
    const newItem = {
      artikel_id: art.id,
      artikel_name: art.name,
      groesse: selectedSize || 'Unisize',
      menge: qty,
      einzelpreis: art.preis || 0,
      fremdname: recipientId === mitglied.id ? '' : recipientInfo.rawName,
      typ: art.kategorie || 'Allgemein',
      sparte: recipientInfo.sparte_name || recipientInfo.sparte_id || '',
      mitglied_id: recipientId
    };

    // Check if duplicate item exists in cart
    const existingIndex = warenkorb.findIndex(item => 
      item.artikel_id === newItem.artikel_id &&
      item.groesse === newItem.groesse &&
      item.mitglied_id === newItem.mitglied_id
    );

    if (existingIndex > -1) {
      const updatedCart = [...warenkorb];
      updatedCart[existingIndex].menge += newItem.menge;
      setWarenkorb(updatedCart);
    } else {
      setWarenkorb([...warenkorb, newItem]);
    }

    // Reset default inputs for this item
    setQuantities(prev => ({ ...prev, [art.id]: 1 }));
    setSuccessMessage(`"${art.name}" wurde in den Warenkorb gelegt.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Adjust quantity in cart
  const updateCartItemQuantity = (index, delta) => {
    const updated = [...warenkorb];
    const newQty = updated[index].menge + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].menge = newQty;
    }
    setWarenkorb(updated);
  };

  // Remove item from cart
  const removeCartItem = (index) => {
    const updated = [...warenkorb];
    updated.splice(index, 1);
    setWarenkorb(updated);
  };

  // Group cart items by member for checkout screen
  const cartGroupedByMember = useMemo(() => {
    const groups = {};
    warenkorb.forEach((item) => {
      const memberInfo = getMitgliedInfo(item.mitglied_id);
      const name = memberInfo ? memberInfo.name : 'Unbekannt';
      const sparte = memberInfo ? memberInfo.sparte_name : '';
      const key = item.mitglied_id;
      if (!groups[key]) {
        groups[key] = {
          name,
          sparte,
          items: []
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [warenkorb, mitglied, familienMitglieder, spartenMap]);

  // Handle Checkout Submit
  const handleCheckoutSubmit = async () => {
    if (warenkorb.length === 0) {
      setError('Dein Warenkorb ist leer.');
      return;
    }

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
      
      // Clean up on success
      setWarenkorb([]);
      setCheckoutNote('');
      setCheckoutSuccess(true);
      setShowCheckout(false);
      setShowCart(false);

      // Refresh own orders
      const updatedOrders = await base44.entities.ShopBestellung.filter({ mitglied_id: mitglied.id });
      const sortedOrders = (updatedOrders || []).sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
        return dateB - dateA;
      });
      setMeineBestellungen(sortedOrders);

    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message || 'Die Bestellung konnte nicht abgeschickt werden. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Order Cancellation
  const handleCancelOrder = async (orderId) => {
    setLoading(true);
    setError(null);
    try {
      await base44.entities.ShopBestellung.update(orderId, { status: 'Storniert' });
      
      // Refresh list
      const updatedOrders = await base44.entities.ShopBestellung.filter({ mitglied_id: mitglied.id });
      const sortedOrders = (updatedOrders || []).sort((a, b) => {
        const dateA = a.created_date ? new Date(a.created_date).getTime() : 0;
        const dateB = b.created_date ? new Date(b.created_date).getTime() : 0;
        return dateB - dateA;
      });
      setMeineBestellungen(sortedOrders);
      setSuccessMessage('Bestellung wurde erfolgreich storniert.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error cancelling order:', err);
      setError('Fehler beim Stornieren der Bestellung.');
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpand = (orderId) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Color mappings for order status badges
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Offen':
        return 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30';
      case 'Bezahlt':
        return 'bg-green-400/10 text-green-400 border border-green-400/30';
      case 'In Bestellung':
        return 'bg-blue-400/10 text-blue-400 border border-blue-400/30';
      case 'Geliefert':
        return 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30';
      case 'Abgeschlossen':
        return 'bg-neutral-600/10 text-gray-400 border border-neutral-600/30';
      case 'Storniert':
        return 'bg-red-400/10 text-red-400 border border-red-400/30';
      default:
        return 'bg-neutral-700/10 text-white border border-neutral-700/30';
    }
  };

  // 8. LOADING STATE
  if (loading && artikel.length === 0 && !mitglied) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium tracking-wide font-oswald uppercase text-neutral-400">
          Shop wird geladen...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans pb-32">
      {/* HEADER BAR */}
      <div className="border-b border-border bg-[#080808] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="text-primary w-8 h-8" />
            <div>
              <h1 className="text-2xl font-oswald uppercase tracking-wide leading-none">Vereinsshop</h1>
              <p className="text-xs text-neutral-400 mt-1">Kleidungsbestellungen für Narrenzunft Frommern</p>
            </div>
          </div>

          {/* MAIN TABS */}
          {!showCheckout && !checkoutSuccess && (
            <div className="flex bg-neutral-900 border border-border p-1 rounded-xl">
              <button
                onClick={() => {
                  setActiveTab('shop');
                  setShowCart(false);
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'shop'
                    ? 'bg-primary text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Katalog
              </button>
              <button
                onClick={() => {
                  setActiveTab('bestellungen');
                  setShowCart(false);
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium relative transition-all ${
                  activeTab === 'bestellungen'
                    ? 'bg-primary text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Meine Bestellungen
                {meineBestellungen.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-neutral-800 text-neutral-300 rounded-full">
                    {meineBestellungen.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {/* 10. ERROR STATE */}
        {error && (
          <div className="bg-red-950 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex items-start justify-between">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Fehler aufgetreten</p>
                <p className="text-xs mt-1 text-red-300">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* FEEDBACK BANNER */}
        {successMessage && (
          <div className="bg-emerald-950/80 border border-emerald-500/30 text-emerald-200 p-4 rounded-xl mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-emerald-400" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* SUCCESS STATE */}
        {/* ======================================================== */}
        {checkoutSuccess ? (
          <div className="max-w-md mx-auto text-center py-12 px-4 bg-card border border-border rounded-xl mt-8">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-oswald uppercase tracking-wide mb-2">Bestellung abgeschickt!</h2>
            <p className="text-neutral-400 text-sm mb-6">
              Vielen Dank für deine Bestellung. Sie wurde erfasst und wird von unseren Zeugwarten geprüft.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setCheckoutSuccess(false);
                  setActiveTab('shop');
                }}
                className="w-full bg-primary text-white py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Weiter einkaufen
              </button>
              <button
                onClick={() => {
                  setCheckoutSuccess(false);
                  setActiveTab('bestellungen');
                }}
                className="w-full bg-neutral-800 text-white border border-border py-2.5 rounded-xl font-medium text-sm hover:bg-neutral-700 transition-colors"
              >
                Meine Bestellungen ansehen
              </button>
            </div>
          </div>
        ) : showCheckout ? (
          /* ======================================================== */
          /* 6. CHECKOUT VIEW */
          /* ======================================================== */
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl overflow-hidden mt-2">
            <div className="border-b border-border p-4 bg-neutral-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-primary w-5 h-5" />
                <h2 className="font-oswald uppercase tracking-wide text-lg">Kasse &amp; Bestellung</h2>
              </div>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Grouped items by member */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Artikelübersicht</h3>
                {cartGroupedByMember.map((group, gIdx) => (
                  <div key={gIdx} className="bg-neutral-900/40 border border-border/60 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3 border-b border-border/40 pb-2">
                      <User className="w-4 h-4 text-primary" />
                      <div className="text-sm font-semibold">{group.name}</div>
                      {group.sparte && (
                        <span className="text-[10px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary">
                          {group.sparte}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex justify-between items-center text-sm py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-neutral-400 font-mono text-xs">{item.menge}x</span>
                            <span className="truncate">{item.artikel_name}</span>
                            <span className="text-xs bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">
                              {item.groesse}
                            </span>
                          </div>
                          <div className="font-semibold text-neutral-200">
                            {(item.einzelpreis * item.menge).toFixed(2)} €
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Note field */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Notiz an den Zeugwart (optional)
                </label>
                <textarea
                  value={checkoutNote}
                  onChange={(e) => setCheckoutNote(e.target.value)}
                  placeholder="Besondere Wünsche, Anmerkungen oder Fragen..."
                  className="w-full h-24 bg-neutral-900 border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary/50 text-white"
                />
              </div>

              {/* Payment selection */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                  Zahlungsart wählen
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'Ueberweisung'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-neutral-900/30 hover:bg-neutral-900/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="Ueberweisung"
                      checked={paymentMethod === 'Ueberweisung'}
                      onChange={() => setPaymentMethod('Ueberweisung')}
                      className="sr-only"
                    />
                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'Ueberweisung' ? 'text-primary' : 'text-neutral-400'}`} />
                    <span className="text-xs font-medium">Überweisung</span>
                  </label>

                  <label
                    className={`border rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                      paymentMethod === 'Bar'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-neutral-900/30 hover:bg-neutral-900/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value="Bar"
                      checked={paymentMethod === 'Bar'}
                      onChange={() => setPaymentMethod('Bar')}
                      className="sr-only"
                    />
                    <Wallet className={`w-6 h-6 ${paymentMethod === 'Bar' ? 'text-primary' : 'text-neutral-400'}`} />
                    <span className="text-xs font-medium">Barzahlung</span>
                  </label>
                </div>
              </div>

              {/* Order limit note */}
              <div className="bg-neutral-900 border border-border p-3.5 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-400 leading-normal">
                  Die Bestellfrist für diese Sammelbestellung endet am{' '}
                  <span className="text-neutral-200 font-semibold">15.09.2026</span>. Deine Bestellung ist
                  verbindlich.
                </p>
              </div>

              {/* Total amount & Action button */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-400 uppercase tracking-wider">Gesamtsumme</p>
                  <p className="text-3xl font-oswald uppercase tracking-wide text-primary">
                    {totalCartAmount.toFixed(2)} €
                  </p>
                </div>
                <button
                  onClick={handleCheckoutSubmit}
                  disabled={loading}
                  className="bg-primary text-white font-medium px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                  Bestellung abschicken
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'shop' ? (
          /* ======================================================== */
          /* CATALOG VIEW (SHOPPING) */
          /* ======================================================== */
          <>
            {/* FILTER & SEARCH ROW */}
            <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {['Alle', 'Erwachsene', 'Garde', 'Kinder'].map((kat) => (
                  <button
                    key={kat}
                    onClick={() => setSelectedKategorie(kat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors ${
                      selectedKategorie === kat
                        ? 'bg-primary text-white'
                        : 'bg-neutral-900 border border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {kat}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>

            {/* 9. EMPTY STATE (NO ARTICLES) */}
            {filteredArtikel.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <Package className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Artikel verfügbar</h3>
                <p className="text-neutral-400 text-sm mt-1">
                  Es konnten keine Artikel für deine Auswahl gefunden werden.
                </p>
              </div>
            ) : (
              /* 4. ARTICLE CARD UI (GRID) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArtikel.map((art) => {
                  const selectedSize = selectedSizes[art.id] || '';
                  const qty = quantities[art.id] || 1;
                  const currentRecipient = fuerWenSelections[art.id] || mitglied?.id;

                  // Find if article is already in cart for current selected recipient and size
                  const inCartCount = warenkorb
                    .filter(item => item.artikel_id === art.id && item.mitglied_id === currentRecipient)
                    .reduce((total, item) => total + item.menge, 0);

                  return (
                    <div
                      key={art.id}
                      className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between transition-all hover:border-primary/20"
                    >
                      <div>
                        {/* Top Badge & Status info */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] bg-neutral-900 border border-border px-2 py-0.5 rounded-full text-neutral-400 font-medium uppercase tracking-wider">
                            {art.kategorie || 'Allgemein'}
                          </span>
                          {inCartCount > 0 && (
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-3 h-3" /> Im Warenkorb ({inCartCount})
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-lg font-oswald uppercase tracking-wide font-bold line-clamp-1">
                          {art.name}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 min-h-[2rem]">
                          {art.beschreibung || 'Keine Beschreibung verfügbar.'}
                        </p>

                        {/* Sparte restriction details */}
                        {art.sparten && art.sparten.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] text-primary uppercase font-bold tracking-wide">
                              Nur für Sparte:
                            </span>
                            {art.sparten.map((sp) => (
                              <span
                                key={sp}
                                className="text-[9px] bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded text-primary"
                              >
                                {getSparteName(sp)}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Size Selection */}
                        {art.groessen && art.groessen.length > 0 && (
                          <div className="mt-4">
                            <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                              Größe wählen:
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {art.groessen.map((size) => (
                                <button
                                  key={size}
                                  onClick={() =>
                                    setSelectedSizes((prev) => ({ ...prev, [art.id]: size }))
                                  }
                                  className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
                                    selectedSize === size
                                      ? 'bg-primary text-white border-primary'
                                      : 'bg-neutral-900 border-border hover:bg-neutral-800 text-neutral-400 hover:text-white'
                                  }`}
                                >
                                  {size}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Fuer Wen Selector (Self + Family members) */}
                        <div className="mt-4">
                          <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                            Für wen bestellen?
                          </label>
                          <select
                            value={currentRecipient}
                            onChange={(e) =>
                              setFuerWenSelections((prev) => ({ ...prev, [art.id]: e.target.value }))
                            }
                            className="w-full bg-neutral-900 border border-border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary/50"
                          >
                            <option value={mitglied?.id}>Ich selbst</option>
                            {familienMitglieder.map((fam) => (
                              <option key={fam.id} value={fam.id}>
                                {fam.vorname} {fam.nachname} ({getSparteName(fam.sparte_id) || 'Keine Sparte'})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Price, Quantity & Add to Cart button */}
                      <div className="mt-5 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-oswald uppercase tracking-wide text-primary font-bold">
                            {(art.preis || 0).toFixed(2)} €
                          </span>

                          {/* - / + Quantity controllers */}
                          <div className="flex items-center bg-neutral-900 border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [art.id]: Math.max(1, (prev[art.id] || 1) - 1)
                                }))
                              }
                              className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-semibold font-mono">{qty}</span>
                            <button
                              onClick={() =>
                                setQuantities((prev) => ({
                                  ...prev,
                                  [art.id]: (prev[art.id] || 1) + 1
                                }))
                              }
                              className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddToCart(art)}
                          className="w-full bg-primary text-white font-medium py-2 rounded-xl text-xs hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ShoppingCart className="w-4 h-4" /> In den Warenkorb
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ======================================================== */
          /* 7. MEINE BESTELLUNGEN VIEW */
          /* ======================================================== */
          <div className="space-y-4">
            <h2 className="text-lg font-oswald uppercase tracking-wide border-b border-border pb-2 flex items-center gap-2">
              <ShoppingBag className="text-primary w-5 h-5" />
              Bisherige Bestellungen
            </h2>

            {/* 9. EMPTY STATE (NO ORDERS) */}
            {meineBestellungen.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <ShoppingBag className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Noch keine Bestellungen</h3>
                <p className="text-neutral-400 text-sm mt-1">
                  Du hast bisher noch keine Bestellungen in diesem Shop aufgegeben.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {meineBestellungen.map((ord) => {
                  const isExpanded = expandedOrders[ord.id];
                  const orderDate = ord.created_date ? new Date(ord.created_date).toLocaleDateString('de-DE') : 'Unbekannt';
                  const positionenCount = ord.positionen ? ord.positionen.reduce((t, i) => t + i.menge, 0) : 0;

                  return (
                    <div key={ord.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      {/* Order Header / Summary card */}
                      <div
                        onClick={() => toggleOrderExpand(ord.id)}
                        className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-900/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">Bestellung vom {orderDate}</span>
                            <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-border">
                              Saison {ord.saison || '2026'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400">
                            {positionenCount} {positionenCount === 1 ? 'Artikel' : 'Artikel'} · Gesamtsumme:{' '}
                            <span className="text-primary font-bold">{(ord.gesamtbetrag || 0).toFixed(2)} €</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getStatusBadgeClass(ord.status)}`}>
                            {ord.status}
                          </span>
                          <ChevronRight
                            className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </div>

                      {/* Collapsible Order Position list */}
                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-neutral-900/30 space-y-4">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                              Bestellte Positionen
                            </h4>
                            {(ord.positionen || []).map((pos, posIdx) => (
                              <div key={posIdx} className="flex justify-between items-start text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{pos.artikel_name}</span>
                                    <span className="bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] text-neutral-300">
                                      {pos.groesse}
                                    </span>
                                  </div>
                                  <p className="text-neutral-400 text-[10px] mt-0.5">
                                    Für: {pos.fremdname ? pos.fremdname : 'Ich selbst'}
                                    {pos.sparte && ` (${pos.sparte})`} · Menge: {pos.menge}
                                  </p>
                                </div>
                                <div className="font-semibold">
                                  {(pos.einzelpreis * pos.menge).toFixed(2)} €
                                </div>
                              </div>
                            ))}
                          </div>

                          {ord.notiz && (
                            <div className="bg-neutral-900 border border-border/50 p-2.5 rounded-lg">
                              <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                                Deine Notiz
                              </h4>
                              <p className="text-xs text-neutral-300">{ord.notiz}</p>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 text-xs text-neutral-400">
                            <div>
                              Zahlungsart: <span className="text-neutral-200 font-semibold">{ord.zahlungsart === 'Bar' ? 'Barzahlung' : 'Überweisung'}</span>
                            </div>

                            {ord.status === 'Offen' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Möchtest du diese Bestellung wirklich stornieren?')) {
                                    handleCancelOrder(ord.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-400 font-medium flex items-center gap-1 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" /> Bestellung stornieren
                              </button>
                            )}
                          </div>
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

      {/* ======================================================== */}
      {/* 5. CART (STICKY BOTTOM BAR + EXPANDABLE MODAL) */}
      {/* ======================================================== */}
      {warenkorb.length > 0 && !showCheckout && !checkoutSuccess && (
        <>
          {/* Bottom Sticky bar */}
          <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 bg-card border-t border-border p-3 flex items-center justify-between z-40 max-w-7xl mx-auto shadow-2xl rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-primary/10 border border-primary/30 rounded-xl flex items-center justify-center text-primary">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-[#080808]">
                  {totalCartCount}
                </span>
              </div>
              <div>
                <p className="text-xs text-neutral-400 leading-none">Dein Warenkorb</p>
                <p className="text-base font-oswald uppercase tracking-wide text-primary font-bold mt-1">
                  {totalCartAmount.toFixed(2)} €
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold uppercase tracking-wide px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              Warenkorb ansehen <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cart Drawer / Dialog Backdrop */}
          {showCart && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="bg-card border border-border w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                {/* Drawer header */}
                <div className="p-4 border-b border-border bg-neutral-900/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="text-primary w-5 h-5" />
                    <h3 className="font-oswald uppercase tracking-wide text-lg">Warenkorb</h3>
                  </div>
                  <button
                    onClick={() => setShowCart(false)}
                    className="text-neutral-400 hover:text-white bg-neutral-900 p-1.5 rounded-lg border border-border/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer scroll content */}
                <div className="p-4 overflow-y-auto space-y-4 divide-y divide-border/40">
                  {warenkorb.map((item, index) => {
                    const recipientInfo = getMitgliedInfo(item.mitglied_id);
                    return (
                      <div key={index} className="flex justify-between items-start gap-4 pt-4 first:pt-0">
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.artikel_name}</p>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-400">
                            <span className="bg-neutral-900 px-1.5 py-0.5 rounded border border-border">
                              Größe: {item.groesse}
                            </span>
                            <span className="bg-neutral-900 px-1.5 py-0.5 rounded border border-border">
                              Für: {recipientInfo ? recipientInfo.name : item.fremdname || 'Ich selbst'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-primary mt-1">
                            {item.einzelpreis.toFixed(2)} €
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center bg-neutral-900 border border-border rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateCartItemQuantity(index, -1)}
                              className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-semibold font-mono">{item.menge}</span>
                            <button
                              onClick={() => updateCartItemQuantity(index, 1)}
                              className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeCartItem(index)}
                            className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Drawer Footer summary */}
                <div className="p-4 border-t border-border bg-neutral-900/50 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Gesamtsumme:</span>
                    <span className="text-2xl font-oswald uppercase tracking-wide text-primary font-bold">
                      {totalCartAmount.toFixed(2)} €
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setShowCart(false)}
                      className="w-full bg-neutral-800 text-white border border-border py-2.5 rounded-xl text-xs font-medium hover:bg-neutral-700 transition-colors"
                    >
                      Weiter einkaufen
                    </button>
                    <button
                      onClick={() => {
                        setShowCart(false);
                        setShowCheckout(true);
                      }}
                      className="w-full bg-primary text-white py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                    >
                      Zur Kasse
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
