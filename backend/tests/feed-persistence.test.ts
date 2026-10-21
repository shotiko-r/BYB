import { initializeFeedTestSchema } from './helpers/feed-test-db.js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FeedRepository } from '../src/modules/feed/repository.js';
import { mapAliExpressRow, ALIEXPRESS_HEADERS } from '../src/modules/feed/merchants/aliexpress.js';
import { applyFeed } from '../src/modules/feed/importer.js';
import { loadFeedConfig } from '../src/modules/feed/config.js';
import { runFeedCli } from '../src/scripts/import-admitad-feed.js';

// Explicit test opt-in only; never use application DATABASE_URL.
const url = process.env.BYB_FEED_TEST_DATABASE_URL;
const schema = `feed_test_${randomUUID().replaceAll('-', '')}`;
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema},public`, max: 6 });
const repo = new FeedRepository(pool);
const context = { feedKey: 'aliexpress-ww', markets: ['GE'], syncRunId: randomUUID() };
const raw = (id = '001', changes: Record<string, string> = {}) => ({ id, name: 'Synthetic', url: 'https://shop.example/item',
  category: 'Unreviewed', currencyId: 'USD', param: '', picture: 'https://img.example/a.jpg', oldprice: '15', price: '10', ...changes });
function mapped(id = '001', changes: Record<string, string> = {}) {
  const result = mapAliExpressRow(raw(id, changes), { programNamespace: context.feedKey });
  if (!result.ok) throw new Error('fixture');
  return result.value;
}
const counts = async () => (await pool.query('SELECT (SELECT count(*)::int FROM products) AS products, (SELECT count(*)::int FROM offers) AS offers')).rows[0];
const write = (...products: ReturnType<typeof mapped>[]) => repo.writeBatch(products, context);

describe.skipIf(!url)('feed persistence: disposable PostgreSQL', () => {
  beforeAll(async () => {
    await initializeFeedTestSchema(pool, schema);
  });
  beforeEach(async () => { await pool.query('TRUNCATE products CASCADE'); });
  afterAll(async () => { await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });

  it('inserts once, deduplicates, and updates mutable observations without changing identity', async () => {
    await write(mapped(), mapped());
    expect(await counts()).toEqual({ products: 1, offers: 1 });
    const first = (await pool.query('SELECT id,slug,category_id FROM products')).rows[0];
    await write(mapped());
    for (const changes of [{ price: '11' }, { name: 'New title' }, { category: 'New raw category' },
      { url: 'https://shop.example/new' }, { oldprice: '17' }, { oldprice: 'invalid' }]) {
      await write(mapped('001', changes));
      expect(await counts()).toEqual({ products: 1, offers: 1 });
      expect((await pool.query('SELECT id,slug,category_id FROM products')).rows[0]).toEqual(first);
    }
    await write(mapped('001', { name: 'Changed', price: '12', category: 'Another', oldprice: '18', param: 'discount|5%|;commissionRate|2%|;shopId|0012|', url: 'https://shop.example/final' }));
    const offer = (await pool.query('SELECT * FROM offers')).rows[0];
    expect(offer).toMatchObject({ price_amount: 1200, external_product_id: '001', destination_url: 'https://shop.example/final' });
    expect(offer.affiliate_metadata).toMatchObject({ oldPriceAmount: 1800, merchantCategory: 'Another', sourceProductId: '001', discountBps: 500, commissionRateBps: 200, shopId: '0012',
      _byb: { provenance: { version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' }, sourceType: 'admitad-feed',
        feed: { key: context.feedKey, mapperVersion: 1, scopeVersion: 1, syncRunId: context.syncRunId, importedAt: expect.any(String), lastSeenAt: expect.any(String) } } });
    await write(mapped('001', { oldprice: '' }));
    expect((await pool.query('SELECT affiliate_metadata FROM offers')).rows[0].affiliate_metadata).not.toHaveProperty('oldPriceAmount');
    await write(mapped('001', { oldprice: 'bad' }));
    expect((await pool.query('SELECT affiliate_metadata FROM offers')).rows[0].affiliate_metadata).not.toHaveProperty('oldPriceAmount');
    expect((await pool.query("SELECT slug FROM categories WHERE id=$1", [first.category_id])).rows[0].slug).toBe('aliexpress-feed');
  });

  it('reactivates matching inactive products and offers without stale cleanup', async () => {
    await write(mapped(), mapped('002'));
    await pool.query('UPDATE products SET is_active=false');
    await pool.query('UPDATE offers SET is_active=false');
    await write(mapped());
    expect(await counts()).toEqual({ products: 2, offers: 2 });
    expect((await pool.query('SELECT count(*)::int AS n FROM products WHERE is_active')).rows[0].n).toBe(1);
    expect((await pool.query('SELECT count(*)::int AS n FROM offers WHERE is_active')).rows[0].n).toBe(1);
    await write(mapped('002'));
    await write(mapped());
    expect((await pool.query('SELECT count(*)::int AS n FROM offers WHERE is_active')).rows[0].n).toBe(2);
  });

  it('rolls back the whole batch while retaining a previous committed batch', async () => {
    await write(mapped('001'));
    await expect(write(mapped('002'), { ...mapped('003'), priceAmount: 2147483648 })).rejects.toThrow();
    expect(await counts()).toEqual({ products: 1, offers: 1 });
  });

  it('fails closed on missing merchant or market and resolves configured markets', async () => {
    await expect(repo.writeBatch([mapped()], { ...context, markets: ['ZZ'] })).rejects.toMatchObject({ code: 'MARKET_NOT_FOUND' });
    await pool.query("UPDATE merchants SET is_active=false WHERE code='aliexpress'");
    try { await expect(write(mapped())).rejects.toMatchObject({ code: 'MERCHANT_NOT_FOUND' }); }
    finally { await pool.query("UPDATE merchants SET is_active=true WHERE code='aliexpress'"); }
    expect(await counts()).toEqual({ products: 0, offers: 0 });
    await repo.writeBatch([mapped()], { ...context, markets: ['GE', 'AM'] });
    expect(await counts()).toEqual({ products: 1, offers: 2 });
    expect((await pool.query('SELECT DISTINCT m.code FROM offers o JOIN merchants m ON m.id=o.merchant_id')).rows).toEqual([{ code: 'aliexpress' }]);
  });

  it('refuses overlap and releases locks after callback and batch failure', async () => {
    await expect(repo.withLocks(context.feedKey, context.markets, async () => {
      await expect(repo.withLocks(context.feedKey, context.markets, async () => {})).rejects.toMatchObject({ code: 'FEED_LOCKED' });
      await write({ ...mapped(), priceAmount: 2147483648 });
    })).rejects.toThrow();
    await repo.withLocks(context.feedKey, context.markets, async () => { await write(mapped()); });
    expect(await counts()).toEqual({ products: 1, offers: 1 });
  });

  it('applies bounded batches with one safe run ID and never stores feed credentials', async () => {
    const config = loadFeedConfig({ ADMITAD_ALIEXPRESS_FEED_ENABLED: 'true', ADMITAD_ALIEXPRESS_FEED_URL: 'https://feed.example/private-secret' });
    const csv = ALIEXPRESS_HEADERS.join(';') + '\n' + ['001', '002', '003'].map(id => ALIEXPRESS_HEADERS.map(key => raw(id)[key]).join(';')).join('\n');
    const result = await applyFeed({ ...config, maxProducts: 2 }, repo, { batchSize: 1, transport: async () => new Response(csv) });
    expect(result).toMatchObject({ status: 'success', completionReason: 'limit_reached', committedProducts: 2, committedBatches: 2 });
    expect(result.syncRunId).toMatch(/^[a-f0-9-]{36}$/);
    const data = (await pool.query('SELECT affiliate_metadata FROM offers')).rows;
    expect(data.every(row => row.affiliate_metadata._byb.feed.syncRunId === result.syncRunId)).toBe(true);
    expect(JSON.stringify(data)).not.toContain('private-secret');
    expect(await counts()).toEqual({ products: 2, offers: 2 });
  });

  it('reports partial commits on parser failure without cleaning absent rows', async () => {
    const config = loadFeedConfig({ ADMITAD_ALIEXPRESS_FEED_ENABLED: 'true', ADMITAD_ALIEXPRESS_FEED_URL: 'https://feed.example/secret' });
    const csv = ALIEXPRESS_HEADERS.join(';') + '\n' + ALIEXPRESS_HEADERS.map(key => raw()[key]).join(';') + '\n';
    const result = await applyFeed(config, repo, { batchSize: 1, transport: async () => new Response(new ReadableStream({
      async start(controller) {
        controller.enqueue(Buffer.from(csv + '002;'));
        // Wait for the first transaction before introducing a later stream error.
        for (let i = 0; i < 100; i++) {
          if ((await counts()).products === 1) break;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        controller.enqueue(Buffer.from('"unterminated'));
        controller.close();
      },
    })) });
    expect(result).toMatchObject({ status: 'failed', committedProducts: 1, committedBatches: 1 });
    expect(await counts()).toEqual({ products: 1, offers: 1 });
    await repo.withLocks(context.feedKey, context.markets, async () => {});
  });
});

describe('apply CLI safety', () => {
  it.each([[], ['--dry-run', '--apply'], ['--apply'], ['--apply', '--batch-size', '251']])('refuses unsafe arguments/config %j', async (...flags) => {
    const output: string[] = [];
    expect(await runFeedCli(['--feed', 'aliexpress-ww', ...flags], {}, { stdout: text => output.push(text), stderr: text => output.push(text) })).toBe(1);
    expect(output.join()).toContain('failed');
  });
});
