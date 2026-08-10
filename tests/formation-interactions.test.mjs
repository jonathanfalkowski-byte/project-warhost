import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityMatchesFor,
  formationInteractionsFor,
  neighboringInteractionHints,
} from "../src/formationInteractions.js";

const formations = [
  { id: "harpoon", name: "HARPOON RIG", capabilities: ["CONTROL", "MOBILITY"], creates: "DISPLACED", uses: ["SCREENED"] },
  { id: "furnace", name: "FURNACE CREW", capabilities: ["DENIAL", "AREA"], creates: "OVERHEATED", uses: ["DISPLACED", "SCREENED"] },
  { id: "breaker", name: "BREAKER EXO", capabilities: ["BREACH", "SHOCK"], creates: "BREACHED", uses: ["DISPLACED", "OVERHEATED"] },
  { id: "railjack", name: "RAILJACK", capabilities: ["HOLD", "COVER"], creates: "SCREENED", uses: ["BREACHED"] },
];

test("one formation can expose multiple compatible partners without ranking them", () => {
  const links = formationInteractionsFor({ formations, formationId: "harpoon" });
  assert.deepEqual(new Set(links.map((link) => link.partnerId)), new Set(["furnace", "breaker", "railjack"]));
  assert.equal(links.find((link) => link.partnerId === "furnace").outgoing.condition, "DISPLACED");
  assert.equal(links.find((link) => link.partnerId === "railjack").incoming.condition, "SCREENED");
});

test("responsibility matching reports exact capability overlap", () => {
  assert.deepEqual(capabilityMatchesFor({ formation: formations[0], demands: ["CONTROL", "SHOCK"] }), ["CONTROL"]);
  assert.deepEqual(capabilityMatchesFor({ formation: formations[1], demands: ["CONTROL", "SHOCK"] }), []);
});

test("neighbor hints include only currently adjacent formations", () => {
  const hints = neighboringInteractionHints({ formations, formationId: "harpoon", neighborIds: ["furnace"] });
  assert.equal(hints.length, 1);
  assert.match(hints[0].text, /FURNACE CREW can react/);
});

test("malformed interaction requests fail closed", () => {
  assert.deepEqual(formationInteractionsFor({ formations: null, formationId: "harpoon" }), []);
  assert.deepEqual(formationInteractionsFor({ formations, formationId: "unknown" }), []);
  assert.deepEqual(capabilityMatchesFor({ formation: null, demands: ["CONTROL"] }), []);
  assert.deepEqual(neighboringInteractionHints({ formations, formationId: "harpoon", neighborIds: "furnace" }), []);
});
