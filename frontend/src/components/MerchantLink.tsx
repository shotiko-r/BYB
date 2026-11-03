'use client';

import { clickoutEnabled } from '@/lib/product-presentation';
import { merchantName } from '@/lib/merchant';
import { useI18n } from '@/i18n/I18nContext';
import type { Offer } from '@/types';

export function MerchantLink({ offer, className = '' }: { offer: Offer; className?: string }) {
  const { t } = useI18n();
  const merchant = merchantName(offer.merchant);
  if (!clickoutEnabled(offer) || !offer.destinationUrl?.trim()) {
    return <span role="link" aria-disabled="true" className={`merchant-link is-disabled ${className}`}>
      {t('product.linkUnavailable')}
    </span>;
  }
  return <a href={offer.destinationUrl} target="_blank" rel="sponsored nofollow noopener noreferrer"
    onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    className={`merchant-link ${className}`}>
    {merchant ? t('product.buyOn', { merchant }) : t('product.visitMerchant')}
  </a>;
}
