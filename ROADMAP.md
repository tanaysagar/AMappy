# Marga delivery roadmap

The active target is one complete web product for India. Android starts only after the web acceptance gates pass.

## Phase 1 — India web foundation

Status: implemented and under regression testing.

Scope: responsive MapLibre interface, India-only destination search, route calculation, map fallback, browser location, voice input/output, and explicit provider availability.

Exit gates: production build passes; desktop and mobile are usable; representative routes across north, south, east, west, northeast, and Himalayan India resolve; provider failure leaves a clear fallback state.

## Phase 2 — Driving session

Status: implemented and under browser testing.

Scope: maneuver steps, GPS route matching, progress, off-route detection, rerouting from the current position, route versions, audio priority, local session persistence, and deterministic drive replay.

Exit gates: route replay advances instructions; three consecutive off-route samples trigger one reroute; stale route events cannot speak; refresh restores the active session; navigation speech takes priority.

## Phase 3 — Route-aware companion

Status: core implementation complete; source coverage remains in progress.

Scope: nearby landmarks, food, current weather, optional local news, route-aware ranking, interests, cooldowns, duplicate suppression, freshness and confidence rules, text/voice questions, and evidence-linked answers.

Exit gates: expired and weak evidence is rejected; nearby unrelated items stay silent; maneuvers suppress optional speech; answers cite evidence; missing evidence produces an honest unavailable response.

## Phase 4 — Live road intelligence

Status: adapter boundary ready; verified traffic, incidents, construction, and nationwide events require production data sources.

Scope: route-matched traffic and incidents, road closures, construction, weather alerts, event feeds, detour comparison, provider monitoring, and safe structured announcements.

Exit gates: stale feeds never create current-condition claims; incidents on unrelated roads are suppressed; reroutes show time impact; outage preserves navigation; multi-city samples match source data.

## Phase 5 — Journey memory and web hardening

Status: local journal implemented; hardening remains.

Scope: route samples, encountered places, spoken facts, confirmed stops, export, privacy controls, installable PWA behavior, low-connectivity caching, accessibility, and performance.

Exit gates: drive-by places are not marked as visits; journal survives refresh; export and deletion work; cached navigation state degrades safely; mobile browser checks pass.

## Phase 6 — India web release

Status: not started. No production deployment until preceding gates pass.

Scope: end-to-end regression, source and license audit, security review, cost-per-driving-hour measurement, pilot drives, regional language QA, and launch monitoring.

Exit gates: all automated suites pass; manual pilot routes pass; material data gaps are shown in-product; operating cost fits budget; privacy and retention behavior is documented.

## Deferred — Android

Kotlin/MapLibre Native, background location, Android audio focus, downloaded regional maps, and mobile battery work begin after the India web release is stable. API contracts and safety rules will be reused.
