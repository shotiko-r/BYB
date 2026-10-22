import { randomUUID } from 'node:crypto';
import pg from 'pg';
import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCOVERY_SECTION_KEYS, DiscoveryHomeSchema, type DiscoveryProduct } from '@byb/shared/types';
const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ query: db }));
import { initializeFeedTestSchema } from './helpers/feed-test-db.js';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { registerProviders } from '../src/modules/provider/register.js';
import { PostgresDiscoveryRepository, type DiscoveryCandidate } from '../src/modules/discovery/repository.js';
import { allocate, DiscoveryService } from '../src/modules/discovery/service.js';
import { discoveryRoutes } from '../src/modules/discovery/routes.js';

const date = new Date('2026-10-21T12:00:00.000Z');
const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const market = { id: uuid(900), code: 'GE', name: 'Georgia', locale: 'ka-GE', language: 'ka', currencyCode: 'GEL', currencySymbol: '₾', isActive: true, createdAt: date.toISOString(), updatedAt: date.toISOString() };
function candidate(index: number, merchant = 'ebay', category: string | null = null): DiscoveryCandidate {
  const id = uuid(index);
  const product: DiscoveryProduct = { id, slug: `listing-${index}`, name: `Listing ${index}`, brand: null, model: null,
    description: null, categoryId: null, imageUrl: 'https://images.example.test/item.jpg', attributes: { condition: 'Used' },
    isActive: true, createdAt: date.toISOString(), updatedAt: date.toISOString(), firstSeenAt: date.toISOString(), offerCount: 1, distinctMerchantCount: 1,
    offers: [{ id: uuid(index + 1000), productId: id, merchantId: uuid(merchant === 'ebay' ? 901 : 902), marketId: market.id,
      externalProductId: `item-${index}`, priceAmount: 1500, currencyCode: 'USD', availability: 'unknown', shippingInfo: {}, affiliateMetadata: {},
      destinationUrl: 'https://affiliate.example.test/click?synthetic=1', lastCheckedAt: date.toISOString(), isActive: true,
      createdAt: date.toISOString(), updatedAt: date.toISOString(), merchant: { id: uuid(merchant === 'ebay' ? 901 : 902), code: merchant, name: merchant, logoUrl: null } }],
  };
  return { product, categoryKey: category };
}
function registry() {
  const result = new InMemoryProviderRegistry();
  registerProviders(result, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'synthetic', EBAY_CLIENT_SECRET: 'synthetic',
    ALIEXPRESS_SEARCH_ENABLED: true, ADMITAD_ALIEXPRESS_FEED_MARKETS: 'GE' }, vi.fn(() => { throw new Error('Discovery called live transport'); }));
  return result;
}

describe('discovery allocation and partial responses', () => {
  it('is deterministic for unchanged input and same UTC day, independent of DB row order', () => {
    const pool = Array.from({ length: 50 }, (_, i) => candidate(i + 1));
    const select = (items: DiscoveryCandidate[], bucket: string) => allocate(items, 'discover', 'GE', bucket, 4, new Set()).map(item => item.product.id);
    expect(select(pool, '2026-10-21')).toEqual(select([...pool].reverse(), '2026-10-21'));
    expect(select(pool, '2026-10-21')).not.toEqual(select(pool, '2026-10-22'));
  });
  it('ranks first-seen days before rotation for New on BYB', () => {
    const old = candidate(1); old.product.firstSeenAt = '2026-10-19T23:00:00.000Z';
    const recent = candidate(2);
    expect(allocate([old, recent], 'new_on_byb', 'GE', '2026-10-21', 1, new Set())[0]?.product.id).toBe(recent.product.id);
  });
  it('prefers image evidence without inventing relevance or popularity', () => {
    const missing = candidate(1); missing.product.imageUrl = null;
    expect(allocate([missing, candidate(2)], 'discover', 'GE', '2026-10-21', 1, new Set())[0]?.product.id).toBe(uuid(2));
  });
  it('balances merchants and reliable categories when candidates exist', () => {
    const pool = Array.from({ length: 20 }, (_, i) => candidate(i + 1, i < 10 ? 'ebay' : 'aliexpress', i % 2 ? 'audio' : 'phones'));
    const selected = allocate(pool, 'discover', 'GE', '2026-10-21', 4, new Set());
    expect(selected.filter(item => item.product.offers[0]!.merchant?.code === 'ebay')).toHaveLength(2);
    expect(selected.filter(item => item.categoryKey === 'audio')).toHaveLength(2);
  });
  it('ignores fallback categories and relaxes caps in sparse catalogs', () => {
    const pool = Array.from({ length: 4 }, (_, i) => candidate(i + 1, 'aliexpress', null));
    const used = new Set<string>();
    expect(allocate(pool, 'discover', 'GE', '2026-10-21', 4, used)).toHaveLength(4);
    expect(allocate(pool, 'more_to_explore', 'GE', '2026-10-21', 4, used)).toHaveLength(4);
  });
  it('deduplicates product and exact source listing IDs without merging equal titles', () => {
    const first = candidate(1); const duplicate = candidate(2);
    duplicate.product.offers[0]!.externalProductId = first.product.offers[0]!.externalProductId;
    const different = candidate(3); different.product.name = first.product.name;
    const selected = allocate([first, duplicate, different], 'discover', 'GE', '2026-10-21', 4, new Set());
    expect(selected).toHaveLength(2);
    expect(selected.some(item => item.product.id === different.product.id)).toBe(true);
  });
  it('allocates disjoint sections when there are enough products and keeps stable section order', async () => {
    const candidates = vi.fn().mockResolvedValue(Array.from({ length: 40 }, (_, i) => candidate(i + 1)));
    const service = new DiscoveryService({ candidates }, { findByCode: vi.fn().mockResolvedValue(market) }, () => date);
    const result = await service.home('GE');
    expect(result.sections.map(section => section.key)).toEqual([...DISCOVERY_SECTION_KEYS]);
    expect(new Set(result.sections.flatMap(section => section.products.map(product => product.id))).size).toBe(20);
    expect(candidates).toHaveBeenCalledTimes(5);
    expect(DiscoveryHomeSchema.safeParse(result).success).toBe(true);
  });
  it('returns successful siblings when a section fails, without leaking error text', async () => {
    const candidates = vi.fn().mockImplementation(async request => {
      if (request.section === 'under_25_usd') throw new Error('synthetic-secret');
      return [candidate(1)];
    });
    const service = new DiscoveryService({ candidates }, { findByCode: vi.fn().mockResolvedValue(market) }, () => date);
    const result = await service.home('GE');
    expect(result.sections[2]).toMatchObject({ status: 'unavailable', products: [] });
    expect(result.sections[0]?.products).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('synthetic-secret');
  });
  it('rejects missing/inactive markets and reports a total repository outage', async () => {
    const candidates = vi.fn().mockRejectedValue(new Error('synthetic-secret'));
    await expect(new DiscoveryService({ candidates }, { findByCode: vi.fn().mockResolvedValue(null) }).home('ZZ')).rejects.toMatchObject({ statusCode: 404 });
    await expect(new DiscoveryService({ candidates }, { findByCode: vi.fn().mockResolvedValue({ ...market, isActive: false }) }).home('GE')).rejects.toMatchObject({ statusCode: 404 });
    await expect(new DiscoveryService({ candidates }, { findByCode: vi.fn().mockResolvedValue(market) }).home('GE')).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('discovery routes', () => {
  it('validates bounded inputs, supports single section, and masks internal failures', async () => {
    const home = vi.fn().mockResolvedValue({ market: 'GE', generatedAt: date.toISOString(), rotationBucket: '2026-10-21', algorithmVersion: 'discovery-v1', sections: [] });
    const app = Fastify(); await app.register(discoveryRoutes, { prefix: '/api', service: { home } });
    for (const query of ['limit=0', 'limit=21', 'section=popular', 'currency=usd', 'market=bad', 'section=under_25_usd&currency=GEL']) {
      expect((await app.inject(`/api/discovery?${query}`)).statusCode).toBe(400);
    }
    const response = await app.inject('/api/discovery?market=ge&section=new_on_byb&limit=6');
    expect(response.statusCode).toBe(200); expect(home).toHaveBeenLastCalledWith('GE', 6, undefined, ['new_on_byb']);
    expect((await app.inject('/api/discovery/home?market=GE')).headers['cache-control']).toBe('no-store');
    home.mockRejectedValue(new Error('synthetic-secret'));
    const failed = await app.inject('/api/discovery/home'); expect(failed.statusCode).toBe(503); expect(failed.body).not.toContain('synthetic-secret');
    await app.close();
  });
});

describe('discovery query policy', () => {
  beforeEach(() => { db.mockReset(); db.mockResolvedValue({ rows: [] }); });
  it('fails closed with no real production source rather than displaying mock fixtures', async () => {
    const mocks = new InMemoryProviderRegistry(); registerProviders(mocks);
    const repository = new PostgresDiscoveryRepository(mocks);
    expect(await repository.candidates({ marketId: market.id, market: 'GE', section: 'discover', limit: 4, bucket: '2026-10-21', now: date })).toEqual([]);
    expect(db).not.toHaveBeenCalled();
  });
  it('uses only SELECT with bounded merchant pools and shared provenance/feed checks', async () => {
    const repository = new PostgresDiscoveryRepository(registry());
    await repository.candidates({ marketId: market.id, market: 'GE', section: 'under_25_usd', limit: 4, bucket: '2026-10-21', now: date });
    const [sql, params] = db.mock.calls[0]!;
    for (const text of ['mm.is_enabled', 'mk.is_active', 'p.is_active', 'o.is_active', 'm.is_active', 'last_checked_at', 'lastSeenAt', 'o.price_amount <', 'LIMIT 1000']) expect(sql).toContain(text);
    expect(params).toContain('USD'); expect(params).toContain(2500); expect(params).toContain(24);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });
  it('excludes registered sources that do not support the requested market', async () => {
    const sources = registry();
    const repository = new PostgresDiscoveryRepository(sources);
    expect(await repository.candidates({ marketId: market.id, market: 'ZZ', section: 'discover', limit: 4, bucket: '2026-10-21', now: date })).toEqual([]);
    expect(db).not.toHaveBeenCalled();
  });
});

const url = process.env.BYB_FEED_TEST_DATABASE_URL;
const schema = `search_test_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public` });
describe.skipIf(!url)('discovery PostgreSQL eligibility and serialization', () => {
  let now: Date;
  let ge: string;
  const sources = registry();
  const live = vi.spyOn(sources.get('ebay')!, 'search');
  const feed = vi.spyOn(sources.get('aliexpress')!, 'search');
  const repository = new PostgresDiscoveryRepository(sources);
  const request = (section: typeof DISCOVERY_SECTION_KEYS[number] = 'discover') => ({ marketId: ge, market: 'GE', section, limit: 4, bucket: now.toISOString().slice(0, 10), now });
  async function seed(options: { merchant?: string; price?: number; currency?: string; age?: number; metadata?: unknown; market?: string; active?: boolean; category?: string } = {}) {
    const merchant = options.merchant ?? 'ebay';
    const id = randomUUID(); const offerId = randomUUID();
    const observed = new Date(now.getTime() - (options.age ?? 1) * 3600000).toISOString();
    const metadata = options.metadata ?? { sensitive: 'synthetic-secret', _byb: { provenance: { version: 1, provider: merchant, mode: 'real', environment: 'production' },
      ...(merchant === 'aliexpress' ? { sourceType: 'admitad-feed', feed: { key: 'aliexpress-ww', lastSeenAt: observed } } : {}) } };
    await pool.query(`INSERT INTO products(id,slug,name,image_url,attributes,is_active,category_id,created_at) VALUES($1::uuid,$1::text,'Synthetic listing','https://images.example.test/a.jpg',$2,$3,(SELECT id FROM categories WHERE slug=$4),$5)`,
      [id, JSON.stringify({ condition: 'Used', conditionId: 'internal-id', seller: { private: 'synthetic-secret' }, source: merchant === 'ebay' ? 'ebay_browse' : 'admitad-feed' }), options.active ?? true, options.category ?? 'headphones', new Date(now.getTime() - 86400000).toISOString()]);
    await pool.query(`INSERT INTO offers(id,product_id,merchant_id,market_id,external_product_id,price_amount,currency_code,destination_url,affiliate_metadata,last_checked_at,created_at)
      VALUES($1,$2::uuid,(SELECT id FROM merchants WHERE code=$3),(SELECT id FROM markets WHERE code=$4),$2::text,$5,$6,'https://affiliate.example.test/click?tracked=synthetic',$7,$8,$9)`,
      [offerId, id, merchant, options.market ?? 'GE', options.price ?? 1500, options.currency ?? 'USD', JSON.stringify(metadata), observed, new Date(now.getTime() - 86400000).toISOString()]);
    return { id, offerId };
  }
  beforeAll(async () => {
    await initializeFeedTestSchema(pool, schema);
    now = new Date((await pool.query('SELECT CURRENT_TIMESTAMP AS now')).rows[0].now);
    ge = (await pool.query("SELECT id FROM markets WHERE code='GE'")).rows[0].id;
    db.mockImplementation((sql, params) => pool.query(sql, params));
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE products CASCADE');
    await pool.query('UPDATE merchants SET is_active=true'); await pool.query('UPDATE markets SET is_active=true');
    await pool.query('UPDATE market_merchants SET is_enabled=true');
    live.mockClear(); feed.mockClear();
  });
  afterAll(async () => { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });
  it('returns both merchants with source currency/condition and unchanged tracked destination, never live retrieval', async () => {
    await seed(); await seed({ merchant: 'aliexpress' });
    const result = await repository.candidates(request());
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item.product.attributes).toEqual({ condition: 'Used' });
      expect(item.product.offers[0]?.affiliateMetadata).toEqual({});
      expect(item.product.offers[0]?.shippingInfo).toEqual({});
      expect(item.product.offers[0]?.destinationUrl).toBe('https://affiliate.example.test/click?tracked=synthetic');
      expect(item.product.offerCount).toBe(1); expect(item.product.distinctMerchantCount).toBe(1);
      expect(JSON.stringify(item.product)).not.toContain('synthetic-secret');
    }
    expect(live).not.toHaveBeenCalled(); expect(feed).not.toHaveBeenCalled();
  });
  it('serves the actual combined route without writes or provider calls', async () => {
    await seed(); await seed({ merchant: 'aliexpress' });
    const service = new DiscoveryService(repository, { findByCode: vi.fn().mockResolvedValue({ ...market, id: ge }) }, () => now);
    const app = Fastify(); await app.register(discoveryRoutes, { prefix: '/api', service });
    const response = await app.inject('/api/discovery/home?market=GE');
    expect(response.statusCode).toBe(200);
    const body = DiscoveryHomeSchema.parse(response.json());
    expect(body.sections.map(section => section.key)).toEqual([...DISCOVERY_SECTION_KEYS]);
    expect(body.sections.every(section => section.status === 'ok')).toBe(true);
    expect(body.sections[0]?.products).toHaveLength(2);
    expect(live).not.toHaveBeenCalled(); expect(feed).not.toHaveBeenCalled();
    expect(Number((await pool.query('SELECT count(*) FROM products')).rows[0].count)).toBe(2);
    await app.close();
  });
  it.each([['under_25_usd', 2500], ['under_50_usd', 5000]] as const)('enforces strict %s boundaries and excludes non-USD', async (section, threshold) => {
    const yes = await seed({ price: threshold - 1 });
    await seed({ price: threshold }); await seed({ price: threshold + 1 }); await seed({ price: 1, currency: 'GEL' });
    const result = await repository.candidates(request(section));
    expect(result.map(item => item.product.id)).toEqual([yes.id]);
  });
  it.each(['ebay', 'aliexpress'])('excludes stale/future %s observations without deleting rows', async merchant => {
    await seed({ merchant, age: 25 }); await seed({ merchant, age: -1 }); await seed({ merchant });
    expect(await repository.candidates(request())).toHaveLength(1);
    expect(Number((await pool.query('SELECT count(*) FROM offers')).rows[0].count)).toBe(3);
  });
  it('includes the exact eBay 24-hour boundary and excludes older observations', async () => {
    const atBoundary = await seed({ age: 24 });
    await seed({ age: 24.001 });
    expect((await repository.candidates(request())).map(item => item.product.id)).toEqual([atBoundary.id]);
  });
  it('filters qualifying offers before card counts and preserves all source currencies on broad shelves', async () => {
    const usd = await seed({ merchant: 'aliexpress', price: 2400 });
    const gel = await seed({ price: 10, currency: 'GEL' });
    // A preexisting shared product is supported without discovery performing any merge.
    await pool.query('UPDATE offers SET product_id=$1 WHERE id=$2', [usd.id, gel.offerId]);
    await pool.query('DELETE FROM products WHERE id=$1', [gel.id]);
    const broad = (await repository.candidates(request()))[0]!.product;
    expect(broad.offerCount).toBe(2); expect(broad.distinctMerchantCount).toBe(2);
    expect(broad.offers.map(offer => offer.currencyCode)).toEqual(['GEL', 'USD']);
    const budget = (await repository.candidates(request('under_25_usd')))[0]!.product;
    expect(budget.offerCount).toBe(1); expect(budget.distinctMerchantCount).toBe(1);
    expect(budget.offers[0]?.currencyCode).toBe('USD'); expect(budget.offers[0]?.priceAmount).toBe(2400);
  });
  it.each(['product', 'offer', 'merchant', 'market', 'disabled', 'stock', 'provenance'])('excludes %s ineligibility', async kind => {
    const item = await seed();
    if (kind === 'product') await pool.query('UPDATE products SET is_active=false');
    if (kind === 'offer') await pool.query('UPDATE offers SET is_active=false');
    if (kind === 'merchant') await pool.query("UPDATE merchants SET is_active=false WHERE code='ebay'");
    if (kind === 'market') await pool.query("UPDATE markets SET is_active=false WHERE code='GE'");
    if (kind === 'disabled') await pool.query('UPDATE market_merchants SET is_enabled=false');
    if (kind === 'stock') await pool.query("UPDATE offers SET availability='out_of_stock'");
    if (kind === 'provenance') await pool.query("UPDATE offers SET affiliate_metadata='{}'");
    expect(await repository.candidates(request())).toEqual([]);
    expect(item.id).toBeTruthy();
  });
  it.each(['mock', 'sandbox', 'wrong-provider', 'missing-freshness', 'malformed-freshness'])('excludes AliExpress %s metadata', async kind => {
    const metadata = { _byb: { provenance: { version: 1, provider: kind === 'wrong-provider' ? 'ebay' : 'aliexpress', mode: kind === 'mock' ? 'mock' : 'real', environment: kind === 'sandbox' ? 'sandbox' : 'production' },
      sourceType: 'admitad-feed', feed: { key: 'aliexpress-ww', ...(kind === 'missing-freshness' ? {} : { lastSeenAt: kind === 'malformed-freshness' ? 'invalid' : new Date(now.getTime() - 60000).toISOString() }) } } };
    await seed({ merchant: 'aliexpress', metadata });
    expect(await repository.candidates(request())).toEqual([]);
  });
  it('scopes markets, honors feed allowlist, and does not treat feed fallback as a real category', async () => {
    await seed({ market: 'AM' }); await seed({ merchant: 'aliexpress', market: 'AM' });
    await pool.query("INSERT INTO categories(slug,name) VALUES('aliexpress-feed','AliExpress feed') ON CONFLICT DO NOTHING");
    await seed({ merchant: 'aliexpress', category: 'aliexpress-feed' });
    const result = await repository.candidates(request()); expect(result).toHaveLength(1); expect(result[0]?.categoryKey).toBeNull();
    const am = (await pool.query("SELECT id FROM markets WHERE code='AM'")).rows[0].id;
    const armenia = await repository.candidates({ ...request(), marketId: am, market: 'AM' });
    expect(armenia).toHaveLength(1); expect(armenia[0]?.product.offers[0]?.merchant?.code).toBe('ebay');
  });
});
