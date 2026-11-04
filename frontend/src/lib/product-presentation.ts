import { sortOffers } from './offer-prices';
import type { Offer, ProductWithOffers } from '@/types';

// Backend eligibility remains authoritative; never reintroduce inactive offers in UI counts.
export function displayOffers(product: ProductWithOffers): Offer[] {
  return sortOffers(product.offers.filter(offer => offer.isActive));
}

// Variant controls only rewrite the associated eBay offer, so keep that offer primary there.
export function primaryOffer(product: ProductWithOffers): Offer | undefined {
  const offers = displayOffers(product);
  return (product.variationGroup ? offers.find(offer => offer.merchant?.code === 'ebay') : undefined) ?? offers[0];
}

export function knownText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && !/^(unknown|n\/?a|not specified|unspecified|null|none|does not apply|not applicable)$/i.test(text) ? text : undefined;
}

function productImageUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const candidate = value.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return undefined;
    return url.toString();
  } catch { return undefined; }
}

export function productImages(product: ProductWithOffers): string[] {
  const additional = Array.isArray(product.attributes.images) ? product.attributes.images : [];
  const images: string[] = [];
  const seen = new Set<string>();
  for (const value of [product.imageUrl, ...additional]) {
    const url = productImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    images.push(url);
    if (images.length >= 12) break;
  }
  return images;
}

export interface ProductAspectFact {
  key?: string;
  label: string;
  value: string;
}

const aspectLabelKeys: Record<string, string> = {
  color: 'color', material: 'material', size: 'size', storage: 'storage', capacity: 'capacity', connectivity: 'connectivity',
};
const privateAspectNames = new Set(['seller', 'seller notes', "seller's notes", 'private', 'internal', 'listing identity', 'source', 'condition id', 'affiliate metadata']);

export function productAspectFacts(product: ProductWithOffers): ProductAspectFact[] {
  const aspects = product.attributes.aspects;
  if (!Array.isArray(aspects)) return [];
  const existingValues = new Set([product.brand, product.model, product.attributes.condition, product.attributes.itemLocationCountry]
    .map(knownText).filter((value): value is string => Boolean(value)).map(value => value.toLowerCase()));
  const facts: ProductAspectFact[] = [];
  const seen = new Set<string>();
  for (const entry of aspects) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const source = entry as Record<string, unknown>;
    const name = knownText(source.name);
    const value = knownText(source.value);
    if (!name || !value || name.length > 80 || value.length > 500 || privateAspectNames.has(name.toLowerCase())) continue;
    if (existingValues.has(value.toLowerCase())) continue;
    const key = `${name.toLowerCase()}\u0000${value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const normalizedName = name.toLowerCase();
    const labelKey = Object.prototype.hasOwnProperty.call(aspectLabelKeys, normalizedName) ? aspectLabelKeys[normalizedName] : undefined;
    facts.push({ ...(labelKey ? { key: labelKey } : {}), label: name, value });
    if (facts.length >= 12) break;
  }
  return facts;
}

export function productCondition(product: ProductWithOffers): string | undefined {
  const condition = knownText(product.attributes.condition);
  return condition && condition.length <= 80 ? condition : undefined;
}

export function availabilityKey(offer?: Offer): string | undefined {
  return offer && offer.availability !== 'unknown' ? `product.availability.${offer.availability}` : undefined;
}

export function offerAction(count: number): { key: string; params?: { count: number } } {
  return count > 1 ? { key: 'common.compareOffers', params: { count } } : { key: 'product.viewDetails' };
}

// Public provenance labels only. Raw feed keys, provider payloads and IDs stay internal.
export function offerSourceKey(offer: Offer): string {
  if (offer.merchant?.code === 'ebay') return 'product.source.ebay';
  if (offer.merchant?.code === 'aliexpress') {
    const metadata = offer.affiliateMetadata;
    const source = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? metadata._byb : undefined;
    const sourceType = source && typeof source === 'object' && !Array.isArray(source)
      ? (source as Record<string, unknown>).sourceType : undefined;
    if (sourceType === 'fmtc-feed') return 'product.source.fmtc';
    if (sourceType === 'admitad-feed') return 'product.source.admitad';
    return 'product.source.aliexpress';
  }
  return 'product.source.merchant';
}

// NEXT_PUBLIC values are inlined by Next at build time. Other AliExpress sources fail closed by default.
export function clickoutEnabled(offer: Offer): boolean {
  if (offer.merchant?.code !== 'aliexpress' || process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED === 'true') return true;
  const metadata = offer.affiliateMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;
  const source = metadata._byb;
  return !!source && typeof source === 'object' && !Array.isArray(source)
    && (source as Record<string, unknown>).sourceType === 'fmtc-feed';
}

// Only consumer-facing scalar specifications; never dump source IDs or nested provider objects.
export function productSpecifications(product: ProductWithOffers): [string, string][] {
  const keys = ['color', 'material', 'size', 'storage', 'capacity', 'connectivity'];
  return keys.flatMap(key => {
    const value = knownText(product.attributes[key]);
    return value ? [[key, value] as [string, string]] : [];
  });
}
