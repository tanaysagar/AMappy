import assert from "node:assert/strict";
import test from "node:test";
import { addJourneyEvent, addJourneySample, completeJourney, createJourney, summarizeJourney } from "../lib/journey.ts";

test("records movement but suppresses noisy nearby samples", () => {
  let journey = createJourney("Red Fort", [77.2, 28.6], 0);
  journey = addJourneySample(journey, [77.20001, 28.60001], 1000);
  assert.equal(journey.route.length, 1);
  journey = addJourneySample(journey, [77.21, 28.61], 2000);
  assert.equal(journey.route.length, 2);
});

test("deduplicates encounters and produces summary", () => {
  let journey = createJourney("Red Fort", [77.2, 28.6], 0);
  journey = addJourneySample(journey, [77.21, 28.61], 60_000);
  journey = addJourneyEvent(journey, { type: "encounter", title: "Old Delhi", at: 1000 });
  journey = addJourneyEvent(journey, { type: "encounter", title: "Old Delhi", at: 2000 });
  journey = completeJourney(journey, 120_000);
  const summary = summarizeJourney(journey);
  assert.equal(summary.encounters.length, 1);
  assert.equal(summary.durationMinutes, 2);
  assert.ok(summary.distanceMetres > 1000);
});
