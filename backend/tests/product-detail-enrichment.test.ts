import { describe, expect, it, vi } from 'vitest';
import type { ProductWithOffers, ProviderProduct } from '@byb/shared/types';
import type { ProductProvider } from '../src/modules/provider/types.js';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { EbayProductDetailEnricher } from '../src/modules/product/detail-enrichment.js';
import { ProductService } from '../src/modules/product/service.js';
import type { ProductRepository } from '../src/modules/product/repository.js';

const realProvenance = { version: 1 as const, provider: 'ebay', mode: 'real' as const, environment: 'production' as const };
const mockProvenance = { version: 1 as const, provider: 'ebay', mode: 'mock' as const, environment: 'mock' as const };

const detail = (overrides: Partial<ProviderProduct> = {}): ProviderProduct => ({
  externalId: 'v1|1|0',
  name: 'Sony WH-1000XM5',
  description: 'Enriched description',
  brand: 'Sony',
  model: 'WH-1000XM5',
  imageUrl: 'https://i.ebayimg.com/images/detail.jpg',
  priceAmount: 1,
  currencyCode: 'USD',
  availability: 'in_stock',
  destinationUrl: 'https://www.ebay.com/itm/1',
  attributes: {
    images: ['https://i.ebayimg.com/images/detail.jpg', 'https://i.ebayimg.com/images/second.jpg'],
    aspects: [{ name: 'Color', value: 'Black' }, { name: 'Connectivity', value: 'Bluetooth' }],
    condition: 'New',
    seller: { feedbackScore: 1 },
    price: 1,
    availability: 'in_stock',
  },
  ...overrides,
});

const product = (overrides: Partial<ProductWithOffers> = {}): ProductWithOffers => ({
  id: 'product',
  slug: 'ebay-listing',
  name: 'Sony WH-1000XM5',
  description: 'Database description',
  brand: 'Sony',
  model: 'WH-1000XM5',
  categoryId: null,
  imageUrl: 'https://i.ebayimg.com/images/database.jpg',
  attributes: { source: 'ebay_browse', listingIdentity: 'v1|1|0', condition: 'Used', seller: { feedbackScore: 99 } },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  offers: [{
    id: 'offer', productId: 'product', merchantId: 'ebay-merchant', marketId: 'market', externalProductId: 'v1|1|0',
    priceAmount: 15999, currencyCode: 'USD', availability: 'unknown', shippingInfo: {},
    destinationUrl: 'https://www.ebay.com/itm/1', affiliateMetadata: {}, lastCheckedAt: '2026-01-01T00:00:00.000Z',
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    merchant: { id: 'ebay-merchant', code: 'ebay', name: 'eBay', logoUrl: null },
  }],
  ...overrides,
});

function provider(getProduct: ProductProvider['getProduct'] = vi.fn(async () => detail()), provenance = realProvenance): ProductProvider {
  return {
    code: 'ebay', name: 'eBay', supportedMarkets: ['GE'], provenance,
    search: vi.fn(async () => ({ products: [], total: 0, query: '' })),
    getProduct,
  };
}

function registryWith(value: ProductProvider | null): InMemoryProviderRegistry {
  const registry = new InMemoryProviderRegistry();
  if (value) registry.register(value);
  return registry;
}

describe('eBay product detail enrichment', () => {
  it('adds only description, images and aspects for an eligible real eBay listing', async () => {
    const getProduct = vi.fn(async () => detail());
    const original = product();
    const result = await new EbayProductDetailEnricher(registryWith(provider(getProduct))).enrich(original, 'GE');

    expect(getProduct).toHaveBeenCalledWith('v1|1|0', 'GE');
    expect(result).not.toBe(original);
    expect(result.description).toBe('Enriched description');
    expect(result.imageUrl).toBe(original.imageUrl);
    expect(result.attributes).toMatchObject({
      source: 'ebay_browse',
      listingIdentity: 'v1|1|0',
      condition: 'Used',
      seller: { feedbackScore: 99 },
      images: ['https://i.ebayimg.com/images/detail.jpg', 'https://i.ebayimg.com/images/second.jpg'],
      aspects: [{ name: 'Color', value: 'Black' }, { name: 'Connectivity', value: 'Bluetooth' }],
    });
    expect(result.attributes).not.toHaveProperty('price');
    expect(result.attributes).not.toHaveProperty('availability');
    expect(result.offers).toBe(original.offers);
    expect(result.offers[0]!.priceAmount).toBe(15999);
  });

  it('uses the detail primary image only when the database image is absent', async () => {
    const result = await new EbayProductDetailEnricher(registryWith(provider())).enrich(product({ imageUrl: null }), 'GE');
    expect(result.imageUrl).toBe('https://i.ebayimg.com/images/detail.jpg');
  });

  it('returns the original product when the provider fails or returns no detail', async () => {
    const failing = vi.fn(async () => { throw new Error('timeout'); });
    const original = product();
    expect(await new EbayProductDetailEnricher(registryWith(provider(failing))).enrich(original, 'GE')).toBe(original);

    const missing = vi.fn(async () => null);
    expect(await new EbayProductDetailEnricher(registryWith(provider(missing))).enrich(original, 'GE')).toBe(original);
  });

  it('ignores malformed detail fields without turning the request into an error', async () => {
    const malformed = detail({
      description: 42 as unknown as string,
      imageUrl: 'not-a-url',
      attributes: { images: [42, null], aspects: [{ name: 1, value: 'bad' }] },
    });
    const getProduct = vi.fn(async () => malformed);
    const original = product();
    const result = await new EbayProductDetailEnricher(registryWith(provider(getProduct))).enrich(original, 'GE');
    expect(result).toBe(original);
  });

  it('skips mock, non-eBay, missing-provider and unsupported-market products', async () => {
    const getProduct = vi.fn(async () => detail());
    const mockProduct = product();
    expect(await new EbayProductDetailEnricher(registryWith(provider(getProduct, mockProvenance))).enrich(mockProduct, 'GE'))
      .toBe(mockProduct);

    const real = new EbayProductDetailEnricher(registryWith(provider(getProduct)));
    const nonEbayProduct = product({ attributes: { source: 'admitad-feed' } });
    expect(await real.enrich(nonEbayProduct, 'GE')).toBe(nonEbayProduct);
    const unsupported = product();
    expect(await real.enrich(unsupported, 'US')).toBe(unsupported);
    const missing = product();
    expect(await new EbayProductDetailEnricher(registryWith(null)).enrich(missing, 'GE')).toBe(missing);
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('does not merge a detail response with a mismatched external ID', async () => {
    const getProduct = vi.fn(async () => detail({ externalId: 'different-listing' }));
    const original = product();
    const result = await new EbayProductDetailEnricher(registryWith(provider(getProduct))).enrich(original, 'GE');
    expect(result).toBe(original);
  });

  it('caches successful enrichment and refreshes after TTL expiry', async () => {
    let now = 0;
    const getProduct = vi.fn(async () => detail());
    const enricher = new EbayProductDetailEnricher(registryWith(provider(getProduct)), () => now, 1000);
    await enricher.enrich(product(), 'GE');
    await enricher.enrich(product(), 'GE');
    expect(getProduct).toHaveBeenCalledTimes(1);

    now = 1001;
    await enricher.enrich(product(), 'GE');
    expect(getProduct).toHaveBeenCalledTimes(2);
  });

  it('bounds the cache to the configured number of entries', async () => {
    const base = product();
    const withId = (externalProductId: string) => product({
      offers: [{ ...base.offers[0]!, externalProductId }],
    });
    const getProduct = vi.fn(async (externalId: string) => detail({ externalId }));
    const enricher = new EbayProductDetailEnricher(registryWith(provider(getProduct)), () => 0, 1000, 2);
    await enricher.enrich(withId('v1|1|0'), 'GE');
    await enricher.enrich(withId('v1|2|0'), 'GE');
    await enricher.enrich(withId('v1|3|0'), 'GE');
    await enricher.enrich(withId('v1|1|0'), 'GE');
    expect(getProduct).toHaveBeenCalledTimes(4);
  });

  it('does not cache a provider failure', async () => {
    const getProduct = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(detail());
    const enricher = new EbayProductDetailEnricher(registryWith(provider(getProduct)));
    const original = product();
    expect(await enricher.enrich(original, 'GE')).toBe(original);
    expect((await enricher.enrich(original, 'GE')).description).toBe('Enriched description');
    expect(getProduct).toHaveBeenCalledTimes(2);
  });
});

describe('ProductService detail enrichment', () => {
  it('enriches without writing to the repository', async () => {
    const repository = {
      findByIdWithOffers: vi.fn().mockResolvedValue(product()),
    } as unknown as ProductRepository;
    const getProduct = vi.fn(async () => detail());
    const service = new ProductService(repository, new EbayProductDetailEnricher(registryWith(provider(getProduct))));
    const result = await service.getProductById('product', 'market', 'GE');

    expect(repository.findByIdWithOffers).toHaveBeenCalledWith('product', 'market');
    expect(Object.keys(repository)).toEqual(['findByIdWithOffers']);
    expect(getProduct).toHaveBeenCalledWith('v1|1|0', 'GE');
    expect(result.description).toBe('Enriched description');
  });

  it('preserves 404 behavior before enrichment', async () => {
    const repository = {
      findByIdWithOffers: vi.fn().mockResolvedValue(null),
    } as unknown as ProductRepository;
    const getProduct = vi.fn(async () => detail());
    const service = new ProductService(repository, new EbayProductDetailEnricher(registryWith(provider(getProduct))));

    await expect(service.getProductById('missing', 'market', 'GE')).rejects.toThrow('not found');
    expect(getProduct).not.toHaveBeenCalled();
  });
});

describe('detail-only variation presentation data', () => {
  it('exposes normalized variations without mutating DB offer prices, identities or attributes', async () => {
    const variationGroup = { dimensions: [{ name: 'Color', values: ['Black', 'Silver'] }], variants: ['Black', 'Silver'].map((color, index) => ({
      externalProductId: `v1|1|${index}`, selections: { Color: color }, priceAmount: 10000 + index * 1000,
      currencyCode: 'USD', images: [], availability: 'in_stock' as const, destinationUrl: `https://www.ebay.com/itm/1?var=${index}`, shippingInfo: {},
    })) };
    const original = product();
    const result = await new EbayProductDetailEnricher(registryWith(provider(vi.fn(async () => detail({ variationGroup }))))).enrich(original, 'GE');
    expect(result.variationGroup).toEqual(variationGroup);
    expect(result.offers).toBe(original.offers);
    expect(result.attributes).not.toHaveProperty('variationGroup');
    expect(original).not.toHaveProperty('variationGroup');
  });
  it('does not cache failed optional group enrichment or expose its internal retry marker', async () => {
    const get = vi.fn(async () => detail({ attributes: { variationLookupFailed: true } }));
    const enricher = new EbayProductDetailEnricher(registryWith(provider(get)));
    const result = await enricher.enrich(product(), 'GE');
    await enricher.enrich(product(), 'GE');
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.attributes).not.toHaveProperty('variationLookupFailed');
  });
});
