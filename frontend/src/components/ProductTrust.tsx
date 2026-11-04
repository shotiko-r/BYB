'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';

const items = ['price', 'shipping', 'commission', 'ranking', 'freshness'] as const;

export function ProductTrust({ market }: { market: string }) {
  const { t } = useI18n();
  return <section className="product-trust" aria-labelledby="product-trust-title">
    <div className="product-trust-intro">
      <p className="eyebrow">{t('product.trust.eyebrow')}</p>
      <h2 id="product-trust-title">{t('product.trust.title')}</h2>
      <p>{t('product.trust.description')}</p>
      <div className="product-trust-links">
        <Link href={`/how-it-works?market=${market}`}>{t('homepage.trust.how')}</Link>
        <Link href={`/affiliate-disclosure?market=${market}`}>{t('homepage.trust.affiliate')}</Link>
      </div>
    </div>
    <div className="product-trust-body">
      <ul>{items.map(item => <li key={item}>
        <span aria-hidden="true" />
        {t(`product.trust.items.${item}`)}
      </li>)}</ul>
      <p className="product-trust-note">{t('product.trust.note')}</p>
    </div>
  </section>;
}
