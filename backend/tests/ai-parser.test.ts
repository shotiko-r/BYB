import { describe, it, expect } from 'vitest';
import { MockSearchIntentParser } from '../src/modules/ai/mock-parser.js';
import type { SearchIntent } from '@byb/shared/types';

describe('MockSearchIntentParser', () => {
  const parser = new MockSearchIntentParser();

  it('parses basic query', async () => {
    const intent = await parser.parse('headphones', 'GE');
    expect(intent.query).toBe('headphones');
    expect(intent.category).toBe('headphones');
  });

  it('detects headphones category', async () => {
    const intent = await parser.parse('headphones', 'GE');
    expect(intent.category).toBe('headphones');
  });

  it('detects wireless headphones category', async () => {
    const intent = await parser.parse('wireless headphones', 'GE');
    expect(intent.category).toBe('headphones');
  });

  it('detects smartphones category', async () => {
    const intent = await parser.parse('iphone 15', 'GE');
    expect(intent.category).toBe('smartphones');
  });

  it('detects laptops category', async () => {
    const intent = await parser.parse('macbook pro', 'GE');
    expect(intent.category).toBe('laptops');
  });

  it('detects gaming headphones category', async () => {
    const intent = await parser.parse('gaming headphones', 'GE');
    expect(intent.category).toBe('headphones');
  });

  it('detects brand from keywords', async () => {
    const tests = [
      { query: 'sony headphones', expected: 'sony' },
      { query: 'apple airpods', expected: 'apple' },
      { query: 'samsung galaxy', expected: 'samsung' },
      { query: 'bose quietcomfort', expected: 'bose' },
    ];

    for (const { query, expected } of tests) {
      const intent = await parser.parse(query, 'GE');
      expect(intent.brand).toBe(expected);
    }
  });

  it('extracts max price from "under" queries', async () => {
    const tests = [
      { query: 'headphones under $100', expected: 10000 },
      { query: 'phone below 500', expected: 50000 },
      { query: 'laptop less than $1000', expected: 100000 },
      { query: 'cheaper than 200', expected: 20000 },
    ];

    for (const { query, expected } of tests) {
      const intent = await parser.parse(query, 'GE');
      expect(intent.maxPrice).toBe(expected);
    }
  });

  it('extracts min price from "over" queries', async () => {
    const intent = await parser.parse('headphones over $50', 'GE');
    expect(intent.minPrice).toBe(5000);
  });

  it('extracts price range', async () => {
    const intent = await parser.parse('headphones $50 - $100', 'GE');
    expect(intent.minPrice).toBe(5000);
    expect(intent.maxPrice).toBe(10000);
  });

  it('detects use case', async () => {
    const tests = [
      { query: 'gaming headphones', expected: 'gaming' },
      { query: 'workout earbuds', expected: 'workout' },
      { query: 'travel headphones', expected: 'travel' },
      { query: 'office headset', expected: 'office' },
    ];

    for (const { query, expected } of tests) {
      const intent = await parser.parse(query, 'GE');
      expect(intent.filters?.useCase).toBe(expected);
    }
  });

  it('detects features', async () => {
    const tests = [
      { query: 'wireless headphones', expected: ['wireless'] },
      { query: 'noise cancelling headphones', expected: ['noiseCancellation'] },
      { query: 'waterproof earbuds', expected: ['waterproof'] },
      { query: 'headphones with microphone', expected: ['microphone'] },
      { query: 'wireless noise cancelling headphones with mic', expected: ['wireless', 'noiseCancellation', 'microphone'] },
    ];

    for (const { query, expected } of tests) {
      const intent = await parser.parse(query, 'GE');
      const features = (intent.filters?.features as string[]) || [];
      for (const feature of expected) {
        expect(features).toContain(feature);
      }
    }
  });

  it('combines multiple intents', async () => {
    const intent = await parser.parse('sony wireless gaming headphones under $150 with good microphone', 'GE');

    expect(intent.query).toBe('sony wireless gaming headphones under $150 with good microphone');
    expect(intent.category).toBe('headphones');
    expect(intent.brand).toBe('sony');
    expect(intent.maxPrice).toBe(15000);
    expect(intent.filters?.useCase).toBe('gaming');
    expect((intent.filters?.features as string[])).toContain('wireless');
    expect((intent.filters?.features as string[])).toContain('microphone');
  });

  it('returns empty intent for unrecognized query', async () => {
    const intent = await parser.parse('random unknown stuff', 'GE');
    expect(intent.query).toBe('random unknown stuff');
    expect(intent.category).toBeUndefined();
    expect(intent.brand).toBeUndefined();
  });
});