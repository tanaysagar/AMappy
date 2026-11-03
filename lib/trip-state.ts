import type { Coordinate, RouteSession, RouteStep } from "./navigation";

export type TripSnapshot = {
  version: 1;
  origin: Coordinate;
  originText: string;
  destination: string;
  destinationPoint: Coordinate;
  routeCoordinates: Coordinate[];
  routeSteps: RouteStep[];
  routeVersion: number;
  distanceMetres: number;
  durationSeconds: number;
  trafficAwareEta: boolean;
  destinationAccessDistanceMetres: number | null;
  session: RouteSession | null;
};

function coordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
    && value[1] >= 6 && value[1] <= 38 && value[0] >= 68 && value[0] <= 98;
}

export function parseTripSnapshot(value: unknown): TripSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || !coordinate(item.origin) || !coordinate(item.destinationPoint)) return null;
  if (typeof item.originText !== "string" || typeof item.destination !== "string" || item.originText.length > 500 || item.destination.length > 500) return null;
  if (!Array.isArray(item.routeCoordinates) || item.routeCoordinates.length < 2 || item.routeCoordinates.length > 100_000 || !item.routeCoordinates.every(coordinate)) return null;
  if (!Array.isArray(item.routeSteps) || item.routeSteps.length > 10_000) return null;
  const routeSteps: RouteStep[] = [];
  for (const value of item.routeSteps) {
    if (!value || typeof value !== "object") return null;
    const step = value as Record<string, unknown>;
    if (typeof step.id !== "string" || typeof step.instruction !== "string" || !coordinate(step.location) || !Number.isFinite(step.distanceMetres) || !Number.isFinite(step.durationSeconds)) return null;
    routeSteps.push(step as RouteStep);
  }
  if (!Number.isInteger(item.routeVersion) || !Number.isFinite(item.distanceMetres) || !Number.isFinite(item.durationSeconds) || typeof item.trafficAwareEta !== "boolean") return null;
  const session = item.session === null ? null : item.session as RouteSession;
  if (session && (!Number.isInteger(session.routeVersion) || !coordinate(session.lastPosition) || !Number.isFinite(session.progressMetres) || !Number.isInteger(session.currentStepIndex))) return null;
  const destinationAccessDistanceMetres = Number.isFinite(item.destinationAccessDistanceMetres) ? item.destinationAccessDistanceMetres as number : null;
  return { version: 1, origin: item.origin, originText: item.originText, destination: item.destination, destinationPoint: item.destinationPoint, routeCoordinates: item.routeCoordinates, routeSteps, routeVersion: item.routeVersion as number, distanceMetres: item.distanceMetres as number, durationSeconds: item.durationSeconds as number, trafficAwareEta: item.trafficAwareEta, destinationAccessDistanceMetres, session };
}
