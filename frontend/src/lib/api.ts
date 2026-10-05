import type { SearchResult, ProductWithOffers, Market, Merchant } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  markets: {
    list: () => fetchApi<Market[]>('/api/markets'),
    get: (code: string) => fetchApi<Market>(`/api/markets/${code}`),
  },

  merchants: {
    list: () => fetchApi<Merchant[]>('/api/merchants'),
    get: (code: string) => fetchApi<Merchant>(`/api/merchants/${code}`),
  },

  search: {
    products: (params: Record<string, string | number | undefined>) => 
      fetchApi<SearchResult>(`/api/search?${toSearchParams(params).toString()}`),
    suggestions: (q: string, market?: string) => {
      const params = new URLSearchParams({ q });
      if (market) params.set('market', market);
      return fetchApi<{ suggestions: string[] }>(`/api/search/suggestions?${params.toString()}`);
    },
  },

  products: {
    get: (id: string, market?: string) => {
      const params = market ? `?market=${market}` : '';
      return fetchApi<ProductWithOffers>(`/api/products/${id}${params}`);
    },
  },

  health: () => fetchApi<{ status: string; timestamp: string; version: string; database: string }>('/api/health'),
};

export function formatPrice(amount: number, currencyCode: string, currencySymbol: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount / 100).replace(currencyCode, currencySymbol);
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