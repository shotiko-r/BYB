import { createHash } from 'node:crypto';
import { DISCOVERY_SECTION_KEYS, type DiscoveryHome, type DiscoverySection, type DiscoverySectionKey } from '@byb/shared/types';
import { PostgresMarketRepository, type MarketRepository } from '../market/repository.js';
import { providerRegistry } from '../provider/registry.js';
import { AppError } from '../../shared/errors.js';
import { DISCOVERY_ALGORITHM_VERSION, PostgresDiscoveryRepository, type DiscoveryCandidate, type DiscoveryRepository } from './repository.js';

export const discoveryTitleKeys: Record<DiscoverySectionKey, string> = {
  discover: 'homepage.sections.discover', new_on_byb: 'homepage.sections.newOnByb',
  under_25_usd: 'homepage.sections.under25', under_50_usd: 'homepage.sections.under50',
  more_to_explore: 'homepage.sections.more',
};

function identities(candidate: DiscoveryCandidate): string[] {
  return [`product:${candidate.product.id}`, ...candidate.product.offers.map(offer =>
    JSON.stringify(['listing', offer.merchantId, offer.marketId, offer.externalProductId]))];
}

/** Deterministic ranking and soft diversity caps. No title-based identity matching. */
export function allocate(candidates: DiscoveryCandidate[], section: DiscoverySectionKey, market: string,
  bucket: string, limit: number, previouslyUsed: Set<string>): DiscoveryCandidate[] {
  const ranked = candidates.map(candidate => ({ candidate, hash: createHash('sha256').update(JSON.stringify([
    DISCOVERY_ALGORITHM_VERSION, section, market, bucket, ...identities(candidate).sort(),
  ])).digest('hex') })).sort((a, b) => {
    // First seen in this market, never manufacturer release date.
    const newest = section === 'new_on_byb'
      ? b.candidate.product.firstSeenAt.localeCompare(a.candidate.product.firstSeenAt) : 0;
    const quality = Number(Boolean(b.candidate.product.imageUrl?.trim())) - Number(Boolean(a.candidate.product.imageUrl?.trim()));
    return newest || quality || a.hash.localeCompare(b.hash) || a.candidate.product.id.localeCompare(b.candidate.product.id);
  }).map(item => item.candidate);
  const selected: DiscoveryCandidate[] = [];
  const inSection = new Set<string>();
  const merchants = new Map<string, number>();
  const categories = new Map<string, number>();
  const merchantKey = (candidate: DiscoveryCandidate) => candidate.product.offers[0]!.merchantId;
  const merchantCap = Math.ceil(limit / Math.max(1, new Set(ranked.map(merchantKey)).size));
  const categoryCount = new Set(ranked.flatMap(candidate => candidate.categoryKey ? [candidate.categoryKey] : [])).size;
  const categoryCap = Math.ceil(limit / Math.max(1, categoryCount));
  // First exhaust new-to-homepage identities. Relax category, then merchant caps;
  // only then reuse earlier sections to avoid empty shelves in a sparse catalog.
  for (const reuse of [false, true]) {
    for (const caps of ['both', 'merchant', 'none']) {
      for (const candidate of ranked) {
        if (selected.length >= limit) break;
        const keys = identities(candidate);
        if (keys.some(key => inSection.has(key)) || (!reuse && keys.some(key => previouslyUsed.has(key)))) continue;
        const merchant = merchantKey(candidate);
        const category = candidate.categoryKey;
        if (caps !== 'none' && (merchants.get(merchant) ?? 0) >= merchantCap) continue;
        if (caps === 'both' && category && categoryCount > 1 && (categories.get(category) ?? 0) >= categoryCap) continue;
        selected.push(candidate);
        keys.forEach(key => inSection.add(key));
        merchants.set(merchant, (merchants.get(merchant) ?? 0) + 1);
        if (category) categories.set(category, (categories.get(category) ?? 0) + 1);
      }
    }
  }
  inSection.forEach(key => previouslyUsed.add(key));
  // Diversity chooses membership; output retains the section's truthful rank order.
  const rank = new Map(ranked.map((candidate, index) => [candidate.product.id, index]));
  return selected.sort((a, b) => rank.get(a.product.id)! - rank.get(b.product.id)!);
}

export class DiscoveryService {
  constructor(
    private readonly repository: DiscoveryRepository = new PostgresDiscoveryRepository(providerRegistry),
    private readonly markets: Pick<MarketRepository, 'findByCode'> = new PostgresMarketRepository(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async home(marketCode: string, limit = 4, currency?: string, keys: readonly DiscoverySectionKey[] = DISCOVERY_SECTION_KEYS): Promise<DiscoveryHome> {
    const market = await this.markets.findByCode(marketCode);
    if (!market?.isActive) throw AppError.notFound('Discovery market not found');
    const now = this.clock();
    const bucket = now.toISOString().slice(0, 10);
    const outcomes = await Promise.allSettled(keys.map(section => this.repository.candidates({
      marketId: market.id, market: market.code, section, limit, currency, bucket, now,
    })));
    if (outcomes.every(outcome => outcome.status === 'rejected')) throw AppError.unavailable('Discovery is temporarily unavailable');
    const used = new Set<string>();
    const sections: DiscoverySection[] = keys.map((key, index) => {
      const outcome = outcomes[index]!;
      return { key, titleKey: discoveryTitleKeys[key], status: outcome.status === 'fulfilled' ? 'ok' : 'unavailable',
        products: outcome.status === 'fulfilled'
          ? allocate(outcome.value, key, market.code, bucket, limit, used).map(candidate => candidate.product) : [],
      };
    });
    return { market: market.code, generatedAt: now.toISOString(), rotationBucket: bucket,
      algorithmVersion: DISCOVERY_ALGORITHM_VERSION, sections };
  }
}
