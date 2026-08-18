import test from "node:test";
import assert from "node:assert/strict";

import { REFITS, REFIT_COST, applyRefit, profileWithRefit, refitFor, refitsFor } from "../src/battle/refits.js";
import { BATTLE_PROFILES, battleProfileFor } from "../src/battle/battleProfiles.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { headlineFor } from "../src/battle/afterAction.js";
import { FORMATIONS } from "../src/formationData.js";

const profileOf = (formationId) => ({ ...battleProfileFor(formationId), id: formationId });
const NUMBERS = ["move", "range", "shots", "hit", "wounds", "save", "melee", "control"];

test("every formation has two refits, and every refit belongs to a formation", () => {
  // The roster has carried two weapon options per formation since the beginning and never
  // used them for anything. This is where they finally do something.
  for (const formation of FORMATIONS) {
    assert.equal(refitsFor(formation.id).length, 2, `${formation.id} does not have two refits`);
  }
  for (const refit of Object.values(REFITS)) {
    assert.ok(BATTLE_PROFILES[refit.formationId], `${refit.id} belongs to no formation`);
    assert.ok(refit.name && refit.text, `${refit.id} is not described`);
    assert.equal(refit.id.split(":")[0], refit.formationId, `${refit.id} is filed under the wrong formation`);
  }
  assert.equal(Object.keys(REFITS).length, FORMATIONS.length * 2);
  assert.equal(refitFor("not-a-refit"), null);
});

test("every refit is a trade, never a straight upgrade", () => {
  // A refit that only gives is not a decision, it is a tax on not buying it. Each one has
  // to cost the formation something it was good at.
  for (const refit of Object.values(REFITS)) {
    const before = profileOf(refit.formationId);
    const after = refit.apply(before);
    const better = NUMBERS.filter((key) => (key === "hit" ? after[key] < before[key] : after[key] > before[key]));
    const worse = NUMBERS.filter((key) => (key === "hit" ? after[key] > before[key] : after[key] < before[key]));
    const gained = after.keywords.filter((keyword) => !before.keywords.includes(keyword));
    const lost = before.keywords.filter((keyword) => !after.keywords.includes(keyword));
    assert.ok(better.length + gained.length > 0, `${refit.id} gives nothing`);
    assert.ok(worse.length + lost.length > 0, `${refit.id} costs nothing — it is a straight upgrade`);
  }
});

test("refits that grant a keyword make the existing rules fire somewhere new", () => {
  // This is the point of them. SHIELD soaks for neighbours, COMMAND makes them shoot
  // better, REPAIR patches one a round — none of it is a new rule, it is an existing rule
  // arriving on a hull that could not carry it before.
  const granting = Object.values(REFITS).filter((refit) => {
    const before = profileOf(refit.formationId);
    return refit.apply(before).keywords.some((keyword) => !before.keywords.includes(keyword));
  });
  assert.ok(granting.length >= 4, `only ${granting.length} refits grant a keyword`);
  const granted = new Set(granting.flatMap((refit) => {
    const before = profileOf(refit.formationId);
    return refit.apply(before).keywords.filter((keyword) => !before.keywords.includes(keyword));
  }));
  for (const keyword of ["SHIELD", "COMMAND", "REPAIR"]) {
    assert.ok(granted.has(keyword), `no refit grants ${keyword}, so that rule never reaches a new formation`);
  }
  // And at least one takes a keyword away, because losing one is a real trade.
  const losing = Object.values(REFITS).filter((refit) => {
    const before = profileOf(refit.formationId);
    return before.keywords.some((keyword) => !refit.apply(before).keywords.includes(keyword));
  });
  assert.ok(losing.length > 0, "no refit gives up a keyword");
});

test("a refit changes the formation on the board, not just on paper", () => {
  const plain = deployUnit({ formationId: "furnace", name: "F", position: { x: 50, y: 50 } });
  const screened = deployUnit({ formationId: "furnace", name: "F", position: { x: 50, y: 50 }, refit: "furnace:crucible" });
  assert.equal(plain.keywords.includes("SHIELD"), false);
  assert.equal(screened.keywords.includes("SHIELD"), true, "the refit did not reach the deployed unit");
  assert.equal(screened.refitName, "ASH CRUCIBLE");
  // maxWounds still comes from the profile the refit produced, so a refit that adds wounds
  // does not leave the unit reading as permanently damaged.
  const walled = deployUnit({ formationId: "bastion", name: "B", position: { x: 0, y: 0 }, refit: "bastion:wall" });
  assert.equal(walled.wounds, walled.maxWounds);
  assert.ok(walled.maxWounds > battleProfileFor("bastion").wounds);
  // A refit belonging to another formation is ignored rather than applied.
  const wrong = deployUnit({ formationId: "skimmer", name: "S", position: { x: 0, y: 0 }, refit: "bastion:wall" });
  assert.deepEqual(wrong.keywords, battleProfileFor("skimmer").keywords);
  assert.equal(applyRefit(profileOf("skimmer"), "bastion:wall").refit, undefined);
});

test("a granted SHIELD actually soaks for the formation beside it", () => {
  // The whole claim of a keyword refit is that it changes the battle, not the stat block.
  const fight = (refit) => {
    const guard = deployUnit({ formationId: "furnace", name: "GUARD", position: { x: 50, y: 52 }, refit });
    const target = deployUnit({ formationId: "skimmer", name: "TARGET", position: { x: 50, y: 50 } });
    const gun = deployUnit({ formationId: "carriage", name: "GUN", position: { x: 50, y: 20 } });
    return resolveBattle({
      playerUnits: [guard, target], enemyUnits: [gun], objectives: [], rounds: 2,
      playerOrders: {}, enemyOrders: {},
      playerPaths: { furnace: [{ x: 50, y: 52 }], skimmer: [{ x: 50, y: 50 }] },
      enemyPaths: { "enemy-carriage": [{ x: 50, y: 20 }] },
    }).rounds.at(-1).players;
  };
  const bare = fight(null);
  const screened = fight("furnace:crucible");
  const woundsOf = (units, name) => units.find((unit) => unit.name === name).wounds;
  assert.ok(woundsOf(screened, "TARGET") > woundsOf(bare, "TARGET"), "the granted SHIELD soaked nothing");
  assert.ok(woundsOf(screened, "GUARD") < woundsOf(bare, "GUARD"), "the shield took none of it itself");
});

test("a refit is priced, and one hull carries one", () => {
  assert.ok(REFIT_COST >= 1 && REFIT_COST <= 5);
  // Every refit costs the same, so the choice is which formation becomes what rather than
  // which refit is cheapest.
  assert.equal(new Set(Object.values(REFITS).map(() => REFIT_COST)).size, 1);
});

test("a battle with no refits resolves exactly as it did before they existed", () => {
  const build = (refit) => deployUnit({ formationId: "railjack", name: "R", position: { x: 50, y: 90 }, refit });
  const enemy = deployUnit({ formationId: "breaker", name: "E", position: { x: 50, y: 10 } });
  const withNull = resolveBattle({ playerUnits: [build(null)], enemyUnits: [enemy], objectives: [], rounds: 3, playerOrders: {}, enemyOrders: {} });
  const withUndefined = resolveBattle({ playerUnits: [build(undefined)], enemyUnits: [enemy], objectives: [], rounds: 3, playerOrders: {}, enemyOrders: {} });
  assert.deepEqual(withNull.rounds, withUndefined.rounds);
});

test("a round says the one thing worth saying about it", () => {
  // Five rounds of markers sliding in silence is confirmation, not suspense.
  const round = (over) => ({ players: [], enemies: [], spends: [], log: [], ...over });
  // The banner has to say WHOSE: red is the enemy's colour everywhere else on screen,
  // and both armies field formations drawn from the same roster.
  assert.match(headlineFor({ round: round({ players: [{ id: "a", name: "AXE", wounds: 0 }] }) }).text, /You lost AXE/);
  assert.equal(headlineFor({ round: round({ players: [{ id: "a", name: "AXE", wounds: 0 }] }) }).tone, "loss");
  // Something you lost outranks something you killed, which outranks a spend.
  const busy = round({
    players: [{ id: "a", name: "AXE", wounds: 0 }],
    enemies: [{ id: "b", name: "FOE", wounds: 0 }],
    spends: [{ side: "enemy", name: "BRACE" }],
  });
  assert.match(headlineFor({ round: busy }).text, /You lost AXE/);
  assert.match(headlineFor({ round: { ...busy, players: [] } }).text, /You wrecked FOE/);
  assert.match(headlineFor({ round: { ...busy, players: [], enemies: [] } }).text, /Helioch spends BRACE/);
  // A wreck is only news the round it happens.
  const stillDead = round({ players: [{ id: "a", name: "AXE", wounds: 0 }] });
  const previous = round({ players: [{ id: "a", name: "AXE", wounds: 0 }] });
  assert.equal(headlineFor({ round: stillDead, previous }).text.includes("You lost AXE"), false);
  // A formation patching a friend is not "putting damage into" it.
  const patched = headlineFor({ round: round({ log: [{ phase: "repair", side: "player", actor: "CRANE", target: "AXE", amount: 1 }] }) });
  assert.match(patched.text, /CRANE patches AXE/);
  // And a round with nothing in it says so rather than inventing something.
  assert.equal(headlineFor({ round: round({}) }).tone, "quiet");
  assert.equal(headlineFor({}), null);
});

test("the stat line a screen shows is the stat line that fights", () => {
  // The deploy screen used to read BATTLE_PROFILES directly, so a hull that had been
  // refitted printed its factory numbers beside the refit's name — "SHIELD WALL" next to
  // the wounds it no longer had. Everything that displays a formation resolves it the same
  // way the board does.
  const base = battleProfileFor("bastion");
  const walled = profileWithRefit("bastion", "bastion:wall");
  assert.equal(walled.wounds, base.wounds + 4);
  assert.equal(walled.move, base.move - 3);
  assert.equal(walled.refitName, "SHIELD WALL");
  // What the board resolves has to agree with what the screen printed.
  const deployed = deployUnit({ formationId: "bastion", name: "WALL", position: { x: 50, y: 90 }, refit: "bastion:wall" });
  for (const key of NUMBERS) assert.equal(deployed[key], walled[key], `${key} differs between the screen and the board`);
  // No refit, and nothing moves.
  assert.deepEqual(profileWithRefit("bastion"), { ...base, id: "bastion" });
  assert.deepEqual(profileWithRefit("bastion", null), { ...base, id: "bastion" });
  // A refit belonging to another hull is refused rather than half-applied.
  assert.deepEqual(profileWithRefit("bastion", "harpoon:winch"), { ...base, id: "bastion" });
});
