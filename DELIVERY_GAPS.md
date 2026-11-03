# Marga: customer prototype delivery audit

Audit date: 20 September 2026. Baseline: local commit `fa38646`.

## Verdict

**The current build is an integrated development prototype, not a complete customer-deliverable road companion.** There are working provider calls and domain helpers, but essential connections between location, route state, map rendering, audio, and journey history remain incomplete. The earlier build/test results did not establish end-to-end readiness.

This report began as a source-code audit and now also records implementation evidence. Product fixes remain local; no deployment is implied.

## Verified implementation progress

Completed locally on 20 September 2026:

- **MAP-01 root cause fixed:** MapLibre's `.maplibregl-map { position: relative }` overrode the app container's less-specific absolute positioning. After the loading overlay disappeared, the map element had zero height. The app now uses `.app-shell > .map`, retains explicit loading/error/retry UI, and passed five consecutive browser reloads with a 1280×720 map and canvas each time.
- **PLAN-01 / PLAN-02 foundation:** origin and destination are independently editable and selectable. Edits invalidate old coordinates; search is debounced, cancellable, response-ordered, and country-filtered to India. A Mumbai route from Gateway of India to Chhatrapati Shivaji Maharaj Terminus passed through the UI with matching labels, markers, geometry, 2.7 km distance, and maneuver steps.
- **ROUTE-01 fixed:** route failure clears guidance and reports the failure. It never substitutes Delhi geometry or instructions.
- **GPS-01 / GPS-02 / GPS-03 foundation:** live marker, accuracy circle, heading, follow/recenter, current route refs, live/demo exclusion, fix age/accuracy gates, and distinct permission/timeout/unavailable states are implemented. Automated GPS-state tests pass. Physical phone movement, browser permission prompts, and rerouting on real roads remain field-test requirements.
- **NAV-02 / NAV-03 partial:** obsolete route requests are cancelled, reroutes are locked, and live arrival completes the trip. Remaining-distance ETA and real-drive proof remain open.
- **FACT-01 fixed:** the fallback no longer guesses Red Fort or any building identity without evidence.
- **Mobile visibility improved:** trip status is visible at the 390×844 viewport and the layout has no horizontal overflow.

Verification run: TypeScript, ESLint, production build, 18 deterministic tests, 12 representative India provider checks, valid/invalid local API checks, repeated map refresh, desktop route/preview/journal flow, grounded weather answer with source, preference persistence, and mobile layout all passed. Browser console errors: zero.

## What completion means

A customer can open the web app, understand its coverage, obtain their actual position or enter a start, choose a destination, follow a real route, receive timely instructions, recover from a missed turn, ask grounded questions, hear useful context without excessive interruption, make a constrained stop, and finish with an accurate journey journal.

Prove that entire experience on a declared Indian pilot area before expanding geographic claims. Search can remain broadly available across India, but “every location in India works” is not an acceptance criterion we can currently support. A map covering India is not proof of routing, GPS, information quality, or navigation quality.

Full discussed functionality stays in scope. A feed labelled unavailable is honest degradation, but does not count as implementation of that feature. Any narrower customer demonstration must explicitly disclose omitted features.

## P0: blockers to a usable trip

| ID | Evidence and failure | Required work | Acceptance proof |
| --- | --- | --- | --- |
| GPS-01 | **Implemented; field proof open.** Browser fixes now move a live marker with accuracy, heading, follow/recenter and status. | Validate the existing implementation on a real phone and tune accuracy thresholds. | Real phone movement changes marker and guidance; panning disables follow until recenter; stationary fixes do not simulate motion. |
| GPS-02 | **Implemented; field proof open.** The watcher reads current route refs; live and preview modes stop each other. | Replay a reroute and verify watcher cleanup on supported browsers. | After rerouting, subsequent GPS samples use only the new route; no simultaneous simulation and live updates. |
| GPS-03 | **Implemented; field proof open.** Fix age, accuracy, heading and true speed are handled; acquiring, active, poor, stale, denied, timeout and unavailable are distinct. | Exercise actual browser permission, timeout and recovery paths on target devices. | Permission denial, timeout, stale fixes, poor accuracy, stationary driver and recovery each behave correctly. Do not blame permissions without checking the error. |
| MAP-01 | **Fixed locally.** CSS specificity collapsed the MapLibre container to zero height after the fallback disappeared. Five repeated reloads now retained a 1280×720 map/canvas with no console error. | Add automated browser coverage for slow/failed tiles, resize and WebGL loss. | Repeated refreshes, slow/failed tiles, resizing and loss/recovery leave a usable map or explicit recovery UI. No silent blank map. |
| PLAN-01 | **Implemented and browser-tested.** Both fields are editable/selectable; exact dropped pins and GPS can set either endpoint. Mappls supplies typed search and reverse labels when configured; exact coordinates remain the route input. | Add live Mappls credentials with place-detail coordinate entitlement, compare the address corpus, and complete real-device GPS selection proof. | Plan a non-Delhi trip entirely through Mappls, dropped pins, and GPS. Labels never replace the exact selected coordinate. |
| PLAN-02 | **Implemented and browser-tested.** Edits invalidate coordinates; search is debounced, cancelled and response-ordered. | Add deterministic delayed-response browser coverage. | Fast typing, clearing, unselected text and slow responses cannot route to an old destination. |
| ROUTE-01 | **Implemented.** A failed route clears guidance and never installs Delhi fallback geometry. | Add a deterministic provider-outage integration test. | Provider timeout/no-route outside Delhi displays failure and no Delhi guidance. |
| NAV-01 | `lib/navigation.ts` advances a step only within 35 m of its location. Sparse samples can skip that radius; distances are straight-line rather than remaining road distance. OSRM maneuver types are reduced to basic Turn/Continue text. | Advance by route progress with topology-aware matching; handle missed samples, loops, roundabouts, forks, exits and arrival. | Realistic trace replay passes each maneuver without becoming stuck; instructions match route geometry. |
| NAV-02 | **Partially implemented.** Reroutes have an in-flight lock, route requests cancel obsolete requests, and poor/stale GPS fixes are rejected. A cooldown and realistic trace proof remain. | Add cooldown/quality checks and trace replay while preserving destination. | One missed turn creates one accepted new route; GPS noise does not create a request storm. |
| STATE-01 | Only session metadata is restored. Geometry, route steps, selected endpoints and route version are not restored coherently; page defaults return to Delhi. | Persist a versioned trip snapshot; validate it; offer resume without silently starting GPS. | Refresh a non-Delhi route and resume the same destination, geometry and progress. Corrupt/old storage recovers cleanly. |
| NAV-03 | **Partially implemented.** Live arrival within 45 m ends guidance and completes the journal. ETA/distance remain route totals. | Remaining distance/time, explicit stop/end trip and audio cleanup. | Real arrival ends active navigation and produces one completed journal. |

## P0: grounding and voice correctness

| ID | Evidence and failure | Required work | Acceptance proof |
| --- | --- | --- | --- |
| FACT-01 | **Fixed and browser-tested.** The fallback says it lacks verified information and does not identify a building from location alone. | Keep this behavior covered while adding spatial identification. | The same question in another city or during an outage never identifies Red Fort without evidence. |
| FACT-02 | `/api/ask` trusts evidence supplied by the client. Model path does not enforce fallback freshness/confidence filters; sources are simply the first three candidates. Input is cast rather than validated. | Server-resolved evidence IDs, schema/size validation, shared freshness rules, source-to-claim mapping and untrusted-content handling. | Forged, expired, malformed and irrelevant evidence cannot generate verified claims; citations support the actual answer. |
| VOICE-01 | `refreshContext` updates a card but does not automatically speak selected context. `selected ?? candidates[0]` bypasses rejection for display and journal; items are marked mentioned before speech. | One announcement scheduler for selection, audio and journal. Respect silence; mark spoken only after successful delivery. | A eligible landmark speaks at the right moment; a rejected or interrupted item is neither falsely marked spoken nor repeatedly announced. |
| VOICE-02 | Every `speak()` call cancels existing speech. Companion output can interrupt guidance whenever the distance guard allows it. | Explicit audio priority/queue, interruption handling, mute/stop and observable speech state. | Companion responses never cancel active maneuver instructions; muted/suppressed output is not recorded as spoken. |
| VOICE-03 | Microphone toggle creates a new recognition instance; “Stop listening” has no retained instance to stop. Language choice changes a locale, not answer translation or installed voice availability. | Recognition lifecycle, permission/error states, stop/cancel, text fallback, tested voice/language support. | Start/stop works repeatedly; unsupported languages are disclosed; selected supported language produces understandable output. |

## P1: deliver the companion we discussed

| Function | Current gap | Completion requirement |
| --- | --- | --- |
| Along-route awareness | `/api/context` accepts only one point. Attention uses constant heading 35 degrees and nominal speed 11 m/s. Ahead-by-bearing is not ahead-on-route. | Query a route corridor, attach route version and along-route distance/ETA; use actual or route-derived heading, road relevance and maneuver workload. |
| Historical/local knowledge | Wikipedia geosearch supplies titles/coordinates, not historical facts. Districts and stations are all labelled notable landmarks. | Fetch and curate reliable descriptions, classify places, deduplicate, preserve supporting sources and distinguish fact from suggestion. |
| Building on my right | No field-of-view, heading-based identification or ambiguity resolution. | Spatial candidates with side-of-road reasoning and explicit uncertainty; no claim of visual recognition without camera input. |
| Useful food stop | Nearby food lookup does not implement a 20-minute reachability constraint, detour cost, dietary preferences or verified popularity. Photon fallback is not distance-bounded. | Candidate road-time calculation, preference filtering and add-stop routing; only claim ratings/open hours when sourced. |
| Scenic stop under 10 minutes extra | No scenic discovery, via-point routing or comparison with original route time. | Calculate original versus via-stop duration; show added travel time separately from visit duration and let user add the stop. |
| Traffic, accidents, closures, construction | No implemented provider; availability is hardcoded false. A TOMTOM environment variable alone does not provide integration. | Select and validate a feed for the pilot area; road/direction matching, observation time, expiry, safe announcement and traffic-aware route comparison. |
| Weather and warnings | Current weather exists; official warnings and along-route forecast do not. Expiry is based on fetch time rather than validating observation age. | Validate observation time/units, forecast location/time and separate authoritative warnings from ordinary rain/wind readings. |
| Events, festivals, local businesses | Events unavailable; businesses and cultural/scenic categories have no substantive discovery implementation. | Pilot-area sources with event time, venue, cancellation status, freshness and route relevance; curated content is acceptable when truthfully maintained. |
| Local news | GDELT headlines are passed through with fixed confidence, without robust location, publication-age or incident verification. | Relevance/source screening and deduplication; headlines must not become verified road incident alerts. |
| Conversation | Keyword fallback returns first matching item; unknown questions default to landmarks. No multi-turn context or route-changing tools. | Intent handling for every example request, clarification, bounded conversation context and deterministic route/stop tools. Preserve constraints across follow-ups. |
| Personalization | Five interests exist; photography, shopping, sports and events controls are absent. Food preferences and accessibility needs are absent. | Persist complete agreed interests and relevant stop preferences; verify that changing preferences changes ranking. |
| Journal | One local record is overwritten on a new trip. No history list, photos, confirmed-stop flow or deletion. Context fetches count as encounters; completed trips can still receive events/samples. | Trip lifecycle, history, confirmed visits versus passed places, photo attachment with consent, accurate route/facts/events, export and deletion. |

## P1: delivery infrastructure and usable web experience

- Add request deadlines, bounded retries, caching, in-flight deduplication and partial results. Context currently waits for several providers; movement can launch repeated requests while a previous fetch is pending.
- Validate all external payloads and API inputs. Add rate limits and model spending limits before exposing paid credentials. Handle invalid JSON with a client error rather than an unhandled failure.
- India bounding-box checks include neighboring countries and exclude some Indian territory. Use country-aware place filtering and a documented routing coverage policy. Do not describe a rectangle as a national boundary.
- Keep the map visible during active guidance. Separate planning/settings from the driving screen; mobile currently hides interests and requires scrolling through a crowded panel for controls. Expose GPS/source failures on mobile, where the status pill is hidden.
- Add keyboard-accessible search, labelled result selection, readable loading/errors, touch targets and screen-reader checks.
- Document location/voice/model data flows, local retention and deletion. Add storage quota/corruption handling. Cloud accounts/sync are optional for this prototype; reliable local history is sufficient.
- Establish supported foreground browser/device behavior, HTTPS access, network-loss recovery and a deployment smoke test. Investigate installability/wake-lock support after core navigation works; do not promise background or locked-screen tracking without device tests. Full offline maps can remain a later milestone unless included in the customer contract.
- Record provider usage terms, attribution, pilot limits and actual operating cost. Free software does not establish free hosting, commercial data rights or feed availability. Provider selection/licensing needs a separate current-source review; this audit makes no claim that a particular free feed is sufficient.

## What previous tests actually proved

The previously reported 15 domain tests exercised helper functions. The 12 India smoke checks call Photon/OSRM directly, outside the app API and UI. Search checks only establish that a result exists; route checks establish that a response contains a route. They do not establish correct destination selection, route suitability or nationwide quality.

`shouldAnnounceManeuver` is tested but not used by the page's actual announcement path. Browser spot checks covered individual interactions, not a sustained GPS-driven trip or all failure states. Build/lint success is not proof of semantic correctness. Add an explicit `tsc --noEmit` gate; the current build script does not itself demonstrate TypeScript type-check completion.

No new passing test results are claimed by this audit. Real-device GPS, repeated-refresh map stability, microphone audio, long trips, provider outages and traffic-aware rerouting remain unverified.

## Ordered implementation plan

1. **Trip foundation:** reproduce map failure; fix rendering recovery, actual GPS, editable endpoints, route failure behavior and demo isolation. Exit: plan and follow one non-Delhi route with a live marker.
2. **Navigation reliability:** current-state watch callbacks, maneuver progress, request cancellation, reroute locking, remaining ETA, live arrival and snapshot restore. Exit: replay and real-device trip both survive missed turns and refresh.
3. **Grounded companion:** remove invented defaults, trusted evidence pipeline, route corridor, actual heading, audio scheduler and full question intent coverage. Exit: useful context speaks without overriding directions; unsupported questions remain honest.
4. **Stops and live context:** reachability/detour tools, preferences, pilot-area traffic/incidents/construction/events/news/weather sources. Exit: original example requests work with real sources and measured route impact.
5. **Journal and customer handoff:** history, confirmed stops/photos, privacy controls, mobile driving UX, request/cost limits and deployed integration tests. Exit: documented customer demo completed end to end with reproducible evidence.

For each phase: implement, run regression tests, replay traces, validate in browser, then update this file with evidence. Do not mark a phase complete based on isolated helper tests. No deployment is implied by this report.

## Required acceptance scenarios

- [ ] Fresh visit: consent flow, real fix, visible moving marker, correct heading/accuracy and recenter.
- [ ] Denied location: explanatory recovery and manually entered start/destination still work.
- [ ] Non-Delhi trip: both fields selectable; map, markers, route and context match those locations.
- [ ] Map refresh: repeated cold/warm loads and delayed/failed tiles produce map or visible recovery, never a silent blank screen.
- [ ] GPS replay: stationary jitter, sparse samples, passed turn, parallel road, loop, missed turn and arrival.
- [ ] Reroute: one accepted request, current position origin, original destination, no stale directions.
- [ ] Refresh/reconnect: same trip restored; network failure never silently selects the Delhi demo.
- [ ] Voice priority: turn guidance wins; pause/mute/stop work; repeats and rejected candidates stay quiet.
- [ ] Questions: building on right, interesting ahead, city history, food within 20 minutes, local happenings and scenic detour under 10 added minutes.
- [ ] Evidence: stale, fabricated, unrelated or unavailable sources cannot generate confident facts; citations match claims.
- [ ] Live feeds: verified pilot incident/event/weather examples and outages handled with accurate freshness/coverage.
- [ ] Journal: correct live arrival, route, discoveries, explicit stops, photos, history, export and deletion.
- [ ] Foreground mobile test: Android browser on a real phone plus desktop browser; microphone/location permissions, screen resizing and poor network covered.
- [ ] Customer demo: a full trip passes on the deployed build with recorded versions, device, source status, test outcome and remaining exclusions.

## Customer-ready evidence pack

Include a reproducible setup guide, environment/provider matrix, supported coverage and device list, tested routes, trace replay fixtures, automated test results, real-device observations, known limitations, data/privacy controls and a short full-trip demonstration. Release only when P0 items are closed and every promised function has evidence, or the customer has explicitly agreed to a narrower scope.
