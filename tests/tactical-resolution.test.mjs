import assert from "node:assert/strict";
import test from "node:test";

import { resolveFormationImpact, resolveTacticalEngagement } from "../src/tacticalResolution.js";

const enemyOrder = {
  resistance: 8,
  counterCapabilities: ["CONTROL", "DENIAL"],
  counteredBy: ["FURNACE DRAGNET"],
};

const actor = (formationId, capabilities, score = 80, endurance = { armor: 3, cohesion: 3, mobility: 3 }) => ({ formationId, capabilities, score, endurance });

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

test("enemy pressure attacks a specific endurance axis and handoffs absorb part of the hit", () => {
  const exposed = resolveFormationImpact({
    actor: actor("breaker", ["BREACH"], 80, { armor: 5, cohesion: 3, mobility: 2 }),
    enemyOrder: { pressure: { type: "FIREPOWER", target: "armor", strength: 4 } },
    impactScale: 1,
  });
  const supported = resolveFormationImpact({
    actor: { ...actor("breaker", ["BREACH"], 80, { armor: 5, cohesion: 3, mobility: 2 }), inboundReaction: true },
    enemyOrder: { pressure: { type: "FIREPOWER", target: "armor", strength: 4 } },
    impactScale: 1,
  });

  assert.deepEqual({ target: exposed.target, damage: exposed.damage, remaining: exposed.remaining, state: exposed.state }, { target: "armor", damage: 4, remaining: 1, state: "damaged" });
  assert.equal(supported.damage, 3);
  assert.equal(supported.handoffProtection, 1);
});

test("pursuit cuts off a formation only when mobility is exhausted", () => {
  const impact = resolveFormationImpact({
    actor: actor("hauler", ["RECOVERY"], 70, { armor: 3, cohesion: 4, mobility: 4 }),
    enemyOrder: { pressure: { type: "PURSUIT", target: "mobility", strength: 5 } },
    impactScale: 1,
  });

  assert.equal(impact.remaining, 0);
  assert.equal(impact.state, "cut-off");
});

test("malformed endurance and pressure values remain bounded", () => {
  const impact = resolveFormationImpact({
    actor: { formationId: "test", endurance: { armor: -99 } },
    enemyOrder: { pressure: { target: "armor", strength: 999 } },
    impactScale: 999,
  });

  assert.equal(impact.starting, 1);
  assert.equal(impact.strength, 9);
  assert.equal(impact.remaining, 0);
  assert.equal(impact.state, "damaged");
});
