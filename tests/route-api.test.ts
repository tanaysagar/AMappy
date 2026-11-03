import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/route/route.ts";

test("uses Mappls traffic ETA and falls back to OSRM", async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.MAPPLS_REST_KEY;
  process.env.MAPPLS_REST_KEY = "test-key";
  try {
    globalThis.fetch = async (input) => Response.json({ code: "Ok", routes: [{ distance: 100, duration: 20 }], waypoints: [{ location: [77.2, 28.6] }, { location: [77.2405, 28.6505] }], requested: String(input) });
    const primary = await GET(new Request("http://marga.test/api/route?from=77.2,28.6&to=77.24,28.65"));
    const primaryBody = await primary.json() as { provider: string; trafficAwareEta: boolean; destinationAccessDistanceMetres: number; routedDestination: [number, number] };
    assert.equal(primaryBody.provider, "Mappls"); assert.equal(primaryBody.trafficAwareEta, true);
    assert.deepEqual(primaryBody.routedDestination, [77.2405, 28.6505]);
    assert.ok(primaryBody.destinationAccessDistanceMetres > 70 && primaryBody.destinationAccessDistanceMetres < 80);

    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return calls === 1 ? new Response("unauthorized", { status: 401 }) : Response.json({ code: "Ok", routes: [{ distance: 100, duration: 25 }], waypoints: [{ location: [77.2, 28.6] }, { location: [77.24, 28.65] }] }); };
    const fallback = await GET(new Request("http://marga.test/api/route?from=77.2,28.6&to=77.24,28.65"));
    const fallbackBody = await fallback.json() as { provider: string; trafficAwareEta: boolean };
    assert.equal(fallbackBody.provider, "OSRM"); assert.equal(fallbackBody.trafficAwareEta, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey;
  }
});
