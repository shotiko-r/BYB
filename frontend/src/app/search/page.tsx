import { SearchResults } from '@/components/SearchResults';
import type { SearchPageParams } from '@/lib/search-presentation';

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params: SearchPageParams = Object.fromEntries(Object.entries(raw).map(([key, value]) =>
    [key, Array.isArray(value) ? key === 'merchant' ? value.join(',') : value[0] : value]
  ));
  return <SearchResults searchParams={params} />;
}
