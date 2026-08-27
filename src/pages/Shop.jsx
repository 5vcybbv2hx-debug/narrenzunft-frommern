import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  ShoppingBag,
  Shirt,
  Search,
  ExternalLink,
  Package,
  Check,
  X,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  User,
  Wallet
} from 'lucide-react';

const ALLE_KATEGORIEN = ['Alle', 'Erwachsene', 'Garde', 'Kinder', 'Ersatzteile', 'Sonstiges'];

export default function Shop() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [wixProducts, setWixProducts] = useState([]);
  const [mitglied, setMitglied] = useState(null);
  const [meineBestellungen, setMeineBestellungen] = useState([]);

  const [activeTab, setActiveTab] = useState('shop');
  const [selectedKategorie, setSelectedKategorie] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrders, setExpandedOrders] = useState({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Wix-Produkte über Backend-Function laden
      const wixData = await base44.functions.invoke("getWixProducts", {});
      if (wixData && wixData.success) {
        setWixProducts(wixData.products || []);
      } else {
        setError(wixData?.error || 'Wix-Produkte konnten nicht geladen werden');
      }

      // Mitglied laden (für "Meine Bestellungen")
      try {
        const me = await base44.auth.me();
        if (me) {
          const own = await base44.entities.Mitglied.filter({ user_id: me.id });
          const myMitglied = own && own[0];
          if (myMitglied) {
            setMitglied(myMitglied);
            const orders = await base44.entities.ShopBestellung.filter({ mitglied_id: myMitglied.id });
            setMeineBestellungen(
              (orders || []).sort((a, b) => {
                const dA = a.created_date ? new Date(a.created_date).getTime() : 0;
                const dB = b.created_date ? new Date(b.created_date).getTime() : 0;
                return dB - dA;
              })
            );
          }
        }
      } catch (e) {
        console.error('Mitglied/Bestellungen laden fehlgeschlagen:', e);
      }
    } catch (err) {
      console.error('Error loading shop data:', err);
      setError(err.message || 'Fehler beim Laden der Daten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProducts = useMemo(() => {
    return wixProducts.filter((p) => {
      if (selectedKategorie !== 'Alle' && p.kategorie !== selectedKategorie) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        if (!p.name?.toLowerCase().includes(q) && !p.ribbon?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [wixProducts, selectedKategorie, searchQuery]);

  const toggleOrderExpand = (orderId) => setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Offen': return 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30';
      case 'Bezahlt': return 'bg-green-400/10 text-green-400 border border-green-400/30';
      case 'In Bestellung': return 'bg-blue-400/10 text-blue-400 border border-blue-400/30';
      case 'Geliefert': return 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30';
      case 'Abgeholt': return 'bg-teal-400/10 text-teal-400 border border-teal-400/30';
      case 'Abgeschlossen': return 'bg-secondary text-muted-foreground border border-border';
      case 'Storniert': return 'bg-red-400/10 text-red-400 border border-red-400/30';
      default: return 'bg-secondary text-foreground border border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium tracking-wide font-oswald uppercase text-neutral-400">Shop wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans pb-20">
      {/* Header */}
      <div className="border-b border-border bg-[#080808] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="text-primary w-8 h-8" />
            <div>
              <h1 className="text-2xl font-oswald uppercase tracking-wide leading-none">Vereinsshop</h1>
              <p className="text-xs text-neutral-400 mt-1">Zunftbekleidung online bestellen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-secondary border border-border p-1 rounded-xl">
              <button onClick={() => setActiveTab('shop')} className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium transition-all ${activeTab === 'shop' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'}`}>Katalog</button>
              {meineBestellungen.length > 0 && (
                <button onClick={() => setActiveTab('bestellungen')} className={`px-4 py-2 min-h-[40px] rounded-lg text-sm font-medium relative transition-all ${activeTab === 'bestellungen' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-white'}`}>
                  Meine Bestellungen
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-secondary text-muted-foreground rounded-full">{meineBestellungen.length}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && (
          <div className="bg-red-950 border border-red-500/30 text-red-200 p-4 rounded-xl mb-6 flex items-start justify-between">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Fehler aufgetreten</p>
                <p className="text-xs mt-1 text-red-300">{error}</p>
              </div>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-white p-2 -mr-1"><X className="w-5 h-5" /></button>
          </div>
        )}

        {activeTab === 'shop' ? (
          <>
            {/* Info Banner */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
              <ShoppingBag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white font-medium">Online-Shop der Narrenzunft Frommern</p>
                <p className="text-xs text-neutral-400 mt-1">
                  Die Bestellung und Zahlung erfolgen über unseren Wix-Online-Shop.
                  Klicke auf "Jetzt bestellen" um zum Produkt zu gelangen.
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {ALLE_KATEGORIEN.map((kat) => (
                  <button key={kat} onClick={() => setSelectedKategorie(kat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors ${selectedKategorie === kat ? 'bg-primary text-white' : 'bg-secondary border border-border hover:bg-border text-muted-foreground hover:text-foreground'}`}>
                    {kat}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input type="text" placeholder="Suchen..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary/50" />
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <Package className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Artikel verfügbar</h3>
                <p className="text-neutral-400 text-sm mt-1">
                  {wixProducts.length === 0
                    ? 'Es sind aktuell keine Produkte im Online-Shop.'
                    : 'Keine Artikel für deine Auswahl gefunden.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:border-primary/20">
                    {/* Product Image / Placeholder */}
                    <div className="aspect-square bg-secondary flex items-center justify-center relative">
                      {product.media && product.media.length > 0 ? (
                        <img src={product.media[0]?.url || product.media[0]?.src} alt={product.name}
                          className="w-full h-full object-cover" />
                      ) : (
                        <Shirt className="w-16 h-16 text-neutral-700" />
                      )}
                      {product.ribbon && (
                        <span className="absolute top-3 left-3 bg-primary text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full tracking-wider">
                          {product.ribbon}
                        </span>
                      )}
                      {!product.isInStock && (
                        <span className="absolute top-3 right-3 bg-card border border-red-500/40 text-red-400 text-[10px] font-bold uppercase px-2 py-1 rounded-full tracking-wider">
                          Ausverkauft
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <div>
                        <span className="text-[10px] bg-secondary border border-border px-2 py-0.5 rounded-full text-muted-foreground font-medium uppercase tracking-wider">
                          {product.kategorie || 'Allgemein'}
                        </span>
                        <h3 className="text-lg font-oswald uppercase tracking-wide font-bold mt-2 line-clamp-1">{product.name}</h3>
                        <p className="text-xs text-neutral-400 mt-1 min-h-[1rem]">
                          {product.sku ? `Art.-Nr.: ${product.sku}` : ''}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-2xl font-oswald font-bold text-primary">
                          {product.formattedPrice}
                        </span>
                        <a href={product.url} target="_blank" rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all ${product.isInStock
                            ? 'bg-primary text-white hover:bg-primary/90'
                            : 'bg-secondary text-muted-foreground cursor-not-allowed pointer-events-none'}`}>
                          {product.isInStock ? 'Bestellen' : 'Nicht verfügbar'}
                          {product.isInStock && <ExternalLink className="w-4 h-4" />}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Meine Bestellungen (Legacy in-app orders) */
          <>
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-neutral-400" />
                <h2 className="font-oswald uppercase tracking-wide text-lg">Meine Bestellungen (intern)</h2>
              </div>
              <p className="text-xs text-neutral-400">
                Hier siehst du deine früheren Bestellungen aus dem internen Bestellsystem.
                Neue Bestellungen erfolgen ab sofort über den Online-Shop.
              </p>
            </div>

            {meineBestellungen.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border rounded-xl">
                <ShoppingCart className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Bestellungen</h3>
                <p className="text-neutral-400 text-sm mt-1">Du hast noch keine Bestellungen aufgegeben.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {meineBestellungen.map((order) => {
                  const isExpanded = expandedOrders[order.id];
                  const total = order.gesamtbetrag || 0;
                  const positions = order.positionen || [];
                  const isPaid = order.status === 'Bezahlt' || order.status === 'Abgeschlossen';
                  return (
                    <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button onClick={() => toggleOrderExpand(order.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${isPaid ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                            {isPaid ? <Check className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-yellow-400" />}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold">
                              Bestellung vom {order.created_date ? new Date(order.created_date).toLocaleDateString('de-DE') : 'Unbekannt'}
                            </p>
                            <p className="text-xs text-neutral-400">{positions.length} Artikel · {total.toFixed(2)} €</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider ${getStatusBadgeClass(order.status)}`}>
                            {order.status || 'Offen'}
                          </span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
                          {order.zahlungsart && (
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              <Wallet className="w-3.5 h-3.5" />
                              Zahlung: <span className="text-white font-medium">{order.zahlungsart}</span>
                            </div>
                          )}
                          {positions.map((pos, idx) => (
                            <div key={idx} className="flex items-start justify-between text-sm py-2 border-b border-border/40 last:border-0">
                              <div>
                                <p className="font-medium">{pos.artikel_name || pos.name || 'Artikel'}</p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  {pos.menge}× · {pos.groesse || 'Unisize'} · {(pos.einzelpreis || 0).toFixed(2)} €
                                  {pos.fremdname ? ` · für ${pos.fremdname}` : ''}
                                  {pos.sparte ? ` · ${pos.sparte}` : ''}
                                </p>
                              </div>
                              <span className="text-white font-medium">{((pos.einzelpreis || 0) * (pos.menge || 1)).toFixed(2)} €</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-2 border-t border-border">
                            <span className="text-sm font-semibold text-neutral-400">Gesamt</span>
                            <span className="text-lg font-oswald font-bold text-primary">{total.toFixed(2)} €</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
