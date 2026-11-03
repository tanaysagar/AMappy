import test from "node:test";
import assert from "node:assert/strict";
import { allowRequest } from "../lib/rate-limit.ts";

test("limits each client and resets after the window", () => {
  const request = new Request("http://marga.test", { headers: { "cf-connecting-ip": "203.0.113.9" } });
  assert.equal(allowRequest(request, "test", 2, 1_000, 1_000), true);
  assert.equal(allowRequest(request, "test", 2, 1_000, 1_001), true);
  assert.equal(allowRequest(request, "test", 2, 1_000, 1_002), false);
  assert.equal(allowRequest(request, "test", 2, 1_000, 2_000), true);
});
