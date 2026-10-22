'use client';

import { useState } from 'react';
import { ProductImage } from './ProductImage';
import { useI18n } from '@/i18n/I18nContext';

export function ProductGallery({ images, alt, sizes }: {
  images: string[]; alt: string; sizes: string;
}) {
  const { t } = useI18n();
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const active = selectedSrc && images.includes(selectedSrc) ? selectedSrc : images[0] ?? null;
  const activeIndex = active ? Math.max(0, images.indexOf(active)) : 0;
  return <div className="product-gallery">
    <div className="product-gallery-main">
      <ProductImage src={active} alt={alt} priority={activeIndex === 0} sizes={sizes} />
    </div>
    {images.length > 1 && <div className="product-gallery-thumbs" role="group" aria-label={t('product.p1.gallery')}>
      {images.map((src, index) => <button key={src} type="button" className="product-gallery-thumb"
        aria-pressed={src === active} aria-label={t('product.p1.showImage', { index: index + 1, total: images.length })}
        onClick={() => setSelectedSrc(src)}>
        <ProductImage src={src} alt="" sizes="80px" />
      </button>)}
    </div>}
  </div>;
}
