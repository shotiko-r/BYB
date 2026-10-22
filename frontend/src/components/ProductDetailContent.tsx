'use client';

import Link from 'next/link';
import { ProductGallery } from './ProductGallery';
import { ProductOfferSummary } from './ProductOfferSummary';
import { ProductFacts } from './ProductFacts';
import { ProductComparison } from './ProductComparison';
import { useI18n } from '@/i18n/I18nContext';
import { productImages } from '@/lib/product-presentation';
import type { ProductWithOffers, Market } from '@/types';

export function ProductDetailContent({ product, market }: { product: ProductWithOffers; market: Market }) {
  const { t } = useI18n();
  return <main className="product-detail flex-1"><div className="byb-container">
    <nav className="product-breadcrumb" aria-label={t('product.p1.breadcrumb')}>
      <Link href="/">{t('product.breadcrumb.home')}</Link><span aria-hidden="true">/</span>
      <Link href={`/search?market=${market.code}`}>{t('product.breadcrumb.search')}</Link>
    </nav>
    <h1>{product.name}</h1>
    <div className="product-purchase-layout">
      <ProductGallery images={productImages(product)} alt={product.name} sizes="(max-width: 760px) 100vw, 50vw" />
      <ProductOfferSummary product={product} />
    </div>
    <ProductFacts product={product} />
    <ProductComparison product={product} market={market} />
  </div></main>;
}
