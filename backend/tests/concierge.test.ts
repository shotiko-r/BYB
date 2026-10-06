import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ConciergeResponseSchema, type ProductWithOffers, type SearchIntent } from '@byb/shared/types';
const { structuredSearch } = vi.hoisted(() => ({ structuredSearch: vi.fn() }));
vi.mock('../src/modules/search/service.js', () => ({ SearchService: class { searchIntent = structuredSearch; } }));
import { ConciergeService } from '../src/modules/ai/concierge.js';
import { conciergeRoutes } from '../src/modules/ai/routes.js';
import { rankRecommendations } from '../src/modules/ai/concierge-ranking.js';

const date = '2026-01-01T00:00:00.000Z';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function product(n: number, attributes: Record<string, unknown> = {}, currencyCode = 'USD', priceAmount = 10000): ProductWithOffers {
  return {
    id: id(n), name: `Headphones ${n}`, slug: `headphones-${n}`, description: null, brand: 'Sony', model: null,
    categoryId: id(100), imageUrl: null, attributes, isActive: true, createdAt: date, updatedAt: date,
    category: { id: id(100), slug: 'headphones', name: 'Headphones', description: null, parentId: null, isActive: true, createdAt: date, updatedAt: date },
    offers: [{ id: id(n + 200), productId: id(n), merchantId: id(101), marketId: id(102), externalProductId: `${n}`,
      priceAmount, currencyCode, availability: 'in_stock', shippingInfo: {}, destinationUrl: 'https://example.com/item', affiliateMetadata: {}, lastCheckedAt: date, isActive: true, createdAt: date, updatedAt: date }],
  };
}
const followUp = { query: 'I need headphones', answers: { useCase: 'travel', budget: { maxPrice: 15000, currencyCode: 'USD' }, features: ['wireless', 'noiseCancellation'] } };
const service = new ConciergeService();
beforeEach(() => {
  structuredSearch.mockReset();
  structuredSearch.mockResolvedValue({ products: [product(1, { connectivity: 'Bluetooth 5.2', noiseCancellation: true })], total: 1 });
});
describe('stateless Concierge', () => {
  it('returns human prompts and labels while preserving machine option values', async () => {
    for (const query of ['headphones', 'phone', 'laptop', 'something', 'headphones under $100', 'headphones under 100']) {
      const response = await service.respond({ query });
      if (response.status !== 'needs_clarification') throw new Error('Expected questions');
      for (const question of response.questions) {
        expect(question.prompt).not.toMatch(/minor units|integer|JSON|features list|minPrice|maxPrice|unlimited|[{}]/i);
      }
    }
    const response = await service.respond({ query: 'headphones' });
    if (response.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(response.questions.find(q => q.id === 'budget')?.prompt).toBe("What's your maximum budget?");
    expect(response.questions.find(q => q.id === 'features')).toMatchObject({ prompt: 'Which features matter most?', options: [
      { value: 'wireless', label: 'Wireless' },
      { value: 'noiseCancellation', label: 'Noise cancellation' },
      { value: 'microphone', label: 'Microphone' },
      { value: 'waterproof', label: 'Waterproof' },
    ] });
    const known = await service.respond({ query: 'headphones USD' });
    if (known.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(known.questions.find(q => q.id === 'budget')?.prompt).toBe("What's your maximum budget in USD?");
  });

  it('asks category, use case, and budget for an unknown vague request', async () => {
    const response = await service.respond({ query: 'Help me buy something' });
    expect(response.status).toBe('needs_clarification');
    if (response.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(response.questions.map(q => q.id)).toEqual(['category', 'useCase', 'budget']);
    expect(response.questions.length).toBeLessThanOrEqual(4);
    expect(structuredSearch).not.toHaveBeenCalled();
  });
  it('asks useful category-specific questions without repeating the known category', async () => {
    const response = await service.respond({ query: 'I need headphones' });
    if (response.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(response.questions.map(q => q.id)).toEqual(['useCase', 'budget', 'features']);
    expect(response.questions.find(q => q.id === 'features')?.options?.map(o => o.value)).toContain('noiseCancellation');
    expect(response.questions.find(q => q.id === 'useCase')?.options?.map(o => o.value)).toContain('workout');
    expect(ConciergeResponseSchema.safeParse(response).success).toBe(true);
  });
  it('avoids clarification for an already-specific request and calls structured search', async () => {
    const response = await service.respond({ query: 'sony wireless headphones for travel under $150' });
    expect(response.status).toBe('recommendations');
    expect(structuredSearch).toHaveBeenCalledWith(expect.objectContaining({ category: 'headphones', brand: 'sony', maxPrice: 15000, currencyCode: 'USD', filters: expect.objectContaining({ useCase: 'travel', features: ['wireless'] }) }), 'GE', { page: 1, limit: 100, sort: 'relevance' });
    expect(ConciergeResponseSchema.safeParse(response).success).toBe(true);
  });
  it('merges follow-up answers into a validated intent, preserving budget currency and query', async () => {
    const response = await service.respond({ ...followUp, market: 'ge' });
    if (response.status !== 'recommendations') throw new Error('Expected recommendations');
    expect(response.intent).toMatchObject({ query: followUp.query, category: 'headphones', maxPrice: 15000, currencyCode: 'USD', filters: { useCase: 'travel', features: ['wireless', 'noiseCancellation'] } });
    expect(response.recommendations[0]).toMatchObject({ matchScore: 100, product: { offers: [{ currencyCode: 'USD' }] } });
    expect(response.recommendations[0]?.reasons).toContain('Within your USD budget');
  });
  it('asks only for missing currency when other details are known', async () => {
    const response = await service.respond({ query: 'wireless headphones for travel under 150' });
    if (response.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(response.questions.map(q => q.id)).toEqual(['currencyCode']);
    const completed = await service.respond({ query: 'wireless headphones for travel under 150', answers: { currencyCode: 'GEL' } });
    if (completed.status !== 'recommendations') throw new Error('Expected recommendations');
    expect(completed.intent).toMatchObject({ maxPrice: 15000, currencyCode: 'GEL' });
  });
  it('recognizes a currency named in the original query', async () => {
    const response = await service.respond({ query: 'wireless headphones for travel under 150 EUR' });
    if (response.status !== 'recommendations') throw new Error('Expected recommendations');
    expect(response.intent.currencyCode).toBe('EUR');
  });
  it('supports explicit no preference/no budget without repeatedly asking', async () => {
    const response = await service.respond({ query: 'headphones', answers: { useCase: 'everyday', budget: { unlimited: true }, features: [] } });
    expect(response.status).toBe('recommendations');
    expect(structuredSearch).toHaveBeenCalledWith(expect.objectContaining({ minPrice: undefined, maxPrice: undefined, filters: { useCase: 'everyday', features: [], budgetUnrestricted: true } }), 'GE', expect.any(Object));
  });
  it('keeps partial follow-ups stateless and asks only what remains', async () => {
    const response = await service.respond({ query: 'headphones', answers: { useCase: 'office', features: [] } });
    if (response.status !== 'needs_clarification') throw new Error('Expected questions');
    expect(response.questions.map(q => q.id)).toEqual(['budget']);
    expect(structuredSearch).not.toHaveBeenCalled();
  });
  it('uses category-specific phone and laptop preferences', async () => {
    for (const [query, feature] of [['phone', 'camera'], ['laptop', 'portability']]) {
      const response = await service.respond({ query });
      if (response.status !== 'needs_clarification') throw new Error('Expected questions');
      expect(response.questions.find(q => q.id === 'features')?.options?.map(o => o.value)).toContain(feature);
    }
  });
  it('returns a valid empty recommendation list for no results', async () => {
    structuredSearch.mockResolvedValue({ products: [], total: 0 });
    const response = await service.respond(followUp);
    expect(response).toMatchObject({ status: 'recommendations', recommendations: [] });
    expect(ConciergeResponseSchema.safeParse(response).success).toBe(true);
  });
  it.each([
    null, {}, { query: '' }, { query: ' '.repeat(3) }, { query: 'x'.repeat(501) },
    { query: 'headphones', market: 'USA' }, { query: 'headphones', answers: { features: 'wireless' } },
    { query: 'headphones', answers: { budget: { maxPrice: 1.5, currencyCode: 'USD' } } },
    { query: 'headphones', answers: { budget: { minPrice: 200, maxPrice: 100, currencyCode: 'USD' } } },
    { query: 'headphones', answers: { budget: { maxPrice: 100 } } },
    { query: 'headphones', answers: { budget: { maxPrice: 100, currencyCode: 'usd' } } },
    { query: 'headphones', answers: { unknown: 'value' } },
    { query: 'headphones', answers: { currencyCode: 'GEL', budget: { maxPrice: 100, currencyCode: 'USD' } } },
  ])('rejects invalid input: %j', async input => {
    await expect(service.respond(input)).rejects.toMatchObject({ statusCode: 400 });
    expect(structuredSearch).not.toHaveBeenCalled();
  });
});

describe('deterministic recommendation ranking', () => {
  const intent: SearchIntent = { category: 'headphones', brand: 'sony', maxPrice: 15000, currencyCode: 'USD', filters: { useCase: 'travel', features: ['wireless', 'noiseCancellation'] } };
  it('scores evidence for budget, category, features, brand and use case', () => {
    const best = product(3, { wireless: true, noiseCancellation: true });
    const partial = product(2, { wireless: true });
    const other = { ...product(1, {}, 'GEL'), brand: 'Other', category: undefined, categoryId: null };
    const ranked = rankRecommendations([other, partial, best], intent);
    expect(ranked.map(r => r.product.id)).toEqual([best.id, partial.id, other.id]);
    expect(ranked.map(r => r.matchScore)).toEqual([100, 78, 0]);
    expect(ranked[0]?.reasons).toHaveLength(5);
    expect(ranked[2]?.reasons).toEqual([]);
  });
  it('uses stable IDs to break ties independently of provider ordering', () => {
    const products = [product(3), product(1), product(2)];
    const ranked = rankRecommendations(products, intent);
    expect(ranked).toEqual(rankRecommendations([...products].reverse(), intent));
    expect(ranked.map(r => r.product.id)).toEqual([id(1), id(2), id(3)]);
  });
  it('never awards budget fit for a different currency, inactive offer or out-of-range price', () => {
    const inactive = product(3); inactive.offers[0]!.isActive = false;
    for (const p of [product(1, {}, 'GEL'), product(2, {}, 'USD', 16000), inactive]) {
      expect(rankRecommendations([p], intent)[0]?.reasons).not.toContain('Within your USD budget');
    }
  });
  it('uses attribute lists and explicit use-case evidence without guessing missing metadata', () => {
    const p = product(1, { features: ['noiseCancellation', 'wireless'], useCases: ['travel'] });
    expect(rankRecommendations([p], intent)[0]?.matchScore).toBe(100);
    expect(rankRecommendations([product(2)], intent)[0]?.reasons.some(r => r.includes('Suitable'))).toBe(false);
  });
  it('caps recommendations at four after ranking', async () => {
    structuredSearch.mockResolvedValue({ products: Array.from({ length: 8 }, (_, i) => product(i + 1)), total: 8 });
    const response = await service.respond(followUp);
    if (response.status !== 'recommendations') throw new Error('Expected recommendations');
    expect(response.recommendations).toHaveLength(4);
    expect(response.recommendations.map(r => r.product.id)).toEqual([id(1), id(2), id(3), id(4)]);
  });
});

describe('POST /api/concierge', () => {
  it('supports both stateless stages with schema-valid responses', async () => {
    const app = Fastify();
    await app.register(conciergeRoutes, { prefix: '/api' });
    try {
      const initial = await app.inject({ method: 'POST', url: '/api/concierge', payload: { query: 'I need headphones' } });
      expect(initial.statusCode).toBe(200);
      expect(initial.json().status).toBe('needs_clarification');
      const completed = await app.inject({ method: 'POST', url: '/api/concierge', payload: followUp });
      expect(completed.statusCode).toBe(200);
      expect(completed.json().status).toBe('recommendations');
      expect(ConciergeResponseSchema.safeParse(completed.json()).success).toBe(true);
    } finally { await app.close(); }
  });
  it('returns 400 for malformed input and propagates search unavailability as 503', async () => {
    const app = Fastify();
    await app.register(conciergeRoutes, { prefix: '/api' });
    try {
      const invalid = await app.inject({ method: 'POST', url: '/api/concierge', payload: { query: '' } });
      expect(invalid.statusCode).toBe(400);
      const { AppError } = await import('../src/shared/errors.js');
      structuredSearch.mockRejectedValue(AppError.unavailable('Providers offline'));
      const unavailable = await app.inject({ method: 'POST', url: '/api/concierge', payload: followUp });
      expect(unavailable.statusCode).toBe(503);
    } finally { await app.close(); }
  });
});
