'use client';

import { useId, useState } from 'react';
import { parseProductDescription, previewProductDescription } from '@/lib/product-description';
import { useI18n } from '@/i18n/I18nContext';

export function ProductDescription({ text, initiallyExpanded = false }: {
  text: string; initiallyExpanded?: boolean;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const contentId = useId();
  const blocks = parseProductDescription(text);
  const preview = previewProductDescription(blocks);
  const visible = expanded ? blocks : preview.blocks;

  return <div className="product-description">
    <div id={contentId} className="product-description-content">
      {visible.map((block, index) => block.type === 'list'
        ? <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>
        : block.type === 'heading'
          ? <h3 key={`heading-${index}`}>{block.text}</h3>
          : <p key={`paragraph-${index}`}>{block.text}</p>)}
    </div>
    {preview.hasMore && <button type="button" className="product-description-toggle" aria-expanded={expanded}
      aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
      {t(expanded ? 'product.p1.showLess' : 'product.p1.showMore')}
    </button>}
  </div>;
}
