# Search (F3)

`GET /api/search` accepts `q`, `market`, `page`, `limit`, `sort`, `merchant`,
`category`, `currency`, `minPrice`, `maxPrice`, and the existing `brand` filter.
`currencyCode` remains a backwards-compatible alias. Conflicting currency fields
are rejected. Supported filter currencies are defined in shared `money.ts`.
Prices are integer minor units with a PostgreSQL INTEGER upper bound; bounds are
inclusive. Missing currency for a price sort/range is a 400, never a hidden switch
to market currency. Best Match can return all source currencies. No FX occurs.
Dollar-denominated constraints explicitly written in the query retain USD meaning.
Recognized text budgets are read in the explicit currency's decimal units without
floating point; conflicting text/filter currencies are rejected, never converted.

`merchant=ebay`, `merchant=aliexpress`, or `merchant=ebay,aliexpress` normalize to a
validated, deduplicated array. Repeated merchant query parameters also work. Codes
must map to active DB merchants and eligible registered market sources; mock-only
sources cannot be selected in real mode. Live retrieval is skipped for unselected
merchants; Browse request shape, pagination and mapping are unchanged. Persisted
merchant/currency/range filters apply before product grouping, counts, aggregation
and pagination. A product with no qualifying offers disappears, and only qualifying
offers are attached. This does not merge source listings.

`GET /api/search/options?market=GE` returns eligible configured merchant identities,
active controlled category rows (excluding the feed fallback), and supported filter
currencies. Explicit category filters must resolve to active DB rows. Categories
are exact only; no descendant expansion or AliExpress title classification occurs.
Market and merchant-market enablement also constrain persisted search results.

Text search parses existing intent rules and explicit request filters override
parsed constraints. Exact model retrieval retains separator-tolerant boundaries
and accessory exclusion. An explicit accessory query keeps its target model and
requires accessory evidence, without treating the target device's inferred brand
or category as the accessory's own manufacturer/category. Structured-intent callers
can provide accessory/model evidence in filters as well.

`relevance` and `best_match` share a small deterministic SQL evidence score across
all matching products before LIMIT/OFFSET: exact query title, title containment,
explicit model evidence, and known matching brand. Existing model/accessory gates
still determine eligibility. Ties use product name and ID. This is relevance, not
popularity, semantic AI, or a confidence percentage. Price sorts use each product's
cheapest qualifying offer within the explicit currency. `newest` uses BYB product
creation time and ID, never manufacturer release date. Live eBay retrieval remains
bounded to its existing first page; BYB totals count matching persisted products,
not the entire merchant marketplace.

`GET /api/search/suggestions?q=So&market=GE` reads real-production persisted names,
models and brands through shared offer/feed eligibility. It returns at most eight
case-insensitively deduplicated literal substring matches, with deterministic
length/text ordering. It never invokes live retrieval, invents suffixes or reads
unwritten search analytics. Query length is bounded and SQL wildcard characters
are escaped. No suggestions are fabricated in mock-only mode.

Providers settle independently. Eligible persisted eBay/AliExpress fallback remains
available on live failure. Existing AliExpress provenance, market allowlist and
feed freshness checks are retained. Search still normalizes successful live
observations; discovery remains a separate read-only endpoint. Affiliate links,
feed ingestion, and canonical identity are unchanged.

Regression tests run real HTTP handlers against disposable PostgreSQL only when
`BYB_FEED_TEST_DATABASE_URL` is supplied. No application database or live merchant
credentials are used by the synthetic fixtures.
