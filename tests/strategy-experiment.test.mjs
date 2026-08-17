import assert from "node:assert/strict";
import test from "node:test";

import {
  BLIND_PREDICTIONS,
  STRATEGY_TRIALS,
  blindOutcomeFor,
  blindPredictionResult,
  strategyTrialFor,
  strategyTrialIsLoadable,
  strategyTrialResult,
  strategyTrialsForPlaybook,
} from "../src/strategyExperiment.js";
import { FORMATIONS } from "../src/formationData.js";
import { PLAYBOOKS } from "../src/playbookData.js";

const FORMATION_IDS = new Set(FORMATIONS.map((formation) => formation.id));
const ROLE_IDS = {
  trapline: new Set(["pull", "burn", "break", "anchor", "recover"]),
  spear: new Set(["screen", "point", "punch", "suppress", "recover"]),
  pressure: new Set(["alpha", "beta", "deny", "reactor", "recover"]),
};

test("every playbook has aggressive, balanced, and cautious templates", () => {
  assert.equal(STRATEGY_TRIALS.length, 9);
  Object.keys(ROLE_IDS).forEach((playbookId) => {
    const templates = strategyTrialsForPlaybook(playbookId);
    assert.equal(templates.length, 3);
    assert.deepEqual(templates.map((item) => item.posture), ["aggressive", "balanced", "cautious"]);
  });
});

test("every template staffs every role with a distinct available formation", () => {
  STRATEGY_TRIALS.forEach((trial) => {
    assert.deepEqual(new Set(Object.keys(trial.assignments)), ROLE_IDS[trial.playbookId]);
    const assignedIds = Object.values(trial.assignments);
    assert.equal(assignedIds.length, ROLE_IDS[trial.playbookId].size);
    assert.equal(new Set(assignedIds).size, assignedIds.length);
    assignedIds.forEach((formationId) => assert.equal(FORMATION_IDS.has(formationId), true));
    assert.deepEqual(new Set(Object.keys(trial.branches)), new Set(["beta", "rescue"]));
    assert.ok(["tempo", "protect"].includes(trial.branches.beta));
    assert.ok(["clock", "recover"].includes(trial.branches.rescue));
    assert.ok(trial.priority.length > 10);
    assert.ok(trial.sacrifice.length > 10);
  });
});

test("a five-stop template remains loadable from the larger roster", () => {
  const trial = strategyTrialFor("trapline-balanced");
  const playbook = PLAYBOOKS.find((item) => item.id === trial.playbookId);
  assert.equal(FORMATIONS.length, 9, "the regression requires a bench larger than the plan");
  assert.equal(playbook.roles.length, 5);
  assert.equal(strategyTrialIsLoadable(trial, playbook, FORMATIONS), true);
  assert.equal(strategyTrialIsLoadable({ ...trial, assignments: { ...trial.assignments, pull: "missing" } }, playbook, FORMATIONS), false);
  assert.equal(strategyTrialIsLoadable({ ...trial, assignments: { ...trial.assignments, pull: trial.assignments.burn } }, playbook, FORMATIONS), false);
  assert.equal(strategyTrialIsLoadable({ ...trial, assignments: { ...trial.assignments, extra: "skimmer" } }, playbook, FORMATIONS), false);
});

test("template lookup and filtering fail closed", () => {
  assert.equal(strategyTrialFor("unknown"), null);
  assert.deepEqual(strategyTrialsForPlaybook("unknown"), []);
  assert.deepEqual(strategyTrialsForPlaybook(null), []);
  const trial = strategyTrialFor("spear-balanced");
  assert.equal(strategyTrialResult(trial, 4).extracted, 4);
  assert.equal(strategyTrialResult(trial, 99).extracted, 20);
  assert.equal(strategyTrialResult(null, 4), null);
});

test("blind outcomes distinguish victory, withdrawal, and collapse", () => {
  assert.equal(blindOutcomeFor({ extractedCount: 4, requiredExtraction: 3 }), "victory");
  assert.equal(blindOutcomeFor({ extractedCount: 2, requiredExtraction: 3 }), "withdrawal");
  assert.equal(blindOutcomeFor({ extractedCount: 0, requiredExtraction: 3 }), "collapse");
  assert.equal(blindOutcomeFor({ extractedCount: Number.POSITIVE_INFINITY, requiredExtraction: 3 }), "collapse");
});

test("blind prediction comparison accepts only allowlisted predictions", () => {
  assert.deepEqual(BLIND_PREDICTIONS.map((prediction) => prediction.id), ["victory", "withdrawal", "collapse"]);
  assert.equal(blindPredictionResult({ predictionId: "victory", extractedCount: 4, requiredExtraction: 3 }).accurate, true);
  assert.equal(blindPredictionResult({ predictionId: "victory", extractedCount: 1, requiredExtraction: 3 }).actual.id, "withdrawal");
  assert.equal(blindPredictionResult({ predictionId: "unknown", extractedCount: 4, requiredExtraction: 3 }), null);
});
