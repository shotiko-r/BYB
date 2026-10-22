# P1 product and shipping audit

## Scope and evidence

Code inspected: `backend/src/modules/provider/ebay/{client,ebay-provider,mapping}.ts`,
`backend/src/modules/feed/merchants/aliexpress.ts`, provider normalization and
product repository serializers. Source documentation:

- https://developer.ebay.com/api-docs/buy/browse/resources/item/methods/getItem
- https://developer.ebay.com/api-docs/buy/static/api-browse.html#Headers
- https://developer.ebay.com/devzone/rest-shared/browse-beta-5.0-appendix.html

The API may supply these optional fields; this audit does not claim that every
live listing currently supplies them. No extra live provider request or request
context was introduced to obtain estimates.

| Field | eBay before P1 | eBay P1 | AliExpress current feed mapping |
| --- | --- | --- | --- |
| Shipping cost and currency | `shippingInfo.options[].shippingCost` in minor units | Preserved and displayed from one source option | None |
| Shipping type / cost type | Retained in options | Retained; no inferred shipping promises | None |
| Service / carrier | Discarded by mapper | Optional source service/carrier retained; service displayed | None |
| Minimum / maximum delivery date | Discarded by mapper | Optional ISO dates retained; valid, nonexpired estimates displayed | None |
| Ship-from / item location | Item country retained in product attributes | Displayed as **Item location**, not manufacturing origin | None |
| Destination used for estimate | Discarded by mapper | Optional explicit country retained; postal code excluded | None |
| Ship-to eligibility | No normalized eligibility; no destination context in client | Unchanged; no inferred GE eligibility | No inferred eligibility |
| Free shipping | No separate normalized flag; zero shipping cost is explicit evidence | Zero source cost shown as Free shipping, with destination qualification | No supported evidence |
| Handling estimate | No mapped field | No handling-time display | None |

AliExpress's accepted feed headers are `id,name,url,category,currencyId,param,
picture,oldprice,price`. Its mapper explicitly outputs unknown shipping/tax.
Uninterpreted affiliate/feed parameters are not a trustworthy shipping contract
and are not exposed as product facts. AliExpress shipping/ETA remain omitted.
Legacy mock `estimatedDays` / `freeShipping` flags are not used for delivery UI.

## Destination safety

The eBay client currently sends Authorization and X-EBAY-C-MARKETPLACE-ID only.
GE selecting EBAY_US proves neither shipping eligibility nor a Georgian ETA.
eBay documents `X-EBAY-C-ENDUSERCTX` contextualLocation (country and postal code)
for destination-aware/calculated shipping. That requires a separate destination
input, request/cache scoping and eligibility design; P1 does not change requests.

If the source supplies `shipToLocationUsedForEstimate.country`, the UI states
which country the merchant estimate refers to. Otherwise it explicitly says the
destination is unconfirmed. No date or cost implies delivery eligibility. Cost,
service and dates stay together from the same source option; no cheapest-shipping
selection or cross-currency total is computed. Past, malformed or reversed ETA
windows are hidden. A lower-bound-only date says “From”; an upper-bound-only date
says “By”. This is an estimate, not a guarantee.

## Persistence and remaining gaps

Existing JSON shipping_info persistence and API serialization already pass through
these safe fields; no schema, endpoint or shared contract change is needed.
Cached listings acquire newly preserved fields only during normal refresh/search
flows. No backfill was run. Provider requests, feed ingestion, discovery, URL
tracking and AliExpress clickout gating remain unchanged.

Product condition currently lives on the product attributes, not separately on
each offer. It is shown in the primary purchase panel, not fabricated per seller.
Multi-offer comparison shows merchant, source item price, known availability,
source shipping/ETA and CTA. The full page has product facts once, one primary
purchase panel, and comparison only for two or more eligible offers. No “best”
label, FX conversion or shipping-inclusive total is claimed.
