import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderProduct } from '@byb/shared/types';

const { mockQuery, clientQuery, release, getClient } = vi.hoisted(() => ({
  mockQuery: vi.fn(), clientQuery: vi.fn(), release: vi.fn(), getClient: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  query: mockQuery,
  getClient,
}));

import { ProductNormalizationService } from '../src/modules/product/normalization.js';

describe('ProductNormalizationService', () => {
  let service: ProductNormalizationService;

  beforeEach(() => {
    vi.resetAllMocks();
    getClient.mockResolvedValue({ query: clientQuery, release });
    service = new ProductNormalizationService();
  });

  const createMockProviderProduct = (overrides: Partial<ProviderProduct> = {}): ProviderProduct => ({
    externalId: 'TEST-123',
    name: 'Sony WH-1000XM5',
    description: 'Premium headphones',
    brand: 'Sony',
    model: 'WH-1000XM5',
    category: 'headphones',
    imageUrl: 'https://example.com/image.jpg',
    attributes: { color: 'Black', noiseCancellation: true },
    priceAmount: 39999,
    currencyCode: 'USD',
    availability: 'in_stock',
    shippingInfo: { freeShipping: true, estimatedDays: '1-2' },
    destinationUrl: 'https://example.com/product',
    affiliateMetadata: { tag: 'test' },
    ...overrides,
  });

  it('generates slug from name, brand, and model', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // findOrCreateCategory
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] }); // category insert

    const products = [{ products: [createMockProviderProduct()], merchantId: 'merchant-1' }];
    const result = await service.normalize(products, 'market-1');

    expect(result).toHaveLength(1);
    expect(result[0].product.slug).toContain('sony');
    expect(result[0].product.slug).toContain('wh-1000xm5');
  });

  it('matches existing products by name and brand', async () => {
    const existingProduct = {
      id: 'existing-1',
      slug: 'sony-wh-1000xm5',
      name: 'Sony WH-1000XM5',
      brand: 'Sony',
      model: 'WH-1000XM5',
      category_id: 'cat-1',
      image_url: null,
      attributes: {},
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockQuery.mockResolvedValueOnce({ rows: [existingProduct] }); // existingProducts
    mockQuery.mockResolvedValueOnce({ rows: [] }); // findOrCreateCategory (not called since category exists)

    const products = [{ products: [createMockProviderProduct({ externalId: 'NEW-456' })], merchantId: 'merchant-1' }];
    const result = await service.normalize(products, 'market-1');

    expect(result[0].product.slug).toBe('sony-wh-1000xm5');
  });

  it('creates new product when no match found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // existingProducts
    mockQuery.mockResolvedValueOnce({ rows: [] }); // findOrCreateCategory
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-new' }] }); // category insert

    const products = [{ products: [createMockProviderProduct({ externalId: 'NEW-789', name: 'Unique Product XYZ' })], merchantId: 'merchant-1' }];
    const result = await service.normalize(products, 'market-1');

    expect(result[0].product.name).toBe('Unique Product XYZ');
    expect(result[0].product.slug).toContain('unique-product-xyz');
  });

  it('handles products without brand or model', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'cat-1' }] });

    const products = [{ products: [createMockProviderProduct({ brand: undefined, model: undefined, name: 'Generic Headphones' })], merchantId: 'merchant-1' }];
    const result = await service.normalize(products, 'market-1');

    expect(result[0].product.slug).toContain('generic-headphones');
  });
});

describe('normalization transactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClient.mockResolvedValue({ query: clientQuery, release });
  });
  const normalized = [{ product: { slug: 'mock', name: 'Mock' }, offer: {
    merchantId: 'merchant', marketId: 'market', externalProductId: 'mock',
    priceAmount: 100, currencyCode: 'GEL', availability: 'in_stock' as const,
    shippingInfo: {}, destinationUrl: 'https://example.invalid', affiliateMetadata: {},
    lastCheckedAt: new Date().toISOString(), isActive: true,
  } }];
  it('uses one checked-out client for BEGIN, reads, writes and COMMIT', async () => {
    clientQuery.mockResolvedValue({ rows: [{ id: 'product' }] });
    await new ProductNormalizationService().persist(normalized);
    expect(getClient).toHaveBeenCalledTimes(1);
    expect(mockQuery).not.toHaveBeenCalled();
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual([
      'BEGIN', expect.stringContaining('SELECT id'), expect.stringContaining('INSERT INTO offers'), 'COMMIT',
    ]);
    expect(release).toHaveBeenCalledWith(false);
  });
  it('rolls back failed writes and releases the client', async () => {
    const error = new Error('write failed');
    clientQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'product' }] })
      .mockRejectedValueOnce(error).mockResolvedValueOnce({ rows: [] });
    await expect(new ProductNormalizationService().persist(normalized)).rejects.toBe(error);
    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledWith(false);
  });
  it('does not continue after failed BEGIN and discards a client if rollback fails', async () => {
    const error = new Error('connection failed');
    clientQuery.mockRejectedValue(error);
    await expect(new ProductNormalizationService().persist(normalized)).rejects.toBe(error);
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'ROLLBACK']);
    expect(release).toHaveBeenCalledWith(true);
  });
});


describe('real eBay listing identity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClient.mockResolvedValue({ query: clientQuery, release });
    mockQuery.mockResolvedValue({ rows: [] });
  });
  const listing = (id: string): ProviderProduct => ({
    externalId: id, name: 'Sony WH-1000XM5', brand: 'Sony', model: 'WH-1000XM5',
    priceAmount: 15999, currencyCode: 'USD', destinationUrl: 'https://www.ebay.com/itm/123',
    imageUrl: 'https://i.ebayimg.com/new.jpg',
    attributes: { source: 'ebay_browse', listingIdentity: id, condition: 'Used' },
  });
  it('keeps identical-title listings and mock products separate with stable identities', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'mock', slug: 'mock-sony', name: 'Sony WH-1000XM5',
      brand: 'Sony', model: 'WH-1000XM5', attributes: { noiseCancellation: true } }] });
    const service = new ProductNormalizationService();
    const result = await service.normalize([{ merchantId: 'ebay', products: [listing('v1|1|0'), listing('v1|2|0')] }], 'GE');
    expect(result[0]!.product.slug).toMatch(/^ebay-[a-f0-9]{64}$/);
    expect(result[0]!.product.slug).not.toBe(result[1]!.product.slug);
    expect(result[0]!.product.attributes).not.toHaveProperty('noiseCancellation');
    expect(result.map(r => r.offer.externalProductId)).toEqual(['v1|1|0', 'v1|2|0']);
    const repeated = await service.normalize([{ merchantId: 'ebay', products: [listing('v1|1|0')] }], 'GE');
    expect(repeated[0]!.product.slug).toBe(result[0]!.product.slug);
  });
  it('adds verified brand/category to an existing listing without creating another identity', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'real', slug: 'stable', name: 'Old title',
      category_id: null, brand: null, model: null,
      attributes: { source: 'ebay_browse', listingIdentity: 'v1|1|0' } }] })
      .mockResolvedValueOnce({ rows: [{ id: 'headphones-category' }] });
    const service = new ProductNormalizationService();
    const normalized = await service.normalize([{ merchantId: 'ebay', products: [{ ...listing('v1|1|0'), category: 'headphones' }] }], 'GE');
    expect(normalized[0]!.product).toMatchObject({ slug: 'stable', name: 'Sony WH-1000XM5', brand: 'Sony', model: 'WH-1000XM5', categoryId: 'headphones-category' });
    clientQuery.mockResolvedValue({ rows: [{ id: 'real' }] });
    await service.persist(normalized);
    expect(clientQuery).toHaveBeenCalledWith('SELECT id FROM products WHERE slug = $1', ['stable']);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE products'), expect.arrayContaining(['headphones-category', 'Sony', 'real']));
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO products'))).toBe(false);
  });
  it('refreshes only a matching real listing and preserves the offer conflict key', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'real', slug: 'stable', name: 'Sony WH-1000XM5',
      image_url: 'https://i.ebayimg.com/old.jpg', attributes: { source: 'ebay_browse', listingIdentity: 'v1|1|0', condition: 'New' } }] });
    const service = new ProductNormalizationService();
    const normalized = await service.normalize([{ merchantId: 'ebay', products: [listing('v1|1|0')] }], 'GE');
    expect(normalized[0]!.product.slug).toBe('stable');
    expect(normalized[0]!.product.attributes!.condition).toBe('Used');
    expect(normalized[0]!.product.imageUrl).toBe('https://i.ebayimg.com/new.jpg');
    expect(normalized[0]!.offer.lastCheckedAt).toMatch(/^\d{4}-/);
    clientQuery.mockResolvedValue({ rows: [{ id: 'real' }] });
    await service.persist(normalized);
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE products'), expect.arrayContaining(['real']));
    expect(clientQuery).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (product_id, merchant_id, market_id, external_product_id)'), expect.arrayContaining(['real', 'ebay', 'GE', 'v1|1|0']));
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
  });
});
