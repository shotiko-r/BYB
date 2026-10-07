import { describe, it, expect, vi } from 'vitest';
import { EbayTokenManager } from '../src/modules/provider/ebay/auth.js';
import { EbayBrowseClient } from '../src/modules/provider/ebay/client.js';
import { EbayProvider } from '../src/modules/provider/ebay/ebay-provider.js';
import { mapItem, minorUnits, keywords } from '../src/modules/provider/ebay/mapping.js';
import { EbayError } from '../src/modules/provider/ebay/http.js';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { registerProviders } from '../src/modules/provider/register.js';
import { EbayProvider as MockEbay } from '../src/modules/provider/mock/ebay-provider.js';
import { EnvSchema } from '../src/config/env-schema.js';
import { sortOffers, formatMoney } from '../../frontend/src/lib/offer-prices';

const config = { environment: 'production' as const, clientId: 'fixture-id', clientSecret: 'fixture-secret' };
const fixture = {
  itemId: 'v1|123456|0', title: 'Sony WH-1000XM5 Wireless Headphones', price: { value: '159.99', currency: 'USD' },
  image: { imageUrl: 'https://i.ebayimg.com/images/example.jpg' }, itemWebUrl: 'https://www.ebay.com/itm/123456',
  categories: [{ categoryId: 'fixture-category', categoryName: 'Headphones' }], condition: 'Used', conditionId: '3000',
  seller: { username: 'fixture-account-not-retained', feedbackPercentage: '99.8', feedbackScore: 400 },
  shippingOptions: [{ shippingCost: { value: '9.99', currency: 'USD' }, shippingCostType: 'FIXED' }],
  buyingOptions: ['FIXED_PRICE'], listingMarketplaceId: 'EBAY_US', epid: 'fixture-epid', itemLocation: { country: 'US' },
};
function network() {
  return vi.fn<typeof fetch>().mockImplementation(async url => Response.json(String(url).includes('/identity/')
    ? { access_token: 'fixture-token', expires_in: 3600 } : { total: 1, itemSummaries: [fixture] }));
}
function client(transport: typeof fetch, timeout = 5000) {
  return new EbayBrowseClient(config, new EbayTokenManager(config, transport, Date.now, timeout), transport, timeout);
}
describe('eBay OAuth', () => {
  it('uses client credentials and scope; caches, refreshes and deduplicates', async () => {
    const http = network(); let now = 0;
    const manager = new EbayTokenManager(config, http, () => now);
    expect(await Promise.all([manager.getToken(), manager.getToken()])).toEqual(['fixture-token', 'fixture-token']);
    await manager.getToken(); expect(http).toHaveBeenCalledTimes(1);
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe('https://api.ebay.com/identity/v1/oauth2/token');
    expect(init!.headers).toEqual({ Authorization: `Basic ${Buffer.from('fixture-id:fixture-secret').toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(init!.body).toBe('grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope');
    now = 3570001; await Promise.all([manager.getToken(), manager.getToken()]); expect(http).toHaveBeenCalledTimes(2);
  });
  it.each([401, 429, 500])('sanitizes OAuth HTTP %s errors', async status => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response('fixture-secret fixture-token', { status }));
    await expect(new EbayTokenManager(config, http).getToken()).rejects.toMatchObject({ message: expect.not.stringContaining('fixture-secret') });
  });
  it('rejects malformed token and clears failed refresh for retry', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'fixture-token' }))
      .mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }));
    const manager = new EbayTokenManager(config, http);
    await expect(manager.getToken()).rejects.toMatchObject({ code: 'malformed' });
    expect(await manager.getToken()).toBe('fixture-token');
  });
});
describe('Browse client', () => {
  it('encodes query and sets marketplace/Bearer headers', async () => {
    const http = network(); await client(http).get('/item_summary/search', 'EBAY_US', { q: 'sony & headphones' });
    const [url, init] = http.mock.calls[1]!;
    expect(new URL(String(url)).searchParams.get('q')).toBe('sony & headphones');
    expect(init!.headers).toEqual({ Authorization: 'Bearer fixture-token', 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' });
    expect(init!.redirect).toBe('error');
  });
  it('refreshes/retries at most once after Browse 401', async () => {
    const http = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes('/identity/')
      ? Response.json({ access_token: 'fixture-token', expires_in: 3600 }) : new Response('', { status: 401 }));
    await expect(client(http).get('/item_summary/search', 'EBAY_US')).rejects.toMatchObject({ code: 'auth', status: 401 });
    expect(http).toHaveBeenCalledTimes(4);
  });
  it('succeeds after one invalid-token refresh', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ access_token: 'old-token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'new-token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json({ total: 0 }));
    expect(await client(http).get('/item_summary/search', 'EBAY_US')).toEqual({ total: 0 });
    expect(http.mock.calls[3]![1]!.headers).toMatchObject({ Authorization: 'Bearer new-token' });
  });
  it.each([[429, 'rate_limit'], [500, 'upstream'], [400, 'request'], [403, 'auth']])('classifies %s without retries', async (status, code) => {
    const http = network(); http.mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('private error', { status: status as number }));
    await expect(client(http).get('/item_summary/search', 'EBAY_US')).rejects.toMatchObject({ code });
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('deduplicates a concurrent refresh after two stale-token 401s', async () => {
    let tokenRequests = 0;
    const http = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
      if (String(url).includes('/identity/')) return Response.json({ access_token: ++tokenRequests === 1 ? 'old-fixture-token' : 'new-fixture-token', expires_in: 3600 });
      return new Headers(init!.headers).get('Authorization') === 'Bearer old-fixture-token'
        ? new Response('', { status: 401 }) : Response.json({ total: 0 });
    });
    const browse = client(http);
    await Promise.all([browse.get('/item_summary/search', 'EBAY_US'), browse.get('/item_summary/search', 'EBAY_US')]);
    expect(tokenRequests).toBe(2);
  });
  it('times out the Browse request after a successful token request', async () => {
    const http = vi.fn<typeof fetch>().mockImplementation((url, init) => String(url).includes('/identity/')
      ? Promise.resolve(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
      : new Promise((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(new Error('fixture-token')), { once: true }); }));
    await expect(client(http, 10).get('/item_summary/search', 'EBAY_US')).rejects.toMatchObject({ code: 'network', message: 'eBay network failure' });
    expect(http).toHaveBeenCalledTimes(2);
  });
  it('handles malformed JSON and oversized responses', async () => {
    for (const body of ['bad-json', 'x'.repeat(1048577)]) {
      const http = network(); http.mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
        .mockResolvedValueOnce(new Response(body));
      await expect(client(http).get('/item_summary/search', 'EBAY_US')).rejects.toMatchObject({ code: 'malformed' });
    }
  });
  it('bounds timeout and sanitizes network errors', async () => {
    const http = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('fixture-secret')), { once: true });
    }));
    await expect(client(http, 10).get('/item_summary/search', 'EBAY_US')).rejects.toMatchObject({ code: 'network', message: 'eBay network failure' });
  });
});
describe('mapping and provider', () => {
  it('maps a real-like Sony listing with exact price and anonymous metadata', () => {
    const result = mapItem(fixture)!;
    expect(result).toMatchObject({ externalId: fixture.itemId, name: fixture.title, priceAmount: 15999, currencyCode: 'USD',
      imageUrl: fixture.image.imageUrl, destinationUrl: fixture.itemWebUrl, category: 'headphones', availability: 'unknown',
      attributes: { condition: 'Used', seller: { feedbackScore: 400 }, listingMarketplaceId: 'EBAY_US', epid: 'fixture-epid', itemLocationCountry: 'US' },
      shippingInfo: { options: [{ shippingCost: { amount: 999, currencyCode: 'USD' } }] }, affiliateMetadata: {} });
    expect(JSON.stringify(result)).not.toContain(fixture.seller.username);
    expect(result.brand).toBeUndefined(); expect(result.model).toBeUndefined();
  });
  it.each([['159.99', 'USD', 15999], ['139.49', 'USD', 13949], ['100', 'JPY', 100]])('parses %s %s exactly', (value, currency, expected) => {
    expect(minorUnits(value, currency)).toBe(expected);
  });
  it.each(['1.999', '-1', '1e2', '21474836.48'])('rejects unsupported money %s', value => expect(() => minorUnits(value, 'USD')).toThrow());
  it('handles absent optional fields and rejects required/malformed fields and auctions', () => {
    expect(mapItem({ itemId: 'x', title: 'Item', price: fixture.price, itemWebUrl: fixture.itemWebUrl, buyingOptions: ['FIXED_PRICE'] })).not.toBeNull();
    expect(mapItem({ ...fixture, buyingOptions: ['AUCTION'] })).toBeNull();
    expect(mapItem({ ...fixture, itemWebUrl: 'https://attacker.invalid/item' })).toBeNull();
    expect(mapItem({ ...fixture, price: { value: 'NaN', currency: 'USD' } })).toBeNull();
  });
  it('builds retrieval from structured intent without sending budget/useCase as filters', async () => {
    const http = network(); const provider = new EbayProvider(client(http));
    const result = await provider.search({ category: 'headphones', currencyCode: 'GEL', maxPrice: 50000 }, 'GE');
    expect(result.products[0]!.currencyCode).toBe('USD');
    const params = new URL(String(http.mock.calls[1]![0])).searchParams;
    expect(params.get('q')).toBe('headphones'); expect(params.get('filter')).toBe('buyingOptions:{FIXED_PRICE}');
    expect(params.get('limit')).toBe('20');
    expect(keywords({ category: 'headphones', brand: 'Sony', filters: { features: ['noiseCancellation'], model: 'WH-1000XM5', useCase: 'travel' } })).toBe('headphones Sony WH-1000XM5 noise cancelling');
  });
  it('enriches verified brand/features from detail while retaining summary categories', async () => {
    const http = network(); http.mockImplementation(async url => Response.json(String(url).includes('/identity/')
      ? { access_token: 'fixture-token', expires_in: 3600 } : String(url).includes('/item_summary/')
        ? { total: 1, itemSummaries: [fixture] } : { ...fixture, categories: undefined,
          localizedAspects: [{ name: 'Brand', value: 'Sony' }, { name: 'Features', value: 'Active Noise Cancellation, Bluetooth' }] }));
    const result = await new EbayProvider(client(http)).search({ category: 'headphones', brand: 'Sony' }, 'GE');
    expect(result.products[0]).toMatchObject({ brand: 'Sony', category: 'headphones', attributes: { features: ['noiseCancellation', 'wireless'] } });
  });
  it('bounds detail enrichment to five calls even when details fail', async () => {
    const http = network();
    http.mockImplementation(async url => {
      if (String(url).includes('/identity/')) return Response.json({ access_token: 'fixture-token', expires_in: 3600 });
      if (String(url).includes('/item_summary/')) return Response.json({ total: 20, itemSummaries: Array.from({ length: 20 }, (_, i) => ({ ...fixture, itemId: `v1|${i}|0` })) });
      return new Response('', { status: 500 });
    });
    const result = await new EbayProvider(client(http)).search({ category: 'headphones', filters: { features: ['noiseCancellation'] } }, 'GE');
    expect(result.products).toHaveLength(20);
    expect(http.mock.calls.filter(([url]) => String(url).includes('/item/'))).toHaveLength(5);
    expect(result.products.every(product => !product.attributes!.features || (product.attributes!.features as string[]).length === 0)).toBe(true);
  });
  it('gets a listing by safely encoded identity and returns null on 404', async () => {
    const http = network();
    http.mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 }))
      .mockResolvedValueOnce(Response.json(fixture)).mockResolvedValueOnce(new Response('', { status: 404 }));
    const provider = new EbayProvider(client(http));
    expect((await provider.getProduct(fixture.itemId, 'GE'))!.externalId).toBe(fixture.itemId);
    expect(String(http.mock.calls[1]![0])).toContain('/item/v1%7C123456%7C0');
    expect(await provider.getProduct('missing', 'GE')).toBeNull();
  });
  it('returns empty and distinguishes malformed search responses', async () => {
    const http = network(); http.mockResolvedValueOnce(Response.json({ access_token: 'fixture-token', expires_in: 3600 })).mockResolvedValueOnce(Response.json({ total: 0 }));
    expect((await new EbayProvider(client(http)).search({}, 'GE')).products).toEqual([]);
    http.mockResolvedValue(Response.json({ invalid: true }));
    await expect(new EbayProvider(client(http)).search({}, 'GE')).rejects.toBeInstanceOf(EbayError);
  });
});
describe('registration/config/currency', () => {
  it('defaults to mock and switches only eBay in real mode', () => {
    const mock = new InMemoryProviderRegistry(); registerProviders(mock); expect(mock.get('ebay')).toBeInstanceOf(MockEbay);
    const real = new InMemoryProviderRegistry(); registerProviders(real, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture-id', EBAY_CLIENT_SECRET: 'fixture-secret' }, network());
    expect(real.get('ebay')).toBeInstanceOf(EbayProvider);
    expect(real.getAll().map(p => p.code)).toEqual(mock.getAll().map(p => p.code));
    for (const code of ['amazon', 'temu', 'aliexpress']) expect(real.get(code)!.constructor).toBe(mock.get(code)!.constructor);
    expect(() => registerProviders(new InMemoryProviderRegistry(), { EBAY_PROVIDER_MODE: 'real' })).toThrow('requires backend client credentials');
  });
  it('requires credentials only in real mode and leaves compliance independent', () => {
    const base = { DATABASE_URL: 'postgres://example.invalid/byb' };
    expect(EnvSchema.parse(base).EBAY_PROVIDER_MODE).toBe('mock');
    expect(EnvSchema.safeParse({ ...base, EBAY_PROVIDER_MODE: 'real' }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...base, EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture-id', EBAY_CLIENT_SECRET: 'fixture-secret' }).success).toBe(true);
  });
  it('groups currencies without comparing unlike amounts and retains cents', () => {
    expect(sortOffers([{ currencyCode: 'USD', priceAmount: 1 }, { currencyCode: 'GEL', priceAmount: 50000 },
      { currencyCode: 'GEL', priceAmount: 10000 }]).map(o => o.priceAmount)).toEqual([10000, 50000, 1]);
    expect(formatMoney(15999, 'USD')).toBe('$159.99'); expect(formatMoney(100, 'JPY')).toContain('100');
  });
});
