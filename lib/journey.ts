import { distanceMetres, type Coordinate } from "./navigation";

export type JourneyEvent = { id: string; type: "started" | "encounter" | "announcement" | "stop" | "arrived"; title: string; detail?: string; at: number; sourceUrl?: string };
export type JourneyRecord = { id: string; destination: string; startedAt: number; endedAt?: number; route: Array<{ position: Coordinate; at: number }>; events: JourneyEvent[] };

export function createJourney(destination: string, position: Coordinate, now = Date.now()): JourneyRecord {
  return { id: `journey-${now}`, destination, startedAt: now, route: [{ position, at: now }], events: [{ id: `started-${now}`, type: "started", title: `Journey to ${destination}`, at: now }] };
}

export function addJourneySample(journey: JourneyRecord, position: Coordinate, now = Date.now()) {
  const last = journey.route.at(-1);
  if (last && distanceMetres(last.position, position) < 40 && now - last.at < 30_000) return journey;
  return { ...journey, route: [...journey.route, { position, at: now }] };
}

export function addJourneyEvent(journey: JourneyRecord, event: Omit<JourneyEvent, "id">) {
  const duplicate = journey.events.some((existing) => existing.type === event.type && existing.title === event.title);
  if (duplicate) return journey;
  return { ...journey, events: [...journey.events, { ...event, id: `${event.type}-${event.at}-${journey.events.length}` }] };
}

export function completeJourney(journey: JourneyRecord, now = Date.now()) {
  if (journey.endedAt) return journey;
  return { ...addJourneyEvent(journey, { type: "arrived", title: `Arrived at ${journey.destination}`, at: now }), endedAt: now };
}

export function summarizeJourney(journey: JourneyRecord) {
  const distance = journey.route.slice(1).reduce((sum, sample, index) => sum + distanceMetres(journey.route[index].position, sample.position), 0);
  return { distanceMetres: distance, durationMinutes: Math.max(1, Math.round(((journey.endedAt ?? Date.now()) - journey.startedAt) / 60_000)), encounters: journey.events.filter((event) => event.type === "encounter"), announcements: journey.events.filter((event) => event.type === "announcement") };
}
