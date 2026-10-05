import { query } from '../../config/database.js';
import type { Market } from '@byb/shared/types';

export interface MarketRepository {
  findAll(): Promise<Market[]>;
  findByCode(code: string): Promise<Market | null>;
  findActive(): Promise<Market[]>;
}

interface MarketRow {
  id: string;
  code: string;
  name: string;
  locale: string;
  language: string;
  currency_code: string;
  currency_symbol: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapMarketRow(row: MarketRow): Market {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    locale: row.locale,
    language: row.language,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresMarketRepository implements MarketRepository {
  async findAll(): Promise<Market[]> {
    const result = await query<MarketRow>('SELECT * FROM markets ORDER BY code');
    return result.rows.map(mapMarketRow);
  }

  async findByCode(code: string): Promise<Market | null> {
    const result = await query<MarketRow>('SELECT * FROM markets WHERE code = $1', [code.toUpperCase()]);
    return result.rows[0] ? mapMarketRow(result.rows[0]) : null;
  }

  async findActive(): Promise<Market[]> {
    const result = await query<MarketRow>('SELECT * FROM markets WHERE is_active = true ORDER BY code');
    return result.rows.map(mapMarketRow);
  }
}