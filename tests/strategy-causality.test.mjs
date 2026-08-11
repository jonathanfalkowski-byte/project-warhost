import assert from "node:assert/strict";
import test from "node:test";

import { strategyCausalityFor, strategyOutcomeStoryFor } from "../src/strategyCausality.js";

const profile = ({ extractedCount = 4, improvisedCount = 0, handoffs = 2, disrupted = 2, overrun = 0 } = {}) => ({
  extractedCount,
  overrun,
  timeSaved: overrun > 0 ? 0 : 15,
  reinforcementLoss: overrun > 0 ? 2 : 0,
  enemyRecoveryLoss: 0,
  readiness: {
    staffedCount: 5,
    alignedCount: 5 - improvisedCount,
    improvisedCount,
    delay: improvisedCount * 20,
    placements: Array.from({ length: 5 }, (_, index) => ({
      formationName: `FORMATION ${index + 1}`,
      roleLabel: `ROLE ${index + 1}`,
      taskAligned: index >= improvisedCount,
      demands: ["CONTROL", "SHOCK"],
    })),
  },
  effects: Array.from({ length: handoffs }, (_, index) => ({ maneuver: { name: `HANDOFF ${index + 1}` } })),
  doctrine: { name: "OVERLAPPING FIRES", triggered: handoffs > 0, result: handoffs > 0 ? "FIRST HANDOFF ARMED" : "TRAP NEVER CLOSED" },
  enemyClashes: Array.from({ length: 3 }, (_, index) => ({ label: `ORDER ${index + 1}`, disrupted: index < disrupted, resolution: { label: index < disrupted ? "CHECKED" : "COSTLY" } })),
});

test("causal debrief explains a successful plan without ranking placements", () => {
  const rows = strategyCausalityFor({ profile: profile(), requiredExtraction: 3 });
  assert.deepEqual(rows.map((row) => row.label), ["RESPONSIBILITY FIT", "SECONDARY COMBO BONUS", "PLAYBOOK DOCTRINE", "ENEMY PLAN", "MISSION RESULT"]);
  assert.equal(rows[0].value, "5/5 ALIGNED");
  assert.equal(rows[1].value, "2 CHAINS FORMED");
  assert.equal(rows[3].value, "2/3 ORDERS BROKEN");
  assert.equal(rows[4].value, "4/3 EXTRACTED");
  assert.ok(rows.every((row) => !/best|optimal|recommended/i.test(`${row.value} ${row.detail}`)));
});

test("causal debrief exposes the costs behind a withdrawal", () => {
  const rows = strategyCausalityFor({ profile: profile({ extractedCount: 1, improvisedCount: 2, handoffs: 0, disrupted: 0, overrun: 61 }), requiredExtraction: 3 });
  assert.equal(rows[0].tone, "cost");
  assert.match(rows[0].detail, /2 improvised assignments added 40 seconds/);
  assert.equal(rows[1].tone, "cost");
  assert.equal(rows[2].detail, "TRAP NEVER CLOSED");
  assert.equal(rows[4].tone, "cost");
  assert.match(rows[4].detail, /61 seconds late/);
});

test("causal debrief fails closed for malformed or missing profile evidence", () => {
  const rows = strategyCausalityFor({ profile: { readiness: { staffedCount: -2 }, effects: "not-an-array" }, requiredExtraction: 3 });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].value, "0/0 ALIGNED");
  assert.equal(rows[1].value, "0 CHAINS FORMED");
  assert.equal(rows[3].value, "0/0 ORDERS BROKEN");
  assert.equal(rows[4].value, "0/3 EXTRACTED");
});

test("outcome story names the choices, enemy gap, and extraction cost", () => {
  const story = strategyOutcomeStoryFor({ profile: profile({ extractedCount: 2, improvisedCount: 1, disrupted: 1, overrun: 75 }), requiredExtraction: 3 });
  assert.deepEqual(story.map((item) => item.label), ["1 · YOUR ROUTE ASSIGNMENTS", "2 · WHAT THE ENEMY EXPLOITED", "3 · MISSION COST"]);
  assert.match(story[0].detail, /FORMATION 1 at ROLE 1 lacked CONTROL \/ SHOCK/);
  assert.match(story[1].detail, /ORDER 2 landed/);
  assert.equal(story[2].value, "75 SEC LATE → 2/3 EXTRACTED");
  assert.match(story[2].detail, /recovery capacity was lost/);
});

test("outcome story fails closed when detailed evidence is malformed", () => {
  const story = strategyOutcomeStoryFor({ profile: { readiness: { staffedCount: -1, placements: "invalid" }, effects: null, enemyClashes: null }, requiredExtraction: 3 });
  assert.equal(story.length, 3);
  assert.equal(story[0].value, "0/0 RESPONSIBILITIES MATCHED");
  assert.equal(story[1].value, "0/0 ORDERS STOPPED");
  assert.equal(story[2].value, "0 SEC EARLY → 0/3 EXTRACTED");
});
