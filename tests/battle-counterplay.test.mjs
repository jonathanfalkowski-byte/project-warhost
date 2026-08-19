import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CIRCUIT_CLASH, armyFor, buildEnemyForce } from "../src/battle/battleMission.js";
import { COUNTER_PASSES, COUNTER_SHORTLIST, SHORTLIST, buildArmyList } from "../src/battle/enemyArmy.js";
import { plansFor } from "../src/battle/battlePlans.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { applyBattle, engagementFor, startRun } from "../src/battle/campaign.js";
import { FORMATIONS } from "../src/formationData.js";

// The enemy reads the player's last engagement and builds against it. These guard the two
// things that makes it worth having: it has to CHANGE the list, and it has to change it
// for the better — the first attempt at this made the enemy measurably worse.

const mission = CIRCUIT_CLASH;
const army = armyFor(mission.id);
const nameById = new Map(FORMATIONS.map((formation) => [formation.id, formation.name]));
const dominionPlan = plansFor("dominion")[0];

const counterOf = (order) => ({ order, planId: dominionPlan.id, disposition: "dominion" });

const fight = (order, foe) => {
  const units = order.map((formationId, index) => deployUnit({
    formationId, name: nameById.get(formationId), position: mission.playerDeployment[index], id: `${formationId}#${index}`,
  }));
  const orders = Object.fromEntries(order.map((formationId, index) => [`${formationId}#${index}`, mission.objectives[Math.min(index, 4)].id]));
  const result = resolveBattle({
    playerUnits: units, enemyUnits: foe.units, objectives: mission.objectives,
    playerOrders: orders, enemyOrders: foe.orders, enemyPaths: foe.paths,
    playerDisposition: "dominion", enemyDisposition: foe.disposition, missionId: mission.id,
  });
  return result.playerScore - result.enemyScore;
};

test("reading the player changes the list they face", () => {
  const blind = buildArmyList({ mission, plan: dominionPlan, disposition: "dominion", seed: 0 });
  const read = buildArmyList({
    mission, plan: dominionPlan, disposition: "dominion", seed: 0,
    counter: counterOf(["carriage", "railjack", "command", "bastion", "hauler"]),
  });
  assert.notDeepEqual(read, blind, "the enemy fielded exactly the same list against an army it had studied");
  // It still fills every slot, and never twice with the same hull.
  assert.equal(read.length, blind.length);
  assert.equal(new Set(read.map((entry) => entry.formationId)).size, read.length, "the enemy fielded two of one hull");
  // Nothing outside the shortlist: every hull it brings still fits the slot it stands in.
  assert.ok(COUNTER_SHORTLIST > SHORTLIST, "the counter considers no more candidates than a blind list does");
  assert.ok(COUNTER_PASSES >= 2, "one pass answers the early slots against a list the enemy no longer has");
});

test("the enemy that has read you beats the list it read", () => {
  // The point of the layer, and the thing the first attempt got backwards: scoring hulls by
  // one-on-one duels on bare ground made the enemy WORSE, because this is not a game of
  // duels. It replays the actual engagement now.
  const lists = [
    ["skimmer", "carriage", "command", "harpoon", "hauler"],
    ["railjack", "hauler", "command", "harpoon", "furnace"],
    ["bastion", "railjack", "command", "carriage", "hauler"],
  ];
  let better = 0;
  for (const list of lists) {
    const blind = buildEnemyForce(mission, army, { disposition: "dominion", planId: dominionPlan.id, seed: 0 });
    const read = buildEnemyForce(mission, army, { disposition: "dominion", planId: dominionPlan.id, seed: 0, counter: counterOf(list) });
    if (fight(list, read) < fight(list, blind)) better += 1;
  }
  assert.ok(better >= 2, `reading the player helped in only ${better} of ${lists.length} engagements`);
});

test("an army it has not seen is built blind", () => {
  // No history, no reading. The first engagement of a run, and the sweep's control enemy,
  // both have to be exactly the army they were before this existed.
  const blind = buildArmyList({ mission, plan: dominionPlan, disposition: "dominion", seed: 3 });
  for (const counter of [null, undefined, { order: [], planId: dominionPlan.id, disposition: "dominion" },
    { order: [null, null, null, null, null], planId: dominionPlan.id, disposition: "dominion" }]) {
    assert.deepEqual(buildArmyList({ mission, plan: dominionPlan, disposition: "dominion", seed: 3, counter }), blind);
  }
});

test("a run remembers what it fielded, and the enemy reads it", () => {
  const started = { ...startRun({ seed: 4 }), enemyPolicy: "varied" };
  const order = ["railjack", "hauler", "command", "harpoon", "furnace"];
  const after = applyBattle({
    run: started, result: { playerScore: 6, enemyScore: 3, rounds: [] }, won: true,
    deployedIds: [], disposition: "dominion", fielded: order, planId: dominionPlan.id,
  });
  assert.deepEqual(after.history.at(-1).fielded, { order, planId: dominionPlan.id, disposition: "dominion" });

  const next = engagementFor(after);
  assert.deepEqual(next.read.order, order, "the next engagement was not built against what was fielded");
  assert.ok(Array.isArray(next.blind), "the screen cannot say what they would have brought otherwise");
  // And the control enemy is blind, whatever the run remembers — it is the instrument every
  // claim about the player's choices is measured on.
  const control = engagementFor({ ...after, enemyPolicy: "control" });
  assert.equal(control.read, null, "the control enemy read the player");
  assert.equal(control.blind, null);
});

test("nothing is fielded that the player was not told about", () => {
  // The disclosure principle, restated for a reading enemy: what it read is the player's
  // own last five, and the brief says so. The only thing hidden is still the hand.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  assert.match(source, /THEY HAVE STUDIED YOUR LAST ENGAGEMENT/, "the screen never says the enemy adapted");
  assert.match(source, /engagement\.blind/, "the brief cannot say what they changed");
});
