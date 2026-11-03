# Marga: daily-driver readiness and project gap audit

Audit date: 25 September 2026. Scope: current local AMappy working tree, India-first web product. The original findings are preserved below; the implementation ledger records work completed after the baseline audit.

## Verdict

**No. A customer cannot currently rely on Marga as a fully functional daily navigation replacement for Google Maps.** It is a working development prototype with real coordinate routing, map rendering, GPS hooks, provider adapters, and tested helper functions. Its complete driving session, live information, voice companion, and production operations are unfinished.

**MapmyIndia/Mappls is partially integrated for addresses. It has not replaced the map, routing engine, or traffic system.** Adding a Mappls key alone will not close the remaining navigation and product gaps.

Use the current product for supervised development evaluation. A controlled customer pilot needs the blockers below resolved and an explicit supported-device/area acceptance record. Nationwide daily-driver claims need substantially broader evidence.

## Implementation ledger — 25 September 2026

The product is materially safer and more functional than the baseline audited below, but the verdict remains **not ready to replace Google Maps as an unsupervised daily driver**. Code checks and live provider probes cannot replace road, device, address-accuracy, accessibility, load, privacy and production-operations acceptance.

| Finding | Current status | Evidence or remaining gate |
| --- | --- | --- |
| D01–D02 | Implemented | Route, search, resolve, reverse and GPS selections use abort controllers plus per-endpoint/request revisions. Stale work cannot commit after edit, clear or a newer choice. Deliberately delayed browser-network acceptance is still desirable. |
| D03 | Implemented and tested | Sparse GPS samples advance a passed maneuver using projected route progress. Unit coverage passes. Complex loop/parallel-road field cases remain in the pilot matrix. |
| D04 | Implemented | GPS errors clear the active watcher before allowing retry; unmount clears GPS, recognition and requests. Physical-browser recovery remains a field test. |
| D05 | Partially implemented | Roundabout, fork, merge, ramp, arrival and turn semantics, road-distance progress, maneuver suppression, reroute cooldown and route-preserving reroute failure are implemented. Lane guidance, entrance quality and service-road/parallel-road field proof remain. |
| D06 | Implemented and tested | `/api/ask` discards caller evidence, fetches server-owned context, enforces confidence/freshness, HTTPS sources, body bounds and a model timeout. A forged-evidence contract test passes. |
| D07 | Implemented and browser-tested | A validated versioned snapshot restores endpoints, geometry, steps, summary, traffic state and session without silently restarting GPS. Corrupt state is rejected and storage calls are guarded. Refresh restored a live Mappls route in the browser. |
| D08 | Partially implemented and browser-tested | Recoverable tile errors no longer hide the whole map; WebGL loss/restoration, responsive padding, truthful fallback copy and retry exist. Map load and refresh passed locally; device/WebGL fault injection remains. |
| D09 | Partially accepted live | The supplied key is server-only in ignored `.env.local`. The expanded 42-place baseline passes 35 cases with 135 ms median provider-call latency, including all tested lanes, villages, apartment complexes and Port Blair. Five regional-script/account cases, an ambiguous landmark and one inaccurate full address remain failed. Long addresses use Geocoding rather than truncation; provider errors are classified; exact-pin versus routed-endpoint distance is measured and the UI warns above 75 m. The 95% gate, quota/terms and production restrictions remain. |
| D10 | Open | Geographic validation is still a coarse India bounding box. A service-area polygon and border/island/no-road acceptance are not implemented. |
| D11–D12 | Partially implemented | Poor/stale fixes are not accepted as endpoints; remaining route distance, duration and ETA update with progress. A stopped-update watchdog, long-route profiling and robust loop/parallel-road matching remain. |
| D13 | Partially implemented | Mappls `route_eta` now supplies traffic-adjusted route time and falls back explicitly to non-traffic OSRM. The supplied account returned unauthorized for Mappls live-traffic incidents; accidents, closures and construction remain unavailable and are shown as such. |
| D14–D15 | Implemented, audio acceptance open | Only attention-approved candidates speak; encountered and announced records differ; companion speech cannot interrupt active guidance; repeated microphone clicks stop the same recognizer. Real microphone/speaker/device tests remain. |
| D16 | Partially implemented | Unknown heading is no longer treated as north. Full route-corridor, side-of-road and detour-aware relevance remains open. |
| D17–D18 | Open | No authorized, structured free restaurant-rating source with adequate India coverage has been verified. Ratings are not scraped or invented. Detour budgets, matrices and via-stop routing remain. |
| D19–D20 | Partially implemented | Wikipedia descriptions now provide cited facts; upstream HTTP status, schema paths and timeouts are checked. Dedicated culture/event/scenic feeds, side-of-road identification, official warnings and stronger observation-age validation remain. |
| D21 | Implemented | Context requests are aborted and ordered; stale locations cannot overwrite the latest context. Optional providers have bounded deadlines. |
| D22 | Open | Conversation answers grounded questions but cannot yet apply reviewed route/stop commands or maintain multilingual itinerary intent. |
| D23 | Partially implemented and tested | History, food, architecture, nature, culture, photography, shopping, sports and local-events interests exist and affect ranking. Diet/cuisine and accessibility preferences remain. |
| D24–D26 | Partially implemented | Journey export/delete, active-trip restore and responsive map framing exist. A journey library, photos, reliable stops, offline/background operation and full keyboard/screen-reader/mobile-road acceptance remain. |
| D27 | Partially implemented and tested | All public APIs have per-instance limits; ask bodies and summaries are bounded. Multi-instance production needs a durable shared counter/budget. |
| D28 | Partially implemented | Provider calls have deadlines and response validation; route fallback is explicit. Capacity contracts, bounded retry policy and comprehensive 429/schema-drift tests remain. |
| D29 | Partially implemented | Route/context caches are private, journals can be exported/deleted, and the UI explains coordinate sharing and browser storage. Deployment logging/retention and shared-device acceptance remain. |
| D30 | Partially implemented | CI runs install, typecheck, lint, deterministic tests and build. Production monitoring, rollback/runbook and deployment smoke automation remain. |

Verification completed after implementation:

- **36/36 deterministic tests passed** across navigation, attention, grounding, journey, location, trip restore, Mappls adapters, ask/route APIs and API limiting.
- TypeScript, ESLint and the production build passed. The build reports only a non-blocking client chunk-size warning.
- **18/18 live India provider checks passed:** six Mappls searches, six Mappls Pin resolutions and six regional route checks.
- Browser acceptance passed for Mappls destination search, traffic-ETA route creation, map rendering, refresh restoration with a nonzero next maneuver, and a server-grounded weather answer. The browser console contained no application errors.
- Live moving GPS, microphone/audio, screen lock/background behavior and road safety were not testable on this workstation and remain release gates.

The baseline sections below explain why each item was raised. Where wording conflicts with this ledger—for example, the earlier statement that routing still used only OSRM—the ledger reflects the current implementation.

## Audit method and evidence limits

- Reviewed the application page, all six API handlers, navigation/attention/grounding/journey/location/Mappls helpers, tests, provider smoke script, package configuration, layout, hosting configuration, authentication helper, database schema, and existing planning documents. Shared UI components were inventoried; this is not a line-by-line certification of every bundled component or dependency.
- Re-ran all seven existing test files: **23 tests passed**. The initial sandbox run failed to spawn Node workers; the permitted rerun passed. This was an execution-permission issue, not seven assertion failures.
- Ran two extra local diagnostic probes: passed-maneuver progression and acceptance of invented caller-supplied evidence. Both confirmed gaps described below.
- Browser checks, lint, typecheck, build, and six regional routing smoke passes reported in the preceding implementation session are **historical evidence**, not rerun results from this audit. The historical GPS browser check timed out; it did not establish real movement tracking.
- No live Mappls account/credential validation, new nationwide provider test, deployment inspection, phone road test, background/locked-screen test, microphone/audio test, load test, or security penetration test was performed in this audit. Production secret settings were not inspected. No private key or home address was needed.
- Static findings identify concrete code paths and expected failure triggers. They are labelled separately from runtime reproduction. Absence of a feature means no implementation was found in the inspected product paths, not proof that a hosting platform lacks it.

## What Mappls actually supplies today

| Layer | Current implementation | Readiness implication |
| --- | --- | --- |
| Typed search | `app/api/search/route.ts`: Mappls autosuggest, first five deduplicated results, optional location bias | Requires `MAPPLS_REST_KEY`; no configured key returns 503. Queries are silently cut to 45 characters. |
| Selected address coordinates | `app/api/resolve/route.ts`: Mappls place-details request; `lib/mappls.ts`: coordinate parser | Requires actual coordinate-bearing responses. Mock tests prove only the payload shapes we supplied. |
| Pin/GPS labels | `app/api/reverse/route.ts`: Mappls reverse geocoding | Coordinates remain exact user selections; reverse failure silently leaves a fallback label. |
| Visible map | `app/page.tsx`: MapLibre + OpenFreeMap | Not a Mappls basemap. |
| Routes and maneuvers | `app/api/route/route.ts`: public OSRM driving endpoint | Not Mappls routing, traffic-aware routing, or a Mappls navigation SDK. |
| Nearby restaurants and local news area | `app/api/context/route.ts`: Overpass and Photon; Photon reverse lookup for news locality | Photon remains in context discovery despite typed search migrating to Mappls. |
| Traffic/incidents | Context API explicitly returns `traffic: false`, `incidents: false` | No Mappls traffic or incident integration. `TOMTOM_API_KEY` is declared but unused by these handlers. |

Mappls documents latitude/longitude in Place Details as a premium offering. Live account entitlement, response shape, authentication, quota, allowed caching, attribution, and compatibility with the current renderer/router remain to be verified. This audit does not establish a free production allowance. [Official Place Details documentation](https://developer.mappls.com/documentation/sdk/rest-apis/mappls-maps-place-details-api-example/Readme/)

The previous session observed “Mappls is not configured.” Current deployment configuration is not reverified here. Describe this as **adapter code implemented; live integration acceptance outstanding**.

## Comparison with the Google Maps daily-driver expectation

This compares the customer experience of a daily navigation product, primarily Google Maps on a phone, with the current Marga web prototype. It is not a claim that Google Maps web has every mobile feature, nor that every Google feature works in every Indian location.

Google's documentation describes navigation, ETA/traffic/accident information, place reviews, and saved places. Its Android app also supports downloaded-area driving guidance, with limitations: offline traffic and alternative routes are unavailable. [Maps overview](https://support.google.com/maps/answer/144349?hl=en), [offline maps](https://support.google.com/maps/answer/6291838?hl=en-NL)

| Customer expectation | Marga today | Gap classification |
| --- | --- | --- |
| Enter an address and reach the correct entrance | Mappls adapter plus exact pins; no live address corpus proof or entrance verification | Partial; critical validation gap |
| Reliable turn-by-turn guidance | Simplified maneuvers and proximity-based step progression | Implemented foundation with correctness defects |
| Current traffic and incident-aware route changes | No traffic/incident feed; reroutes only on geometric off-route detection | Missing |
| Remaining distance/time and changing ETA | Initial route duration, distance, ETA shown; no continuous trip-summary update | Missing during travel |
| Route alternatives, avoid tolls/highways, add stops | One driving route between two endpoints | Missing |
| GPS recovery, app interruptions, longer journeys | Browser watcher; lifecycle and recovery defects; no field evidence | Not validated for daily use |
| Poor connectivity/offline guidance | No offline map package, route recovery, or service worker found | Missing |
| Restaurants with reliable ratings and opening hours | OSM/Photon candidates explicitly lack verified ratings/hours | Missing |
| Saved Home/Work, recent places, shareable trips | No implemented saved endpoint/route sharing flow | Missing |
| Other travel modes | Driving only | Deferred beyond current driving scope |
| Natural spoken questions and useful proactive guide | Browser speech APIs, keyword fallback, optional model; proactive speech not wired | Partial |
| Understand nearby history, culture, events, scenic detours | Mostly generic Wikipedia nearby titles, weather, restaurant names and news headlines | Substantial original-vision gap |
| Personalized journey journal | One locally stored sampled journey with events and JSON export | Partial; photos/stops/history absent |

## Priority definitions

- **P0:** blocks a trustworthy driving pilot or the promised evidence-grounded behavior.
- **P1:** needed for a dependable customer deliverable and the agreed core experience.
- **P2:** later breadth/polish or intentionally deferred scope; not a reason to delay every limited pilot.

## P0: correctness and trust blockers

### D01 — Old route responses can restore an invalid route

**Static finding.** `app/page.tsx: clearPlannedRoute`, `calculateRoute`, input change/clear handlers.

Editing an endpoint clears the visible route but does not abort or invalidate the current route request. `calculateRoute` does not check request identity before committing returned geometry/steps. A slow old response can restore a route after an endpoint was edited, cleared, or replaced by a pin.

**Required:** invalidate pending route work when endpoints change; accept results only for the current endpoint revision. **Test:** delay route A, choose B or clear destination, release A; A must never become active.

### D02 — Search, resolve, reverse-label, and GPS selection lack shared ordering

**Static finding.** `app/page.tsx: scheduleSearch`, `pickResult`, `reverseExactEndpoint`, `selectCurrentLocation`, field clear handlers, unmount cleanup.

Typing/clearing does not cancel outstanding place resolution or reverse labels. Clearing does not cancel every pending search timer/request. Pin selection does not cancel an old text search. A GPS callback can overwrite a newer manual choice. A shared endpoint controller also means selecting destination cancels the origin's pending label. `endpointRequest` is not aborted at unmount.

**Required:** per-endpoint selection revisions and cancellation for every input source; retain coordinates independently of label completion. **Test:** deliberately reorder search, resolve, reverse, GPS, clear, pin, and unmount events; newest user selection always wins.

### D03 — Step progression can remain stuck behind the driver

**Runtime reproduced at helper level.** `lib/navigation.ts: updateSession` advances only when a sample is within 35 m of the current maneuver location. It does not advance based on having passed that maneuver along the route.

Probe: route `[77,28] → [77.01,28] → [77.02,28]`, current step index 1, next position `[77.012,28]`. Progress becomes about 1,178 m, but step index stays 1 although the sample is beyond the step. Sparse samples can leave instructions pointing backward indefinitely.

**Required:** tie maneuvers to route progress with direction/loop handling. **Test:** samples skip the 35 m circle, closely spaced turns, loops and a mid-route navigation start all advance correctly.

### D04 — GPS error handling can orphan a live watcher

**Static finding.** `app/page.tsx: startLiveDrive` error callback sets `watchRef.current = null` without first calling `clearWatch`. A watch may continue after a recoverable error; its ID is lost, so stop/unmount cannot reliably clear it and retry can create a second watcher.

Callbacks also retain render-time values used by `handlePosition`, such as interests, voice settings and maneuver distance. Current route refs solve only part of the stale-state problem.

**Required:** explicit watcher lifecycle and current navigation/preferences state. **Test:** transient timeout → retry → recovered fix → stop/unmount; at most one active watcher and no updates after stop.

### D05 — Maneuver semantics, arrival and rerouting are too weak

**Static finding.** `app/page.tsx: calculateRoute`, `handlePosition`; `lib/navigation.ts`.

- OSRM maneuver types other than `turn` and `arrive` become generic “Continue”; roundabout exit numbers, exits, forks and lane information are not translated into reliable instructions.
- Guidance distance is straight-line distance to a maneuver, not remaining road distance.
- Arrival uses a 45 m circle around the requested point, without road progress or reachable entrance checks. A parallel road can appear arrived; an off-road house pin may never be reached by the routed road.
- Rerouting has an in-flight lock but no cooldown/backoff; failed reroutes discard the current route. Preview also calls the reroute-capable position handler.
- `shouldAnnounceManeuver` has tests but is not used by the actual page announcement path.

**Required:** maneuver adapter, route-distance progression, snapped-endpoint separation, destination access/arrival rules, resilient reroute lifecycle. **Test:** roundabout, flyover/service road, unreachable entrance, missed turn, noisy GPS and failed reroute.

### D06 — Evidence grounding trusts the requesting client

**Runtime reproduced at helper level; API trust path confirmed in source.** `app/api/ask/route.ts`, `lib/grounding.ts`.

The API accepts the client's evidence summaries, URLs, confidence and expiry after shallow shape checks. A probe supplying a fabricated weather summary with future expiry and confidence 1 receives that summary and fake citation as a `grounded-fallback` answer. The model path additionally lacks the fallback's enforced freshness/confidence filter; sources are the first three input items rather than evidence tied to actual claims. The page's network-error fallback also bypasses freshness checks.

**Required:** server-owned evidence lookup, consistent freshness/confidence rules, bounded payloads and claim-supported citations across every answer path. **Test:** forged/expired evidence, irrelevant citations, hostile source text, malformed bodies and model outage cannot produce purportedly verified claims.

### D07 — Refresh and interruption do not restore a coherent trip

**Static finding.** `app/page.tsx: restore effect`, default endpoint state, `persistJourney`.

Only session metadata, preferences and one journal are restored. Selected endpoints, geometry, steps and matching route version are not restored together; a refresh returns to Delhi defaults. Syntactically valid but malformed local JSON is accepted. Storage reads/writes can throw and interrupt the driving path.

**Required:** validated versioned trip snapshot, recoverable storage failure and explicit resume. **Test:** refresh a non-Delhi trip, corrupt stored shapes, full/unavailable storage, browser termination and resume; no silent GPS restart or Delhi substitution.

### D08 — Map errors can hide a usable map behind an unrelated Delhi image

**Static finding; intermittent failure requires fresh browser reproduction.** `app/page.tsx: map initialization/error/idle handlers`; `app/globals.css: .map-fallback`.

Any map error marks the entire map failed. The fallback is a bundled Delhi SVG, not a saved map of the current journey, despite the message “Saved map remains visible.” Its error overlay can intercept map clicks. WebGL initialization/context-loss recovery is not handled explicitly. Fixed left fit padding of 410 px is unsuitable for narrow phone viewports.

**Required:** separate recoverable tile errors from fatal map errors, truthful fallback, retry deadline and responsive framing. **Test:** isolated tile failure, style failure, WebGL loss, repeated refresh and small screens during an active route.

## P1: core product and operational gaps

| ID | Finding and source | Required outcome and acceptance test |
| --- | --- | --- |
| D09 | **Live Mappls acceptance open.** Search/resolve/reverse APIs and `lib/mappls.ts` have mocked contracts only. Missing coordinates always produce a claim about the account plan, although empty results or schema changes can also cause this. | Verify real account responses, attribution and usage rights; distinguish auth/quota/no-result/schema/entitlement errors. Run at least 30 consented/public addresses across houses, lanes, apartments, villages and Indian scripts. No private homes in committed fixtures. |
| D10 | **India checks are bounding boxes.** API handlers accept the 68–98 longitude / 6–38 latitude rectangle; this includes sea and neighboring areas and does not prove India-only coverage. | Validate serviceable geography and road access. Test border areas, islands, rural addresses, out-of-area coordinates and no-road cases. |
| D11 | **GPS endpoint quality is weak.** `selectCurrentLocation` accepts cached fixes based on age alone and one-shot fixes even when classified poor/stale. `locateMe` can recenter indefinitely on an old fix. There is no silence watchdog when updates stop. | Show accuracy and stale state persistently; require suitable fix or explicit uncertain selection; monitor freshness without waiting for another callback. Test stale/poor/null-heading fixes and long gaps. |
| D12 | **ETA and remaining distance are static.** `setRouteSummary` runs on calculation, not trip progress. `matchRoute` searches every segment on every update with no direction/history constraints, risking wrong branch matches and long-route cost. | Update remaining road distance/time; make matching robust to loops/parallel roads; profile long trips. Verify ETA changes and no sudden progress jumps. |
| D13 | **Traffic, accidents, closures and construction missing.** Context availability hardcodes traffic/incidents false; routing does not consume live conditions. | Integrate an authorized provider and route-relevant incident evidence with expiry, confidence and route consequences. Feed outages must remain explicit. |
| D14 | **Proactive companion speech not connected.** `refreshContext` selects a candidate and updates text/journal but never calls `speak`. `selected ?? candidates[0]` displays/logs candidates even when the gate rejects all. IDs are marked mentioned before speech occurs. | Connect eligible candidates to a speech scheduler; distinguish display, encountered and actually spoken records. Test silence at a maneuver, later delivery, cooldown and real audible completion. |
| D15 | **Speech priority can be inverted.** `speak` unconditionally cancels current speech for every accepted new utterance; a companion request can interrupt a still-playing navigation instruction. The mic “Stop listening” action creates another recognition instance instead of stopping the existing one. | Retain/cancel recognition correctly and prioritize guidance with one shared speech owner. Test simultaneous question, turn prompt, repeated mic clicks, permission denial and unavailable voices. |
| D16 | **Along-route awareness is mostly nearby-radius awareness.** Context uses 10 km searches; attention uses a heading half-plane, not route corridor, arrival time or detour. Missing heading becomes north. Several declared categories have no producer. | Route corridor and direction-aware relevance; verify a nearby place behind a river/parallel road is not called an easy stop ahead. |
| D17 | **Food recommendations lack ratings and usefulness ranking.** OSM/Photon entries have no verified score/count/hours. Photon fallback is not distance bounded. The fallback answer takes the first food item. | Authorized rating source with exact branch matching, fetched time and review count; explicit unrated state; rank by route time and preferences. Test wrong branch, stale scores, unknown hours and unhelpful detours. |
| D18 | **20-minute meals / scenic stops within 10 extra minutes missing.** No travel-time matrix, detour budget, via-stop editing or multi-stop route support. | Compute road-time detours and add/skip a stop while preserving final destination. Test reachable versus straight-line-near candidates and reroute after stop changes. |
| D19 | **Local-guide content incomplete.** Wikipedia geosearch titles become generic “notable place” text, without historical facts. Culture/workshops/festivals/scenic businesses lack dedicated evidence. Building-on-right identification is explicitly declined. | Fetch supported descriptions and classify POIs; resolve a building with sufficient spatial evidence or ask for selection. Test factual claims against cited passages and correct side of road. |
| D20 | **News/weather confidence is not source validation.** Headlines and static confidence values are used; weather expires from fetch time, not validated observation age. HTTP response success/schema checks are inconsistent. | Validate timestamps, provider payloads and geographic relevance; distinguish current conditions from official warnings. Test stale upstream observations and irrelevant place-name matches. |
| D21 | **Context requests can overlap and overwrite new context.** No cancellation/order guard; last refresh timestamp updates only after completion. Route refresh/repeated GPS callbacks can start more work while slow sources hang. | Per-trip/request ordering, bounded concurrency and deadlines; retain usable navigation while optional providers fail. Test delayed responses from the previous location/trip. |
| D22 | **Conversation is not yet an action-capable guide.** Questions are answered with supplied snippets; there is no conversational itinerary state or route/stop command execution. Browser recognition language does not translate English content or keyword routing. | Supported multilingual intents and follow-up context, with reviewable endpoint/stop changes. Test “take me there”, Hindi questions and ambiguous destinations. |
| D23 | **Original personalization incomplete.** Five interests, talkativeness and speech locale exist; diet/cuisine, accessibility, photography, shopping, sports and event controls are absent. | Complete the agreed preference set and demonstrate ranking changes; apply preference changes during a live session. |
| D24 | **Journal is one local record, not the requested travel journal.** No photo attachment, journey library, reliable actual-stop detection, full replay or personal summary generation. Demo and live samples can share a record; initial live sample may be the planned origin. | Separate previews from real trips, record real stops/photos, preserve multiple journeys and handle export/deletion. Test switching demo/live and storage limits. |
| D25 | **Web lifecycle/offline support missing.** No service worker/offline packages, wake-lock handling, background-resume state machine or phone interruption evidence. | Declare supported foreground behavior, handle visibility/network transitions and preserve the active trip. Phone tests for screen lock, calls, app switching, GPS/network loss and long sessions. Native-level background guarantees remain an Android-stage decision. |
| D26 | **Driving UI/accessibility incomplete.** Dense overlays compete with the map; result roles lack a complete combobox keyboard interaction; precision labels use provider type rather than a verified house-level classification. | Map-first driving mode, readable accuracy/precision/failure states, usable touch controls and keyboard/screen-reader tests across mobile sizes. |
| D27 | **APIs lack implemented cost/abuse controls.** Inspected route handlers have no application rate limits, atomic provider budget caps or authenticated usage policy. `/api/ask` parses body before limiting arrays and does not bound evidence strings. Existing auth helper is not called by these handlers. Hosting-level protection was not verified. | Enforce request/body limits and shared budgets appropriate to public/anonymous access; no need to require accounts merely to solve quotas. Test concurrent exhaustion and deliberate expensive requests. |
| D28 | **Provider resilience incomplete.** OSRM/context/model fetches lack consistent client timeouts and response validation; public services are used with no demonstrated capacity/SLA. | Timeouts, explicit degraded states, selective bounded retries and provider capacity plan. Exercise 429, 5xx, timeout, invalid JSON and schema drift. |
| D29 | **Location privacy and retention controls absent.** Precise coordinates go into API URLs and provider requests; journal coordinates remain in local storage. Route/context responses use public cache headers. No user-facing retention/deletion/disclosure flow found. | Document exact recipients and retention, audit coordinate logging/caching, provide delete/export controls and avoid unnecessary location storage. Verify behavior on shared devices and deployments. |
| D30 | **Release/operations proof missing.** No repository CI workflow found for the driving flows, production smoke/rollback runbook or provider-health monitoring. `db/schema.ts` is empty; auth/database scaffolding is not customer storage. | Versioned release checklist, continuous checks, client/API error visibility and production configuration verification. Treat the old public site separately from the current local build. |

## P2 and scope decisions

- Route alternatives, toll/highway/ferry avoidance, saved Home/Work, recent endpoints, coordinate entry and shareable routes remain unimplemented customer conveniences; prioritize those needed by pilot users.
- Walking, public transport, cycling, two-wheelers, EV charging, satellite imagery and street imagery are broader competitor features, not all prerequisites for the agreed driving-only web pilot.
- Android and car integration remain deferred. They should have separate acceptance criteria rather than being treated as solved by a responsive webpage.
- Account sync is optional for a local-first pilot; reliable local recovery, export and deletion are not optional substitutes for data-loss handling.
- Installed UI/dependency breadth is not the immediate blocker. Avoid a broad rewrite while repairing the actual driving flow.

## What the current tests do and do not establish

| Evidence | Actual meaning |
| --- | --- |
| 23 passing tests rerun today | Selected pure helper behaviors and two mocked Mappls API scenarios behave as asserted. |
| Mappls parser/API tests | Do not prove real provider authentication, account entitlements, coordinate schema, address correctness, reverse accuracy or billing limits. |
| Navigation helper tests | Do not exercise the React watcher lifecycle, sparse-sample passed maneuvers, instructions, audio scheduling or real roads. |
| `scripts/smoke-india.mjs` | Calls providers directly, bypassing app UI/API. Search only checks nonempty suggestions; route only checks a returned route. Missing Mappls key skips search and still allows successful exit. It does not automatically load `.env.local`. |
| Previous map refresh/4.7 km pin-route browser check | A useful single-flow observation, not repeated-refresh stability, destination click coverage, real GPS success or nationwide correctness. |
| Previous build/lint/typecheck passes | Compilation/static hygiene evidence, not customer acceptance. |

The test suite lacks persisted browser journeys, controlled request-ordering tests, GPS/audio integration harnesses, outage recovery, broad address fixtures, device matrix, load budgets and complete-trip release gates. **Do not equate a green suite with “everything tested.”**

## Implementation order and measurable exit gates

### Phase 1 — Restore trustworthy trip state

Fix D01–D08 and endpoint/GPS quality issues. Add targeted regression tests at the failing ownership layer, then one browser trip covering search/pin/GPS selection → route → follow → missed turn → reroute → arrival → refresh/resume. Every request-order permutation must preserve the latest choice; every watcher must stop cleanly; every maneuver passed must advance.

### Phase 2 — Validate India providers and address coverage

Configure and validate the actual Mappls account. Confirm coordinate access and compatible provider terms. Measure at least 30 public/consented addresses across multiple regions and precision types, followed by route-to-access-point checks. Report wrong matches and skipped tests explicitly. Pin fallback must always preserve requested coordinates and show road-snap distance.

### Phase 3 — Complete the promised guide

Wire proactive speech, priority, grounded answers, route-aware POIs, food preferences/ratings, detour constraints, stop actions and historical evidence. Close D13–D24 as relevant to the agreed deliverable. Prove every advertised example with sourced data; unavailable feeds remain clearly unavailable.

### Phase 4 — Customer pilot hardening

Address mobile lifecycle, privacy, request budgets, provider failure recovery, accessibility and release operations. A proposed minimum pilot matrix: supported Android/iOS browsers, short urban and at least one 60-minute journey, poor signal, screen lock/resume, sparse GPS, missed turns, refresh, microphone denial, provider outage and storage failure. Record device/browser, route, provider status, expected behavior and observed result. This is a pilot gate, not nationwide proof.

### Phase 5 — Broaden after measured pilot success

Expand region/road/device coverage, improve data sources and evaluate native Android continuity. Set availability, latency, battery, address accuracy and routing-quality targets from measured pilot results. Do not assign a completion percentage without this evidence.

## Corrections to earlier completion language

1. “MapmyIndia implemented” means address adapter code only; map rendering, routing and live road feeds have not migrated.
2. “All tests passed” describes the tests that exist. It does not establish a fully working daily driver or every newly added UI path.
3. Exact endpoint selection exists, but delayed requests and poor GPS can still corrupt the intended selection experience.
4. Grounding rules exist, but evidence provenance is not authenticated by the server and enforcement differs across answer paths.
5. The relevance selector exists, but the automatic spoken companion promised in the original concept is not fully connected.

This audit creates a new readiness record alongside `DELIVERY_GAPS.md` and `ADDRESS_AND_RATINGS_PLAN.md`. It changes no application behavior and claims no fixes or deployment.
