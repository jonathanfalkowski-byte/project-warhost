import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlaybookDoctrine } from "../src/playbookDoctrine.js";

const armed = (count) => Array.from({ length: count }, (_, index) => ({
  id: String(index),
  maneuver: { name: `COMBO ${index + 1}` },
}));

test("Trapline doctrine is inherent to the army plan, while combos remain bonuses", () => {
  assert.equal(resolvePlaybookDoctrine("trapline", armed(1)).impact.protects, 1);
  assert.equal(resolvePlaybookDoctrine("trapline", []).impact.alpha, 15);
  assert.equal(resolvePlaybookDoctrine("trapline", []).impact.missionDelay, 0);
});

test("Decisive Assault converts its speed into extraction time, and still pays exposure", () => {
  const doctrine = resolvePlaybookDoctrine("spear", []);
  assert.equal(doctrine.impact.reactor, 30);
  assert.equal(doctrine.impact.missionDelay, 15, "the exposed rear guard must remain a real cost");
  // Reaching the reactor sooner has to reach the win condition too. Extraction time is
  // bound by its own base term, not by reactorAt + 30, so a reactor-only bonus never
  // touches the outcome while the missionDelay penalty always does. That asymmetry made
  // this play a trap: 1.2% win rate against 21.1% and 18.1% (see docs/balance.md).
  assert.ok(doctrine.impact.extraction > doctrine.impact.missionDelay,
    "Decisive Assault must extract faster on balance, or it is strictly worse than the alternatives");
});

test("Twin Seizure always gains parallel capture and pays a convergence cost", () => {
  const linked = resolvePlaybookDoctrine("pressure", armed(2));
  const separated = resolvePlaybookDoctrine("pressure", armed(1));
  assert.equal(linked.impact.alpha, 15);
  assert.equal(linked.impact.beta, 15);
  assert.equal(linked.impact.missionDelay, 15);
  assert.equal(separated.impact.missionDelay, 15);
});

test("unknown playbooks resolve to a bounded neutral doctrine", () => {
  const doctrine = resolvePlaybookDoctrine("unknown", armed(4));
  assert.equal(doctrine.triggered, false);
  assert.deepEqual(Object.values(doctrine.impact), [0, 0, 0, 0, 0, 0]);
});
