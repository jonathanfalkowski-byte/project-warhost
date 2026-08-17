import assert from "node:assert/strict";
import test from "node:test";
import {
  DEAD_CIRCUIT_BLOCKED_TERRAIN,
  DEAD_CIRCUIT_FIELD_LANDMARKS,
  DEAD_CIRCUIT_FIELD_PLANS,
  DEAD_CIRCUIT_MISSION,
} from "../src/fieldPlanData.js";
import { buildAuthoredFormationRoutes, splitAuthoredRouteAtActionStop } from "../src/fieldRoutes.js";
import { PLAYBOOKS } from "../src/playbookData.js";

const roles = Array.from({ length: 5 }, (_, index) => ({ id: `role-${index}` }));
const assignments = Object.fromEntries(roles.map((role, index) => [role.id, `formation-${index}`]));
const samePoint = (left, right) => left.x === right.x && left.y === right.y;
const sameSegment = (left, right) => (
  (samePoint(left.start, right.start) && samePoint(left.end, right.end))
  || (samePoint(left.start, right.end) && samePoint(left.end, right.start))
);
const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const properIntersection = (left, right) => {
  if (sameSegment(left, right)) return false;
  if ([left.start, left.end].some((point) => samePoint(point, right.start) || samePoint(point, right.end))) return false;
  const first = orientation(left.start, left.end, right.start);
  const second = orientation(left.start, left.end, right.end);
  const third = orientation(right.start, right.end, left.start);
  const fourth = orientation(right.start, right.end, left.end);
  return first * second < 0 && third * fourth < 0;
};
const pointInsideTerrain = (point, terrain) => (
  point.x > terrain.left
  && point.x < terrain.right
  && point.y > terrain.top
  && point.y < terrain.bottom
);
const segmentEntersTerrain = (start, end, terrain) => (
  Array.from({ length: 401 }, (_, index) => index / 400).some((progress) => pointInsideTerrain({
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
  }, terrain))
);

const routesFor = (plan, beta, rescue, movementProfile = "tracked") => buildAuthoredFormationRoutes({
  plan,
  landmarks: DEAD_CIRCUIT_FIELD_LANDMARKS,
  roles,
  assignments,
  formationMovementProfiles: Object.fromEntries(roles.map((role, index) => [`formation-${index}`, movementProfile])),
  branches: { beta, rescue },
});

for (const [planId, plan] of Object.entries(DEAD_CIRCUIT_FIELD_PLANS)) {
  test(`${planId} expresses the disposition mission through ordered objectives`, () => {
    assert.deepEqual(
      new Set(plan.objectivePhases.map((phase) => phase.objectiveId ?? phase.target)),
      new Set(DEAD_CIRCUIT_MISSION.objectives.map((objective) => objective.id)),
    );
    assert.equal(plan.objectiveCorridors.at(-1).to, plan.extractionLandmark);
    plan.objectiveCorridors.forEach((corridor) => {
      assert.ok(DEAD_CIRCUIT_FIELD_LANDMARKS[corridor.from]);
      assert.ok(DEAD_CIRCUIT_FIELD_LANDMARKS[corridor.to]);
      assert.ok(corridor.roles.length > 0);
    });
  });

  test(`${planId} routes move forward and only meet at authored assembly points`, () => {
    for (const beta of ["tempo", "protect"]) {
      for (const rescue of ["clock", "recover"]) {
        const routes = routesFor(plan, beta, rescue);
        routes.forEach((route) => {
          assert.deepEqual(route.points.at(-1), DEAD_CIRCUIT_FIELD_LANDMARKS[plan.extractionLandmark]);
          route.points.slice(1).forEach((point, index) => {
            assert.equal(samePoint(point, route.points[index]), false, `${planId} route ${route.roleIndex + 1} repeats a waypoint`);
            DEAD_CIRCUIT_BLOCKED_TERRAIN.forEach((terrain) => {
              assert.equal(
                segmentEntersTerrain(route.points[index], point, terrain),
                false,
                `${planId} route ${route.roleIndex + 1} enters ${terrain.label} between points ${index + 1} and ${index + 2}`,
              );
            });
          });
        });

        const segments = routes.flatMap((route) => route.points.slice(0, -1).map((start, index) => ({
          route: route.roleIndex,
          start,
          end: route.points[index + 1],
        })));
        segments.forEach((segment, index) => {
          segments.slice(index + 1).forEach((other) => {
            if (segment.route === other.route) return;
            assert.equal(
              properIntersection(segment, other),
              false,
              `${planId} routes ${segment.route + 1} and ${other.route + 1} cross outside an authored meeting point`,
            );
          });
        });
      }
    }
  });

  test(`${planId} gives walkers a legal terrain-aware alternative without changing the authored destination`, () => {
    const tracked = routesFor(plan, "tempo", "clock", "tracked");
    const walkers = routesFor(plan, "tempo", "clock", "walker");
    walkers.forEach((route) => {
      assert.deepEqual(route.points.at(-1), DEAD_CIRCUIT_FIELD_LANDMARKS[plan.extractionLandmark]);
      route.points.slice(1).forEach((point, index) => {
        DEAD_CIRCUIT_BLOCKED_TERRAIN.filter((terrain) => !terrain.walkerTraversable).forEach((terrain) => {
          assert.equal(segmentEntersTerrain(route.points[index], point, terrain), false);
        });
      });
    });
    assert.ok(walkers.some((route, index) => JSON.stringify(route.points) !== JSON.stringify(tracked[index].points)));
  });
}

test("action stops sit on the ground they describe, not on the deployment line", () => {
  // Playtest, 15 Aug 2026: "my plans make no sense... am i recovering something from
  // those spots or am i trying to hold them for strategic value". Every stop was authored
  // at y≈88-95, on the deployment edge, so a stop was a starting position rather than an
  // objective. It also made the approach 1-4% of the journey while being allotted all the
  // time up to the formation's action milestone, which is why formations crawled through
  // the opening of the battle and then rushed the rest.
  for (const [planId, plan] of Object.entries(DEAD_CIRCUIT_FIELD_PLANS)) {
    plan.positions.forEach((position, index) => {
      // Measured against the route's own deployment point, because not every formation
      // deploys on the southern line — Twin Seizure's extraction guard starts east.
      const start = plan.routes.find((route) => route.role === index)?.start;
      const distance = Math.hypot(position.x - start.x, position.y - start.y);
      assert.ok(
        distance > 8,
        `${planId} stop ${index + 1} at (${position.x}, ${position.y}) is on top of its deployment point`,
      );
    });
    // The old data put all five stops in one row at y≈88. Objective ground is spread.
    const depths = plan.positions.map((position) => position.y);
    assert.ok(
      Math.max(...depths) - Math.min(...depths) > 15,
      `${planId} authors every stop at the same depth`,
    );
    // Stops must be distinguishable from each other, or the board reads as one blob.
    const distinct = new Set(plan.positions.map((position) => `${position.x},${position.y}`));
    assert.equal(distinct.size, plan.positions.length, `${planId} authors two stops on the same spot`);
  }
});

test("a formation's approach is a real share of its journey", () => {
  const length = (points) => points.slice(0, -1).reduce(
    (sum, point, index) => sum + Math.hypot(points[index + 1].x - point.x, points[index + 1].y - point.y),
    0,
  );
  for (const [planId, plan] of Object.entries(DEAD_CIRCUIT_FIELD_PLANS)) {
    for (const beta of ["tempo", "protect"]) {
      for (const rescue of ["clock", "recover"]) {
        for (const route of routesFor(plan, beta, rescue)) {
          const { approach, continuation } = splitAuthoredRouteAtActionStop(route.points, route.actionStopIndex);
          const share = length(approach) / Math.max(1e-6, length(route.points));
          // The approach is covered between t=0 and the action milestone, so if it is a
          // sliver of the route the formation barely moves for that whole stretch.
          assert.ok(
            share > 0.08,
            `${planId} route ${route.roleIndex + 1}: approach is ${(100 * share).toFixed(1)}% of the journey`,
          );
          assert.ok(route.actionStopIndex >= 1 && route.actionStopIndex < route.points.length);
          // The approach must end at this role's OWN action stop. Asserting only that the
          // two halves meet is not enough — they meet wherever the split is put, so a
          // split hard-coded back to points[1] would still satisfy it.
          assert.deepEqual(
            approach.at(-1),
            plan.positions[route.roleIndex],
            `${planId} route ${route.roleIndex + 1}: the approach does not end at its action stop`,
          );
          assert.deepEqual(approach.at(-1), continuation[0], "the split must meet at the action stop");
          assert.deepEqual(continuation.at(-1), route.points.at(-1), "the continuation must reach extraction");
        }
      }
    }
  }
});

test("every action stop states what it is for", () => {
  for (const base of PLAYBOOKS) {
    for (const role of base.roles) {
      assert.ok(role.objective, `${base.id} role ${role.id} has no objective type`);
      assert.match(role.objective, /^[A-Z]+$/);
    }
  }
});
