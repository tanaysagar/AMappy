# Marga project story

This file explains Marga from idea to current build: what we set out to make, what exists now, how data moves through the code, what was tested, and what remains before it can be sold as a daily-driver navigation product.

## 1. Original idea

Goal was an AI road guide for India.

Normal navigation answers:

- How do I get there?
- What turn comes next?
- How long will it take?

Marga also tries to answer:

- What is around me?
- What is interesting along my route?
- What should I know right now?
- Can I ask the app like a local guide?

The product target was:

```text
Navigation + location awareness + real-time information + AI + voice
```

The user experience should feel like a knowledgeable local guide in the car. The map stays familiar and clean. Voice is primary for extra context, because driver attention matters more than dashboard noise.

## 2. Product scope chosen

We narrowed the first real build to:

- India first
- Web first
- Free-first services where possible
- Mappls for India addresses and traffic-aware route ETA when key exists
- Android later
- Daily-driver quality as long-term target

This was important because building a global Google Maps replacement from day one is too broad. India web gives one clear surface to prove the navigation loop, address handling, GPS, voice, and grounded local context.

## 3. Name

Working name is **Marga**.

Marga means path or way. It fits the product: not only a map, but a guide for the journey.

Trademark, domain, and app-store checks are still required before public launch.

## 4. Current tech stack

Core app:

- Next 16 / Vinext
- React 19
- TypeScript
- MapLibre GL JS
- CSS in `app/globals.css`
- Browser `localStorage`
- Browser Geolocation API
- Browser Speech Recognition API where supported
- Browser Speech Synthesis API

Provider layer:

- Mappls REST APIs for India search, reverse geocoding, pin resolution, and traffic ETA route when configured
- OSRM public route API as explicit non-traffic fallback
- OpenFreeMap vector map style
- Wikipedia API for nearby landmarks and facts
- Photon / OpenStreetMap for food, culture, parks, shopping, and sports venues
- Open-Meteo for current weather
- GDELT optional local news headlines
- OpenAI Responses API optionally, only after evidence is gathered

Testing and quality:

- Node built-in test runner
- `tsx` for TypeScript tests
- TypeScript compiler
- ESLint
- Production build
- Live provider smoke scripts
- Address audit script

## 5. Repository layout

Important files:

```text
app/page.tsx
  Main driving UI. Owns map, route planning, GPS, preview drive, live drive,
  voice, interests, question box, status, journey panel, and local persistence.

app/api/search/route.ts
  Typed India place search. Uses Mappls autosuggest, text search, and geocode.

app/api/resolve/route.ts
  Converts a selected Mappls pin into exact coordinates.

app/api/reverse/route.ts
  Turns an exact GPS or dropped-pin coordinate into a readable Mappls label.

app/api/route/route.ts
  Gets route geometry, ETA, steps, and routed endpoint. Tries Mappls first,
  falls back to OSRM without pretending traffic is available.

app/api/context/route.ts
  Collects nearby evidence: weather, landmarks, OSM places, and optional news.

app/api/ask/route.ts
  Answers driver questions from server-owned evidence. Optional model phrasing.

lib/mappls.ts
  Small parsers for Mappls payloads.

lib/navigation.ts
  Route matching, progress, maneuver text, reroute signal, and distance math.

lib/attention.ts
  Decides what is worth speaking.

lib/grounding.ts
  Deterministic evidence-only answers when no model is configured.

lib/journey.ts
  Local journey record, samples, events, completion, and summary.

lib/location.ts
  GPS quality classification and accuracy-circle sizing.

lib/trip-state.ts
  Validated active-trip restore format.

lib/rate-limit.ts
  Lightweight per-instance API rate limit.

tests/
  Deterministic tests for route math, attention, grounding, Mappls parsing,
  APIs, location quality, trip restore, journey records, and rate limits.
```

Planning and audit files:

```text
README.md
  Public project overview.

docs/project/ARCHITECTURE.md
  System architecture and target production shape.

docs/project/ROADMAP.md
  Phase plan.

docs/readiness/DELIVERY_GAPS.md
  Customer prototype gap audit.

docs/readiness/DAILY_DRIVER_READINESS_AUDIT.md
  Google Maps replacement readiness audit.

docs/driver-experience/ADDRESS_AND_RATINGS_PLAN.md
  Address quality and restaurant-rating plan.
```

## 6. App start flow

When the app opens:

1. `app/page.tsx` renders the map shell and route planner.
2. MapLibre loads an OpenFreeMap style.
3. Delhi defaults exist so the UI has a safe starting route for development.
4. Saved preferences load from `localStorage`.
5. Saved trip snapshot is parsed through `lib/trip-state.ts`.
6. If saved trip is valid, route geometry, endpoints, steps, ETA, and session restore.
7. If saved trip is corrupt or old, app ignores it instead of crashing.

Preferences stored locally:

- selected interests
- talkativeness
- voice on/off
- voice language

Journey stored locally:

- destination
- route samples
- discoveries
- spoken announcements
- arrival event

## 7. Planning a route

User can set start and destination in three ways:

- type address
- use GPS
- drop exact pin

Typed search:

1. User types into start or destination field.
2. `scheduleSearch()` debounces input.
3. `/api/search` calls Mappls.
4. Mappls results return display label and Mappls pin.
5. User chooses one result.
6. `/api/resolve` converts pin to coordinates.
7. UI stores coordinates separately from display label.

GPS endpoint:

1. Browser asks location permission.
2. App receives latitude, longitude, accuracy, heading, speed, timestamp.
3. `lib/location.ts` classifies fix as active, poor, or stale.
4. Good fix can become start or destination.
5. `/api/reverse` gets a human-readable label.

Dropped pin:

1. User clicks map or chooses map center.
2. Exact coordinate becomes endpoint.
3. `/api/reverse` tries to name it.
4. Exact coordinate remains source of truth even if label fails.

Why this matters: labels can be wrong, vague, or delayed. Coordinates drive route. Labels only help humans read it.

## 8. Route calculation

Route flow:

1. User presses Find Route.
2. `calculateRoute()` calls `/api/route`.
3. API validates both coordinates are inside rough India bounds.
4. If `MAPPLS_REST_KEY` exists, API tries Mappls `route_eta`.
5. If Mappls succeeds, route is traffic-aware.
6. If Mappls fails, API tries OSRM public routing.
7. OSRM fallback is marked `trafficAwareEta: false`.
8. UI receives geometry, steps, distance, duration, provider, and destination road-snap distance.
9. UI draws route line and endpoint markers on MapLibre.
10. UI creates active trip snapshot and journey record.

Mappls key stays server-side. It is read from `.env.local`. It is not exposed as `NEXT_PUBLIC_*`.

## 9. Navigation session

Navigation session is small TypeScript state:

```text
routeVersion
startedAt
currentStepIndex
progressMetres
offRouteStrikes
lastPosition
```

`lib/navigation.ts` does the core math:

- Haversine distance
- project GPS point onto route segment
- find nearest route segment
- calculate route progress
- advance step when driver passes a maneuver
- detect off-route after repeated misses
- decide whether reroute is needed
- format basic maneuver instructions

During live drive:

1. Browser watchPosition sends GPS updates.
2. App rejects stale or poor fixes for guidance.
3. `updateSession()` matches GPS to route.
4. UI updates remaining ETA and next maneuver.
5. If off-route strikes hit threshold, app requests reroute from current position to same destination.
6. If close enough to destination, trip completes and journal records arrival.

Demo preview uses route coordinates to simulate driving. Demo and live guidance stop each other so they do not fight.

## 10. Map behavior

Map renderer:

- MapLibre GL JS
- OpenFreeMap style
- route source/layer
- live marker
- accuracy circle
- start and destination markers

Past bug fixed:

- Map disappeared after refresh because CSS specificity let MapLibre container collapse after loading overlay disappeared.
- Map container now keeps explicit layout.
- Tile errors no longer hide the whole map.
- WebGL fallback/retry UI exists.

Known remaining map work:

- more WebGL loss tests
- slow/failed tile automation
- mobile road-device validation
- production tile SLA or self-hosted tiles

## 11. Nearby context engine

`/api/context` is the evidence collector.

Input:

```text
lat
lon
```

Output:

```text
candidates[]
availability
limitations
fetchedAt
```

Each candidate includes:

```text
id
type
title
summary
location
sourceName
sourceUrl
fetchedAt
validUntil
confidence
urgency
```

Candidate types:

- weather
- landmark
- food
- culture
- scenic
- business
- sport
- news
- event
- safety

Current sources:

- Wikipedia geosearch and extracts for landmarks
- Open-Meteo for weather
- Photon reverse lookup for locality
- Photon search over OpenStreetMap for restaurants, museums, parks, malls, stadiums
- GDELT for optional local news

Traffic, accidents, construction, closures, and current events are not invented. If provider does not exist, availability says false.

## 12. Attention system

The app should not speak everything.

`lib/attention.ts` checks each candidate:

- expired evidence rejected
- low confidence rejected
- duplicate rejected
- companion speech blocked near maneuver
- cooldown enforced
- far-away candidates rejected
- candidates behind driver rejected when heading exists
- user interests increase score

Score uses:

- urgency
- confidence
- proximity
- interest match

Interest mapping:

```text
History      -> landmark, culture
Food         -> food
Architecture -> landmark, culture
Nature       -> scenic
Culture      -> culture, event
Photography  -> scenic, landmark
Shopping     -> business
Sports       -> sport, event
Local events -> event
```

Talkativeness changes cooldown:

- quiet: longer gap
- normal: medium gap
- talkative: shorter gap

Navigation still wins. If turn is close, companion waits.

## 13. Voice system

Voice has two parts:

- passive announcements
- active questions

Passive:

1. Context candidates arrive.
2. Attention system selects one.
3. App updates assistant text.
4. If voice is enabled, browser speech synthesis speaks it.
5. Journey records announcement only after selection path.

Active:

1. User types question or uses microphone.
2. Browser speech recognition captures text where supported.
3. App sends question to `/api/ask`.
4. Answer appears and can be spoken.

Current voice limits:

- browser support varies
- installed voices vary by device
- real microphone/speaker acceptance still needed
- background/locked-screen speech is not guaranteed on web

## 14. Grounded question answering

`/api/ask` is intentionally strict.

Flow:

1. Accept question, latitude, longitude.
2. Enforce rate limit and body size.
3. Fetch context server-side.
4. Filter evidence by freshness, confidence, HTTPS source, and schema.
5. Detect question type with `requestedType()`.
6. Prioritize matching evidence.
7. If OpenAI key/model exists, send compact evidence to model.
8. If no key or model fails, use deterministic fallback.

The model instruction says:

- answer only from supplied evidence
- do not invent traffic
- do not invent closures
- do not invent weather
- do not invent directions
- do not invent popularity
- do not invent opening hours
- do not invent history
- say when evidence is insufficient

Fallback logic supports:

- food
- weather
- scenic/nature
- shopping
- sports
- culture
- events
- news
- landmarks

## 15. Journey journal

`lib/journey.ts` stores local trip story.

It records:

- journey start
- sampled route points
- encounters
- announcements
- stops when implemented
- arrival

It can summarize:

- distance travelled
- duration
- discoveries
- announcements

UI can:

- open journey panel
- export JSON
- delete local journal

Current journal is local-first. It is not cloud sync. It does not yet support photos, trip library, confirmed stop detection, or multi-trip gallery.

## 16. Security and privacy choices

Current safeguards:

- Mappls key stays server-side in `.env.local`.
- `.env.local` is ignored by git.
- APIs rate-limit per IP per route bucket.
- Ask API limits request size.
- External evidence must have HTTPS source URL.
- Trip restore validates stored shape.
- Missing provider is shown as unavailable.
- App does not claim road is clear when feed is missing.

Still needed before production:

- rotate any key that was pasted in chat or screenshots
- restrict key in Mappls dashboard where possible
- production logging and retention policy
- durable shared rate limits
- provider cost budgets
- privacy copy for location sharing
- deployment smoke tests

## 17. Free-first decisions

Free or low-cost choices:

- MapLibre instead of paid map SDK
- OpenFreeMap for development basemap
- OSRM fallback for development routing
- Wikipedia for public knowledge
- OpenStreetMap/Photon for places
- Open-Meteo for weather
- browser speech APIs instead of paid speech APIs
- deterministic answer fallback when OpenAI key absent
- localStorage instead of hosted user database for prototype

Paid or licensed sources likely needed later:

- reliable traffic incidents
- closures
- construction
- restaurant ratings and hours
- high-SLA tiles
- production-grade routing
- current events with venue status
- production monitoring

## 18. Important bugs fixed so far

Map disappeared after refresh:

- Cause: CSS let MapLibre container collapse.
- Fix: stronger app map container layout.
- Tested with repeated browser reloads.

Search and route stale responses:

- Cause: slow old requests could commit after user changed endpoint.
- Fix: abort controllers and revisions.
- Tested through route/search flows and unit coverage.

GPS not acting like real navigation:

- Cause: early app was more preview than live watcher.
- Fix: browser watch, fix quality, live marker, accuracy, follow/recenter, reroute state.
- Field proof still needed.

Invented fallback facts:

- Cause: fallback could answer with default landmark-style text.
- Fix: server-owned evidence and insufficient-evidence answer.

AI not speaking interests:

- Cause: context requests kept getting cancelled and stale candidates were not re-evaluated.
- Fix: in-flight context lock, cached candidate reevaluation, better category discovery, evidence prioritization.

Restaurant ratings:

- Cause: free OSM/Photon data does not include reliable live ratings.
- Fix: app now avoids claiming ratings/hours. Ratings remain separate provider problem.

MapLibre zoom crash:

- Cause: marker resize/follow interaction could trigger MapLibre easing issue.
- Fix: stop/follow handling around marker and map cleanup.

## 19. Tests run

Automated suites include:

- navigation tests
- attention tests
- journey tests
- grounding tests
- location tests
- trip-state tests
- Mappls parser tests
- Mappls API contract tests
- ask API tests
- route API tests
- rate-limit tests

Common commands:

```bash
npm test
npm run test:india
npm run test:addresses
npx tsc --noEmit
npm run lint
npm run build
```

Recent verified state from work session:

- deterministic tests passed
- TypeScript passed
- ESLint passed
- production build passed
- browser checks passed for route, map, refresh, context, and grounded question flows

What tests do not prove:

- real road safety
- every Indian address
- every phone browser
- microphone quality
- speaker behavior
- locked-screen operation
- live incident accuracy
- restaurant ratings
- production availability

## 20. Current product truth

Marga is now a strong local prototype:

- real map
- real India search when Mappls key exists
- exact pins
- GPS start/destination
- route geometry and maneuvers
- traffic-aware ETA through Mappls route when authorized
- OSRM fallback
- route progress
- off-route reroute foundation
- local journey journal
- grounded nearby context
- interest-aware announcements
- voice question path
- server-owned evidence for answers

It is not yet a Google Maps replacement.

Missing before daily-driver claim:

- real-device road testing
- nationwide address acceptance
- official incidents, closures, construction
- restaurant ratings and opening hours
- route alternatives and multi-stop detours
- scenic detour under time budget
- verified events and festivals
- stronger side-of-road / "what is that building" logic
- offline/background behavior
- accessibility acceptance
- production monitoring and rollback
- provider license and cost review

## 21. How one full trip works today

Example flow:

1. User opens app.
2. Map loads.
3. User types start.
4. `/api/search` returns Mappls places.
5. User picks one.
6. `/api/resolve` gets coordinate.
7. User types destination.
8. Same resolve flow gets destination coordinate.
9. User presses Find Route.
10. `/api/route` tries Mappls, then OSRM fallback if needed.
11. UI draws route and shows first maneuver.
12. Journey record starts.
13. User starts preview or live GPS.
14. `updateSession()` tracks progress.
15. `/api/context` gathers nearby evidence.
16. `selectAnnouncement()` picks best candidate.
17. Browser speaks useful context if safe.
18. User asks question.
19. `/api/ask` fetches server evidence and answers with source.
20. If user misses route, reroute starts from current position.
21. On arrival, journey completes.
22. User can export or delete journal.

## 22. What to build next

Best next work, in order:

1. Real phone road test with GPS, speech, reroute, refresh, and arrival.
2. Address audit expansion across India with public/consented locations.
3. Restaurant ratings provider decision.
4. Incident/closure/construction provider decision.
5. Detour engine for food and scenic stops.
6. Route corridor context instead of nearby-radius context.
7. Journey history and photos.
8. Accessibility and mobile driving UI pass.
9. Production deployment smoke tests and monitoring.
10. Android app after web acceptance gates pass.

## 23. Project principle

Marga must stay honest.

If data is fresh and sourced, app can speak.

If data is missing, stale, low-confidence, or unavailable, app must say it does not know.

That one rule matters more than flashy AI. A navigation app can be charming, but it cannot bluff.
