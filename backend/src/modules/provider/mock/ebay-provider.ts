import type { ProductProvider, ProviderSearchResult, SearchIntent } from '../types.js';
import { getMockProducts } from './mock-data.js';

export class EbayProvider implements ProductProvider {
  readonly code = 'ebay';
  readonly name = 'eBay';
  readonly supportedMarkets = ['US', 'CA', 'UK', 'DE', 'FR', 'GE', 'AM', 'AZ'];

  // eslint-disable-next-line @typescript-eslint/require-await
  async search(intent: SearchIntent, _marketCode: string): Promise<ProviderSearchResult> {
    const products = getMockProducts(this.code);
    let filtered = products;

    if (intent.query) {
      const query = intent.query.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query) ||
          p.model?.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query)
      );
    }

    if (intent.category) {
      filtered = filtered.filter((p) => p.category === intent.category);
    }

    if (intent.brand) {
      filtered = filtered.filter((p) => p.brand?.toLowerCase() === intent.brand?.toLowerCase());
    }

    if (intent.maxPrice) {
      filtered = filtered.filter((p) => p.priceAmount <= intent.maxPrice!);
    }

    if (intent.minPrice) {
      filtered = filtered.filter((p) => p.priceAmount >= intent.minPrice!);
    }

    return {
      products: filtered,
      total: filtered.length,
      query: intent.query || '',
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getProduct(externalId: string, _marketCode: string): Promise<ProviderSearchResult['products'][0] | null> {
    const products = getMockProducts(this.code);
    return products.find((p) => p.externalId === externalId) || null;
  }
}