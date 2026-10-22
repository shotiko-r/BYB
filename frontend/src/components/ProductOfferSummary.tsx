'use client';

import { useI18n } from '@/i18n/I18nContext';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers, productCondition } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import type { ProductWithOffers } from '@/types';

export function ProductOfferSummary({ product }: { product: ProductWithOffers }) {
  const { t } = useI18n();
  const offers = displayOffers(product);
  const offer = offers[0];
  const condition = productCondition(product);
  const availability = availabilityKey(offer);
  return <div className="sticky top-24 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
    <h2 className="text-lg font-semibold text-gray-900">{t(offers.length > 1 ? 'product.listedOffers' : 'product.offerDetails')}</h2>
    {offer ? <>
      <p className="font-medium">{merchantName(offer.merchant) || t('product.merchantUnavailable')}</p>
      {condition && <p className="text-sm text-gray-600">{condition}</p>}
      {availability && <p className="text-sm text-gray-600">{t(availability)}</p>}
      <p className="text-3xl font-bold text-gray-900">{formatMoney(offer.priceAmount, offer.currencyCode)}</p>
      <MerchantLink offer={offer} className="w-full" />
      {offers.length > 1 && <ul className="space-y-3">
        {offers.map(item => <li key={item.id} className="flex justify-between gap-3 text-sm">
          <span>{merchantName(item.merchant) || t('product.merchantUnavailable')}</span>
          <span>{formatMoney(item.priceAmount, item.currencyCode)}</span>
        </li>)}
      </ul>}
    </> : <p>{t('product.noOffers')}</p>}
  </div>;
}
