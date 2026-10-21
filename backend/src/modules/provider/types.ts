import type { FeedSearchPolicy } from './aliexpress-feed.js';
import type { OfferProvenance } from './provenance.js';
import type { ProviderProduct, ProviderSearchResult, SearchIntent } from '@byb/shared/types';

export type { ProviderProduct, ProviderSearchResult, SearchIntent };

export interface ProductProvider {
  readonly retrievalMode?: 'live-api' | 'persisted-feed';
  readonly feedPolicy?: FeedSearchPolicy;
  readonly provenance?: OfferProvenance;
  readonly code: string;
  readonly name: string;
  readonly supportedMarkets: string[];

  search(intent: SearchIntent, marketCode: string): Promise<ProviderSearchResult>;
  getProduct(externalId: string, marketCode: string): Promise<ProviderProduct | null>;
}

export interface ProviderRegistry {
  register(provider: ProductProvider): void;
  get(code: string): ProductProvider | undefined;
  getAll(): ProductProvider[];
  getForMarket(marketCode: string): ProductProvider[];
}