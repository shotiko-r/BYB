import { query } from '../../config/database.js';
import type pg from 'pg';
import type { Product, Category, ProductWithOffers, Offer } from '@byb/shared/types';

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string, categoryId?: string): Promise<Product | null>;
  findByIdWithOffers(id: string, marketId: string): Promise<ProductWithOffers | null>;
  search(filters: ProductSearchFilters): Promise<{ products: ProductWithOffers[]; total: number }>;
  create(product: CreateProductInput): Promise<Product>;
  update(id: string, data: Partial<Product>): Promise<Product | null>;
}

export interface ProductSearchFilters {
  marketId: string;
  query?: string;
  categoryId?: string;
  categorySlug?: string;
  features?: string[];
  currencyCode?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page: number;
  limit: number;
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
}

export interface CreateProductInput {
  slug: string;
  name: string;
  description?: string;
  brand?: string;
  model?: string;
  categoryId?: string;
  imageUrl?: string;
  attributes?: Record<string, unknown>;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category_id: string | null;
  image_url: string | null;
  attributes: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OfferRow {
  id: string;
  product_id: string;
  merchant_id: string;
  market_id: string;
  external_product_id: string;
  price_amount: number;
  currency_code: string;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'pre_order' | 'unknown';
  shipping_info: Record<string, unknown>;
  destination_url: string;
  affiliate_metadata: Record<string, unknown>;
  last_checked_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  merchant_code?: string;
  merchant_name?: string;
  merchant_logo_url?: string;
}

function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brand: row.brand,
    model: row.model,
    categoryId: row.category_id,
    imageUrl: row.image_url,
    attributes: row.attributes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    parentId: row.parent_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOfferRow(row: OfferRow): Offer {
  return {
    id: row.id,
    productId: row.product_id,
    merchantId: row.merchant_id,
    marketId: row.market_id,
    externalProductId: row.external_product_id,
    priceAmount: row.price_amount,
    currencyCode: row.currency_code,
    availability: row.availability,
    shippingInfo: row.shipping_info,
    destinationUrl: row.destination_url,
    affiliateMetadata: row.affiliate_metadata,
    lastCheckedAt: row.last_checked_at,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresProductRepository implements ProductRepository {
  async resolveCategory(identity: string): Promise<{ id: string; slug: string } | undefined> {
    const result = await query<{ id: string; slug: string }>(
      'SELECT id, slug FROM categories WHERE (id::text = $1 OR slug = $1) AND is_active = true', [identity]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Product | null> {
    const result = await query<ProductRow>('SELECT * FROM products WHERE id = $1 AND is_active = true', [id]);
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  }

  async findBySlug(slug: string, categoryId?: string): Promise<Product | null> {
    let sql = 'SELECT * FROM products WHERE slug = $1 AND is_active = true';
    const params: unknown[] = [slug];

    if (categoryId) {
      sql += ' AND category_id = $2';
      params.push(categoryId);
    } else {
      sql += ' AND category_id IS NULL';
    }

    const result = await query<ProductRow>(sql, params);
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  }

  async findByIdWithOffers(id: string, marketId: string): Promise<ProductWithOffers | null> {
    const productResult = await query<ProductRow>(
      'SELECT * FROM products WHERE id = $1 AND is_active = true',
      [id]
    );
    const productRow = productResult.rows[0];
    if (!productRow) return null;

    const offersResult = await query<OfferRow>(
      `SELECT o.*, m.code as merchant_code, m.name as merchant_name, m.logo_url as merchant_logo_url
       FROM offers o
       JOIN merchants m ON o.merchant_id = m.id
       WHERE o.product_id = $1 AND o.market_id = $2 AND o.is_active = true AND m.is_active = true
       ORDER BY o.currency_code ASC, o.price_amount ASC, o.id ASC`,
      [id, marketId]
    );

    const categoryResult = await query<CategoryRow>('SELECT * FROM categories WHERE id = $1', [productRow.category_id]);
    const category = categoryResult.rows[0] ? mapCategoryRow(categoryResult.rows[0]) : undefined;

    return {
      ...mapProductRow(productRow),
      offers: offersResult.rows.map(mapOfferRow),
      category,
    };
  }

  async search(filters: ProductSearchFilters): Promise<{ products: ProductWithOffers[]; total: number }> {
    const { marketId, query: searchQuery, categoryId, categorySlug, features, currencyCode, brand, minPrice, maxPrice, page, limit, sort } = filters;
    if (!currencyCode && (minPrice !== undefined || maxPrice !== undefined || sort.startsWith('price_'))) {
      throw new Error('A currency is required for budget filtering and price sorting');
    }
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.is_active = true AND o.is_active = true AND m.is_active = true AND o.market_id = $1';
    const params: unknown[] = [marketId];
    let paramIndex = 2;

    if (searchQuery) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR p.brand ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    if (categoryId) {
      whereClause += ` AND (p.category_id::text = $${paramIndex} OR c.slug = $${paramIndex})`;
      params.push(categoryId);
      paramIndex++;
    }

    if (categorySlug) {
      whereClause += ` AND c.slug = $${paramIndex}`;
      params.push(categorySlug);
      paramIndex++;
    }

    if (currencyCode) {
      whereClause += ` AND o.currency_code = $${paramIndex}`;
      params.push(currencyCode);
      paramIndex++;
    }

    for (const feature of features || []) {
      // Supported evidence: boolean attributes, a feature list, and Bluetooth connectivity.
      whereClause += ` AND (p.attributes ->> $${paramIndex} = 'true'
        OR (jsonb_typeof(p.attributes -> 'features') = 'array' AND (p.attributes -> 'features') ? $${paramIndex})
        OR ($${paramIndex} = 'wireless' AND p.attributes ->> 'connectivity' ILIKE '%bluetooth%'))`;
      params.push(feature);
      paramIndex++;
    }

    if (brand) {
      whereClause += ` AND p.brand ILIKE $${paramIndex}`;
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (minPrice !== undefined) {
      whereClause += ` AND o.price_amount >= $${paramIndex}`;
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== undefined) {
      whereClause += ` AND o.price_amount <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    // One row per product; price means its cheapest qualifying offer in the selected currency.
    let orderBy = 'ORDER BY p.name ASC, p.id ASC';
    switch (sort) {
      case 'price_asc':
        orderBy = 'ORDER BY MIN(o.price_amount) ASC, p.name ASC, p.id ASC';
        break;
      case 'price_desc':
        orderBy = 'ORDER BY MIN(o.price_amount) DESC, p.name ASC, p.id ASC';
        break;
      case 'newest':
        orderBy = 'ORDER BY p.created_at DESC, p.id ASC';
        break;
      // Relevance remains a deterministic alphabetical fallback, not recommendation ranking.
    }

    const countSql = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      JOIN offers o ON p.id = o.product_id
      JOIN merchants m ON o.merchant_id = m.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;

    const countResult = await query<{ total: string } & pg.QueryResultRow>(countSql, params);
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    const selectSql = `
      SELECT p.*,
        json_agg(
          json_build_object(
            'id', o.id,
            'product_id', o.product_id,
            'merchant_id', o.merchant_id,
            'market_id', o.market_id,
            'external_product_id', o.external_product_id,
            'price_amount', o.price_amount,
            'currency_code', o.currency_code,
            'availability', o.availability,
            'shipping_info', o.shipping_info,
            'destination_url', o.destination_url,
            'affiliate_metadata', o.affiliate_metadata,
            'last_checked_at', o.last_checked_at,
            'is_active', o.is_active,
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'merchant_code', m.code,
            'merchant_name', m.name,
            'merchant_logo_url', m.logo_url
          ) ORDER BY o.currency_code ASC, o.price_amount ASC, o.id ASC
        ) FILTER (WHERE o.id IS NOT NULL) as offers,
        c.id as category_id, c.slug as category_slug, c.name as category_name,
        c.description as category_description, c.parent_id as category_parent_id,
        c.is_active as category_is_active, c.created_at as category_created_at,
        c.updated_at as category_updated_at
      FROM products p
      LEFT JOIN offers o ON p.id = o.product_id AND o.is_active = true AND o.market_id = $1
      LEFT JOIN merchants m ON o.merchant_id = m.id AND m.is_active = true
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      GROUP BY p.id, c.id
      ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const result = await query<Record<string, unknown> & pg.QueryResultRow>(selectSql, params);

    const products: ProductWithOffers[] = result.rows.map((row) => {
      const { 
        offers, 
        category_id, category_slug, category_name, category_description, category_parent_id, category_is_active, category_created_at, category_updated_at,
        ...productFields 
      } = row;
      
      const product = mapProductRow({ ...productFields, category_id } as unknown as ProductRow);
      const category = category_id ? {
        id: category_id as string,
        slug: category_slug as string,
        name: category_name as string,
        description: category_description as string | null,
        parentId: category_parent_id as string | null,
        isActive: category_is_active as boolean,
        createdAt: category_created_at as string,
        updatedAt: category_updated_at as string,
      } : undefined;

      const parsedOffers: Offer[] = (offers as OfferRow[])?.map(mapOfferRow) || [];

      return {
        ...product,
        offers: parsedOffers,
        category,
      };
    });

    return { products, total };
  }

  async create(product: CreateProductInput): Promise<Product> {
    const result = await query<ProductRow>(
      `INSERT INTO products (slug, name, description, brand, model, category_id, image_url, attributes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        product.slug,
        product.name,
        product.description || null,
        product.brand || null,
        product.model || null,
        product.categoryId || null,
        product.imageUrl || null,
        JSON.stringify(product.attributes || {}),
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('Failed to create product');
    return mapProductRow(row);
  }

  async update(id: string, data: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') continue;
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query<ProductRow>(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0] ? mapProductRow(result.rows[0]) : null;
  }
}