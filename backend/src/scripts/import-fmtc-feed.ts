import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import pg from 'pg';
import { FmtcError, importFmtc, loadFmtcConfig } from '../modules/feed/fmtc.js';
import { FeedRepository } from '../modules/feed/repository.js';

loadDotEnv({ path: resolve(__dirname, '../../../.env') });
async function main(): Promise<void> {
  if (process.argv.slice(2).join(' ') !== '--apply' || !process.env.DATABASE_URL) throw new FmtcError('CONFIG_OR_ARGUMENTS');
  const config = loadFmtcConfig(process.env);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });
  try { const count = await importFmtc(config, new FeedRepository(pool)); console.log(JSON.stringify({ status: 'success', imported: count })); }
  finally { await pool.end(); }
}
void main().catch((error: unknown) => { console.error(JSON.stringify({ status: 'failed', errorCode: error instanceof FmtcError ? error.code : 'PERSISTENCE' })); process.exitCode = 1; });
