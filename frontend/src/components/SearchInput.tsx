'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

interface SearchInputProps {
  market: Market;
  onSearch: (query: string) => void;
  placeholder?: string;
  showModes?: boolean;
}

export function SearchInput({ market, onSearch, placeholder, showModes = true }: SearchInputProps) {
  const { t, tArray } = useI18n();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(value.length >= 2);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        try {
          const data = await api.search.suggestions(value, market.code);
          setSuggestions(data.suggestions);
        } catch {
          setSuggestions([]);
        }
      }, 200);
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      onSearch(query.trim());
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const examples = tArray('homepage.hero.examples.items');

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-3xl">
      <label htmlFor="search" className="sr-only">{t('common.search')}</label>
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          id="search"
          type="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder || t('common.searchPlaceholder')}
          className="w-full pl-12 pr-12 py-4 text-lg border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm"
          autoComplete="off"
          role="combobox"
          aria-controls="suggestions"
          aria-expanded={showSuggestions && suggestions.length > 0}
        />
      </div>

      {showModes && (
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-500">{t('homepage.hero.inputModes.photo')}</span>
          <button type="button" className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" disabled aria-disabled={true}>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{t('homepage.hero.inputModes.photo')}</span>
          </button>
          <button type="button" className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" disabled aria-disabled={true}>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m0 0a7 7 0 017-7 7 7 0 017 7z" />
            </svg>
            <span>{t('homepage.hero.inputModes.voice')}</span>
          </button>
          <button type="button" className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors" disabled aria-disabled={true}>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102 1.101m0-5.656a4 4 0 115.656 0l4 4a4 4 0 01-5.656 5.656l1.102 1.101m-4.828-4.828a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l-1.102-1.101m0 0l-1.102 1.101m-4.828-4.828l-1.102-1.101" />
            </svg>
            <span>{t('homepage.hero.inputModes.link')}</span>
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {examples.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setQuery(item);
              onSearch(item);
              setShowSuggestions(false);
            }}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-full transition-colors whitespace-nowrap"
          >
            {item}
          </button>
        ))}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul id="suggestions" role="listbox" className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <li key={index} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  setQuery(suggestion);
                  onSearch(suggestion);
                  setShowSuggestions(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-t-0"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}