import { NextResponse } from "next/server";
import { groundedFallback, requestedType, type GroundingEvidence } from "../../../lib/grounding";
import { GET as getContext } from "../context/route";
import { allowRequest } from "@/lib/rate-limit";

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export async function POST(request: Request) {
  if (!allowRequest(request, "ask", 20, 60_000)) return NextResponse.json({ error: "Too many questions" }, { status: 429 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const rawBody: unknown = await request.json().catch(() => null);
  const body = rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : {};
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  let evidence: GroundingEvidence[] = [];
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98) {
    const contextUrl = new URL("/api/context", request.url);
    contextUrl.searchParams.set("lat", String(lat)); contextUrl.searchParams.set("lon", String(lon));
    const contextResponse = await getContext(new Request(contextUrl));
    if (contextResponse.ok) {
      const context = await contextResponse.json() as { candidates?: unknown[] };
      const preferredType = requestedType(question);
      evidence = (context.candidates ?? []).filter(isGroundingEvidence).filter((item) => item.validUntil > Date.now() && item.confidence >= .62).sort((a, b) => Number(b.type === preferredType) - Number(a.type === preferredType)).slice(0, 12);
    }
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return NextResponse.json(groundedFallback(question, evidence));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, store: false, max_output_tokens: 180, instructions: "You are Marga, a concise voice guide for a driver in India. Answer only from supplied evidence. Never invent traffic, closures, weather, directions, popularity, opening hours, or history. Say when evidence is insufficient. Use at most three short sentences.", input: `Question: ${question}\nEvidence: ${JSON.stringify(evidence.map(({ id, type, title, summary, sourceName, validUntil, confidence }) => ({ id, type, title, summary, sourceName, validUntil, confidence })))}` }),
    });
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`);
    const data = await response.json() as ResponsesPayload;
    const answer = data.output_text || data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!answer) throw new Error("Empty response");
    return NextResponse.json({ answer, sources: evidence.slice(0, 3).map((item) => ({ name: item.sourceName, url: item.sourceUrl })), mode: "model" });
  } catch {
    return NextResponse.json(groundedFallback(question, evidence));
  }
}

function isGroundingEvidence(value: unknown): value is GroundingEvidence {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["id", "type", "title", "summary", "sourceName", "sourceUrl"].every((key) => typeof item[key] === "string")
    && String(item.summary).length <= 1_000 && String(item.sourceUrl).startsWith("https://")
    && Number.isFinite(item.validUntil) && Number.isFinite(item.confidence);
}
