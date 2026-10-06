# Search foundation

`search(query, market, options)` parses text and delegates to
`searchIntent(intent, market, options)`. The latter validates and uses the supplied
intent without calling the parser. Intent constraints are authoritative; options
supply pagination, sorting, and an optional currency. Text-search request filters
are merged into intent first, with explicit values taking precedence.

When category, brand, budget, features, or use case are present, retrieval uses the
structured constraints rather than requiring the original sentence as a literal
substring. Unstructured queries retain literal text matching. This can broaden
model-specific text queries; extracting explicit model/search terms is deferred.
Category IDs are resolved to slugs for providers and IDs for database filtering.
Unknown category slugs remain restrictive.

Features require evidence in boolean product attributes or an `attributes.features`
list. `wireless` also accepts Bluetooth connectivity. Unknown/missing evidence does
not satisfy a requested feature. Use case and other intent metadata are preserved
for providers and the public response; no use-case recommendation scoring exists.

Prices and budgets are integer minor units with an explicit `currencyCode`.
Dollar-prefixed text budgets use USD. Otherwise, budgets and price sorts default
to the requested market's currency; the effective currency is returned in `query`
and `intent`. An explicit query currency restricts offers to that currency.
There is no FX conversion. Thus a GEL price search can return no results when only
USD offers exist, even if those products appear in an unpriced search.

Price ordering uses the cheapest qualifying offer per product, in the selected
currency. Without a price sort/filter, different currencies can be returned, but
offers are grouped by currency before sorting amounts within each currency.
Relevance is a stable alphabetical fallback; newest uses product creation time.
All product sorts have an ID tie-breaker.

Providers run independently. Failed providers and providers without an active
merchant mapping do not contribute offers. A successful empty response remains a
valid empty search; if no configured provider completes, the service returns 503.
Normalization/persistence and database failures still propagate.
