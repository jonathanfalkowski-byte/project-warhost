import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlaybookDoctrine } from "../src/playbookDoctrine.js";

const armed = (count) => Array.from({ length: count }, (_, index) => ({
  id: String(index),
  maneuver: { name: `COMBO ${index + 1}` },
}));

test("Trapline preserves recovery only when its first handoff is armed", () => {
  assert.equal(resolvePlaybookDoctrine("trapline", armed(1)).impact.protects, 1);
  assert.equal(resolvePlaybookDoctrine("trapline", []).impact.missionDelay, 15);
});

test("Armored Spear trades reactor speed for extraction exposure", () => {
  const doctrine = resolvePlaybookDoctrine("spear", []);
  assert.equal(doctrine.impact.reactor, 30);
  assert.equal(doctrine.impact.missionDelay, 15);
});

test("Divided Pressure must link two handoffs to avoid regroup delay", () => {
  const linked = resolvePlaybookDoctrine("pressure", armed(2));
  const separated = resolvePlaybookDoctrine("pressure", armed(1));
  assert.equal(linked.impact.alpha, 15);
  assert.equal(linked.impact.beta, 15);
  assert.equal(linked.impact.missionDelay, 0);
  assert.equal(separated.impact.missionDelay, 15);
});

test("unknown playbooks resolve to a bounded neutral doctrine", () => {
  const doctrine = resolvePlaybookDoctrine("unknown", armed(4));
  assert.equal(doctrine.triggered, false);
  assert.deepEqual(Object.values(doctrine.impact), [0, 0, 0, 0, 0, 0]);
});
