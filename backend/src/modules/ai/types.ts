import type { SearchIntent } from '@byb/shared/types';

export type { SearchIntent };

export interface SearchIntentParser {
  parse(query: string, marketCode: string): Promise<SearchIntent>;
}

export interface SearchIntentParserFactory {
  create(): SearchIntentParser;
}