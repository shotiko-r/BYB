export type Market = {
  id: string;
  code: string;
  name: string;
  locale: string;
  language: string;
  currencyCode: string;
  currencySymbol: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Merchant = {
  id: string;
  code: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  categoryId: string | null;
  imageUrl: string | null;
  attributes: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Offer = {
  id: string;
  productId: string;
  merchantId: string;
  marketId: string;
  externalProductId: string;
  priceAmount: number;
  currencyCode: string;
  availability: 'in_stock' | 'out_of_stock' | 'limited' | 'pre_order' | 'unknown';
  shippingInfo: Record<string, unknown>;
  destinationUrl: string;
  affiliateMetadata: Record<string, unknown>;
  lastCheckedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  merchant?: Merchant;
};

export type ProductWithOffers = Product & {
  offers: Offer[];
  merchant?: Merchant;
  category?: Category;
};

export type SearchResult = {
  products: ProductWithOffers[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  query: SearchQuery;
  intent?: SearchIntent;
};

export type SearchQuery = {
  q: string;
  market?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  page: number;
  limit: number;
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
};

export type SearchIntent = {
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  query?: string;
  filters?: Record<string, unknown>;
};

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};