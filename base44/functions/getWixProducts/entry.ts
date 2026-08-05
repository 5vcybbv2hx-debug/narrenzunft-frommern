import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const SHOP_URL = 'https://www.narrenzunft-frommern.de/category/all-products';
    const PRODUCT_BASE_URL = 'https://www.narrenzunft-frommern.de/product-page';

    const response = await fetch(SHOP_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NarrenzunftApp/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Shop-Seite konnte nicht geladen werden (HTTP ${response.status})`);
    }

    const html = await response.text();

    const productsMatch = html.match(/"products_default_[^"]*":\{"list":(\[.*?\]),"totalCount":(\d+)\}/);

    let products: any[] = [];
    let totalCount = 0;

    if (productsMatch) {
      try {
        products = JSON.parse(productsMatch[1]);
        totalCount = parseInt(productsMatch[2], 10);
      } catch (e) {
        throw new Error('Produkt-Daten konnten nicht geparst werden');
      }
    }

    const normalizedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      formattedPrice: p.formattedPrice || `${p.price},00€`,
      comparePrice: p.comparePrice || 0,
      sku: p.sku || '',
      productType: p.productType || 'physical',
      ribbon: p.ribbon || '',
      urlPart: p.urlPart || '',
      url: p.urlPart ? `${PRODUCT_BASE_URL}/${p.urlPart}` : '',
      isInStock: p.isInStock !== false,
      inventoryStatus: p.inventory?.status || 'in_stock',
      currency: p.currency || 'EUR',
      media: p.media || [],
      options: p.options || [],
      description: '',
      kategorie: mapKategorie(p.name, p.ribbon),
      groessen: [],
      sparten: [],
    }));

    return Response.json({
      success: true,
      products: normalizedProducts,
      totalCount,
      source: 'scrape',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('getWixProducts error:', error);
    return Response.json({
      success: false,
      products: [],
      totalCount: 0,
      error: error.message || 'Unbekannter Fehler beim Laden der Wix-Produkte',
    });
  }
});

function mapKategorie(name: string, ribbon: string): string {
  const lowerName = (name || '').toLowerCase();
  const lowerRibbon = (ribbon || '').toLowerCase();

  if (lowerName.includes('garde') || lowerRibbon.includes('garde')) return 'Garde';
  if (lowerName.includes('kind') || lowerRibbon.includes('kind')) return 'Kinder';
  if (lowerName.includes('ersatz') || lowerRibbon.includes('ersatz')) return 'Ersatzteile';

  return 'Erwachsene';
}
