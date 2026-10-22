import { DiscoveryHomeSchema, SearchOptionsSchema, type ConciergeRequest, type ConciergeResponse } from '@byb/shared';
import { formatMoney } from './offer-prices';
import type { SearchResult, ProductWithOffers, Market, Merchant } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3001' : '');
if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is required in production');

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: 'UNKNOWN', message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

function toSearchParams(params: Record<string, string | number | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      sp.set(key, String(value));
    }
  }
  return sp;
}

export const availabilityLabels = {
  in_stock: { label: 'In Stock', class: 'text-green-600' },
  limited: { label: 'Limited Stock', class: 'text-yellow-600' },
  pre_order: { label: 'Pre-order', class: 'text-blue-600' },
  out_of_stock: { label: 'Out of Stock', class: 'text-red-600' },
  unknown: { label: 'Unknown', class: 'text-gray-600' },
} as const;

export const api = {
  discovery: {
    home: async (market: string, signal?: AbortSignal) => DiscoveryHomeSchema.parse(
      await fetchApi<unknown>(`/api/discovery/home?${toSearchParams({ market })}`, { signal })
    ),
  },
  concierge: {
    request: (body: ConciergeRequest, signal?: AbortSignal) => fetchApi<ConciergeResponse>('/api/concierge', {
      method: 'POST', body: JSON.stringify(body), signal,
    }),
  },
  markets: {
    list: () => fetchApi<Market[]>('/api/markets'),
    get: (code: string) => fetchApi<Market>(`/api/markets/${code}`),
  },

  merchants: {
    list: () => fetchApi<Merchant[]>('/api/merchants'),
    get: (code: string) => fetchApi<Merchant>(`/api/merchants/${code}`),
  },

  search: {
    options: async (market: string, signal?: AbortSignal) => SearchOptionsSchema.parse(await fetchApi<unknown>(`/api/search/options?${toSearchParams({ market })}`, { signal })),
    products: (params: Record<string, string | number | undefined>, signal?: AbortSignal) =>
      fetchApi<SearchResult>(`/api/search?${toSearchParams(params).toString()}`, { signal }),
    suggestions: (q: string, market?: string, signal?: AbortSignal) => {
      const params = new URLSearchParams({ q });
      if (market) params.set('market', market);
      return fetchApi<{ suggestions: string[] }>(`/api/search/suggestions?${params.toString()}`, { signal });
    },
  },

  products: {
    get: (id: string, market?: string) => {
      const params = market ? `?market=${market}` : '';
      return fetchApi<ProductWithOffers>(`/api/products/${id}${params}`);
    },
  },

  health: () => fetchApi<{ status: string; timestamp: string; version: string; database: string }>('/health'),
};

export function formatPrice(amount: number, currencyCode: string, currencySymbol: string): string {
  return formatMoney(amount, currencyCode).replace(currencyCode, currencySymbol);
}

export function getAvailabilityLabel(availability: string): { label: string; class: string } {
  switch (availability) {
    case 'in_stock':
      return { label: 'In Stock', class: 'text-green-600' };
    case 'limited':
      return { label: 'Limited Stock', class: 'text-yellow-600' };
    case 'pre_order':
      return { label: 'Pre-order', class: 'text-blue-600' };
    case 'out_of_stock':
      return { label: 'Out of Stock', class: 'text-red-600' };
    default:
      return { label: 'Unknown', class: 'text-gray-600' };
  }
}
