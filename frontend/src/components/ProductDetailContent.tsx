'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProductVariations } from './ProductVariations';
import { productVariationGroup, initialSelections, variationProduct, matchingVariant } from '@/lib/product-variations';
import { ProductGallery } from './ProductGallery';
import { ProductOfferSummary } from './ProductOfferSummary';
import { ProductFacts } from './ProductFacts';
import { ProductComparison } from './ProductComparison';
import { useI18n } from '@/i18n/I18nContext';
import { productImages } from '@/lib/product-presentation';
import type { ProductWithOffers, Market } from '@/types';

export function ProductDetailContent({ product, market }: { product: ProductWithOffers; market: Market }) {
  const { t } = useI18n();
  const group = productVariationGroup(product);
  const [choice, setChoice] = useState<{ productId: string; selections: Record<string, string> } | null>(null);
  const selections = choice?.productId === product.id ? choice.selections : initialSelections(product, group);
  const displayed = group ? variationProduct(product, group, selections) : product;
  return <main className="product-detail flex-1"><div className="byb-container">
    <nav className="product-breadcrumb" aria-label={t('product.p1.breadcrumb')}>
      <Link href="/">{t('product.breadcrumb.home')}</Link><span aria-hidden="true">/</span>
      <Link href={`/search?market=${market.code}`}>{t('product.breadcrumb.search')}</Link>
    </nav>
    <h1>{product.name}</h1>
    <div className="product-purchase-layout">
      <ProductGallery key={group ? matchingVariant(group, selections)?.externalProductId ?? product.id : product.id} images={productImages(displayed)} alt={product.name} sizes="(max-width: 760px) 100vw, 50vw" />
      <div className="product-purchase-content">
        {group && <ProductVariations group={group} selections={selections}
          onChange={selections => setChoice({ productId: product.id, selections })} />}
        <ProductOfferSummary product={displayed} />
      </div>
    </div>
    <ProductFacts product={product} />
    <ProductComparison product={product} market={market} />
  </div></main>;
}
