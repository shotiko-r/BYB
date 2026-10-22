import type { OfferProvenance } from '../provenance.js';
import { z } from 'zod';
import type { ProductProvider, SearchIntent, ProviderProduct, ProviderSearchResult } from '../types.js';
import type { EbayBrowseClient } from './client.js';
import { MARKETPLACES } from './config.js';
import { EbayError } from './http.js';
import { keywords, mapItem } from './mapping.js';
import { itemGroupId, normalizeVariations } from './variations.js';
import type { VariationGroup } from '@byb/shared/types';

const searchSchema = z.object({ itemSummaries: z.array(z.unknown()).max(20).optional(), total: z.number().int().nonnegative() });
export class EbayProvider implements ProductProvider {
  readonly code = 'ebay'; readonly name = 'eBay'; readonly supportedMarkets = Object.keys(MARKETPLACES);
  readonly provenance: OfferProvenance;
  private readonly groups = new Map<string, { expiresAt: number; group: VariationGroup }>();
  constructor(private readonly client: EbayBrowseClient, environment: 'production' | 'sandbox' = 'production',
    private readonly now: () => number = Date.now) {
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
    try {
      const item = await this.client.get(`/item/${encodeURIComponent(externalId)}`, marketplace, { fieldgroups: 'PRODUCT' });
      const detail = mapItem(item, { detail: true });
      const groupId = itemGroupId(item);
      if (!detail || detail.externalId !== externalId || !groupId) return detail;
      try {
        const key = `${marketplace}:${groupId}`;
        let group = this.groups.get(key);
        if (!group || group.expiresAt <= this.now()) {
          this.groups.delete(key);
          const normalized = normalizeVariations(await this.client.get('/item/get_items_by_item_group', marketplace,
            { item_group_id: groupId }), groupId, this.now());
          if (!normalized) return { ...detail, attributes: { ...detail.attributes, variationLookupFailed: true } };
          for (const [key, entry] of this.groups) if (entry.expiresAt <= this.now()) this.groups.delete(key);
          while (this.groups.size >= 250) this.groups.delete(this.groups.keys().next().value!);
          group = { expiresAt: this.now() + 10 * 60 * 1000, group: normalized };
          this.groups.set(key, group);
        }
        return { ...detail, variationGroup: group.group };
      } catch {
        // Do not let optional variation enrichment break detail or cache a failed lookup.
        return { ...detail, attributes: { ...detail.attributes, variationLookupFailed: true } };
      }
    }
    catch (error) { if (error instanceof EbayError && error.status === 404) return null; throw error; }
  }
}
