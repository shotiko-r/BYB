'use client';

import { ProductDescription } from './ProductDescription';
import { knownText, productAspectFacts, productSpecifications } from '@/lib/product-presentation';
import { useI18n } from '@/i18n/I18nContext';
import type { ProductWithOffers } from '@/types';

export function ProductFacts({ product }: { product: ProductWithOffers }) {
  const { t, locale } = useI18n();
  const facts: [string, string][] = [];
  for (const key of ['brand', 'model'] as const) {
    const value = knownText(product[key]); if (value) facts.push([t(`product.p1.${key}`), value]);
  }
  const category = knownText(product.category?.name);
  if (category && !['uncategorized', 'aliexpress-feed'].includes(product.category?.slug ?? '')) facts.push([t('product.p1.category'), category]);
  const location = product.attributes.itemLocationCountry;
  if (typeof location === 'string' && /^[A-Z]{2}$/.test(location)) {
    let name = location;
    try { name = new Intl.DisplayNames([locale], { type: 'region' }).of(location) || location; } catch { /* Country code remains explicit. */ }
    facts.push([t('product.p1.location'), name]);
  }
  facts.push(...productSpecifications(product).map(([key, value]): [string, string] => [t(`product.p1.${key}`), value]));
  const seen = new Set(facts.map(([label, value]) => `${label.toLowerCase()}\u0000${value.toLowerCase()}`));
  for (const aspect of productAspectFacts(product)) {
    const label = aspect.key ? t(`product.p1.${aspect.key}`) : aspect.label;
    const key = `${label.toLowerCase()}\u0000${aspect.value.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push([label, aspect.value]);
  }
  const description = knownText(product.description);
  if (!facts.length && !description) return null;

  return <>
    {description && <section className="product-facts-panel product-about" aria-labelledby="product-about-title">
      <h2 id="product-about-title">{t('product.p1.about')}</h2>
      <ProductDescription text={description} />
    </section>}
    {facts.length > 0 && <section className="product-facts-panel product-specifications" aria-labelledby="product-specifications-title">
      <h2 id="product-specifications-title">{t('product.p1.specifications')}</h2>
      <dl className="product-facts-grid">{facts.map(([label, value], index) =>
        <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>}
  </>;
}
