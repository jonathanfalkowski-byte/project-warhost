import test from "node:test";
import assert from "node:assert/strict";

import { headlineFor } from "../src/battle/afterAction.js";
import { CIRCUIT_CLASH } from "../src/battle/battleMission.js";
import { liveSitesFor } from "../src/battle/doctrine.js";
import { FIELD_REPAIR_WOUNDS, marketFor } from "../src/battle/market.js";
import { profileWithRefit } from "../src/battle/refits.js";

// Three things reported from play on 19 Aug 2026, all of them the same mistake in different
// places: the screen telling the player a number that the rule they declared does not pay.

const servicesFor = (wounds) => marketFor({
  roster: [{ id: "bastion#1", formationId: "bastion", name: "BASTION", wounds }],
  purse: 20, seed: 0, battle: 1,
}).filter((offer) => offer.kind === "service").map((offer) => offer.id);

const BASTION_FULL = profileWithRefit("bastion", null).wounds;

test("a marker pays its holder nothing when that holder darkened the board", () => {
  // "a little misleading that fight considering they are in my home territory". The enemy
  // had declared ERADICATION, which darkens every marker, and the round panel was still
  // crediting it the marker's face value for standing on the player's ground. Reading
  // control and reading what control is WORTH are two different questions.
  const dark = liveSitesFor({ disposition: "eradication", side: "enemy", objectives: CIRCUIT_CLASH.objectives });
  assert.equal(dark.length, 0, "ERADICATION scores no ground, for either army");

  const lit = liveSitesFor({ disposition: "dominion", side: "enemy", objectives: CIRCUIT_CLASH.objectives });
  assert.equal(lit.length, CIRCUIT_CLASH.objectives.length, "DOMINION lights the whole board");
});

test("what a marker pays is read through the holder's rule, not off the marker", () => {
  // SAFEGUARD is the other half of the same bug: it keeps one marker and DOUBLES it, so a
  // panel printing face value understates it exactly as it overstated the dark ones.
  const kept = liveSitesFor({ disposition: "safeguard", side: "player", objectives: CIRCUIT_CLASH.objectives });
  assert.equal(kept.length, 1);
  const printed = CIRCUIT_CLASH.objectives.find((objective) => objective.id === kept[0].id);
  assert.ok(kept[0].points > printed.points, "the marker SAFEGUARD keeps is worth more than it says on the board");
});

test("the shelf does not offer a rebuild a patch would already finish", () => {
  // "why would i do a full recovery 4 for when i get it for 2". FIELD REPAIR completes to
  // full whenever its heal reaches the cap, so under that much damage the two purchases buy
  // the identical result at twice the price. A dominated option is not a decision.
  for (const down of [1, 3, FIELD_REPAIR_WOUNDS]) {
    const services = servicesFor(BASTION_FULL - down);
    assert.ok(services.includes("field-repair"), `a patch is offered at ${down} down`);
    assert.ok(!services.includes("rebuild"), `no rebuild at ${down} down, where a patch already finishes it`);
  }
});

test("a rebuild is offered once it does something a patch cannot", () => {
  for (const down of [FIELD_REPAIR_WOUNDS + 0.5, FIELD_REPAIR_WOUNDS + 5]) {
    const services = servicesFor(BASTION_FULL - down);
    assert.ok(services.includes("rebuild"), `rebuild is offered at ${down} down`);
    assert.ok(services.includes("field-repair"), "and the patch stays, as the cheaper partial");
  }
});

test("the rebuild gate measures distance from full THROUGH the refit", () => {
  // The first version of this file tested an unrefitted hull only, so profileWithRefit and
  // battleProfileFor returned the same number and swapping one for the other changed
  // nothing a test could see. The mutant that makes that swap SURVIVED, which is the whole
  // argument for running them: eight passing tests said the gate was guarded and one of the
  // three things it does was not.
  // bastion:wall takes a BASTION from 14 wounds to 18. At 13 it is one down on the profile
  // it was printed with and five down on the profile it is actually carrying.
  const withWall = (wounds) => marketFor({
    roster: [{ id: "bastion#1", formationId: "bastion", name: "BASTION", wounds, refit: "bastion:wall" }],
    purse: 20, seed: 0, battle: 1,
  }).filter((offer) => offer.kind === "service").map((offer) => offer.id);

  const reinforced = profileWithRefit("bastion", "bastion:wall").wounds;
  assert.ok(reinforced > BASTION_FULL, "the wall refit has to move the cap or this proves nothing");

  assert.ok(
    withWall(reinforced - (FIELD_REPAIR_WOUNDS + 1)).includes("rebuild"),
    "past what a patch finishes on the REFITTED cap, even though the base profile says otherwise",
  );
  assert.ok(
    !withWall(reinforced - 1).includes("rebuild"),
    "and a scratch is still a scratch",
  );
});

test("an undamaged warband is offered neither mend", () => {
  const services = marketFor({
    roster: [{ id: "bastion#1", formationId: "bastion", name: "BASTION", wounds: null }],
    purse: 20, seed: 0, battle: 1,
  }).filter((offer) => offer.kind === "service").map((offer) => offer.id);
  assert.ok(!services.includes("field-repair"));
  assert.ok(!services.includes("rebuild"));
});

const wreckRound = {
  players: [{ id: "p1", name: "RECON TANK", wounds: 5 }],
  enemies: [{ id: "e1", name: "AEGIS COHORT", wounds: 0 }],
  synergies: { player: [] }, log: [], spends: [],
};
const wreckPrevious = {
  players: [{ id: "p1", name: "RECON TANK", wounds: 5 }],
  enemies: [{ id: "e1", name: "AEGIS COHORT", wounds: 3 }],
};

test("a wreck says what it was worth under the rule that was declared", () => {
  // "Feels like i should have won that fight but didnt" — announced on a DOMINION run,
  // which scores held ground and pays a wreck nothing. Celebrating the kill the same way
  // under every declaration tells the player they did something scoring while the battle is
  // decided on objective-rounds somewhere else on the board.
  const dominion = headlineFor({ round: wreckRound, previous: wreckPrevious, disposition: "dominion" });
  assert.equal(dominion.tone, "kill");
  assert.match(dominion.text, /AEGIS COHORT/);
  assert.match(dominion.text, /pays nothing/);

  const eradication = headlineFor({ round: wreckRound, previous: wreckPrevious, disposition: "eradication" });
  assert.equal(eradication.tone, "kill");
  assert.doesNotMatch(eradication.text, /pays nothing/, "ERADICATION pays a wreck bounty, so the kill IS the score");
});

test("a wreck reads plainly when no disposition was supplied", () => {
  // The argument is optional, and a caller that does not know the declaration must not have
  // a claim about payment invented for it.
  const bare = headlineFor({ round: wreckRound, previous: wreckPrevious });
  assert.equal(bare.text, "You wrecked AEGIS COHORT.");
});

test("losing a formation still outranks wrecking one", () => {
  // The disposition clause must not have reordered the banners underneath it.
  const bothDied = {
    ...wreckRound,
    players: [{ id: "p1", name: "RECON TANK", wounds: 0 }],
  };
  const headline = headlineFor({ round: bothDied, previous: wreckPrevious, disposition: "dominion" });
  assert.equal(headline.tone, "loss");
  assert.match(headline.text, /You lost RECON TANK/);
});
