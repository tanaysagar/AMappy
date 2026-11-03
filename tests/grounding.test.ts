import assert from "node:assert/strict";
import test from "node:test";
import { groundedFallback, type GroundingEvidence } from "../lib/grounding.ts";

const now = 2_000_000;
const evidence: GroundingEvidence[] = [
  {
    id: "weather",
    type: "weather",
    title: "Weather",
    summary: "28°C and clear.",
    sourceName: "Test weather",
    sourceUrl: "https://example.com/weather",
    validUntil: now + 60_000,
    confidence: 0.9,
  },
  {
    id: "food",
    type: "food",
    title: "Restaurant",
    summary: "A verified restaurant is nearby.",
    sourceName: "Test places",
    sourceUrl: "https://example.com/food",
    validUntil: now + 60_000,
    confidence: 0.8,
  },
  ...(["scenic", "business", "sport", "culture", "event"] as const).map((type) => ({
    id: type,
    type,
    title: type,
    summary: `${type} result`,
    sourceName: "Test places",
    sourceUrl: `https://example.com/${type}`,
    validUntil: now + 60_000,
    confidence: 0.8,
  })),
];

test("answers weather questions from fresh matching evidence", () => {
  const result = groundedFallback("What is the weather?", evidence, now);
  assert.equal(result.answer, "28°C and clear.");
  assert.equal(result.sources[0]?.name, "Test weather");
});

test("answers food questions from food evidence", () => {
  assert.equal(groundedFallback("Find food", evidence, now).answer, "A verified restaurant is nearby.");
});

test("answers each place-interest question from matching evidence", () => {
  assert.equal(groundedFallback("Find a scenic park", evidence, now).answer, "scenic result");
  assert.equal(groundedFallback("Is there a shopping mall?", evidence, now).answer, "business result");
  assert.equal(groundedFallback("Any sports stadium?", evidence, now).answer, "sport result");
  assert.equal(groundedFallback("Tell me about a museum", evidence, now).answer, "culture result");
  assert.equal(groundedFallback("Any festival today?", evidence, now).answer, "event result");
});

test("rejects expired evidence", () => {
  const expired = evidence.map((item) => ({ ...item, validUntil: now - 1 }));
  assert.match(groundedFallback("Will it rain?", expired, now).answer, /not have enough verified/i);
});

test("rejects low-confidence evidence", () => {
  const weak = evidence.map((item) => ({ ...item, confidence: 0.2 }));
  assert.match(groundedFallback("Where can I eat?", weak, now).answer, /not have enough verified/i);
});
