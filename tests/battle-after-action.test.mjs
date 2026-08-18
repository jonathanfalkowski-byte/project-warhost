import test from "node:test";
import assert from "node:assert/strict";

import { afterActionFor } from "../src/battle/afterAction.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { CIRCUIT_CLASH, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
import { plansFor } from "../src/battle/battlePlans.js";
import { FORMATIONS } from "../src/formationData.js";

const mission = CIRCUIT_CLASH;
const enemy = buildEnemyForce(mission);
const deployment = Object.fromEntries(mission.playerDeployment.map((slot, index) => [
  slot.id, { formationId: ["railjack", "furnace", "breaker", "command", "skimmer"][index] },
]));
const battle = (disposition) => {
  const built = buildPlayerForce({ mission, deployment, formations: FORMATIONS, battlePlan: plansFor(disposition)[0] });
  const result = resolveBattle({
    playerUnits: built.units, enemyUnits: enemy.units, objectives: mission.objectives,
    playerOrders: built.orders, enemyOrders: enemy.orders,
    playerPaths: built.paths, enemyPaths: enemy.paths,
    playerDisposition: disposition, enemyDisposition: "dominion",
  });
  return afterActionFor({ result, objectives: mission.objectives, disposition });
};

test("every formation that was deployed is accounted for", () => {
  // "Apparently i left crew behind and it is a green triangle -- misleading." A readout
  // that quietly drops a formation is worse than no readout.
  const report = battle("dominion");
  assert.equal(report.formations.length, 5);
  const names = report.formations.map((entry) => entry.name).sort();
  assert.deepEqual(names, [...names].sort());
  for (const entry of report.formations) {
    assert.ok(entry.name && entry.id, "a formation came back without a name");
    assert.ok(entry.note.length > 10, `${entry.name} has no readable note`);
    assert.ok(Number.isFinite(entry.contribution) && entry.contribution >= 0 && entry.contribution <= 100);
  }
});

test("the measure follows what the disposition actually pays for", () => {
  // Measuring a formation against a job it was never given is worse than not measuring it.
  assert.equal(battle("dominion").measure, "ground");
  assert.equal(battle("safeguard").measure, "ground");
  // ERADICATION darkens every marker, so there is no ground to be measured against.
  assert.equal(battle("eradication").measure, "damage");
  const ground = battle("dominion");
  const damage = battle("eradication");
  assert.notDeepEqual(
    ground.formations.map((entry) => `${entry.name}:${entry.contribution}`),
    damage.formations.map((entry) => `${entry.name}:${entry.contribution}`),
    "the two measures ranked the army identically, so one of them is not being applied",
  );
  assert.match(ground.formations[0].note, /Held ground|Held no scoring ground|without holding/);
  assert.match(damage.formations[0].note, /Dealt|range/);
});

test("contributions are shares of one whole and are ordered by it", () => {
  for (const disposition of ["dominion", "eradication", "safeguard"]) {
    const report = battle(disposition);
    const total = report.formations.reduce((sum, entry) => sum + entry.contribution, 0);
    // Integer percentages of a share, so rounding can move the total a few points either
    // way — but never far, and never past 100 by more than the number of rows.
    assert.ok(Math.abs(total - 100) <= report.formations.length, `${disposition} totalled ${total}%`);
    const ordered = report.formations.map((entry) => entry.contribution);
    assert.deepEqual(ordered, [...ordered].sort((a, b) => b - a), `${disposition} is not ordered by contribution`);
  }
});

test("a formation that did nothing is said to have done nothing", () => {
  // The old debrief drew a green tick beside a formation that had been left behind. A
  // zero has to read as a zero.
  const idle = deployUnit({ formationId: "carriage", name: "IDLE", position: { x: 4, y: 98 } });
  const result = resolveBattle({
    playerUnits: [idle], enemyUnits: [], objectives: mission.objectives, rounds: 5,
    playerOrders: {}, enemyOrders: {}, playerPaths: { carriage: [{ x: 4, y: 98 }] },
  });
  const report = afterActionFor({ result, objectives: mission.objectives, disposition: "dominion" });
  assert.equal(report.formations[0].contribution, 0);
  assert.equal(report.formations[0].dealt, 0);
  assert.match(report.formations[0].note, /Held no scoring ground/);
  assert.equal(report.formations[0].survived, true);
});

test("a destroyed formation says when it was lost, once", () => {
  const axe = deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 50 } });
  const killer = deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 52 } });
  const result = resolveBattle({
    playerUnits: [{ ...axe, wounds: 1 }], enemyUnits: [killer], objectives: [], rounds: 5,
    playerOrders: {}, enemyOrders: {},
  });
  const entry = afterActionFor({ result, objectives: [], disposition: "eradication" }).formations[0];
  assert.equal(entry.survived, false);
  assert.equal(entry.lostInRound, 1, "the round it was lost in is wrong");
  assert.match(entry.note, /round 1/);
  // Losing it once must not keep re-reporting it in every later round.
  assert.equal((entry.note.match(/round/g) ?? []).length, 1);
});

test("holding ground only counts when your side actually held it", () => {
  // Standing on an objective the enemy is holding is not holding it, and a readout that
  // counted it would tell the player their plan worked when it did not.
  const contested = deployUnit({ formationId: "skimmer", name: "PRESENT", position: { x: 50, y: 50 } });
  const stronger = deployUnit({ formationId: "railjack", name: "THEIRS", position: { x: 50, y: 50 } });
  const result = resolveBattle({
    playerUnits: [contested], enemyUnits: [stronger],
    objectives: [{ id: "o", name: "O", x: 50, y: 50, points: 1 }], rounds: 3,
    playerOrders: {}, enemyOrders: {},
  });
  const entry = afterActionFor({
    result, objectives: [{ id: "o", name: "O", x: 50, y: 50, points: 1 }], disposition: "dominion",
  }).formations[0];
  assert.equal(entry.objectiveRounds, 0, "a formation was credited for ground the enemy held");
});

test("a wreck stops holding the ground it was standing on", () => {
  // A destroyed formation is not still contesting an objective, and a readout that kept
  // counting it would credit a plan for ground it lost — the exact class of misleading
  // debrief that "apparently i left crew behind and it is a green triangle" was about.
  //
  // The anchor keeps the objective in the player's hands after the doomed one dies, so
  // the only thing that can stop the wreck being credited is its own wounds.
  const site = { id: "o", name: "O", x: 50, y: 50, points: 1 };
  const anchor = deployUnit({ formationId: "railjack", name: "ANCHOR", position: { x: 50, y: 48 } });
  const doomed = { ...deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 52 } }), wounds: 0.4 };
  // Far enough out to shoot but too far to contest the objective itself.
  const gun = deployUnit({ formationId: "carriage", name: "GUN", position: { x: 50, y: 74 } });
  const result = resolveBattle({
    playerUnits: [anchor, doomed], enemyUnits: [gun], objectives: [site], rounds: 5,
    playerOrders: {}, enemyOrders: {},
    playerPaths: { railjack: [{ x: 50, y: 48 }], skimmer: [{ x: 50, y: 52 }] },
    enemyPaths: { "enemy-carriage": [{ x: 50, y: 74 }] },
  });
  assert.equal(result.rounds.at(-1).objectives[0].holder, "player", "the fixture lost the objective, so it proves nothing");
  const report = afterActionFor({ result, objectives: [site], disposition: "dominion" });
  const wreck = report.formations.find((entry) => entry.name === "DOOMED");
  const held = report.formations.find((entry) => entry.name === "ANCHOR");
  assert.equal(wreck.survived, false, "the fixture did not die, so it proves nothing");
  assert.ok(held.objectiveRounds >= 4, `the anchor only held for ${held.objectiveRounds} rounds`);
  assert.ok(
    wreck.objectiveRounds < held.objectiveRounds,
    `a wreck was credited with ${wreck.objectiveRounds} rounds of holding ground, the same as the formation that survived`,
  );
});

test("an empty battle reports nothing rather than crashing", () => {
  assert.deepEqual(afterActionFor({}), { formations: [], measure: "ground", basis: 0 });
  const empty = resolveBattle({});
  assert.deepEqual(afterActionFor({ result: empty, objectives: mission.objectives }).formations, []);
});
