import assert from "node:assert/strict";
import test from "node:test";
import { enemyContactForecastVisibleFor, enemyExactRoutesVisibleFor } from "../src/enemyPlanVisibility.js";
import { DEAD_CIRCUIT_FIELD_LANDMARKS, TWIN_SEIZURE_FIELD_PLAN } from "../src/fieldPlanData.js";
import { buildAuthoredFormationRoutes } from "../src/fieldRoutes.js";

const landmarks = DEAD_CIRCUIT_FIELD_LANDMARKS;
const roles = Array.from({ length: 5 }, (_, index) => ({ id: `role-${index}` }));
const assignments = Object.fromEntries(roles.map((role, index) => [role.id, `formation-${index}`]));
const samePoint = (left, right) => left.x === right.x && left.y === right.y;

test("Twin Seizure shows complete objective-to-extraction routes", () => {
  const { routes, branchRoutes } = TWIN_SEIZURE_FIELD_PLAN;

  assert.equal(TWIN_SEIZURE_FIELD_PLAN.extractionLandmark, "southMotorPool");
  assert.equal(routes[0].points.at(-1), "southExit");
  assert.equal(routes[1].breakpoint, "beta");
  assert.equal(routes[2].points.at(-1), "southExit");
  assert.equal(branchRoutes.beta.tempo.at(-1), "southExit");
  assert.equal(branchRoutes.beta.protect.at(-1), "southExit");
  assert.equal(branchRoutes.rescue.clock.at(-1), "southExit");
  assert.equal(branchRoutes.rescue.recover.at(-1), "southExit");

  assert.ok(routes[0].points.indexOf("alpha") < routes[0].points.indexOf("reactor"));
  assert.equal(TWIN_SEIZURE_FIELD_PLAN.breakpointRoles.beta, 1);
  assert.ok(routes[2].points.indexOf("alpha") < routes[2].points.indexOf("reactor"));
  routes.forEach((route) => assert.match(route.afterLabel, /MOTOR POOL$/));
});

test("every selected Twin Seizure order is a complete journey ending at extraction", () => {
  for (const beta of ["tempo", "protect"]) {
    for (const rescue of ["clock", "recover"]) {
      const routes = buildAuthoredFormationRoutes({
        plan: TWIN_SEIZURE_FIELD_PLAN,
        landmarks,
        roles,
        assignments,
        branches: { beta, rescue },
      });

      assert.equal(routes.length, 5);
      routes.forEach((route) => {
        assert.deepEqual(route.points.at(-1), landmarks[TWIN_SEIZURE_FIELD_PLAN.extractionLandmark]);
        assert.equal(route.points.slice(0, -1).some((point) => samePoint(point, landmarks[TWIN_SEIZURE_FIELD_PLAN.extractionLandmark])), false);
        assert.ok(route.points.length >= 4, `route ${route.roleIndex + 1} should show its whole movement`);
      });
    }
  }
});

test("the extraction element cannot appear to reach extraction and then reverse", () => {
  const direct = buildAuthoredFormationRoutes({
    plan: TWIN_SEIZURE_FIELD_PLAN,
    landmarks,
    roles,
    assignments,
    branches: { beta: "tempo", rescue: "clock" },
  }).find((route) => route.roleIndex === 4);
  const rescue = buildAuthoredFormationRoutes({
    plan: TWIN_SEIZURE_FIELD_PLAN,
    landmarks,
    roles,
    assignments,
    branches: { beta: "tempo", rescue: "recover" },
  }).find((route) => route.roleIndex === 4);

  assert.deepEqual(direct.points.slice(-2), [
    landmarks.southExit,
    landmarks.southMotorPool,
  ]);
  assert.equal(direct.points.some((point) => samePoint(point, { x: 80, y: 58 })), false);
  assert.deepEqual(rescue.points.slice(-4), [
    landmarks.rescue,
    landmarks.reactorLowerGate,
    landmarks.southExit,
    landmarks.southMotorPool,
  ]);
});

test("enemy deployment forecasts contacts without revealing exact routes", () => {
  assert.equal(enemyContactForecastVisibleFor("plan"), true);
  assert.equal(enemyExactRoutesVisibleFor("plan"), false);
  assert.equal(enemyContactForecastVisibleFor("battle"), false);
  assert.equal(enemyExactRoutesVisibleFor("battle"), true);
  assert.equal(enemyExactRoutesVisibleFor("complete"), true);
});
