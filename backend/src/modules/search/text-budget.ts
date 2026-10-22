import { decimalToMinor, SEARCH_CURRENCIES } from '@byb/shared';
import { AppError } from '../../shared/errors.js';

export function namedCurrency(query: string): string | undefined {
  if (query.includes('$')) return 'USD';
  if (!/\b(under|below|less than|cheaper than|over|above|more than|between)\b/i.test(query)) return undefined;
  return query.match(new RegExp(`\\d+(?:\\.\\d+)?\\s+(${SEARCH_CURRENCIES.join('|')})\\b`, 'i'))?.[1]?.toUpperCase();
}
/** Re-read recognized text budgets in the explicit currency's units, without floats. */
export function textBudget(query: string, currency: string): { minPrice?: number; maxPrice?: number } {
  const amount = (value: string) => {
    try { return decimalToMinor(value, currency); }
    catch { throw AppError.badRequest('Invalid text budget precision or amount; use the price controls'); }
  };
  const number = '(\\d+(?:\\.\\d+)?)';
  const under = query.match(new RegExp(`\\b(?:under|below|less than|cheaper than)\\s*\\$?${number}(?![\\d.,])`, 'i'));
  const over = query.match(new RegExp(`\\b(?:over|above|more than)\\s*\\$?${number}(?![\\d.,])`, 'i'));
  const range = query.match(new RegExp(`\\$?${number}\\s*(?:[-–]|\\bto\\b)\\s*\\$?${number}(?![\\d.,])`, 'i'));
  return { ...(under ? { maxPrice: amount(under[1]!) } : {}), ...(over ? { minPrice: amount(over[1]!) } : {}),
    ...(range ? { minPrice: amount(range[1]!), maxPrice: amount(range[2]!) } : {}) };
}
