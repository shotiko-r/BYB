'use client';

import { ProductImage } from './ProductImage';
import { merchantName } from '@/lib/merchant';
import Link from 'next/link';
import { formatMoney } from '@/lib/offer-prices';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

interface DiscoverySectionsProps {
  trendingProducts: ProductWithOffers[];
  popularProducts: ProductWithOffers[];
  dealsProducts: ProductWithOffers[];
  newProducts: ProductWithOffers[];
  rareProducts: ProductWithOffers[];
  market: Market;
  onProductClick: (product: ProductWithOffers) => void;
  loading?: boolean;
}

// Homepage-only presentation keeps shared search result cards unchanged.
function DecisionCard({ product, onProductClick }: {
  product: ProductWithOffers;
  market: Market;
  onProductClick: (product: ProductWithOffers) => void;
}) {
  const { t } = useI18n();
  const offer = product.offers[0];

  return (
    <button type="button" className="decision-card" onClick={() => onProductClick(product)}>
      <span className="decision-image">
        <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 600px) 120px, 240px" />
      </span>
      <span className="decision-info">
        <span className="decision-brand">{product.brand}</span>
        <span className="decision-name">{product.name}</span>
        {offer && (
          <span className="decision-price">
            {formatMoney(offer.priceAmount, offer.currencyCode)}
          </span>
        )}
        <span className="decision-merchant">
          {merchantName(offer?.merchant) || t('product.merchantUnavailable')}
          {offer && <> · {t(`product.availability.${offer.availability}`)}</>}
        </span>
        <span className="decision-offers">
          {t('common.compareOffers', { count: product.offers.length })}
          <span aria-hidden="true">↗</span>
        </span>
      </span>
    </button>
  );
}

export function DiscoverySections(props: DiscoverySectionsProps) {
  const { t } = useI18n();
  const sections = [
    ['trending', props.trendingProducts, 'headphones', '/search'],
    ['deals', props.dealsProducts, '', '/deals'],
    ['popular', props.popularProducts, 'smartphone', '/search'],
    ['newReleases', props.newProducts, '', '/new'],
    ['rare', props.rareProducts, '', '/rare'],
  ] as const;

  return (
    <div className="discovery">
      {sections.map(([key, products, query, path], index) => (
        <section
          key={key}
          className={`discovery-section discovery-${key}`}
          aria-labelledby={`discovery-${key}`}
        >
          <div className="byb-container">
            <div className="section-heading">
              <h2 id={`discovery-${key}`}>
                <span className="section-number" aria-hidden="true">0{index + 1}</span>
                {t(`homepage.sections.${key}`)}
              </h2>
              <Link href={`${path}?${query ? `q=${query}&` : ''}market=${props.market.code}`}>
                {t('common.viewAll')}
              </Link>
            </div>
            {props.loading ? (
              <div className="discovery-loading" role="status">{t('common.loading')}</div>
            ) : products.length ? (
              <div className="decision-grid">
                {products.slice(0, 4).map(product => (
                  <DecisionCard
                    key={product.id}
                    product={product}
                    market={props.market}
                    onProductClick={props.onProductClick}
                  />
                ))}
              </div>
            ) : <p className="discovery-empty">{t(`homepage.${key}.empty`)}</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
