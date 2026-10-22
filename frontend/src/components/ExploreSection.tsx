'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nContext';
import { homepageCategories, categorySearchHref } from '@/lib/homepage-categories';
import { rememberInterest } from '@/lib/local-interests';

export function ExploreSection({ market = 'GE' }: { market?: string }) {
  const { t } = useI18n();
  return <section id="explore" className="home-categories byb-container" aria-labelledby="explore-heading">
    <div className="home-category-heading">
      <h2 id="explore-heading">{t('homepage.h1.categories')}</h2>
      <p>{t('homepage.h1.categoryHint')}</p>
    </div>
    <div className="home-category-grid">
      {homepageCategories.map(({ id, path }) => <Link className={`home-category home-category-${id}`} key={id}
        href={categorySearchHref(id, market)} onClick={() => rememberInterest({ kind: 'category', id, market })}>
        <span className="home-category-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg></span>
        <span>{t(`homepage.h1.category.${id}`)}</span>
        <span className="home-category-arrow" aria-hidden="true">↗</span>
      </Link>)}
    </div>
  </section>;
}
