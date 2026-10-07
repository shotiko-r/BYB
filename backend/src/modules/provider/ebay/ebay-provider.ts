import type { OfferProvenance } from '../provenance.js';
import { z } from 'zod';
import type { ProductProvider, SearchIntent, ProviderProduct, ProviderSearchResult } from '../types.js';
import type { EbayBrowseClient } from './client.js';
import { MARKETPLACES } from './config.js';
import { EbayError } from './http.js';
import { keywords, mapItem } from './mapping.js';

const searchSchema = z.object({ itemSummaries: z.array(z.unknown()).max(20).optional(), total: z.number().int().nonnegative() });
export class EbayProvider implements ProductProvider {
  readonly code = 'ebay'; readonly name = 'eBay'; readonly supportedMarkets = Object.keys(MARKETPLACES);
  readonly provenance: OfferProvenance;
  constructor(private readonly client: EbayBrowseClient, environment: 'production' | 'sandbox' = 'production') {
    this.provenance = { version: 1, provider: 'ebay', mode: 'real', environment };
  }
  async search(intent: SearchIntent, marketCode: string): Promise<ProviderSearchResult> {
    const marketplace = MARKETPLACES[marketCode];
    if (!marketplace) throw new EbayError('request');
    const query = keywords(intent);
    const result = searchSchema.safeParse(await this.client.get('/item_summary/search', marketplace,
      { q: query, limit: '20', filter: 'buyingOptions:{FIXED_PRICE}' }));
    if (!result.success) throw new EbayError('malformed');
    const products: ProviderProduct[] = [];
    for (const item of result.data.itemSummaries ?? []) {
      let product = mapItem(item);
      // At most five detail requests, sequential, only when filtering needs aspects.
      if (product && products.length < 5 && (intent.brand || (Array.isArray(intent.filters?.features) && intent.filters.features.length))) {
        try {
          const detail = z.record(z.unknown()).safeParse(await this.client.get(`/item/${encodeURIComponent(product.externalId)}`, marketplace));
          if (detail.success && detail.data.itemId === product.externalId) {
            product = mapItem({ ...(item as Record<string, unknown>), ...detail.data,
              categories: (item as Record<string, unknown>).categories }) ?? product;
          }
        }
        catch { /* Summary still useful; missing evidence never satisfies feature filters. */ }
      }
      if (product) products.push(product);
    }
    return { products, total: products.length, query };
  }
  async getProduct(externalId: string, marketCode: string): Promise<ProviderProduct | null> {
    const marketplace = MARKETPLACES[marketCode];
    if (!marketplace) throw new EbayError('request');
    try { return mapItem(await this.client.get(`/item/${encodeURIComponent(externalId)}`, marketplace)); }
    catch (error) { if (error instanceof EbayError && error.status === 404) return null; throw error; }
  }
}
