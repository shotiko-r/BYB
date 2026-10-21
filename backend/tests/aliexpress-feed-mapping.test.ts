import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ProviderProductSchema } from '@byb/shared/types';
import { parseFeedCsv } from '../src/modules/feed/csv.js';
import { parseFeedMoney } from '../src/modules/feed/money.js';
import { parseFeedParams } from '../src/modules/feed/params.js';
import { ALIEXPRESS_HEADERS, mapAliExpressRow } from '../src/modules/feed/merchants/aliexpress.js';

const context = { programNamespace: 'aliexpress-ww' };
const row = {
  id: '900719925474099312345', name: 'Synthetic Product',
  url: 'https://tracking.example/click?product=synthetic&campaign=test', category: 'Synthetic / Electronics',
  currencyId: 'USD', param: 'discount|31%|;commissionRate|5.38%|;shopId|912641216|;',
  picture: 'https://images.example/synthetic.jpg', oldprice: '17.00', price: '12.30',
};
function mapped(overrides = {}) {
  const result = mapAliExpressRow({ ...row, ...overrides }, context);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}

describe('AliExpress feed mapper', () => {
  it('maps a valid synthetic row into a ProviderProduct-compatible shape', () => {
    const { value, warnings } = mapped();
    expect(ProviderProductSchema.safeParse(value).success).toBe(true);
    expect(value).toMatchObject({ providerCode: 'aliexpress', merchantName: 'AliExpress',
      externalId: row.id, externalProductId: row.id, name: row.name,
      destinationUrl: row.url, imageUrl: row.picture, priceAmount: 1230, currencyCode: 'USD' });
    expect(warnings).toEqual([]);
    expect(value.affiliateMetadata).toMatchObject({ merchantCategory: row.category,
      discountBps: 3100, commissionRateBps: 538, shopId: '912641216',
      oldPriceAmount: 1700, oldPriceCurrencyCode: 'USD' });
    expect(value).not.toHaveProperty('category');
  });

  it('preserves exact large IDs and leading zeros without number conversion', () => {
    for (const id of [row.id, '00012345678901234567890']) {
      expect(mapped({ id }).value.externalProductId).toBe(id);
      expect(mapped({ id }).value.externalId).toBe(id);
    }
  });

  it.each(['url', 'picture'])('validates %s URLs without rewriting tracking data', field => {
    for (const url of ['https://tracking.example/path?x=a%2Fb&y=synthetic#anchor', 'http://images.example/item.jpg']) {
      const value = mapped({ [field]: url }).value;
      expect(field === 'url' ? value.destinationUrl : value.imageUrl).toBe(url);
    }
    for (const url of ['', 'not a url', '/relative', '//tracking.example/path', 'javascript:alert(1)',
      'data:image/png;base64,AAAA', 'file:///tmp/image', 'https://user:password@tracking.example/path',
      'https:tracking.example/path', 'https://tracking.example\\path',
      'https://tracking.example/has space', 'https://tracking.example/\npath']) {
      expect(mapAliExpressRow({ ...row, [field]: url }, context)).toMatchObject({ ok: false,
        issues: expect.arrayContaining([{ field, code: 'INVALID_URL' }]) });
    }
  });

  it('rejects column length violations rather than truncating URLs or identities', () => {
    for (const override of [{ url: `https://tracking.example/${'x'.repeat(1000)}` },
      { picture: `https://images.example/${'x'.repeat(500)}` }, { id: '1'.repeat(201) },
      { name: 'x'.repeat(301) }, { name: '  ' }, { category: 'x'.repeat(2001) }]) {
      expect(mapAliExpressRow({ ...row, ...override }, context).ok).toBe(false);
    }
  });

  it.each(['', '-1', '12.345', '1e2', '12,30', '1,000.00', '21474836.48', 'NaN'])('rejects invalid current price %s', price => {
    expect(mapAliExpressRow({ ...row, price }, context)).toMatchObject({ ok: false,
      issues: expect.arrayContaining([expect.objectContaining({ field: 'price' })]) });
  });

  it('rejects missing required headers, including missing current price', () => {
    for (const header of ALIEXPRESS_HEADERS) {
      const incomplete: Record<string, string> = { ...row };
      delete incomplete[header];
      expect(mapAliExpressRow(incomplete, context)).toMatchObject({ ok: false,
        issues: [{ field: header, code: 'MISSING_FIELD' }] });
    }
  });

  it.each(['usd', ' USD ', 'EUR', 'XXX'])('rejects non-uppercase or unsupported currency %s', currencyId => {
    expect(mapAliExpressRow({ ...row, currencyId }, context).ok).toBe(false);
  });

  it('omits blank oldprice and reports invalid optional oldprice without dropping a valid product', () => {
    expect(mapped({ oldprice: '' }).value.affiliateMetadata).not.toHaveProperty('oldPriceAmount');
    const invalid = mapped({ oldprice: '12.345' });
    expect(invalid.value.affiliateMetadata).not.toHaveProperty('oldPriceAmount');
    expect(invalid.warnings).toEqual([{ field: 'oldprice', code: 'INVALID_OLD_PRICE' }]);
  });

  it('keeps the exact provenance contract and sibling feed metadata', () => {
    expect(mapped().value.affiliateMetadata?._byb).toEqual({
      provenance: { version: 1, provider: 'aliexpress', mode: 'real', environment: 'production' },
      sourceType: 'admitad-feed', feed: { key: 'aliexpress-ww', mapperVersion: 1 },
    });
  });

  it('derives source identity only from logical namespace and exact ID', () => {
    const expected = `aliexpress-${createHash('sha256').update(`aliexpress-ww\0${row.id}`).digest('hex')}`;
    expect(mapped().value.sourceIdentity).toBe(expected);
    expect(mapped({ name: 'Changed title', category: 'Changed', url: 'https://tracking.example/changed' }).value.sourceIdentity).toBe(expected);
    expect(mapped({ id: '000123' }).value.sourceIdentity).not.toBe(mapped({ id: '123' }).value.sourceIdentity);
    const other = mapAliExpressRow(row, { programNamespace: 'aliexpress-test' });
    expect(other.ok && other.value.sourceIdentity).not.toBe(expected);
    expect(mapped().value.attributes).toEqual({ source: 'admitad-feed', sourceIdentity: expected });
    expect(mapAliExpressRow(row, { programNamespace: 'https://tracking.example/secret' }).ok).toBe(false);
  });

  it('does not fabricate stock, shipping eligibility, tax, brand, model or feature evidence', () => {
    const value = mapped().value;
    expect(value.availability).toBe('unknown');
    expect(value.shippingInfo).toEqual({ shipping: 'unknown', tax: 'unknown' });
    expect(value).not.toHaveProperty('brand');
    expect(value).not.toHaveProperty('model');
    expect(value.attributes).not.toHaveProperty('features');
    expect(value.shippingInfo).not.toHaveProperty('eligibleCountries');
  });

  it('maps streamed quoted params and continues after invalid merchant data', async () => {
    const input = `${ALIEXPRESS_HEADERS.join(';')}\n` +
      `1;Bad;https://tracking.example/1;Synthetic;USD;;https://images.example/1.jpg;;bad\n` +
      `2;Good;https://tracking.example/2;Synthetic;USD;"${row.param}";https://images.example/2.jpg;;12.30\n`;
    const outcomes = [];
    for await (const parsed of parseFeedCsv([input], { requiredHeaders: ALIEXPRESS_HEADERS })) {
      outcomes.push(mapAliExpressRow(parsed, context));
    }
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[1]).toMatchObject({ ok: true, value: { affiliateMetadata: { discountBps: 3100 } } });
  });
});

describe('exact feed money', () => {
  it.each([['12.30', 1230], ['0', 0], ['0.01', 1], ['12.3', 1230],
    [' 12.30 ', 1230], ['00012.30', 1230], ['21474836.47', 2147483647]])('parses USD %s exactly', (text, amount) => {
    expect(parseFeedMoney(text, 'USD')).toBe(amount);
  });
  it.each(['-0', '-12.30', '+1', '1e2', '.30', '12.', '12.345', '12,30', '1_000',
    '1 000.00', '', 'Infinity', 'NaN', '9'.repeat(100)])('rejects malformed money %s', text => {
    expect(() => parseFeedMoney(text, 'USD')).toThrow('INVALID_MONEY');
  });
  it('rejects integer overflow and unsupported currency/exponent configuration', () => {
    expect(() => parseFeedMoney('21474836.48', 'USD')).toThrow('MONEY_OVERFLOW');
    for (const currency of ['EUR', 'usd', 'XXX', 'constructor']) {
      expect(() => parseFeedMoney('1', currency)).toThrow('UNSUPPORTED_CURRENCY');
    }
    for (const exponent of [-1, 1.5, 100, NaN]) {
      expect(() => parseFeedMoney('1', 'USD', { USD: exponent })).toThrow('UNSUPPORTED_CURRENCY');
    }
  });
  it('supports explicitly configured zero and three digit exponents', () => {
    expect(parseFeedMoney('12', 'JPY', { JPY: 0 })).toBe(12);
    expect(parseFeedMoney('12.345', 'KWD', { KWD: 3 })).toBe(12345);
    expect(() => parseFeedMoney('12.0', 'JPY', { JPY: 0 })).toThrow('INVALID_MONEY');
  });
});

describe('bounded feed params', () => {
  it('normalizes observed params and preserves shop IDs as strings', () => {
    expect(parseFeedParams(row.param)).toEqual({ discountBps: 3100, commissionRateBps: 538, shopId: '912641216' });
    expect(parseFeedParams('shopId|000900719925474099312345|;')).toEqual({ shopId: '000900719925474099312345' });
  });
  it('ignores malformed values and unknown keys without throwing', () => {
    for (const param of ['', 'broken', 'discount|NaN|;', 'discount|101%|;', 'commissionRate|-1%|;',
      'commissionRate|5.381%|;', 'shopId|not-digits|;', 'unknown|private|;', 'discount|31%|extra|;']) {
      expect(parseFeedParams(param)).toEqual({});
      expect(mapped({ param }).value.priceAmount).toBe(1230);
    }
    expect(parseFeedParams('broken;discount|31%|;')).toEqual({ discountBps: 3100 });
  });
  it('uses first syntactically framed occurrence, even if its value is invalid', () => {
    expect(parseFeedParams('discount|31%|;discount|10%|;commissionRate|5.38%|;commissionRate|2%|;shopId|0001|;shopId|2|;'))
      .toEqual({ discountBps: 3100, commissionRateBps: 538, shopId: '0001' });
    expect(parseFeedParams('discount|bad|;discount|31%|;')).toEqual({});
  });
  it('enforces input/entry bounds and percent endpoints', () => {
    expect(parseFeedParams('x'.repeat(4097))).toEqual({});
    expect(parseFeedParams('discount|31%|;' + ';'.repeat(65))).toEqual({});
    expect(parseFeedParams('discount|100%|;commissionRate|0%|;')).toEqual({ discountBps: 10000, commissionRateBps: 0 });
  });
});
