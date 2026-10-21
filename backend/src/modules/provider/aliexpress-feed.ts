import type { ProductProvider } from './types.js';

export interface FeedSearchPolicy { markets: readonly string[]; maxAgeHours: number }
/** Source descriptor only. SearchService must never call a feed retrieval method. */
export class AliExpressFeedSource implements ProductProvider {
  readonly code = 'aliexpress';
  readonly name = 'AliExpress';
  readonly retrievalMode = 'persisted-feed' as const;
  readonly provenance = { version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' } as const;
  readonly supportedMarkets: string[];
  constructor(readonly feedPolicy: FeedSearchPolicy) {
    if (!feedPolicy.markets.length || feedPolicy.markets.some(code => !/^[A-Z]{2}$/.test(code))
      || !Number.isFinite(feedPolicy.maxAgeHours) || feedPolicy.maxAgeHours <= 0 || feedPolicy.maxAgeHours > 8760) {
      throw new Error('Invalid AliExpress search policy');
    }
    this.supportedMarkets = [...new Set(feedPolicy.markets)];
  }
  search(): never { throw new Error('Persisted feed source cannot perform live retrieval'); }
  getProduct(): never { throw new Error('Persisted feed source cannot perform live retrieval'); }
}
