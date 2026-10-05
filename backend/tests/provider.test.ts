import { describe, it, expect, beforeAll } from 'vitest';
import { AmazonProvider, TemuProvider, AliExpressProvider, EbayProvider } from '../src/modules/provider/mock/index.js';
import { providerRegistry } from '../src/modules/provider/registry.js';
import type { SearchIntent } from '@byb/shared/types';

const providers = [
  new AmazonProvider(),
  new TemuProvider(),
  new AliExpressProvider(),
  new EbayProvider(),
];

beforeAll(() => {
  // Register providers for registry tests
  providers.forEach((p) => {
    try {
      providerRegistry.register(p);
    } catch {
      // Already registered
    }
  });
});

describe.each(providers)('%s', (provider) => {
  it('returns products for empty search', async () => {
    const result = await provider.search({ query: '' }, 'GE');
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.total).toBe(result.products.length);
  });

  it('filters by query', async () => {
    const result = await provider.search({ query: 'sony' }, 'GE');
    expect(result.products.every((p) => p.name.toLowerCase().includes('sony') || p.brand?.toLowerCase().includes('sony'))).toBe(true);
  });

  it('filters by category', async () => {
    const result = await provider.search({ category: 'headphones' }, 'GE');
    expect(result.products.every((p) => p.category === 'headphones')).toBe(true);
  });

  it('filters by brand', async () => {
    const result = await provider.search({ brand: 'apple' }, 'GE');
    expect(result.products.every((p) => p.brand?.toLowerCase() === 'apple')).toBe(true);
  });

  it('filters by max price', async () => {
    const result = await provider.search({ maxPrice: 30000 }, 'GE');
    expect(result.products.every((p) => p.priceAmount <= 30000)).toBe(true);
  });

  it('filters by min price', async () => {
    const result = await provider.search({ minPrice: 50000 }, 'GE');
    expect(result.products.every((p) => p.priceAmount >= 50000)).toBe(true);
  });

  it('returns empty for non-matching query', async () => {
    const result = await provider.search({ query: 'nonexistentproductxyz' }, 'GE');
    expect(result.products.length).toBe(0);
    expect(result.total).toBe(0);
  });

  it('getProduct returns product by externalId', async () => {
    const searchResult = await provider.search({ query: '' }, 'GE');
    if (searchResult.products.length > 0) {
      const product = await provider.getProduct(searchResult.products[0].externalId, 'GE');
      expect(product).not.toBeNull();
      expect(product?.externalId).toBe(searchResult.products[0].externalId);
    }
  });

  it('getProduct returns null for non-existent id', async () => {
    const product = await provider.getProduct('NONEXISTENT', 'GE');
    expect(product).toBeNull();
  });

  it('has supported markets', () => {
    expect(provider.supportedMarkets).toContain('GE');
    expect(provider.supportedMarkets).toContain('AM');
    expect(provider.supportedMarkets).toContain('AZ');
  });
});

describe('Provider Registry', () => {
  it('registers all providers', () => {
    const all = providerRegistry.getAll();
    expect(all.length).toBe(4);
    expect(all.map((p) => p.code).sort()).toEqual(['aliexpress', 'amazon', 'ebay', 'temu']);
  });

  it('gets providers for market', () => {
    const geProviders = providerRegistry.getForMarket('GE');
    expect(geProviders.length).toBe(4);
  });
});