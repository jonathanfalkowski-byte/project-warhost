import assert from "node:assert/strict";
import test from "node:test";

import { battlefieldConsequencesAt } from "../src/battleConsequences.js";

const clash = (actionAt, outcome, actorIds, label = "ENEMY ORDER") => ({
  actionAt,
  label,
  resolution: { outcome, actorIds },
});

test("consequences appear at resolution time and rewind with playback", () => {
  const clashes = [clash(45, "checked", ["harpoon", "furnace"], "BETA SCREEN")];
  assert.deepEqual(battlefieldConsequencesAt({ clashes, battleTime: 44 }).player, {});
  assert.equal(battlefieldConsequencesAt({ clashes, battleTime: 45 }).player.harpoon.state, "delayed");
  assert.deepEqual(battlefieldConsequencesAt({ clashes, battleTime: 10 }).player, {});
});

test("costly contact damages the lead actor and pins its support", () => {
  const state = battlefieldConsequencesAt({
    clashes: [clash(30, "costly", ["breaker", "railjack"], "OATH COUNTER")],
    battleTime: 30,
  });
  assert.equal(state.player.breaker.state, "damaged");
  assert.equal(state.player.railjack.state, "pinned");
  assert.equal(state.enemy[0].state, "pressing");
});

test("a stronger later consequence replaces a weaker earlier state", () => {
  const state = battlefieldConsequencesAt({
    clashes: [
      clash(30, "decisive", ["hauler"], "FIRST ORDER"),
      clash(60, "overrun", ["hauler"], "SECOND ORDER"),
    ],
    battleTime: 60,
  });
  assert.equal(state.player.hauler.state, "cut-off");
  assert.equal(state.player.hauler.cause, "SECOND ORDER");
});

test("an earlier severe state is not erased by later momentum", () => {
  const state = battlefieldConsequencesAt({
    clashes: [
      clash(30, "costly", ["breaker"], "FIRST ORDER"),
      clash(60, "decisive", ["breaker"], "SECOND ORDER"),
    ],
    battleTime: 60,
  });
  assert.equal(state.player.breaker.state, "damaged");
  assert.equal(state.player.breaker.cause, "FIRST ORDER");
});

test("starved and malformed clashes do not invent player damage", () => {
  const state = battlefieldConsequencesAt({
    clashes: [clash(20, "starved", [], "UPSTREAM"), null, { actionAt: "later", resolution: { outcome: "overrun", actorIds: ["ghost"] } }],
    battleTime: 999,
  });
  assert.deepEqual(state.player, {});
  assert.equal(state.enemy[0].state, "starved");
  assert.equal(state.enemy[2], undefined);
  assert.deepEqual(battlefieldConsequencesAt({ clashes: "invalid", battleTime: "invalid" }).active, []);
});

test("specific endurance impacts replace generic outcome labels with causal combat detail", () => {
  const state = battlefieldConsequencesAt({
    clashes: [{
      actionAt: 30,
      label: "GANTRY SEVER",
      resolution: {
        outcome: "overrun",
        actorIds: ["hauler"],
        actorImpacts: [{
          formationId: "hauler",
          target: "mobility",
          pressureType: "PURSUIT",
          starting: 4,
          damage: 4,
          remaining: 0,
          state: "cut-off",
        }],
      },
    }],
    battleTime: 30,
  });

  assert.equal(state.player.hauler.state, "cut-off");
  assert.equal(state.player.hauler.cause, "GANTRY SEVER · PURSUIT MOBILITY 4→0");
  assert.equal(state.player.hauler.combat.remaining, 0);
});
