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

test("supports photography and local event interests", () => {
  const photo: ContextCandidate = { ...base, id: "photo", type: "scenic" };
  const event: ContextCandidate = { ...base, id: "event", type: "event" };
  assert.ok(evaluateCandidate(photo, { ...context, interests: ["Photography"] }).score > evaluateCandidate(photo, { ...context, interests: [] }).score);
  assert.ok(evaluateCandidate(event, { ...context, interests: ["Local events"] }).score > evaluateCandidate(event, { ...context, interests: [] }).score);
});

test("supports shopping and sports place interests", () => {
  const shop: ContextCandidate = { ...base, id: "shop", type: "business" };
  const stadium: ContextCandidate = { ...base, id: "stadium", type: "sport" };
  assert.ok(evaluateCandidate(shop, { ...context, interests: ["Shopping"] }).score > evaluateCandidate(shop, { ...context, interests: [] }).score);
  assert.ok(evaluateCandidate(stadium, { ...context, interests: ["Sports"] }).score > evaluateCandidate(stadium, { ...context, interests: [] }).score);
});

test("routine weather does not crowd out places when every interest is selected", () => {
  const weather: ContextCandidate = { ...base, id: "weather", type: "weather", location: undefined, confidence: .9, urgency: .18 };
  assert.equal(selectAnnouncement([weather, base], { ...context, interests: ["History", "Food", "Architecture", "Nature", "Culture"] })?.id, "fort");
});
