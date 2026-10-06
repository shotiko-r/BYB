# Concierge MVP

POST `/api/concierge` is stateless. The initial body needs only `query`; `market`
defaults to `GE`. Follow-ups resend the original query and all accumulated answers.
There are no sessions, LLM calls, or real merchant integrations.

```json
{"query":"I need headphones"}
```

Returns `status: "needs_clarification"` with up to four questions. Each question
has an `id`, a `prompt`, and optional `{value, label}` options. Answer fields use
these IDs. Known facts are skipped; only remaining facts are requested.

```json
{
  "query": "I need headphones",
  "market": "GE",
  "answers": {
    "useCase": "travel",
    "budget": {"maxPrice": 15000, "currencyCode": "USD"},
    "features": ["wireless", "noiseCancellation"]
  }
}
```

Answers may also include `category`, `brand`, or `currencyCode` (to complete a
currency-free budget parsed from the query). `features: []` means no preference;
`budget: {"unlimited": true}` means no budget constraint. Budgets are integer
minor units, never floating-point major units. Conflicting answer currencies,
reversed ranges, unknown answer fields, and invalid types return 400.

Known category, use case, budget/currency, and category-specific preferences
suffice for recommendations. An incomplete follow-up can return more clarification.
Urgency is not asked because available shipping metadata cannot support reliable
promises. The existing English keyword parser is reused; unsupported wording may
need explicit answers. Currency codes in original text recognize USD, GEL, EUR,
GBP, AMD, AZN, CAD, and JPY. The underlying text parser assumes two-decimal budget
units; use explicit integer-minor-unit budget answers for other currency formats.
No FX conversion occurs.

The validated intent is passed once to `SearchService.searchIntent`, requesting
up to 100 candidates. The top four are returned as `status: "recommendations"`,
`intent`, and `recommendations`. Each recommendation contains `matchScore` (0–100),
short evidence-based `reasons`, and a `product` using `ProductWithOffers`.
An empty candidate set returns an empty recommendation list. Provider failures
retain existing search-service behavior; complete unavailability returns 503.

Scoring weights are budget 30, category 25, requested features 25, brand 10,
and use case 10; normalize only over requested criteria. Budget fit requires an
active offer in the exact requested currency. Feature credit is proportional to
matching boolean attributes/list entries (Bluetooth also supports wireless).
Use-case credit uses explicit metadata or limited headphone heuristics: noise
cancellation for travel, waterproofing for workouts, microphone for office/gaming.
Missing metadata earns no credit. Stable product IDs break score ties; price never
breaks a tie across currencies. Scores express attribute match, not confidence or
verified product quality. Search constraints still apply before scoring, and
ranking is limited to the fetched 100 candidates; global ranking is deferred.


Question prompts and option labels are human-facing; IDs and option values remain
machine-facing. Clients render their own no-preference control and send an empty
feature list, rather than adding a new option value. Budget controls display major
units and convert to the documented minor-unit payload before submission.

The Amazon mock includes three explicitly synthetic GEL headphone offers at 449,
279, and 649 GEL. Prices are independent fixture values, not converted USD prices;
example.com destinations and synthetic metadata identify them as demo products.
The 500 GEL travel/noiseCancellation regression returns the first two, retaining
strict currency and budget filters.
