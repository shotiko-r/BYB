'use client';

import Link from 'next/link';
import { MerchantLink } from './MerchantLink';
import { merchantName } from '@/lib/merchant';
import { formatMoney, priceSaving } from '@/lib/offer-prices';
import { formatCheckedAt, ledgerRows, lowestKnownTotal } from '@/lib/ledger-preview';
import { availabilityKey, offerSourceKey, productCondition } from '@/lib/product-presentation';
import { deliveryDates, shippingFacts } from '@/lib/shipping-presentation';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

export function ProductOfferLedger({ product, market }: { product: ProductWithOffers; market: Market }) {
  const { t, locale } = useI18n();
  const rows = ledgerRows(product);
  if (rows.length < 2) return null;
  const lowest = lowestKnownTotal(rows);
  const condition = productCondition(product);

  return <section className="offer-ledger product-ledger" id="product-offers" aria-labelledby="product-offers-title">
    <div className="ledger-heading product-ledger-heading">
      <p className="ledger-eyebrow">{t('product.ledger.eyebrow')}</p>
      <h2 id="product-offers-title">{t('product.ledger.title')}</h2>
      <p className="ledger-subtitle">{t('product.ledger.subtitle', { count: rows.length })}</p>
    </div>
    <ul className="product-ledger-list">
      {rows.map(row => {
        const offer = row.offer;
        const availability = availabilityKey(offer);
        const source = t(offerSourceKey(offer));
        const checked = formatCheckedAt(row.checkedAt, locale);
        const facts = shippingFacts(offer);
        const delivery = facts ? deliveryDates(facts, locale) : undefined;
        const saving = row.compareAt ? priceSaving(offer.priceAmount, row.compareAt.amount) : undefined;
        const savingLabel = saving ? (saving.percent > 0
          ? t('product.ledger.saving', { amount: formatMoney(saving.amount, offer.currencyCode, locale), percent: saving.percent })
          : t('product.ledger.savingAmount', { amount: formatMoney(saving.amount, offer.currencyCode, locale) })) : undefined;
        const isLowest = Boolean(lowest && row.total && row.total.amount === lowest.amount
          && row.total.currencyCode === lowest.currencyCode);

        return <li className="product-ledger-offer" key={offer.id}>
          <div className="product-ledger-offer-head">
            <div className="product-ledger-identity">
              <h3>{merchantName(offer.merchant) || t('product.merchantUnavailable')}</h3>
              <p>{t('product.ledger.sourceValue', { source })}</p>
            </div>
            <div className="product-ledger-badges">
              {availability && <span className="product-ledger-badge">{t(availability)}</span>}
              {isLowest && <span className="product-ledger-badge is-lowest">{t('product.ledger.lowest')}</span>}
            </div>
          </div>
          <dl className="product-ledger-prices">
            <div>
              <dt>{t('product.ledger.item')}</dt>
              <dd>
                <span className="product-ledger-price">{formatMoney(offer.priceAmount, offer.currencyCode, locale)}</span>
                {row.compareAt && <>
                  <del className="product-ledger-compare" aria-label={t('product.ledger.wasPrice', {
                    price: formatMoney(row.compareAt.amount, row.compareAt.currencyCode, locale),
                  })}>{formatMoney(row.compareAt.amount, row.compareAt.currencyCode, locale)}</del>
                  {savingLabel && <span className="product-ledger-saving">{savingLabel}</span>}
                </>}
              </dd>
            </div>
            <div>
              <dt>{t('product.ledger.shipping')}</dt>
              <dd>
                {row.shipping
                  ? (row.shipping.amount === 0 ? t('product.shipping.free') : formatMoney(row.shipping.amount, row.shipping.currencyCode, locale))
                  : <span className="ledger-unavailable">{t('product.ledger.shippingMissing')}</span>}
                {delivery && <span className="product-ledger-subvalue">{t('product.ledger.deliveryValue', { date: delivery })}</span>}
              </dd>
            </div>
            <div>
              <dt>{t('product.ledger.total')}</dt>
              <dd>{row.total
                ? formatMoney(row.total.amount, row.total.currencyCode, locale)
                : <span className="ledger-unavailable">{t('product.ledger.totalUnavailable')}</span>}</dd>
            </div>
          </dl>
          <dl className="product-ledger-meta">
            {condition && <div><dt>{t('product.p1.condition')}</dt><dd>{condition}</dd></div>}
            <div><dt>{t('product.ledger.checked')}</dt><dd>{checked
              ? <time dateTime={row.checkedAt}>{checked}</time>
              : <span className="ledger-unavailable">{t('product.ledger.notProvided')}</span>}</dd></div>
          </dl>
          {product.variationGroup && offer.merchant?.code === 'ebay' && offer.availability === 'out_of_stock'
            ? <span role="link" aria-disabled="true" className="product-ledger-action">{t('product.availability.out_of_stock')}</span>
            : <MerchantLink offer={offer} className="product-ledger-action" label={t('product.ledger.viewOffer')} />}
        </li>;
      })}
    </ul>
    <div className="product-ledger-foot">
      <p className="ledger-note">{t('product.ledger.note')}</p>
      <p className="product-ledger-disclosure">
        {t('product.ledger.disclosure')}{' '}
        <Link href={`/affiliate-disclosure?market=${market.code}`}>{t('product.p1.disclosureLink')}</Link>
      </p>
    </div>
  </section>;
}
