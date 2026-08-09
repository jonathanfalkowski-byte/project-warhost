import assert from "node:assert/strict";
import test from "node:test";

import { resolveExtractionOutcome } from "../src/extractionResolution.js";

test("a coordinated Dead Circuit plan can meet its extraction requirement", () => {
  const result = resolveExtractionOutcome({
    deployedCount: 5,
    requiredExtraction: 3,
    protectedCount: 0,
    overrun: 29,
    recoveryLoss: 1,
  });

  assert.equal(result.reserveCapacity, 4);
  assert.equal(result.waveLoss, 0);
  assert.equal(result.extractedCount, 3);
  assert.equal(result.outcome, "victory");
});

test("a coordinated Ashen Passage plan can extract its required four formations", () => {
  const result = resolveExtractionOutcome({
    deployedCount: 5,
    requiredExtraction: 4,
    overrun: 20,
    recoveryLoss: 1,
  });

  assert.equal(result.reserveCapacity, 5);
  assert.equal(result.extractedCount, 4);
  assert.equal(result.outcome, "victory");
});

test("a sixty-one second overrun becomes a costly defeat rather than an automatic wipe", () => {
  const result = resolveExtractionOutcome({
    deployedCount: 5,
    requiredExtraction: 3,
    overrun: 61,
    recoveryLoss: 1,
  });

  assert.equal(result.waveLoss, 2);
  assert.equal(result.extractedCount, 1);
  assert.equal(result.outcome, "defeat");
});

test("extreme delay still allows catastrophic campaign-ending defeat", () => {
  const result = resolveExtractionOutcome({
    deployedCount: 5,
    requiredExtraction: 3,
    protectedCount: 1,
    overrun: 150,
    recoveryLoss: 1,
  });

  assert.equal(result.extractedCount, 0);
  assert.equal(result.outcome, "annihilation");
});

test("malformed extraction inputs stay inside deterministic bounds", () => {
  const result = resolveExtractionOutcome({
    deployedCount: 999,
    requiredExtraction: "invalid",
    protectedCount: -4,
    overrun: -60,
    recoveryLoss: 999,
  });

  assert.equal(result.deployedCount, 20);
  assert.equal(result.requiredExtraction, 3);
  assert.equal(result.extractedCount, 0);
  assert.equal(result.outcome, "annihilation");
});
