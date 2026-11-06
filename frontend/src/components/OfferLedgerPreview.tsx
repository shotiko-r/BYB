'use client';

import Link from 'next/link';
import { ProductImage } from './ProductImage';
import { merchantName } from '@/lib/merchant';
import { formatMoney } from '@/lib/offer-prices';
import { availabilityKey } from '@/lib/product-presentation';
import { formatCheckedAt, latestCheckedAt, ledgerRows, lowestKnownTotal } from '@/lib/ledger-preview';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

export function OfferLedgerPreview({ product, market, loading = false }: {
  product?: ProductWithOffers;
  market: Market;
  loading?: boolean;
}) {
  const { t, locale } = useI18n();
  const rows = product ? ledgerRows(product) : [];
  const visibleRows = rows.slice(0, 3);
  const lowest = lowestKnownTotal(rows);
  const latest = latestCheckedAt(rows);
  const checked = formatCheckedAt(latest, locale);

  return <aside className="offer-ledger" aria-labelledby="ledger-title">
    <div className="ledger-heading">
      <p className="ledger-eyebrow">{t('homepage.ledger.eyebrow')}</p>
      <h2 id="ledger-title">{t('homepage.ledger.title')}</h2>
      <p className="ledger-subtitle">{t('homepage.ledger.subtitle')}</p>
    </div>
    {visibleRows.length ? <>
      <div className="ledger-product">
        <div className="ledger-product-media">
          <ProductImage src={product!.imageUrl} alt={product!.name} sizes="(max-width: 900px) 40vw, 180px" />
        </div>
        <div className="ledger-product-copy">
          <Link className="ledger-product-name" href={`/product/${product!.id}?market=${market.code}`}>{product!.name}</Link>
          <p className="ledger-product-meta">
            {t(rows.length === 1 ? 'homepage.ledger.offerCountOne' : 'homepage.ledger.offerCount', { count: rows.length })}
          </p>
        </div>
      </div>
      <div className="ledger-table-wrap">
        <table className="ledger-table">
          <caption className="sr-only">{t('homepage.ledger.caption', { product: product!.name })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('homepage.ledger.merchant')}</th>
              <th scope="col">{t('homepage.ledger.item')}</th>
              <th scope="col">{t('homepage.ledger.shipping')}</th>
              <th scope="col">{t('homepage.ledger.total')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(row => {
              const availability = availabilityKey(row.offer);
              return <tr key={row.offer.id}>
                <th scope="row">
                  <span>{merchantName(row.offer.merchant) || t('product.merchantUnavailable')}</span>
                  {availability && <small>{t(availability)}</small>}
                </th>
                <td>{formatMoney(row.offer.priceAmount, row.offer.currencyCode, locale)}</td>
                <td>{row.shipping
                  ? (row.shipping.amount === 0 ? t('product.shipping.free') : formatMoney(row.shipping.amount, row.shipping.currencyCode, locale))
                  : <span className="ledger-unavailable">{t('homepage.ledger.shippingMissing')}</span>}</td>
                <td>{row.total
                  ? <>{formatMoney(row.total.amount, row.total.currencyCode, locale)}{lowest && row.total.amount === lowest.amount && row.total.currencyCode === lowest.currencyCode && <small className="ledger-lowest">{t('homepage.ledger.lowest')}</small>}</>
                  : <span className="ledger-unavailable"><span aria-hidden="true">—</span><span className="sr-only">{t('homepage.ledger.totalUnavailable')}</span></span>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {rows.length > visibleRows.length && <p className="ledger-more-offers">
        {t('homepage.ledger.moreOffers', { count: rows.length - visibleRows.length })}
      </p>}
      <p className="ledger-freshness">
        <span className="ledger-dot" aria-hidden="true" />
        {checked
          ? <>{t('homepage.ledger.checked')} <time dateTime={latest}>{checked}</time></>
          : t('homepage.ledger.checkUnavailable')}
      </p>
      <p className="ledger-note">{t('homepage.ledger.note')}</p>
      <Link className="ledger-detail-link" href={`/product/${product!.id}?market=${market.code}`}>
        {t('homepage.ledger.details')} <span aria-hidden="true">→</span>
      </Link>
    </> : <div className="ledger-empty" role={loading ? 'status' : undefined} aria-busy={loading}>
      {loading ? <>
        <span className="sr-only">{t('common.loading')}</span>
        <div className="ledger-skeleton" aria-hidden="true"><span /><span /><span /></div>
      </> : <>
        <h3>{t('homepage.ledger.emptyTitle')}</h3>
        <p>{t('homepage.ledger.emptyDescription')}</p>
        <Link className="ledger-detail-link" href={`/search?market=${market.code}`}>{t('homepage.hero.cta')} <span aria-hidden="true">→</span></Link>
      </>}
    </div>}
  </aside>;
}
