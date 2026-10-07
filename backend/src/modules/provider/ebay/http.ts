import type { ReadableStreamDefaultReader } from 'node:stream/web';

export type EbayErrorCode = 'auth' | 'rate_limit' | 'request' | 'upstream' | 'network' | 'malformed';
export class EbayError extends Error {
  constructor(readonly code: EbayErrorCode, readonly status?: number) { super(`eBay ${code} failure`); }
}
export async function ebayJson(transport: typeof fetch, url: string, init: RequestInit, timeoutMs = 5000): Promise<unknown> {
  try {
    const response = await transport(url, { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok) {
      const status = response.status;
      await response.body?.cancel();
      throw new EbayError(status === 401 || status === 403 ? 'auth' : status === 429 ? 'rate_limit'
        : status >= 500 ? 'upstream' : 'request', status);
    }
    if (!response.body) throw new EbayError('malformed');
    const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = []; let size = 0; let reading = true;
    try {
      while (reading) {
        const { done, value } = await reader.read(); reading = !done;
        if (!value) continue;
        size += value.byteLength;
        if (size > 1048576) throw new EbayError('malformed');
        chunks.push(value);
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
      catch { throw new EbayError('malformed'); }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  } catch (error) {
    if (error instanceof EbayError) throw error;
    // Never attach transport errors, headers or upstream bodies: they can contain secrets.
    throw new EbayError('network');
  }
}
