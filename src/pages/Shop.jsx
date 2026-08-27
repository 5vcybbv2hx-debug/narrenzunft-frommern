import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Shirt,
  Search,
  ExternalLink,
  Package,
  X,
  AlertCircle,
  ShoppingBag,
  Store,
} from 'lucide-react';

const ALLE_KATEGORIEN = ['Alle', 'Erwachsene', 'Garde', 'Kinder', 'Ersatzteile', 'Sonstiges'];
const WIX_SHOP_URL = 'https://www.narrenzunft-frommern.de/category/all-products';

export default function Shop() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wixProducts, setWixProducts] = useState([]);
  const [selectedKategorie, setSelectedKategorie] = useState('Alle');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const wixData = await base44.functions.invoke("getWixProducts", {});
        if (wixData && wixData.success) {
          setWixProducts(wixData.products || []);
        } else {
          setError(wixData?.error || 'Produkte konnten nicht geladen werden');
        }
      } catch (err) {
        console.error('Shop laden fehlgeschlagen:', err);
        setError(err.message || 'Fehler beim Laden der Produkte.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 border-[3px] border-border border-t-primary rounded-full animate-spin" />
        <p className="mt-4 text-sm font-medium tracking-wide font-oswald uppercase text-muted-foreground">Shop wird geladen…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-20">
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="text-primary w-8 h-8" />
            <div>
              <h1 className="text-2xl font-oswald uppercase tracking-wide leading-none">Vereinsshop</h1>
              <p className="text-xs text-muted-foreground mt-1">Zunftbekleidung online bestellen</p>
            </div>
          </div>
          <a href={WIX_SHOP_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            <Store className="w-4 h-4" />
            Zum Wix-Shop
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl mb-6 flex items-start justify-between">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">Fehler aufgetreten</p>
                <p className="text-xs mt-1 opacity-80">{error}</p>
              </div>
            </div>
            <button onClick={() => setError(null)} className="shrink-0 p-2 -mr-1 hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <ShoppingBag className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground font-medium">Online-Shop der Narrenzunft Frommern</p>
            <p className="text-xs text-muted-foreground mt-1">
              Alle Bestellungen und Zahlungen werden direkt über unseren Wix-Online-Shop abgewickelt.
              Klicke auf einen Artikel, um direkt zum Produkt zu gelangen.
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
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Suchen…" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-xl">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-oswald uppercase tracking-wide text-lg">Keine Artikel verfügbar</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {wixProducts.length === 0
                ? 'Es sind aktuell keine Produkte im Online-Shop.'
                : 'Keine Artikel für deine Auswahl gefunden.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <a key={product.id} href={product.url || WIX_SHOP_URL} target="_blank" rel="noopener noreferrer"
                className="bg-card border border-border rounded-xl overflow-hidden flex flex-col transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                {/* Product Image */}
                <div className="aspect-square bg-secondary flex items-center justify-center relative overflow-hidden">
                  {product.media && product.media.length > 0 ? (
                    <img src={product.media[0]?.url || product.media[0]?.src} alt={product.name}
                      className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Shirt className="w-16 h-16 text-muted-foreground/30" />
                  )}
                  {product.ribbon && (
                    <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                      {product.ribbon}
                    </span>
                  )}
                  {!product.isInStock && (
                    <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                      Ausverkauft
                    </span>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-oswald font-medium text-base leading-tight mb-1">{product.name}</h3>
                  {product.sku && <p className="text-xs text-muted-foreground mb-2">Art.-Nr. {product.sku}</p>}
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className={`text-lg font-oswald font-bold ${product.isInStock ? 'text-primary' : 'text-muted-foreground'}`}>
                      {product.formattedPrice || `${product.price?.toFixed(2)} €`}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${product.isInStock ? 'text-primary' : 'text-muted-foreground'}`}>
                      {product.isInStock ? 'Zum Artikel' : 'Nicht verfügbar'}
                      {product.isInStock && <ExternalLink className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Footer Link */}
        <div className="mt-8 text-center">
          <a href={WIX_SHOP_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <Store className="w-4 h-4" />
            Alle Produkte im Wix-Shop ansehen
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
