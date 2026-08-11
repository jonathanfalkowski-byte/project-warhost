import assert from "node:assert/strict";
import test from "node:test";
import {
  DEAD_CIRCUIT_PRESSURES,
  fieldPlanForPressure,
  missionPressureFor,
  missionPressuresForOperation,
  playbookTimingForPressure,
  roleDemandsForPressure,
  waveArrivalForPressure,
} from "../src/missionPressure.js";

test("Dead Circuit exposes exactly three mission pressures", () => {
  assert.deepEqual(
    missionPressuresForOperation("dead-circuit").map((item) => item.id),
    ["fractured-transit", "reactor-window", "early-relief"],
  );
  assert.equal(DEAD_CIRCUIT_PRESSURES.length, 3);
});

test("pressures change responsibilities without mutating the playbook role", () => {
  const role = { demands: ["DENIAL", "COVER"] };
  const result = roleDemandsForPressure(role, 1, missionPressureFor("fractured-transit"));
  assert.deepEqual(result, ["MOBILITY", "CONTROL"]);
  assert.deepEqual(role.demands, ["DENIAL", "COVER"]);
});

test("each pressure favors a different playbook clock", () => {
  const fractured = missionPressureFor("fractured-transit");
  const reactor = missionPressureFor("reactor-window");
  const relief = missionPressureFor("early-relief");
  assert.ok(playbookTimingForPressure(fractured, "trapline") < playbookTimingForPressure(fractured, "spear"));
  assert.ok(playbookTimingForPressure(reactor, "pressure") < playbookTimingForPressure(reactor, "trapline"));
  assert.ok(playbookTimingForPressure(relief, "spear") < playbookTimingForPressure(relief, "pressure"));
});

test("early relief changes the disclosed enemy-wave clock", () => {
  assert.equal(waveArrivalForPressure(360, missionPressureFor("early-relief")), 315);
});

test("pressure geometry redraws a copied plan and preserves the source", () => {
  const plan = { positions: [{ x: 20, y: 30 }, { x: 40, y: 50 }], routes: [[0, "alpha"], [1, "beta"]] };
  const result = fieldPlanForPressure(plan, missionPressureFor("reactor-window"), "pressure");
  assert.notDeepEqual(result.positions, plan.positions);
  assert.deepEqual(plan.positions, [{ x: 20, y: 30 }, { x: 40, y: 50 }]);
  assert.equal(result.routes, plan.routes);
});

test("unknown ids fail closed and numeric modifiers are bounded", () => {
  assert.equal(missionPressureFor("not-real").id, "fractured-transit");
  assert.equal(playbookTimingForPressure({ playbookTiming: { trapline: 999 } }, "trapline"), 60);
  assert.equal(waveArrivalForPressure(90, { waveArrivalShift: -999 }), 60);
});
