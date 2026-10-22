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
      className="group min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer"
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        <ProductImage src={product.imageUrl} alt={product.name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw" />
        {offerCount > 1 && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
            {t(action.key, action.params)}
          </div>
        )}
        {availability && offer?.availability !== 'in_stock' && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {availability && t(availability)}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 break-words min-w-0 group-hover:text-blue-600 transition-colors flex-1">
            <button type="button" className="text-left w-full line-clamp-2 break-words" onClick={(e) => { e.stopPropagation(); onClick(product); }}>
              {product.name}
            </button>
          </h3>
        </div>

        {offer && <span className="inline-block max-w-full break-words text-xs font-medium text-gray-700 bg-gray-100 rounded-full px-2.5 py-1 mb-2">
          {merchant || t('product.merchantUnavailable')}
        </span>}
        {brand && (
          <p className="text-sm text-gray-500 mb-2">{brand}</p>
        )}

        <div className="flex items-center justify-between">
          <div>
            {offer && (
              <span className="text-xl font-bold text-gray-900">
                {formatMoney(offer.priceAmount, offer.currencyCode)}
              </span>
            )}
          </div>
          {availability && <span className="text-xs font-medium text-gray-600">{t(availability)}</span>}
        </div>
        {condition && <p className="text-sm text-gray-600 mt-2">{condition}</p>}

        {offer && <MerchantLink offer={offer} className="mt-3 w-full" />}
        {offerCount <= 1 && <button type="button" onClick={event => { event.stopPropagation(); onClick(product); }}
          className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 font-medium">{t(action.key, action.params)}</button>}
        {offerCount > 1 && offer && (
          <button
            onClick={(e) => { e.stopPropagation(); onClick(product); }}
            className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l9 2m0 0l-2-4m2 4l2-4m-6 11V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            {t(action.key, action.params)}
          </button>
        )}
      </div>
    </article>
  );
}
