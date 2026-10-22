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
  merchant?: Pick<Merchant, 'id' | 'code' | 'name' | 'logoUrl'>;
};

export type ProductWithOffers = Product & {
  offers: Offer[];
  merchant?: Pick<Merchant, 'id' | 'code' | 'name' | 'logoUrl'>;
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

export type SearchQuery = import('@byb/shared').SearchQuery;
export type SearchIntent = import('@byb/shared').SearchIntent;

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};