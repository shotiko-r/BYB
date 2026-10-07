import { describe, expect, it } from 'vitest';
import { searchSpecificity, matchesRelevance } from '../src/modules/search/relevance.js';
describe('search specificity', () => {
  it.each(['Sony WH-1000XM5', 'Apple iPhone 17 Pro', 'Samsung SM-S938B', 'Canon EOS R6 Mark II', 'RTX 5090', 'ThinkPad X1 Carbon'])('preserves %s', query => {
    expect(searchSpecificity({ query }).model).toBeTruthy();
  });
  it('rejects adjacent models, same-brand unrelated products and accessories', () => {
    const policy = searchSpecificity({ query: 'Sony WH-1000XM5', brand: 'sony' });
    for (const name of ['Sony WH-1000XM6', 'Sony WH-1000XM4', 'Sony Alpha a6000', 'Sony PlayStation 5', 'Case for Sony WH-1000XM5']) {
      expect(matchesRelevance({ name, brand: 'Sony' }, policy)).toBe(false);
    }
    for (const name of ['Sony WH 1000XM5 Wireless Headphones', 'SONY WH_1000XM5', 'Sony WH–1000XM5', 'Sony WH-1000XM5 headphones with carrying case', 'Sony WH-1000XM5 headphones includes a case']) expect(matchesRelevance({ name, brand: 'Sony' }, policy)).toBe(true);
    expect(matchesRelevance({ name: 'Sony WH-1000XM50', brand: 'Sony' }, policy)).toBe(false);
    expect(matchesRelevance({ name: 'Sony WH-1000XM5', brand: 'Other' }, policy)).toBe(false);
  });
  it('retains useful ordinary brand-search residuals', () => {
    expect(searchSpecificity({ query: 'Sony camera', brand: 'sony' }).terms).toBe('camera');
  });
  it('does not interpret budgets or descriptive requests as models', () => {
    for (const query of ['headphones under 500 GEL for travel', 'headphones up to 500', 'laptop 16GB']) expect(searchSpecificity({ query, category: 'headphones' }).model).toBeUndefined();
    expect(searchSpecificity({ query: 'I need wireless headphones for travel', category: 'headphones' }).model).toBeUndefined();
  });
});
