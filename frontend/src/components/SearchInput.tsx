'use client';

import { useState, useEffect, useRef, useId, KeyboardEvent } from 'react';
import { api } from '@/lib/api';
import { LatestRequest, suggestionIndex } from '@/lib/latest-request';
import { useI18n } from '@/i18n/I18nContext';
import type { Market } from '@/types';

interface SearchInputProps {
  market: Market;
  onSearch: (query: string) => void;
  placeholder?: string;
  showModes?: boolean;
  homepage?: boolean;
  queryValue?: string;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  busy?: boolean;
}

export function SearchInput({ market, onSearch, placeholder, showModes = true, homepage = false, queryValue, initialQuery = '', onQueryChange, busy = false }: SearchInputProps) {
  const { t, tArray } = useI18n();
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const query = queryValue ?? localQuery;
  const setQuery = (value: string) => { setLocalQuery(value); onQueryChange?.(value); };
  const [catalogSuggestions, setCatalogSuggestions] = useState<{ query: string; market: string; values: string[] }>();
  const suggestions = catalogSuggestions?.query === query && catalogSuggestions.market === market.code ? catalogSuggestions.values : [];
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const inputId = useId();
  const latest = useRef(new LatestRequest());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(value.length >= 2);

    setActiveIndex(-1);
  };

  const submit = (value: string) => {
    if (!value.trim() || busy) return;
    latest.current.cancel();
    setQuery(value.trim());
    onSearch(value.trim());
    setShowSuggestions(false);
    setActiveIndex(-1);
  };
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    submit(showSuggestions && activeIndex >= 0 ? suggestions[activeIndex] ?? query : query);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setShowSuggestions(true);
      setActiveIndex(index => suggestionIndex(event.key, index, suggestions.length));
    } else if (event.key === 'Enter') {
      event.preventDefault(); submit(showSuggestions && activeIndex >= 0 ? suggestions[activeIndex] ?? query : query);
    } else if (event.key === 'Escape') {
      event.preventDefault(); latest.current.cancel(); setShowSuggestions(false); setActiveIndex(-1);
    }
  };

  useEffect(() => {
    const gate = latest.current;
    const request = gate.begin();
    const timer = setTimeout(() => {
      if (query.trim().length < 2 || query.length > 100 || busy) return;
      void api.search.suggestions(query, market.code, request.signal).then(data => {
        if (request.current()) setCatalogSuggestions({ query, market: market.code, values: data.suggestions });
      }).catch(() => {
        if (request.current()) setCatalogSuggestions({ query, market: market.code, values: [] });
      });
    }, 200);
    return () => { clearTimeout(timer); gate.cancel(); };
  }, [query, market.code, busy]);

  const examples = tArray('homepage.hero.examples.items');

  return (
    <form onSubmit={handleSubmit} className={`search-input relative w-full max-w-3xl ${homepage ? "home-request" : ""}`}>
      <label htmlFor={inputId} className="sr-only">{t('common.search')}</label>
      <div className="relative request-field">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          disabled={busy}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowSuggestions(true)}
          onBlur={() => { setShowSuggestions(false); setActiveIndex(-1); }}
          placeholder={placeholder || t('common.searchPlaceholder')}
          className={`w-full pl-12 ${!homepage && !showModes ? 'pr-32' : 'pr-12'} py-4 text-lg border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow shadow-sm`}
          autoComplete="off"
          role="combobox"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showSuggestions && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-expanded={showSuggestions && suggestions.length > 0}
        />
        {(homepage || !showModes) && (
          <button type="submit" className={homepage ? 'request-submit' : 'search-submit'} disabled={busy} aria-busy={busy}>
            {t(busy ? 'common.searching' : homepage ? 'homepage.hero.cta' : 'common.search')}<span aria-hidden="true">↗</span>
          </button>
        )}
      </div>

      {showModes && (
        <div className="flex items-center gap-2 mt-3">
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

      <div className="flex flex-wrap gap-2 mt-3 request-examples">
        {examples.map((item, index) => (
          <button
            key={index}
            type="button"
            disabled={busy}
            onClick={() => {
              submit(item);
            }}
            className={`px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-full transition-colors ${homepage ? "" : "whitespace-nowrap"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                tabIndex={-1}
                onPointerDown={event => event.preventDefault()}
                disabled={busy}
                onClick={() => {
                  submit(suggestion);
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-t border-gray-100 first:border-t-0 ${index === activeIndex ? 'bg-blue-50' : ''}`}
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
