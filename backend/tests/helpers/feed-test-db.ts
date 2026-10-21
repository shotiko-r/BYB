import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';

/** Only callers with explicit disposable test URLs use this fixture. */
export async function initializeFeedTestSchema(pool: Pool, schema: string): Promise<void> {
  if (!/^(feed|search)_test_[a-f0-9]+$/.test(schema)) throw new Error('Invalid test schema');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Extensions are database-global; concurrent schema suites must serialize setup.
    await client.query('SELECT pg_advisory_xact_lock(724193560)');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(readFileSync('../docker/init-db/01-schema.sql', 'utf8')
      .replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
