import type { FeedParameters } from './types.js';

function basisPoints(value: string): number | undefined {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?%$/.exec(value);
  if (!match) return undefined;
  const amount = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return amount <= 10000n ? Number(amount) : undefined;
}

/** Recognized keys only. First occurrence wins, even if malformed. No raw retention. */
export function parseFeedParams(input: string): FeedParameters {
  if (input.length > 4096) return {};
  const result: FeedParameters = {};
  const seen = new Set<string>();
  const entries = input.split(';');
  if (entries.length > 64) return {};
  for (const entry of entries) {
    const match = /^\s*(discount|commissionRate|shopId)\|([^|]*)\|\s*$/.exec(entry);
    if (!match) continue;
    const key = match[1]!;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = match[2]!.trim();
    if (key === 'shopId') {
      if (/^\d{1,100}$/.test(value)) result.shopId = value;
    } else {
      const bps = basisPoints(value);
      if (bps !== undefined) {
        if (key === 'discount') result.discountBps = bps;
        else result.commissionRateBps = bps;
      }
    }
  }
  return result;
}
