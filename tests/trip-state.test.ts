import test from "node:test";
import assert from "node:assert/strict";
import { parseTripSnapshot } from "../lib/trip-state.ts";

const valid = { version: 1, origin: [77.2, 28.6], originText: "Delhi", destination: "Red Fort", destinationPoint: [77.24, 28.65], routeCoordinates: [[77.2, 28.6], [77.24, 28.65]], routeSteps: [{ id: "one", instruction: "Continue", location: [77.2, 28.6], distanceMetres: 100, durationSeconds: 20 }], routeVersion: 2, distanceMetres: 100, durationSeconds: 20, trafficAwareEta: true, destinationAccessDistanceMetres: 42, session: null };

test("accepts a coherent trip and rejects corrupt or out-of-India state", () => {
  assert.equal(parseTripSnapshot(valid)?.destination, "Red Fort");
  assert.equal(parseTripSnapshot(valid)?.destinationAccessDistanceMetres, 42);
  assert.equal(parseTripSnapshot({ ...valid, routeCoordinates: [] }), null);
  assert.equal(parseTripSnapshot({ ...valid, destinationPoint: [-0.1, 51.5] }), null);
  assert.equal(parseTripSnapshot({ ...valid, routeSteps: [{ id: "bad" }] }), null);
});
