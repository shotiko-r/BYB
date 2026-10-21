Dry-run mode retains the Phase B streaming validation workflow without database
access. Phase C adds explicit bounded APPLY below. Neither mode enables search or scheduling.

Set ADMITAD_ALIEXPRESS_FEED_URL in local repository-root .env or backend runtime
secret environment, and ADMITAD_ALIEXPRESS_FEED_ENABLED=true. Never put the actual
URL in Git, CLI arguments, frontend configuration, tickets or logs. The CLI loads
root .env without overriding runtime environment. Dry-run needs no DATABASE_URL.

Run from the repository root:

    npm exec --workspace=backend -- tsx src/scripts/import-admitad-feed.ts --feed aliexpress-ww --dry-run --max-products 100

Optional --max-bytes and --max-duration-seconds, like --max-products, can only lower
configured limits. Defaults: 5,000 accepted products, 100 MiB decoded bytes, 120 s,
64 KiB decoded record content plus field separators. Invalid rows do not count
towards accepted-product limits. Markets are validated configuration only: dry-run
does not claim delivery eligibility or duplicate rows by market.

Exit 0 means completed or intentional accepted-product limit. Other termination
reasons exit 1; statistics are partial, never authoritative for deletion/staleness.
Ctrl-C/SIGTERM cancels the run. Record/parser faults are fatal; mapper rejections
continue. Diagnostic samples contain only row numbers and defined field/error codes
(at most ten each). No mapped-product samples are output. Category keys are hashed;
the top twenty use bounded Space-Saving estimates: actual counts lie between count
minus error and count. Reason counts and USD currency counts have fixed mapper-defined
cardinality. bytesRead counts decoded chunks consumed, including parser read-ahead;
a chunk crossing the byte ceiling is counted but never passed to the parser.

Transport accepts HTTPS without userinfo/fragments, follows at most three same-origin
redirects and rejects cross-origin/downgrade redirects. Runtime endpoints are trusted
operator configuration, not user input; this is not a DNS/IP-level SSRF sandbox.
Confirm legitimate redirect requirements before use; do not relax policy ad hoc.
Header requests time out after 10 s, idle reads after 10 s, overall duration covers
retries/parsing/mapping. At most two retries apply to network/header timeout, 429 and
5xx failures before body consumption. Retry-After seconds/dates are honored; delays
above 5 s fail rather than retry early. Partially consumed bodies are never replayed.

Use a maintained, patched Node runtime (project minimum Node 20). Native Node fetch
uses Undici and returns decoded Content-Encoding bodies; the importer measures those
bytes and does not decompress twice. Only identity, gzip and deflate are accepted;
chained encodings, Brotli and archive-file downloads are unsupported. Compressed
Content-Length is not a decoded-size guarantee. Custom test transports must return
already decoded bodies, just like native fetch. No transport errors/bodies/URLs are
retained in reports. See https://github.com/nodejs/undici for native-fetch behavior.

## Phase C: explicit bounded apply

No migration is required. Existing Phase A/B work is retained. This does not register
AliExpress for search, change eligibility, or modify the eBay API integration.

Dry run (no DB access):

```sh
npm exec --workspace=backend -- tsx src/scripts/import-admitad-feed.ts --feed aliexpress-ww --dry-run --max-products 100
```

Explicit apply (operator authorization required for real feeds):

```sh
npm exec --workspace=backend -- tsx src/scripts/import-admitad-feed.ts --feed aliexpress-ww --apply --max-products 100
```

Exactly one mode is required. Apply requires DATABASE_URL and the enabled feed
configuration. Markets come exclusively from ADMITAD_ALIEXPRESS_FEED_MARKETS;
all must exist and be active, as must merchant code `aliexpress`. CLI limits only
lower configured maxima. `--batch-size` is apply-only, default 100, range 1–250.
Exit 0 means successful bounded completion; exit 1 means argument/configuration,
lock, transport, parsing, or persistence failure. Diagnostics never include DB
errors, feed URLs, credentials, or row contents. A failed run can have committed
batches; inspect committedProducts/committedBatches. A partial pending batch is
discarded after stream failure. No absence-based changes are made.

Identity is the Phase A `aliexpress-` + SHA-256 of feed key, NUL separator, and
**exact** source ID (including leading zeroes). Product slug is the stable key;
lookup includes inactive products and uses indexed slug predicates. Existing
ambiguous identities fail closed. Product name/image and offer price, deeplink,
metadata, timestamps, and active status refresh on observation. Exact source ID
is retained in offers.external_product_id and metadata. Missing/invalid optional
oldprice clears the previous observation; valid oldprice is stored in minor units.

Only the controlled `aliexpress-feed` / “AliExpress feed” fallback category is
created. Raw merchant category is metadata, never a taxonomy input. Existing
product category is retained; category text changes do not create or move products.

Each awaited batch checks out one client, begins one transaction, validates
references, deduplicates by identity (last row wins), writes products/offers, and
commits. Any failure rolls back the entire batch, leaving earlier commits intact.
There is no whole-feed transaction. A separate checked-out connection holds sorted
session advisory locks for each feed key + allowed market throughout the run;
collision fails with FEED_LOCKED. Finally releases locks (discarding the connection
on unlock failure). Short transaction advisory locks on product identities also
serialize cross-market writes; sorted identity order avoids lock-order deadlocks.
These locks plus the existing offer unique key enforce idempotency for feed writers.
Other future writers of these identities must honor the same protocol.

One random UUID syncRunId is used throughout each run. Metadata is explicitly
allowlisted and includes `_byb.provenance` and sibling `_byb.sourceType` / `_byb.feed`.
No cleanup, scheduling, expiration, FX conversion, or product_markets writes occur.

Disposable PostgreSQL integration tests use **only** an explicitly supplied
BYB_FEED_TEST_DATABASE_URL (never application DATABASE_URL), create a unique schema,
and drop that schema afterward. Run against a disposable PostgreSQL instance:

```sh
BYB_FEED_TEST_DATABASE_URL=postgresql://... npm run test --workspace=backend -- tests/feed-persistence.test.ts
```

## Phase D: persisted search and detail eligibility

Set `ALIEXPRESS_SEARCH_ENABLED=true` in the API runtime to register AliExpress as
`real` / `production` with retrieval mode `persisted-feed`. Keep the working
`EBAY_PROVIDER_MODE=real` configuration for live eBay results. Search enablement is
independent of importer enablement: API processes need no feed URL, and the API env
schema discards that importer-only credential. No import or feed download occurs
from search or detail handlers. Default search enablement is false to retain the
existing explicit development/mock configuration until configured.

`ADMITAD_ALIEXPRESS_FEED_MARKETS` is the runtime market allowlist (default `GE`).
`ADMITAD_ALIEXPRESS_FEED_MAX_AGE_HOURS` defaults to 24; valid values are greater than
zero and at most 8760. The database clock determines freshness from
`_byb.feed.lastSeenAt`. It must be a valid canonical UTC timestamp emitted by the
Phase C importer (`YYYY-MM-DDTHH:mm:ss.sssZ`), within the configured age and not in
the future. Missing, malformed, invalid-calendar, future, and stale timestamps
fail closed. PostgreSQL JSONPath validates the timestamp safely without an unsafe
cast of upstream strings. No migration or cleanup is needed.

Every eligible feed offer must also have the exact real/production/AliExpress
provenance object, `_byb.sourceType=admitad-feed`, approved feed key
`aliexpress-ww`, active product/offer/merchant/market, an allowlisted market, and an
explicit enabled `market_merchants` entry. This policy is shared by search count,
page, and product-detail queries. It says nothing about shipping eligibility;
availability stays unknown and no shipping promises are inferred.

Search fetches only live providers, normalizes/persists their observations, then
reads all eligible sources through the existing grouped PostgreSQL query. An
AliExpress card and an eBay card for the same model stay separate. Grouping by
internal product ID prevents duplication of just-persisted live results; existing
stable source identities and offer constraints prevent repeated stored offers.
There is no title-based cross-merchant merge or separate array concatenation.
Existing model/accessory relevance, currency filters, budget safety, pagination,
and alphabetical/price sort semantics apply to both sources. Feed category remains
a conservative fallback: category/feature filters require actual stored evidence,
so title relevance alone does not invent category/brand/feature facts.

A live eBay failure still allows eligible AliExpress and eligible cached eBay
results. Live provenance stamping updates only `_byb.provenance`, preserving its
siblings. Persisted feed metadata is not restamped during search.

Offers now include optional `merchant: { id, code, name, logoUrl }` in the public
shared schema. Only public display identity is attached; no merchant configuration
is exposed. PostgreSQL Date/JSON-aggregated offset timestamps are normalized to UTC
for the existing API schema. Detail endpoints retain tracked destination links.

Frontend files are unchanged. Existing cards render products and their true USD
prices. Merchant logos can render if the configured asset exists; cards do not yet
have a text merchant label. Existing comparison/detail views already use
`offer.merchant.name`, including “Buy on AliExpress” CTAs. Missing logo assets and
card-level text labels remain frontend polish, not backend eligibility problems.

Phase D integration tests use the same explicitly opted-in disposable PostgreSQL
URL as Phase C, with unique schemas and serialized extension setup. They invoke the
actual Fastify `/api/search` and `/api/products/:id` routes, with mocked live eBay
and synthetic persisted feed rows. They forbid importing feed transport/importer
from the search path. Run together with the full backend suite:

```sh
BYB_FEED_TEST_DATABASE_URL=postgresql://... npm run test --workspace=backend
```
