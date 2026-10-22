import { decimalToMinor, minorToDecimal, SearchCurrencySchema } from '@byb/shared';

export type SearchPageParams = {
  q?: string; market?: string; page?: string; sort?: string; merchant?: string; category?: string;
  currency?: string; currencyCode?: string; maxPrice?: string; minPrice?: string;
};
export type SearchSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest';
export type SearchState = {
  q: string; market: string; page: number; sort: SearchSort; merchant: string[]; category: string;
  currency: string; minPrice: string; maxPrice: string;
};
export function searchSort(value?: string): SearchSort {
  return value === 'price_asc' || value === 'price_desc' || value === 'newest' ? value : 'relevance';
}
export function searchState(params: SearchPageParams): SearchState {
  return { q: params.q?.trim() || '', market: params.market?.toUpperCase() || 'GE',
    page: /^\d+$/.test(params.page ?? '') && Number(params.page) > 0 && Number.isSafeInteger(Number(params.page)) ? Number(params.page) : 1,
    sort: searchSort(params.sort), merchant: [...new Set((params.merchant || '').split(',').map(code => code.trim()).filter(Boolean))].sort(),
    category: params.category || '', currency: params.currency ?? params.currencyCode ?? '', minPrice: params.minPrice ?? '', maxPrice: params.maxPrice ?? '' };
}
export function searchValidation(state: SearchState): string | undefined {
  const needsCurrency = state.sort.startsWith('price_') || state.minPrice !== '' || state.maxPrice !== '';
  if (needsCurrency && !state.currency) return 'currencyRequired';
  if (state.currency && !SearchCurrencySchema.safeParse(state.currency).success) return 'invalidCurrency';
  for (const key of ['minPrice', 'maxPrice'] as const) {
    const value = state[key];
    if (value !== '' && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647 || (key === 'maxPrice' && Number(value) === 0))) return 'invalidPrice';
  }
  if (state.minPrice !== '' && state.maxPrice !== '' && Number(state.minPrice) > Number(state.maxPrice)) return 'invalidRange';
}
export function searchHref(state: SearchState, patch: Partial<SearchState> = {}): string {
  const next = { ...state, ...patch, page: patch.page ?? 1 };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  params.set('market', next.market);
  if (next.page > 1) params.set('page', String(next.page));
  params.set('sort', next.sort);
  if (next.merchant.length) params.set('merchant', [...next.merchant].sort().join(','));
  for (const key of ['category', 'currency', 'minPrice', 'maxPrice'] as const) if (next[key] !== '') params.set(key, next[key]);
  return `/search?${params}`;
}
export function clearedFilters(): Partial<SearchState> {
  return { merchant: [], category: '', currency: '', minPrice: '', maxPrice: '', sort: 'relevance' };
}
export function pricePatch(min: string, max: string, currency: string): Partial<SearchState> {
  const patch = { minPrice: min.trim() ? String(decimalToMinor(min, currency)) : '', maxPrice: max.trim() ? String(decimalToMinor(max, currency)) : '' };
  const error = searchValidation({ ...searchState({}), ...patch, currency });
  if (error) throw new Error(error);
  return patch;
}
export function priceInput(value: string, currency: string): string {
  try { return value === '' ? '' : minorToDecimal(Number(value), currency); } catch { return ''; }
}
export function requestForState(state: SearchState) {
  if (!state.q || searchValidation(state)) return undefined;
  return { q: state.q, market: state.market, page: state.page, sort: state.sort, limit: 20,
    merchant: state.merchant.length ? state.merchant.join(',') : undefined, category: state.category || undefined,
    currency: state.currency || undefined, minPrice: state.minPrice || undefined, maxPrice: state.maxPrice || undefined };
}
