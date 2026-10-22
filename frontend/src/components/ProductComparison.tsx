'use client';

import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { OfferShipping } from './OfferShipping';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers, Market } from '@/types';

export function ProductComparison({ product }: { product: ProductWithOffers; market?: Market }) {
  const { t } = useI18n();
  const offers = displayOffers(product);
  if (offers.length < 2) return null;
  return <section className="product-comparison" id="product-offers" aria-labelledby="product-offers-title">
    <h2 id="product-offers-title">{t('product.comparePrices')}</h2>
    <p className="product-comparison-note">{t('product.p1.compareNote')}</p>
    <div className="offer-comparison-grid">{offers.map(offer => {
      const availability = availabilityKey(offer);
      return <article className="comparison-offer" key={offer.id}>
        <h3>{merchantName(offer.merchant) || t('product.merchantUnavailable')}</h3>
        <p className="comparison-price">{formatMoney(offer.priceAmount, offer.currencyCode)}</p>
        {availability && <p>{t(availability)}</p>}
        <OfferShipping offer={offer} />
        <MerchantLink offer={offer} />
      </article>;
    })}</div>
  </section>;
}
