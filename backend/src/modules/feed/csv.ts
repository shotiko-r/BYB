import { Readable, type TransformOptions } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { parse, type Options } from 'csv-parse';
import type { FeedChunks, FeedCsvOptions, FeedRow } from './types.js';

export class FeedParseError extends Error {
  constructor(readonly code: 'INVALID_OPTIONS' | 'INVALID_HEADERS' | 'RECORD_TOO_LARGE' | 'MALFORMED_CSV' | 'SOURCE_ERROR') {
    // Never retain parser errors: they may contain raw records or URLs.
    super(`Feed parsing failed: ${code}`);
    this.name = 'FeedParseError';
  }
}

/** Bounded streaming parser. Consumers own batching; breaking iteration closes input. */
export async function* parseFeedCsv(chunks: FeedChunks, options: FeedCsvOptions = {}): AsyncGenerator<FeedRow> {
  const maxRecordSize = options.maxRecordSize ?? 65536;
  const delimiter = options.delimiter ?? ';';
  if (!Number.isSafeInteger(maxRecordSize) || maxRecordSize < 1 || [...delimiter].length !== 1
    || /[\r\n"\uFEFF]/u.test(delimiter)) throw new FeedParseError('INVALID_OPTIONS');

  // Subdivide even an oversized caller chunk so a single transform write cannot
  // enqueue an entire file's records. Caller-owned input memory is not ours.
  async function* boundedChunks() {
    for await (const chunk of chunks) {
      if (typeof chunk === 'string') {
        for (let offset = 0; offset < chunk.length;) {
          let end = Math.min(offset + 4096, chunk.length);
          // Do not split a UTF-16 surrogate pair during our UTF-8 conversion.
          if (end < chunk.length && /[\uD800-\uDBFF]/u.test(chunk[end - 1]!)
            && /[\uDC00-\uDFFF]/u.test(chunk[end]!)) end--;
          yield Buffer.from(chunk.slice(offset, end), 'utf8');
          offset = end;
        }
      } else {
        for (let offset = 0; offset < chunk.length; offset += 4096) {
          yield chunk.subarray(offset, offset + 4096);
        }
      }
    }
  }
  const input = Readable.from(boundedChunks(), { objectMode: false, highWaterMark: 4096 });
  let recordSize = 0;
  const parserOptions: Options & TransformOptions = { delimiter, bom: true, max_record_size: maxRecordSize,
    skip_empty_lines: true, readableHighWaterMark: 16, writableHighWaterMark: 4096,
    // Count separators too: max_record_size alone does not bound empty fields.
    cast(value, context) {
      recordSize += Buffer.byteLength(value, 'utf8') + (context.index > 0 ? 1 : 0);
      if (recordSize > maxRecordSize) throw new FeedParseError('RECORD_TOO_LARGE');
      return value;
    },
    on_record(record) { recordSize = 0; return record; },
  };
  const parser = parse(parserOptions);
  let sourceFailed = false;
  input.on('error', () => { sourceFailed = true; });
  // Attach rejection handling immediately, including on early consumer exit.
  const completion = pipeline(input, parser).catch(() => undefined);
  let headers: string[] | undefined;
  try {
    for await (const values of parser as AsyncIterable<string[]>) {
      if (!headers) {
        if (!values.length || values.some(header => !header.trim()) || new Set(values).size !== values.length
          || options.requiredHeaders?.some(header => !values.includes(header))) {
          throw new FeedParseError('INVALID_HEADERS');
        }
        headers = values;
        continue;
      }
      yield Object.fromEntries(headers.map((header, index) => [header, values[index]!]));
    }
    if (!headers) throw new FeedParseError('INVALID_HEADERS');
  } catch (error) {
    if (error instanceof FeedParseError) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'CSV_MAX_RECORD_SIZE') throw new FeedParseError('RECORD_TOO_LARGE');
    // Pipeline also forwards parser errors to input; CSV codes take precedence.
    if (typeof code === 'string' && (code.startsWith('CSV_') || code === 'INVALID_OPENING_QUOTE')) {
      throw new FeedParseError('MALFORMED_CSV');
    }
    throw new FeedParseError(sourceFailed ? 'SOURCE_ERROR' : 'MALFORMED_CSV');
  } finally {
    input.destroy();
    parser.destroy();
    await completion;
  }
}
