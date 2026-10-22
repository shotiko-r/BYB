'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nContext';

export const SHELF_INTERVAL_MS = 9000;

export function DiscoveryShelf({ children, label, autoRotate = false }: {
  children: ReactNode; label: string; autoRotate?: boolean;
}) {
  const { t } = useI18n();
  const viewport = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const focused = useRef(false);
  const [playing, setPlaying] = useState(autoRotate);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateEdges = () => {
    const node = viewport.current;
    if (node) setEdges({ start: node.scrollLeft < 2, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 2 });
  };
  const advance = (direction: number) => {
    const node = viewport.current;
    if (!node) return;
    const first = node.firstElementChild as HTMLElement | null;
    const step = (first?.offsetWidth ?? node.clientWidth) + 18;
    node.scrollBy({ left: direction * step, behavior: reducedMotion ? 'instant' : 'smooth' });
  };
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => observer.disconnect();
  }, [children]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  useEffect(() => {
    if (!playing || reducedMotion) return;
    const timer = setInterval(() => {
      const node = viewport.current;
      if (!node || paused.current || focused.current || document.hidden) return;
      const first = node.firstElementChild as HTMLElement | null;
      const end = node.scrollLeft + node.clientWidth >= node.scrollWidth - 2;
      node.scrollTo({ left: end ? 0 : node.scrollLeft + (first?.offsetWidth ?? node.clientWidth) + 18, behavior: 'smooth' });
    }, SHELF_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, reducedMotion]);

  return <div className="home-shelf" role="region" aria-label={label} aria-roledescription={t('homepage.h1.carousel')}
    onPointerEnter={() => { paused.current = true; }} onPointerLeave={() => { paused.current = false; }}
    onFocusCapture={() => { focused.current = true; }} onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) focused.current = false;
    }}>
    <div className="shelf-controls">
      {autoRotate && !reducedMotion && <button type="button" aria-pressed={!playing} onClick={() => setPlaying(value => !value)}>
        {t(playing ? 'homepage.h1.pause' : 'homepage.h1.play')}
      </button>}
      <button type="button" aria-label={`${t('homepage.h1.previous')} — ${label}`} disabled={edges.start}
        onClick={() => { setPlaying(false); advance(-1); }}><span aria-hidden="true">←</span></button>
      <button type="button" aria-label={`${t('homepage.h1.next')} — ${label}`} disabled={edges.end}
        onClick={() => { setPlaying(false); advance(1); }}><span aria-hidden="true">→</span></button>
    </div>
    <div className="shelf-viewport" ref={viewport} onScroll={updateEdges}
      onPointerDown={() => setPlaying(false)} onKeyDown={() => setPlaying(false)}>
      {children}
    </div>
  </div>;
}
