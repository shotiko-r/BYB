import type { ProviderProduct } from '@byb/shared/types';
import { query } from '../../config/database.js';

interface CreateProductInput {
  slug: string;
  name: string;
  description?: string;
  brand?: string;
  model?: string;
  categoryId?: string;
  imageUrl?: string;
  attributes?: Record<string, unknown>;
}

interface OfferInput {
  merchantId: string;
  marketId: string;
  externalProductId: string;
  priceAmount: number;
  currencyCode: string;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'pre_order' | 'unknown';
  shippingInfo: Record<string, unknown>;
  destinationUrl: string;
  affiliateMetadata: Record<string, unknown>;
  lastCheckedAt: string;
  isActive: boolean;
}

interface NormalizedProduct {
  product: CreateProductInput;
  offer: OfferInput;
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
}

interface ProviderProductsWithMerchant {
  products: ProviderProduct[];
  merchantId: string;
}

function generateSlug(name: string, brand?: string, model?: string): string {
  const base = [brand, model, name].filter(Boolean).join(' ').toLowerCase();
  return base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 200);
}

function findMatchingProduct(
  providerProduct: ProviderProduct,
  existingProducts: ProductRow[]
): ProductRow | null {
  const normalizedName = providerProduct.name.toLowerCase().trim();
  const normalizedBrand = providerProduct.brand?.toLowerCase().trim();
  const normalizedModel = providerProduct.model?.toLowerCase().trim();

  for (const product of existingProducts) {
    const productName = product.name.toLowerCase().trim();
    const productBrand = product.brand?.toLowerCase().trim();
    const productModel = product.model?.toLowerCase().trim();

    if (normalizedName === productName) {
      if ((normalizedBrand && productBrand && normalizedBrand === productBrand) ||
          (normalizedModel && productModel && normalizedModel === productModel) ||
          (!normalizedBrand && !productBrand)) {
        return product;
      }
    }

    if (normalizedBrand && normalizedModel && productBrand && productModel) {
      if (normalizedBrand === productBrand && normalizedModel === productModel) {
        return product;
      }
    }
  }

  return null;
}

export class ProductNormalizationService {
  async normalize(
    providerProductsWithMerchant: ProviderProductsWithMerchant[],
    marketId: string
  ): Promise<NormalizedProduct[]> {
    const existingProductsResult = await query<ProductRow>('SELECT * FROM products WHERE is_active = true');
    const existingProducts = existingProductsResult.rows;

    const normalized: NormalizedProduct[] = [];

    for (const { products, merchantId } of providerProductsWithMerchant) {
      for (const pp of products) {
        const matchedProduct = findMatchingProduct(pp, existingProducts);

        if (matchedProduct) {
          normalized.push({
            product: {
              slug: matchedProduct.slug,
              name: matchedProduct.name,
              description: matchedProduct.description || undefined,
              brand: matchedProduct.brand || undefined,
              model: matchedProduct.model || undefined,
              categoryId: matchedProduct.category_id || undefined,
              imageUrl: matchedProduct.image_url || undefined,
              attributes: matchedProduct.attributes,
            },
            offer: {
              merchantId,
              marketId,
              externalProductId: pp.externalId,
              priceAmount: pp.priceAmount,
              currencyCode: pp.currencyCode,
              availability: pp.availability || 'unknown',
              shippingInfo: pp.shippingInfo || {},
              destinationUrl: pp.destinationUrl,
              affiliateMetadata: pp.affiliateMetadata || {},
              lastCheckedAt: new Date().toISOString(),
              isActive: true,
            },
          });
        } else {
          const slug = generateSlug(pp.name, pp.brand, pp.model);
          const categoryId = await this.findOrCreateCategory(pp.category);

          normalized.push({
            product: {
              slug,
              name: pp.name,
              description: pp.description,
              brand: pp.brand,
              model: pp.model,
              categoryId,
              imageUrl: pp.imageUrl,
              attributes: pp.attributes || {},
            },
            offer: {
              merchantId,
              marketId,
              externalProductId: pp.externalId,
              priceAmount: pp.priceAmount,
              currencyCode: pp.currencyCode,
              availability: pp.availability || 'unknown',
              shippingInfo: pp.shippingInfo || {},
              destinationUrl: pp.destinationUrl,
              affiliateMetadata: pp.affiliateMetadata || {},
              lastCheckedAt: new Date().toISOString(),
              isActive: true,
            },
          });
        }
      }
    }

    return normalized;
  }

  private async findOrCreateCategory(categorySlug?: string): Promise<string | undefined> {
    if (!categorySlug) return undefined;

    const existing = await query<CategoryRow>('SELECT id FROM categories WHERE slug = $1', [categorySlug]);
    if (existing.rows[0]) return existing.rows[0].id;

    const name = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1).replace(/-/g, ' ');
    const result = await query<CategoryRow>(
      'INSERT INTO categories (slug, name) VALUES ($1, $2) RETURNING id',
      [categorySlug, name]
    );
    return result.rows[0]?.id;
  }

  async persist(normalized: NormalizedProduct[]): Promise<void> {
    await query('BEGIN').catch(() => null);

    try {
      for (const { product, offer } of normalized) {
        let productId: string;

        const existing = await query<ProductRow>(
          'SELECT id FROM products WHERE slug = $1 AND (category_id = $2 OR (category_id IS NULL AND $2 IS NULL))',
          [product.slug, product.categoryId || null]
        );

        if (existing.rows[0]) {
          productId = existing.rows[0].id;
        } else {
          const created = await query<{ id: string }>(
            `INSERT INTO products (slug, name, description, brand, model, category_id, image_url, attributes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
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
          productId = created.rows[0]?.id || '';
        }

        await query(
          `INSERT INTO offers (product_id, merchant_id, market_id, external_product_id, price_amount, currency_code, availability, shipping_info, destination_url, affiliate_metadata, last_checked_at, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (product_id, merchant_id, market_id, external_product_id) DO UPDATE SET
             price_amount = EXCLUDED.price_amount,
             currency_code = EXCLUDED.currency_code,
             availability = EXCLUDED.availability,
             shipping_info = EXCLUDED.shipping_info,
             destination_url = EXCLUDED.destination_url,
             affiliate_metadata = EXCLUDED.affiliate_metadata,
             last_checked_at = EXCLUDED.last_checked_at,
             is_active = EXCLUDED.is_active,
             updated_at = NOW()`,
          [
            productId,
            offer.merchantId,
            offer.marketId,
            offer.externalProductId,
            offer.priceAmount,
            offer.currencyCode,
            offer.availability,
            JSON.stringify(offer.shippingInfo),
            offer.destinationUrl,
            JSON.stringify(offer.affiliateMetadata),
            offer.lastCheckedAt,
            offer.isActive,
          ]
        );
      }

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  }
}