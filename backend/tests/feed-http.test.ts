import { createServer } from 'node:http';
import { gzipSync, deflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { downloadFeed, FeedHttpError, type FeedHttpOptions } from '../src/modules/feed/http.js';

const secretUrl = 'https://feed.example/export?token=synthetic-private-marker';
const defaults = { maxBytes: 10000, maxDurationMs: 1000, maxRetries: 0, retryDelayMs: 0 };
const fake = (implementation: (...args: Parameters<typeof fetch>) => Promise<Response>) => vi.fn(implementation) as typeof fetch & ReturnType<typeof vi.fn>;
async function read(transport: typeof fetch, overrides: Partial<FeedHttpOptions> = {}, url = secretUrl) {
  let size = 0;
  for await (const chunk of downloadFeed(url, { ...defaults, ...overrides, transport })) size += chunk.byteLength;
  return size;
}

describe('bounded feed HTTP transport', () => {
  it('streams success/chunked responses without response buffering methods', async () => {
    const response = new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3])); controller.close();
    } }), { headers: { 'transfer-encoding': 'chunked' } });
    for (const method of ['text', 'json', 'arrayBuffer', 'blob'] as const) {
      vi.spyOn(response, method).mockImplementation(() => { throw new Error('whole-body buffering forbidden'); });
    }
    const transport = fake(async () => response);
    expect(await read(transport)).toBe(3);
    expect(transport).toHaveBeenCalledWith(secretUrl, expect.objectContaining({ redirect: 'manual', signal: expect.any(AbortSignal) }));
  });

  it.each([201, 204, 206])('accepts 2xx %s (empty bodies fail safely)', async status => {
    const transport = fake(async () => new Response(status === 204 ? null : 'csv', { status }));
    if (status === 204) await expect(read(transport)).rejects.toMatchObject({ code: 'EMPTY_BODY' });
    else expect(await read(transport)).toBe(3);
  });

  it('follows a same-origin redirect and cancels its body', async () => {
    const cancel = vi.fn();
    const transport = fake(async (_url, _init) => transport.mock.calls.length === 1
      ? new Response(new ReadableStream({ cancel }), { status: 302, headers: { location: '/next?synthetic=1' } })
      : new Response('ok'));
    expect(await read(transport)).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(transport.mock.calls[1]?.[0]).toBe('https://feed.example/next?synthetic=1');
  });

  it('bounds redirect chains', async () => {
    const transport = fake(async () => new Response(null, { status: 307, headers: { location: '/again' } }));
    await expect(read(transport)).rejects.toMatchObject({ code: 'REDIRECT_LIMIT' });
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it.each(['http://feed.example/feed', 'https://other.example/feed', 'https://u:p@feed.example/feed',
    '//other.example/feed', 'file:///tmp/file', 'https://feed.example/path#fragment', 'https://feed.example\\path'])
  ('rejects unsafe redirect %s', async location => {
    const transport = fake(async () => new Response(null, { status: 302, headers: { location } }));
    await expect(read(transport)).rejects.toMatchObject({ code: 'UNSAFE_REDIRECT' });
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each(['http://feed.example/feed', 'https://u:p@feed.example/feed', 'javascript:alert(1)',
    'https:feed.example/feed', 'https://feed.example\\feed', 'https://feed.example/feed#x'])('rejects unsafe input %s before fetching', async url => {
    const transport = fake(async () => new Response('never'));
    await expect(read(transport, {}, url)).rejects.toMatchObject({ code: 'INVALID_URL' });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 400])('does not retry terminal status %s', async status => {
    const transport = fake(async () => new Response('private upstream body', { status }));
    await expect(read(transport, { maxRetries: 2 })).rejects.toMatchObject({
      code: status === 401 || status === 403 ? 'AUTH' : status === 404 ? 'NOT_FOUND' : 'HTTP_STATUS', status,
    });
    expect(transport).toHaveBeenCalledOnce();
  });

  it.each([429, 500, 503])('retries transient %s before body consumption', async status => {
    const transport = fake(async () => transport.mock.calls.length === 1
      ? new Response('private', { status, headers: { 'retry-after': '0' } }) : new Response('ok'));
    expect(await read(transport, { maxRetries: 2 })).toBe(2);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('bounds transient retries and respects Retry-After without retrying early', async () => {
    const transport = fake(async () => new Response(null, { status: 500 }));
    await expect(read(transport, { maxRetries: 2 })).rejects.toMatchObject({ code: 'UPSTREAM' });
    expect(transport).toHaveBeenCalledTimes(3);
    for (const value of ['60', new Date(Date.now() + 60000).toUTCString()]) {
      const limited = fake(async () => new Response(null, { status: 429, headers: { 'retry-after': value } }));
      await expect(read(limited, { maxRetries: 2 })).rejects.toMatchObject({ code: 'RATE_LIMIT' });
      expect(limited).toHaveBeenCalledOnce();
    }
  });

  it('waits for a permitted positive Retry-After before retrying', async () => {
    vi.useFakeTimers();
    try {
      const transport = fake(async () => transport.mock.calls.length === 1
        ? new Response(null, { status: 429, headers: { 'retry-after': '1' } }) : new Response('ok'));
      const result = read(transport, { maxDurationMs: 10000, maxRetries: 1, maxRetryDelayMs: 2000 });
      await vi.advanceTimersByTimeAsync(999);
      expect(transport).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toBe(2);
      expect(transport).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it('retries network setup failure, sanitizing raw errors', async () => {
    const transport = fake(async () => {
      if (transport.mock.calls.length === 1) throw new Error(secretUrl);
      return new Response('ok');
    });
    expect(await read(transport, { maxRetries: 1 })).toBe(2);
  });

  it('bounds header timeout even if an injected transport ignores abort', async () => {
    const transport = fake(() => new Promise<Response>(() => undefined));
    await expect(read(transport, { requestTimeoutMs: 10 })).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
  });

  it('bounds idle body reads and cancels upstream without body retries', async () => {
    const cancel = vi.fn();
    const transport = fake(async () => new Response(new ReadableStream({ cancel })));
    await expect(read(transport, { readTimeoutMs: 10, maxRetries: 2 })).rejects.toMatchObject({ code: 'READ_TIMEOUT' });
    expect(transport).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('does not retry a partially consumed failing body', async () => {
    let pulls = 0;
    const transport = fake(async () => new Response(new ReadableStream({ pull(controller) {
      if (++pulls === 1) controller.enqueue(new Uint8Array([1]));
      else controller.error(new Error(secretUrl));
    } }, { highWaterMark: 0 })));
    await expect(read(transport, { maxRetries: 2 })).rejects.toMatchObject({ code: 'NETWORK' });
    expect(transport).toHaveBeenCalledOnce();
  });

  it('bounds total duration across retries and stalled bodies', async () => {
    const transport = fake(async () => new Response(null, { status: 500 }));
    await expect(read(transport, { maxDurationMs: 10, maxRetries: 2, retryDelayMs: 100 })).rejects.toMatchObject({ code: 'DURATION_LIMIT' });
  });

  it('honors cancellation and closes a body on early consumer exit', async () => {
    const controller = new AbortController(); controller.abort('private details');
    const never = fake(async () => new Response('never'));
    await expect(read(never, { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(never).not.toHaveBeenCalled();
    const cancel = vi.fn();
    const transport = fake(async () => new Response(new ReadableStream({ pull(stream) { stream.enqueue(new Uint8Array([1])); }, cancel })));
    for await (const _chunk of downloadFeed(secretUrl, { ...defaults, transport })) break;
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('enforces decoded byte limits without trusting compressed Content-Length', async () => {
    const onBytes = vi.fn();
    const transport = fake(async () => new Response(new Uint8Array(20), {
      headers: { 'content-encoding': 'gzip', 'content-length': '2' },
    }));
    await expect(read(transport, { maxBytes: 10, onBytes })).rejects.toMatchObject({ code: 'BYTE_LIMIT' });
    expect(onBytes).toHaveBeenCalledWith(20);
    const oversized = fake(async () => new Response('small', { headers: { 'content-length': '999999999999999999999999999' } }));
    await expect(read(oversized)).rejects.toMatchObject({ code: 'BYTE_LIMIT' });
  });

  it.each(['br', 'gzip, deflate', 'unknown'])('rejects unsupported/chained encoding %s', async encoding => {
    await expect(read(fake(async () => new Response('body', { headers: { 'content-encoding': encoding } }))))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_ENCODING' });
  });

  it('never exposes URL, response body, Location or raw exceptions', async () => {
    for (const transport of [fake(async () => { throw new Error(secretUrl); }),
      fake(async () => new Response(secretUrl, { status: 401 })),
      fake(async () => new Response(null, { status: 302, headers: { location: 'https://other.example/?token=synthetic-private-marker' } }))]) {
      try { await read(transport); throw new Error('expected failure'); }
      catch (error) {
        expect(error).toBeInstanceOf(FeedHttpError);
        expect(`${String(error)}${JSON.stringify(error)}`).not.toContain('synthetic-private-marker');
        expect(error).not.toHaveProperty('cause');
      }
    }
  });

  it.each(['gzip', 'deflate'])('native Node fetch decodes %s: local fixture only', async encoding => {
    const content = 'id;name\n1;' + 'x'.repeat(10000);
    const compressed = encoding === 'gzip' ? gzipSync(content) : deflateSync(content);
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-encoding': encoding, 'content-length': compressed.length });
      res.end(compressed);
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('fixture setup');
      // Inject only in tests: production URL validation remains HTTPS-only.
      const transport: typeof fetch = (_url, init) => fetch(`http://127.0.0.1:${address.port}`, init);
      expect(await read(transport, { maxBytes: 20000 })).toBe(Buffer.byteLength(content));
      await expect(read(transport, { maxBytes: 100 })).rejects.toMatchObject({ code: 'BYTE_LIMIT' });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
