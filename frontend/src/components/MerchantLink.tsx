'use client';

import { clickoutEnabled } from '@/lib/product-presentation';
import { merchantName } from '@/lib/merchant';
import { useI18n } from '@/i18n/I18nContext';
import type { Offer } from '@/types';

export function MerchantLink({ offer, className = '' }: { offer: Offer; className?: string }) {
  const { t } = useI18n();
  const merchant = merchantName(offer.merchant);
  if (!clickoutEnabled(offer) || !offer.destinationUrl) {
    return <span role="link" aria-disabled="true" className={`inline-flex justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-600 ${className}`}>
      {t('product.linkUnavailable')}
    </span>;
  }
  return <a href={offer.destinationUrl} target="_blank" rel="sponsored nofollow noopener noreferrer"
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    className={`inline-flex justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${className}`}>
    {merchant ? t('product.buyOn', { merchant }) : t('product.visitMerchant')}
  </a>;
}
