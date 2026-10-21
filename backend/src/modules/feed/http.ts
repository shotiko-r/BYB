import { setTimeout as sleep } from 'node:timers/promises';
import type { ReadableStreamReadResult } from 'node:stream/web';

export type FeedHttpCode = 'INVALID_URL' | 'INVALID_OPTIONS' | 'REDIRECT_LIMIT' | 'UNSAFE_REDIRECT'
  | 'AUTH' | 'NOT_FOUND' | 'RATE_LIMIT' | 'UPSTREAM' | 'HTTP_STATUS' | 'NETWORK'
  | 'REQUEST_TIMEOUT' | 'READ_TIMEOUT' | 'DURATION_LIMIT' | 'BYTE_LIMIT' | 'CANCELLED'
  | 'UNSUPPORTED_ENCODING' | 'EMPTY_BODY';

export class FeedHttpError extends Error {
  constructor(readonly code: FeedHttpCode, readonly status?: number, readonly retryAfterMs?: number) {
    super(`Feed download failed: ${code}`);
    this.name = 'FeedHttpError';
  }
}

/** No URL/userinfo normalization surprises; redirect policy is same-origin only. */
export function validateFeedUrl(value: string): URL {
  if (!/^https:\/\//i.test(value) || /[\s\\]/u.test(value)) throw new FeedHttpError('INVALID_URL');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash) throw new Error();
    return url;
  } catch { throw new FeedHttpError('INVALID_URL'); }
}

export interface FeedHttpOptions {
  maxBytes: number;
  maxDurationMs: number;
  requestTimeoutMs?: number;
  readTimeoutMs?: number;
  maxRedirects?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  signal?: AbortSignal;
  /** Must implement native fetch's decoded-body contract; injection is for tests. */
  transport?: typeof fetch;
  onBytes?: (total: number) => void;
}

function aborted(signal: AbortSignal): FeedHttpError {
  return signal.reason instanceof FeedHttpError ? signal.reason : new FeedHttpError('CANCELLED');
}

/** Also bounds injected transports/readers which fail to honor AbortSignal. */
async function interruptible<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw aborted(signal);
  let listener: () => void = () => undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      listener = () => reject(aborted(signal));
      signal.addEventListener('abort', listener, { once: true });
    })]);
  } finally { signal.removeEventListener('abort', listener); }
}

function retryAfter(value: string | null): number | undefined {
  if (!value || value.length > 128) return undefined;
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, 86400000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.min(date - Date.now(), 86400000)) : undefined;
}

/** Streaming only. Retry setup/status failures, never replay a partially consumed body. */
export async function* downloadFeed(rawUrl: string, options: FeedHttpOptions): AsyncGenerator<Uint8Array> {
  const initial = validateFeedUrl(rawUrl);
  const requestTimeoutMs = options.requestTimeoutMs ?? 10000;
  const readTimeoutMs = options.readTimeoutMs ?? 10000;
  const maxRedirects = options.maxRedirects ?? 3;
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 250;
  const maxRetryDelayMs = options.maxRetryDelayMs ?? 5000;
  if (![options.maxBytes, options.maxDurationMs, requestTimeoutMs, readTimeoutMs].every(n => Number.isSafeInteger(n) && n > 0)
    || ![maxRedirects, maxRetries, retryDelayMs, maxRetryDelayMs].every(n => Number.isSafeInteger(n) && n >= 0)
    || maxRedirects > 3 || maxRetries > 2 || options.maxDurationMs > 3600000
    || requestTimeoutMs > 3600000 || readTimeoutMs > 3600000) throw new FeedHttpError('INVALID_OPTIONS');
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  const durationTimer = setTimeout(() => controller.abort(new FeedHttpError('DURATION_LIMIT')), options.maxDurationMs);
  const transport = options.transport ?? fetch;
  let response: Response | undefined;
  let requestController: AbortController | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let url = initial;
      try {
        for (let redirects = 0; ; redirects++) {
          if (signal.aborted) throw aborted(signal);
          requestController = new AbortController();
          const requestSignal = AbortSignal.any([signal, requestController.signal]);
          const timer = setTimeout(() => requestController?.abort(new FeedHttpError('REQUEST_TIMEOUT')), requestTimeoutMs);
          try {
            const pending = transport(url.href, { method: 'GET', redirect: 'manual', signal: requestSignal,
              headers: { Accept: 'text/csv, text/plain;q=0.9', 'Accept-Encoding': 'gzip, deflate' } });
            // Dispose late headers too when a synthetic transport ignores cancellation.
            void pending.then(result => {
              if (requestSignal.aborted) void result.body?.cancel().catch(() => undefined);
            }, () => undefined);
            response = await interruptible(pending, requestSignal);
          } finally { clearTimeout(timer); }
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            void response.body?.cancel().catch(() => undefined);
            if (redirects >= maxRedirects) throw new FeedHttpError('REDIRECT_LIMIT');
            const location = response.headers.get('location');
            try {
              if (!location || /[\s\\]/u.test(location)) throw new Error();
              const next = validateFeedUrl(new URL(location, url).href);
              if (next.origin !== initial.origin) throw new Error();
              url = next;
            } catch { throw new FeedHttpError('UNSAFE_REDIRECT'); }
            continue;
          }
          if (!response.ok) {
            void response.body?.cancel().catch(() => undefined);
            const status = response.status;
            throw new FeedHttpError(status === 401 || status === 403 ? 'AUTH' : status === 404 ? 'NOT_FOUND'
              : status === 429 ? 'RATE_LIMIT' : status >= 500 ? 'UPSTREAM' : 'HTTP_STATUS', status,
            status === 429 || status === 503 ? retryAfter(response.headers.get('retry-after')) : undefined);
          }
          break;
        }
        break;
      } catch (error) {
        const failure = signal.aborted ? aborted(signal) : requestController?.signal.aborted
          ? aborted(requestController.signal) : error instanceof FeedHttpError ? error : new FeedHttpError('NETWORK');
        const transient = ['NETWORK', 'REQUEST_TIMEOUT', 'RATE_LIMIT', 'UPSTREAM'].includes(failure.code);
        const delay = Math.max(retryDelayMs * 2 ** attempt, failure.retryAfterMs ?? 0);
        // A long Retry-After is a stop condition, never permission to retry sooner.
        if (!transient || attempt === maxRetries || delay > maxRetryDelayMs || signal.aborted) throw failure;
        try { await sleep(delay, undefined, { signal }); }
        catch { throw aborted(signal); }
      }
    }
    if (!response?.body) throw new FeedHttpError('EMPTY_BODY');
    const encoding = response.headers.get('content-encoding')?.toLowerCase().trim();
    if (encoding && !['identity', 'gzip', 'deflate'].includes(encoding)) throw new FeedHttpError('UNSUPPORTED_ENCODING');
    // Native Node fetch decodes content-encoding. Content-Length may be compressed;
    // it cannot enforce the decoded byte limit. Never decompress the body twice.
    const length = response.headers.get('content-length');
    if ((!encoding || encoding === 'identity') && length && /^\d+$/.test(length)
      && (length.length > 20 || BigInt(length) > BigInt(options.maxBytes))) throw new FeedHttpError('BYTE_LIMIT');
    reader = response.body.getReader();
    let total = 0;
    for (;;) {
      const timer = setTimeout(() => controller.abort(new FeedHttpError('READ_TIMEOUT')), readTimeoutMs);
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try { chunk = await interruptible(reader.read(), signal); }
      finally { clearTimeout(timer); }
      if (chunk.done) break;
      total += chunk.value.byteLength;
      options.onBytes?.(total);
      if (total > options.maxBytes) throw new FeedHttpError('BYTE_LIMIT');
      yield chunk.value;
    }
  } catch (error) {
    if (signal.aborted) throw aborted(signal);
    if (error instanceof FeedHttpError) throw error;
    throw new FeedHttpError('NETWORK');
  } finally {
    clearTimeout(durationTimer);
    controller.abort(new FeedHttpError('CANCELLED'));
    requestController?.abort();
    if (reader) {
      void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    } else { void response?.body?.cancel().catch(() => undefined); }
  }
}
