# Marga delivery roadmap

## Phase 1 — Web navigation foundation

Goal: prove route planning and core driving interface for India.

Scope: destination search, current location, route display, route summary, responsive map interface, browser voice input/output, provider fallbacks, and India demo route.

Exit tests:

- Production build completes.
- Desktop and mobile layouts remain usable.
- Delhi demo works without external map tiles.
- Live place search and routing degrade to clear fallback states.
- Location denial does not break navigation.

Status: first working slice implemented.

## Phase 2 — Navigation session

Goal: make movement along a route reliable.

Scope: route steps, simulated GPS replay, progress matching, maneuver timing, off-route detection, rerouting, route versions, audio priority, and session persistence.

Exit tests:

- Recorded routes replay at different speeds.
- GPS jumps do not cause false reroutes.
- Missed turns create a new route and invalidate stale events.
- Guidance interrupts companion audio safely.
- Session resumes after refresh or temporary network loss.

## Phase 3 — Route-aware companion

Goal: surface useful places without excessive interruption.

Scope: route corridor queries, landmark and food candidates, interests, novelty tracking, cooldowns, confidence rules, evidence records, and tool-based conversation.

Exit tests:

- Candidates behind the driver stay silent.
- Upcoming complex maneuvers suppress optional speech.
- Repeated landmarks are not announced.
- Every spoken fact links to stored evidence.
- Ambiguous “what is that?” questions ask for clarification.

## Phase 4 — Live India information

Goal: add trustworthy traffic, incidents, construction, weather, events, and alerts for one launch region.

Scope: provider adapters, freshness rules, incident-to-route matching, detour calculation, structured safety templates, source monitoring, and coverage dashboards.

Exit tests:

- Stale feeds never produce current-condition claims.
- Incidents on nearby unrelated roads are suppressed.
- Reroutes show actual time saved or added.
- Provider outages preserve basic navigation.
- Launch-region samples pass manual source comparison.

## Phase 5 — Journey memory and Android

Goal: turn proven web behavior into a driving-ready mobile product.

Scope: Kotlin Android app, background location, offline regional data, Android audio focus, optional trip sync, confirmed stops, photo consent, and journey journals.

Exit tests:

- Background guidance survives screen lock and process pressure.
- Offline guidance covers a downloaded region.
- Battery use meets an agreed driving-hour budget.
- Drive-by places are not recorded as visits.
- Users can export and delete trip history.

## Phase 6 — Pilot and expansion

Goal: validate safety, usefulness, and economics before national rollout.

Scope: closed pilot, interruption feedback, source audits, regional language trials, provider cost analysis, and state-by-state coverage gates.

Exit tests:

- Critical navigation failure rate meets launch target.
- Unwanted interruption rate declines across pilot rounds.
- Cost per driving hour fits budget.
- Privacy and retention controls pass review.
- Each new region passes address, route, traffic, and landmark coverage checks.
