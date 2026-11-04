import { displayOffers } from './product-presentation';
import { compareAtPrice, type PriceAmount } from './offer-prices';
import { shippingFacts } from './shipping-presentation';
import type { Offer, ProductWithOffers } from '@/types';

export interface LedgerRow {
  offer: Offer;
  compareAt?: PriceAmount;
  shipping?: PriceAmount;
  total?: PriceAmount;
  checkedAt?: string;
}

function validDate(value: string): string | undefined {
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

export function ledgerRows(product: ProductWithOffers): LedgerRow[] {
  return displayOffers(product).map(offer => {
    const shipping = shippingFacts(offer)?.cost;
    const sameCurrency = shipping?.currencyCode === offer.currencyCode;
    return {
      offer,
      compareAt: compareAtPrice(offer),
      shipping,
      total: shipping && sameCurrency
        ? { amount: offer.priceAmount + shipping.amount, currencyCode: offer.currencyCode }
        : undefined,
      checkedAt: validDate(offer.lastCheckedAt),
    };
  });
}

export function latestCheckedAt(rows: LedgerRow[]): string | undefined {
  return rows.map(row => row.checkedAt).filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

// A lowest-total claim needs at least two complete, same-currency totals.
// Unknown shipping stays unknown and is never treated as zero.
export function lowestKnownTotal(rows: LedgerRow[]): PriceAmount | undefined {
  if (rows.length < 2 || !rows.every(row => row.total)) return undefined;
  const currencyCode = rows[0]!.total!.currencyCode;
  if (!rows.every(row => row.total!.currencyCode === currencyCode)) return undefined;
  return { amount: Math.min(...rows.map(row => row.total!.amount)), currencyCode };
}

export function formatCheckedAt(value: string | undefined, locale: string): string | undefined {
  if (!value || !Number.isFinite(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

// The ledger is evidence, not a new ranking: select the widest visible comparison
// from the same discovery response that feeds the shelves.
export function selectLedgerProduct(
  productsBySection: Record<string, ProductWithOffers[]>,
  sectionKeys: readonly string[],
): ProductWithOffers | undefined {
  const seen = new Set<string>();
  let selected: ProductWithOffers | undefined;
  let score = -1;
  for (const key of sectionKeys) {
    for (const product of productsBySection[key] ?? []) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      const offers = displayOffers(product);
      if (!offers.length) continue;
      const nextScore = offers.length * 10 + (product.imageUrl ? 1 : 0);
      if (nextScore > score) {
        selected = product;
        score = nextScore;
      }
    }
  }
  return selected;
}
