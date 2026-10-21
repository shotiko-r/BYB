'use client';

import Image from 'next/image';
import { useState } from 'react';

export function ProductImage({ src, alt, sizes, priority = false }: {
  src: string | null; alt: string; sizes: string; priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return (
    <div role="img" aria-label={alt} className="w-full h-full flex items-center justify-center text-gray-400">
      <span aria-hidden="true">BYB</span>
    </div>
  );
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
    unoptimized={src.startsWith('http')} className="object-contain transition-transform duration-300 group-hover:scale-105"
    onError={() => setFailedSrc(src)} />;
}
