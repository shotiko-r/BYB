import { describe, expect, it } from 'vitest';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { registerProviders } from '../src/modules/provider/register.js';
import { eligibleSources, offerEligibilitySql, provenance } from '../src/modules/provider/provenance.js';
const real = { version: 1 as const, provider: 'ebay', mode: 'real' as const, environment: 'production' as const };
describe('offer-source eligibility', () => {
  it('keeps explicit fixture mode usable and identifies all newly fetched mocks', () => {
    const registry = new InMemoryProviderRegistry(); registerProviders(registry);
    expect(eligibleSources(registry)).toBeUndefined();
    expect(registry.getAll().map(provenance)).toEqual(['amazon', 'temu', 'aliexpress', 'ebay'].map(provider => ({ version: 1, provider, mode: 'mock', environment: 'mock' })));
  });
  it('real mode permits only explicitly configured real sources', () => {
    const registry = new InMemoryProviderRegistry();
    registerProviders(registry, { EBAY_PROVIDER_MODE: 'real', EBAY_CLIENT_ID: 'fixture', EBAY_CLIENT_SECRET: 'fixture' });
    expect(eligibleSources(registry)).toEqual([real]);
    const params: unknown[] = ['market'];
    const sql = offerEligibilitySql(eligibleSources(registry), params);
    expect(sql).toContain("o.affiliate_metadata #> '{_byb,provenance}' = $3::jsonb");
    expect(params).toEqual(['market', 'ebay', JSON.stringify(real)]);
    expect(sql).not.toContain('IS NULL'); expect(sql).not.toContain('external_product_id');
  });
  it('keeps sandbox distinct from production and handles no eligible sources safely', () => {
    const registry = new InMemoryProviderRegistry();
    registerProviders(registry, { EBAY_PROVIDER_MODE: 'real', EBAY_ENVIRONMENT: 'sandbox', EBAY_CLIENT_ID: 'fixture', EBAY_CLIENT_SECRET: 'fixture' });
    expect(eligibleSources(registry)![0]!.environment).toBe('sandbox');
    expect(offerEligibilitySql([], [])).toBe(' AND FALSE');
  });
});
