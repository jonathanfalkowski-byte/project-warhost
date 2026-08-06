import assert from "node:assert/strict";
import test from "node:test";

import { resolveTacticalEngagement } from "../src/tacticalResolution.js";

const enemyOrder = {
  resistance: 8,
  counterCapabilities: ["CONTROL", "DENIAL"],
  counteredBy: ["FURNACE DRAGNET"],
};

const actor = (formationId, capabilities, score = 80) => ({ formationId, capabilities, score });

test("aligned formations plus an exact handoff counter break an enemy order", () => {
  const result = resolveTacticalEngagement({
    actors: [actor("harpoon", ["CONTROL"]), actor("furnace", ["DENIAL"])],
    maneuver: { name: "FURNACE DRAGNET" },
    enemyOrder,
  });

  assert.equal(result.outcome, "decisive");
  assert.equal(result.impactScale, 0);
  assert.equal(result.playerScore, 10);
  assert.deepEqual(result.actorIds, ["harpoon", "furnace"]);
});

test("a useful but non-countering handoff checks rather than breaks the order", () => {
  const result = resolveTacticalEngagement({
    actors: [actor("harpoon", ["CONTROL"]), actor("furnace", ["DENIAL"])],
    maneuver: { name: "TOWED BASTION" },
    enemyOrder,
  });

  assert.equal(result.outcome, "checked");
  assert.equal(result.impactScale, 0.5);
  assert.equal(result.counterActorName, null);
});

test("placement capability changes move the same order from costly to overrun", () => {
  const costly = resolveTacticalEngagement({
    actors: [actor("railjack", ["CONTROL", "DENIAL"])],
    enemyOrder: { ...enemyOrder, resistance: 7 },
  });
  const overrun = resolveTacticalEngagement({
    actors: [actor("hauler", ["RECOVERY", "SUPPORT"], 65)],
    enemyOrder: { ...enemyOrder, resistance: 7 },
  });

  assert.equal(costly.outcome, "costly");
  assert.equal(overrun.outcome, "overrun");
  assert.deepEqual(overrun.missingCapabilities, ["CONTROL", "DENIAL"]);
});

test("malformed numeric and array inputs are bounded safely", () => {
  const result = resolveTacticalEngagement({
    actors: [{ formationId: "test", score: 999, capabilities: ["CONTROL", null, "CONTROL"] }],
    enemyOrder: { resistance: -100, counterCapabilities: ["CONTROL", null, "CONTROL"], counteredBy: "not-an-array" },
  });

  assert.equal(result.averageReadiness, 100);
  assert.equal(result.enemyScore, 1);
  assert.deepEqual(result.matchedCapabilities, ["CONTROL"]);
  assert.equal(result.counterActorName, null);
});

