import { createHash, randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { FeedParseError, parseFeedCsv } from './csv.js';
import { downloadFeed, FeedHttpError } from './http.js';
import { ALIEXPRESS_HEADERS, mapAliExpressRow } from './merchants/aliexpress.js';
import type { FeedRunConfig } from './config.js';
import type { AliExpressFeedProduct } from './merchants/aliexpress.js';
import type { FeedRepository } from './repository.js';
import { FeedPersistenceError, validateBatchSize } from './repository.js';
import type { FeedIssue } from './types.js';

export interface FeedDryRunStats {
  feedKey: 'aliexpress-ww';
  status: 'success' | 'failed';
  completionReason: 'completed' | 'limit_reached' | 'duration_limit' | 'byte_limit' | 'cancelled' | 'http_error' | 'parser_error' | 'fatal_error';
  errorCode?: string;
  rowsSeen: number;
  rowsAccepted: number;
  rowsRejected: number;
  warnings: number;
  bytesRead: number;
  durationMs: number;
  currencies: Record<string, number>;
  /** Space-Saving heavy hitters: count is an estimate with documented error. */
  categories: { key: string; count: number; error: number }[];
  rejectionReasons: Record<string, number>;
  warningReasons: Record<string, number>;
  rejectionSamples: { row: number; field: string; code: string }[];
  warningSamples: { row: number; field: string; code: string }[];
}

/** Dry-run only: holds counters and bounded diagnostic samples, never products. */
export async function dryRunFeed(config: FeedRunConfig, dependencies: { transport?: typeof fetch; signal?: AbortSignal; onAccepted?: (product: AliExpressFeedProduct) => Promise<void> } = {}): Promise<FeedDryRunStats> {
  const started = performance.now();
  const stats: FeedDryRunStats = { feedKey: 'aliexpress-ww', status: 'success', completionReason: 'completed',
    rowsSeen: 0, rowsAccepted: 0, rowsRejected: 0, warnings: 0, bytesRead: 0, durationMs: 0,
    currencies: {}, categories: [], rejectionReasons: {}, warningReasons: {}, rejectionSamples: [], warningSamples: [] };
  const controller = new AbortController();
  const signal = dependencies.signal ? AbortSignal.any([controller.signal, dependencies.signal]) : controller.signal;
  let transportFailure: FeedHttpError | undefined;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const categoryCounts = new Map<string, { key: string; count: number; error: number }>();
  function recordIssues(issues: readonly FeedIssue[], warning: boolean) {
    const counts = warning ? stats.warningReasons : stats.rejectionReasons;
    const samples = warning ? stats.warningSamples : stats.rejectionSamples;
    for (const issue of issues) {
      // Only mapper-defined fields/codes are retained, never source values.
      const key = `${issue.field}:${issue.code}`;
      counts[key] = (counts[key] ?? 0) + 1;
      if (samples.length < 10) samples.push({ row: stats.rowsSeen, field: issue.field, code: issue.code });
    }
  }
  function category(raw: string) {
    // Avoid leaking arbitrary upstream strings in aggregate output.
    const key = `category-${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
    const existing = categoryCounts.get(key);
    if (existing) { existing.count++; return; }
    if (categoryCounts.size < 20) { categoryCounts.set(key, { key, count: 1, error: 0 }); return; }
    const smallest = [...categoryCounts.values()].reduce((a, b) => a.count <= b.count ? a : b);
    categoryCounts.delete(smallest.key);
    categoryCounts.set(key, { key, count: smallest.count + 1, error: smallest.count });
  }
  async function* source() {
    try {
      yield* downloadFeed(config.url, { maxBytes: config.maxBytes, maxDurationMs: config.maxDurationMs,
        signal, transport: dependencies.transport, onBytes: total => { stats.bytesRead = total; } });
    } catch (error) {
      transportFailure = error instanceof FeedHttpError ? error : new FeedHttpError('NETWORK');
      throw transportFailure;
    }
  }
  try {
    if (config.feedKey !== 'aliexpress-ww' || ![config.maxProducts, config.maxBytes, config.maxDurationMs, config.maxRecordSize]
      .every(n => Number.isSafeInteger(n) && n > 0) || config.maxDurationMs > 3600000) throw new Error();
    timer = setTimeout(() => { timedOut = true; controller.abort(new FeedHttpError('DURATION_LIMIT')); }, config.maxDurationMs);
    for await (const row of parseFeedCsv(source(), { maxRecordSize: config.maxRecordSize, requiredHeaders: ALIEXPRESS_HEADERS })) {
      if (performance.now() - started >= config.maxDurationMs) {
        timedOut = true;
        throw new FeedHttpError('DURATION_LIMIT');
      }
      if (signal.aborted) throw new FeedHttpError('CANCELLED');
      stats.rowsSeen++;
      const mapped = mapAliExpressRow(row, { programNamespace: config.feedKey });
      if (!mapped.ok) { stats.rowsRejected++; recordIssues(mapped.issues, false); }
      else {
        await dependencies.onAccepted?.(mapped.value);
        stats.rowsAccepted++;
        stats.warnings += mapped.warnings.length;
        recordIssues(mapped.warnings, true);
        const currency = mapped.value.currencyCode;
        stats.currencies[currency] = (stats.currencies[currency] ?? 0) + 1;
        category(row.category!);
        if (stats.rowsAccepted >= config.maxProducts) {
          stats.completionReason = 'limit_reached';
          controller.abort();
          break;
        }
      }
      // Let duration/cancellation timers run even on an entirely buffered input.
      if (stats.rowsSeen % 256 === 0) await setImmediate();
    }
    if (timedOut) throw new FeedHttpError('DURATION_LIMIT');
  } catch (error) {
    stats.status = 'failed';
    const failure = timedOut ? new FeedHttpError('DURATION_LIMIT') : transportFailure ?? error;
    if (failure instanceof FeedHttpError) {
      stats.errorCode = failure.code;
      stats.completionReason = failure.code === 'DURATION_LIMIT' ? 'duration_limit' : failure.code === 'BYTE_LIMIT'
        ? 'byte_limit' : failure.code === 'CANCELLED' ? 'cancelled' : 'http_error';
    } else if (failure instanceof FeedParseError) {
      stats.completionReason = 'parser_error'; stats.errorCode = failure.code;
    } else { stats.completionReason = 'fatal_error'; stats.errorCode = failure instanceof FeedPersistenceError ? failure.code : 'INTERNAL_ERROR'; }
  } finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    stats.durationMs = Math.ceil(performance.now() - started);
    stats.categories = [...categoryCounts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }
  return stats;
}

/** Flush only complete batches or a successful bounded run's final partial batch. */
export async function applyFeed(config: FeedRunConfig, repository: FeedRepository,
  dependencies: { transport?: typeof fetch; signal?: AbortSignal; batchSize?: number } = {}) {
  const batchSize = dependencies.batchSize ?? 100;
  validateBatchSize(batchSize);
  if (!config.markets.length || config.markets.some(code => !/^[A-Z]{2}$/.test(code))) throw new FeedPersistenceError('INVALID_MARKETS');
  const syncRunId = randomUUID();
  let committedProducts = 0;
  let committedBatches = 0;
  let pending: AliExpressFeedProduct[] = [];
  return repository.withLocks(config.feedKey, config.markets, async () => {
    const flush = async () => {
      if (!pending.length) return;
      committedProducts += await repository.writeBatch(pending, { feedKey: config.feedKey, markets: config.markets, syncRunId });
      committedBatches++;
      pending = [];
    };
    const stats = await dryRunFeed(config, { ...dependencies, onAccepted: async product => {
      pending.push(product);
      if (pending.length >= batchSize) await flush();
    } });
    if (stats.status === 'success') {
      try { await flush(); } catch {
        stats.status = 'failed'; stats.completionReason = 'fatal_error'; stats.errorCode = 'PERSISTENCE_ERROR';
      }
    }
    return { ...stats, syncRunId, committedProducts, committedBatches };
  });
}
