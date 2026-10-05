import { query } from '../../config/database.js';
import type { Merchant } from '@byb/shared/types';

export interface MerchantRepository {
  findAll(): Promise<Merchant[]>;
  findByCode(code: string): Promise<Merchant | null>;
  findById(id: string): Promise<Merchant | null>;
  findForMarket(marketId: string): Promise<Merchant[]>;
}

interface MerchantRow {
  id: string;
  code: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapMerchantRow(row: MerchantRow): Merchant {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresMerchantRepository implements MerchantRepository {
  async findAll(): Promise<Merchant[]> {
    const result = await query<MerchantRow>('SELECT * FROM merchants WHERE is_active = true ORDER BY code');
    return result.rows.map(mapMerchantRow);
  }

  async findByCode(code: string): Promise<Merchant | null> {
    const result = await query<MerchantRow>('SELECT * FROM merchants WHERE code = $1 AND is_active = true', [code]);
    return result.rows[0] ? mapMerchantRow(result.rows[0]) : null;
  }

  async findById(id: string): Promise<Merchant | null> {
    const result = await query<MerchantRow>('SELECT * FROM merchants WHERE id = $1 AND is_active = true', [id]);
    return result.rows[0] ? mapMerchantRow(result.rows[0]) : null;
  }

  async findForMarket(marketId: string): Promise<Merchant[]> {
    const result = await query<MerchantRow>(
      `SELECT m.* FROM merchants m
       JOIN market_merchants mm ON m.id = mm.merchant_id
       WHERE mm.market_id = $1 AND m.is_active = true AND mm.is_enabled = true
       ORDER BY mm.priority DESC, m.code`,
      [marketId]
    );
    return result.rows.map(mapMerchantRow);
  }
}