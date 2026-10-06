import { ConciergeRequestSchema, ConciergeIntentSchema, type ConciergeQuestion, type ConciergeResponse, type SearchIntent } from '@byb/shared/types';
import { MockSearchIntentParser } from './mock-parser.js';
import type { SearchIntentParser } from './types.js';
import { SearchService } from '../search/service.js';
import { AppError } from '../../shared/errors.js';
import { rankRecommendations } from './concierge-ranking.js';

const preferences: Record<string, { prompt: string; features: string[] }> = {
  headphones: { prompt: 'Which features matter most?', features: ['wireless', 'noiseCancellation', 'microphone', 'waterproof'] },
  smartphones: { prompt: 'Which features matter most?', features: ['camera', 'batteryLife', 'waterproof'] },
  laptops: { prompt: 'Which features matter most?', features: ['portability', 'batteryLife', 'gaming'] },
};
const useCases: Record<string, string[]> = {
  headphones: ['travel', 'office', 'gaming', 'workout', 'everyday'],
  smartphones: ['photography', 'gaming', 'office', 'everyday'],
  laptops: ['office', 'study', 'gaming', 'travel'],
};
const labels: Record<string, string> = {
  noiseCancellation: 'Noise cancellation', wireless: 'Wireless', microphone: 'Microphone', waterproof: 'Waterproof',
  camera: 'Camera', batteryLife: 'Battery life', portability: 'Portability', gaming: 'Gaming',
  headphones: 'Headphones', smartphones: 'Phones', laptops: 'Laptops', electronics: 'Electronics',
  travel: 'Travel', office: 'Work and calls', workout: 'Exercise', everyday: 'Everyday use',
  photography: 'Photography', study: 'Study',
};
const options = (values: string[]) => values.map(value => ({ value, label: labels[value] ?? value }));

export class ConciergeService {
  constructor(
    private readonly parser: SearchIntentParser = new MockSearchIntentParser(),
    private readonly search: Pick<SearchService, 'searchIntent'> = new SearchService(),
  ) {}

  async respond(input: unknown): Promise<ConciergeResponse> {
    const request = ConciergeRequestSchema.safeParse(input);
    if (!request.success) throw AppError.badRequest('Invalid Concierge request', request.error.flatten().fieldErrors);
    const { query, market, answers } = request.data;
    const partial = await this.parser.parse(query, market);
    // Recognize an explicit currency code in the original request; never infer FX.
    const namedCurrency = query.match(/\b(USD|GEL|EUR|GBP|AMD|AZN|CAD|JPY)\b/i)?.[1]?.toUpperCase();
    let intent: SearchIntent = {
      ...partial, query,
      category: answers?.category ?? partial.category,
      brand: answers?.brand ?? partial.brand,
      currencyCode: answers?.currencyCode ?? namedCurrency ?? partial.currencyCode,
      filters: {
        ...partial.filters,
        useCase: answers?.useCase ?? partial.filters?.useCase,
        features: answers?.features ? [...new Set(answers.features)] : partial.filters?.features,
      },
    };
    if (answers?.budget) {
      if ('unlimited' in answers.budget) {
        intent = { ...intent, minPrice: undefined, maxPrice: undefined, filters: { ...intent.filters, budgetUnrestricted: true } };
      } else {
        if (answers.currencyCode && answers.currencyCode !== answers.budget.currencyCode) throw AppError.badRequest('Conflicting answer currencies');
        intent = { ...intent, minPrice: answers.budget.minPrice, maxPrice: answers.budget.maxPrice, currencyCode: answers.budget.currencyCode };
      }
    }
    const validated = ConciergeIntentSchema.safeParse(intent);
    if (!validated.success) throw AppError.badRequest('Invalid shopping intent', validated.error.flatten().fieldErrors);
    intent = validated.data;
    const questions: ConciergeQuestion[] = [];
    if (!intent.category) questions.push({ id: 'category', prompt: 'What type of product are you shopping for?', options: options(['headphones', 'smartphones', 'laptops', 'electronics']) });
    if (!intent.filters?.useCase) questions.push({ id: 'useCase', prompt: intent.category ? `What will you mainly use the ${intent.category} for?` : 'What will you mainly use it for?', options: options(useCases[intent.category || ''] || ['office', 'travel', 'gaming', 'everyday']) });
    const hasBudget = intent.minPrice !== undefined || intent.maxPrice !== undefined;
    if (!hasBudget && !intent.filters?.budgetUnrestricted) questions.push({ id: 'budget', prompt: intent.currencyCode ? `What's your maximum budget in ${intent.currencyCode}?` : "What's your maximum budget?" });
    else if (hasBudget && !intent.currencyCode) questions.push({ id: 'currencyCode', prompt: 'Which currency is your budget in?', options: options(['USD', 'GEL', 'EUR', 'GBP', 'AMD', 'AZN']) });
    const preference = preferences[intent.category || ''];
    const knownFeatures = intent.filters?.features;
    if (preference && (!Array.isArray(knownFeatures) || !knownFeatures.length) && answers?.features === undefined) {
      questions.push({ id: 'features', prompt: preference.prompt, options: options(preference.features) });
    }
    // Shipping metadata is not reliable enough to ask or promise delivery urgency yet.
    if (questions.length) return { status: 'needs_clarification', questions: questions.slice(0, 4) };
    const result = await this.search.searchIntent(intent, market, { page: 1, limit: 100, sort: 'relevance' });
    return { status: 'recommendations', intent, recommendations: rankRecommendations(result.products, intent).slice(0, 4) };
  }
}
