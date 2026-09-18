import { distanceMetres, type Coordinate } from "./navigation";

export type CandidateType = "safety" | "weather" | "landmark" | "food" | "culture" | "event" | "news" | "scenic" | "business";

export type ContextCandidate = {
  id: string;
  type: CandidateType;
  title: string;
  summary: string;
  location?: Coordinate;
  sourceName: string;
  sourceUrl: string;
  fetchedAt: number;
  validUntil: number;
  confidence: number;
  urgency: number;
};

export type AttentionContext = {
  position: Coordinate;
  headingDegrees: number;
  speedMetresPerSecond: number;
  distanceToManeuver: number;
  interests: string[];
  mentionedIds: Set<string>;
  lastSpokenAt: number;
  cooldownMs?: number;
  now: number;
};

const interestType: Record<string, CandidateType[]> = {
  history: ["landmark", "culture"], food: ["food"], architecture: ["landmark", "culture"],
  nature: ["scenic", "weather"], culture: ["culture", "event"], shopping: ["business"], sports: ["event"],
};

export function isAhead(position: Coordinate, headingDegrees: number, target: Coordinate) {
  const heading = headingDegrees * Math.PI / 180;
  const east = target[0] - position[0];
  const north = target[1] - position[1];
  return east * Math.sin(heading) + north * Math.cos(heading) > 0;
}

export function evaluateCandidate(candidate: ContextCandidate, context: AttentionContext) {
  if (candidate.validUntil < context.now) return { eligible: false, score: 0, reason: "expired" };
  if (candidate.confidence < (candidate.type === "safety" ? 0.9 : 0.62)) return { eligible: false, score: 0, reason: "low-confidence" };
  if (context.mentionedIds.has(candidate.id)) return { eligible: false, score: 0, reason: "duplicate" };
  if (candidate.type !== "safety" && context.distanceToManeuver < Math.max(180, context.speedMetresPerSecond * 14)) return { eligible: false, score: 0, reason: "maneuver-priority" };
  if (candidate.type !== "safety" && context.now - context.lastSpokenAt < (context.cooldownMs ?? 90_000)) return { eligible: false, score: 0, reason: "cooldown" };
  let proximity = 0.5;
  if (candidate.location) {
    const distance = distanceMetres(context.position, candidate.location);
    if (distance > 10_000 || !isAhead(context.position, context.headingDegrees, candidate.location)) return { eligible: false, score: 0, reason: "not-ahead" };
    proximity = Math.max(0, 1 - distance / 10_000);
  }
  const normalizedInterests = context.interests.map((interest) => interest.toLowerCase());
  const interestMatch = normalizedInterests.some((interest) => interestType[interest]?.includes(candidate.type)) ? 1 : 0;
  const score = candidate.urgency * 4 + candidate.confidence * 2 + proximity * 2 + interestMatch * 2;
  return { eligible: true, score, reason: "eligible" };
}

export function selectAnnouncement(candidates: ContextCandidate[], context: AttentionContext) {
  return candidates
    .map((candidate) => ({ candidate, evaluation: evaluateCandidate(candidate, context) }))
    .filter((item) => item.evaluation.eligible)
    .sort((a, b) => b.evaluation.score - a.evaluation.score)[0]?.candidate ?? null;
}
