import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AliExpressFeedProduct } from './merchants/aliexpress.js';

export const DEFAULT_FEED_BATCH_SIZE = 100;
export function validateBatchSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 1 || size > 250) throw new Error('INVALID_BATCH_SIZE');
}
export class FeedPersistenceError extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** Holds session locks separately from the short, checked-out batch transactions. */
export class FeedRepository {
  constructor(private readonly pool: Pool) {}

  async withLocks<T>(feedKey: string, markets: readonly string[], run: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const keys: string[] = [];
    let discard = false;
    try {
      for (const market of [...new Set(markets)].sort()) {
        const key = createHash('sha256').update(`${feedKey}\0${market}`).digest().readBigInt64BE().toString();
        const result = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [key]);
        if (!result.rows[0]?.locked) throw new FeedPersistenceError('FEED_LOCKED');
        keys.push(key);
      }
      return await run();
    } finally {
      try {
        for (const key of keys.reverse()) await client.query('SELECT pg_advisory_unlock($1::bigint)', [key]);
      } catch { discard = true; }
      client.release(discard);
    }
  }

  async writeBatch(products: readonly AliExpressFeedProduct[], context: {
    feedKey: string; markets: readonly string[]; syncRunId: string;
  }): Promise<number> {
    validateBatchSize(products.length);
    if (!context.markets.length || context.markets.some(code => !/^[A-Z]{2}$/.test(code))) {
      throw new FeedPersistenceError('INVALID_MARKETS');
    }
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      const merchantId = await this.lookup(client, 'merchants', 'aliexpress');
      const markets = await Promise.all([...new Set(context.markets)].map(async code => this.lookup(client, 'markets', code)));
      const category = await client.query<{ id: string }>(`INSERT INTO categories (slug, name)
        VALUES ('aliexpress-feed', 'AliExpress feed') ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`);
      const categoryId = category.rows[0]!.id;
      const unique = new Map(products.map(product => [product.sourceIdentity, product]));
      for (const product of [...unique.values()].sort((a, b) => a.sourceIdentity.localeCompare(b.sourceIdentity))) {
        // Recompute rather than trust caller-supplied identity. No titles or URLs in keys.
        const identity = `aliexpress-${createHash('sha256').update(`${context.feedKey}\0${product.externalProductId}`).digest('hex')}`;
        if (identity !== product.sourceIdentity || context.feedKey !== 'aliexpress-ww') throw new FeedPersistenceError('INVALID_IDENTITY');
        // Shared across markets, because the schema's product identity is global.
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [createHash('sha256').update(identity).digest().readBigInt64BE().toString()]);
        const existing = await client.query<{ id: string }>('SELECT id FROM products WHERE slug = $1 LIMIT 2', [identity]);
        if (existing.rows.length > 1) throw new FeedPersistenceError('AMBIGUOUS_IDENTITY');
        const attributes = JSON.stringify({ source: 'admitad-feed', sourceIdentity: identity });
        let productId = existing.rows[0]?.id;
        if (productId) {
          await client.query(`UPDATE products SET name=$2, image_url=$3, attributes=$4, is_active=true,
            updated_at=NOW() WHERE id=$1`, [productId, product.name, product.imageUrl ?? null, attributes]);
        } else {
          const inserted = await client.query<{ id: string }>(`INSERT INTO products (slug,name,image_url,attributes,category_id)
            VALUES ($1,$2,$3,$4,$5) RETURNING id`, [identity, product.name, product.imageUrl ?? null, attributes, categoryId]);
          productId = inserted.rows[0]!.id;
        }
        const now = new Date().toISOString();
        const input = product.affiliateMetadata ?? {};
        // Explicit allowlist: never store a config, raw row, or arbitrary mapper extension.
        const metadata = Object.fromEntries(['oldPriceAmount', 'oldPriceCurrencyCode', 'commissionRateBps', 'discountBps', 'shopId', 'merchantCategory']
          .filter(key => input[key] !== undefined).map(key => [key, input[key]]));
        Object.assign(metadata, { sourceProductId: product.externalProductId, _byb: {
          provenance: { version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' },
          sourceType: 'admitad-feed', feed: { key: context.feedKey, mapperVersion: 1, syncRunId: context.syncRunId,
            importedAt: now, lastSeenAt: now, scopeVersion: 1 },
        } });
        for (const marketId of markets) {
          await client.query(`INSERT INTO offers (product_id,merchant_id,market_id,external_product_id,price_amount,
            currency_code,availability,shipping_info,destination_url,affiliate_metadata,last_checked_at,is_active)
            VALUES ($1,$2,$3,$4,$5,$6,'unknown','{}',$7,$8,$9,true)
            ON CONFLICT (product_id,merchant_id,market_id,external_product_id) DO UPDATE SET
            price_amount=EXCLUDED.price_amount,currency_code=EXCLUDED.currency_code,destination_url=EXCLUDED.destination_url,
            affiliate_metadata=EXCLUDED.affiliate_metadata,last_checked_at=EXCLUDED.last_checked_at,is_active=true,updated_at=NOW()`,
          [productId, merchantId, marketId, product.externalProductId, product.priceAmount, product.currencyCode,
            product.destinationUrl, JSON.stringify(metadata), now]);
        }
      }
      await client.query('COMMIT');
      return unique.size;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw error;
    } finally { client.release(discard); }
  }

  private async lookup(client: PoolClient, table: 'merchants' | 'markets', code: string): Promise<string> {
    const result = await client.query<{ id: string }>(`SELECT id FROM ${table} WHERE code=$1 AND is_active=true`, [code]);
    if (!result.rows[0]) throw new FeedPersistenceError(table === 'merchants' ? 'MERCHANT_NOT_FOUND' : 'MARKET_NOT_FOUND');
    return result.rows[0].id;
  }
}
