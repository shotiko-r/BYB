/** Pure contracts: no transport, persistence, credentials or merchant assumptions. */
export type FeedChunks = AsyncIterable<string | Uint8Array> | Iterable<string | Uint8Array>;
export type FeedRow = Readonly<Record<string, string>>;

export interface FeedCsvOptions {
  delimiter?: string;
  /** Max decoded UTF-8 field bytes plus one per separator; defaults to 64 KiB.
   * CSV syntax buffers are independently bounded by csv-parse's record limit. */
  maxRecordSize?: number;
  requiredHeaders?: readonly string[];
}

export interface FeedIssue {
  field: string;
  code: string;
}

export type FeedMappingResult<T> =
  | { ok: true; value: T; warnings: readonly FeedIssue[] }
  | { ok: false; issues: readonly FeedIssue[] };

export interface FeedMapper<T, Context> {
  (row: FeedRow, context: Context): FeedMappingResult<T>;
}

export type CurrencyExponents = Readonly<Record<string, number>>;

export interface FeedParameters {
  discountBps?: number;
  commissionRateBps?: number;
  shopId?: string;
}
