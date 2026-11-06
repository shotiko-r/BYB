'use client';

import Link from 'next/link';
import { ProductImage } from './ProductImage';
import { useI18n } from '@/i18n/I18nContext';
import { featuredCategories, categoryPreviewImage, categorySearchHref } from '@/lib/homepage-categories';
import type { ProductWithOffers } from '@/types';

export function ExploreSection({ market = 'GE', products = [] }: {
  market?: string;
  products?: ProductWithOffers[];
}) {
  const { t } = useI18n();
  return <section id="explore" className="home-categories home-category-editorial byb-container" aria-labelledby="explore-heading">
    <div className="category-editorial-head">
      <div>
        <p className="eyebrow">{t('homepage.categories.eyebrow')}</p>
        <h2 id="explore-heading">{t('homepage.h1.categories')}</h2>
        <p>{t('homepage.h1.categoryHint')}</p>
      </div>
      <Link className="category-all-link" href={`/search?market=${market}`}>{t('homepage.categories.all')} <span aria-hidden="true">→</span></Link>
    </div>
    <div className="home-category-grid">
      {featuredCategories.map(({ id, path }, index) => {
        const image = categoryPreviewImage(id, products);
        return <Link className={`home-category category-tile${index === 0 ? ' is-feature' : ''}`} key={id}
          href={categorySearchHref(id, market)}>
          {image ? <span className="category-tile-media" aria-hidden="true">
            <ProductImage src={image} alt="" sizes={index === 0 ? '(max-width: 760px) 60vw, 320px' : '180px'} />
          </span> : <span className="category-tile-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d={path} /></svg>
          </span>}
          <span className="category-tile-index" aria-hidden="true">0{index + 1}</span>
          <span className="category-tile-copy">
            <span className="category-tile-name">{t(`homepage.h1.category.${id}`)}</span>
            <span className="category-tile-action" aria-hidden="true">↗</span>
          </span>
        </Link>;
      })}
    </div>
  </section>;
}
