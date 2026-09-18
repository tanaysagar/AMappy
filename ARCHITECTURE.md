# Marga architecture

Marga is an India-first navigation product with a route-aware voice companion. Navigation remains useful when AI or live information is unavailable.

## Current web slice

- React/Vinext client rendered application
- MapLibre map renderer
- OpenFreeMap public vector style, with a bundled Delhi fallback map
- Photon place search
- OSRM route calculation
- Browser geolocation, speech recognition, and speech synthesis
- Local rules for companion answers and interruption timing

Public community endpoints are suitable for development and low-volume testing only. Production must use self-hosted regional services or providers with service guarantees.

## Target system

```text
Web / Android client
  Navigation session
  Location and route progress
  Voice and audio priority
  Attention gate
  Local cache
          |
       API gateway
          |
  Journey context service
  Search and routing adapters
  Route corridor discovery
  Evidence and freshness service
  AI conversation service
  Journey journal service
          |
  PostgreSQL + PostGIS
  Redis-compatible cache
  Object storage
  Background workers
          |
  OSM / Valhalla / Photon
  Traffic and incident provider
  Weather and public alert feeds
  Wikidata and curated sources
```

## Boundaries

The client owns active guidance, GPS filtering, maneuver audio priority, route version checks, duplicate suppression, and the final decision to speak. The backend gathers and ranks candidates, verifies evidence, and produces grounded language. The language model never creates route geometry, traffic observations, closures, or weather alerts.

Every live item stores its source, observed time, fetched time, expiry, confidence basis, geometry, and route version. Expired information becomes unavailable. It never becomes a claim that conditions are clear.

Provider-specific code stays behind adapters. This permits starting with free services and replacing them without rewriting the user experience.

## Initial production stack

- Web: React, TypeScript, MapLibre
- Android later: Kotlin and MapLibre Native, sharing API contracts with web
- API: FastAPI or TypeScript Worker endpoints
- Spatial store: PostgreSQL with PostGIS
- Regional routing: Valhalla on India OSM extracts
- Search: self-hosted Photon for India
- Weather: Open-Meteo during evaluation; licensed endpoint for commercial use
- Knowledge: Wikidata plus curated Indian heritage and tourism sources
- AI: small tool-calling hosted model with strict evidence input and response budget
- Voice: device speech services first; cloud voice only for unsupported languages or quality gaps

## Cost controls

- Prepare route corridor data once per route segment, not per GPS update.
- Cache shared place facts and generated descriptions when licenses allow.
- Run interruption rules on device.
- Call AI only after a candidate passes safety and relevance gates.
- Track cost per driving hour across maps, routing, traffic, voice, and AI.
- Launch with one region and add states after route and address quality tests pass.
