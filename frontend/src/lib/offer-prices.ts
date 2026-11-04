import type { Offer } from '@/types';

type PricedOffer = { currencyCode: string; priceAmount: number; id?: string };
type PricedMetadata = Pick<Offer, 'priceAmount' | 'currencyCode' | 'affiliateMetadata'>;

export interface PriceAmount {
  amount: number;
  currencyCode: string;
}

export function sortOffers<T extends PricedOffer>(offers: T[]): T[] {
  return [...offers].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)
    || a.priceAmount - b.priceAmount || (a.id ?? '').localeCompare(b.id ?? ''));
}

export function formatMoney(amount: number, currencyCode: string, locale = 'en-US'): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.formatToParts(amount / 10 ** digits).map(part =>
    part.type === 'currency' && currencyCode === 'GEL' ? '₾' : part.value).join('');
}

// Compare-at prices are displayed only from an explicit, same-currency merchant value.
export function compareAtPrice(offer: PricedMetadata): PriceAmount | undefined {
  const metadata = offer.affiliateMetadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const amount = metadata.oldPriceAmount;
  const currencyCode = metadata.oldPriceCurrencyCode;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= offer.priceAmount) return undefined;
  if (typeof currencyCode !== 'string' || currencyCode !== offer.currencyCode) return undefined;
  return { amount, currencyCode };
}

export function priceSaving(currentAmount: number, previousAmount: number): { amount: number; percent: number } | undefined {
  if (!Number.isSafeInteger(currentAmount) || !Number.isSafeInteger(previousAmount)
    || currentAmount < 0 || previousAmount <= currentAmount) return undefined;
  const amount = previousAmount - currentAmount;
  return { amount, percent: Math.round((amount / previousAmount) * 100) };
}
