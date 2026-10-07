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
export function offerEligibilitySql(sources: OfferProvenance[] | undefined, params: unknown[]): string {
  if (sources === undefined) return '';
  if (!sources.length) return ' AND FALSE';
  return ` AND (${sources.map(source => {
    params.push(source.provider, JSON.stringify(source));
    return `(m.code = $${params.length - 1} AND o.affiliate_metadata #> '{_byb,provenance}' = $${params.length}::jsonb)`;
  }).join(' OR ')})`;
}
