'use client';

import Image from 'next/image';
import { formatPrice } from '@/lib/api';
import { sortOffers } from '@/lib/offer-prices';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers, Market, Offer } from '@/types';

interface ProductComparisonProps {
  product: ProductWithOffers;
  market: Market;
}

function OfferRow({ offer, market, isBest }: { offer: Offer; market: Market; isBest: boolean }) {
  const { t } = useI18n();
  const availability = offer.availability;
  const availabilityLabels = {
    in_stock: { label: t('product.availability.in_stock'), class: 'text-green-600' },
    limited: { label: t('product.availability.limited'), class: 'text-yellow-600' },
    pre_order: { label: t('product.availability.pre_order'), class: 'text-blue-600' },
    out_of_stock: { label: t('product.availability.out_of_stock'), class: 'text-red-600' },
    unknown: { label: t('product.availability.unknown'), class: 'text-gray-600' },
  };
  const availabilityLabel = availabilityLabels[availability as keyof typeof availabilityLabels] || availabilityLabels.unknown;
  const shipping = offer.shippingInfo as { freeShipping?: boolean; estimatedDays?: string };

  return (
    <tr className={isBest ? 'bg-blue-50' : ''}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {offer.merchant?.logoUrl && (
            <Image
              src={offer.merchant.logoUrl}
              alt={offer.merchant?.name || ''}
              width={32}
              height={32}
              className="object-contain rounded bg-gray-50 p-1"
              unoptimized={offer.merchant.logoUrl?.startsWith('http')}
            />
          )}
          <span className="font-medium">{offer.merchant?.name || 'Unknown'}</span>
          {isBest && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('product.bestPrice')}</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-bold text-lg">
        {formatPrice(offer.priceAmount, offer.currencyCode, offer.currencyCode === market.currencyCode ? market.currencySymbol : offer.currencyCode)}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${availabilityLabel.class}`}>
          {availabilityLabel.label}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-600">
        {shipping?.freeShipping ? (
          <span className="text-green-600">{t('product.shipping.free')}</span>
        ) : (
          <span>{shipping?.estimatedDays || '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <a
          href={offer.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {t('product.buyOn', { merchant: offer.merchant?.name || '' })}
        </a>
      </td>
    </tr>
  );
}

export function ProductComparison({ product, market }: ProductComparisonProps) {
  const { t } = useI18n();
  const sortedOffers = sortOffers(product.offers);
  const bestPrice = sortedOffers[0]?.priceAmount;
  const comparable = new Set(sortedOffers.map(offer => offer.currencyCode)).size === 1;

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">{t('product.comparePrices')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('product.merchantOffers', { count: product.offers.length })}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" role="table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.merchant')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.price')}</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.availability')}</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.shipping')}</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 uppercase tracking-wider">{t('product.compare.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedOffers.map((offer) => (
              <OfferRow key={offer.id} offer={offer} market={market} isBest={comparable && offer.priceAmount === bestPrice} />
            ))}
          </tbody>
        </table>
      </div>

      {product.description && (
        <div className="px-6 py-4 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('product.descriptionTitle')}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
        </div>
      )}

      {Object.keys(product.attributes || {}).length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-3">{t('product.specificationsTitle')}</h3>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Object.entries(product.attributes).map(([key, value]) => (
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
