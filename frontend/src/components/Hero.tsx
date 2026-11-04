'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SearchInput } from './SearchInput';
import { OfferLedgerPreview } from './OfferLedgerPreview';
import { popularSearches } from '@/lib/homepage-categories';
import { searchHref, searchState } from '@/lib/search-presentation';
import { useI18n } from '@/i18n/I18nContext';
import type { Market, ProductWithOffers } from '@/types';

export function Hero({ market, previewProduct, previewLoading = false }: {
  market: Market;
  previewProduct?: ProductWithOffers;
  previewLoading?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const submit = (query: string) => router.push(searchHref(searchState({ q: query, market: market.code })));

  return <section className="home-hero" aria-labelledby="home-title">
    <div className="byb-container home-hero-inner">
      <div className="home-hero-copy">
        <p className="eyebrow">{t('homepage.h1.eyebrow')}</p>
        <h1 id="home-title">{t('homepage.h1.title')}</h1>
        <p className="home-hero-description">{t('homepage.h1.description')}</p>
        <div className="home-hero-search">
          <SearchInput market={market} onSearch={submit} homepage showModes={false}
            placeholder={t('homepage.hero.placeholder')}
            examples={popularSearches.map(item => ({ label: t(`homepage.popular.${item.id}`), query: item.query }))}
            examplesLabel={t('homepage.hero.popularLabel')} />
        </div>
        <p className="home-hero-trust">{t('homepage.hero.trust')}</p>
        <p className="home-hero-trust">{t('homepage.hero.affiliate')} <Link href={`/affiliate-disclosure?market=${market.code}`}>{t('homepage.trust.affiliate')}</Link></p>
      </div>
      <OfferLedgerPreview product={previewProduct} market={market} loading={previewLoading} />
    </div>
  </section>;
}
