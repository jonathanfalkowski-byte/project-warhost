import assert from "node:assert/strict";
import test from "node:test";

import {
  actionStopBadge,
  actionStopLabel,
  actionStopPairLabel,
  buildAuthoredFormationRoutes,
  pointAlongRoute,
  positionAlongAuthoredRoute,
  splitAuthoredRouteAtActionStop,
} from "../src/fieldRoutes.js";

test("tactical stop labels are canonical and distinct from roster numbers", () => {
  assert.equal(actionStopBadge(0), "S01");
  assert.equal(actionStopLabel(1), "STOP 02");
  assert.equal(actionStopPairLabel(1, 2), "STOP 02 + STOP 03");
});

test("staffing selects a visible movement-specific authored corridor", () => {
  const movementPlan = {
    points: {
      vehicleStreet: { x: 40, y: 70 },
      walkerRuin: { x: 25, y: 50 },
      objective: { x: 60, y: 35 },
    },
    routes: [{
      role: 0,
      start: { x: 10, y: 90 },
      points: ["vehicleStreet", "objective"],
      movementRoutes: {
        walker: ["walkerRuin", "objective"],
      },
    }],
  };
  const roles = [{ id: "lead" }];
  const movementLandmarks = movementPlan.points;
  const vehicleRoute = buildAuthoredFormationRoutes({
    plan: movementPlan,
    roles,
    assignments: { lead: "tank" },
    formationMovementProfiles: { tank: "tracked" },
    landmarks: movementLandmarks,
    branches: {},
  })[0];
  const walkerRoute = buildAuthoredFormationRoutes({
    plan: movementPlan,
    roles,
    assignments: { lead: "walker" },
    formationMovementProfiles: { walker: "walker" },
    landmarks: movementLandmarks,
    branches: {},
  })[0];

  assert.equal(vehicleRoute.movementRouteKind, "vehicle");
  assert.equal(vehicleRoute.movementRouteLabel, "VEHICLE STREET ROUTE");
  assert.deepEqual(vehicleRoute.points[1], { x: 40, y: 70 });
  assert.equal(walkerRoute.movementRouteKind, "walker");
  assert.equal(walkerRoute.movementRouteLabel, "WALKER CUT-THROUGH");
  assert.deepEqual(walkerRoute.points[1], { x: 25, y: 50 });
});

const plan = {
  positions: [{ x: 30, y: 40 }, { x: 50, y: 30 }],
  routes: [
    { role: 0, start: { x: 10, y: 80 }, points: [0, "alpha"] },
    { role: 1, start: { x: 20, y: 80 }, points: [1], breakpoint: "beta" },
  ],
  branchRoutes: {
    beta: {
      tempo: [1, "reactor"],
      protect: [1, { x: 65, y: 20 }, "reactor"],
    },
  },
};

const routeFixture = (branch = "protect") => buildAuthoredFormationRoutes({
  plan,
  landmarks: {
    alpha: { x: 35, y: 25 },
    reactor: { x: 75, y: 40 },
    extraction: { x: 90, y: 15 },
  },
  roles: [{ id: "pull" }, { id: "break" }],
  assignments: { pull: "harpoon", break: "breaker" },
  formationStarts: { harpoon: { x: 12, y: 75 }, breaker: { x: 24, y: 76 } },
  branches: { beta: branch },
});

test("staffing never changes the authored route origin", () => {
  const routes = routeFixture();
  assert.deepEqual(routes[0].points[0], plan.routes[0].start);
  assert.deepEqual(routes[1].points.at(-1), { x: 90, y: 15 });
});

test("route geometry remains fixed when formation staging coordinates change", () => {
  const original = routeFixture();
  const movedStaging = buildAuthoredFormationRoutes({
    plan,
    landmarks: { alpha: { x: 35, y: 25 }, reactor: { x: 75, y: 40 }, extraction: { x: 90, y: 15 } },
    roles: [{ id: "pull" }, { id: "break" }],
    assignments: { pull: "breaker", break: "harpoon" },
    formationStarts: { harpoon: { x: 90, y: 90 }, breaker: { x: 5, y: 5 } },
    branches: { beta: "protect" },
  });
  assert.deepEqual(movedStaging.map((route) => route.points), original.map((route) => route.points));
});

test("only the selected breakpoint geometry enters a formation route", () => {
  const protectedRoute = routeFixture("protect")[1].points;
  const tempoRoute = routeFixture("tempo")[1].points;
  assert.ok(protectedRoute.some((point) => point.x === 65 && point.y === 20));
  assert.ok(!tempoRoute.some((point) => point.x === 65 && point.y === 20));
});

test("a formation arrives at its authored action stop at the action time", () => {
  const points = routeFixture()[1].points;
  const position = positionAlongAuthoredRoute({ points, battleTime: 60, actionAt: 60, completeAt: 180 });
  assert.deepEqual(position, plan.positions[1]);
});

test("an authored route separates the assigned action stop from its continuation", () => {
  const points = routeFixture()[1].points;
  const { approach, continuation } = splitAuthoredRouteAtActionStop(points);
  assert.deepEqual(approach, points.slice(0, 2));
  assert.deepEqual(continuation, points.slice(1));
  assert.deepEqual(approach.at(-1), plan.positions[1]);
  assert.deepEqual(continuation[0], plan.positions[1]);
  assert.deepEqual(continuation.at(-1), { x: 90, y: 15 });
});

test("a complete authored journey reaches extraction exactly once", () => {
  const completePlan = {
    positions: [{ x: 30, y: 40 }],
    routes: [{ role: 0, start: { x: 10, y: 80 }, points: [0, "reactor", "extraction"] }],
  };
  const [route] = buildAuthoredFormationRoutes({
    plan: completePlan,
    landmarks: { reactor: { x: 75, y: 40 }, extraction: { x: 90, y: 15 } },
    roles: [{ id: "assault" }],
    assignments: { assault: "walker" },
    formationStarts: {},
    branches: {},
  });
  assert.deepEqual(route.points, [
    { x: 10, y: 80 },
    { x: 30, y: 40 },
    { x: 75, y: 40 },
    { x: 90, y: 15 },
  ]);
});

test("route interpolation clamps before deployment and after extraction", () => {
  const points = [{ x: 10, y: 80 }, { x: 40, y: 40 }, { x: 90, y: 10 }];
  assert.deepEqual(pointAlongRoute(points, -5), points[0]);
  assert.deepEqual(positionAlongAuthoredRoute({ points, battleTime: 999, actionAt: 60, completeAt: 180 }), points.at(-1));
});
