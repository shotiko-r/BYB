import { z } from 'zod';

// Explicit supported search/filter currencies; source prices are never converted.
export const SEARCH_CURRENCIES = ['USD', 'GEL', 'EUR', 'GBP', 'AMD', 'AZN', 'CAD', 'JPY', 'AUD', 'CHF', 'CNY', 'HKD', 'KRW', 'KWD'] as const;
export const SearchCurrencySchema = z.enum(SEARCH_CURRENCIES);
export function currencyDigits(currency: string): number {
  SearchCurrencySchema.parse(currency);
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function decimalToMinor(value: string, currency: string): number {
  const digits = currencyDigits(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match || (match[2]?.length ?? 0) > digits) throw new Error('Invalid price precision');
  const amount = BigInt(match[1]!) * BigInt(10) ** BigInt(digits) + BigInt((match[2] ?? '').padEnd(digits, '0') || '0');
  if (amount > BigInt(2147483647)) throw new Error('Price out of range');
  return Number(amount);
}
export function minorToDecimal(value: number, currency: string): string {
  const digits = currencyDigits(currency);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid price');
  const text = String(value).padStart(digits + 1, '0');
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}
