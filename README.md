# Marga

India-first AI road guide. Marga combines navigation, route awareness, reliable local information, and a voice companion that knows when to stay quiet.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Current capabilities

- Interactive MapLibre map with a bundled Delhi fallback
- India place search through Photon
- Driving routes through OSRM
- Browser location, speech recognition, and speech synthesis
- Interest controls and a first route-aware companion experience
- Responsive desktop and mobile interface

See `ARCHITECTURE.md` for system design and `ROADMAP.md` for phased delivery and exit tests.

## Provider note

Current public endpoints are for development and low-volume evaluation. Production will use self-hosted India extracts or contracted services with suitable usage rights, capacity, and freshness guarantees.
