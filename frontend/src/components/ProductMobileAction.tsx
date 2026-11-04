'use client';

import { useEffect, useState } from 'react';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { primaryOffer } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers } from '@/types';

export function ProductMobileAction({ product }: { product: ProductWithOffers }) {
  const { t, locale } = useI18n();
  const [visible, setVisible] = useState(false);
  const offer = primaryOffer(product);

  useEffect(() => {
    const target = document.querySelector('.purchase-panel');
    if (!target) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      setVisible(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0));
    }, { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!offer) return null;
  return <div className={`product-mobile-action${visible ? ' is-visible' : ''}`} aria-hidden={!visible}>
    <div className="product-mobile-summary">
      <span>{merchantName(offer.merchant) || t('product.merchantUnavailable')}</span>
      <strong>{formatMoney(offer.priceAmount, offer.currencyCode, locale)}</strong>
    </div>
    {product.variationGroup && offer.merchant?.code === 'ebay' && offer.availability === 'out_of_stock'
      ? <span role="link" aria-disabled="true" className="product-mobile-link">{t('product.availability.out_of_stock')}</span>
      : <MerchantLink offer={offer} className="product-mobile-link" />}
  </div>;
}
