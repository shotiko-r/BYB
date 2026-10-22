import type { Offer } from '@/types';
import { knownText } from './product-presentation';

export interface ShippingFacts {
  cost?: { amount: number; currencyCode: string };
  service?: string;
  minimum?: string;
  maximum?: string;
  destination?: string;
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
// Only actual eBay option fields, never legacy demo estimatedDays/freeShipping values.
export function shippingFacts(offer: Offer, now = new Date()): ShippingFacts | undefined {
  if (offer.merchant?.code !== 'ebay' || offer.shippingInfo.synthetic === true) return;
  const options = offer.shippingInfo.options;
  if (!Array.isArray(options)) return;
  const option = options.map(record).find(option => typeof option.type !== 'string' || !/pickup/i.test(option.type));
  if (!option) return;
  const money = record(option.shippingCost);
  const cost = Number.isSafeInteger(money.amount) && Number(money.amount) >= 0 && typeof money.currencyCode === 'string' && /^[A-Z]{3}$/.test(money.currencyCode)
    ? { amount: Number(money.amount), currencyCode: money.currencyCode } : undefined;
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : undefined;
  let minimum = date(option.minEstimatedDeliveryDate);
  let maximum = date(option.maxEstimatedDeliveryDate);
  if (minimum && maximum && Date.parse(minimum) > Date.parse(maximum)) { minimum = undefined; maximum = undefined; }
  const end = maximum || minimum;
  if (end && Date.parse(end) < new Date(now.toISOString().slice(0, 10)).getTime()) { minimum = undefined; maximum = undefined; }
  const country = record(option.shipToLocationUsedForEstimate).country;
  const destination = typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : undefined;
  const service = knownText(option.shippingServiceCode)?.slice(0, 100);
  return cost || service || minimum || maximum ? { cost, service, minimum, maximum, destination } : undefined;
}
export function deliveryDates(facts: ShippingFacts, locale: string): string | undefined {
  const formatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (facts.minimum && facts.maximum) return `${formatter.format(new Date(facts.minimum))} – ${formatter.format(new Date(facts.maximum))}`;
  const single = facts.maximum || facts.minimum;
  return single ? formatter.format(new Date(single)) : undefined;
}
