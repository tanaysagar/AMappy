import test from "node:test";
import assert from "node:assert/strict";
import { mapplsFailure, parseMapplsGeocode, parseMapplsPoint, parseMapplsReverse, parseMapplsRouteEndpoint, parseMapplsSearch } from "../lib/mappls.ts";

test("parses and deduplicates Mappls suggestions", () => {
  const results = parseMapplsSearch({ suggestedLocations: [{ eLoc: "ABC123", placeName: "Rashtrapati Bhavan", placeAddress: "New Delhi", type: "POI" }, { eLoc: "ABC123", placeName: "duplicate" }], userAddedLocations: [{ mapplsPin: "XYZ789", placeName: "Local address", placeAddress: "Delhi" }] });
  assert.deepEqual(results.map(({ id, displayName }) => ({ id, displayName })), [{ id: "ABC123", displayName: "Rashtrapati Bhavan, New Delhi" }, { id: "XYZ789", displayName: "Local address, Delhi" }]);
});

test("parses Mappls geocoded addresses without requiring coordinates", () => {
  assert.deepEqual(parseMapplsGeocode({ copResults: { eLoc: "ADDR01", formattedAddress: "237, Okhla Industrial Estate Phase 3, New Delhi", geocodeLevel: "houseNumber" } }), [{ id: "ADDR01", displayName: "237, Okhla Industrial Estate Phase 3, New Delhi", precision: "houseNumber", provider: "Mappls" }]);
});

test("distinguishes Mappls entitlement and quota failures", () => {
  assert.equal(mapplsFailure(new Error("Mappls returned 401")).code, "MAPPLS_NOT_AUTHORIZED");
  assert.equal(mapplsFailure(new Error("Mappls returned 403")).code, "MAPPLS_LIMITED");
  assert.equal(mapplsFailure(new Error("network")).code, "MAPPLS_UNAVAILABLE");
});

test("accepts India coordinates and rejects missing or out-of-bounds details", () => {
  assert.deepEqual(parseMapplsPoint({ copResults: { latitude: "28.614", longitude: "77.209" } }), [77.209, 28.614]);
  assert.equal(parseMapplsPoint({ copResults: { latitude: 51.5, longitude: -0.1 } }), null);
  assert.equal(parseMapplsPoint({ copResults: { eLoc: "ABC123" } }), null);
});

test("keeps the exact pin separate from the nearby Mappls reference", () => {
  assert.deepEqual(parseMapplsReverse({ results: [{ formatted_address: "1 Raisina Hill, New Delhi", poi: "Rashtrapati Bhavan", poi_dist: "42" }] }), { label: "1 Raisina Hill, New Delhi", reference: "Rashtrapati Bhavan", referenceDistanceMetres: 42, provider: "Mappls", precision: "pin" });
});

test("resolves a Mappls Pin from the routed destination waypoint", () => {
  assert.deepEqual(parseMapplsRouteEndpoint({ waypoints: [{ location: [77.2, 28.6] }, { location: [77.22769, 28.612992] }] }), [77.22769, 28.612992]);
  assert.equal(parseMapplsRouteEndpoint({ waypoints: [] }), null);
});
