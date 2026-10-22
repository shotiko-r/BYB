'use client';

import { ProductImage } from './ProductImage';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers, knownText, offerAction, productCondition, clickoutEnabled } from '@/lib/product-presentation';
import { homepageSections } from '@/lib/homepage-sections';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

interface DiscoverySectionsProps {
  productsBySection: Record<string, ProductWithOffers[]>;
  market: Market;
  onProductClick: (product: ProductWithOffers) => void;
  loading?: boolean;
  failed?: boolean;
  unavailableSections?: string[];
  onRetry?: () => void;
}

// Keep the homepage layout while sharing card semantics with search and details.
function DecisionCard({ product, onProductClick }: {
  product: ProductWithOffers;
  market: Market;
  onProductClick: (product: ProductWithOffers) => void;
}) {
  const { t } = useI18n();
  const offers = displayOffers(product);
  const offer = offers[0];
  const brand = knownText(product.brand);
  const condition = productCondition(product);
  const availability = availabilityKey(offer);
  const action = offerAction(offers.length);

  return (
    <button type="button" className="decision-card" onClick={() => onProductClick(product)}>
      <span className="decision-image">
        <ProductImage src={product.imageUrl} alt={product.name} sizes="(max-width: 600px) 120px, 240px" />
      </span>
      <span className="decision-info">
        {brand && <span className="decision-brand">{brand}</span>}
        <span className="decision-name">{product.name}</span>
        {offer && (
          <span className="decision-price">
            {formatMoney(offer.priceAmount, offer.currencyCode)}
          </span>
        )}
        <span className="decision-merchant merchant-badge">
          {merchantName(offer?.merchant) || t('product.merchantUnavailable')}
          {availability && <> · {t(availability)}</>}
        </span>
        {condition && <span className="decision-merchant">{condition}</span>}
        {offer && !clickoutEnabled(offer) && <span className="decision-merchant">{t('product.linkUnavailable')}</span>}
        <span className="decision-offers">
          {t(action.key, action.params)}
          <span aria-hidden="true">↗</span>
        </span>
      </span>
    </button>
  );
}

export function DiscoverySections(props: DiscoverySectionsProps) {
  const { t } = useI18n();

  return (
    <div className="discovery">
      {homepageSections.map((section, index) => {
        const { key } = section;
        const products = props.productsBySection[key] ?? [];
        return (
          <section
            key={key}
            className={`discovery-section discovery-${section.style}`}
            aria-labelledby={`discovery-${key}`}
          >
            <div className="byb-container">
              <div className="section-heading">
                <div>
                  <h2 id={`discovery-${key}`}>
                    <span className="section-number" aria-hidden="true">0{index + 1}</span>
                    {t(section.titleKey)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">{t(`homepage.discovery.${section.descriptionKey}`)}</p>
                </div>
              </div>
              {props.loading ? (
                <div role="status" aria-label={t('common.loading')}>
                  <span className="sr-only">{t('common.loading')}</span>
                  <div className="decision-grid" aria-hidden="true">{[0, 1, 2, 3].map(slot =>
                    <div key={slot} className="h-64 animate-pulse rounded-xl bg-gray-100 border border-gray-200" />
                  )}</div>
                </div>
              ) : props.failed || props.unavailableSections?.includes(key) ? (
                <div className="homepage-error" role="alert">
                  <p>{t('homepage.discovery.unavailable')}</p>
                  {props.onRetry && <button type="button" className="btn-secondary mt-3" onClick={props.onRetry}>{t('common.retry')}</button>}
                </div>
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
              ) : <p className="discovery-empty">{t('homepage.discovery.empty')}</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
