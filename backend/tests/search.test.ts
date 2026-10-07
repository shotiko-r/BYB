import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { SearchResultSchema } from '@byb/shared/types';
import type { ProductProvider } from '../src/modules/provider/types.js';

const mocks = vi.hoisted(() => ({
  market: vi.fn(), merchants: vi.fn(), category: vi.fn(), search: vi.fn(),
  normalize: vi.fn(), persist: vi.fn(),
}));
vi.mock('../src/modules/market/repository.js', () => ({ PostgresMarketRepository: class { findByCode = mocks.market; } }));
vi.mock('../src/modules/merchant/repository.js', () => ({ PostgresMerchantRepository: class { findAll = mocks.merchants; } }));
vi.mock('../src/modules/product/repository.js', () => ({ PostgresProductRepository: class { resolveCategory = mocks.category; search = mocks.search; } }));
vi.mock('../src/modules/product/normalization.js', () => ({ ProductNormalizationService: class { normalize = mocks.normalize; persist = mocks.persist; } }));
import { registerProviders } from '../src/modules/provider/register.js';
import { SearchService } from '../src/modules/search/service.js';
import { InMemoryProviderRegistry, providerRegistry } from '../src/modules/provider/registry.js';
import { productRoutes } from '../src/modules/product/routes.js';
import { searchRoutes } from '../src/modules/search/routes.js';

const providerProduct = (currencyCode = 'USD', priceAmount = 10000) => ({
  externalId: 'listing', name: 'Sony headphones', category: 'headphones', brand: 'sony',
  currencyCode, priceAmount, destinationUrl: 'https://example.com/item',
});
function provider(code: string, search = vi.fn().mockResolvedValue({ products: [providerProduct()], total: 1, query: '' })): ProductProvider {
  return { code, name: code, supportedMarkets: ['GE'], search, getProduct: vi.fn() };
}
function service(providers: ProductProvider[], parser = { parse: vi.fn() }) {
  const registry = new InMemoryProviderRegistry();
  providers.forEach(p => registry.register(p));
  return { search: new SearchService(registry, parser), parser };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.market.mockResolvedValue({ id: 'market', code: 'GE', currencyCode: 'GEL', isActive: true });
  mocks.merchants.mockResolvedValue([{ id: 'merchant', code: 'ok', isActive: true }]);
  mocks.category.mockResolvedValue({ id: 'category-id', slug: 'headphones' });
  mocks.search.mockResolvedValue({ products: [], total: 0 });
  mocks.normalize.mockResolvedValue([]);
  mocks.persist.mockResolvedValue(undefined);
});

describe('search foundation', () => {
  it('searches structured intent without reparsing and preserves constraints', async () => {
    const good = provider('ok');
    const { search, parser } = service([good]);
    const intent = { query: 'I need sony wireless headphones under $150 for travel', category: 'headphones', brand: 'sony', maxPrice: 15000, currencyCode: 'USD', filters: { features: ['wireless'], useCase: 'travel' } };
    const result = await search.searchIntent(intent, 'GE');
    expect(parser.parse).not.toHaveBeenCalled();
    expect(good.search).toHaveBeenCalledWith(expect.objectContaining({ query: undefined, category: 'headphones', brand: 'sony', maxPrice: 15000, currencyCode: 'USD', filters: intent.filters }), 'GE');
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'category-id', query: undefined, brand: 'sony', maxPrice: 15000, features: ['wireless'], currencyCode: 'USD' }));
    expect(result.intent?.filters?.useCase).toBe('travel');
    expect(SearchResultSchema.safeParse(result).success).toBe(true);
    expect(result.query).not.toHaveProperty('marketId');
  });
  it('uses category slug for providers when intent supplied a DB category ID', async () => {
    const good = provider('ok');
    await service([good]).search.searchIntent({ category: 'category-id' }, 'GE');
    expect(mocks.category).toHaveBeenCalledWith('category-id');
    expect(good.search).toHaveBeenCalledWith(expect.objectContaining({ category: 'headphones' }), 'GE');
  });
  it('keeps an unknown category restrictive instead of silently dropping it', async () => {
    mocks.category.mockResolvedValue(undefined);
    await service([provider('ok')]).search.searchIntent({ category: 'unknown' }, 'GE');
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ categorySlug: 'unknown', categoryId: undefined }));
  });
  it.each([{ maxPrice: 20000 }, { filters: { features: ['wireless'] } }])('does not search a full sentence for a constraint-only intent: %j', async constraints => {
    const good = provider('ok');
    await service([good]).search.searchIntent({ query: 'I need something suitable for me', ...constraints }, 'GE');
    expect(good.search).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }), 'GE');
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ query: undefined }));
  });
  it('preserves plain text searches without structured category/brand', async () => {
    const good = provider('ok');
    await service([good]).search.searchIntent({ query: 'specific model 123' }, 'GE');
    expect(good.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'specific model 123' }), 'GE');
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ relevance: expect.objectContaining({ model: 'specific model 123' }), query: undefined }));
  });
  it('applies explicit filter overrides including zero over parsed intent', async () => {
    const parser = { parse: vi.fn().mockResolvedValue({ category: 'headphones', brand: 'sony', minPrice: 1000, maxPrice: 20000, filters: { features: ['wireless'] } }) };
    await service([provider('ok')], parser).search.search('a shopping sentence', 'GE', { minPrice: 0, maxPrice: 15000, brand: 'apple', currencyCode: 'USD' });
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ minPrice: 0, maxPrice: 15000, brand: 'apple', features: ['wireless'] }));
  });
  it('keeps successful providers when another fails and skips missing merchants', async () => {
    const failed = provider('failed', vi.fn().mockRejectedValue(new Error('offline')));
    const missing = provider('missing');
    mocks.merchants.mockResolvedValue([{ id: 'merchant', code: 'ok', isActive: true }, { id: 'failed-merchant', code: 'failed', isActive: true }]);
    await service([failed, provider('ok'), missing]).search.searchIntent({ category: 'headphones' }, 'GE');
    expect(failed.search).toHaveBeenCalled();
    expect(missing.search).not.toHaveBeenCalled();
    expect(mocks.normalize).toHaveBeenCalledWith([{ merchantId: 'merchant', products: [expect.objectContaining(providerProduct())] }], 'market');
  });
  it('returns unavailable when all providers fail, without persisting', async () => {
    await expect(service([provider('ok', vi.fn().mockRejectedValue(new Error('offline')))]).search.searchIntent({ query: 'headphones' }, 'GE')).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it('returns unavailable when no provider has an active merchant', async () => {
    mocks.merchants.mockResolvedValue([]);
    await expect(service([provider('ok')]).search.searchIntent({ query: 'headphones' }, 'GE')).rejects.toMatchObject({ statusCode: 503 });
    expect(mocks.normalize).not.toHaveBeenCalled();
  });
  it('filters provider prices only within explicit budget currency', async () => {
    const good = provider('ok', vi.fn().mockResolvedValue({ products: [providerProduct('USD', 100), providerProduct('GEL', 100), providerProduct('USD', 500)], total: 3, query: '' }));
    const result = await service([good]).search.searchIntent({ category: 'headphones', maxPrice: 200, currencyCode: 'USD' }, 'GE');
    expect(mocks.normalize).toHaveBeenCalledWith([{ merchantId: 'merchant', products: [expect.objectContaining(providerProduct('USD', 100))] }], 'market');
    expect(result.query.currencyCode).toBe('USD');
  });
  it('defaults budgets and price sorts to market currency; leaves unsorted currencies intact', async () => {
    const search = service([provider('ok')]).search;
    await search.searchIntent({ category: 'headphones', minPrice: 0 }, 'GE');
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ currencyCode: 'GEL' }));
    await search.searchIntent({ category: 'headphones' }, 'GE', { sort: 'price_asc' });
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ currencyCode: 'GEL', sort: 'price_asc' }));
    await search.searchIntent({ category: 'headphones' }, 'GE');
    expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ currencyCode: undefined }));
  });
  it('rejects reversed budgets and malformed features before provider access', async () => {
    const good = provider('ok');
    const search = service([good]).search;
    await expect(search.searchIntent({ minPrice: 200, maxPrice: 100 }, 'GE')).rejects.toMatchObject({ statusCode: 400 });
    await expect(search.searchIntent({ filters: { features: 'wireless' } }, 'GE')).rejects.toMatchObject({ statusCode: 400 });
    expect(good.search).not.toHaveBeenCalled();
  });
  it('rejects fractional budgets and invalid pagination as bad requests', async () => {
    const search = service([provider('ok')]).search;
    await expect(search.searchIntent({ maxPrice: 1.5 }, 'GE')).rejects.toMatchObject({ statusCode: 400 });
    await expect(search.searchIntent({ category: 'headphones' }, 'GE', { page: 0 })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('keeps database-only product search currency-safe', async () => {
    const app = Fastify();
    await app.register(productRoutes, { prefix: '/api' });
    try {
      const response = await app.inject({ url: '/api/products/search?q=headphones&maxPrice=10000&sort=price_asc' });
      expect(response.statusCode).toBe(200);
      expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ currencyCode: 'GEL', maxPrice: 10000, sort: 'price_asc' }));
      expect(response.json().query.currencyCode).toBe('GEL');
    } finally { await app.close(); }
  });
  it('serves /api/search with a schema-valid public query and currency', async () => {
    if (!providerRegistry.get('ok')) providerRegistry.register(provider('ok'));
    const app = Fastify();
    await app.register(searchRoutes, { prefix: '/api' });
    try {
      const response = await app.inject({ url: '/api/search?q=sony%20headphones%20under%20%24150&currencyCode=USD&sort=price_asc' });
      expect(response.statusCode).toBe(200);
      const result = response.json();
      expect(SearchResultSchema.safeParse(result).success).toBe(true);
      expect(result.query).toMatchObject({ q: 'sony headphones under $150', market: 'GE', currencyCode: 'USD', sort: 'price_asc', maxPrice: 15000 });
      expect(result.query).not.toHaveProperty('marketId');
    } finally { await app.close(); }
  });
});


describe('real eBay Search integration', () => {
  function realProvider(http: typeof fetch) {
    const registry = new InMemoryProviderRegistry();
    registerProviders(registry, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture-id', EBAY_CLIENT_SECRET: 'fixture-secret' }, http);
    return registry.get('ebay')!;
  }
  it.each([401, 429, 500, 'malformed', 'network'])('isolates real eBay failure %s', async failure => {
    const http = vi.fn<typeof fetch>().mockImplementation(async url => {
      if (String(url).includes('/identity/')) return Response.json({ access_token: 'fixture-token', expires_in: 3600 });
      if (failure === 'network') throw new Error('fixture network failure');
      return failure === 'malformed' ? new Response('not-json') : new Response('', { status: Number(failure) });
    });
    mocks.merchants.mockResolvedValue([{ id: 'merchant', code: 'ok', isActive: true }, { id: 'ebay', code: 'ebay', isActive: true }]);
    await service([{ ...provider('ok'), provenance: { version: 1, provider: 'ok', mode: 'real', environment: 'production' } }, realProvider(http)]).search.searchIntent({ category: 'headphones' }, 'GE');
    expect(mocks.normalize).toHaveBeenCalledWith([{ merchantId: 'merchant', products: [expect.objectContaining(providerProduct())] }], 'market');
  });
  it('preserves real USD without a budget and excludes it from a GEL budget without FX', async () => {
    const http = vi.fn<typeof fetch>().mockImplementation(async url => Response.json(String(url).includes('/identity/')
      ? { access_token: 'fixture-token', expires_in: 3600 }
      : { total: 1, itemSummaries: [{ itemId: 'v1|123|0', title: 'Sony headphones',
        price: { value: '159.99', currency: 'USD' }, itemWebUrl: 'https://www.ebay.com/itm/123',
        buyingOptions: ['FIXED_PRICE'], categories: [{ categoryId: 'fixture', categoryName: 'Headphones' }] }] }));
    mocks.merchants.mockResolvedValue([{ id: 'ebay', code: 'ebay', isActive: true }]);
    const search = service([realProvider(http)]).search;
    await search.searchIntent({ category: 'headphones' }, 'GE');
    expect(mocks.normalize).toHaveBeenLastCalledWith([{ merchantId: 'ebay', products: [expect.objectContaining({ currencyCode: 'USD', priceAmount: 15999 })] }], 'market');
    await search.searchIntent({ category: 'headphones', maxPrice: 50000, currencyCode: 'GEL' }, 'GE');
    expect(mocks.normalize).toHaveBeenLastCalledWith([{ merchantId: 'ebay', products: [] }], 'market');
  });
});


describe('specificity and provenance integration', () => {
  const real = { version: 1 as const, provider: 'ebay', mode: 'real' as const, environment: 'production' as const };
  it('preserves a public model request through parsing to real eBay retrieval', async () => {
    const http = vi.fn<typeof fetch>().mockImplementation(async url => Response.json(String(url).includes('/identity/')
      ? { access_token: 'fixture-token', expires_in: 3600 } : { total: 0 }));
    const registry = new InMemoryProviderRegistry();
    registerProviders(registry, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture-id', EBAY_CLIENT_SECRET: 'fixture-secret' }, http);
    mocks.merchants.mockResolvedValue([{ id: 'ebay', code: 'ebay', isActive: true }]);
    await new SearchService(registry).search('Sony WH-1000XM5', 'GE');
    const q = new URL(String(http.mock.calls[1]![0])).searchParams.get('q')!;
    expect(q.toLowerCase()).toContain('wh-1000xm5'); expect(q).not.toBe('sony');
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ relevance: expect.objectContaining({ model: 'WH-1000XM5' }), eligibleSources: [real] }));
  });
  it('guards fresh exact models, stamps real provenance and skips mocks', async () => {
    const mock = provider('ok');
    const ebay = { ...provider('ebay', vi.fn().mockResolvedValue({ products: [
      { ...providerProduct(), name: 'Sony WH 1000XM5 Headphones' },
      { ...providerProduct(), name: 'Sony WH-1000XM6' },
      { ...providerProduct(), name: 'Sony Alpha a6000' },
    ], total: 3 })), provenance: real };
    mocks.merchants.mockResolvedValue([{ id: 'ebay', code: 'ebay', isActive: true }, { id: 'merchant', code: 'ok', isActive: true }]);
    const registry = new InMemoryProviderRegistry(); registry.register(mock); registry.register(ebay);
    await new SearchService(registry).search('Sony WH-1000XM5', 'GE');
    expect(mock.search).not.toHaveBeenCalled();
    expect(mocks.normalize).toHaveBeenCalledWith([{ merchantId: 'ebay', products: [expect.objectContaining({ name: 'Sony WH 1000XM5 Headphones', affiliateMetadata: { _byb: { provenance: real } } })] }], 'market');
  });
  it('stamps explicit mock provenance in fixture mode', async () => {
    await service([provider('ok')]).search.searchIntent({ category: 'headphones' }, 'GE');
    expect(mocks.normalize.mock.calls[0]![0][0].products[0].affiliateMetadata._byb.provenance).toEqual({ version: 1, provider: 'ok', mode: 'mock', environment: 'mock' });
  });
  it('keeps eligible cached real results on provider failure with relevance and GEL constraints', async () => {
    const ebay = { ...provider('ebay', vi.fn().mockRejectedValue(new Error('offline'))), provenance: real };
    mocks.merchants.mockResolvedValue([{ id: 'ebay', code: 'ebay', isActive: true }]);
    const cached = { id: 'cached-real' };
    mocks.search.mockResolvedValue({ products: [cached], total: 1 });
    const registry = new InMemoryProviderRegistry(); registry.register(ebay);
    const result = await new SearchService(registry).search('Sony WH-1000XM5', 'GE', { maxPrice: 50000, currencyCode: 'GEL' });
    expect(result.products).toEqual([cached]);
    expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ eligibleSources: [real], currencyCode: 'GEL', maxPrice: 50000, relevance: expect.objectContaining({ model: 'WH-1000XM5' }) }));
  });
  it('returns unavailable when all real providers fail and no eligible cache exists', async () => {
    const ebay = { ...provider('ebay', vi.fn().mockRejectedValue(new Error('offline'))), provenance: real };
    mocks.merchants.mockResolvedValue([{ id: 'ebay', code: 'ebay', isActive: true }]);
    const registry = new InMemoryProviderRegistry(); registry.register(ebay);
    await expect(new SearchService(registry).search('headphones', 'GE')).rejects.toMatchObject({ statusCode: 503 });
  });
  it('uses the public currencyCode contract, rather than currency', async () => {
    if (!providerRegistry.get('ok')) providerRegistry.register(provider('ok'));
    const app = Fastify(); await app.register(searchRoutes, { prefix: '/api' });
    try {
      const response = await app.inject({ url: '/api/search?q=headphones&market=GE&maxPrice=50000&currencyCode=GEL' });
      expect(response.statusCode).toBe(200);
      expect(response.json().query.currencyCode).toBe('GEL');
      expect(mocks.search).toHaveBeenCalledWith(expect.objectContaining({ maxPrice: 50000, currencyCode: 'GEL' }));
      expect(mocks.normalize.mock.calls[0]![0][0].products).toEqual([]);
      const unsupported = await app.inject({ url: '/api/search?q=headphones&market=GE&maxPrice=50000&currency=USD' });
      expect(unsupported.json().query.currencyCode).toBe('GEL');
      expect(unsupported.json().query).not.toHaveProperty('currency');
    } finally { await app.close(); }
  });
});
