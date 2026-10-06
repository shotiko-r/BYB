import type { SearchIntentParser, SearchIntent } from './types.js';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  headphones: ['headphone', 'headphones', 'earphone', 'earphones', 'earbud', 'earbuds', 'airpods'],
  smartphones: ['phone', 'smartphone', 'iphone', 'android', 'galaxy', 'pixel'],
  laptops: ['laptop', 'notebook', 'macbook', 'ultrabook'],
  electronics: ['electronic', 'gadget', 'device'],
};

const BRAND_KEYWORDS: Record<string, string[]> = {
  sony: ['sony'],
  apple: ['apple', 'airpods', 'iphone', 'macbook', 'ipad'],
  samsung: ['samsung', 'galaxy'],
  bose: ['bose'],
  xiaomi: ['xiaomi', 'redmi', 'poco'],
};

const USE_CASE_KEYWORDS: Record<string, string[]> = {
  gaming: ['gaming', 'game', 'gamer'],
  workout: ['workout', 'gym', 'running', 'sport', 'fitness'],
  travel: ['travel', 'commute', 'flying', 'flight'],
  office: ['office', 'work', 'meeting', 'call'],
};

const FEATURE_KEYWORDS: Record<string, string[]> = {
  wireless: ['wireless', 'bluetooth', 'cordless'],
  noiseCancellation: ['noise cancel', 'noise cancelling', 'anc', 'noise reduction'],
  waterproof: ['waterproof', 'water resistant', 'ipx', 'sweat'],
  microphone: ['mic', 'microphone', 'voice'],
};

function extractPrice(query: string): { minPrice?: number; maxPrice?: number } {
  const result: { minPrice?: number; maxPrice?: number } = {};

  const underMatch = query.match(/(?:under|below|less than|cheaper than)\s*\$?(\d+(?:[.,]\d+)?)/i);
  if (underMatch?.[1]) {
    result.maxPrice = Math.round(parseFloat(underMatch[1].replace(',', '')) * 100);
  }

  const overMatch = query.match(/(?:over|above|more than)\s*\$?(\d+(?:[.,]\d+)?)/i);
  if (overMatch?.[1]) {
    result.minPrice = Math.round(parseFloat(overMatch[1].replace(',', '')) * 100);
  }

  const rangeMatch = query.match(/\$?(\d+(?:[.,]\d+)?)\s*[-–to]\s*\$?(\d+(?:[.,]\d+)?)/i);
  if (rangeMatch?.[1] && rangeMatch?.[2]) {
    result.minPrice = Math.round(parseFloat(rangeMatch[1].replace(',', '')) * 100);
    result.maxPrice = Math.round(parseFloat(rangeMatch[2].replace(',', '')) * 100);
  }

  return result;
}

function findMatch(query: string, keywords: Record<string, string[]>): string | undefined {
  const lowerQuery = query.toLowerCase();
  for (const [key, words] of Object.entries(keywords)) {
    if (words.some((w) => lowerQuery.includes(w))) {
      return key;
    }
  }
  return undefined;
}

export class MockSearchIntentParser implements SearchIntentParser {
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(query: string, _marketCode: string): Promise<SearchIntent> {
    const lowerQuery = query.toLowerCase();
    const prices = extractPrice(query);

    const category = findMatch(lowerQuery, CATEGORY_KEYWORDS);
    const brand = findMatch(lowerQuery, BRAND_KEYWORDS);
    const useCase = findMatch(lowerQuery, USE_CASE_KEYWORDS);
    const features: string[] = [];

    for (const [feature, words] of Object.entries(FEATURE_KEYWORDS)) {
      if (words.some((w) => lowerQuery.includes(w))) {
        features.push(feature);
      }
    }

    return {
      query: query.trim(),
      currencyCode: query.includes('$') ? 'USD' : undefined,
      category,
      brand,
      maxPrice: prices.maxPrice,
      minPrice: prices.minPrice,
      filters: {
        useCase,
        features: features.length > 0 ? features : undefined,
      },
    };
  }
}