'use client';

import { ProductSection } from './ProductSection';
import { useI18n } from '@/i18n/I18nContext';

interface DiscoverySectionsProps {
  trendingProducts: any[];
  popularProducts: any[];
  dealsProducts: any[];
  newProducts: any[];
  rareProducts: any[];
  market: any;
  onProductClick: (product: any) => void;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="aspect-square bg-gray-200 rounded-xl animate-pulse"></div>
  );
}

function SkeletonSection() {
  return (
    <div className="py-8" aria-hidden="true">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

export function DiscoverySections({ 
  trendingProducts, 
  popularProducts, 
  dealsProducts, 
  newProducts, 
  rareProducts, 
  market, 
  onProductClick,
  loading = false
}: DiscoverySectionsProps) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="space-y-16">
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
        <SkeletonSection />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <ProductSection
        title={t('homepage.sections.trending')}
        products={trendingProducts}
        market={market}
        onProductClick={onProductClick}
        viewAllHref={`/search?q=headphones&market=${market?.code || 'GE'}`}
        emptyMessage={t('homepage.trending.empty')}
      />

      <ProductSection
        title={t('homepage.sections.popular')}
        products={popularProducts}
        market={market}
        onProductClick={onProductClick}
        viewAllHref={`/search?q=smartphone&market=${market?.code || 'GE'}`}
        emptyMessage={t('homepage.popular.empty')}
      />

      <ProductSection
        title={t('homepage.sections.deals')}
        products={dealsProducts}
        market={market}
        onProductClick={onProductClick}
        viewAllHref={`/deals?market=${market?.code || 'GE'}`}
        emptyMessage={t('homepage.deals.empty')}
      />

      <ProductSection
        title={t('homepage.sections.newReleases')}
        products={newProducts}
        market={market}
        onProductClick={onProductClick}
        viewAllHref={`/new?market=${market?.code || 'GE'}`}
        emptyMessage={t('homepage.newReleases.empty')}
      />

      <ProductSection
        title={t('homepage.sections.rare')}
        products={rareProducts}
        market={market}
        onProductClick={onProductClick}
        viewAllHref={`/rare?market=${market?.code || 'GE'}`}
        emptyMessage={t('homepage.rare.empty')}
      />
    </div>
  );
}

interface DiscoverySectionsProps {
  trendingProducts: any[];
  popularProducts: any[];
  dealsProducts: any[];
  newProducts: any[];
  rareProducts: any[];
  market: any;
  onProductClick: (product: any) => void;
  loading?: boolean;
}