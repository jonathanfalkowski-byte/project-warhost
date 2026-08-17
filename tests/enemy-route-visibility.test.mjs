import test from "node:test";
import assert from "node:assert/strict";

import {
  ENEMY_ROUTE_LEAD_SECONDS,
  enemyRouteLineVisible,
  enemyRoutePhaseFor,
  enemyRouteProgressFor,
  enemyRouteStopVisible,
  reinforcementRouteVisible,
} from "../src/enemyRouteVisibility.js";
import { ENEMY_PLANS } from "../src/enemyPlanData.js";
import { OPERATIONS, reinforcementWaveFor } from "../src/operationData.js";
import { missionPressuresForOperation, missionPressureFor } from "../src/missionPressure.js";

const phaseAt = (battleTime, actionAt) => enemyRoutePhaseFor({ battleTime, actionAt, routesVisible: true });

test("an order's route is drawn only while that order is closing", () => {
  const actionAt = 225;
  assert.equal(phaseAt(0, actionAt), "pending");
  assert.equal(phaseAt(actionAt - ENEMY_ROUTE_LEAD_SECONDS - 1, actionAt), "pending");
  assert.equal(phaseAt(actionAt - ENEMY_ROUTE_LEAD_SECONDS, actionAt), "closing");
  assert.equal(phaseAt(actionAt - 1, actionAt), "closing");
  assert.equal(phaseAt(actionAt, actionAt), "resolved");
  assert.equal(phaseAt(actionAt + 500, actionAt), "resolved");

  assert.equal(enemyRouteLineVisible("closing"), true);
  for (const other of ["pending", "resolved", "forecast"]) {
    assert.equal(enemyRouteLineVisible(other), false, `${other} must not draw a line`);
  }
});

test("before execution there is no movement at all, only a forecast", () => {
  assert.equal(enemyRoutePhaseFor({ battleTime: 200, actionAt: 225, routesVisible: false }), "forecast");
  assert.equal(enemyRouteLineVisible("forecast"), false);
});

// The regression this whole module exists for: the field used to carry every enemy
// route plus the reinforcement lane, permanently, from the first frame.
test("no two enemy routes are ever drawn at the same time, in any operation", () => {
  for (const [operationId, plan] of Object.entries(ENEMY_PLANS)) {
    const operation = OPERATIONS.find((item) => item.id === operationId) ?? OPERATIONS[0];
    for (const pressure of missionPressuresForOperation(operation.id)) {
      const wave = reinforcementWaveFor(operation, missionPressureFor(pressure.id, operation.id));
      const waveApproachAt = wave.arrivalAt - wave.approachDuration;
      const horizon = Math.max(wave.arrivalAt, ...plan.formations.map((formation) => formation.actionAt)) + 60;

      for (let battleTime = 0; battleTime <= horizon; battleTime += 1) {
        const lines = plan.formations.filter(
          (formation) => enemyRouteLineVisible(phaseAt(battleTime, formation.actionAt)),
        ).length;
        assert.ok(lines <= 1, `${operationId}/${pressure.id} draws ${lines} enemy routes at t=${battleTime}`);

        const waveLine = reinforcementRouteVisible({ battleTime, approachAt: waveApproachAt, routesVisible: true }) ? 1 : 0;
        assert.ok(
          lines + waveLine <= 2,
          `${operationId}/${pressure.id} draws ${lines + waveLine} lanes at t=${battleTime}`,
        );
      }
    }
  }
});

test("the authored order clocks stay far enough apart for the lead-in to hold", () => {
  // If an operation ever authors two orders closer together than the lead-in, the
  // one-line-at-a-time guarantee above would start failing. Catch that at the data.
  for (const [operationId, plan] of Object.entries(ENEMY_PLANS)) {
    const clocks = plan.formations.map((formation) => formation.actionAt).sort((a, b) => a - b);
    for (let index = 1; index < clocks.length; index += 1) {
      assert.ok(
        clocks[index] - clocks[index - 1] >= ENEMY_ROUTE_LEAD_SECONDS,
        `${operationId} authors orders ${clocks[index - 1]}s and ${clocks[index]}s apart, inside the ${ENEMY_ROUTE_LEAD_SECONDS}s lead-in`,
      );
    }
  }
});

test("the reinforcement lane earns its line only once inbound", () => {
  assert.equal(reinforcementRouteVisible({ battleTime: 0, approachAt: 300, routesVisible: true }), false);
  assert.equal(reinforcementRouteVisible({ battleTime: 299, approachAt: 300, routesVisible: true }), false);
  assert.equal(reinforcementRouteVisible({ battleTime: 300, approachAt: 300, routesVisible: true }), true);
  assert.equal(reinforcementRouteVisible({ battleTime: 400, approachAt: 300, routesVisible: false }), false);
});

test("a formation holds on its staging edge, then covers its route inside the window", () => {
  const actionAt = 330;
  const start = actionAt - ENEMY_ROUTE_LEAD_SECONDS;
  const progressAt = (battleTime) => enemyRouteProgressFor({
    battleTime,
    actionAt,
    routePhase: phaseAt(battleTime, actionAt),
  });

  assert.equal(progressAt(0), 0, "it waits at its staging edge rather than drifting from frame one");
  assert.equal(progressAt(start - 1), 0);
  assert.equal(progressAt(start), 0, "it starts its route exactly where it was holding — no jump");
  assert.equal(progressAt(start + ENEMY_ROUTE_LEAD_SECONDS / 2), 0.5);
  assert.equal(progressAt(actionAt), 1, "it arrives exactly as the order lands");
  assert.equal(progressAt(actionAt + 90), 1, "and stays there");

  // Monotonic: a formation never appears to reverse.
  let previous = -1;
  for (let battleTime = 0; battleTime <= actionAt + 30; battleTime += 1) {
    const value = progressAt(battleTime);
    assert.ok(value >= previous, `progress went backwards at t=${battleTime}`);
    previous = value;
  }
});

test("the endpoint marker replaces the route rather than accompanying it forever", () => {
  assert.equal(enemyRouteStopVisible("pending"), false);
  assert.equal(enemyRouteStopVisible("closing"), true);
  assert.equal(enemyRouteStopVisible("resolved"), true);
  assert.equal(enemyRouteStopVisible("forecast"), false);
});

test("malformed timing fails closed to a held order, never to a stray line", () => {
  assert.equal(enemyRoutePhaseFor({ battleTime: Number.NaN, actionAt: 90, routesVisible: true }), "pending");
  assert.equal(enemyRoutePhaseFor({ battleTime: 90, actionAt: undefined, routesVisible: true }), "pending");
  assert.equal(enemyRoutePhaseFor({}), "forecast");
  assert.equal(enemyRouteProgressFor({}), 0);
  assert.equal(enemyRouteProgressFor({ battleTime: 10, actionAt: 90, routePhase: "closing", leadSeconds: 0 }), 0);
  assert.equal(reinforcementRouteVisible({}), false);
});
