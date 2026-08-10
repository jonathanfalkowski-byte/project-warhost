import test from "node:test";
import assert from "node:assert/strict";
import { claimStaffExercise, planningResultRevealed } from "../src/planningIntel.js";

test("planning results remain sealed by default", () => {
  assert.equal(planningResultRevealed({ phase: "plan", handoffIndex: 0, staffExerciseIndex: null }), false);
  assert.equal(planningResultRevealed({ phase: "drill", handoffIndex: 0, staffExerciseIndex: null }), false);
});

test("a staff exercise reveals only its selected handoff", () => {
  assert.equal(planningResultRevealed({ phase: "plan", handoffIndex: 1, staffExerciseIndex: 1 }), true);
  assert.equal(planningResultRevealed({ phase: "plan", handoffIndex: 0, staffExerciseIndex: 1 }), false);
});

test("the first valid staff exercise claim is final", () => {
  assert.equal(claimStaffExercise({ currentIndex: null, requestedIndex: 2, handoffCount: 4 }), 2);
  assert.equal(claimStaffExercise({ currentIndex: 2, requestedIndex: 1, handoffCount: 4 }), 2);
});

test("battle and completion reveal every handoff", () => {
  assert.equal(planningResultRevealed({ phase: "battle", handoffIndex: 3, staffExerciseIndex: null }), true);
  assert.equal(planningResultRevealed({ phase: "complete", handoffIndex: 0, staffExerciseIndex: null }), true);
});

test("malformed staff exercise requests fail closed", () => {
  assert.equal(claimStaffExercise({ currentIndex: null, requestedIndex: -1, handoffCount: 4 }), null);
  assert.equal(claimStaffExercise({ currentIndex: null, requestedIndex: 4, handoffCount: 4 }), null);
  assert.equal(claimStaffExercise({ currentIndex: null, requestedIndex: "1", handoffCount: 4 }), null);
  assert.equal(planningResultRevealed({ phase: "unknown", handoffIndex: 0, staffExerciseIndex: 0 }), false);
  assert.equal(planningResultRevealed({ phase: "plan", handoffIndex: 0, staffExerciseIndex: -1 }), false);
});
