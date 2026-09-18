export type GroundingEvidence = {
  id: string;
  type: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  validUntil: number;
  confidence: number;
};

export type GroundedAnswer = {
  answer: string;
  sources: Array<{ name: string; url: string }>;
  mode: "grounded-fallback";
};

function requestedType(question: string) {
  const query = question.toLowerCase();
  if (/\b(food|eat|restaurant|meal|hungry)\b/.test(query)) return "food";
  if (/\b(weather|rain|temperature|hot|cold|forecast)\b/.test(query)) return "weather";
  if (/\b(news|happening|event|festival)\b/.test(query)) return "news";
  return "landmark";
}

export function groundedFallback(
  question: string,
  evidence: GroundingEvidence[],
  now = Date.now(),
): GroundedAnswer {
  const type = requestedType(question);
  const item = evidence.find((candidate) => {
    const validUntil = Number(candidate.validUntil);
    const confidence = Number(candidate.confidence);
    return candidate.type === type && validUntil > now && confidence >= 0.62;
  });

  if (!item) {
    return {
      answer: "I do not have enough verified information to answer that right now.",
      sources: [],
      mode: "grounded-fallback",
    };
  }

  return {
    answer: item.summary,
    sources: [{ name: item.sourceName, url: item.sourceUrl }],
    mode: "grounded-fallback",
  };
}
