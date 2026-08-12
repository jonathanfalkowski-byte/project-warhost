import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCampaignConditions,
  applyWorkshopAction,
  campaignOutcomeFor,
  ensureCostlyContinuationConditions,
  formationFatesFor,
  integrityLossFor,
  mergeCampaignConditions,
  seriousConditionsFromConsequences,
  victoryGradeFor,
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

test("integrity loss distinguishes victory, defeat, rout, and annihilation", () => {
  assert.equal(integrityLossFor({ operationWon: true, extractedCount: 0 }), 0);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: 2 }), 1);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: 1 }), 2);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: 0 }), 3);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: -5 }), 3);
  assert.equal(integrityLossFor({ operationWon: false, extractedCount: "invalid" }), 3);
});

test("victory grades distinguish decisive, ordinary, and costly operation wins", () => {
  const decisive = victoryGradeFor({
    won: true,
    extractedCount: 5,
    requiredExtraction: 3,
    totalFormations: 5,
    formationFates: Array.from({ length: 5 }, () => ({ fate: "extracted" })),
  });
  assert.equal(decisive.id, "decisive");
  assert.equal(decisive.label, "DECISIVE VICTORY");

  const victory = victoryGradeFor({
    won: true,
    extractedCount: 4,
    requiredExtraction: 3,
    totalFormations: 5,
    formationFates: [
      { fate: "extracted" },
      { fate: "extracted" },
      { fate: "extracted" },
      { fate: "damaged" },
      { fate: "missing" },
    ],
  });
  assert.equal(victory.id, "victory");
  assert.match(victory.summary, /1 formation missing/);

  const costly = victoryGradeFor({
    won: true,
    extractedCount: 3,
    requiredExtraction: 3,
    totalFormations: 5,
    formationFates: [
      { fate: "extracted" },
      { fate: "damaged" },
      { fate: "extracted" },
      { fate: "missing" },
      { fate: "missing" },
    ],
  });
  assert.equal(costly.id, "costly");
  assert.equal(costly.label, "COSTLY VICTORY");
  assert.equal(costly.summary, "Objective secured, but 2 formations missing and 1 formation escaped damaged.");
  assert.equal(victoryGradeFor({ won: false }), null);
});

test("formation fates follow staffed slot order and distinguish force collapse from unit loss", () => {
  const formations = [
    { id: "alpha", name: "ALPHA" },
    { id: "beta", name: "BETA" },
    { id: "gamma", name: "GAMMA" },
  ];
  const consequences = {
    alpha: { state: "cut-off", severity: 5, cause: "OATH PURSUIT", at: 70 },
    beta: { state: "damaged", severity: 4, cause: "BETA SCREEN", at: 40 },
  };
  const partial = formationFatesFor({
    formations,
    formationOrderIds: ["beta", "gamma", "alpha"],
    extractedCount: 2,
    consequences,
    extractionAt: 90,
    completeAt: 105,
  });
  assert.deepEqual(partial.map(({ formation }) => formation.id), ["beta", "gamma", "alpha"]);
  assert.deepEqual(partial.map(({ fate }) => fate), ["damaged", "extracted", "missing"]);
  assert.deepEqual(partial.map(({ at }) => at), [40, 105, 98]);
  assert.equal(partial[2].battleLabel, "CUT OFF");
  assert.deepEqual(partial[0].history.map(({ label }) => label), ["DAMAGED", "EXTRACTED"]);
  assert.deepEqual(partial[2].history.map(({ label }) => label), ["CUT OFF", "MISSING"]);

  const collapsed = formationFatesFor({
    formations,
    formationOrderIds: ["beta", "gamma", "alpha"],
    extractedCount: 0,
    consequences,
    campaignDestroyed: true,
    extractionAt: 90,
    completeAt: 105,
  });
  assert.equal(collapsed.filter(({ fate }) => fate === "destroyed").length, 1);
  assert.equal(collapsed.find(({ fate }) => fate === "destroyed").formation.id, "alpha");
  assert.equal(collapsed.filter(({ fate }) => fate === "missing").length, 2);
  assert.ok(collapsed.every(({ at }) => at >= 90 && at <= 105));
  assert.ok(collapsed.find(({ fate }) => fate === "destroyed").at > Math.max(...collapsed.filter(({ fate }) => fate === "missing").map(({ at }) => at)));
  assert.deepEqual(collapsed.find(({ formation }) => formation.id === "beta").history.map(({ label }) => label), ["DAMAGED", "CUT OFF", "MISSING"]);
  assert.deepEqual(collapsed.find(({ fate }) => fate === "destroyed").history.map(({ label }) => label), ["CUT OFF", "DESTROYED"]);
});

test("specific combat exposure decides which formation fails extraction before generic severity", () => {
  const formations = [{ id: "alpha" }, { id: "beta" }, { id: "gamma" }];
  const fates = formationFatesFor({
    formations,
    formationOrderIds: ["alpha", "beta", "gamma"],
    extractedCount: 2,
    consequences: {
      alpha: { state: "pinned", label: "PINNED", severity: 3, combat: { damage: 1, remaining: 3 } },
      beta: { state: "delayed", label: "DELAYED", severity: 2, combat: { damage: 4, remaining: 0 } },
    },
    extractionAt: 90,
    completeAt: 105,
  });

  assert.equal(fates.find(({ formation }) => formation.id === "beta").fate, "missing");
  assert.equal(fates.find(({ formation }) => formation.id === "alpha").fate, "damaged");
});

test("a staffed recovery element protects its assigned formation when any extraction survives", () => {
  const formations = [{ id: "lead" }, { id: "assault" }, { id: "recovery" }];
  const fates = formationFatesFor({
    formations,
    formationOrderIds: ["lead", "assault", "recovery"],
    extractedCount: 1,
    consequences: {
      recovery: { state: "cut-off", severity: 5, cause: "GANTRY SEVER" },
      assault: { state: "damaged", severity: 3, cause: "COUNTERFIRE" },
    },
    protectedFormationIds: ["recovery"],
    extractionAt: 90,
    completeAt: 105,
  });

  assert.equal(fates.find(({ formation }) => formation.id === "recovery").fate, "damaged");
  assert.equal(fates.filter(({ fate }) => fate === "missing").length, 2);
});
