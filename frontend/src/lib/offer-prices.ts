type PricedOffer = { currencyCode: string; priceAmount: number; id?: string };
export function sortOffers<T extends PricedOffer>(offers: T[]): T[] {
  return [...offers].sort((a, b) => a.currencyCode.localeCompare(b.currencyCode)
    || a.priceAmount - b.priceAmount || (a.id ?? '').localeCompare(b.id ?? ''));
}
export function formatMoney(amount: number, currencyCode: string): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}
