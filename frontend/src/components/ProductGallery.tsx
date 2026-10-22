'use client';

import { useState, type KeyboardEvent } from 'react';
import { ProductImage } from './ProductImage';
import { useI18n } from '@/i18n/I18nContext';

export function galleryImage(images: string[], selectedSrc: string | null): { src: string | null; index: number } {
  if (!images.length) return { src: null, index: 0 };
  const selectedIndex = selectedSrc ? images.indexOf(selectedSrc) : -1;
  const index = selectedIndex >= 0 ? selectedIndex : 0;
  return { src: images[index]!, index };
}

export function gallerySelection(images: string[], selectedSrc: string | null, delta: number): string | null {
  if (!images.length) return null;
  const { index } = galleryImage(images, selectedSrc);
  return images[(index + delta + images.length) % images.length] ?? null;
}

export function ProductGallery({ images, alt, sizes }: {
  images: string[]; alt: string; sizes: string;
}) {
  const { t } = useI18n();
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const active = galleryImage(images, selectedSrc);
  const multiple = images.length > 1;

  const move = (delta: number) => setSelectedSrc(gallerySelection(images, active.src, delta));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!multiple || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  };

  return <div className="product-gallery">
    <div className="product-gallery-main" role={multiple ? 'group' : undefined} aria-roledescription={multiple ? 'carousel' : undefined}
      aria-label={multiple ? t('product.p1.gallery') : undefined} tabIndex={multiple ? 0 : undefined} onKeyDown={onKeyDown}>
      <ProductImage src={active.src} alt={alt} priority={active.index === 0} sizes={sizes} />
      {multiple && <>
        <button type="button" className="product-gallery-nav product-gallery-previous"
          aria-label={t('product.p1.previousImage')} onClick={() => move(-1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button type="button" className="product-gallery-nav product-gallery-next"
          aria-label={t('product.p1.nextImage')} onClick={() => move(1)}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <p className="product-gallery-counter" aria-live="polite" aria-atomic="true">
          {active.index + 1} / {images.length}
        </p>
      </>}
    </div>
    {multiple && <div className="product-gallery-thumbs" role="group" aria-label={t('product.p1.gallery')}>
      {images.map((src, index) => <button key={src} type="button" className="product-gallery-thumb"
        aria-pressed={src === active.src} aria-label={t('product.p1.showImage', { index: index + 1, total: images.length })}
        onClick={() => setSelectedSrc(src)}>
        <ProductImage src={src} alt="" sizes="80px" />
      </button>)}
    </div>}
  </div>;
}
