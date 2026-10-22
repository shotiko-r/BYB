import type { ProductWithOffers, ProviderProduct } from '@byb/shared/types';
import type { ProviderRegistry } from '../provider/types.js';
import { provenance } from '../provider/provenance.js';

export interface ProductDetailEnricher {
  enrich(product: ProductWithOffers, marketCode: string): Promise<ProductWithOffers>;
}

interface CachedDetail {
  expiresAt: number;
  detail: ProviderProduct;
}

type DetailAspect = { name: string; value: string };

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

function detailImages(detail: ProviderProduct): string[] {
  const images = detail.attributes?.images;
  return Array.isArray(images) ? images.filter((image): image is string => typeof image === 'string' && image.length > 0) : [];
}

function detailAspects(detail: ProviderProduct): DetailAspect[] {
  const aspects = detail.attributes?.aspects;
  if (!Array.isArray(aspects)) return [];
  return aspects.flatMap(aspect => {
    if (!aspect || typeof aspect !== 'object' || Array.isArray(aspect)) return [];
    const { name, value } = aspect as Record<string, unknown>;
    return typeof name === 'string' && name.trim() && typeof value === 'string' && value.trim()
      ? [{ name: name.trim(), value: value.trim() }] : [];
  });
}

function mergeDetail(product: ProductWithOffers, detail: ProviderProduct): ProductWithOffers {
  const images = detailImages(detail);
  const aspects = detailAspects(detail);
  const description = typeof detail.description === 'string' ? detail.description.trim() : '';
  const imageUrl = product.imageUrl ?? detail.imageUrl ?? null;
  if (!detail.variationGroup && !description && !images.length && !aspects.length && imageUrl === product.imageUrl) return product;
  return {
    ...product,
    description: description || product.description,
    ...(detail.variationGroup ? { variationGroup: detail.variationGroup } : {}),
    imageUrl,
    attributes: {
      ...product.attributes,
      ...(images.length ? { images } : {}),
      ...(aspects.length ? { aspects } : {}),
    },
  };
}

export class EbayProductDetailEnricher implements ProductDetailEnricher {
  private readonly cache = new Map<string, CachedDetail>();

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly now: () => number = Date.now,
    private readonly ttlMs = DEFAULT_TTL_MS,
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {}

  async enrich(product: ProductWithOffers, marketCode: string): Promise<ProductWithOffers> {
    const provider = this.registry.get('ebay');
    if (!provider || !provider.supportedMarkets.includes(marketCode)
      || provenance(provider).mode !== 'real' || product.attributes.source !== 'ebay_browse') return product;

    const offer = product.offers.find(item => item.isActive && item.merchant?.code === 'ebay');
    if (!offer) return product;

    const key = `${marketCode}:${offer.externalProductId}`;
    let detail: ProviderProduct | null | undefined = this.cached(key);
    if (!detail) {
      try {
        detail = await provider.getProduct(offer.externalProductId, marketCode);
      } catch {
        return product;
      }
      if (!detail || detail.externalId !== offer.externalProductId) return product;
      if (!detail.attributes?.variationLookupFailed) this.remember(key, detail);
    }
    return mergeDetail(product, detail);
  }

  private cached(key: string): ProviderProduct | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.detail;
  }

  private remember(key: string, detail: ProviderProduct): void {
    if (this.maxEntries <= 0) return;
    const now = this.now();
    for (const [cachedKey, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(cachedKey);
    }
    while (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { expiresAt: now + this.ttlMs, detail });
  }
}
