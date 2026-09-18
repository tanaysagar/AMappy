export type Coordinate = [number, number];

export type RouteStep = {
  id: string;
  instruction: string;
  location: Coordinate;
  distanceMetres: number;
  durationSeconds: number;
};

export type RouteSession = {
  routeVersion: number;
  startedAt: number;
  currentStepIndex: number;
  progressMetres: number;
  offRouteStrikes: number;
  lastPosition: Coordinate;
};

const EARTH_RADIUS_METRES = 6_371_000;

export function distanceMetres(a: Coordinate, b: Coordinate) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitude1 = radians(a[1]);
  const latitude2 = radians(b[1]);
  const deltaLatitude = radians(b[1] - a[1]);
  const deltaLongitude = radians(b[0] - a[0]);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function projectOnSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const latitudeScale = 111_320;
  const longitudeScale = Math.cos(point[1] * Math.PI / 180) * latitudeScale;
  const px = (point[0] - start[0]) * longitudeScale;
  const py = (point[1] - start[1]) * latitudeScale;
  const sx = (end[0] - start[0]) * longitudeScale;
  const sy = (end[1] - start[1]) * latitudeScale;
  const denominator = sx * sx + sy * sy;
  const fraction = denominator === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / denominator));
  const projected: Coordinate = [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
  return { projected, fraction, distance: distanceMetres(point, projected) };
}

export function matchRoute(position: Coordinate, route: Coordinate[]) {
  if (route.length < 2) return { distanceFromRoute: Number.POSITIVE_INFINITY, progressMetres: 0, segmentIndex: 0 };
  let best = { distanceFromRoute: Number.POSITIVE_INFINITY, progressMetres: 0, segmentIndex: 0 };
  let traversed = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const segmentLength = distanceMetres(route[index], route[index + 1]);
    const projection = projectOnSegment(position, route[index], route[index + 1]);
    if (projection.distance < best.distanceFromRoute) {
      best = { distanceFromRoute: projection.distance, progressMetres: traversed + segmentLength * projection.fraction, segmentIndex: index };
    }
    traversed += segmentLength;
  }
  return best;
}

export function updateSession(session: RouteSession, position: Coordinate, route: Coordinate[], steps: RouteStep[]) {
  const match = matchRoute(position, route);
  const offRouteStrikes = match.distanceFromRoute > 80 ? session.offRouteStrikes + 1 : 0;
  let currentStepIndex = session.currentStepIndex;
  while (currentStepIndex < steps.length - 1 && distanceMetres(position, steps[currentStepIndex].location) < 35) currentStepIndex += 1;
  return {
    session: { ...session, lastPosition: position, progressMetres: Math.max(session.progressMetres, match.progressMetres), offRouteStrikes, currentStepIndex },
    distanceFromRoute: match.distanceFromRoute,
    shouldReroute: offRouteStrikes >= 3,
    nextStep: steps[currentStepIndex] ?? null,
  };
}

export function shouldAnnounceManeuver(distance: number, speedMetresPerSecond: number, stage: "early" | "near") {
  const secondsAway = distance / Math.max(speedMetresPerSecond, 2.5);
  return stage === "early" ? secondsAway <= 28 && secondsAway > 9 : secondsAway <= 9;
}

export function createSession(routeVersion: number, position: Coordinate, now = Date.now()): RouteSession {
  return { routeVersion, startedAt: now, currentStepIndex: 0, progressMetres: 0, offRouteStrikes: 0, lastPosition: position };
}
