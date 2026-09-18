import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCandidate, selectAnnouncement, type AttentionContext, type ContextCandidate } from "../lib/attention.ts";

const now = 1_000_000;
const base: ContextCandidate = { id: "fort", type: "landmark", title: "Fort", summary: "Historic fort", location: [77.21, 28.61], sourceName: "Test", sourceUrl: "https://example.com", fetchedAt: now - 1000, validUntil: now + 1000, confidence: .9, urgency: .2 };
const context: AttentionContext = { position: [77.2, 28.6], headingDegrees: 40, speedMetresPerSecond: 10, distanceToManeuver: 1000, interests: ["History"], mentionedIds: new Set(), lastSpokenAt: now - 100_000, now };

test("suppresses optional context near a maneuver", () => {
  assert.equal(evaluateCandidate(base, { ...context, distanceToManeuver: 50 }).reason, "maneuver-priority");
});

test("suppresses stale, duplicate, and behind candidates", () => {
  assert.equal(evaluateCandidate({ ...base, validUntil: now - 1 }, context).reason, "expired");
  assert.equal(evaluateCandidate(base, { ...context, mentionedIds: new Set([base.id]) }).reason, "duplicate");
  assert.equal(evaluateCandidate({ ...base, location: [77.19, 28.59] }, context).reason, "not-ahead");
});

test("safety information outranks an interesting landmark", () => {
  const safety: ContextCandidate = { ...base, id: "closure", type: "safety", urgency: 1, confidence: .99 };
  assert.equal(selectAnnouncement([base, safety], context)?.id, "closure");
});

test("interest match makes relevant candidate stronger", () => {
  const food: ContextCandidate = { ...base, id: "food", type: "food" };
  assert.equal(selectAnnouncement([food, base], context)?.id, "fort");
});
