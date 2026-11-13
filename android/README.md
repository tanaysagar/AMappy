# Marga Android alpha

The APK opens to a map interface bundled inside the app. It sends API requests to the configured Marga HTTPS backend. Installers do not need a hosting account or a server URL.

## Backend deployment

Use the Next.js preset on Vercel with `npm ci` and `npx next build --webpack`. On a standalone Node host, start with `npx next start`. Set `MAPPLS_REST_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL` in the host environment. Use an API origin that Android can reach without a hosting login. Set rate and spending limits before sharing it. CORS allows the bundled Android origin and does not authenticate requests.

Verify search, resolution, reverse geocoding, traffic-aware routing, context and a model-backed guide response on the deployed API. Rotate previously shared provider credentials before configuring the host.

## APK build

Set `MARGA_API_ORIGIN` to the deployed HTTPS origin. Run `node scripts/build-android-web.mjs`, then `gradle -p android :app:lintDebug :app:assembleDebug`. GitHub Actions reads the same origin from a repository variable.

## Network loss

[Google Maps offline guidance](https://support.google.com/maps/answer/6291838?co=GENIE.Platform) describes driving within downloaded areas and the loss of live traffic and alternate routes when offline. Marga stores the selected route and maneuver list locally and can continue following that route using GPS. When Android reports an offline connection, Marga shows the saved line on a plain map background. It resumes the live basemap and can reroute when connectivity returns. Downloadable street maps and on-device route calculation remain separate work.

Test with a known route on Android. Start guidance, disable mobile data and Wi-Fi while leaving location enabled, then check that the route line, GPS position and next turn remain visible. Reconnect and check that the basemap returns. Verify voice and journal export on the phone.
