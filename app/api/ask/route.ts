import { NextResponse } from "next/server";
import { groundedFallback, type GroundingEvidence } from "../../../lib/grounding";

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

export async function POST(request: Request) {
  const body = await request.json();
  const question = String(body.question ?? "").slice(0, 500);
  const evidence = (Array.isArray(body.evidence) ? body.evidence : []).slice(0, 12) as GroundingEvidence[];
  if (!question) return NextResponse.json({ error: "Question required" }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return NextResponse.json(groundedFallback(question, evidence));
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
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
