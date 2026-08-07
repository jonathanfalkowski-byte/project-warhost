import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaignConditions,
  applyWorkshopAction,
  campaignOutcomeFor,
  ensureCostlyContinuationConditions,
  integrityLossFor,
  mergeCampaignConditions,
  seriousConditionsFromConsequences,
} from "../src/campaignPersistence.js";

const catalog = [
  { id: "alpha", capabilities: ["CONTROL", "MOBILITY"], refits: [{ id: "one" }, { id: "two" }] },
  { id: "beta", capabilities: ["HOLD", "COVER"], refits: [{ id: "one" }, { id: "two" }] },
];

const clash = (outcome, actorIds, actionAt = 10) => ({
  label: `ORDER ${outcome}`,
  actionAt,
  resolution: { outcome, actorIds },
});

test("only serious consequences carry between operations", () => {
  const conditions = seriousConditionsFromConsequences({
    clashes: [clash("decisive", ["alpha"]), clash("costly", ["beta"], 20)],
    battleTime: 30,
  });
  assert.equal(conditions.alpha, undefined);
  assert.equal(conditions.beta.state, "damaged");
});

test("one cut-off formation becomes missing and additional losses become damaged", () => {
  const conditions = seriousConditionsFromConsequences({
    clashes: [clash("overrun", ["alpha", "beta"])],
    battleTime: 30,
  });
  assert.equal(conditions.alpha.state, "missing");
  assert.equal(conditions.beta.state, "damaged");
});

test("campaign conditions remove a damaged capability and make missing formations unavailable", () => {
  const formations = applyCampaignConditions(catalog, {
    alpha: { state: "damaged", cause: "counterfire" },
    beta: { state: "missing", cause: "pursuit" },
  });
  assert.deepEqual(formations[0].capabilities, ["CONTROL"]);
  assert.equal(formations[0].disabledCapability, "MOBILITY");
  assert.equal(formations[1].available, false);
  assert.deepEqual(formations[1].capabilities, []);
});

test("the workshop applies exactly the selected repair, recovery, or refit action", () => {
  const baseline = {
    refits: { alpha: "one", beta: "one" },
    conditions: { alpha: { state: "damaged" }, beta: { state: "missing" } },
    catalog,
  };
  const repaired = applyWorkshopAction({ ...baseline, action: { type: "repair", formationId: "alpha" } });
  assert.equal(repaired.conditions.alpha, undefined);
  assert.equal(repaired.conditions.beta.state, "missing");

  const recovered = applyWorkshopAction({ ...baseline, action: { type: "recover", formationId: "beta" } });
  assert.equal(recovered.conditions.beta, undefined);
  assert.equal(recovered.conditions.alpha.state, "damaged");

  const refitted = applyWorkshopAction({ ...baseline, action: { type: "refit", formationId: "alpha", refitId: "two" } });
  assert.equal(refitted.refits.alpha, "two");
  assert.equal(refitted.conditions.alpha.state, "damaged");
});

test("invalid workshop actions are ignored and condition severity never improves by merging", () => {
  const invalid = applyWorkshopAction({
    refits: { alpha: "one" },
    conditions: { alpha: { state: "damaged" } },
    catalog,
    action: { type: "refit", formationId: "alpha", refitId: "unknown" },
  });
  assert.equal(invalid.applied, false);
  assert.equal(invalid.refits.alpha, "one");

  const merged = mergeCampaignConditions(
    { alpha: { state: "missing", cause: "old" } },
    { alpha: { state: "damaged", cause: "new" } },
  );
  assert.equal(merged.alpha.state, "missing");
  assert.equal(merged.alpha.cause, "old");
});

test("a costly continuation always enters the next operation with a missing and damaged formation", () => {
  const conditions = ensureCostlyContinuationConditions(
    { beta: { state: "damaged", cause: "counterfire" }, unknown: { state: "missing" } },
    ["alpha", "beta", "gamma"],
  );
  assert.equal(conditions.unknown, undefined);
  assert.equal(conditions.beta.state, "missing");
  assert.equal(conditions.gamma.state, "damaged");

  const preserved = ensureCostlyContinuationConditions(
    { alpha: { state: "missing" }, beta: { state: "damaged" } },
    ["alpha", "beta", "gamma"],
  );
  assert.equal(preserved.alpha.state, "missing");
  assert.equal(preserved.beta.state, "damaged");
});

test("campaign outcome distinguishes costly continuation from total defeat", () => {
  assert.equal(campaignOutcomeFor({ hasNextOperation: true, operationWon: false, integrityRemaining: 2 }), "continue");
  assert.equal(campaignOutcomeFor({ hasNextOperation: true, operationWon: true, integrityRemaining: 3 }), "continue");
  assert.equal(campaignOutcomeFor({ hasNextOperation: true, operationWon: false, integrityRemaining: 0 }), "destroyed");
  assert.equal(campaignOutcomeFor({ hasNextOperation: false, operationWon: false, integrityRemaining: 2 }), "destroyed");
  assert.equal(campaignOutcomeFor({ hasNextOperation: false, operationWon: true, integrityRemaining: 3 }), "terminal");
});

test("integrity loss distinguishes victory, defeat, and rout", () => {
  assert.equal(integrityLossFor({ operationWon: true, extractedCount: 0 }), 0);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: 2 }), 1);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: 0 }), 2);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: -5 }), 2);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: "invalid" }), 2);
});
