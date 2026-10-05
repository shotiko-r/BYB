import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProviderProduct } from '@byb/shared/types';

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  query: mockQuery,
  getClient: vi.fn(),
}));

import { ProductNormalizationService } from '../src/modules/product/normalization.js';

describe('ProductNormalizationService', () => {
  let service: ProductNormalizationService;

  beforeEach(() => {
    vi.resetAllMocks();
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