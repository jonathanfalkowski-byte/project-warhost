import assert from "node:assert/strict";
import test from "node:test";

import {
  adjacentFormationIdsFor,
  capabilityMatchesFor,
  formationInteractionsFor,
  interactionDirectionFor,
  neighboringInteractionHints,
} from "../src/formationInteractions.js";

const formations = [
  { id: "harpoon", name: "GRAV-SNARE TANK", capabilities: ["CONTROL", "MOBILITY"], creates: "DISPLACED", uses: ["SCREENED"] },
  { id: "furnace", name: "INCINERATOR SQUAD", capabilities: ["DENIAL", "AREA"], creates: "OVERHEATED", uses: ["DISPLACED", "SCREENED"] },
  { id: "breaker", name: "BREACHER WALKER", capabilities: ["BREACH", "SHOCK"], creates: "BREACHED", uses: ["DISPLACED", "OVERHEATED"] },
  { id: "railjack", name: "BASTION TANK", capabilities: ["HOLD", "COVER"], creates: "SCREENED", uses: ["BREACHED"] },
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
  assert.match(hints[0].text, /INCINERATOR SQUAD can react/);
});

test("interaction direction is classified relative to the inspected formation", () => {
  const links = formationInteractionsFor({ formations, formationId: "harpoon" });
  assert.equal(interactionDirectionFor(links.find((link) => link.partnerId === "furnace")), "outgoing");
  assert.equal(interactionDirectionFor(links.find((link) => link.partnerId === "railjack")), "incoming");
  assert.equal(interactionDirectionFor({ outgoing: {}, incoming: {} }), "mutual");
  assert.equal(interactionDirectionFor(null), null);
});

test("adjacency follows staffed tactical slot order rather than formation roster order", () => {
  const roles = [{ id: "lead" }, { id: "guard" }, { id: "assault" }, { id: "rear" }];
  const assignments = { lead: "furnace", guard: "harpoon", assault: "breaker", rear: "railjack" };
  assert.deepEqual(adjacentFormationIdsFor({ roles, assignments, formationId: "harpoon" }), ["furnace", "breaker"]);
  assert.deepEqual(adjacentFormationIdsFor({ roles, assignments, formationId: "railjack" }), ["breaker"]);
});

test("malformed interaction requests fail closed", () => {
  assert.deepEqual(formationInteractionsFor({ formations: null, formationId: "harpoon" }), []);
  assert.deepEqual(formationInteractionsFor({ formations, formationId: "unknown" }), []);
  assert.deepEqual(capabilityMatchesFor({ formation: null, demands: ["CONTROL"] }), []);
  assert.deepEqual(neighboringInteractionHints({ formations, formationId: "harpoon", neighborIds: "furnace" }), []);
  assert.deepEqual(adjacentFormationIdsFor({ roles: null, assignments: {}, formationId: "harpoon" }), []);
  assert.deepEqual(adjacentFormationIdsFor({ roles: [], assignments: null, formationId: "harpoon" }), []);
});
