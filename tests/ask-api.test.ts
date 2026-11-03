import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/ask/route.ts";

test("ask ignores caller-supplied evidence and uses server context", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("open-meteo")) return Response.json({ current: { time: "2026-09-25T12:00", temperature_2m: 28, apparent_temperature: 30, precipitation: 0, wind_speed_10m: 5 } });
    if (url.includes("wikipedia")) return Response.json({ query: { geosearch: [] } });
    if (url.includes("overpass")) return Response.json({ elements: [] });
    if (url.includes("photon")) return Response.json({ features: [] });
    return Response.json({ articles: [] });
  };
  try {
    const request = new Request("http://marga.test/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What is the weather?", lat: 28.6139, lon: 77.209, evidence: [{ id: "fake", type: "weather", title: "Fake", summary: "Invented storm", sourceName: "Fake", sourceUrl: "https://fake.test", validUntil: Date.now() + 60_000, confidence: 1 }] }) });
    const response = await POST(request);
    const body = await response.json() as { answer: string; sources: Array<{ name: string }> };
    assert.match(body.answer, /28°C/);
    assert.doesNotMatch(body.answer, /Invented storm/);
    assert.equal(body.sources[0]?.name, "Open-Meteo");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }
});
