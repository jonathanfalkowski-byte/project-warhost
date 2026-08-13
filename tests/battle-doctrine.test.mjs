import assert from "node:assert/strict";
import test from "node:test";

import { BATTLEFIELD_DOCTRINES } from "../src/battleDoctrineData.js";

test("every total-army play exposes a readable four-phase battle sequence", () => {
  for (const doctrine of Object.values(BATTLEFIELD_DOCTRINES)) {
    assert.equal(doctrine.phases.length, 4);
    assert.ok(doctrine.phases.every((phase) => phase.label && phase.detail && phase.roles));
    assert.ok(doctrine.contacts.length >= 2);
  }
});
