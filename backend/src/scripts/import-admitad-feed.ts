import { resolve } from 'node:path';
import { config as loadDotEnv } from 'dotenv';
import { loadFeedConfig, FeedConfigError } from '../modules/feed/config.js';
import { FeedPersistenceError } from '../modules/feed/repository.js';
import { applyFeed, dryRunFeed } from '../modules/feed/importer.js';

class FeedCliError extends Error {
  constructor() { super('Invalid arguments: require --feed aliexpress-ww --dry-run or --apply; limits may only be lowered'); }
}

function argumentsForFeed(args: readonly string[]): Map<string, string> {
  const options = new Map<string, string>();
  const valued = new Set(['--feed', '--max-products', '--max-bytes', '--max-duration-seconds', '--batch-size']);
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (options.has(flag)) throw new FeedCliError();
    if (flag === '--dry-run' || flag === '--apply') options.set(flag, 'true');
    else if (valued.has(flag) && args[index + 1] && !args[index + 1]!.startsWith('--')) {
      options.set(flag, args[++index]!);
    } else throw new FeedCliError();
  }
  if (options.has('--dry-run') === options.has('--apply') || options.get('--feed') !== 'aliexpress-ww') throw new FeedCliError();
  return options;
}

/** Injectable entrypoint for synthetic tests. No application/bootstrap/DB imports. */
export async function runFeedCli(args: readonly string[], environment: NodeJS.ProcessEnv,
  output: { stdout: (text: string) => void; stderr: (text: string) => void },
  dependencies: { transport?: typeof fetch; signal?: AbortSignal } = {}): Promise<number> {
  try {
    const options = argumentsForFeed(args);
    const config = loadFeedConfig(environment);
    const lower = (flag: string, maximum: number): number => {
      const raw = options.get(flag);
      if (raw === undefined) return maximum;
      const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
      if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new FeedCliError();
      return value;
    };
    config.maxProducts = lower('--max-products', config.maxProducts);
    config.maxBytes = lower('--max-bytes', config.maxBytes);
    config.maxDurationMs = lower('--max-duration-seconds', config.maxDurationMs / 1000) * 1000;
    let stats;
    if (options.has('--apply')) {
      if (!environment.DATABASE_URL) throw new FeedConfigError();
      const batchSize = lower('--batch-size', 250);
      const { default: pg } = await import('pg');
      const { FeedRepository } = await import('../modules/feed/repository.js');
      const pool = new pg.Pool({ connectionString: environment.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });
      try { stats = await applyFeed(config, new FeedRepository(pool), { ...dependencies, batchSize: options.has('--batch-size') ? batchSize : 100 }); }
      finally { await pool.end(); }
    } else {
      if (options.has('--batch-size')) throw new FeedCliError();
      stats = await dryRunFeed(config, dependencies);
    }
    output.stdout(JSON.stringify(stats));
    return stats.status === 'success' ? 0 : 1;
  } catch (error) {
    output.stderr(JSON.stringify({ feedKey: 'aliexpress-ww', status: 'failed',
      errorCode: error instanceof FeedCliError ? 'CLI_ARGUMENTS' : error instanceof FeedConfigError ? 'CONFIG_ERROR' : error instanceof FeedPersistenceError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof FeedCliError || error instanceof FeedConfigError ? error.message : 'Dry-run failed' }));
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  // Explicit path: npm workspace commands run in backend/, while local .env is
  // repository-root. Read runtime secrets only; dotenv does not override them.
  loadDotEnv({ path: resolve(__dirname, '../../../.env') });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  void runFeedCli(process.argv.slice(2), process.env, {
    stdout: text => { process.stdout.write(`${text}\n`); }, stderr: text => { process.stderr.write(`${text}\n`); },
  }, { signal: controller.signal }).then(code => {
    process.exitCode = code;
  }).catch(() => {
    process.stderr.write('{"status":"failed","errorCode":"INTERNAL_ERROR"}\n');
    process.exitCode = 1;
  }).finally(() => {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  });
}
