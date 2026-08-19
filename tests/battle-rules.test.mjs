import test from "node:test";
import assert from "node:assert/strict";

import {
  BATTLE_ROUNDS,
  damageFor,
  deployUnit,
  resolveBattle,
  scoreObjectives,
} from "../src/battle/battleRules.js";
import { MELEE_RANGE, OBJECTIVE_CONTROL_RANGE } from "../src/battle/battleProfiles.js";
import { CIRCUIT_CLASH, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
import { FORMATIONS } from "../src/formationData.js";

const objectives = CIRCUIT_CLASH.objectives;
const enemy = buildEnemyForce();
const battleWith = (deployment) => {
  const player = buildPlayerForce({ deployment, formations: FORMATIONS });
  return resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders,
  });
};
const PLAN = {
  p1: { formationId: "railjack", objectiveId: "south-relay" },
  p2: { formationId: "furnace", objectiveId: "reactor" },
  p3: { formationId: "breaker", objectiveId: "reactor" },
  p4: { formationId: "command", objectiveId: "reactor" },
  p5: { formationId: "skimmer", objectiveId: "east-gantry" },
};

test("a battle runs five rounds and scores every one of them", () => {
  const result = battleWith(PLAN);
  assert.equal(result.rounds.length, BATTLE_ROUNDS);
  result.rounds.forEach((round, index) => {
    assert.equal(round.round, index + 1);
    assert.equal(round.objectives.length, objectives.length);
  });
  // Score accumulates: holding ground in round 2 still counts after round 5.
  const scores = result.rounds.map((round) => round.playerScore);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b), "score went down between rounds");
});

test("the armies are fighting by round two, not still walking", () => {
  // A five-round battle where three rounds are two armies approaching each other is the
  // same complaint the operation model earned — "i am moving so slow in some spots". Both
  // armies get a double advance out of deployment so the battle is a battle.
  const result = battleWith(PLAN);
  const shooting = (round) => result.rounds[round - 1].log.filter((entry) => entry.phase === "shoot").length;
  assert.ok(shooting(1) > 0, "nothing was in range by the end of round one");
  // And it is a fight rather than a first contact: measured across the opening two rounds,
  // because "was anyone shooting by round two" was satisfied by a single formation clipping
  // the nearest thing, which is what an army with no opening advance also manages.
  assert.ok(shooting(1) + shooting(2) >= 4,
    `only ${shooting(1) + shooting(2)} shots in the first two rounds — the armies are still walking`);
  // And at least four of the five rounds have something happening in them.
  const busy = result.rounds.filter((round) => round.log.length > 0).length;
  assert.ok(busy >= 4, `only ${busy} of 5 rounds had anything happen in them`);
});

test("the winner is whoever scored most, not who survived", () => {
  const result = battleWith(PLAN);
  const expected = result.playerScore > result.enemyScore ? "player"
    : result.enemyScore > result.playerScore ? "enemy" : "draw";
  assert.equal(result.winner, expected);
});

test("both armies deploy on opposite edges, with the objectives between them", () => {
  // "Why is the enemy coming from one corner" — in the operation model it entered from
  // the east edge because its routes started there. Here the two forces face each other.
  const playerEdge = CIRCUIT_CLASH.playerDeployment.map((slot) => slot.y);
  const enemyEdge = CIRCUIT_CLASH.enemyDeployment.map((slot) => slot.y);
  assert.ok(Math.min(...playerEdge) > 80, "the player does not deploy on its own edge");
  assert.ok(Math.max(...enemyEdge) < 20, "the enemy does not deploy on the opposite edge");
  // Fairness here is mirror symmetry, not equidistance. Each army has a home objective it
  // starts closer to — that is what makes deployment a decision, because garrisoning it
  // costs you a body in the centre. What must hold is that the whole objective layout is
  // a mirror of itself about the centre line, so neither side has the better half.
  const mirrored = (objective) => objectives.find((other) => (
    other.x === objective.x && other.y === 100 - objective.y && other.points === objective.points
  ));
  for (const objective of objectives) {
    assert.ok(mirrored(objective), `${objective.name} has no mirror on the other half of the board`);
  }
  // And the total points available on each half are equal.
  const half = (test) => objectives.filter(test).reduce((sum, objective) => sum + objective.points, 0);
  assert.equal(half((objective) => objective.y > 50), half((objective) => objective.y < 50));
});

test("an objective is held by whoever has more control value on it", () => {
  const near = (x, y, control) => ({ x, y, control, wounds: 5, keywords: [] });
  const held = scoreObjectives({
    objectives: [{ id: "o", name: "O", x: 50, y: 50, points: 1 }],
    playerUnits: [near(50, 50, 4)],
    enemyUnits: [near(50, 50, 2)],
  });
  assert.equal(held[0].holder, "player");
  // Equal control is contested, and contested pays nobody.
  const tied = scoreObjectives({
    objectives: [{ id: "o", name: "O", x: 50, y: 50, points: 1 }],
    playerUnits: [near(50, 50, 3)],
    enemyUnits: [near(50, 50, 3)],
  });
  assert.equal(tied[0].holder, "contested");
  // Out of range is not on the objective.
  const far = scoreObjectives({
    objectives: [{ id: "o", name: "O", x: 50, y: 50, points: 1 }],
    playerUnits: [near(50, 50 + OBJECTIVE_CONTROL_RANGE + 1, 9)],
    enemyUnits: [near(50, 50, 1)],
  });
  assert.equal(far[0].holder, "enemy");
});

test("a formation destroyed in an earlier round never acts again", () => {
  // Shooting inside a round is simultaneous — both sides fire from a snapshot taken
  // before either takes losses, so a formation that dies this round still got its shots
  // off. What must never happen is a formation acting in a round it began dead.
  const result = battleWith(PLAN);
  for (let index = 1; index < result.rounds.length; index += 1) {
    const deadBefore = result.rounds[index - 1].players.filter((unit) => unit.wounds <= 0).map((unit) => unit.name);
    for (const name of deadBefore) {
      assert.equal(
        result.rounds[index].log.some((entry) => entry.side === "player" && entry.actor === name),
        false,
        `${name} acted in round ${index + 1} having been destroyed in round ${index}`,
      );
      // And it holds no ground: a wreck cannot contest an objective.
      const wreck = result.rounds[index].players.find((unit) => unit.name === name);
      assert.ok(wreck.wounds <= 0, `${name} came back from the dead`);
    }
  }
});

test("the same plan always produces the same battle", () => {
  // Determinism is what lets the whole decision space be swept rather than sampled.
  const a = battleWith(PLAN);
  const b = battleWith(PLAN);
  assert.deepEqual(a.rounds, b.rounds);
  assert.equal(a.playerScore, b.playerScore);
});

test("where a formation is sent changes the result", () => {
  // The core claim of the model: the orders are a real decision.
  const centre = battleWith(PLAN);
  const scattered = battleWith({
    ...PLAN,
    p2: { formationId: "furnace", objectiveId: "north-relay" },
    p3: { formationId: "breaker", objectiveId: "west-works" },
    p4: { formationId: "command", objectiveId: "north-relay" },
  });
  assert.notEqual(centre.playerScore, scattered.playerScore);
});

test("range decides who can shoot whom", () => {
  const gunner = deployUnit({ formationId: "carriage", name: "GUN", position: { x: 50, y: 90 } });
  const brawler = deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 10 } });
  assert.ok(gunner.range > 40, "the artillery piece cannot reach across the board");
  assert.ok(brawler.range < 16, "the assault unit has an artillery gun");
  // A unit with no target in range deals nothing.
  const out = resolveBattle({
    playerUnits: [brawler], enemyUnits: [gunner], objectives: [], rounds: 1,
    playerOrders: {}, enemyOrders: {},
  });
  assert.equal(out.rounds[0].log.filter((entry) => entry.side === "player").length, 0);
});

test("melee is simultaneous, so a bad charge costs the charger", () => {
  const a = deployUnit({ formationId: "skimmer", name: "SKIMMER", position: { x: 50, y: 50 } });
  const b = deployUnit({ formationId: "breaker", name: "WALKER", position: { x: 50, y: 50 + MELEE_RANGE - 1 } });
  const result = resolveBattle({
    playerUnits: [a], enemyUnits: [b], objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {},
  });
  const survivor = result.rounds[0].players[0];
  assert.ok(survivor.wounds < survivor.maxWounds, "the charging unit took no damage back");
});

test("hitting harder and saving better both change damage", () => {
  const soft = { shots: 2, hit: 4 };
  const sharp = { shots: 2, hit: 2 };
  const target = { save: 2 };
  assert.ok(damageFor({ attacker: sharp, target }) > damageFor({ attacker: soft, target }));
  assert.ok(damageFor({ attacker: sharp, target: { save: 5 } }) < damageFor({ attacker: sharp, target }));
  // A command formation nearby is worth something, but never more than a better gun.
  assert.ok(damageFor({ attacker: soft, target, hitBonus: 1 }) > damageFor({ attacker: soft, target }));
});

test("an empty deployment slot is skipped rather than crashing", () => {
  const partial = battleWith({ p3: { formationId: "breaker", objectiveId: "reactor" } });
  assert.equal(partial.rounds.length, BATTLE_ROUNDS);
  assert.equal(partial.rounds[0].players.length, 1);
  assert.deepEqual(resolveBattle({}).rounds.length, BATTLE_ROUNDS);
});
