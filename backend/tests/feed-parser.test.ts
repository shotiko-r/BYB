import { describe, expect, it } from 'vitest';
import { FeedParseError, parseFeedCsv } from '../src/modules/feed/csv.js';
import type { FeedChunks, FeedCsvOptions, FeedRow } from '../src/modules/feed/types.js';

async function collect(input: FeedChunks, options?: FeedCsvOptions): Promise<FeedRow[]> {
  const rows: FeedRow[] = [];
  for await (const row of parseFeedCsv(input, options)) rows.push(row);
  return rows;
}

describe('streaming feed CSV', () => {
  it('reads a basic semicolon-delimited row with exact string values', async () => {
    expect(await collect(['id;name;price\r\n9007199254740993123;Synthetic product;12.30\r\n']))
      .toEqual([{ id: '9007199254740993123', name: 'Synthetic product', price: '12.30' }]);
  });

  it('supports BOM, quoted semicolons, escaped quotes and embedded newlines', async () => {
    expect(await collect(['\uFEFFid;name\r\n1;"A; B ""quoted""\r\nsecond line"\r\n']))
      .toEqual([{ id: '1', name: 'A; B "quoted"\r\nsecond line' }]);
  });

  it('handles arbitrary byte boundaries, including BOM, Unicode and CSV syntax', async () => {
    const bytes = Buffer.from('\uFEFFid;name\r\n1;"Café; ""例""\nnext"\r\n');
    const expected = [{ id: '1', name: 'Café; "例"\nnext' }];
    for (let width = 1; width <= bytes.length; width++) {
      async function* chunks() {
        for (let offset = 0; offset < bytes.length; offset += width) yield bytes.subarray(offset, offset + width);
      }
      expect(await collect(chunks())).toEqual(expected);
    }
  });

  it('preserves Unicode when subdividing a large string chunk internally', async () => {
    // Header and ID prefix use ten code units: surrogate pair crosses 4096.
    const name = `${'a'.repeat(4085)}😀${'b'.repeat(5000)}`;
    expect(await collect([`id;name\n1;${name}\n`])).toEqual([{ id: '1', name }]);
  });

  it.each(['id;name\n1;"unclosed', 'id;name\n1;bad"quote\n', 'id;name\n1;"closed"junk\n',
    'id;name\n1;two;extra\n', 'id;name\n1\n'])('rejects malformed CSV deterministically: %s', async input => {
    await expect(collect([input])).rejects.toMatchObject({ code: 'MALFORMED_CSV' });
  });

  it.each(['', 'id;id\n1;2\n', 'id;\n1;2\n'])('rejects missing/duplicate/empty headers', async input => {
    await expect(collect([input])).rejects.toMatchObject({ code: 'INVALID_HEADERS' });
  });

  it('validates required headers and permits extra columns', async () => {
    await expect(collect(['name\nitem\n'], { requiredHeaders: ['id'] }))
      .rejects.toMatchObject({ code: 'INVALID_HEADERS' });
    expect(await collect(['id;extra\n1;yes\n'], { requiredHeaders: ['id'] })).toEqual([{ id: '1', extra: 'yes' }]);
  });

  it.each([0, -1, 1.5, Infinity])('rejects invalid size limit %s', async maxRecordSize => {
    await expect(collect(['id\n1'], { maxRecordSize })).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  });

  it('bounds oversized fields and aggregate multi-field records', async () => {
    for (const text of ['id;name\n1;' + 'x'.repeat(50), 'a;b;c\n1234567;1234567;1234567']) {
      await expect(collect([text], { maxRecordSize: 20 })).rejects.toMatchObject({ code: 'RECORD_TOO_LARGE' });
    }
    // Delimiters with empty fields must not bypass the buffer limit.
    await expect(collect([';'.repeat(1000)], { maxRecordSize: 20 }))
      .rejects.toMatchObject({ code: 'RECORD_TOO_LARGE' });
  });

  it('counts UTF-8 bytes and exposes no raw records in errors', async () => {
    await expect(collect(['id;name\n1;例例例例'], { maxRecordSize: 10 }))
      .rejects.toMatchObject({ code: 'RECORD_TOO_LARGE' });
    try { await collect(['id;name\n1;"https://synthetic.example/?private=do-not-expose']); }
    catch (error) {
      expect(error).toBeInstanceOf(FeedParseError);
      expect(String(error)).not.toContain('do-not-expose');
      expect(error).not.toHaveProperty('cause');
      expect(error).not.toHaveProperty('record');
    }
  });

  it('sanitizes upstream failures and closes the source', async () => {
    let closed = false;
    async function* source() {
      try { yield 'id;name\n1;item\n'; throw new Error('private source details'); }
      finally { closed = true; }
    }
    await expect(collect(source())).rejects.toMatchObject({ code: 'SOURCE_ERROR', message: 'Feed parsing failed: SOURCE_ERROR' });
    expect(closed).toBe(true);
  });

  it('consumes a large generated stream incrementally with bounded read-ahead', async () => {
    const total = 100_000;
    let produced = 0;
    let consumed = 0;
    let maxAhead = 0;
    async function* source() {
      yield 'id;name\n';
      for (let id = 0; id < total; id++) {
        produced++;
        maxAhead = Math.max(maxAhead, produced - consumed);
        yield `${id};${'x'.repeat(120)}\n`;
      }
    }
    for await (const row of parseFeedCsv(source())) {
      expect(row.id).toBe(String(consumed));
      consumed++;
      if (consumed === 1) expect(produced).toBeLessThan(total);
      if (consumed % 10000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    expect(consumed).toBe(total);
    // Observe producer/consumer distance rather than noisy process-wide RSS.
    expect(maxAhead).toBeLessThan(1000);
  }, 15000);

  it('does not expand one huge input chunk into an unbounded output queue', async () => {
    const iterator = parseFeedCsv(['id;name\n' + '1;item\n'.repeat(100_000)]);
    expect(await iterator.next()).toEqual({ done: false, value: { id: '1', name: 'item' } });
    await iterator.return(undefined);
  });

  it('closes upstream when the consumer stops early', async () => {
    let closed = false;
    let produced = 0;
    async function* source() {
      try {
        yield 'id;name\n';
        while (produced < 100_000) { produced++; yield `${produced};${'x'.repeat(100)}\n`; }
      } finally { closed = true; }
    }
    for await (const row of parseFeedCsv(source())) { expect(row).toHaveProperty('id'); break; }
    expect(closed).toBe(true);
    expect(produced).toBeLessThan(1000);
  });
});
