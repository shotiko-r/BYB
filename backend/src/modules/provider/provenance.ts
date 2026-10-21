import type { FeedSearchPolicy } from './aliexpress-feed.js';
import type { ProviderRegistry, ProductProvider } from './types.js';
export interface OfferProvenance { version: 1; provider: string; mode: 'mock' | 'real'; environment: 'mock' | 'production' | 'sandbox' }
export function provenance(provider: ProductProvider): OfferProvenance {
  return provider.provenance ?? { version: 1, provider: provider.code, mode: 'mock', environment: 'mock' };
}
// Undefined is explicit fixture/development behavior; real mode is fail-closed.
export function eligibleSources(registry: ProviderRegistry): OfferProvenance[] | undefined {
  const sources = registry.getAll().map(provenance);
  return sources.some(source => source.mode === 'real') ? sources.filter(source => source.mode === 'real') : undefined;
}
export function feedSearchPolicy(registry: ProviderRegistry): FeedSearchPolicy | undefined {
  const source = registry.get('aliexpress');
  return source?.retrievalMode === 'persisted-feed' ? source.feedPolicy : undefined;
}

/** Only feed offers receive freshness/market checks; API eBay semantics are unchanged. */
export function feedEligibilitySql(policy: FeedSearchPolicy | undefined, params: unknown[]): string {
  const detected = `(m.code = 'aliexpress' AND (COALESCE(o.affiliate_metadata #>> '{_byb,provenance,mode}', '') = 'real'
    OR COALESCE(o.affiliate_metadata #>> '{_byb,sourceType}', '') = 'admitad-feed'))`;
  if (!policy) return ` AND NOT ${detected}`;
  params.push([...policy.markets], policy.maxAgeHours,
    String.raw`$._byb.feed.lastSeenAt.datetime("YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"")`);
  const market = params.length - 2;
  const age = params.length - 1;
  const timestampPath = params.length;
  return ` AND (NOT ${detected} OR (
    o.affiliate_metadata #> '{_byb,provenance}' = '{"version":1,"provider":"aliexpress","mode":"real","environment":"production"}'::jsonb
    AND m.code = 'aliexpress'
    AND o.affiliate_metadata #>> '{_byb,sourceType}' = 'admitad-feed'
    AND o.affiliate_metadata #>> '{_byb,feed,key}' = 'aliexpress-ww'
    AND EXISTS (SELECT 1 FROM markets fm JOIN market_merchants mm ON mm.market_id = fm.id
      WHERE fm.id = o.market_id AND fm.is_active = true AND fm.code = ANY($${market}::text[])
      AND mm.merchant_id = m.id AND mm.is_enabled = true)
    AND COALESCE(jsonb_path_exists(o.affiliate_metadata, $${timestampPath}::jsonpath, '{}', true), false)
    AND o.affiliate_metadata #>> '{_byb,feed,lastSeenAt}' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    AND o.affiliate_metadata #>> '{_byb,feed,lastSeenAt}' >= to_char((CURRENT_TIMESTAMP - $${age}::double precision * INTERVAL '1 hour') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    AND o.affiliate_metadata #>> '{_byb,feed,lastSeenAt}' <= to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ))`;
}
export function offerEligibilitySql(sources: OfferProvenance[] | undefined, params: unknown[], policy?: FeedSearchPolicy): string {
  if (sources?.length === 0) return ' AND FALSE';
  // Append feed parameters after source parameters to retain existing eBay bindings.
  const sourceSql = sourceEligibilitySql(sources, params);
  return sourceSql + feedEligibilitySql(policy, params);
}
function sourceEligibilitySql(sources: OfferProvenance[] | undefined, params: unknown[]): string {
  if (sources === undefined) return '';
  if (!sources.length) return ' AND FALSE';
  return ` AND (${sources.map(source => {
    params.push(source.provider, JSON.stringify(source));
    return `(m.code = $${params.length - 1} AND o.affiliate_metadata #> '{_byb,provenance}' = $${params.length}::jsonb)`;
  }).join(' OR ')})`;
}
