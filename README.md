<p align="center">
  <img src="./public/marga-banner.svg" alt="Marga — an AI guide for the road" width="100%" />
</p>

<p align="center">
  <strong>Navigation that helps you understand the journey.</strong><br />
  India-first · Web-first · Voice-first · Evidence-grounded
</p>

<p align="center">
  <a href="#working-today">Features</a> ·
  <a href="#run-locally">Local setup</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="./ROADMAP.md">Roadmap</a> ·
  <a href="./ARCHITECTURE.md">Design notes</a>
</p>

## What is Marga?

Marga is an AI-powered navigation companion for Indian roads. It provides routes and turn guidance while deciding which nearby landmarks, places, weather conditions, and local facts are useful enough to mention. Drivers can ask natural questions such as “What is interesting ahead?”, “Will it rain?”, or “Find food nearby.”

The map remains the primary interface. Optional companion speech is filtered by distance, direction, driving context, user interests, freshness, confidence, repetition, and proximity to the next maneuver.

> **Development status:** Marga is being completed and tested locally before its next public deployment. The current public URL is an earlier prototype and does not represent this repository’s full working state.

## Working today

| Area | Current implementation |
| --- | --- |
| Map | MapLibre with OpenFreeMap tiles and a bundled Delhi fallback |
| Search | India-bounded Photon place search through a server adapter |
| Routing | OSRM driving routes, geometry, maneuvers, distance, duration, and ETA |
| Navigation | Route matching, progress, maneuver priority, off-route detection, and rerouting from the current position |
| Location | Browser GPS watch plus deterministic drive simulation for testing |
| Context | Nearby Wikipedia landmarks, OpenStreetMap food places, Open-Meteo conditions, and optional GDELT local news |
| Attention | Interest scoring, route direction, freshness, confidence, cooldowns, maneuver suppression, and duplicate prevention |
| Conversation | Evidence-only fallback answers with optional OpenAI Responses API generation |
| Voice | Browser speech recognition and speech synthesis with six Indian language/locale choices |
| Personalization | Interests, talkativeness, voice preference, and language saved locally |
| Journey memory | Local route samples, discoveries, announcements, summaries, and JSON export |

Traffic, incidents, road construction, and nationwide event data stay visibly unavailable until a reliable provider is configured. Marga never converts a missing or stale feed into a claim that roads are clear.

## India coverage

The search and route APIs accept coordinates within India’s geographic bounds. Automated smoke checks currently exercise representative locations in Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Kochi, Guwahati, and Srinagar. This validates broad technical reach; it does not guarantee equal address, road, or live-data quality in every district.

Production launch still requires state and city coverage audits against provider data, especially for new roads, restricted roads, rural addresses, traffic, incidents, and closures.

## Run locally

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone <your-repository-url>
cd AMappy
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The core development build works without paid API keys. Public community endpoints are suitable for development and low-volume evaluation only.

### Optional environment variables

```dotenv
# Enables model-written answers after evidence has already been selected.
OPENAI_API_KEY=
OPENAI_MODEL=

# Reserved for the production traffic adapter.
TOMTOM_API_KEY=
```

When OpenAI variables are absent, the app uses deterministic evidence-only answers. Missing traffic credentials leave traffic features disabled and clearly labelled.

## Tests

```bash
npm run test:navigation
npm run test:attention
npm run test:grounding
npm run test:journey
npm run test:india
npm run lint
npm run build
```

The deterministic suites cover route progress, GPS jitter, reroute thresholds, interruption rules, stale and weak evidence, duplicate suppression, and journey recording. `test:india` calls public providers and therefore needs network access.

## Architecture

```mermaid
flowchart TB
    Web[Web driver experience] --> Nav[Navigation session]
    Web --> Voice[Voice and text conversation]
    Nav --> Attention[On-device attention gate]
    Voice --> Ask[/api/ask]
    Attention --> Context[/api/context]
    Nav --> Route[/api/route]
    Web --> Search[/api/search]

    Search --> Photon[Photon / OSM]
    Route --> OSRM[OSRM]
    Context --> Wiki[Wikipedia]
    Context --> OSM[OpenStreetMap places]
    Context --> Weather[Open-Meteo]
    Context --> News[GDELT optional news]
    Ask --> Model[Optional language model]

    Evidence[(Source + fetched time + expiry + confidence)] --> Attention
    Evidence --> Ask
```

Navigation does not depend on the language model. The model cannot create route geometry, traffic observations, closures, weather readings, or source evidence. Provider-specific logic stays behind API adapters so community services can be replaced with self-hosted India extracts or contracted feeds.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries, target services, storage, and cost controls.

## Free-first stack

| Need | Development choice | Production path |
| --- | --- | --- |
| Map rendering | MapLibre GL JS | Keep MapLibre |
| Basemap | OpenFreeMap | Self-host or contract tiles with suitable SLA |
| Geocoding | Photon public endpoint | Self-host an India extract |
| Routing | OSRM public endpoint | Self-host OSRM or Valhalla for India |
| Places | OpenStreetMap / Overpass | Cached, monitored regional service |
| Knowledge | Wikipedia | Add Wikidata and curated Indian sources |
| Weather | Open-Meteo | Confirm commercial terms or replace |
| Speech | Browser/device speech | Add cloud speech only where needed |
| AI answers | Deterministic fallback | Small hosted model after the attention gate |

This design minimizes cost by caching route context, running interruption logic locally, and calling a model only after relevant evidence passes the attention gate.

## Safety and grounding

Every live candidate carries a source, fetch time, expiry time, confidence score, and category. The application rejects expired or low-confidence evidence. Navigation instructions always outrank companion speech. Missing providers remain unavailable instead of silently degrading into guessed information.

Marga is still pre-release software. It has not completed real-road safety validation and must not be treated as the sole navigation or emergency-information source.

## Delivery plan

The active target is the complete India web product. Android is intentionally deferred until the web acceptance gates pass. Work is organized into navigation, driving session, route-aware companion, live road intelligence, web hardening, and release phases in [ROADMAP.md](./ROADMAP.md).

## Repository map

```text
app/page.tsx             Web driving experience
app/api/search           India place-search adapter
app/api/route            India routing adapter
app/api/context          Nearby evidence aggregation
app/api/ask              Grounded conversation endpoint
lib/navigation.ts        Route matching and reroute rules
lib/attention.ts         Relevance and interruption policy
lib/grounding.ts         Evidence-only answer fallback
lib/journey.ts           Local journey record and summary
tests                    Deterministic domain tests
scripts/smoke-india.mjs  Representative India provider checks
```

## Name

**Marga** comes from the Sanskrit word for path or way. It is the current working product name; formal trademark and domain checks are still required before launch.
