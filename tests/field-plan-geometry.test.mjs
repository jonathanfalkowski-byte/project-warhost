import assert from "node:assert/strict";
import test from "node:test";
import {
  DEAD_CIRCUIT_BLOCKED_TERRAIN,
  DEAD_CIRCUIT_FIELD_LANDMARKS,
  DEAD_CIRCUIT_FIELD_PLANS,
  DEAD_CIRCUIT_MISSION,
} from "../src/fieldPlanData.js";
import { buildAuthoredFormationRoutes } from "../src/fieldRoutes.js";

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
