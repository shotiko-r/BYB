import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { ConciergeResponseSchema } from '@byb/shared/types';
const { db, logError } = vi.hoisted(() => ({ db: vi.fn(), logError: vi.fn() }));
vi.mock('../src/config/logger.js', () => ({ logger: { error: logError } }));
vi.mock('../src/config/database.js', () => ({ query: db, getClient: async () => ({ query: db, release: vi.fn() }) }));
import { ConciergeService } from '../src/modules/ai/concierge.js';
import { conciergeRoutes } from '../src/modules/ai/routes.js';
import { MockSearchIntentParser } from '../src/modules/ai/mock-parser.js';
import { SearchService } from '../src/modules/search/service.js';
import { InMemoryProviderRegistry } from '../src/modules/provider/registry.js';
import { AmazonProvider, TemuProvider, AliExpressProvider, EbayProvider } from '../src/modules/provider/mock/index.js';
import { rankRecommendations } from '../src/modules/ai/concierge-ranking.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const date = new Date('2026-01-01T00:00:00.000Z');
const aggregatedTimestamp = '2026-10-06T11:58:01.335271+00:00';
const aggregatedChecked = '2026-10-06T12:13:46.417+00:00';
const category = { id: id(100), slug: 'headphones', name: 'Headphones', description: null, parent_id: null, is_active: true, created_at: date, updated_at: date };
const request = { query: 'headphones', market: 'GE', answers: { useCase: 'travel', budget: { maxPrice: 50000, currencyCode: 'GEL' }, features: ['noiseCancellation'] } };
let products: Record<string, any>[];
let offers: Record<string, any>[];
const providers = [new AmazonProvider(), new TemuProvider(), new AliExpressProvider(), new EbayProvider()];
function service() {
  const registry = new InMemoryProviderRegistry(); providers.forEach(p => registry.register(p));
  return new ConciergeService(new MockSearchIntentParser(), new SearchService(registry));
}

beforeEach(() => {
  products = []; offers = []; db.mockReset(); logError.mockReset();
  // In-memory DB boundary only: real parser, Concierge, providers, SearchService,
  // normalization/persistence, repository mapping and ranking execute below.
  db.mockImplementation(async (sql: string, params: any[] = []) => {
    if (sql.startsWith('SELECT * FROM markets')) return { rows: [{ id: id(101), code: 'GE', currency_code: 'GEL', is_active: true }] };
    if (sql.startsWith('SELECT * FROM merchants')) return { rows: providers.map((p, i) => ({ id: id(200 + i), code: p.code, name: p.name, is_active: true })) };
    if (sql.startsWith('SELECT id, slug FROM categories') || sql.startsWith('SELECT id FROM categories')) return { rows: [category] };
    if (sql === 'SELECT * FROM products WHERE is_active = true') return { rows: products };
    if (sql.startsWith('SELECT id FROM products')) return { rows: products.filter(p => p.slug === params[0]) };
    if (sql.includes('INSERT INTO products')) {
      const row = { id: id(products.length + 1), slug: params[0], name: params[1], description: params[2], brand: params[3], model: params[4], category_id: params[5], image_url: params[6], attributes: JSON.parse(params[7]), is_active: true, created_at: date, updated_at: date };
      products.push(row); return { rows: [row] };
    }
    if (sql.includes('INSERT INTO offers')) {
      offers.push({ id: id(300 + offers.length), product_id: params[0], merchant_id: params[1], market_id: params[2], external_product_id: params[3], price_amount: params[4], currency_code: params[5], availability: params[6], shipping_info: JSON.parse(params[7]), destination_url: params[8], affiliate_metadata: JSON.parse(params[9]), last_checked_at: new Date(params[10]), is_active: params[11], created_at: date, updated_at: date });
      return { rows: [] };
    }
    if (sql.includes('SELECT COUNT(DISTINCT p.id)') || sql.includes('SELECT p.*,')) {
      expect(sql).toContain('o.currency_code = $3');
      expect(sql).toContain("p.attributes ->> $4 = 'true'");
      expect(sql).toContain('o.price_amount <= $5');
      expect(params.slice(0, 5)).toEqual([id(101), id(100), 'GEL', 'noiseCancellation', 50000]);
      const rows = products.filter(p => p.category_id === id(100) && p.attributes.noiseCancellation === true).flatMap(p => {
        const matching = offers.filter(o => o.product_id === p.id && o.currency_code === 'GEL' && o.price_amount <= 50000);
        return matching.length ? [{ ...p, offers: matching.map(o => ({ ...o, created_at: aggregatedTimestamp, updated_at: aggregatedTimestamp, last_checked_at: aggregatedChecked })), category_slug: category.slug, category_name: category.name, category_description: null, category_parent_id: null, category_is_active: true, category_created_at: date, category_updated_at: date }] : [];
      });
      return { rows: sql.includes('SELECT COUNT') ? [{ total: String(rows.length) }] : rows };
    }
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    throw new Error(`Unexpected database call: ${sql}`);
  });
});

describe('Georgia mock Concierge regression', () => {
  it('serializes real pg Dates plus json_agg offset timestamps into a valid headphones/travel/500 GEL/ANC HTTP response', async () => {
    const app = Fastify();
    await app.register(conciergeRoutes, { prefix: '/api', service: service() });
    try {
      const response = await app.inject({ method: 'POST', url: '/api/concierge', payload: request });
      expect(response.statusCode, response.body).toBe(200);
      const result = ConciergeResponseSchema.parse(response.json());
      expect(result.status).toBe('recommendations');
      if (result.status !== 'recommendations') throw new Error('Expected recommendations');
      expect(result.intent).toMatchObject({ query: 'headphones', category: 'headphones', maxPrice: 50000, currencyCode: 'GEL', filters: { useCase: 'travel', features: ['noiseCancellation'] } });
      expect(result.recommendations.map(r => r.product.name)).toEqual(['BYB Mock Travel ANC Headphones', 'BYB Mock Value ANC Headphones']);
      expect(result.recommendations.every(r => r.matchScore === 100)).toBe(true);
      // Confirm the database boundary really contains Date objects, not string fixtures.
      expect(products[0]?.created_at).toBeInstanceOf(Date);
      expect(category.created_at).toBeInstanceOf(Date);
      expect(offers[0]?.last_checked_at).toBeInstanceOf(Date);
      for (const recommendation of result.recommendations) {
        const product = recommendation.product;
        expect(product.createdAt).toBe(date.toISOString());
        expect(product.updatedAt).toBe(date.toISOString());
        expect(product.category?.createdAt).toBe(date.toISOString());
        expect(product.category?.updatedAt).toBe(date.toISOString());
        for (const offer of product.offers) {
          expect(offer.createdAt).toBe(new Date(aggregatedTimestamp).toISOString());
          expect(offer.updatedAt).toBe(new Date(aggregatedTimestamp).toISOString());
          expect(offer.lastCheckedAt).toBe(new Date(aggregatedChecked).toISOString());
          expect(typeof offer.lastCheckedAt).toBe('string');
          expect(offer.lastCheckedAt).toBe(new Date(offer.lastCheckedAt).toISOString());
        }
      }
      expect(offers).toHaveLength(2);
      expect(offers.every(o => o.currency_code === 'GEL' && o.price_amount <= 50000)).toBe(true);
      expect(result.recommendations.every(r => r.product.attributes.synthetic === true)).toBe(true);
      expect(result.recommendations.every(r => r.product.offers.every(o => o.currencyCode === 'GEL'))).toBe(true);
    } finally { await app.close(); }
  });
  it('returns a simple public error instead of a raw schema dump', async () => {
    const result = await service().respond(request);
    if (result.status !== 'recommendations') throw new Error('Expected recommendations');
    result.recommendations[0]!.product.id = 'invalid-uuid';
    const app = Fastify();
    await app.register(conciergeRoutes, { prefix: '/api', service: { respond: async () => result } });
    try {
      const response = await app.inject({ method: 'POST', url: '/api/concierge', payload: request });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ code: 'INTERNAL_ERROR', message: 'Unable to complete your request. Please try again.' });
      expect(response.body).not.toMatch(/Zod|invalid_string|recommendations|Expected string|validation|uuid/);
      expect(logError).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error), stage: 'response validation', requestId: expect.any(String) }), 'Concierge response failed');
    } finally { await app.close(); }
  });
  it('excludes the over-budget GEL option and every USD offer before persistence', async () => {
    const response = await service().respond(request);
    expect(response.status).toBe('recommendations');
    expect(offers.map(o => o.external_product_id)).toEqual(['BYB-MOCK-GEL-TRAVEL-ANC', 'BYB-MOCK-GEL-VALUE-ANC']);
    expect(offers.some(o => o.external_product_id === 'BYB-MOCK-GEL-PREMIUM-ANC')).toBe(false);
    expect(offers.some(o => o.currency_code === 'USD')).toBe(false);
    const amazon = new AmazonProvider();
    expect((await amazon.search({ category: 'headphones' }, 'GE')).products.some(p => p.currencyCode === 'USD')).toBe(true);
    const gel = await amazon.search({ category: 'headphones', currencyCode: 'GEL', maxPrice: 50000 }, 'GE');
    expect(gel.products).toHaveLength(2);
    expect(gel.products.every(p => p.currencyCode === 'GEL')).toBe(true);
  });
  it('provides meaningful fixture variation for feature ranking', async () => {
    const result = await service().respond(request);
    if (result.status !== 'recommendations') throw new Error('Expected recommendations');
    const ranked = rankRecommendations(result.recommendations.map(r => r.product), { ...result.intent, filters: { useCase: 'travel', features: ['noiseCancellation', 'microphone'] } });
    expect(ranked.map(r => r.matchScore)).toEqual([100, 86]);
    expect(ranked[0]?.product.name).toBe('BYB Mock Travel ANC Headphones');
  });
});
