'use client';

import { useI18n } from '@/i18n/I18nContext';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers, productCondition } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { OfferShipping } from './OfferShipping';
import type { ProductWithOffers } from '@/types';

export function ProductOfferSummary({ product }: { product: ProductWithOffers }) {
  const { t } = useI18n();
  const offers = displayOffers(product);
  const offer = offers[0];
  const condition = productCondition(product);
  const availability = availabilityKey(offer);
  return <section className="purchase-panel" aria-label={t('product.offerDetails')}>
    {offer ? <>
      <p className="purchase-merchant">{merchantName(offer.merchant) || t('product.merchantUnavailable')}</p>
      <p className="purchase-price">{formatMoney(offer.priceAmount, offer.currencyCode)}</p>
      <dl className="purchase-facts">
        {condition && <div><dt>{t('product.p1.condition')}</dt><dd>{condition}</dd></div>}
        {availability && <div><dt>{t('product.compare.availability')}</dt><dd>{t(availability)}</dd></div>}
      </dl>
      <OfferShipping offer={offer} />
      <MerchantLink offer={offer} className="purchase-cta" />
      {offers.length > 1 && <a className="purchase-compare" href="#product-offers">{t('common.compareOffers', { count: offers.length })} ↓</a>}
    </> : <p>{t('product.noOffers')}</p>}
  </section>;
}
