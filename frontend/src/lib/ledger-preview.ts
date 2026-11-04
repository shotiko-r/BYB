import { displayOffers } from './product-presentation';
import { shippingFacts } from './shipping-presentation';
import type { Offer, ProductWithOffers } from '@/types';

export interface LedgerRow {
  offer: Offer;
  shipping?: { amount: number; currencyCode: string };
  total?: { amount: number; currencyCode: string };
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
