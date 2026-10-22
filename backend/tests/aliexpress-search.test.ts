import { initializeFeedTestSchema } from './helpers/feed-test-db.js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import Fastify from 'fastify';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchResultSchema } from '@byb/shared/types';
const db = vi.hoisted(() => ({ query: vi.fn(), getClient: vi.fn() }));
vi.mock('../src/config/database.js', () => db);
// Feed retrieval must never be imported by search or details.
vi.mock('../src/modules/feed/http.js', () => { throw new Error('Search imported feed transport'); });
vi.mock('../src/modules/feed/importer.js', () => { throw new Error('Search imported feed importer'); });
import { FeedRepository } from '../src/modules/feed/repository.js';
import { mapAliExpressRow } from '../src/modules/feed/merchants/aliexpress.js';
import { providerRegistry, InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { registerProviders } from '../src/modules/provider/register.js';
import { AliExpressFeedSource } from '../src/modules/provider/aliexpress-feed.js';
import { eligibleSources, feedSearchPolicy } from '../src/modules/provider/provenance.js';
import { PostgresProductRepository } from '../src/modules/product/repository.js';
import { searchRoutes } from '../src/modules/search/routes.js';
import { productRoutes } from '../src/modules/product/routes.js';
import { SearchService } from '../src/modules/search/service.js';

const url = process.env.BYB_FEED_TEST_DATABASE_URL;
const schema = `search_test_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public`, max: 6 });
const feedRepo = new FeedRepository(pool);
const repo = new PostgresProductRepository();
const settings = { ALIEXPRESS_SEARCH_ENABLED: true, ADMITAD_ALIEXPRESS_FEED_MARKETS: 'GE', ADMITAD_ALIEXPRESS_FEED_MAX_AGE_HOURS: 24,
  EBAY_PROVIDER_MODE: 'real' as const, EBAY_CLIENT_ID: 'synthetic', EBAY_CLIENT_SECRET: 'synthetic' };
const ebayProduct = { externalId: 'v1|123|0', name: 'Sony WH-1000XM5', brand: 'Sony', model: 'WH-1000XM5',
  priceAmount: 15000, currencyCode: 'USD', destinationUrl: 'https://www.ebay.com/itm/123?tracking=synthetic',
  attributes: { source: 'ebay_browse', listingIdentity: 'v1|123|0' },
  affiliateMetadata: { _byb: { sourceType: 'api', feed: { sentinel: 'preserved' } } } };
let marketId: string;
const app = Fastify();
const search = () => app.inject({ method: 'GET', url: '/api/search?q=Sony%20WH-1000XM5&market=GE' });
async function seed(name = 'Sony WH-1000XM5', id = '001') {
  const mapped = mapAliExpressRow({ id, name, url: 'https://track.example/click?affiliate=synthetic', category: 'Raw category',
    currencyId: 'USD', param: '', picture: 'https://img.example/a.jpg', oldprice: '', price: '99.50' }, { programNamespace: 'aliexpress-ww' });
  if (!mapped.ok) throw new Error('Invalid synthetic fixture');
  await feedRepo.writeBatch([mapped.value], { feedKey: 'aliexpress-ww', markets: ['GE'], syncRunId: randomUUID() });
  // Avoid host/container clock skew in fixtures; freshness uses the DB clock.
  await pool.query(`UPDATE offers SET affiliate_metadata=jsonb_set(affiliate_metadata, '{_byb,feed,lastSeenAt}',
    to_jsonb(to_char((CURRENT_TIMESTAMP - INTERVAL '1 minute') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    WHERE external_product_id=$1`, [id]);
  return (await pool.query('SELECT id FROM products WHERE slug=$1', [mapped.value.sourceIdentity])).rows[0].id as string;
}
async function metadata(path: string[], value: unknown) {
  await pool.query(`UPDATE offers SET affiliate_metadata=jsonb_set(affiliate_metadata,$1,$2::jsonb) WHERE merchant_id=(SELECT id FROM merchants WHERE code='aliexpress')`, [path, JSON.stringify(value)]);
}
const filters = () => ({ marketId, page: 1, limit: 20, sort: 'relevance' as const, query: 'Sony WH-1000XM5' });

describe('AliExpress persisted source registration', () => {
  it('registers real production feed retrieval without any credential URL', () => {
    const registry = new InMemoryProviderRegistry(); registerProviders(registry, settings);
    expect(registry.get('aliexpress')).toMatchObject({ retrievalMode: 'persisted-feed', provenance: {
      version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' } });
    expect(registry.get('ebay')?.retrievalMode).toBe('live-api');
    expect(eligibleSources(registry)?.map(s => s.provider).sort()).toEqual(['aliexpress', 'ebay']);
    expect(feedSearchPolicy(registry)).toEqual({ markets: ['GE'], maxAgeHours: 24 });
  });
});

describe.skipIf(!url)('AliExpress search: actual HTTP routes and disposable PostgreSQL', () => {
  beforeAll(async () => {
    db.query.mockImplementation((text, params) => pool.query(text, params));
    db.getClient.mockImplementation(() => pool.connect());
    await initializeFeedTestSchema(pool, schema);
    marketId = (await pool.query("SELECT id FROM markets WHERE code='GE'")).rows[0].id;
    registerProviders(providerRegistry, settings);
    await app.register(searchRoutes, { prefix: '/api' });
    await app.register(productRoutes, { prefix: '/api' });
    await app.ready();
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE products CASCADE');
    await pool.query('UPDATE markets SET is_active=true');
    await pool.query('UPDATE merchants SET is_active=true');
    await pool.query('UPDATE market_merchants SET is_enabled=true');
    vi.spyOn(providerRegistry.get('ebay')!, 'search').mockResolvedValue({ products: [], total: 0, query: '' });
    vi.spyOn(providerRegistry.get('aliexpress')!, 'search').mockImplementation(() => { throw new Error('Feed source called live'); });
  });
  afterAll(async () => {
    await app.close();
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });

  it('returns separate live eBay and persisted AliExpress cards with real currency, merchant and tracked links', async () => {
    await seed();
    const feedBefore = (await pool.query('SELECT affiliate_metadata FROM offers')).rows[0].affiliate_metadata;
    vi.mocked(providerRegistry.get('ebay')!.search).mockResolvedValue({ products: [ebayProduct], total: 1, query: '' });
    for (let run = 0; run < 2; run++) {
      const response = await search();
      expect(response.statusCode, response.body).toBe(200);
      const result = SearchResultSchema.parse(response.json());
      expect(result.total).toBe(2);
      expect(new Set(result.products.map(p => p.id)).size).toBe(2);
      expect(result.products.every(p => p.offers.length === 1)).toBe(true);
      const offers = result.products.flatMap(p => p.offers);
      expect(offers.map(o => o.merchant?.code).sort()).toEqual(['aliexpress', 'ebay']);
      expect(offers.map(o => o.merchant?.name).sort()).toEqual(['AliExpress', 'eBay']);
      expect(offers.every(o => o.currencyCode === 'USD')).toBe(true);
      const ali = offers.find(o => o.merchant?.code === 'aliexpress')!;
      expect(ali.destinationUrl).toBe('https://track.example/click?affiliate=synthetic');
      expect(ali.availability).toBe('unknown');
      expect(ali.shippingInfo).not.toHaveProperty('freeShipping');
      expect(ali.affiliateMetadata).toMatchObject({ _byb: { sourceType: 'admitad-feed', feed: { key: 'aliexpress-ww', lastSeenAt: expect.any(String) } } });
      expect(offers.find(o => o.merchant?.code === 'ebay')!.affiliateMetadata).toMatchObject({ _byb: { sourceType: 'api', feed: { sentinel: 'preserved' }, provenance: { provider: 'ebay' } } });
    }
    expect((await pool.query("SELECT affiliate_metadata FROM offers WHERE merchant_id=(SELECT id FROM merchants WHERE code='aliexpress')")).rows[0].affiliate_metadata).toEqual(feedBefore);
    expect(providerRegistry.get('aliexpress')!.search).not.toHaveBeenCalled();
    expect((await pool.query('SELECT count(*)::int n FROM products')).rows[0].n).toBe(2);
    expect((await pool.query('SELECT count(*)::int n FROM offers')).rows[0].n).toBe(2);
  });

  it.each([
    [['_byb', 'feed', 'key'], 'wrong-feed'],
    [['_byb', 'sourceType'], 'other'],
    [['_byb', 'provenance', 'provider'], 'ebay'],
    [['_byb', 'provenance', 'mode'], 'mock'],
    [['_byb', 'provenance', 'environment'], 'sandbox'],
    [['_byb', 'provenance', 'version'], 2],
    [['_byb', 'feed', 'lastSeenAt'], '2000-01-01T00:00:00.000Z'],
    [['_byb', 'feed', 'lastSeenAt'], null],
    [['_byb', 'feed', 'lastSeenAt'], 'invalid'],
    [['_byb', 'feed', 'lastSeenAt'], '2026-02-30T12:00:00.000Z'],
    [['_byb', 'feed', 'lastSeenAt'], '2099-01-01T00:00:00.000Z'],
  ] as [string[], unknown][])('excludes ineligible metadata %j / %j from search, count and detail', async (path, value) => {
    const id = await seed();
    await metadata(path, value);
    expect(await repo.search(filters())).toMatchObject({ total: 0, products: [] });
    expect(await repo.findByIdWithOffers(id, marketId)).toBeNull();
    expect((await app.inject({ url: `/api/products/${id}?market=GE` })).statusCode).toBe(404);
  });

  it('rejects completely missing freshness metadata', async () => {
    const id = await seed();
    await pool.query("UPDATE offers SET affiliate_metadata=affiliate_metadata #- '{_byb,feed,lastSeenAt}'");
    expect((await repo.search(filters())).total).toBe(0);
    expect(await repo.findByIdWithOffers(id, marketId)).toBeNull();
    expect((await pool.query('SELECT count(*)::int n FROM offers')).rows[0].n).toBe(1);
  });

  it.each(['market', 'merchant', 'offer', 'product', 'disabled', 'inactive-market', 'missing-policy'])('excludes %s restrictions', async condition => {
    const id = await seed();
    if (condition === 'market') await pool.query("UPDATE offers SET market_id=(SELECT id FROM markets WHERE code='AM')");
    if (condition === 'merchant') await pool.query("UPDATE merchants SET is_active=false WHERE code='aliexpress'");
    if (condition === 'offer') await pool.query('UPDATE offers SET is_active=false');
    if (condition === 'product') await pool.query('UPDATE products SET is_active=false');
    if (condition === 'inactive-market') await pool.query("UPDATE markets SET is_active=false WHERE code='GE'");
    if (condition === 'disabled') await pool.query('UPDATE market_merchants SET is_enabled=false');
    if (condition === 'missing-policy') await pool.query('DELETE FROM market_merchants');
    try {
      expect((await repo.search(filters())).total).toBe(0);
      expect(await repo.findByIdWithOffers(id, marketId)).toBeNull();
      if (condition === 'market') {
        const am = (await pool.query("SELECT id FROM markets WHERE code='AM'")).rows[0].id;
        expect((await repo.search({ ...filters(), marketId: am })).total).toBe(0);
        expect(await repo.findByIdWithOffers(id, am)).toBeNull();
      }
    } finally {
      if (condition === 'missing-policy') await pool.query('INSERT INTO market_merchants(market_id,merchant_id) SELECT a.id,b.id FROM markets a CROSS JOIN merchants b');
    }
  });

  it('uses identical model/accessory relevance rules and filters before pagination', async () => {
    const id = await seed();
    await seed('Sony WH-1000XM5 replacement ear pads', '002');
    await seed('Sony WH-1000XM4', '003');
    const result = await repo.search({ ...filters(), limit: 1 });
    expect(result.total).toBe(1);
    expect(result.products.map(p => p.id)).toEqual([id]);
  });

  it('keeps USD currency and applies currency-safe filters and budgets', async () => {
    await seed();
    expect((await repo.search({ ...filters(), currencyCode: 'USD', maxPrice: 10000 })).total).toBe(1);
    expect((await repo.search({ ...filters(), currencyCode: 'GEL', maxPrice: 10000 })).total).toBe(0);
    const response = await app.inject({ url: '/api/search?q=Sony%20WH-1000XM5&market=GE&maxPrice=10000' });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('currency');
  });

  it('returns AliExpress if live eBay fails and retains eligible cached eBay', async () => {
    await seed();
    vi.mocked(providerRegistry.get('ebay')!.search).mockRejectedValue(new Error('synthetic outage'));
    let response = await search();
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().products[0].offers[0].merchant.code).toBe('aliexpress');
    vi.mocked(providerRegistry.get('ebay')!.search).mockResolvedValue({ products: [ebayProduct], total: 1, query: '' });
    await search();
    vi.mocked(providerRegistry.get('ebay')!.search).mockRejectedValue(new Error('synthetic outage'));
    response = await search();
    expect(response.json().total).toBe(2);
  });

  it('details return eligible merchant identity and tracked links without shipping claims', async () => {
    const id = await seed();
    const response = await app.inject({ url: `/api/products/${id}?market=GE` });
    expect(response.statusCode, response.body).toBe(200);
    const offer = response.json().offers[0];
    expect(offer.merchant).toMatchObject({ name: 'AliExpress', code: 'aliexpress' });
    expect(offer.merchant).not.toHaveProperty('affiliateMetadata');
    expect(offer.destinationUrl).toBe('https://track.example/click?affiliate=synthetic');
    expect(offer.availability).toBe('unknown');
    expect(offer.shippingInfo).not.toHaveProperty('estimatedDays');
  });

  it('supports a persisted-only registry without calling retrieval methods', async () => {
    await seed();
    const registry = new InMemoryProviderRegistry();
    registry.register(new AliExpressFeedSource({ markets: ['GE'], maxAgeHours: 24 }));
    const service = new SearchService(registry);
    expect((await service.search('Sony WH-1000XM5', 'GE')).total).toBe(1);
    expect((await service.search('Sony WH-1000XM4', 'GE')).total).toBe(0);
  });

  it('honors the configured max age and excludes unregistered feed sources', async () => {
    await seed();
    await metadata(['_byb', 'feed', 'lastSeenAt'], new Date(Date.now() - 2 * 3600000).toISOString());
    const registry = new InMemoryProviderRegistry();
    registry.register(new AliExpressFeedSource({ markets: ['GE'], maxAgeHours: 1 }));
    expect((await new SearchService(registry).search('Sony WH-1000XM5', 'GE')).total).toBe(0);
    const unregistered = new InMemoryProviderRegistry(); registerProviders(unregistered, { ...settings, ALIEXPRESS_SEARCH_ENABLED: false });
    expect(await repo.findByIdWithOffers((await pool.query('SELECT id FROM products')).rows[0].id, marketId, unregistered)).toBeNull();
  });

  async function bothSources() {
    const ali = await seed();
    vi.mocked(providerRegistry.get('ebay')!.search).mockResolvedValueOnce({ products: [ebayProduct], total: 1, query: '' });
    const response = await search();
    expect(response.statusCode, response.body).toBe(200);
    return ali;
  }
  it.each([['ebay', 1], ['aliexpress', 1], ['ebay,aliexpress', 2]] as const)('filters merchant=%s before counts and pagination', async (merchant, total) => {
    await bothSources();
    const response = await app.inject(`/api/search?q=Sony%20WH-1000XM5&market=GE&merchant=${merchant}&limit=1`);
    expect(response.statusCode, response.body).toBe(200);
    const result = SearchResultSchema.parse(response.json());
    expect(result.total).toBe(total); expect(result.totalPages).toBe(total); expect(result.products).toHaveLength(1);
    expect(result.products.flatMap(product => product.offers).every(offer => merchant.split(',').includes(offer.merchant!.code))).toBe(true);
    if (merchant === 'aliexpress') expect(providerRegistry.get('ebay')!.search).toHaveBeenCalledTimes(1); // only initial population
  });
  it('filters attached offers on an existing shared product rather than counting unselected merchants', async () => {
    const ali = await bothSources();
    const ebay = (await pool.query("SELECT id FROM products WHERE attributes->>'source'='ebay_browse'")).rows[0].id;
    await pool.query('UPDATE offers SET product_id=$1 WHERE product_id=$2', [ali, ebay]);
    const response = await app.inject('/api/search?q=Sony%20WH-1000XM5&merchant=ebay');
    expect(response.json().total).toBe(1);
    expect(response.json().products[0].offers).toHaveLength(1);
    expect(response.json().products[0].offers[0].merchant.code).toBe('ebay');
  });
  it.each(['unknown', 'amazon', 'ebay,unknown'])('rejects invalid/unregistered real merchant filter %s', async merchant => {
    const response = await app.inject(`/api/search?q=Sony%20WH-1000XM5&merchant=${merchant}`);
    // Amazon is known but mock-only, so it is unavailable as a real-mode filter.
    expect(response.statusCode).toBe(400);
    expect(providerRegistry.get('ebay')!.search).not.toHaveBeenCalled();
  });
  it('requires explicit currency for price sort and never silently chooses GEL', async () => {
    await seed();
    for (const sort of ['price_asc', 'price_desc']) {
      const response = await app.inject(`/api/search?q=Sony%20WH-1000XM5&market=GE&sort=${sort}`);
      expect(response.statusCode).toBe(400); expect(response.json().message).toContain('currency');
    }
    const explicit = await app.inject('/api/search?q=Sony%20WH-1000XM5&sort=price_asc&currency=USD');
    expect(explicit.statusCode, explicit.body).toBe(200); expect(explicit.json().total).toBe(1);
    expect(explicit.json().query.currencyCode).toBe('USD');
    const best = await search(); expect(best.json().query.currencyCode).toBeUndefined();
  });
  it.each([['JPY', '100', 100], ['KWD', '0.001', 1]] as const)('interprets text budgets in explicit %s units without rounding or FX', async (currency, amount, minor) => {
    const id = await seed();
    await pool.query('UPDATE offers SET currency_code=$1,price_amount=$2 WHERE product_id=$3', [currency, minor, id]);
    const response = await app.inject(`/api/search?q=${encodeURIComponent(`Sony WH-1000XM5 under ${amount}`)}&currency=${currency}`);
    expect(response.statusCode, response.body).toBe(200); expect(response.json().query.maxPrice).toBe(minor);
    expect(response.json().products[0].offers[0]).toMatchObject({ currencyCode: currency, priceAmount: minor });
  });
  it('rejects a text budget currency conflicting with the selected filter', async () => {
    expect((await app.inject('/api/search?q=Sony%20WH-1000XM5%20under%20%24100&currency=JPY')).statusCode).toBe(400);
  });
  it('filters exact currency and inclusive price bounds before pagination', async () => {
    const first = await seed(); const exact = await seed('Sony WH-1000XM5', '002'); const third = await seed('Sony WH-1000XM5', '003');
    await pool.query('UPDATE offers SET price_amount=99 WHERE product_id=$1', [first]);
    await pool.query('UPDATE offers SET price_amount=100 WHERE product_id=$1', [exact]);
    await pool.query("UPDATE offers SET price_amount=101,currency_code='GEL' WHERE product_id=$1", [third]);
    const result = await app.inject('/api/search?q=Sony%20WH-1000XM5&currency=USD&minPrice=100&maxPrice=100');
    expect(result.statusCode, result.body).toBe(200); expect(result.json().total).toBe(1); expect(result.json().products[0].id).toBe(exact);
    const gel = await app.inject('/api/search?q=Sony%20WH-1000XM5&currency=GEL'); expect(gel.json().total).toBe(1);
  });
  it.each(['minPrice=200&maxPrice=100&currency=USD', 'maxPrice=100&currency=XYZ', 'sort=price_asc&currency=USD&currencyCode=GEL', 'maxPrice=1.5&currency=USD'])('rejects invalid price/currency request %s', async query => {
    expect((await app.inject(`/api/search?q=Sony%20WH-1000XM5&${query}`)).statusCode).toBe(400);
  });
  it('offers controlled categories and applies exact category only', async () => {
    const id = await seed();
    await pool.query("UPDATE products SET category_id=(SELECT id FROM categories WHERE slug='headphones') WHERE id=$1", [id]);
    const options = await app.inject('/api/search/options?market=GE');
    expect(options.statusCode, options.body).toBe(200);
    expect(options.json().merchants.map((item: { code: string }) => item.code)).toEqual(['aliexpress', 'ebay']);
    expect(options.json().categories.some((item: { slug: string }) => item.slug === 'aliexpress-feed')).toBe(false);
    const exact = await app.inject('/api/search?q=Sony%20WH-1000XM5&category=headphones'); expect(exact.json().total).toBe(1);
    const parent = await app.inject('/api/search?q=Sony%20WH-1000XM5&category=electronics'); expect(parent.json().total).toBe(0);
    expect((await app.inject('/api/search?q=Sony%20WH-1000XM5&category=invented')).statusCode).toBe(400);
  });
  it('ranks an exact title ahead of a longer model result with deterministic ties', async () => {
    const exact = await seed(); const longer = await seed('AAA Sony WH-1000XM5 headphones', '002');
    await pool.query("UPDATE products SET brand='Sony',model='WH-1000XM5' WHERE id=$1", [longer]);
    const response = await search(); expect(response.statusCode, response.body).toBe(200);
    expect(response.json().products[0].id).toBe(exact);
    const alias = await app.inject('/api/search?q=Sony%20WH-1000XM5&sort=best_match'); expect(alias.json().products[0].id).toBe(exact);
  });
  it('keeps model accessories separate and supports explicit accessory intent', async () => {
    const full = await seed(); const accessory = await seed('Replacement ear pads for Sony WH-1000XM5', '002');
    expect((await search()).json().products.map((product: { id: string }) => product.id)).toEqual([full]);
    const response = await app.inject('/api/search?q=Replacement%20ear%20pads%20for%20Sony%20WH-1000XM5');
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().products.map((product: { id: string }) => product.id)).toEqual([accessory]);
  });
  it('newest means BYB creation timestamp, not price or manufacturer release date', async () => {
    const old = await seed(); const recent = await seed('Sony WH-1000XM5', '002');
    await pool.query("UPDATE products SET created_at=CURRENT_TIMESTAMP-INTERVAL '30 days' WHERE id=$1", [old]);
    const response = await app.inject('/api/search?q=Sony%20WH-1000XM5&sort=newest');
    expect(response.json().products.map((product: { id: string }) => product.id)).toEqual([recent, old]);
  });
  it('suggests only bounded, deduplicated real persisted catalog names/models/brands', async () => {
    await bothSources(); await seed('Sony WH-1000XM5', '002');
    const response = await app.inject('/api/search/suggestions?q=So&market=GE');
    expect(response.statusCode, response.body).toBe(200);
    const values = response.json().suggestions as string[];
    expect(values).toContain('Sony'); expect(values).toContain('Sony WH-1000XM5');
    expect(new Set(values.map(value => value.toLowerCase())).size).toBe(values.length); expect(values.length).toBeLessThanOrEqual(8);
    expect(values).not.toContain('So gaming'); expect(values).not.toContain('So wireless');
    expect(providerRegistry.get('ebay')!.search).toHaveBeenCalledTimes(1);
    expect((await app.inject('/api/search/suggestions?q=%25&market=GE')).json().suggestions).toEqual([]);
  });
  it('suggestions exclude stale AliExpress rows and disabled merchant-market links', async () => {
    await seed('Synthetic Rare Catalog Product');
    await metadata(['_byb','feed','lastSeenAt'], '2000-01-01T00:00:00.000Z');
    expect((await app.inject('/api/search/suggestions?q=Synthetic&market=GE')).json().suggestions).toEqual([]);
    await seed('Synthetic Rare Catalog Product');
    await pool.query('UPDATE market_merchants SET is_enabled=false');
    expect((await app.inject('/api/search/suggestions?q=Synthetic&market=GE')).json().suggestions).toEqual([]);
  });

});
