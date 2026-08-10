import assert from "node:assert/strict";
import test from "node:test";

import { STRATEGY_TRIALS, strategyTrialFor, strategyTrialResult } from "../src/strategyExperiment.js";

const FORMATION_IDS = new Set(["harpoon", "furnace", "breaker", "railjack", "hauler"]);
const ROLE_IDS = new Set(["pull", "burn", "break", "anchor", "recover"]);

test("controlled trials use the same mission inputs and every formation exactly once", () => {
  STRATEGY_TRIALS.forEach((trial) => {
    assert.equal(trial.playbookId, "trapline");
    assert.equal(trial.conditionId, "clear");
    assert.deepEqual(new Set(Object.keys(trial.assignments)), ROLE_IDS);
    assert.deepEqual(new Set(Object.values(trial.assignments)), FORMATION_IDS);
    assert.deepEqual(new Set(Object.keys(trial.branches)), new Set(["beta", "rescue"]));
    assert.ok(["tempo", "protect"].includes(trial.branches.beta));
    assert.ok(["clock", "recover"].includes(trial.branches.rescue));
  });
});

test("controlled trials define ordered extraction bands", () => {
  const [disjointed, cautious, coordinated] = STRATEGY_TRIALS;
  assert.ok(disjointed.expectedExtraction.max < cautious.expectedExtraction.min);
  assert.ok(cautious.expectedExtraction.max < coordinated.expectedExtraction.min);
});

test("trial lookup and result classification fail closed", () => {
  assert.equal(strategyTrialFor("unknown"), null);
  const trial = strategyTrialFor("coordinated");
  assert.equal(strategyTrialResult(trial, 4).withinExpected, true);
  assert.equal(strategyTrialResult(trial, 99).extracted, 20);
  assert.equal(strategyTrialResult(null, 4), null);
});
