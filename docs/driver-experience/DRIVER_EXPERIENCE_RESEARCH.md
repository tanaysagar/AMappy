# Marga driving experience review

## Starting a drive

Google Maps puts Start after directions. Waze uses Go now and lets drivers adjust how much they hear during a drive. Marga placed Preview route beside Live GPS. A driver could reasonably interpret the latter as a location setting. The live action now says Start navigation. Preview remains useful for testing from home.

Sources: [Google Maps navigation help](https://support.google.com/maps/answer/3273406), [Waze driving FAQ](https://www.waze.com/faq), [Waze sound preferences](https://support.google.com/waze/answer/6273671).

## Why departure weather went missing

Weather competed with every nearby place. With several interests selected, an ordinary weather report could lose every time. The first usable GPS fix now requests context for the actual starting position. Departure weather gets a separate opportunity to speak in a safe gap. Guidance takes priority near turns. Missing weather, disabled voice, poor GPS and a busy speech engine can delay or prevent delivery. The shared context request also waits on unrelated providers. Measuring that delay is the next step if weather still arrives late.

## Integration inventory

These are implementation and configuration findings. A credential or adapter alone does not establish current provider uptime.

| Integration | What the driver gets | Coverage limit |
|---|---|---|
| Mappls | Server-side credential present for Indian address lookup, pin resolution, reverse lookup and traffic-aware ETA | Individual API entitlements and local address matches can vary |
| OSRM | Fallback driving directions | No live traffic ETA on fallback |
| MapLibre and OpenFreeMap | Interactive map and basemap | Tiles require connectivity |
| Open-Meteo | Temperature, apparent temperature, wind and precipitation | Current conditions, no verified warning feed |
| Wikipedia | Nearby articles and extracts | Coverage depends on geotagged pages |
| Photon and OpenStreetMap | Nearby named places across interest categories | Search depends on locality lookup. Restaurant quality and ratings are unverified |
| GDELT | News matched to locality | A mention does not verify a road incident or an upcoming event |
| OpenAI | Optional model for questions | No OpenAI key found in local environment file. Evidence-based fallback available |
| Browser APIs | GPS, voice input, spoken output and local journal | Permissions, voices and background behavior vary by device |

The availability panel reflects returned data. An empty category can mean either no matches or a failed provider. Incidents and scheduled events have no configured feed.

## Next improvements and acceptance checks

1. Put a sound control beside the next turn. Check that muting mid-drive immediately affects the GPS callback and queued speech. Waze exposes sound preferences during the drive.
2. Test a phone trip with Bluetooth, screen lock, GPS denial, then recovery. Record first fix, weather response, actual audible playback, first maneuver and arrival separately. Queue acceptance alone cannot prove the driver heard speech.
3. Replay the Gandhinagar trip with all interests enabled. Record why each place was selected or suppressed. Compare straight-line proximity with actual route progress and detour time.
4. Differentiate provider failure, empty coverage and stale data in the availability panel. Measure delays separately before adding a paid provider.
5. Test keyboard and screen-reader use from address selection through starting and ending a drive. Measure taps and time with first-time drivers before claiming usability parity.
