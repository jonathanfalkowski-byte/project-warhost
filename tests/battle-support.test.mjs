import test from "node:test";
import assert from "node:assert/strict";

import { SUPPORT_RANGES, supportLinksFor } from "../src/battle/afterAction.js";
import { COMMAND_RANGE, SHIELD_RANGE, deployUnit } from "../src/battle/battleRules.js";

const unit = (over) => ({ id: over.name, x: 50, y: 50, wounds: 5, keywords: [], ...over });

test("the ranges the screen draws are the ranges the rules use", () => {
  // A combo drawn at the wrong distance is worse than one not drawn at all: it tells the
  // player a formation is helping when it is not.
  assert.equal(SUPPORT_RANGES.SHIELD, SHIELD_RANGE);
  assert.equal(SUPPORT_RANGES.COMMAND, COMMAND_RANGE);
});

test("a shield and a command vehicle are shown supporting what they reach", () => {
  // These combos have been in the rules since the profiles were written and the screen has
  // never once shown one. A combo nobody can see is a combo nobody has.
  const links = supportLinksFor({
    players: [
      unit({ name: "WALL", keywords: ["SHIELD"] }),
      unit({ name: "CHOIR", keywords: ["COMMAND"], x: 52 }),
      unit({ name: "GUN", x: 55 }),
    ],
  });
  assert.ok(links.some((link) => link.kind === "shield" && link.from === "WALL" && link.to === "GUN"));
  assert.ok(links.some((link) => link.kind === "command" && link.from === "CHOIR" && link.to === "GUN"));
  // Nothing supports itself.
  assert.equal(links.some((link) => link.from === link.to), false);
  // A formation with neither keyword supports nobody.
  assert.equal(links.some((link) => link.from === "GUN"), false);
});

test("support stops at the range the rule stops at", () => {
  const far = supportLinksFor({
    players: [
      unit({ name: "WALL", keywords: ["SHIELD"] }),
      unit({ name: "FAR", x: 50 + SHIELD_RANGE + 1 }),
    ],
  });
  assert.deepEqual(far, [], "a shield was drawn supporting something out of its range");
  // A command vehicle reaches further than a shield does, and the drawing knows it.
  const between = supportLinksFor({
    players: [
      unit({ name: "CHOIR", keywords: ["COMMAND"] }),
      unit({ name: "WALL", keywords: ["SHIELD"] }),
      unit({ name: "MID", x: 50 + SHIELD_RANGE + 2 }),
    ],
  });
  assert.ok(between.some((link) => link.kind === "command" && link.to === "MID"));
  assert.equal(between.some((link) => link.kind === "shield" && link.to === "MID"), false);
});

test("a wreck supports nothing and is supported by nothing", () => {
  const links = supportLinksFor({
    players: [
      unit({ name: "WALL", keywords: ["SHIELD"], wounds: 0 }),
      unit({ name: "CHOIR", keywords: ["COMMAND"] }),
      unit({ name: "GONE", wounds: 0, x: 51 }),
      unit({ name: "ALIVE", x: 52 }),
    ],
  });
  assert.equal(links.some((link) => link.from === "WALL"), false, "a wreck was drawn supporting");
  assert.equal(links.some((link) => link.to === "GONE"), false, "a wreck was drawn being supported");
  assert.ok(links.some((link) => link.from === "CHOIR" && link.to === "ALIVE"));
});

test("a refit that grants a keyword shows up as support on the board", () => {
  // The whole promise of a keyword refit is that an existing rule arrives somewhere new.
  // If the drawing did not follow the refit, the player would never see it happen.
  const plain = supportLinksFor({
    players: [
      deployUnit({ formationId: "furnace", name: "F", position: { x: 50, y: 50 } }),
      deployUnit({ formationId: "skimmer", name: "S", position: { x: 52, y: 50 } }),
    ],
  });
  const screened = supportLinksFor({
    players: [
      deployUnit({ formationId: "furnace", name: "F", position: { x: 50, y: 50 }, refit: "furnace:crucible" }),
      deployUnit({ formationId: "skimmer", name: "S", position: { x: 52, y: 50 } }),
    ],
  });
  assert.equal(plain.some((link) => link.kind === "shield"), false);
  assert.ok(screened.some((link) => link.kind === "shield" && link.from === "F" && link.to === "S"));
});

test("an empty board draws nothing rather than crashing", () => {
  assert.deepEqual(supportLinksFor({}), []);
  assert.deepEqual(supportLinksFor({ players: [] }), []);
  assert.deepEqual(supportLinksFor({ players: [unit({ name: "ALONE", keywords: ["SHIELD"] })] }), []);
});
