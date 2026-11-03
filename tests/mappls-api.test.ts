import test from "node:test";
import assert from "node:assert/strict";
import { GET as search } from "../app/api/search/route.ts";
import { GET as resolve } from "../app/api/resolve/route.ts";
import { GET as reverse } from "../app/api/reverse/route.ts";

test("Mappls search, resolve, and reverse API contracts preserve exact coordinates", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MAPPLS_REST_KEY;
  process.env.MAPPLS_REST_KEY = "test-key";
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("autosuggest")) return Response.json({ suggestedLocations: [{ eLoc: "ABC123", placeName: "Test House", placeAddress: "Pune", type: "house" }] });
    if (url.includes("place-details")) return Response.json({ copResults: { latitude: 18.5204, longitude: 73.8567 } });
    return Response.json({ results: [{ formatted_address: "Test lane, Pune", poi: "Test landmark", poi_dist: 35 }] });
  };
  try {
    const searchResponse = await search(new Request("http://marga.test/api/search?q=Test%20House&lat=18.52&lon=73.85"));
    assert.equal(searchResponse.status, 200);
    const searchBody = await searchResponse.json() as { results: Array<Record<string, unknown>> };
    assert.deepEqual(searchBody.results[0], { id: "ABC123", displayName: "Test House, Pune", precision: "house", provider: "Mappls" });

    const resolveResponse = await resolve(new Request("http://marga.test/api/resolve?pin=ABC123"));
    assert.equal(resolveResponse.status, 200);
    const resolveBody = await resolveResponse.json() as { point: [number, number] };
    assert.deepEqual(resolveBody.point, [73.8567, 18.5204]);

    const reverseResponse = await reverse(new Request("http://marga.test/api/reverse?lat=18.5204&lon=73.8567"));
    assert.equal(reverseResponse.status, 200);
    const reverseBody = await reverseResponse.json() as { label: string; referenceDistanceMetres: number };
    assert.equal(reverseBody.label, "Test lane, Pune");
    assert.equal(reverseBody.referenceDistanceMetres, 35);
    assert.match(calls[0], /location=18.52%2C73.85/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey;
  }
});

test("Mappls APIs fail closed without credentials and resolve pins through the routing fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MAPPLS_REST_KEY;
  delete process.env.MAPPLS_REST_KEY;
  try {
    assert.equal((await search(new Request("http://marga.test/api/search?q=India%20Gate"))).status, 503);
    process.env.MAPPLS_REST_KEY = "test-key";
    globalThis.fetch = async (input) => String(input).includes("place-details") ? Response.json({ copResults: { eLoc: "ABC123" } }) : Response.json({ waypoints: [{ location: [77.2, 28.6] }, { location: [77.22769, 28.612992] }] });
    const response = await resolve(new Request("http://marga.test/api/resolve?pin=ABC123"));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as { point: [number, number] }).point, [77.22769, 28.612992]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey;
  }
});

test("Mappls search falls back to text search when autosuggest has no body", async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.MAPPLS_REST_KEY;
  process.env.MAPPLS_REST_KEY = "test-key";
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input); calls.push(url);
    return url.includes("autosuggest") ? new Response("", { status: 200 }) : Response.json({ suggestedLocations: [{ eLoc: "LOCAL1", placeName: "स्थानीय स्थान", placeAddress: "दिल्ली" }] });
  };
  try {
    const response = await search(new Request("http://marga.test/api/search?q=%E0%A4%B8%E0%A5%8D%E0%A4%A5%E0%A4%BE%E0%A4%A8%E0%A5%80%E0%A4%AF%20%E0%A4%B8%E0%A5%8D%E0%A4%A5%E0%A4%BE%E0%A4%A8"));
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { results: unknown[] }).results.length, 1);
    assert.match(calls[1], /textsearch/);
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey; }
});

test("long addresses use Mappls geocoding instead of silent truncation", async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.MAPPLS_REST_KEY;
  process.env.MAPPLS_REST_KEY = "test-key";
  let requested = "";
  globalThis.fetch = async (input) => { requested = String(input); return Response.json({ copResults: { eLoc: "HOUSE1", formattedAddress: "237, Okhla Industrial Estate Phase 3, New Delhi", geocodeLevel: "houseNumber" } }); };
  try {
    const response = await search(new Request("http://marga.test/api/search?q=237%20Okhla%20Industrial%20Estate%20Phase%203%20New%20Delhi%20110020"));
    assert.equal(response.status, 200);
    assert.match(requested, /address\/geocode/);
    assert.equal((await response.json() as { results: Array<{ id: string }> }).results[0]?.id, "HOUSE1");
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey; }
});

test("Mappls search reports unavailable key capabilities explicitly", async () => {
  const originalFetch = globalThis.fetch; const originalKey = process.env.MAPPLS_REST_KEY;
  process.env.MAPPLS_REST_KEY = "test-key";
  globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
  try {
    const response = await search(new Request("http://marga.test/api/search?q=Hindi%20place"));
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, "MAPPLS_NOT_AUTHORIZED");
  } finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.MAPPLS_REST_KEY; else process.env.MAPPLS_REST_KEY = originalKey; }
});
