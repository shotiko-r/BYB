import { query } from '../../config/database.js';
import { offerEligibilitySql, eligibleSources, feedSearchPolicy } from '../provider/provenance.js';
import type { ProviderRegistry } from '../provider/types.js';
import { DiscoveryProductSchema, type DiscoveryProduct, type DiscoverySectionKey } from '@byb/shared/types';

export const DISCOVERY_ALGORITHM_VERSION = 'discovery-v1';
export const EBAY_DISCOVERY_MAX_AGE_HOURS = 24;
export interface DiscoveryCandidate {
  product: DiscoveryProduct;
  categoryKey: string | null;
}
export interface CandidateRequest {
  marketId: string; market: string; section: DiscoverySectionKey; limit: number;
  currency?: string; bucket: string; now: Date;
}
export interface DiscoveryRepository {
  candidates(request: CandidateRequest): Promise<DiscoveryCandidate[]>;
}

/** Read-only persisted catalog. Source descriptors supply policy, never retrieval. */
export class PostgresDiscoveryRepository implements DiscoveryRepository {
  constructor(private readonly registry: ProviderRegistry) {}

  async candidates(request: CandidateRequest): Promise<DiscoveryCandidate[]> {
    // Discovery is always real-production only, including in mock-only development.
    const marketProviders = new Set(this.registry.getForMarket(request.market).map(provider => provider.code));
    const sources = (eligibleSources(this.registry) ?? []).filter(source => marketProviders.has(source.provider)
      && source.mode === 'real' && source.environment === 'production');
    if (!sources.length) return [];
    const params: unknown[] = [request.marketId];
    const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
    const eligibility = offerEligibilitySql(sources, params, feedSearchPolicy(this.registry));
    const now = bind(request.now.toISOString());
    const age = bind(EBAY_DISCOVERY_MAX_AGE_HOURS);
    const budget = request.section === 'under_25_usd' ? 2500 : request.section === 'under_50_usd' ? 5000 : undefined;
    const currency = budget !== undefined ? 'USD' : request.currency;
    const currencySql = currency ? ` AND o.currency_code = ${bind(currency)}` : '';
    const budgetSql = budget !== undefined ? ` AND o.price_amount < ${bind(budget)}` : '';
    const salt = bind([DISCOVERY_ALGORITHM_VERSION, request.section, request.market, request.bucket].join('|'));
    const poolSize = bind(Math.min(200, Math.max(40, request.limit * 10)));
    const newest = request.section === 'new_on_byb' ? 'first_seen_at DESC,' : '';

    const result = await query<{ product: DiscoveryProduct; category_key: string | null }>(`
      WITH eligible AS (
        SELECT p.id, p.slug, p.name, p.brand, p.image_url, p.category_id, p.created_at, p.updated_at,
          CASE WHEN jsonb_typeof(p.attributes->'condition') = 'string'
            AND length(p.attributes->>'condition') <= 80 THEN jsonb_build_object('condition', p.attributes->>'condition')
            ELSE '{}'::jsonb END AS safe_attributes,
          CASE WHEN c.is_active AND c.slug <> 'aliexpress-feed' THEN c.slug END AS category_key,
          MIN(o.created_at) AS first_seen_at,
          (array_agg(m.code ORDER BY o.currency_code, o.price_amount, o.id))[1] AS merchant_key,
          COUNT(*)::int AS offer_count, COUNT(DISTINCT m.id)::int AS merchant_count,
          json_agg(json_build_object(
            'id', o.id, 'productId', p.id, 'merchantId', m.id, 'marketId', o.market_id,
            'externalProductId', o.external_product_id, 'priceAmount', o.price_amount, 'currencyCode', o.currency_code,
            'availability', o.availability, 'shippingInfo', '{}'::jsonb, 'destinationUrl', o.destination_url,
            'affiliateMetadata', '{}'::jsonb, 'lastCheckedAt', o.last_checked_at, 'isActive', true,
            'createdAt', o.created_at, 'updatedAt', o.updated_at,
            'merchant', json_build_object('id', m.id, 'code', m.code, 'name', m.name, 'logoUrl', m.logo_url)
          ) ORDER BY o.currency_code, o.price_amount, o.id) AS offers
        FROM products p JOIN offers o ON o.product_id = p.id
        JOIN merchants m ON m.id = o.merchant_id
        JOIN markets mk ON mk.id = o.market_id
        JOIN market_merchants mm ON mm.market_id = mk.id AND mm.merchant_id = m.id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_active AND o.is_active AND m.is_active AND mk.is_active AND mm.is_enabled
          AND o.market_id = $1 AND o.availability <> 'out_of_stock'
          AND o.price_amount >= 0 AND o.currency_code ~ '^[A-Z]{3}$'
          AND p.created_at <= ${now}::timestamptz AND o.created_at <= ${now}::timestamptz
          ${eligibility}${currencySql}${budgetSql}
          AND (m.code <> 'ebay' OR (o.last_checked_at <= ${now}::timestamptz
            AND o.last_checked_at >= ${now}::timestamptz - ${age}::double precision * INTERVAL '1 hour'))
        GROUP BY p.id, c.id
      ), ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY merchant_key ORDER BY ${newest}
          (NULLIF(btrim(image_url), '') IS NOT NULL) DESC, md5(id::text || ${salt}), id) AS pool_rank
        FROM eligible
      )
      SELECT category_key, json_build_object(
        'id', id, 'slug', slug, 'name', name, 'description', NULL, 'brand', brand, 'model', NULL,
        'imageUrl', image_url, 'categoryId', category_id, 'attributes', safe_attributes, 'isActive', true,
        'createdAt', created_at, 'updatedAt', updated_at, 'firstSeenAt', first_seen_at,
        'offers', offers, 'offerCount', offer_count, 'distinctMerchantCount', merchant_count
      ) AS product FROM ranked WHERE pool_rank <= ${poolSize}
      ORDER BY pool_rank, merchant_key, id LIMIT 1000`, params);

    return result.rows.map(row => {
      const product = row.product;
      const iso = (value: string) => new Date(value).toISOString();
      return { categoryKey: row.category_key, product: DiscoveryProductSchema.parse({ ...product,
        createdAt: iso(product.createdAt), updatedAt: iso(product.updatedAt), firstSeenAt: iso(product.firstSeenAt),
        offers: product.offers.map(offer => ({ ...offer, createdAt: iso(offer.createdAt), updatedAt: iso(offer.updatedAt), lastCheckedAt: iso(offer.lastCheckedAt) })),
      }) };
    });
  }
}
