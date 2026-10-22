import { sortOffers } from './offer-prices';
import type { Offer, ProductWithOffers } from '@/types';

// Backend eligibility remains authoritative; never reintroduce inactive offers in UI counts.
export function displayOffers(product: ProductWithOffers): Offer[] {
  return sortOffers(product.offers.filter(offer => offer.isActive));
}

export function knownText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && !/^(unknown|n\/?a|not specified|unspecified|null|none)$/i.test(text) ? text : undefined;
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

// NEXT_PUBLIC values are inlined by Next at build time. Fail closed until explicitly enabled.
export function clickoutEnabled(offer: Offer): boolean {
  return offer.merchant?.code !== 'aliexpress' || process.env.NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED === 'true';
}

// Only consumer-facing scalar specifications; never dump source IDs or nested provider objects.
export function productSpecifications(product: ProductWithOffers): [string, string][] {
  const keys = ['color', 'material', 'size', 'storage', 'capacity', 'connectivity'];
  return keys.flatMap(key => {
    const value = knownText(product.attributes[key]);
    return value ? [[key, value] as [string, string]] : [];
  });
}
