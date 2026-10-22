'use client';

import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey, displayOffers, productSpecifications, productCondition } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers, Market, Offer } from '@/types';

interface ProductComparisonProps {
  product: ProductWithOffers;
  market: Market;
}

function OfferRow({ offer, showAvailability }: { offer: Offer; showAvailability: boolean }) {
  const { t } = useI18n();
  const availability = availabilityKey(offer);
  const shipping = offer.shippingInfo as { freeShipping?: boolean; estimatedDays?: string };

  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-medium">{merchantName(offer.merchant) || t('product.merchantUnavailable')}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-bold text-lg">
        {formatMoney(offer.priceAmount, offer.currencyCode)}
      </td>
      {showAvailability && <td className="px-4 py-3 text-center text-sm text-gray-600">
        {availability ? t(availability) : '—'}
      </td>}
      <td className="px-4 py-3 text-center text-sm text-gray-600">
        {shipping?.freeShipping ? (
          <span className="text-green-600">{t('product.shipping.free')}</span>
        ) : (
          <span>{shipping?.estimatedDays || '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <MerchantLink offer={offer} />
      </td>
    </tr>
  );
}

export function ProductComparison({ product }: ProductComparisonProps) {
  const { t } = useI18n();
  const attributes = productSpecifications(product);
  const condition = productCondition(product);
  const sortedOffers = displayOffers(product);
  const multiple = sortedOffers.length > 1;
  const showAvailability = sortedOffers.some(offer => availabilityKey(offer));

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{t(multiple ? 'product.comparePrices' : 'product.offerDetails')}</h2>
        {multiple && <p className="text-sm text-gray-500 mt-1">{t('product.merchantOffers', { count: sortedOffers.length })}</p>}
        {condition && <p className="text-sm text-gray-600 mt-1">{condition}</p>}
      </div>

      {sortedOffers.length ? <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.merchant')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.price')}</th>
              {showAvailability && <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.availability')}</th>}
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.shipping')}</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedOffers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} showAvailability={showAvailability} />
            ))}
          </tbody>
        </table>
      </div> : <p className="px-6 py-4">{t('product.noOffers')}</p>}

      {product.description && (
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('product.descriptionTitle')}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
        </div>
      )}

      {attributes.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-3">{t('product.specificationsTitle')}</h3>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {attributes.map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-gray-500">{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</dt>
                <dd className="text-sm font-medium text-gray-900">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
