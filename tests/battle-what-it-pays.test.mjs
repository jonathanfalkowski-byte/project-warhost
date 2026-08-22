import test from "node:test";
import assert from "node:assert/strict";

import { headlineFor, roundPanelFor } from "../src/battle/afterAction.js";
import { CIRCUIT_CLASH, THE_NARROWS } from "../src/battle/battleMission.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
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

// The round panel itself, rather than the rule underneath it. This is the layer all three
// reported defects lived in, and until roundPanelFor was pulled out of BattleApp there was
// no way to reach it: the component is hook-driven with no props, so server-rendering it
// produces the screen before anything is chosen and never a resolved battle.

const OBJECTIVES = CIRCUIT_CLASH.objectives;
const roundHolding = (holders) => ({
  objectives: OBJECTIVES.map((objective) => ({
    objectiveId: objective.id,
    name: objective.name,
    player: holders[objective.id] === "player" ? 6 : 0,
    enemy: holders[objective.id] === "enemy" ? 6 : 0,
    holder: holders[objective.id] ?? "contested",
    points: objective.points,
  })),
});

test("the panel pays a DOMINION holder the marker's full value", () => {
  const rows = roundPanelFor({
    round: roundHolding({ reactor: "player" }),
    objectives: OBJECTIVES, playerDisposition: "dominion", enemyDisposition: "dominion",
  });
  const reactor = rows.find((row) => row.objectiveId === "reactor");
  assert.equal(reactor.paid, 2, "REACTOR SPINE is a 2 VP marker and DOMINION lights the board");
  assert.equal(reactor.dark, false);
});

test("the panel pays an ERADICATION holder nothing for ground it is standing on", () => {
  // The reported bug, at the layer it was reported in: the enemy had declared ERADICATION,
  // was deep in the player's half, and the panel credited it the marker's face value.
  const rows = roundPanelFor({
    round: roundHolding({ reactor: "enemy", "north-relay": "enemy" }),
    objectives: OBJECTIVES, playerDisposition: "dominion", enemyDisposition: "eradication",
  });
  for (const id of ["reactor", "north-relay"]) {
    const row = rows.find((entry) => entry.objectiveId === id);
    assert.equal(row.holder, "enemy", `${id} is held by the enemy`);
    assert.equal(row.paid, 0, `${id} pays an ERADICATION army nothing`);
    assert.equal(row.dark, true, `${id} reads as taken for nothing`);
  }
});

test("each side is read through its OWN declaration, in the same round", () => {
  // The two halves cannot share a lookup: the player scoring a marker says nothing about
  // whether the enemy would be paid for the same ground.
  const rows = roundPanelFor({
    round: roundHolding({ reactor: "player", "north-relay": "enemy" }),
    objectives: OBJECTIVES, playerDisposition: "dominion", enemyDisposition: "eradication",
  });
  assert.equal(rows.find((row) => row.objectiveId === "reactor").paid, 2);
  assert.equal(rows.find((row) => row.objectiveId === "north-relay").paid, 0);
});

test("the panel doubles what SAFEGUARD keeps, rather than printing face value", () => {
  // SOUTH RELAY is printed as 1 VP and pays a SAFEGUARD player 2. The old panel showed the
  // 1, understating it exactly as it overstated the dark markers.
  const rows = roundPanelFor({
    round: roundHolding({ "south-relay": "player", reactor: "player" }),
    objectives: OBJECTIVES, playerDisposition: "safeguard", enemyDisposition: "dominion",
  });
  const kept = rows.find((row) => row.objectiveId === "south-relay");
  const printed = OBJECTIVES.find((objective) => objective.id === "south-relay").points;
  assert.ok(kept.paid > printed, `SAFEGUARD pays ${kept.paid} for a marker printed at ${printed}`);
  // And everything past its own half is dark, held or not.
  assert.equal(rows.find((row) => row.objectiveId === "reactor").dark, true);
});

test("a SAFEGUARD enemy is paid for ITS half, which is the far one", () => {
  // The mutant that survived the first pass hardcoded side: "player" in the live-site
  // lookup, and nothing noticed. `side` only changes the answer for SAFEGUARD - DOMINION
  // lights every marker for both armies and ERADICATION darkens every marker for both - and
  // every SAFEGUARD case in this file used the PLAYER side, where the hardcode is
  // indistinguishable from the truth.
  // SAFEGUARD keeps south-relay for the player and north-relay for the enemy, because each
  // army's own half is the one it deploys in. So an enemy declaring it is paid at the top of
  // the board and paid nothing at the bottom, which is the reverse of the player.
  const rows = roundPanelFor({
    round: roundHolding({ "north-relay": "enemy", "south-relay": "enemy" }),
    objectives: OBJECTIVES, playerDisposition: "dominion", enemyDisposition: "safeguard",
  });
  const own = rows.find((row) => row.objectiveId === "north-relay");
  const far = rows.find((row) => row.objectiveId === "south-relay");
  assert.ok(own.paid > 0, "the enemy is paid for the half it is defending");
  assert.equal(own.dark, false);
  assert.equal(far.paid, 0, "and paid nothing for ground in the player's half");
  assert.equal(far.dark, true);
});

test("a contested marker is neither paid nor dark", () => {
  // Nobody holds it, so nobody is being paid nothing for it - "dark" is a statement about a
  // holder, and printing it on a contested row would be a claim about a side that has none.
  const rows = roundPanelFor({
    round: roundHolding({}),
    objectives: OBJECTIVES, playerDisposition: "eradication", enemyDisposition: "eradication",
  });
  for (const row of rows) {
    assert.equal(row.holder, "contested");
    assert.equal(row.paid, 0);
    assert.equal(row.dark, false, "contested is not the same as held for nothing");
  }
});

test("the panel carries the control numbers through untouched", () => {
  const rows = roundPanelFor({
    round: roundHolding({ reactor: "player" }),
    objectives: OBJECTIVES, playerDisposition: "dominion", enemyDisposition: "dominion",
  });
  const reactor = rows.find((row) => row.objectiveId === "reactor");
  assert.equal(reactor.name, "REACTOR SPINE");
  assert.equal(reactor.player, 6);
  assert.equal(reactor.enemy, 0);
  assert.equal(rows.length, OBJECTIVES.length);
});

test("no round is an empty panel rather than a crash", () => {
  assert.deepEqual(roundPanelFor({ objectives: OBJECTIVES }), []);
  assert.deepEqual(roundPanelFor(), []);
});

// THE TWO FIGHTS THAT REPORTED THIS, pinned with the numbers off the screen rather than with
// synthetic rounds. Everything above tests the rule; these test the cases that were actually
// played and actually complained about, so a regression has to survive being recognisable.

const rowsFrom = (mission, control) => ({
  objectives: mission.objectives.map((objective) => {
    const [player, enemy] = control[objective.id];
    return {
      objectiveId: objective.id,
      name: objective.name,
      player,
      enemy,
      holder: player > enemy ? "player" : enemy > player ? "enemy" : "contested",
      points: objective.points,
    };
  }),
});

const paidTo = (rows, side) => rows
  .filter((row) => row.holder === side)
  .reduce((sum, row) => sum + row.paid, 0);

test("fight one: an ERADICATION enemy in the player's half is paid nothing for standing there", () => {
  // THE NARROWS, round 5, WARHOST DOMINION 13 v HELIOCH ERADICATION 5. The panel read
  // "THE SPAN ENEMY +2" and "NORTH YARD ENEMY +1" while the header said HELIOCH +2, and the
  // rows and the header were disagreeing four lines apart on the same screen.
  const round = rowsFrom(THE_NARROWS, {
    "south-yard": [7, 5],
    "west-stack": [2, 0],
    "the-span": [4, 16.5],
    "east-stack": [4, 0],
    "north-yard": [0, 4],
  });
  const rows = roundPanelFor({
    round, objectives: THE_NARROWS.objectives,
    playerDisposition: "dominion", enemyDisposition: "eradication",
  });

  // The two rows that were wrong, and they were the two the player was looking at.
  for (const id of ["the-span", "north-yard"]) {
    const row = rows.find((entry) => entry.objectiveId === id);
    assert.equal(row.holder, "enemy");
    assert.equal(row.paid, 0, `${id} pays an ERADICATION army nothing`);
    assert.equal(row.dark, true);
  }

  // And the reconciliation that failed on screen: the player's rows have to add up to the
  // WARHOST +3 the header printed, and the enemy's to nothing, because everything HELIOCH
  // scored that round it scored by doing damage rather than by holding ground.
  assert.equal(paidTo(rows, "player"), 3, "SOUTH YARD, WEST STACK and EAST STACK at 1 VP each");
  assert.equal(paidTo(rows, "enemy"), 0, "no ground scores for ERADICATION, however much of it they are standing on");
});

test("fight two: two DOMINION armies are both paid face value, and the panel was right", () => {
  // BREAK THE CIRCUIT, round 5, 9-10. Worth pinning precisely because the panel was NOT the
  // bug here - both armies had declared DOMINION, so face value was the correct answer and
  // the rows already reconciled with the header. The defect in this fight was the banner.
  // A fix that "corrects" this panel would be breaking it.
  const round = rowsFrom(CIRCUIT_CLASH, {
    "south-relay": [2, 0],
    "west-works": [2, 0],
    reactor: [3, 0],
    "east-gantry": [2, 4],
    "north-relay": [0, 6],
  });
  const rows = roundPanelFor({
    round, objectives: CIRCUIT_CLASH.objectives,
    playerDisposition: "dominion", enemyDisposition: "dominion",
  });

  assert.equal(paidTo(rows, "player"), 4, "SOUTH RELAY 1 + WEST WORKS 1 + REACTOR SPINE 2");
  assert.equal(paidTo(rows, "enemy"), 2, "EAST GANTRY 1 + NORTH RELAY 1");
  assert.ok(rows.every((row) => row.dark === false), "nothing is dark when both armies light the board");
});

test("fight two: and the banner that was the actual defect", () => {
  // "You wrecked AEGIS COHORT." on a DOMINION run, which scores heldPoints and pays a wreck
  // nothing. Announced while NORTH RELAY had sat 0 v 6 for the whole battle.
  const headline = headlineFor({
    round: {
      players: [{ id: "p1", name: "RECON TANK", wounds: 4 }],
      enemies: [{ id: "e1", name: "AEGIS COHORT", wounds: 0 }],
      synergies: { player: [] }, log: [], spends: [],
    },
    previous: {
      players: [{ id: "p1", name: "RECON TANK", wounds: 4 }],
      enemies: [{ id: "e1", name: "AEGIS COHORT", wounds: 2 }],
    },
    disposition: "dominion",
  });
  assert.match(headline.text, /AEGIS COHORT/);
  assert.match(headline.text, /DOMINION pays nothing for it/);
});

test("fight one, second line: a patch reports what it put back, not what it tried", () => {
  // Also off that screen: "SALVAGE TENDER patches GAFF HOOK for 2". The heal has always been
  // capped at the hull's maximum, but the log recorded the INTENT, so a formation close to
  // full printed the whole attempt having been given the remainder. Same defect as the round
  // panel crediting a darkened marker - a number on screen that is not what happened.
  // Half a wound of room, because wounds are fractional here and one patch is worth a whole
  // one, so the intent and the outcome cannot be confused for each other.
  const medic = deployUnit({ formationId: "hauler", name: "SALVAGE TENDER", position: { x: 50, y: 90 }, id: "h#1" });
  const patient = {
    ...deployUnit({ formationId: "harpoon", name: "GAFF HOOK", position: { x: 52, y: 90 }, id: "g#1" }),
    wounds: 5.5,
  };
  assert.ok(medic.keywords.includes("REPAIR"), "the SALVAGE TENDER is the hull that patches");
  assert.equal(patient.maxWounds, 6, "half a wound below its cap");

  const out = resolveBattle({
    playerUnits: [medic, patient],
    // Far enough up the board that nothing is in range and the repair phase is the only
    // thing in the log.
    enemyUnits: [deployUnit({ formationId: "skimmer", name: "FAR", position: { x: 50, y: 5 }, id: "e#1" })],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {},
  });

  const patches = out.rounds.flatMap((round) => round.log).filter((entry) => entry.phase === "repair");
  assert.equal(patches.length, 1);
  assert.equal(patches[0].actor, "SALVAGE TENDER");
  assert.equal(patches[0].target, "GAFF HOOK");
  assert.equal(patches[0].amount, 0.5, "half a wound was restored, so half a wound is what it says");

  const healed = out.rounds.at(-1).players.find((unit) => unit.id === "g#1");
  assert.equal(healed.wounds, 6, "and it stops at the cap rather than overshooting it");
});
