import test from "node:test";
import assert from "node:assert/strict";
import { accuracyDiameterPixels, classifyLocationError, classifyLocationFix } from "../lib/location.ts";

test("classifies fresh accurate, poor, and stale fixes", () => {
  const now = 1_000_000;
  assert.equal(classifyLocationFix(18, now - 1_000, now), "active");
  assert.equal(classifyLocationFix(140, now - 1_000, now), "poor");
  assert.equal(classifyLocationFix(18, now - 16_000, now), "stale");
  assert.equal(classifyLocationFix(Number.NaN, now, now), "poor");
});

test("distinguishes permission, timeout, and unavailable errors", () => {
  assert.equal(classifyLocationError(1), "denied");
  assert.equal(classifyLocationError(3), "timeout");
  assert.equal(classifyLocationError(2), "unavailable");
});

test("accuracy circle remains visible and bounded", () => {
  assert.equal(accuracyDiameterPixels(0, 28.6, 15), 26);
  assert.ok(accuracyDiameterPixels(100, 28.6, 15) > 26);
  assert.equal(accuracyDiameterPixels(10_000, 28.6, 15), 220);
});
