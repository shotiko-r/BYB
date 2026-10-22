# Frontend presentation flags

`NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED` controls external AliExpress CTAs only.
It defaults to disabled; only the exact value `true` enables clickouts. Listings,
merchant names, source prices, and internal detail navigation remain available.
eBay CTAs are unaffected. Destination URLs are neither rewritten nor regenerated.

Next.js inlines this public flag **at build time**. Changing only the environment
of an already-built server will not change browser behavior. Set it in the frontend
build environment and rebuild to change it. Do not place secrets in public flags.

- During the routing investigation: `NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED=false`.
- After operational verification: set `true` and rebuild to restore existing links.
- Frontend Docker builds accept `--build-arg NEXT_PUBLIC_ALIEXPRESS_CLICKOUT_ENABLED=true`
  (default `false`), alongside the existing required `NEXT_PUBLIC_API_URL` argument.

F2 homepage shelves use one `GET /api/discovery/home?market=...` request over the
persisted catalog. The browser does not call search to populate shelves. Labels are
Discover, New on BYB, Under US$25, Under US$50, and More to Explore. Membership,
source eligibility, ranking, daily deterministic rotation and cross-section
allocation are backend-owned. Section skeletons, independent unavailable states,
and retry preserve the existing layout. Obsolete requests are aborted on market
change/unmount; no frontend shuffle is used.

New on BYB means first observed in the market, not newly released. Budget shelves
use USD item prices strictly below US$25/US$50 without FX or inferred shipping/tax.
General shelves can contain mixed source currencies. View-all links are hidden:
keyword search cannot faithfully continue this broad persisted-catalog allocation.
No placeholder routes are added. See the backend discovery README for policy and
same-day membership-change limitations.

Cards and detail views share active-offer counts, unknown suppression, condition
display and clickout policy. Multiple offers remain separate listings/offer rows;
no canonical product merging, currency conversion, or best-price guarantee is added.

F3 standard search derives its applied state from Next.js URL search parameters:
`q`, `market`, `page`, `sort`, `merchant` (comma-separated codes), `category` (slug),
`currency`, `minPrice`, and `maxPrice`. Price parameters in URLs/API are **minor
units**. Input fields display major units and use decimal-string/BigInt conversion,
including zero- and three-decimal currencies. Query/filter/sort changes push URL
history and reset the page; Back/Forward and reload restore the same state. Only
unsubmitted input drafts and request results live outside the URL. Legacy
`currencyCode` URLs remain readable and become `currency` on the next interaction.

Best Match defaults to all source currencies. Price sorting/ranges require an
explicit supported currency; no hidden GEL filter is added. Changing currency
clears the previous range rather than interpreting old amounts in a new currency.
Merchant/category choices come from `/api/search/options`; categories are exact,
with no inferred AliExpress categories. Active chips and clear-all preserve the
query/market. Blank search is a landing state and never issues a product search.
Controls stay visible through validation, loading, empty and retryable errors.

Both search and catalog autocomplete use AbortController plus request identity
checks. Autocomplete is backed by persisted catalog evidence, with arrow navigation,
Enter selection, Escape dismissal and combobox/listbox accessibility. Source card
semantics and the AliExpress clickout flag remain unchanged.

Validation: `npm run test --workspace=frontend` covers state, exact money, request
gates and rendering. Optional `npm run test:browser --workspace=frontend` runs a
built frontend locally with headless Chrome and synthetic intercepted API responses
for actual Back/Forward, reload, filters, keyboard autocomplete, late responses,
empty search and retry. Build first with `NEXT_PUBLIC_API_URL=https://api.example.invalid`;
the browser test intercepts that origin without accessing merchants. Set
`BYB_TEST_CHROME` for another Chrome path and `BYB_TEST_PORT` for another local port.
No browser dependency is installed and no deployment is performed.

## Homepage H1

The homepage starts with eight curated category entry queries. These link into the
unchanged search page, preserving the selected market; they do not claim an exact
backend category mapping. The compact search link remains available above the
fold, and assisted search remains in an expandable panel below discovery.

The same single discovery/home request supplies all five shelves. Horizontal
scroll/snap preserves the backend membership and ordering. Only Discover advances
automatically, every nine seconds. Hover, keyboard focus and a hidden page pause
it; manual navigation or touch stops it until explicitly resumed. Reduced-motion
preferences disable autoplay and smooth scrolling. Previous/next controls and
native touch scrolling remain available. No extra provider/search requests or
ranking signals are introduced for rotation.

`local-interests.ts` stores at most 12 recent category/product IDs and their market
and timestamp in `byb-interests-v1` on the current device. Reads expire entries
after 30 days; there are no free-text queries, prices, backend writes, analytics
requests or personalized rankings. A clear-memory control removes that key.
Storage failures do not block navigation. This is a foundation for a later,
explicit personalization design, not a recommendation engine.
