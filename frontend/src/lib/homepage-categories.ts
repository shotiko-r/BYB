// Curated entry queries, not claims about backend taxonomy or inventory coverage.
export const homepageCategories = [
  { id: 'electronics', query: 'electronics', path: 'M5 4h14v11H5z M9 20h6 M12 15v5' },
  { id: 'auto', query: 'car parts', path: 'M4 15V9l3-5h10l3 5v6 M4 10h16 M6 15v4 M18 15v4 M7 13h1 M16 13h1' },
  { id: 'home', query: 'kitchen', path: 'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7' },
  { id: 'fashion', query: 'clothing', path: 'm8 3-5 4 3 4 2-2v12h8V9l2 2 3-4-5-4 M8 3c0 5 8 5 8 0' },
  { id: 'outdoors', query: 'camping', path: 'M3 20 12 4l9 16H3Z M12 4v16 M9 20l3-6 3 6' },
  { id: 'tools', query: 'tools', path: 'M14 4a5 5 0 0 0-6 6l-5 8 3 3 8-7a5 5 0 0 0 6-6l-4 3-3-3 1-4Z' },
  { id: 'beauty', query: 'personal care', path: 'M8 9h8v12H8z M10 9V3h4v6 M8 13h8' },
  { id: 'kids', query: 'toys', path: 'M5 8h14v13H5z M3 8h18v4H3z M12 8v13 M12 8C3 8 6 0 10 4l2 4c9 0 6-8 2-4l-2 4' },
] as const;
export function categorySearchHref(id: string, market: string): string {
  const category = homepageCategories.find(category => category.id === id);
  return `/search?${new URLSearchParams({ ...(category ? { q: category.query } : {}), market })}`;
}
