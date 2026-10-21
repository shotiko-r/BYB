import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// Any accidental application/DB import makes this suite fail at import time.
vi.mock('pg', () => { throw new Error('Database access forbidden in Phase B'); });
vi.mock('../src/config/database.js', () => { throw new Error('Database access forbidden in Phase B'); });
vi.mock('../src/config/env.js', () => { throw new Error('Application bootstrap forbidden in Phase B'); });

import { dryRunFeed } from '../src/modules/feed/importer.js';
import { loadFeedConfig, type FeedRunConfig } from '../src/modules/feed/config.js';
import { EnvSchema } from '../src/config/env-schema.js';
import { ALIEXPRESS_HEADERS } from '../src/modules/feed/merchants/aliexpress.js';
import * as aliExpressMapper from '../src/modules/feed/merchants/aliexpress.js';
import { runFeedCli } from '../src/scripts/import-admitad-feed.js';

const privateMarker = 'synthetic-private-marker';
const environment = {
  ADMITAD_ALIEXPRESS_FEED_ENABLED: 'true',
  ADMITAD_ALIEXPRESS_FEED_URL: `https://feed.example/catalog?token=${privateMarker}`,
};
const header = `${ALIEXPRESS_HEADERS.join(';')}\n`;
function row(id: number, price = '12.30', oldprice = '', category = 'Synthetic') {
  return `${id};Synthetic;https://tracking.example/click?token=${privateMarker};${category};USD;;https://images.example/item.jpg;${oldprice};${price}\n`;
}
const config = (override: Partial<FeedRunConfig> = {}): FeedRunConfig => ({ ...loadFeedConfig(environment), ...override });
const body = (text: string): typeof fetch => vi.fn(async () => new Response(text));

describe('bounded feed dry-run importer', () => {
  it('counts valid/malformed merchant rows, warnings, currencies and category aggregates', async () => {
    const stats = await dryRunFeed(config(), { transport: body(header + row(1) + row(2, 'bad') + row(3, '1.00', 'bad')) });
    expect(stats).toMatchObject({ feedKey: 'aliexpress-ww', status: 'success', completionReason: 'completed',
      rowsSeen: 3, rowsAccepted: 2, rowsRejected: 1, warnings: 1, currencies: { USD: 2 },
      rejectionReasons: { 'price:INVALID_MONEY': 1 }, warningReasons: { 'oldprice:INVALID_OLD_PRICE': 1 } });
    expect(stats.bytesRead).toBe(Buffer.byteLength(header + row(1) + row(2, 'bad') + row(3, '1.00', 'bad')));
    expect(stats.categories).toEqual([{ key: expect.stringMatching(/^category-[a-f0-9]{16}$/), count: 2, error: 0 }]);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(stats)).not.toContain(privateMarker);
    expect(JSON.stringify(stats)).not.toContain('https://');
    expect(stats).not.toHaveProperty('products');
  });

  it('limits accepted products rather than scanned rows and cancels upstream', async () => {
    const cancel = vi.fn();
    let index = -1;
    let produced = 0;
    let signal: AbortSignal | null | undefined;
    const transport: typeof fetch = vi.fn(async (_url, init) => {
      signal = init?.signal;
      return new Response(new ReadableStream({ pull(controller) {
        const text = index++ < 0 ? header : row(index, index <= 50 ? 'bad' : '12.30');
        produced++;
        controller.enqueue(Buffer.from(text));
      }, cancel }, { highWaterMark: 0 }));
    });
    const stats = await dryRunFeed(config({ maxProducts: 3 }), { transport });
    expect(stats).toMatchObject({ status: 'success', completionReason: 'limit_reached', rowsSeen: 53, rowsAccepted: 3, rowsRejected: 50 });
    expect(cancel).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(true);
    expect(produced).toBeLessThan(1000);
  });

  it('bounds diagnostics and category cardinality without raw values', async () => {
    let input = header;
    for (let index = 0; index < 100; index++) input += row(index, 'bad') + row(index + 100, '1.00', 'bad', `category${index}`);
    const stats = await dryRunFeed(config(), { transport: body(input) });
    expect(stats.rowsRejected).toBe(100);
    expect(stats.rowsAccepted).toBe(100);
    expect(stats.warnings).toBe(100);
    expect(stats.rejectionSamples).toHaveLength(10);
    expect(stats.warningSamples).toHaveLength(10);
    expect(stats.categories).toHaveLength(20);
    expect(stats.categories.reduce((sum, category) => sum + category.count, 0)).toBe(100);
    expect(JSON.stringify(stats)).not.toContain('category99');
    expect(JSON.stringify(stats)).not.toContain(privateMarker);
  });

  it('treats a CSV framing failure as fatal without logging source text', async () => {
    const stats = await dryRunFeed(config(), { transport: body(header + `1;"${privateMarker}`) });
    expect(stats).toMatchObject({ status: 'failed', completionReason: 'parser_error', errorCode: 'MALFORMED_CSV' });
    expect(JSON.stringify(stats)).not.toContain(privateMarker);
  });

  it('enforces the Phase A maximum record size and required headers', async () => {
    for (const text of [header + row(1).replace('Synthetic;', 'x'.repeat(70000) + ';'), 'id;name\n1;item\n']) {
      const stats = await dryRunFeed(config(), { transport: body(text) });
      expect(stats.status).toBe('failed');
      expect(stats.completionReason).toBe('parser_error');
    }
  });

  it('reports byte-limit failure through parser error sanitization', async () => {
    const stats = await dryRunFeed(config({ maxBytes: 50 }), { transport: body(header + row(1)) });
    expect(stats).toMatchObject({ status: 'failed', completionReason: 'byte_limit', errorCode: 'BYTE_LIMIT' });
  });

  it('bounds total duration including stalled setup', async () => {
    const transport: typeof fetch = () => new Promise<Response>(() => undefined);
    const stats = await dryRunFeed(config({ maxDurationMs: 10 }), { transport });
    expect(stats).toMatchObject({ status: 'failed', completionReason: 'duration_limit', errorCode: 'DURATION_LIMIT' });
    expect(stats.durationMs).toBeLessThan(1000);
  });

  it('bounds duration during CPU-heavy parsing/mapping and closes the input', async () => {
    const cancel = vi.fn();
    const transport: typeof fetch = async () => new Response(new ReadableStream({ pull(controller) {
      controller.enqueue(Buffer.from(row(1).repeat(1000)));
    }, start(controller) { controller.enqueue(Buffer.from(header)); }, cancel }));
    const stats = await dryRunFeed(config({ maxDurationMs: 10, maxProducts: 1000000 }), { transport });
    expect(stats.completionReason).toBe('duration_limit');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('preserves safe network failure classification and cancellation', async () => {
    const auth = await dryRunFeed(config(), { transport: vi.fn(async () => new Response(privateMarker, { status: 403 })) });
    expect(auth).toMatchObject({ status: 'failed', completionReason: 'http_error', errorCode: 'AUTH' });
    const controller = new AbortController(); controller.abort(privateMarker);
    const transport = body('never');
    expect(await dryRunFeed(config(), { transport, signal: controller.signal })).toMatchObject({ status: 'failed', completionReason: 'cancelled' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('handles 100k+ generated rows with bounded read-ahead and no retained products', async () => {
    const total = 100001;
    let produced = 0;
    let started = false;
    let maxAhead = 0;
    let consumed = 0;
    const originalMapper = aliExpressMapper.mapAliExpressRow;
    // A spy observes actual mapper consumption; mock.calls is cleared so even the
    // test does not accumulate 100k raw rows/mapped return values.
    const mapper = vi.spyOn(aliExpressMapper, 'mapAliExpressRow').mockImplementation((row, context) => {
      consumed++;
      mapper.mockClear();
      return originalMapper(row, context);
    });
    const transport: typeof fetch = async () => new Response(new ReadableStream({ pull(controller) {
      if (!started) { started = true; controller.enqueue(Buffer.from(header)); return; }
      if (produced === total) { controller.close(); return; }
      produced++;
      controller.enqueue(Buffer.from(row(produced, '12.30', '', `category${produced % 100}`)));
      maxAhead = Math.max(maxAhead, produced - consumed);
    } }, { highWaterMark: 0 }));
    try {
      const stats = await dryRunFeed(config({ maxProducts: total + 1, maxDurationMs: 120000 }), { transport });
      expect(stats).toMatchObject({ status: 'success', completionReason: 'completed', rowsSeen: total, rowsAccepted: total, rowsRejected: 0 });
      expect(produced).toBe(total);
      expect(consumed).toBe(total);
      expect(maxAhead).toBeLessThan(1000);
      expect(stats.categories.length).toBeLessThanOrEqual(20);
      expect(JSON.stringify(stats).length).toBeLessThan(5000);
    } finally { mapper.mockRestore(); }
  }, 30000);
});

describe('feed runtime configuration and CLI', () => {
  const args = ['--feed', 'aliexpress-ww', '--dry-run'];
  async function cli(argv: string[], env: NodeJS.ProcessEnv = environment) {
    const stdout = vi.fn(); const stderr = vi.fn(); const transport = body(header + row(1) + row(2));
    const code = await runFeedCli(argv, env, { stdout, stderr }, { transport });
    return { code, stdout, stderr, transport };
  }

  it('defaults disabled and validates backend fields without requiring database bootstrap', () => {
    expect(() => loadFeedConfig({})).toThrow('Invalid or disabled feed configuration');
    expect(loadFeedConfig(environment)).toMatchObject({ maxProducts: 5000, maxBytes: 104857600, maxDurationMs: 120000, markets: ['GE'] });
    const app = EnvSchema.parse({ DATABASE_URL: 'postgres://example.invalid/db' });
    expect(app.ADMITAD_ALIEXPRESS_FEED_ENABLED).toBe(false);
    for (const override of [{ ADMITAD_ALIEXPRESS_FEED_ENABLED: 'yes' }, { ADMITAD_ALIEXPRESS_FEED_MARKETS: 'GE,secret' },
      { ADMITAD_ALIEXPRESS_FEED_MAX_PRODUCTS: '0' }, { ADMITAD_ALIEXPRESS_FEED_MAX_BYTES: '-1' },
      { ADMITAD_ALIEXPRESS_FEED_MAX_DURATION_SECONDS: '3601' }, { ADMITAD_ALIEXPRESS_FEED_URL: 'http://feed.example' }]) {
      expect(() => loadFeedConfig({ ...environment, ...override })).toThrow('Invalid or disabled feed configuration');
    }
  });

  it.each([['--feed', 'aliexpress-ww'], ['--feed', 'unknown', '--dry-run'],
    [...args, '--url', 'https://feed.example/private'], [...args, '--feed-url', 'https://feed.example/private'],
    [...args, 'https://feed.example/private'], [...args, '--dry-run'], [...args, '--max-products', 'NaN']])
  ('refuses invalid CLI arguments without fetching: %j', async argv => {
    const result = await cli(argv);
    expect(result.code).toBe(1);
    expect(result.transport).not.toHaveBeenCalled();
    expect(result.stderr).toHaveBeenCalledWith(expect.stringContaining('CLI_ARGUMENTS'));
  });

  it('allows lower CLI limits and refuses increases beyond configured maxima', async () => {
    const lowered = await cli([...args, '--max-products', '1', '--max-bytes', '10000', '--max-duration-seconds', '10']);
    expect(lowered.code).toBe(0);
    expect(JSON.parse(lowered.stdout.mock.calls[0]![0])).toMatchObject({ completionReason: 'limit_reached', rowsAccepted: 1 });
    for (const [flag, value] of [['--max-products', '5001'], ['--max-bytes', '104857601'], ['--max-duration-seconds', '121']]) {
      const raised = await cli([...args, flag!, value!]);
      expect(raised.code).toBe(1);
      expect(raised.transport).not.toHaveBeenCalled();
    }
  });

  it('outputs only safe JSON for success, configuration, network and parser failures', async () => {
    for (const result of [await cli(args), await cli(args, { ...environment, ADMITAD_ALIEXPRESS_FEED_ENABLED: 'false' }),
      await cli([...args, '--url', privateMarker])]) {
      expect(JSON.stringify([result.stdout.mock.calls, result.stderr.mock.calls])).not.toContain(privateMarker);
    }
    for (const transport of [body(header + '1;"' + privateMarker),
      vi.fn(async () => new Response(privateMarker, { status: 401 }))]) {
      const stdout = vi.fn(); const stderr = vi.fn();
      expect(await runFeedCli(args, environment, { stdout, stderr }, { transport })).toBe(1);
      expect(JSON.stringify([stdout.mock.calls, stderr.mock.calls])).not.toContain(privateMarker);
    }
  });

  it('actual CLI rejects missing dry-run before any network or DB access', () => {
    const result = spawnSync(process.execPath, [resolve('../node_modules/tsx/dist/cli.mjs'),
      'src/scripts/import-admitad-feed.ts', '--feed', 'aliexpress-ww'], {
      cwd: resolve('.'), encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH, ADMITAD_ALIEXPRESS_FEED_URL: environment.ADMITAD_ALIEXPRESS_FEED_URL },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CLI_ARGUMENTS');
    expect(result.stdout + result.stderr).not.toContain(privateMarker);
  });
});
