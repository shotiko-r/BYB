'use client';

import { useId, useState } from 'react';
import { parseProductDescription, previewProductDescription, type ProductDescriptionBlock } from '@/lib/product-description';
import { useI18n } from '@/i18n/I18nContext';

function DescriptionBlocks({ blocks }: { blocks: ProductDescriptionBlock[] }) {
  return <>{blocks.map((block, index) => block.type === 'list'
    ? <ul key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`${itemIndex}-${item}`}>{item}</li>)}</ul>
    : block.type === 'heading'
      ? <h3 key={`heading-${index}`}>{block.text}</h3>
      : <p key={`paragraph-${index}`}>{block.text}</p>)}</>;
}

export function ProductDescription({ text }: { text: string }) {
  const { t } = useI18n();
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const blocks = parseProductDescription(text);
  const preview = previewProductDescription(blocks);
  const visible = expanded ? blocks : preview.blocks;

  return <div className="product-description" role="region" aria-label={t('product.p1.about')}>
    <div className="product-description-content" id={id}><DescriptionBlocks blocks={visible} /></div>
    {preview.hasMore && <button type="button" className="product-description-toggle"
      aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>
      {t(expanded ? 'product.p1.showLess' : 'product.p1.showMore')}
    </button>}
  </div>;
}
