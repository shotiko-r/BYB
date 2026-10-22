import { query } from '../../config/database.js';
import { eligibleSources, feedSearchPolicy, offerEligibilitySql } from '../provider/provenance.js';
import type { ProviderRegistry } from '../provider/types.js';
import { SEARCH_CURRENCIES, type SearchOptions } from '@byb/shared';

export class SearchCatalogRepository {
  constructor(private readonly registry: ProviderRegistry) {}

  private codes(market: string) {
    const sources = eligibleSources(this.registry);
    return this.registry.getForMarket(market).filter(provider => !sources || sources.some(source => source.provider === provider.code)).map(provider => provider.code);
  }

  async options(marketId: string, market: string): Promise<SearchOptions> {
    const [merchants, categories] = await Promise.all([
      query<{ code: string; name: string }>(`SELECT m.code, m.name FROM merchants m
        JOIN market_merchants mm ON mm.merchant_id=m.id
        WHERE mm.market_id=$1 AND mm.is_enabled AND m.is_active AND m.code=ANY($2::text[]) ORDER BY m.code`, [marketId, this.codes(market)]),
      query<{ id: string; slug: string; name: string; parentId: string | null }>(`SELECT id,slug,name,parent_id AS "parentId" FROM categories
        WHERE is_active AND slug <> 'aliexpress-feed' ORDER BY name,id`),
    ]);
    return { merchants: merchants.rows, categories: categories.rows, currencies: [...SEARCH_CURRENCIES] };
  }

  async suggestions(text: string, marketId: string, market: string): Promise<string[]> {
    const sources = (eligibleSources(this.registry) ?? []).filter(source => source.mode === 'real' && source.environment === 'production' && this.codes(market).includes(source.provider));
    if (!sources.length || text.trim().length < 2) return [];
    const params: unknown[] = [marketId];
    const eligibility = offerEligibilitySql(sources, params, feedSearchPolicy(this.registry));
    // Literal matching: user %/_ characters never become wildcard expansion.
    params.push(`%${text.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const pattern = `$${params.length}`;
    const result = await query<{ value: string }>(`WITH catalog AS (
      SELECT DISTINCT p.id,p.name,p.brand,p.model FROM products p
      JOIN offers o ON o.product_id=p.id JOIN merchants m ON m.id=o.merchant_id
      JOIN markets mk ON mk.id=o.market_id
      JOIN market_merchants mm ON mm.market_id=o.market_id AND mm.merchant_id=m.id
      WHERE p.is_active AND o.is_active AND m.is_active AND mk.is_active AND mm.is_enabled AND o.market_id=$1${eligibility}
    ), suggestion_values AS (
      SELECT btrim(value) AS value FROM catalog
      CROSS JOIN LATERAL (VALUES(name),(brand),(model)) AS suggestion(value)
      WHERE length(btrim(value)) BETWEEN 2 AND 300 AND value ILIKE ${pattern} ESCAPE '\\'
        AND lower(btrim(value)) NOT IN ('unknown','n/a','unspecified')
    ), dedup AS (SELECT MIN(value) AS value FROM suggestion_values GROUP BY lower(value))
    SELECT value FROM dedup ORDER BY length(value),lower(value),value LIMIT 8`, params);
    return result.rows.map(row => row.value);
  }
}
