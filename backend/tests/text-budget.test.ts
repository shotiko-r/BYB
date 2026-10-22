import { describe, expect, it } from 'vitest';
import { namedCurrency, textBudget } from '../src/modules/search/text-budget.js';

describe('currency-aware standard-search text budgets', () => {
  it.each([['under 0.29', 'USD', 29], ['under 100', 'JPY', 100], ['under 0.001', 'KWD', 1]] as const)('interprets %s in %s without floating point', (query, currency, amount) => {
    expect(textBudget(query, currency)).toEqual({ maxPrice: amount });
  });
  it('supports inclusive range intent and explicit named currencies', () => {
    expect(textBudget('headphones 10 to 20 USD', 'USD')).toEqual({ minPrice: 1000, maxPrice: 2000 });
    expect(namedCurrency('headphones under 100 JPY')).toBe('JPY');
    expect(namedCurrency('AMD Ryzen 9800')).toBeUndefined();
  });
  it('rejects invalid precision rather than rounding', () => {
    expect(() => textBudget('under 0.001', 'USD')).toThrow('precision');
    expect(() => textBudget('under 1.5', 'JPY')).toThrow('precision');
  });
});
