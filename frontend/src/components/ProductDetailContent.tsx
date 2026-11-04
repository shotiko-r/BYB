'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ProductVariations } from './ProductVariations';
import { productVariationGroup, initialSelections, variationProduct, matchingVariant } from '@/lib/product-variations';
import { ProductGallery } from './ProductGallery';
import { ProductOfferSummary } from './ProductOfferSummary';
import { ProductOfferLedger } from './ProductOfferLedger';
import { ProductTrust } from './ProductTrust';
import { ProductMobileAction } from './ProductMobileAction';
import { ProductFacts } from './ProductFacts';
import { useI18n } from '@/i18n/I18nContext';
import { knownText, productImages } from '@/lib/product-presentation';
import type { ProductWithOffers, Market } from '@/types';

export function ProductDetailContent({ product, market }: { product: ProductWithOffers; market: Market }) {
  const { t } = useI18n();
  const group = productVariationGroup(product);
  const [choice, setChoice] = useState<{ productId: string; selections: Record<string, string> } | null>(null);
  const selections = choice?.productId === product.id ? choice.selections : initialSelections(product, group);
  const displayed = group ? variationProduct(product, group, selections) : product;
  const brand = knownText(product.brand);
  return <main className="product-detail flex-1"><div className="byb-container">
    <nav className="product-breadcrumb" aria-label={t('product.p1.breadcrumb')}>
      <Link href="/">{t('product.breadcrumb.home')}</Link><span aria-hidden="true">/</span>
      <Link href={`/search?market=${market.code}`}>{t('product.breadcrumb.search')}</Link><span aria-hidden="true">/</span>
      <span className="product-breadcrumb-current" aria-current="page">{product.name}</span>
    </nav>
    <div className="product-purchase-layout">
      <div className="product-gallery-column">
        <ProductGallery key={group ? matchingVariant(group, selections)?.externalProductId ?? product.id : product.id}
          images={productImages(displayed)} alt={product.name} sizes="(max-width: 760px) 100vw, 58vw" />
      </div>
      <div className="product-purchase-content">
        <header className="product-identity">
          {brand && <p className="product-brand">{brand}</p>}
          <h1>{product.name}</h1>
        </header>
        {group && <ProductVariations group={group} selections={selections}
          onChange={selections => setChoice({ productId: product.id, selections })} />}
        <ProductOfferSummary product={displayed} market={market.code} />
      </div>
    </div>
    <ProductOfferLedger product={displayed} market={market} />
    <ProductTrust market={market.code} />
    <ProductFacts product={product} />
  </div>
  <ProductMobileAction product={displayed} />
  </main>;
}
