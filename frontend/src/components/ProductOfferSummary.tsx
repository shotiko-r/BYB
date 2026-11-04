'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import { merchantName } from '@/lib/merchant';
import { compareAtPrice, formatMoney, priceSaving } from '@/lib/offer-prices';
import { formatCheckedAt } from '@/lib/ledger-preview';
import { availabilityKey, displayOffers, offerSourceKey, primaryOffer, productCondition } from '@/lib/product-presentation';
import { MerchantLink } from './MerchantLink';
import { OfferShipping } from './OfferShipping';
import type { ProductWithOffers } from '@/types';

export function ProductOfferSummary({ product, market = 'GE' }: { product: ProductWithOffers; market?: string }) {
  const { t, locale } = useI18n();
  const offers = displayOffers(product);
  const offer = primaryOffer(product);
  const condition = productCondition(product);
  const availability = availabilityKey(offer);
  const compareAt = offer ? compareAtPrice(offer) : undefined;
  const saving = offer && compareAt ? priceSaving(offer.priceAmount, compareAt.amount) : undefined;
  const checked = offer ? formatCheckedAt(offer.lastCheckedAt, locale) : undefined;
  const source = offer ? t(offerSourceKey(offer)) : undefined;
  const savingLabel = saving && offer ? (saving.percent > 0
    ? t('product.ledger.saving', { amount: formatMoney(saving.amount, offer.currencyCode, locale), percent: saving.percent })
    : t('product.ledger.savingAmount', { amount: formatMoney(saving.amount, offer.currencyCode, locale) })) : undefined;

  return <section className="purchase-panel" aria-label={t('product.offerDetails')}>
    {offer ? <>
      <div className="purchase-offer-head">
        <p className="purchase-merchant">{merchantName(offer.merchant) || t('product.merchantUnavailable')}</p>
        {availability && <p className="purchase-availability">{t(availability)}</p>}
      </div>
      <p className="purchase-price" aria-live="polite" aria-atomic="true">{formatMoney(offer.priceAmount, offer.currencyCode, locale)}</p>
      {compareAt && <p className="purchase-compare-at">
        <del aria-label={t('product.ledger.wasPrice', {
          price: formatMoney(compareAt.amount, compareAt.currencyCode, locale),
        })}>{formatMoney(compareAt.amount, compareAt.currencyCode, locale)}</del>
        {savingLabel && <span>{savingLabel}</span>}
      </p>}
      <dl className="purchase-facts">
        {condition && <div><dt>{t('product.p1.condition')}</dt><dd>{condition}</dd></div>}
        {source && <div><dt>{t('product.ledger.source')}</dt><dd>{source}</dd></div>}
        {checked && <div><dt>{t('product.ledger.checked')}</dt><dd><time dateTime={offer.lastCheckedAt}>{checked}</time></dd></div>}
      </dl>
      <OfferShipping offer={offer} />
      {product.variationGroup && offer.merchant?.code === 'ebay' && offer.availability === 'out_of_stock'
        ? <span role="link" aria-disabled="true" className="purchase-cta">{t('product.availability.out_of_stock')}</span>
        : <MerchantLink offer={offer} className="purchase-cta" />}
      {offers.length > 1 && <a className="purchase-compare" href="#product-offers">{t('common.compareOffers', { count: offers.length })} ↓</a>}
      <p className="purchase-disclosure">
        {t('product.ledger.disclosure')}{' '}
        <Link href={`/affiliate-disclosure?market=${market}`}>{t('product.p1.disclosureLink')}</Link>
      </p>
    </> : <div className="purchase-empty">
      <p>{t('product.noOffers')}</p>
      <p>{t('product.ledger.emptySummary')}</p>
    </div>}
  </section>;
}
