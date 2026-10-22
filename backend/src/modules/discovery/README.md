# Persisted discovery (F2)

`GET /api/discovery/home?market=GE&limit=4` returns all five shelves in allocation
order. `GET /api/discovery?market=GE&section=discover&limit=4` returns the same
envelope with one section. `market` defaults to GE; `limit` defaults to 4 and is
bounded to 1–20. Invalid/inactive markets are rejected rather than silently changed.
Optional `currency=USD` filters general shelves. Budget shelves always use USD;
an explicit conflicting currency on the single-budget endpoint is rejected.

Response: `{ market, generatedAt, rotationBucket, algorithmVersion, sections }`.
Each section has `{ key, titleKey, status, products }`, where status is `ok` or
`unavailable`. Each card contains the existing product/offer display structure,
`firstSeenAt`, `offerCount`, and `distinctMerchantCount`. Counts describe only the
returned qualifying offers, not verified canonical products or universal coverage.
Only known condition is allowlisted from product attributes. Shipping and affiliate
metadata are empty objects; tracked destination URLs remain unchanged.

Stable order and meaning:

1. `discover`: broad eligible persisted catalog.
2. `new_on_byb`: first eligible market-offer creation time, descending. This is first
   observed on BYB in the selected market, not manufacturer release or listing date.
3. `under_25_usd`: USD item prices strictly below 2500 minor units.
4. `under_50_usd`: USD item prices strictly below 5000 minor units.
5. `more_to_explore`: broad catalog, prioritizing identities unused by earlier shelves.

No endpoint imports SearchService, calls provider search/detail methods, imports a
feed, writes catalog data, or performs FX. It is real-production only: mock-only
development registries return empty shelves. Existing search/import activity fills
the catalog; discovery deliberately does not refresh it.

Eligibility reuses the exact shared provenance/feed SQL and adds active market,
market-merchant enablement, registered market support, nonnegative prices, valid
source currency shape, and exclusion of known out-of-stock offers. Unknown stock
does not imply shipping or delivery eligibility. eBay discovery additionally requires
`last_checked_at` within the preceding **24 hours**, not in the future. Stale rows
are excluded, never deleted. eBay Browse/search behavior is unchanged. AliExpress
retains its configured feed age, approved feed namespace, allowlist, and strict
timestamp/provenance checks. Clickout health is independently handled by F1's flag.

Rotation uses UTC daily buckets and algorithm version `discovery-v1`. SQL samples
a bounded pool per displayed merchant (40–200 candidates, 1000 total maximum per
section), ordered by image presence and deterministic identity/bucket hash. New on
BYB puts first-seen timestamp ahead of image presence. Service ranking uses SHA-256
of version, section, market, bucket, internal product ID and exact merchant/source
listing identities. No random numbers, title matching or popularity metrics.

Soft merchant and known-category caps diversify membership. The `aliexpress-feed`
fallback category is ignored; nothing infers category from titles. Category caps,
then merchant caps, relax if necessary. Selected output retains its section rank.
Across sections, both product ID and exact `(merchant, market, external ID)` keys
are excluded first. Only after exhausting unused candidates can previous-section
identities fill sparse shelves. A listing never repeats within one shelf. This is
deduplication, not conceptual-product merging.

Ordering is reproducible for unchanged eligible inputs within a bucket. Imports,
price changes, eligibility expiry, or image changes can alter membership within
that day; there is deliberately no persistent snapshot or cache hiding those
changes. Every request rechecks eligibility and returns `Cache-Control: no-store`.
Candidate pools bound application work, not database scan cost; revisit indexing
or snapshots only if measured catalog size/latency warrants it.

Section reads settle independently. A failed section is `unavailable` while others
remain usable; total failure is a sanitized 503. No internal database errors or raw
provider metadata enter the public response. A valid empty catalog is not an error.

Run PostgreSQL tests only against a disposable `BYB_FEED_TEST_DATABASE_URL`.
The suite creates/drops isolated test schemas and uses synthetic URLs/data; it never
uses application DATABASE_URL or live merchant transport.
