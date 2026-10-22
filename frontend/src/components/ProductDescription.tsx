'use client';

import { parseProductDescription } from '@/lib/product-description';
import { useI18n } from '@/i18n/I18nContext';

export function ProductDescription({ text }: { text: string }) {
  const { t } = useI18n();
  const blocks = parseProductDescription(text);
  return <div className="product-description" role="region" aria-label={t('product.p1.about')} tabIndex={0}>
    <div className="product-description-content">
      {blocks.map((block, index) => block.type === 'list'
        ? <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>
        : block.type === 'heading'
          ? <h3 key={`heading-${index}`}>{block.text}</h3>
          : <p key={`paragraph-${index}`}>{block.text}</p>)}
    </div>
  </div>;
}
