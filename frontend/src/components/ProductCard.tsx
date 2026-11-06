'use client';

import { ProductImage } from './ProductImage';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers, knownText, offerAction, productCondition } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers, Market } from '@/types';

interface ProductCardProps {
  product: ProductWithOffers;
  market: Market;
  onClick: (product: ProductWithOffers) => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const { t } = useI18n();
  const offers = displayOffers(product);
  const offer = offers[0];
  const offerCount = offers.length;
  const action = offerAction(offerCount);
  const availability = availabilityKey(offer);
  const merchant = merchantName(offer?.merchant);
  const brand = knownText(product.brand);
  const condition = productCondition(product);

  return (
    <article
      onClick={() => onClick(product)}
      className="product-card group"
    >
      <div className="product-card-image">
        <ProductImage src={product.imageUrl} alt={product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw" />
        {offerCount > 1 && (
          <div className="product-count-badge">
            {t(action.key, action.params)}
          </div>
        )}
      </div>

      <div className="product-card-body">
        {(brand || availability) && <div className="product-card-kicker">
          {brand && <p className="product-card-brand">{brand}</p>}
          {availability && <span className="product-card-availability">{t(availability)}</span>}
        </div>}

        <h3 className="line-clamp-2 break-words min-w-0">
          <button type="button" className="text-left w-full line-clamp-2 break-words" onClick={(e) => { e.stopPropagation(); onClick(product); }}>
            {product.name}
          </button>
        </h3>

        {(offer || condition) && <div className="product-card-offer">
          {offer && <span className="merchant-badge">
            {merchant || t('product.merchantUnavailable')}
          </span>}
          {condition && <span className="product-card-condition">{condition}</span>}
        </div>}

        <div className="product-card-price-row">
          {offer && <span className="product-card-price">
            {formatMoney(offer.priceAmount, offer.currencyCode)}
          </span>}
        </div>

        <div className="product-card-actions">
          {offer && <MerchantLink offer={offer} className="product-card-cta" />}
          <button type="button" onClick={event => { event.stopPropagation(); onClick(product); }}
            className="product-card-action">
            {t(action.key, action.params)}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}
