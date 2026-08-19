import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

import {
  MINIMUM_FORCE,
  REPAIR_BETWEEN_BATTLES,
  RUN_LADDER,
  RUN_LENGTH,
  STARTING_ROSTER,
  advance,
  applyBattle,
  RETIRE_REFUND,
  COMMAND_REGEN_CAP,
  buy,
  FIELD_REPAIR_WOUNDS,
  HONOURS,
  engagementFor,
  fieldableFrom,
  offersFor,
  repair,
  repairAmountFor,
  retire,
  runSummary,
  startRun,
  startingRoster,
} from "../src/battle/campaign.js";

import { MAX_COPIES, MENDS, SERVICES, SHELF_UNITS, UNIT_COSTS, copiesOf, costOf, marketFor, shelfRefitsFor } from "../src/battle/market.js";
import { profileWithRefit, refitsFor } from "../src/battle/refits.js";
import { plansFor } from "../src/battle/battlePlans.js";
import { armyFor } from "../src/battle/battleMission.js";
import { DETACHMENTS } from "../src/battle/stratagems.js";
import { battleProfileFor, statLineFor } from "../src/battle/battleProfiles.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { CIRCUIT_CLASH, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
import { FORMATIONS } from "../src/formationData.js";

// A finished battle where every player formation ends on the wounds given here.
const battleEndingWith = (wounds) => ({
  rounds: [{
    players: Object.entries(wounds).map(([id, remaining]) => ({ id, name: id.toUpperCase(), wounds: remaining })),
    enemies: [],
    objectives: [],
  }],
  playerScore: 10,
  enemyScore: 5,
});

test("a run starts fieldable, and the same seed starts the same run", () => {
  const run = startRun({ detachmentId: "voidbreaker", seed: 7 });
  assert.equal(run.status, "active");
  assert.equal(run.battle, 1);
  assert.ok(run.roster.length >= MINIMUM_FORCE, "a run starts unable to field an army");
  assert.equal(run.roster.length, STARTING_ROSTER);
  assert.ok(run.roster.length <= FORMATIONS.length);
  assert.deepEqual(startRun({ detachmentId: "voidbreaker", seed: 7 }), run, "the same seed built a different run");
  assert.notDeepEqual(startingRoster({ seed: 1 }), startingRoster({ seed: 2 }), "every seed starts the same roster");
  // Nobody starts damaged, and nobody appears twice.
  assert.ok(run.roster.every((entry) => entry.wounds === null));
  assert.equal(new Set(run.roster.map((entry) => entry.formationId)).size, run.roster.length);
});

test("the ladder escalates what the enemy is holding, not how much of it turned up", () => {
  // It used to ramp by SIZE — the front three of a fixed list, then four, then five — which
  // made the opening engagement a five-against-three the player won 96% of the time, and
  // made "harder" mean "the same army with one more vehicle bolted on". The enemy is built
  // per engagement now and always fields a full deployment.
  assert.equal(RUN_LADDER.length, RUN_LENGTH);
  for (const rung of RUN_LADDER) {
    assert.equal(rung.enemyCount, undefined, "the ladder still hands the enemy a size");
  }
  const full = engagementFor(startRun({ seed: 2 }));
  assert.equal(full.army.units.length, full.mission.enemyDeployment.length, "the first engagement is not a full army");
  const hands = RUN_LADDER.map((rung) => rung.handSize);
  assert.deepEqual(hands, [...hands].sort((a, b) => a - b), "the enemy's hand does not grow");
  // Boards alternate, so no plan can be optimised for one of them across a whole run.
  assert.ok(new Set(RUN_LADDER.map((rung) => rung.mission)).size > 1, "a run is fought on one board");
  for (let index = 1; index < RUN_LADDER.length; index += 1) {
    assert.notEqual(RUN_LADDER[index].mission, RUN_LADDER[index - 1].mission, "the same board twice in a row");
  }
});

test("an engagement is fixed by the run and its number", () => {
  const run = startRun({ seed: 4 });
  const first = engagementFor(run);
  assert.equal(first.number, 1);
  assert.equal(first.army.units.length, first.mission.enemyDeployment.length);
  assert.equal(first.enemyHand.length, RUN_LADDER[0].handSize);
  assert.deepEqual(engagementFor(run), first, "the same run drew a different engagement");
  // A later battle is a different fight.
  const later = engagementFor({ ...run, battle: 4 });
  assert.notEqual(later.mission.id + later.enemyHand.join(), first.mission.id + first.enemyHand.join());
  // And different runs do not all face the same cards. Two adjacent seeds can legitimately
  // draw the same single card out of a four-card pool, so the guard is across a range.
  const openings = new Set(Array.from({ length: 12 }, (unused, seed) => engagementFor(startRun({ seed })).enemyHand.join("+")));
  assert.ok(openings.size > 1, "every run opens against the same card");
});

test("a losing battle does not end the run; an army too small to field does", () => {
  // A single battle is close to a coin flip. Ending the run on one loss killed 46% of runs
  // at the first fight and let 0.1% finish the ladder — the sweep said so before anyone
  // played it. What a loss costs is the casualties and the reward.
  const run = startRun({ seed: 1 });
  const deployedIds = run.roster.slice(0, 5).map((entry) => entry.id);
  const survived = Object.fromEntries(deployedIds.map((id) => [id, 4]));
  const lostBattle = applyBattle({ run, result: battleEndingWith(survived), deployedIds, won: false });
  assert.equal(lostBattle.status, "active", "one lost battle ended the run");
  assert.equal(lostBattle.history.at(-1).won, false);

  // Losing almost everyone does end it.
  const wiped = Object.fromEntries(deployedIds.map((id) => [id, 0]));
  const broken = applyBattle({ run, result: battleEndingWith(wiped), deployedIds, won: true });
  assert.equal(fieldableFrom(broken).length < MINIMUM_FORCE, true);
  assert.equal(broken.status, "broken");
});

test("wounds carry, wrecks are struck off, and the bench is untouched", () => {
  const run = startRun({ seed: 2 });
  const [first, second, ...rest] = run.roster;
  const deployedIds = [first.id, second.id];
  const after = applyBattle({
    run,
    result: battleEndingWith({ [first.id]: 3.456, [second.id]: 0 }),
    deployedIds,
    won: true,
  });
  const carried = after.roster.find((entry) => entry.formationId === first.formationId);
  assert.equal(carried.wounds, 3.46, "the survivor did not carry its damage forward");
  assert.equal(after.roster.some((entry) => entry.formationId === second.formationId), false, "a wreck came back");
  // Everyone who did not fight is exactly as they were.
  for (const entry of rest) {
    assert.deepEqual(after.roster.find((item) => item.formationId === entry.formationId), entry);
  }
  assert.deepEqual(after.history.at(-1).lost, [second.name]);
});

test("nothing is repaired for free — DOMINION's held ground is the whole yard", () => {
  const run = startRun({ seed: 3 });
  const target = run.roster[0];
  const ceiling = battleProfileFor(target.formationId).wounds;
  const hurt = { ...run, supply: 0, roster: [{ ...target, wounds: 1 }, ...run.roster.slice(1)] };
  // No supply, no repair. Damage accumulates across a run unless the purse or the ground
  // pays for it, which is what makes preserving the army a decision rather than a slogan.
  assert.equal(repair(hurt).roster[0].wounds, 1, "something was patched up for nothing");
  assert.equal(repairAmountFor(hurt), REPAIR_BETWEEN_BATTLES);
  // Ground held turns into repair, and that is the only thing that does.
  const supplied = { ...hurt, supply: 3 };
  assert.equal(repairAmountFor(supplied), REPAIR_BETWEEN_BATTLES + 3);
  assert.equal(repair(supplied).roster[0].wounds, Math.min(1 + REPAIR_BETWEEN_BATTLES + 3, ceiling));
  // Repaired to full, a formation stops carrying damage at all rather than sitting at its
  // ceiling as a number — `wounds: null` means "as it came out of the yard" everywhere.
  const nearlyWhole = repair({ ...run, supply: 2, roster: [{ ...target, wounds: ceiling - 0.5 }] }).roster[0];
  assert.equal(nearlyWhole.wounds, null, "a fully repaired formation still reads as damaged");
  assert.equal(repair({ ...run, supply: 2, roster: [{ ...target, wounds: ceiling }] }).roster[0].wounds, null);
  // An undamaged formation is left alone rather than given phantom wounds.
  assert.equal(repair(run).roster[0].wounds, null);
});

test("each disposition leaves something behind that outlives the battle", () => {
  // If only SAFEGUARD had a run-level payoff it would simply be the right answer: on that
  // reading it won 3.24 battles to 1.44 for the other two.
  const run = startRun({ seed: 6 });
  const deployedIds = run.roster.slice(0, 3).map((entry) => entry.id);
  const withEnemies = {
    rounds: [{
      players: deployedIds.map((id) => ({ id, name: id, wounds: 5 })),
      enemies: [{ id: "a", wounds: 0 }, { id: "b", wounds: 0 }, { id: "c", wounds: 4 }],
      objectives: [{ objectiveId: "o1", holder: "player" }, { objectiveId: "o2", holder: "player" }, { objectiveId: "o3", holder: "enemy" }],
    }],
    playerScore: 9, enemyScore: 4,
  };
  const eradicated = applyBattle({ run, result: withEnemies, deployedIds, won: true, disposition: "eradication" });
  assert.equal(eradicated.attrition, 2, "breaking their army bought nothing for next time");
  assert.equal(eradicated.supply, 0);
  const dominated = applyBattle({ run, result: withEnemies, deployedIds, won: true, disposition: "dominion" });
  assert.equal(dominated.supply, 2, "holding ground bought nothing for next time");
  assert.equal(dominated.attrition, 0);
  assert.ok(repairAmountFor(dominated) > repairAmountFor(eradicated), "held ground did not turn into repair");
  // Attrition thins the next engagement but never empties the board — the early rungs
  // field three, so two attrition would take them to one without a floor.
  assert.equal(engagementFor({ ...eradicated, battle: 1 }).army.units.length, 3, "attrition emptied the early board");
  assert.ok(engagementFor({ ...eradicated, battle: 5 }).army.units.length >= 3);
  assert.ok(
    engagementFor({ ...eradicated, battle: 5 }).army.units.length
    < engagementFor({ ...run, battle: 5 }).army.units.length,
    "attrition did not thin the next engagement",
  );
  // And it is spent, not banked: a safeguard battle clears it.
  assert.equal(applyBattle({ run: eradicated, result: withEnemies, deployedIds, won: true, disposition: "safeguard" }).attrition, 0);
});

test("victory points are the currency, and income is what you scored", () => {
  // The score used to be a scoreboard and nothing else. Now how you score and what you can
  // afford are the same decision — and a battle you LOST still pays for what you took
  // while you were losing it, for the same reason a lost battle does not end the run.
  const run = startRun({ seed: 8 });
  assert.equal(run.purse, 0);
  const deployedIds = run.roster.slice(0, 3).map((entry) => entry.id);
  const survived = Object.fromEntries(deployedIds.map((id) => [id, 5]));
  const scored = { ...battleEndingWith(survived), playerScore: 12, enemyScore: 15 };
  const afterLoss = applyBattle({ run, result: scored, deployedIds, won: false });
  assert.equal(afterLoss.purse, 12, "a losing battle paid nothing");
  assert.equal(afterLoss.history.at(-1).earned, 12);
  // And a second battle adds to it rather than replacing it.
  assert.equal(applyBattle({ run: afterLoss, result: scored, deployedIds, won: true }).purse, 24);
});

test("every formation is priced, and nothing is free", () => {
  for (const formation of FORMATIONS) {
    const cost = costOf(formation.id);
    assert.ok(cost >= 2 && cost <= 9, `${formation.id} costs ${cost}`);
    assert.equal(UNIT_COSTS[formation.id], cost, `${formation.id} is not on the price list`);
  }
  // The prices are authored, not a formula off the stat line — a formula makes the SHIELD
  // WALKER and the SIEGE GUN CARRIAGE interchangeable once the labels are stripped. What
  // must hold is that they are not all the same number.
  assert.ok(new Set(Object.values(UNIT_COSTS)).size >= 4, "every formation costs the same");
  for (const service of Object.values(SERVICES)) assert.ok(service.cost >= 1 && service.name && service.text);
  assert.equal(costOf("not-a-formation"), 5, "an unknown formation is not priced at all");
});

test("the shelf sells hulls you already own, and does not run dry", () => {
  const run = { ...startRun({ seed: 8 }), purse: 20 };
  const shelf = offersFor(run);
  const held = new Set(run.roster.map((entry) => entry.formationId));
  const units = shelf.filter((offer) => offer.kind === "unit");
  // Full width regardless of what the warband already holds. It used to filter out
  // everything owned, so the shelf emptied as the run went on and the market ran out of
  // things to sell — which is most of why a bench never really formed.
  assert.equal(units.length, SHELF_UNITS, "the shelf is the wrong width");
  assert.ok(units.some((offer) => held.has(offer.id)), "the shelf still refuses to sell a second of anything");
  for (const offer of units) {
    assert.ok(offer.text.includes("WOUNDS"), "the shelf does not say what the money buys");
  }
  // Nothing is damaged, so repairs are not on the shelf.
  assert.equal(shelf.some((offer) => ["field-repair", "rebuild"].includes(offer.id)), false);
  const hurt = { ...run, roster: run.roster.map((entry, index) => (index === 0 ? { ...entry, wounds: 1 } : entry)) };
  assert.ok(offersFor(hurt).some((offer) => offer.id === "field-repair"));
  // The same run sees the same shelf.
  assert.deepEqual(offersFor(run), shelf);
  // And affordability is reported against the purse actually held.
  assert.equal(offersFor({ ...run, purse: 0 }).every((offer) => offer.affordable === false), true);
});

test("buying spends the purse, and what you cannot afford is refused", () => {
  const run = { ...startRun({ seed: 9 }), purse: 6 };
  const unit = offersFor(run).find((offer) => offer.kind === "unit" && offer.cost <= 6);
  const bought = buy({ run, offerId: unit.id });
  assert.equal(bought.roster.length, run.roster.length + 1, "the formation did not join");
  assert.equal(bought.purse, 6 - unit.cost);
  assert.equal(bought.spent, unit.cost);
  assert.equal(bought.roster.at(-1).wounds, null, "the purchase arrived damaged");

  // Too expensive is refused outright rather than quietly discounted or half-applied.
  const broke = { ...run, purse: 1 };
  const dear = offersFor(broke).find((offer) => offer.cost > 1);
  assert.deepEqual(buy({ run: broke, offerId: dear.id }), broke);
  assert.deepEqual(buy({ run, offerId: "not-on-the-shelf" }), run);
  // Buying a hull you already own gives you a SECOND ONE — its own entry, its own id, its
  // own damage track — rather than a duplicate the resolution cannot tell apart.
  const owned = run.roster[0].formationId;
  const stocked = { ...run, purse: 20, shelf: [owned, ...(run.shelf ?? [])] };
  const twice = buy({ run: stocked, offerId: owned });
  const instances = twice.roster.filter((entry) => entry.formationId === owned);
  assert.equal(instances.length, 2, "buying a hull you own did not give you a second one");
  assert.equal(new Set(twice.roster.map((entry) => entry.id)).size, twice.roster.length,
    "two formations share an id, so the battle cannot tell them apart");
  // And it comes off the shelf, so the same offer cannot be bought twice over.
  assert.equal((twice.shelf ?? []).filter((id) => id === owned).length,
    (stocked.shelf ?? []).filter((id) => id === owned).length - 1);
});

test("services do what they charge for", () => {
  const base = startRun({ seed: 10 });
  const hurt = {
    ...base, purse: 20,
    roster: base.roster.map((entry, index) => (index === 0 ? { ...entry, wounds: 1 } : entry)),
  };
  const repaired = buy({ run: hurt, offerId: "field-repair" });
  assert.ok(repaired.roster[0].wounds === null || repaired.roster[0].wounds > 1, "field repair healed nothing");
  assert.equal(repaired.purse, 20 - SERVICES["field-repair"].cost);

  const rebuilt = buy({ run: hurt, offerId: "rebuild" });
  assert.equal(rebuilt.roster[0].wounds, null, "a rebuild left it damaged");

  const requisitioned = buy({ run: hurt, offerId: "requisition" });
  assert.equal(requisitioned.commandPoints, hurt.commandPoints + 1);
  // A repair with nothing to repair still charges nothing and changes nothing.
  const whole = { ...base, purse: 20 };
  assert.equal(offersFor(whole).some((offer) => offer.id === "rebuild"), false);
});

test("the stat line is written once", () => {
  // The shelf, the deploy list and the card under a marker all print the same five
  // numbers. Three copies of the template is how the shelf ends up advertising a profile
  // the board does not have — which has already happened once here, with refits.
  const line = statLineFor(battleProfileFor("railjack"));
  assert.match(line, /^MOVE 8 · RANGE 30 · 3 SHOTS · 12 WOUNDS · CONTROL 4$/);
  // One shot is a SHOT. A profile that reads "1 SHOTS" is a profile nobody proofread.
  assert.match(statLineFor(battleProfileFor("bastion")), /1 SHOT · /);
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  // Both spellings: the template literal and the JSX one. Only checking the first left a
  // fourth copy of the line in the deploy list, printing "1 SHOTS" beside a card that said
  // "1 SHOT" for the same hull.
  assert.equal((source.match(/MOVE [{$]/g) ?? []).length, 0, "the screen still writes a stat line by hand");
  for (const file of ["market.js", "BattleApp.jsx"]) {
    const text = readFileSync(new URL(`../src/battle/${file}`, import.meta.url), "utf8");
    assert.ok(!/SHOTS ·/.test(text), `${file} prints its own stat line`);
  }
});

test("a repair goes to the formation you name, not to the worst-off one", () => {
  // The decision the money is asking about. With two of the same hull in the warband and a
  // dozen hulls in it, patching "whichever is worst" is a default, not a choice: the wreck
  // you are about to deploy is very often not the wreck with the fewest wounds left.
  const base = startRun({ seed: 10 });
  const hurt = {
    ...base,
    purse: 20,
    roster: base.roster.map((entry, index) => {
      if (index === 0) return { ...entry, wounds: 1 };
      if (index === 1) return { ...entry, wounds: 3 };
      return entry;
    }),
  };
  const worst = hurt.roster[0];
  const chosen = hurt.roster[1];

  const patched = buy({ run: hurt, offerId: "field-repair", targetId: chosen.id });
  assert.equal(patched.roster[0].wounds, 1, "the worst-off formation was patched instead of the named one");
  // The EXACT amount the shelf advertises. "more than it had" passes against a repair that
  // puts back one wound and charges for four.
  const whole = battleProfileFor(chosen.formationId).wounds;
  const expected = 3 + FIELD_REPAIR_WOUNDS;
  assert.equal(patched.roster[1].wounds, expected >= whole ? null : expected,
    `field repair put back something other than ${FIELD_REPAIR_WOUNDS} wounds`);
  assert.equal(patched.purse, 20 - SERVICES["field-repair"].cost);

  const rebuilt = buy({ run: hurt, offerId: "rebuild", targetId: chosen.id });
  assert.equal(rebuilt.roster[1].wounds, null, "the named formation was not rebuilt");
  assert.equal(rebuilt.roster[0].wounds, 1, "the rebuild went to the wrong hull");

  // Naming nobody is still the old behaviour, which is what the sweep buys and therefore
  // what the measured value of a repair is the value of.
  const defaulted = buy({ run: hurt, offerId: "rebuild" });
  assert.equal(defaulted.roster[0].wounds, null, "with nobody named the worst-off hull is no longer the one repaired");
  assert.equal(defaulted.roster[1].wounds, 3);

  // Naming a hull that does not need the work, or is not in the warband, refuses the
  // purchase. Quietly doing the work somewhere else and charging for it is the failure
  // this is guarding: the player would see the points leave and never learn where they went.
  const undamaged = hurt.roster.find((entry) => entry.wounds === null);
  assert.deepEqual(buy({ run: hurt, offerId: "field-repair", targetId: undamaged.id }), hurt);
  assert.deepEqual(buy({ run: hurt, offerId: "rebuild", targetId: "no-such-formation#9" }), hurt);
  assert.notEqual(worst.id, chosen.id);
});

test("the shelf names the two things that need a formation named first", () => {
  // The screen splits the market on this list: what you buy for the warband stays on the
  // shelf, and what you buy FOR a formation is bought on that formation's row. If the list
  // and the buying code ever disagree, a service silently becomes unbuyable.
  assert.deepEqual([...MENDS].sort(), ["field-repair", "rebuild"]);
  for (const id of MENDS) {
    assert.ok(SERVICES[id], `${id} is listed as needing a target but is not a service`);
    assert.match(SERVICES[id].text, /choosing/, `${SERVICES[id].name} does not say the formation is yours to pick`);
    assert.ok(SERVICES[id].short.length <= 10, `${SERVICES[id].name} has no short label for the row button`);
  }
  assert.ok(!MENDS.includes("requisition"), "requisition is not done to a formation");
  // And the amount the shelf advertises is the amount the buying code puts back.
  assert.match(SERVICES["field-repair"].text, new RegExp(String(FIELD_REPAIR_WOUNDS)));
});

test("buying takes one thing off the shelf rather than re-rolling it", () => {
  // Deriving the shelf from the roster on every read meant a purchase silently replaced
  // the other offers, so you could churn the shelf by spending. It is drawn once, when the
  // market opens, and then held.
  // A DELIBERATELY SMALL warband, so there are more formations off the shelf than on it.
  // With a full starting roster only three hulls are unheld, the shelf is three wide, and
  // re-rolling it after a purchase happens to return the same two — so the guard passed
  // whether the shelf was held or redrawn. A fixture that cannot tell the two apart is not
  // a guard.
  const base = startRun({ seed: 3 });
  const run = { ...base, roster: base.roster.slice(0, 2) };
  const deployedIds = run.roster.map((entry) => entry.id);
  const rich = applyBattle({
    run,
    result: { ...battleEndingWith(Object.fromEntries(deployedIds.map((id) => [id, 5]))), playerScore: 25, enemyScore: 5 },
    deployedIds,
    won: true,
  });
  assert.ok(FORMATIONS.length - rich.roster.length > SHELF_UNITS, "the fixture cannot fill a shelf");
  const before = offersFor(rich).filter((offer) => offer.kind === "unit").map((offer) => offer.id);
  const unheld = FORMATIONS.filter((formation) => !rich.roster.some((entry) => entry.formationId === formation.id)).length;
  assert.equal(before.length, Math.min(SHELF_UNITS, unheld));
  const after = offersFor(buy({ run: rich, offerId: before[0] })).filter((offer) => offer.kind === "unit").map((offer) => offer.id);
  assert.deepEqual(after, before.slice(1), "the shelf re-rolled when something was bought");
  // Buying everything empties it rather than refilling it.
  let emptied = rich;
  for (const id of before) emptied = buy({ run: emptied, offerId: id });
  assert.equal(offersFor(emptied).some((offer) => offer.kind === "unit"), false, "the shelf refilled itself");
});

test("a hull carries one refit, and the shelf stops offering it one", () => {
  const run = startRun({ seed: 5 });
  const deployedIds = run.roster.map((entry) => entry.id);
  const rich = applyBattle({
    run,
    result: { ...battleEndingWith(Object.fromEntries(deployedIds.map((id) => [id, 5]))), playerScore: 30, enemyScore: 5 },
    deployedIds,
    won: true,
  });
  const refit = offersFor(rich).find((offer) => offer.kind === "refit");
  assert.ok(refit, "no refit was ever on the shelf");
  const fitted = buy({ run: rich, offerId: refit.id });
  const carrier = fitted.roster.find((entry) => entry.formationId === refit.formationId);
  assert.equal(carrier.refit, refit.id, "the refit did not land on the formation");
  // Exactly one hull changed, and it is not offered a second one.
  assert.equal(fitted.roster.filter((entry) => entry.refit).length, 1);
  assert.equal(
    offersFor(fitted).some((offer) => offer.kind === "refit" && offer.formationId === refit.formationId),
    false,
    "a formation already carrying a refit was offered another",
  );
});

test("the shelf will not sell a refit to a hull that cannot take it", () => {
  // Tested against the market directly rather than through a run: the run snapshots its
  // shelf, so whether these filters hold depends on what the snapshot happened to contain.
  const [first, second] = refitsFor("railjack");
  const carrying = [{ formationId: "railjack", name: "R", wounds: null, refit: first.id }];
  const offered = marketFor({ roster: carrying, purse: 99, shelf: [], refitShelf: [first.id, second.id] })
    .filter((offer) => offer.kind === "refit");
  assert.deepEqual(offered, [], "offered a second refit to a hull already carrying one");

  // And a refit for a formation the warband does not own is not for sale either.
  const strangers = marketFor({
    roster: [{ formationId: "skimmer", name: "S", wounds: null, refit: null }],
    purse: 99, shelf: [], refitShelf: [first.id],
  }).filter((offer) => offer.kind === "refit");
  assert.deepEqual(strangers, [], "offered a refit for a formation nobody owns");

  // A hull that owns the formation and carries nothing is offered it.
  const eligible = marketFor({
    roster: [{ formationId: "railjack", name: "R", wounds: null, refit: null }],
    purse: 99, shelf: [], refitShelf: [first.id],
  }).filter((offer) => offer.kind === "refit");
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, first.id);
  // The draw only ever considers hulls with an empty mount.
  assert.deepEqual(shelfRefitsFor({ seed: 1, battle: 1, roster: carrying }), []);
});

test("command points do not refill between engagements", () => {
  // They used to refill in full, which made the decision the same every battle: you always
  // had three, so you always spent three the same way. "I found myself just hitting the 3
  // command point things every time." Now what you spend is gone and what you keep carries.
  const run = startRun({ seed: 4 });
  const opening = run.commandPoints;
  assert.ok(opening > 0);
  const deployedIds = run.roster.map((entry) => entry.id);
  // A loss with nobody in command regains nothing, so the drain is visible on its own.
  const bleak = battleEndingWith(Object.fromEntries(deployedIds.map((id) => [id, 5])));
  const after = applyBattle({ run, result: bleak, deployedIds, won: false, commandSpent: 2 });
  assert.equal(after.commandPoints, opening - 2, "the points refilled");
  assert.equal(after.history.at(-1).commandSpent, 2);
  assert.equal(after.history.at(-1).regained, 0);
  // Unspent points carry rather than expiring.
  assert.equal(applyBattle({ run: after, result: bleak, deployedIds, won: false, commandSpent: 0 }).commandPoints, after.commandPoints);
  // They never go negative, however much a battle claims to have spent.
  assert.equal(applyBattle({ run, result: bleak, deployedIds, won: false, commandSpent: 99 }).commandPoints, 0);
  // REQUISITION in the market buys one.
  const bought = buy({ run: { ...after, purse: 20 }, offerId: "requisition" });
  assert.equal(bought.commandPoints, after.commandPoints + 1);
});

test("command points come back from the army you fielded, not only from the purse", () => {
  // Buying them with victory points cannot be the only tap. Tying the free one to a
  // keyword makes the COMMAND VEHICLE — and the SPOTTER MAST refit that grants COMMAND —
  // into an economy rather than a stat line.
  const run = startRun({ seed: 4 });
  const deployedIds = run.roster.map((entry) => entry.id);
  const ending = (commanderIds) => ({
    rounds: [{
      players: deployedIds.map((id) => ({
        id, name: id, wounds: 5, keywords: commanderIds.includes(id) ? ["COMMAND"] : [],
      })),
      enemies: [], objectives: [],
    }],
    playerScore: 10, enemyScore: 4,
  });
  const spent = { run, deployedIds, commandSpent: 0 };
  const lostAlone = applyBattle({ ...spent, result: ending([]), won: false });
  const wonAlone = applyBattle({ ...spent, result: ending([]), won: true });
  const wonWithCommand = applyBattle({ ...spent, result: ending([deployedIds[0]]), won: true });
  assert.equal(lostAlone.history.at(-1).regained, 0, "losing with nobody in command paid a point");
  assert.equal(wonAlone.history.at(-1).regained, 1, "taking the engagement paid nothing");
  assert.equal(wonWithCommand.history.at(-1).regained, 2, "a commander coming home paid nothing");
  // Capped, so a warband full of command vehicles cannot print points.
  const swarm = applyBattle({ ...spent, result: ending(deployedIds), won: true });
  assert.equal(swarm.history.at(-1).regained, COMMAND_REGEN_CAP);
  // A commander that did not come back pays nothing.
  const deadCommander = applyBattle({
    run, won: true, commandSpent: 0, deployedIds: [deployedIds[0]],
    result: {
      rounds: [{ players: [{ id: deployedIds[0], name: "GONE", wounds: 0, keywords: ["COMMAND"] }], enemies: [], objectives: [] }],
      playerScore: 10, enemyScore: 4,
    },
  });
  assert.equal(deadCommander.history.at(-1).commanders, 0, "a wreck counted as a commander");
});

test("a battle records who came back, not just who did not", () => {
  // "After the battle how do I know which units survived?" The roster shrank and nothing
  // ever said why.
  const run = startRun({ seed: 6 });
  const [first, second, ...bench] = run.roster;
  const deployedIds = [first.id, second.id];
  const after = applyBattle({
    run,
    result: battleEndingWith({ [first.id]: 4, [second.id]: 0 }),
    deployedIds,
    won: true,
  });
  const record = after.history.at(-1);
  assert.deepEqual(record.survivors, [first.name], "the record does not say who came back");
  assert.deepEqual(record.lost, [second.name]);
  // Anyone benched is in neither list, because they were not in the battle.
  for (const entry of bench) {
    assert.equal(record.survivors.includes(entry.name), false);
    assert.equal(record.lost.includes(entry.name), false);
  }
});

test("a formation can be retired for half of what it cost", () => {
  // A market you can only buy into is a shopping list, not a build. Swapping the warband
  // has to be possible, and lossy.
  const run = { ...startRun({ seed: 7 }), purse: 0 };
  const sold = run.roster[0];
  const after = retire({ run, id: sold.id });
  assert.equal(after.roster.length, run.roster.length - 1);
  assert.equal(after.purse, Math.floor(costOf(sold.formationId) * RETIRE_REFUND));
  assert.ok(after.purse < costOf(sold.formationId), "retiring paid back the full price");
  assert.equal(after.roster.some((entry) => entry.id === sold.id), false);
  // ONE of them. Keyed on the formation it sold every railjack in the warband at once and
  // paid for a single one.
  const twinned = { ...run, roster: [...run.roster, { ...sold, id: `${sold.formationId}#twin` }] };
  const one = retire({ run: twinned, id: sold.id });
  assert.equal(one.roster.filter((entry) => entry.formationId === sold.formationId).length, 1,
    "retiring one hull sold every hull of that kind");
  assert.equal(one.purse, Math.floor(costOf(sold.formationId) * RETIRE_REFUND), "and paid for only one of them");
  // Retiring down to an army that cannot take the field is refused, not allowed and then
  // punished — ending a run by selling your own army is not a decision anyone means to make.
  let stripped = run;
  for (let guard = 0; guard < 10; guard += 1) {
    const next = retire({ run: stripped, id: stripped.roster.at(-1)?.id });
    if (next === stripped) break;
    stripped = next;
  }
  assert.equal(fieldableFrom(stripped).length, MINIMUM_FORCE);
  assert.deepEqual(retire({ run, id: "not-in-the-warband" }), run);
});

test("the market is drawn from the run rather than from nowhere", () => {
  const shelves = new Set(Array.from({ length: 8 }, (unused, seed) => marketFor({ seed, battle: 1, roster: [], purse: 99 })
    .filter((offer) => offer.kind === "unit").map((offer) => offer.id).join("+")));
  assert.ok(shelves.size > 1, "every run sees the same shelf");
  const across = new Set([1, 2, 3, 4].map((battle) => marketFor({ seed: 1, battle, roster: [], purse: 99 })
    .filter((offer) => offer.kind === "unit").map((offer) => offer.id).join("+")));
  assert.ok(across.size > 1, "the shelf never changes across a run");
  // A warband holding one of everything is still offered formations — a second of one of
  // them. The shelf running dry is what made a bench impossible to build.
  const everything = FORMATIONS.map((formation) => ({ id: `${formation.id}#x`, formationId: formation.id, wounds: null }));
  assert.equal(marketFor({ seed: 1, battle: 1, roster: everything, purse: 99 }).filter((offer) => offer.kind === "unit").length,
    SHELF_UNITS, "a warband holding one of each is offered nothing");
});

test("a whole run plays through and reports what it cost", () => {
  const mission = CIRCUIT_CLASH;
  let run = startRun({ detachmentId: "voidbreaker", seed: 11 });
  let guard = 0;
  while (run.status === "active" && guard < 10) {
    guard += 1;
    const engagement = engagementFor(run);
    const fielded = fieldableFrom(run).slice(0, engagement.mission.playerDeployment.length);
    const deployment = Object.fromEntries(engagement.mission.playerDeployment.map((slot, index) => [
      slot.id, fielded[index] ? { formationId: fielded[index].formationId, wounds: fielded[index].wounds ?? undefined } : {},
    ]));
    const foe = buildEnemyForce(engagement.mission, engagement.army);
    const built = buildPlayerForce({ mission: engagement.mission, deployment, formations: FORMATIONS });
    const result = resolveBattle({
      playerUnits: built.units, enemyUnits: foe.units, objectives: engagement.mission.objectives,
      playerOrders: built.orders, enemyOrders: foe.orders, enemyPaths: foe.paths,
      enemyHand: engagement.enemyHand, rounds: engagement.mission.rounds,
    });
    run = applyBattle({ run, result, deployedIds: fielded.map((entry) => entry.id), won: result.winner === "player" });
    if (run.status !== "active") break;
    run = advance(repair(run));
  }
  assert.ok(["complete", "broken"].includes(run.status), `the run never ended: ${run.status}`);
  const summary = runSummary(run);
  assert.equal(summary.fought, run.history.length);
  assert.ok(summary.won <= summary.fought, "won more battles than it fought");
  assert.equal(summary.winRate, summary.fought > 0 ? Number((summary.won / summary.fought).toFixed(4)) : 0);
  // Battles won and battles fought are different questions — reporting only the first
  // conflates surviving with winning.
  assert.ok(Object.hasOwn(summary, "fought") && Object.hasOwn(summary, "winRate"));
  // The purse at the very end always looks hoarded, because the last engagement's score
  // arrives with nothing left to buy. `unspent` is what was left at the last real shelf.
  assert.equal(summary.unspent, summary.purse - (run.history.at(-1)?.earned ?? 0));
  assert.ok(mission.rounds > 0);
});

test("a finished run stays finished", () => {
  const run = { ...startRun({ seed: 12 }), status: "complete" };
  assert.deepEqual(advance(run), run, "a finished run advanced to another battle");
  assert.deepEqual(advance({ ...run, status: "broken" }), { ...run, status: "broken" });
});

test("repair measures a hull against the wounds it actually has", () => {
  // Four refits move a hull's maximum. Repair read the base profile, so a SHIELD WALL
  // bastion healed to its factory 12, was marked full, and then fought at 16 — four free
  // wounds for anyone who bought armour. It matters now that refits cost 2.
  const base = startRun({ seed: 12 });
  const factory = battleProfileFor("bastion").wounds;
  const full = profileWithRefit("bastion", "bastion:wall").wounds;
  assert.ok(full > factory, "the refit does not reinforce the hull");
  // Sitting one wound below the FACTORY maximum is where the two readings disagree:
  // repair carries it past that line, and only a fullStrength that knows about the refit
  // keeps it carrying damage instead of rounding it up to "as it came out of the yard".
  const bastion = { formationId: "bastion", name: "SHIELD WALKER", wounds: factory - 1, refit: "bastion:wall" };
  // Given enough supply to carry it past the FACTORY ceiling but not to the refitted one.
  const run = { ...base, supply: 3, roster: [bastion, ...base.roster.slice(1)] };
  const healed = repair(run).roster[0];
  assert.equal(healed.wounds, Math.min(factory - 1 + repairAmountFor(run), full));
  assert.notEqual(healed.wounds, null, "the reinforced hull was marked full at its factory maximum");
  // And repaired to the refitted maximum it does stop carrying damage.
  const topped = repair({ ...run, roster: [{ ...bastion, wounds: full - 1 }] }).roster[0];
  assert.equal(topped.wounds, null);
});

test("the enemy is built, not fielded from a list", () => {
  // It used to be `units.slice(0, enemyCount)` off a fixed five, so every run of every seed
  // faced the identical five configurations in the identical order, both of them declaring
  // DOMINION forever. Picking five of nine against a constant is not a counter-pick, it is
  // a lookup.
  const sequences = [1, 7, 42].map((seed) => {
    const run = startRun({ seed });
    return [1, 2, 3, 4, 5].map((battle) => {
      const engagement = engagementFor({ ...run, battle });
      return `${engagement.army.disposition}/${engagement.army.plan}:${engagement.army.units.map((unit) => unit.formationId).sort().join(",")}`;
    }).join(" | ");
  });
  assert.equal(new Set(sequences).size, sequences.length, "every seed faces the same enemies in the same order");
  // And what it DECLARES varies, not only which hulls turned up. Both authored armies
  // declared DOMINION on both boards in every run, so the player had three victory
  // conditions and never once met an opponent using a different one.
  const declared = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
    const drawn = startRun({ seed });
    for (const battle of [1, 2, 3, 4, 5]) declared.add(engagementFor({ ...drawn, battle }).army.disposition);
  }
  assert.ok(declared.size > 1, `the enemy only ever declares ${[...declared].join(", ")}`);
  for (const disposition of declared) {
    assert.ok(Object.values(DETACHMENTS).some((entry) => entry.dispositions.includes(disposition)),
      `the enemy declared ${disposition}, which no detachment allows`);
  }
  // Within one run the engagements differ from each other too.
  const run = startRun({ seed: 3 });
  const within = [1, 2, 3, 4, 5].map((battle) => {
    const engagement = engagementFor({ ...run, battle });
    return engagement.army.units.map((unit) => unit.formationId).sort().join(",");
  });
  assert.ok(new Set(within).size > 1, "a run fights the same army five times");
  // And every engagement is a full deployment, built for whatever it declared.
  for (const battle of [1, 2, 3, 4, 5]) {
    const engagement = engagementFor({ ...run, battle });
    assert.equal(engagement.army.units.length, engagement.mission.enemyDeployment.length);
    assert.equal(new Set(engagement.army.units.map((unit) => unit.formationId)).size, engagement.army.units.length,
      "the enemy fielded the same hull twice");
    assert.ok(plansFor(engagement.army.disposition).some((plan) => plan.id === engagement.army.plan),
      `the enemy declared ${engagement.army.disposition} and walked ${engagement.army.plan}`);
  }
});

test("the control enemy never varies, because it is the measuring instrument", () => {
  // Every axis of the balance sweep that makes a claim about the PLAYER'S choices is judged
  // against this. If it drifted with the seed, nothing measured against it could be
  // attributed to anything.
  const control = (seed) => [1, 2, 3, 4, 5].map((battle) => {
    const engagement = engagementFor({ ...startRun({ seed, enemyPolicy: "control" }), battle });
    return `${engagement.army.disposition}/${engagement.army.plan}:${engagement.army.units.map((unit) => unit.formationId).join(",")}`;
  }).join(" | ");
  assert.equal(control(1), control(9), "the control enemy changed with the seed");
  assert.equal(control(1), control(404));
  // And it is the doctrine's own declaration, not a drawn one.
  const engagement = engagementFor({ ...startRun({ seed: 5, enemyPolicy: "control" }), battle: 1 });
  const doctrine = armyFor(engagement.mission.id);
  assert.equal(engagement.army.disposition, doctrine.disposition);
  assert.equal(engagement.army.plan, doctrine.plan);
  // A varied run genuinely differs from it somewhere across its five engagements.
  const varied = [1, 2, 3, 4, 5].map((battle) => {
    const drawn = engagementFor({ ...startRun({ seed: 5 }), battle });
    return `${drawn.army.disposition}/${drawn.army.plan}`;
  });
  assert.ok(varied.some((entry) => entry !== `${doctrine.disposition}/${doctrine.plan}`), "the varied enemy never varied");
});

test("a warband may hold two of a hull, and no more", () => {
  // Duplicates are what opened list-building up without a single new formation being
  // authored — nine hulls choose five is 126 lists, with repeats it is 1287. Unrestricted
  // it opened straight onto a degenerate answer: three RECON TANKS and two RECOVERY
  // VEHICLES won 100% of its deployments, and ninety-five lists won from every single one.
  const base = startRun({ seed: 12 });
  const hull = base.roster[0].formationId;
  const stocked = (roster) => ({ ...base, purse: 40, roster, shelf: [hull, hull, hull] });

  const one = stocked(base.roster);
  assert.ok(offersFor(one).some((offer) => offer.kind === "unit" && offer.id === hull),
    "a hull already in the warband is not for sale");
  const two = buy({ run: one, offerId: hull });
  assert.equal(copiesOf(two.roster, hull), 2);

  // A third is off the shelf entirely, and cannot be bought even by asking for it.
  const atLimit = stocked(two.roster);
  assert.equal(offersFor(atLimit).some((offer) => offer.kind === "unit" && offer.id === hull), false,
    "a warband at its limit was still offered another");
  assert.deepEqual(buy({ run: atLimit, offerId: hull }), atLimit);
  assert.equal(MAX_COPIES, 2);
});

test("two of the same hull are two formations, not one counted twice", () => {
  const base = startRun({ seed: 13 });
  const hull = base.roster[0].formationId;
  const twinned = {
    ...base,
    roster: [...base.roster, { ...base.roster[0], id: `${hull}#twin`, wounds: null }],
  };
  const [first, second] = twinned.roster.filter((entry) => entry.formationId === hull);
  assert.notEqual(first.id, second.id, "two hulls of the same kind share an id");

  // One is deployed and wrecked; the other is on the bench and untouched.
  const after = applyBattle({
    run: twinned,
    result: battleEndingWith({ [first.id]: 0 }),
    deployedIds: [first.id],
    won: true,
  });
  assert.equal(copiesOf(after.roster, hull), 1, "losing one hull struck off every hull of that kind");
  assert.equal(after.roster.some((entry) => entry.id === second.id), true, "the one on the bench was struck off too");

  // And damage lands on the one that took it.
  const hurt = applyBattle({
    run: twinned,
    result: battleEndingWith({ [first.id]: 3 }),
    deployedIds: [first.id],
    won: true,
  });
  assert.equal(hurt.roster.find((entry) => entry.id === first.id).wounds, 3);
  assert.equal(hurt.roster.find((entry) => entry.id === second.id).wounds, null,
    "the benched hull carried the other one's damage");
});

test("deploying two of a hull puts two formations on the board", () => {
  // The whole of what makes them two railjacks rather than one counted twice. A unit's id
  // used to BE its formation id, so two of the same hull shared an order, walked one route
  // and had every wound land on whichever the lookup found first.
  const mission = CIRCUIT_CLASH;
  const twins = [
    { id: "railjack#a", formationId: "railjack", name: "TANK I", wounds: null, refit: null },
    { id: "railjack#b", formationId: "railjack", name: "TANK II", wounds: 4, refit: null },
  ];
  const deployment = {
    [mission.playerDeployment[0].id]: { ...twins[0], objectiveId: "west-works" },
    [mission.playerDeployment[1].id]: { ...twins[1], objectiveId: "east-gantry" },
  };
  const built = buildPlayerForce({ mission, deployment, formations: FORMATIONS });
  assert.equal(built.units.length, 2, "two of the same hull deployed as one unit");
  assert.equal(new Set(built.units.map((unit) => unit.id)).size, 2, "both units share an id");
  for (const unit of built.units) assert.equal(unit.formationId, "railjack", "the formation was lost");
  // Two ids, two orders, and the damage one is carrying does not touch the other.
  assert.equal(Object.keys(built.orders).length, 2, "two of the same hull shared one order");
  assert.notEqual(built.orders[built.units[0].id], built.orders[built.units[1].id]);
  const whole = built.units.find((unit) => unit.id === "railjack#a");
  const battered = built.units.find((unit) => unit.id === "railjack#b");
  assert.equal(whole.wounds, whole.maxWounds);
  assert.equal(battered.wounds, 4, "the damaged one came to the field whole");
  assert.equal(whole.maxWounds, battered.maxWounds);

  // And they resolve as two: a battle between them and one enemy logs both of them acting.
  const result = resolveBattle({
    playerUnits: built.units,
    enemyUnits: [{ ...deployUnit({ formationId: "bastion", name: "WALL", position: { x: 50, y: 5 } }), id: "enemy-wall" }],
    objectives: mission.objectives, playerOrders: built.orders, enemyOrders: {}, missionId: mission.id,
  });
  const moved = result.rounds.at(-1).players;
  assert.equal(moved.length, 2);
  assert.notDeepEqual(
    { x: moved[0].x, y: moved[0].y },
    { x: moved[1].x, y: moved[1].y },
    "two of the same hull ended the battle standing on the same spot",
  );
});

test("a formation is named for what it did", () => {
  // A warband grew from six hulls to ten across a run and stayed anonymous. An honour is
  // read off the battle rather than declared, so none of them can be awarded for something
  // that did not happen — and each is awarded once, because a title you can collect four
  // times is a counter and not a name.
  const base = startRun({ seed: 12 });
  const entry = base.roster[0];
  const other = base.roster[1];
  const maxWounds = battleProfileFor(entry.formationId).wounds;
  // The weaker shot is fired FIRST, so "the hammer" cannot be satisfied by whoever appears
  // at the top of the log.
  const battleWith = (wounds, actor) => ({
    playerScore: 5,
    enemyScore: 1,
    rounds: [{
      players: [{ id: entry.id, wounds, maxWounds }, { id: other.id, wounds: 4, maxWounds: 8 }],
      log: [
        { side: "player", phase: "shoot", actor: actor === entry.name ? other.name : entry.name, target: "THEM", amount: 3 },
        { side: "player", phase: "shoot", actor, target: "THEM", amount: 9 },
        { side: "enemy", phase: "shoot", actor: "THEIRS", target: "OURS", amount: 40 },
      ],
    }],
  });
  const deployedIds = [entry.id, other.id];

  const untouched = applyBattle({ run: base, result: battleWith(maxWounds, other.name), deployedIds, won: true, disposition: "dominion" });
  assert.deepEqual(untouched.roster[0].honours.map((honour) => honour.id), ["unbroken"]);
  assert.equal(untouched.roster[0].battles, 1);
  // The hammer is the one that actually dealt the most, and it is the other formation here.
  assert.ok(untouched.roster[1].honours.some((honour) => honour.id === "hammer"));

  const mauled = applyBattle({ run: base, result: battleWith(1, entry.name), deployedIds, won: true, disposition: "dominion" });
  assert.deepEqual(mauled.roster[0].honours.map((honour) => honour.id).sort(), ["hammer", "scarred"]);

  // Never twice. Three engagements in and it is a VETERAN, and still only one SCARRED.
  let run = base;
  for (let battle = 0; battle < 3; battle += 1) {
    run = applyBattle({ run, result: battleWith(1, entry.name), deployedIds, won: true, disposition: "dominion" });
    run = { ...run, battle: run.battle + 1, status: "active" };
  }
  const ids = run.roster[0].honours.map((honour) => honour.id);
  assert.equal(run.roster[0].battles, 3);
  assert.equal(ids.filter((id) => id === "scarred").length, 1, "an honour was awarded twice");
  assert.ok(ids.includes("veteran"), "three engagements did not make a veteran");
  // And every honour it holds is one the game can name.
  for (const honour of run.roster[0].honours) assert.ok(HONOURS[honour.id], `${honour.id} is not an honour`);
});
