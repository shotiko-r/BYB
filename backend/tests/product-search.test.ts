import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db } = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ query: db }));
import { PostgresProductRepository } from '../src/modules/product/repository.js';

const repository = new PostgresProductRepository();
const base = { marketId: 'market', page: 1, limit: 20, sort: 'relevance' as const };
beforeEach(() => { db.mockReset(); db.mockResolvedValue({ rows: [] }); });
describe('product search SQL and mapping', () => {
  it.each([
    ['relevance', 'ORDER BY p.name ASC, p.id ASC'],
    ['price_asc', 'ORDER BY MIN(o.price_amount) ASC, p.name ASC, p.id ASC'],
    ['price_desc', 'ORDER BY MIN(o.price_amount) DESC, p.name ASC, p.id ASC'],
    ['newest', 'ORDER BY p.created_at DESC, p.id ASC'],
  ] as const)('orders %s globally after grouping, with stable ties', async (sort, ordering) => {
    await repository.search({ ...base, sort, currencyCode: 'USD' });
    const sql = db.mock.calls[1]![0] as string;
    expect(sql).toContain(`GROUP BY p.id, c.id\n      ${ordering}`);
    expect(sql).not.toContain('DISTINCT ON');
    expect(sql).toContain('ORDER BY o.currency_code ASC, o.price_amount ASC, o.id ASC');
  });
  it('includes category join and currency/feature constraints in count and page queries', async () => {
    await repository.search({ ...base, categorySlug: 'headphones', brand: 'sony', features: ['wireless', 'noiseCancellation'], minPrice: 0, maxPrice: 20000, currencyCode: 'USD', page: 2 });
    for (const [sql, params] of db.mock.calls) {
      expect(sql).toContain('LEFT JOIN categories c ON p.category_id = c.id');
      expect(sql).toContain('c.slug = $2');
      expect(sql).toContain('o.currency_code = $3');
      expect(sql).toContain("p.attributes ->> $4 = 'true'");
      expect(sql).toContain("p.attributes ->> $5 = 'true'");
      expect(sql).toContain('o.price_amount >= $7');
      expect(sql).toContain('o.price_amount <= $8');
      expect(params.slice(0, 8)).toEqual(['market', 'headphones', 'USD', 'wireless', 'noiseCancellation', '%sony%', 0, 20000]);
    }
    expect(db.mock.calls[1]![1].slice(-2)).toEqual([20, 20]);
  });
  it('accepts DB category ID or slug, without casting a slug to UUID', async () => {
    await repository.search({ ...base, categoryId: 'headphones' });
    expect(db.mock.calls[0]![0]).toContain('(p.category_id::text = $2 OR c.slug = $2)');
  });
  it.each([{ maxPrice: 100 }, { minPrice: 0 }, { sort: 'price_asc' as const }, { sort: 'price_desc' as const }])('refuses cross-currency amount comparison: %j', async options => {
    await expect(repository.search({ ...base, ...options })).rejects.toThrow('currency');
    expect(db).not.toHaveBeenCalled();
  });
  it('keeps categoryId in the mapped product and supports the shared response schema', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const date = '2026-01-01T00:00:00.000Z';
    db.mockResolvedValueOnce({ rows: [{ total: '1' }] }).mockResolvedValueOnce({ rows: [{
      id, slug: 'headphones', name: 'Headphones', description: null, brand: null, model: null,
      category_id: id, image_url: null, attributes: {}, is_active: true, created_at: date, updated_at: date,
      offers: [], category_slug: 'headphones', category_name: 'Headphones', category_description: null,
      category_parent_id: null, category_is_active: true, category_created_at: date, category_updated_at: date,
    }] });
    const result = await repository.search(base);
    expect(result.products[0]?.categoryId).toBe(id);
    expect(result.products[0]?.category?.slug).toBe('headphones');
    const { ProductWithOffersSchema } = await import('@byb/shared/types');
    expect(ProductWithOffersSchema.safeParse(result.products[0]).success).toBe(true);
  });
});
