import assert from "node:assert/strict";
import test from "node:test";
import { createSession, distanceMetres, maneuverInstruction, matchRoute, shouldAnnounceManeuver, updateSession, type Coordinate, type RouteStep } from "../lib/navigation.ts";

const route: Coordinate[] = [[77.2, 28.6], [77.21, 28.61], [77.22, 28.62]];
const steps: RouteStep[] = [
  { id: "one", instruction: "Continue straight", location: route[1], distanceMetres: 1000, durationSeconds: 90 },
  { id: "two", instruction: "Arrive", location: route[2], distanceMetres: 1000, durationSeconds: 90 },
];

test("matches a position to route progress", () => {
  const result = matchRoute([77.205, 28.605], route);
  assert.ok(result.distanceFromRoute < 5);
  assert.ok(result.progressMetres > 600);
});

test("requires three consecutive off-route positions", () => {
  let session = createSession(1, route[0], 1);
  for (let strike = 1; strike <= 3; strike += 1) {
    const result = updateSession(session, [77.3, 28.7], route, steps);
    session = result.session;
    assert.equal(result.shouldReroute, strike === 3);
  }
  const recovered = updateSession(session, route[1], route, steps);
  assert.equal(recovered.session.offRouteStrikes, 0);
});

test("progress never moves backward during GPS jitter", () => {
  let session = createSession(2, route[0], 1);
  session = updateSession(session, [77.215, 28.615], route, steps).session;
  const progressed = session.progressMetres;
  session = updateSession(session, [77.205, 28.605], route, steps).session;
  assert.equal(session.progressMetres, progressed);
});

test("advances after a sparse GPS sample passes a maneuver", () => {
  const straightRoute: Coordinate[] = [[77, 28], [77.01, 28], [77.02, 28]];
  const straightSteps: RouteStep[] = [
    { id: "turn", instruction: "Turn", location: straightRoute[1], distanceMetres: 1000, durationSeconds: 90 },
    { id: "arrive", instruction: "Arrive", location: straightRoute[2], distanceMetres: 1000, durationSeconds: 90 },
  ];
  const result = updateSession(createSession(1, straightRoute[0], 1), [77.012, 28], straightRoute, straightSteps);
  assert.equal(result.session.currentStepIndex, 1);
  assert.equal(result.nextStep?.id, "arrive");
});

test("maneuver timing uses speed and announcement stage", () => {
  assert.equal(shouldAnnounceManeuver(200, 10, "early"), true);
  assert.equal(shouldAnnounceManeuver(50, 10, "near"), true);
  assert.equal(shouldAnnounceManeuver(400, 10, "early"), false);
});

test("preserves useful OSRM maneuver semantics", () => {
  assert.equal(maneuverInstruction({ type: "roundabout", exit: 3 }, "MG Road", "Home"), "At the roundabout, take exit 3 on MG Road");
  assert.equal(maneuverInstruction({ type: "fork", modifier: "left" }, "Ring Road", "Home"), "Keep left on Ring Road");
  assert.equal(maneuverInstruction({ type: "arrive" }, undefined, "Home"), "Arrive at Home");
});

test("distance remains geographically plausible", () => {
  assert.ok(distanceMetres(route[0], route[1]) > 1400);
  assert.ok(distanceMetres(route[0], route[1]) < 1600);
});
