'use client';

import { ProductCard } from './ProductCard';
import type { ProductWithOffers, Market } from '@/types';

interface ProductSectionProps {
  title: string;
  products: ProductWithOffers[];
  market: Market;
  onProductClick: (product: ProductWithOffers) => void;
  viewAllHref?: string;
  emptyMessage?: string;
}

export function ProductSection({ title, products, market, onProductClick, viewAllHref, emptyMessage }: ProductSectionProps) {
  if (products.length === 0) {
    return (
      <section className="py-8" aria-labelledby={title.toLowerCase().replace(/\s+/g, '-')}>
        <div className="px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 id={title.toLowerCase().replace(/\s+/g, '-')} className="text-2xl font-bold text-gray-900">{title}</h2>
            {viewAllHref && (
              <a href={viewAllHref} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View all →
              </a>
            )}
          </div>
          <div className="text-center py-12 text-gray-500">
            {emptyMessage || `No ${title.toLowerCase()} products found.`}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8" aria-labelledby={title.toLowerCase().replace(/\s+/g, '-')}>
      <div className="px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 id={title.toLowerCase().replace(/\s+/g, '-')} className="text-2xl font-bold text-gray-900">{title}</h2>
          {viewAllHref && (
            <a href={viewAllHref} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View all →
            </a>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.slice(0, 10).map((product) => (
            <ProductCard key={product.id} product={product} market={market} onClick={onProductClick} />
          ))}
        </div>
      </div>
    </section>
  );
}