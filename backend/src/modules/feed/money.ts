import type { CurrencyExponents } from './types.js';

export const DEFAULT_CURRENCY_EXPONENTS: CurrencyExponents = Object.freeze({ USD: 2 });

export class FeedMoneyError extends Error {
  constructor(readonly code: 'UNSUPPORTED_CURRENCY' | 'INVALID_MONEY' | 'MONEY_OVERFLOW') {
    super(code);
    this.name = 'FeedMoneyError';
  }
}

export function parseFeedMoney(value: string, currency: string,
  exponents: CurrencyExponents = DEFAULT_CURRENCY_EXPONENTS): number {
  const exponent = Object.hasOwn(exponents, currency) ? exponents[currency] : undefined;
  if (!/^[A-Z]{3}$/.test(currency) || exponent === undefined || !Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new FeedMoneyError('UNSUPPORTED_CURRENCY');
  }
  const text = value.trim();
  // Bound BigInt input as well as rejecting ambiguous formats.
  const match = text.length <= 64 ? /^(\d+)(?:\.(\d+))?$/.exec(text) : null;
  if (!match || (match[2]?.length ?? 0) > exponent) throw new FeedMoneyError('INVALID_MONEY');
  const amount = BigInt(match[1]!) * 10n ** BigInt(exponent)
    + BigInt((match[2] ?? '').padEnd(exponent, '0') || '0');
  if (amount > 2147483647n) throw new FeedMoneyError('MONEY_OVERFLOW');
  return Number(amount);
}
