# Address search and restaurant ratings plan

Research date: 22 September 2026. Updated: 25 September 2026. Status: live Mappls search, reverse geocoding, pin resolution and traffic-ETA routing are working locally; comparative address auditing, production restrictions/terms, and ratings remain open.

## Decisions

Evaluate Mappls (MapmyIndia) as the primary India address provider. Its documented autosuggest, geocoding, reverse geocoding and place identifiers fit the address-discovery gap. The developer site advertises a free start, but this research did not establish a current numeric free allowance, production entitlement or permission to combine its results with our existing map and router. Confirm those points in the account plan and applicable terms before integration. Do not equate the free consumer app with free developer APIs.

Keep map rendering, address search, routing and ratings behind separate adapters. This is a technical separation, not an assumption that provider licenses allow mixing their data. Replace the renderer/router together if the selected license requires it. Keep the original destination pin separate from the road coordinate returned by routing.

Do not make Google search snippets the authoritative restaurant-rating feed. A search result may refer to another branch, contain an old score, omit the review count, or quote a different review platform. Search can discover source pages; only an authorized, structured provider response with an exact business match can supply a verified rating. Google's Custom Search JSON API is closed to new customers and ends for existing customers on 1 January 2027.

## Phase 1: exact destination selection

- **Implemented:** map-pin and GPS selection for either endpoint. Coordinate entry and a locally saved Home pin remain open. Exact pin coordinates remain the routing point while Mappls reverse geocoding supplies only a readable nearby label.
- **Implemented and live-tested:** Mappls autosuggest, server-only credential use, debounced/cancelled requests, reverse labels and Mappls-pin resolution before routing. Resolution first uses Place Details and then uses the destination waypoint returned by Mappls routing when Place Details omits coordinates. The live regional smoke suite passed search and pin resolution in Delhi, Mumbai, Kolkata, Hyderabad, Kochi and Guwahati on 25 September 2026.
- Show address precision: house/building, street, locality or manually selected pin. Never present a locality match as an exact house.
- Show the distance between the requested pin and the routed road endpoint; flag a material gap instead of silently moving the destination.
- **Implemented acceptance harness:** `npm run test:addresses` checks 42 public landmarks, stations, hospitals, airports, a full street address, lanes, villages and apartment complexes across India. It records top-result resolution error and provider latency in ignored `outputs/address-acceptance.json`. Private homes are excluded from fixtures and logs.
- **Current live baseline:** 35/42 checks pass with 135 ms median provider-call latency. Tamil, Bengali, Telugu and Malayalam queries return no Mappls Pin; the Hindi test returns HTTP 401 because regional-language search is not enabled for this key. Kamakhya Temple selects a same-named result 5.8 km away, and the public Mappls office address geocodes but resolves 991 m from the independent reference. All three lane, all three village, all four apartment-complex and the Port Blair fixtures pass. These remain failed cases rather than relaxed thresholds.
- **Provider failure handling:** long addresses now use Mappls Geocoding instead of silent 45-character truncation. The APIs distinguish missing credentials, unavailable capability, quota/key restriction, unresolved Pin and provider outage. The UI directs users to English or an exact pin when the configured account cannot serve a query.
- **Implemented entrance warning:** route responses retain the provider-snapped destination and calculate its distance from the exact selected pin. The UI warns at more than 75 m and preserves the warning across refresh.

Exit status: exact destination selection and failure recovery are implemented, but the 95% typed-search acceptance gate is blocked at 35/42 by the provider/account cases above. Closing Phase 1 requires Mappls regional-language entitlement and provider correction/confirmation for the ambiguous and inaccurate results, followed by a rerun of the same unchanged thresholds. Provider terms/quota confirmation, credential restrictions and real-device field testing also remain.

## Phase 2: provider-backed restaurant quality

- Pilot Mangrove's open reviews first. Measure actual coverage for a public restaurant sample across six Indian cities before choosing it as the primary source. Open licensing does not establish coverage or service reliability.
- Evaluate a capped official commercial free tier only if open coverage is insufficient. Tripadvisor advertises 5,000 free calls monthly with a credit card, but display/ranking/integration restrictions require review. Google Places requires a separate map/display-policy review. Neither is approved by this plan.
- Store provider business ID, name, address, coordinates, rating scale, rating, review count, source link and retrieval time. Store provider update time only when supplied. Retain/cache fields only as permitted by that provider.
- Match branches by provider identity, coordinates and address. Reject ambiguous matches. Missing ratings remain null, never zero or an invented score.
- Retrieve ratings for a small route-relevant shortlist when requested; do not search on every GPS fix. Use a server-side atomic usage cap, request deduplication and provider-specific cache policy. Fail closed when a free budget is exhausted.
- Describe data as “last checked,” not “updated now.” A newly fetched rating can still reflect old reviews.

## Phase 3: useful recommendations

Filter candidates by driving-time/detour constraints and food preferences, then rank using rating evidence, review volume and route cost. Do not compare different providers' scales blindly or label unrated places “best.” Explain each recommendation using the actual evidence, for example rating/count plus estimated added driving time. Opening status needs a separate verified field.

## Acceptance tests

Test wrong-branch rejection, missing ratings, low review counts, expired evidence, provider timeout, quota exhaustion, concurrent budget checks, citation attribution, stale searches and pin/road mismatch. Test full UI flow from address selection to restaurant discovery, rating display and adding a stop. Record live-provider coverage separately from mocked contract tests. Use the existing delivery audit for the remaining navigation and voice acceptance gates.

## Sources

- Mappls developer entry point and free-start claim: https://developer.mappls.com/
- Mappls autosuggest: https://developer.mappls.com/mapping/autosuggest-api/
- Mappls web SDK and license-key requirement: https://developer.mappls.com/documentation/sdk/mappls-web-maps/readme/
- Google search availability: https://developers.google.com/custom-search/v1/overview
- Google Places display and caching policy: https://developers.google.com/maps/documentation/places/web-service/policies
- Mangrove reuse terms: https://mangrove.reviews/terms
- Tripadvisor free allowance and billing: https://www.tripadvisor.com/business/solutions/hotels/content-api
- Tripadvisor integration terms: https://tripadvisor-content-api.readme.io/reference/api-master-terms-new
