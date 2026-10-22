'use client';

import Image from 'next/image';
import { useState } from 'react';

export function ProductImage({ src, alt, sizes, priority = false }: {
  src: string | null; alt: string; sizes: string; priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return (
    <div role="img" aria-label={alt} className="product-image-fallback">
      <span aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m4 17 5-5 4 4 3-3 5 5" />
        </svg>
        <span>BYB</span>
      </span>
    </div>
  );
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    unoptimized={src.startsWith('http')} className="object-contain transition-transform duration-300 group-hover:scale-105"
    onError={() => setFailedSrc(src)} />;
}
