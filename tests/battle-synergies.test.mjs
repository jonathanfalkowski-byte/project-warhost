import test from "node:test";
import assert from "node:assert/strict";

import {
  PACKED_DAMAGE_STEP,
  SYNERGIES,
  SYNERGY_COUNT,
  SYNERGY_RANGE,
  activeSynergies,
  leadsFor,
  mechanicsOf,
  packedScaleFor,
  synergiesFor,
  synergyBonusFor,
  synergyFor,
  synergyList,
} from "../src/battle/synergies.js";
import { BATTLE_PROFILES, battleProfileFor } from "../src/battle/battleProfiles.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { headlineFor, pairingLinksFor, supportLinksFor } from "../src/battle/afterAction.js";
import { CIRCUIT_CLASH, armyFor, buildEnemyForce, buildPlayerForce, missionList } from "../src/battle/battleMission.js";
import { fitFor } from "../src/battle/enemyArmy.js";
import { applyBattle, startRun } from "../src/battle/campaign.js";
import { FORMATIONS } from "../src/formationData.js";

const objectives = CIRCUIT_CLASH.objectives;
const enemy = buildEnemyForce();
const PLAN = {
  p1: { formationId: "railjack", objectiveId: "south-relay" },
  p2: { formationId: "hauler", objectiveId: "reactor" },
  p3: { formationId: "bastion", objectiveId: "reactor" },
  p4: { formationId: "command", objectiveId: "reactor" },
  p5: { formationId: "skimmer", objectiveId: "east-gantry" },
};
const battle = (over = {}) => {
  const player = buildPlayerForce({ deployment: PLAN, formations: FORMATIONS });
  return resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders, ...over,
  });
};
const at = (formationId, x, y, refit) => deployUnit({
  formationId, name: formationId.toUpperCase(), position: { x, y }, refit,
});

test("every pairing is two keywords the profiles actually have, and does something", () => {
  const keywords = new Set(Object.values(BATTLE_PROFILES).flatMap((profile) => profile.keywords));
  const names = new Set();
  for (const synergy of synergyList()) {
    assert.equal(synergy.pair.length, 2, `${synergy.id} is not a pair`);
    for (const keyword of synergy.pair) {
      assert.ok(keywords.has(keyword), `${synergy.id} pairs on ${keyword}, which no formation has`);
    }
    assert.ok(Object.keys(synergy.effect).length > 0, `${synergy.id} does nothing`);
    assert.ok(synergy.reveal.length > 10, `${synergy.id} does not say what it does`);
    assert.equal(names.has(synergy.name), false, `two pairings are both called ${synergy.name}`);
    names.add(synergy.name);
  }
  assert.equal(synergyList().length, SYNERGY_COUNT);
  assert.equal(synergyFor("not-a-pairing"), null);
});

test("a pairing needs both hulls standing, and standing close", () => {
  const bastion = at("bastion", 50, 50);
  const railjack = at("railjack", 50, 50 + SYNERGY_RANGE - 1);
  assert.deepEqual(synergiesFor(bastion, [railjack]), ["locked-shields"]);
  // One step further apart and it is not a pairing. SHIELD still soaks at its own range —
  // this is a tighter thing than support, deliberately.
  const away = at("railjack", 50, 50 + SYNERGY_RANGE + 1);
  assert.deepEqual(synergiesFor(bastion, [away]), []);
  // A wreck neither grants nor receives.
  assert.deepEqual(synergiesFor(bastion, [{ ...railjack, wounds: 0 }]), []);
  assert.deepEqual(synergiesFor({ ...bastion, wounds: 0 }, [railjack]), []);
  // And a formation is never paired with itself — which only bites on a pairing of a
  // keyword with itself, where a hull would otherwise satisfy both halves alone.
  const skimmer = at("skimmer", 50, 50);
  assert.deepEqual(synergiesFor(skimmer, [skimmer]), [], "a hull formed WOLF PAIR with itself");
  assert.deepEqual(synergiesFor(bastion, [bastion]), []);
  assert.deepEqual(activeSynergies([skimmer]), []);
});

test("a pairing is keyed on keywords, so a refit can create one", () => {
  // The point of keying on keywords rather than on formation ids: the refit market is the
  // discovery engine. A FLAME SUPPORT VEHICLE has no SHIELD and cannot anchor on anything.
  // Bought an ASH CRUCIBLE, it can.
  const carriage = at("carriage", 50, 50);
  const bare = at("furnace", 50, 54);
  const refitted = at("furnace", 50, 54, "furnace:crucible");
  assert.deepEqual(synergiesFor(bare, [carriage]), []);
  assert.deepEqual(synergiesFor(refitted, [carriage]), ["locked-shields"]);
});

test("standing close costs, per neighbour, paired or not", () => {
  // A flat toll on being paired taxed a deliberate two-hull pairing exactly as hard as a
  // five-hull knot, and made the whole layer a net negative. It is charged per neighbour,
  // and it lands on anyone standing shoulder to shoulder — otherwise massing without a
  // pairing is free and the cost reads as a punishment for synergy.
  const alone = at("breaker", 50, 50);
  assert.equal(packedScaleFor(alone, []), 1);
  const one = [at("skimmer", 50, 54)];
  const three = [...one, at("hauler", 51, 53), at("command", 49, 52)];
  assert.equal(packedScaleFor(alone, one).toFixed(4), (1 + PACKED_DAMAGE_STEP).toFixed(4));
  assert.equal(packedScaleFor(alone, three).toFixed(4), (1 + 3 * PACKED_DAMAGE_STEP).toFixed(4));
  assert.ok(packedScaleFor(alone, three) > packedScaleFor(alone, one), "a knot costs no more than a pair");
  // None of these formations form a pairing with the breaker, and it is charged anyway.
  assert.deepEqual(synergiesFor(alone, [at("hauler", 51, 53)]), []);
  assert.ok(packedScaleFor(alone, [at("hauler", 51, 53)]) > 1);
  // A wreck is not a neighbour, and neither is something across the board.
  assert.equal(packedScaleFor(alone, [{ ...one[0], wounds: 0 }]), 1);
  assert.equal(packedScaleFor(alone, [at("skimmer", 50, 90)]), 1);
});

test("the bonuses compound and an unpaired formation comes back untouched", () => {
  const untouched = synergyBonusFor(at("breaker", 50, 50), []);
  assert.deepEqual(untouched, { damageScale: 1, meleeScale: 1, controlScale: 1, soak: 0, repairBonus: 0 });
  // Two pairings on one hull multiply, the way two stratagems do.
  const skimmer = at("skimmer", 50, 50);           // FAST, SCOUT
  const harpoon = at("harpoon", 50, 53);           // FAST, OBJECTIVE
  const doubled = synergyBonusFor(harpoon, [skimmer, at("hauler", 51, 52)]);
  assert.deepEqual(synergiesFor(harpoon, [skimmer, at("hauler", 51, 52)]).sort(), ["dug-in", "wolf-pair"]);
  assert.equal(doubled.damageScale, SYNERGIES["wolf-pair"].effect.damageScale);
  assert.equal(doubled.controlScale, SYNERGIES["dug-in"].effect.controlScale);
});

test("both armies get pairings, because it is a rule of the board", () => {
  const result = battle();
  const anyPlayer = result.rounds.some((round) => round.synergies.player.length > 0);
  assert.ok(anyPlayer, "the player never formed one in a battle built to form one");
  // The enemy's are computed exactly the same way. Proven on a constructed force rather
  // than on an authored one: neither authored Helioch army ever actually forms a pairing,
  // because its five formations are ordered to five different places. That is a real
  // asymmetry and it is recorded in AGENTS.md — what must not be true is that the RULE only
  // applies to one side.
  const pairedEnemy = resolveBattle({
    playerUnits: [at("skimmer", 50, 90)],
    enemyUnits: [
      { ...at("bastion", 50, 12), id: "enemy-bastion" },
      { ...at("railjack", 50, 15), id: "enemy-railjack" },
    ],
    objectives, playerOrders: {}, enemyOrders: {},
  });
  const anyEnemy = pairedEnemy.rounds.some((round) => round.synergies.enemy.length > 0);
  assert.ok(anyEnemy, "the enemy side never forms a pairing even standing together");
  assert.equal(pairedEnemy.rounds[0].synergies.enemy[0].name, "LOCKED SHIELDS");
  // And the player's list on that battle stays empty, so the two sides are read separately.
  assert.deepEqual(pairedEnemy.rounds[0].synergies.player, []);
  // Reported as pairs, so a line can be drawn between exactly those two hulls.
  const found = result.rounds.flatMap((round) => round.synergies.player)[0];
  assert.ok(found.holder && found.partner && found.holder !== found.partner);
  assert.equal(synergyFor(found.id).name, found.name);
});

test("a same-keyword pairing is reported once, not once from each end", () => {
  const skimmer = at("skimmer", 50, 50);
  const harpoon = at("harpoon", 50, 53);
  const wolves = activeSynergies([skimmer, harpoon]).filter((entry) => entry.id === "wolf-pair");
  assert.equal(wolves.length, 1, "WOLF PAIR was reported from both ends");
  // Both hulls still GET it — only the reporting is deduplicated.
  assert.deepEqual(synergiesFor(skimmer, [harpoon]), ["wolf-pair"]);
  assert.deepEqual(synergiesFor(harpoon, [skimmer]), ["wolf-pair"]);
});

test("the layer can be switched off, and off is the battle without it", () => {
  // This is how the sweep measures what the layer is worth: the same battle twice, rather
  // than two different battles. It has to be a real off.
  const off = battle({ pairings: false });
  assert.deepEqual(off.synergies, []);
  for (const round of off.rounds) {
    assert.deepEqual(round.synergies, { player: [], enemy: [] });
  }
  const on = battle();
  assert.notDeepEqual(on.rounds.map((round) => round.players.map((unit) => unit.wounds)),
    off.rounds.map((round) => round.players.map((unit) => unit.wounds)),
    "turning the pairing layer off changed nothing on the board");

  // Off means the packing cost too, not only the bonuses. The same shot at the same hull
  // has to land for the same amount whether or not it is standing in a crowd.
  // The crowd stands BEHIND the target, so the enemy still shoots the same hull either
  // way — the only thing that changes is how many friends are standing next to it.
  const shotAt = (friends, pairings) => resolveBattle({
    playerUnits: [at("railjack", 50, 70), ...friends],
    enemyUnits: [{ ...at("carriage", 50, 40), id: "enemy-carriage" }],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {}, pairings,
  }).rounds[0].log.find((entry) => entry.side === "enemy" && entry.target === "RAILJACK").amount;
  const crowd = [at("breaker", 51, 74), at("skimmer", 49, 75)];
  assert.equal(shotAt(crowd, false), shotAt([], false), "crowding still cost something with the layer off");
  assert.ok(shotAt(crowd, true) > shotAt([], true), "crowding cost nothing with the layer on");
});

test("the round record carries what the screen has to derive from it", () => {
  // supportLinksFor reads keywords, and the round record did not store them — so the
  // SHIELD and COMMAND links drew nothing at all in the app while their own test passed,
  // because the test handed the function keyworded units and the screen hands it this.
  const result = battle();
  const round = result.rounds[2];
  assert.ok(round.players.every((unit) => Array.isArray(unit.keywords)), "the round dropped keywords");
  assert.ok(supportLinksFor({ players: round.players }).length > 0, "no support is drawable from the record");
  const links = pairingLinksFor({ round });
  assert.deepEqual(links.map((link) => link.kind), round.synergies.player.map(() => "pairing"));
  for (const link of links) {
    assert.ok(round.players.some((unit) => unit.name === link.from), `${link.from} is not on the board`);
    assert.ok(round.players.some((unit) => unit.name === link.to), `${link.to} is not on the board`);
  }
  assert.deepEqual(pairingLinksFor({}), []);
});

test("a pairing announces itself once, and outranks a casualty when it does", () => {
  const round = (over) => ({ players: [], enemies: [], spends: [], log: [], synergies: { player: [], enemy: [] }, ...over });
  const found = { id: "wolf-pair", name: "WOLF PAIR", holder: "A", partner: "B", reveal: "Two fast hulls." };
  const fresh = round({ synergies: { player: [found], enemy: [] }, players: [{ id: "x", name: "AXE", wounds: 0 }] });
  assert.equal(headlineFor({ round: fresh }).tone, "found");
  assert.match(headlineFor({ round: fresh }).text, /PAIRING FOUND — WOLF PAIR/);
  assert.match(headlineFor({ round: fresh }).text, /A standing with B/);
  // Already known: the casualty is the news again.
  assert.match(headlineFor({ round: fresh, known: ["wolf-pair"] }).text, /You lost AXE/);
});

test("the run writes down what it saw, once, and keeps it", () => {
  const run = startRun({ seed: 4 });
  assert.deepEqual(run.discovered, []);
  const result = battle();
  const deployedIds = ["railjack", "hauler", "bastion", "command", "skimmer"];
  const after = applyBattle({ run, result, deployedIds, won: true });
  assert.ok(after.discovered.length > 0, "a battle full of pairings taught the run nothing");
  for (const entry of after.discovered) {
    assert.ok(synergyFor(entry.id), `${entry.id} is not a pairing`);
    assert.equal(entry.battle, run.battle, "the engagement it was found in was not recorded");
    assert.ok(entry.holder && entry.partner && entry.reveal);
  }
  // Seeing it again does not write it down twice, and nothing already known is lost.
  const twice = applyBattle({ run: after, result, deployedIds, won: true });
  assert.deepEqual(twice.discovered.map((entry) => entry.id), after.discovered.map((entry) => entry.id));
  assert.equal(new Set(twice.discovered.map((entry) => entry.id)).size, twice.discovered.length);
  // And there are never more of them than there are pairings to find.
  assert.ok(twice.discovered.length <= SYNERGY_COUNT);
});

test("the enemy forms pairings now that it is built rather than authored", () => {
  // Neither authored Helioch army ever formed one: five formations ordered to five
  // different places, and the only pairing their keywords could make was between hulls on
  // opposite sides of the board. A list built to walk a plan masses the way a plan masses.
  const found = new Set();
  for (const mission of missionList()) {
    for (const seed of [0, 1, 2, 3]) {
      const foe = buildEnemyForce(mission, armyFor(mission.id), { seed });
      const built = buildPlayerForce({
        mission,
        deployment: Object.fromEntries(mission.playerDeployment.map((slot, index) => [
          slot.id, { formationId: ["railjack", "hauler", "bastion", "command", "skimmer"][index] },
        ])),
        formations: FORMATIONS,
      });
      const result = resolveBattle({
        playerUnits: built.units, enemyUnits: foe.units, objectives: mission.objectives,
        playerOrders: built.orders, enemyOrders: foe.orders, playerPaths: built.paths, enemyPaths: foe.paths,
        enemyDisposition: foe.disposition,
      });
      for (const round of result.rounds) for (const entry of round.synergies.enemy) found.add(entry.id);
    }
  }
  assert.ok(found.size > 0, "the enemy still never forms a pairing on any board or seed");
});

test("both armies get a repair phase, and patching is not damage dealt", () => {
  // The repair loop ran for the player only, so a whole rule applied to one side of the
  // table — and every patch was counted into the log that ERADICATION is scored off, so an
  // army earned victory points for healing itself. Melee had the matching bug from the
  // other direction: the enemy's half of a simultaneous exchange was written down as the
  // player's, so an eradicating enemy was never paid for anything it did in close combat.
  const mission = CIRCUIT_CLASH;
  const at2 = (formationId, x, y, id) => ({ ...deployUnit({ formationId, name: `${id}-${formationId}`.toUpperCase(), position: { x, y } }), id: `${id}-${formationId}` });
  const result = resolveBattle({
    playerUnits: [at2("breaker", 50, 52, "p"), at2("hauler", 50, 58, "p")],
    enemyUnits: [at2("breaker", 50, 48, "e"), at2("hauler", 50, 42, "e")],
    objectives: mission.objectives, playerOrders: {}, enemyOrders: {},
  });
  const total = (side, phase) => result.rounds.flatMap((round) => round.log)
    .filter((entry) => entry.side === side && entry.phase === phase)
    .reduce((sum, entry) => sum + entry.amount, 0);
  assert.ok(total("enemy", "repair") > 0, "only the player's army repairs itself");
  assert.ok(total("player", "repair") > 0);
  assert.ok(total("enemy", "fight") > 0, "the enemy's half of a melee exchange is never logged");
  assert.ok(total("player", "fight") > 0);
  // Near enough symmetric: identical armies, mirrored positions, no disposition rules.
  const last = result.rounds.at(-1);
  const hurt = (units) => units.reduce((sum, unit) => sum + (unit.maxWounds - Math.max(0, unit.wounds)), 0);
  assert.ok(Math.abs(hurt(last.players) - hurt(last.enemies)) < 1,
    `a mirrored fight came out ${hurt(last.players).toFixed(1)} against ${hurt(last.enemies).toFixed(1)}`);
});

test("the enemy builds for the walk and for the scoreboard it declared", () => {
  // Two things the fit function has to know, both of which it got wrong first time and
  // both of which cost the enemy about two thirds of its damage output.
  const far = { slotIndex: 0, walk: 60, needsMove: 15, holds: 1, contested: false };
  const near = { slotIndex: 0, walk: 12, needsMove: 2, holds: 1, contested: false };
  // A hull that cannot finish the walk scores below ANY hull that can, whatever else it is.
  const slow = battleProfileFor("railjack");   // move 8, the best holder in the game
  const quick = battleProfileFor("skimmer");   // move 22, and not much else
  assert.ok(slow.move < far.needsMove && quick.move > far.needsMove, "the fixture no longer separates them");
  assert.ok(fitFor(quick, far) > fitFor(slow, far), "a formation still walking at the last round was fielded anyway");
  // On a walk both can finish, the holder wins it back.
  assert.ok(fitFor(slow, near) > fitFor(quick, near), "the fit ignores what a hull is for");
  // And SPARE speed counts, not just enough speed: arriving on round two fires four times.
  assert.ok(fitFor(quick, near) > fitFor(quick, far), "arriving late is worth as much as arriving early");

  // Under a disposition that scores no ground, control is worth nothing and guns are worth
  // everything. Building for ground under ERADICATION is what filled its lists with slow
  // brawlers that never arrived.
  const holder = battleProfileFor("command");  // control 4, two shots
  const gun = battleProfileFor("furnace");     // control 2, four shots
  const site = { slotIndex: 2, walk: 30, needsMove: 5, holds: 2, contested: true };
  assert.ok(fitFor(holder, site) > fitFor(gun, site), "control is not worth more where ground pays");
  assert.ok(fitFor(gun, site, { scoresGround: false }) > fitFor(holder, site, { scoresGround: false }),
    "the enemy still buys control under a disposition that scores none of it");
});

test("healing your own army is not damage dealt to theirs", () => {
  // ERADICATION is scored off the round log, and the repair phase writes into it. A support
  // formation patching a friend for 1 was earning its army a victory point every four
  // patches — and the player was the only side with a repair phase at the time, so the
  // entire inflation landed on one army.
  const mission = CIRCUIT_CLASH;
  const hurt = (formationId, x, y, id, wounds) => ({
    ...deployUnit({ formationId, name: `${id}`.toUpperCase(), position: { x, y }, wounds }), id,
  });
  const quiet = resolveBattle({
    // A medic and a damaged friend, alone on their half, nothing in range of anything.
    playerUnits: [hurt("hauler", 50, 95, "medic"), hurt("railjack", 50, 92, "patient", 3)],
    enemyUnits: [hurt("bastion", 50, 5, "enemy-bastion")],
    objectives: mission.objectives, playerOrders: {}, enemyOrders: {},
    playerDisposition: "eradication", enemyDisposition: "eradication",
  });
  const repairs = quiet.rounds.flatMap((round) => round.log).filter((entry) => entry.phase === "repair");
  assert.ok(repairs.length > 0, "nothing was repaired, so the test proves nothing");
  assert.equal(quiet.playerScore, 0, "an army was paid for healing itself");
});

test("every pairing is a lead from the first muster, and only the effect is hidden", () => {
  // Six blank lines and a count is not a secret, it is a wall: nothing to hunt for and no
  // way to remember what had been found. The name and the two keywords are shown from the
  // start so the market has something to aim at; what it DOES is the part you find out by
  // standing them together.
  const cold = leadsFor([]);
  assert.equal(cold.length, SYNERGY_COUNT, "not every pairing is listed");
  for (const lead of cold) {
    assert.equal(lead.found, false);
    assert.ok(lead.name && lead.pair.length === 2, `${lead.id} is not a usable lead`);
    assert.equal(lead.effect, undefined, "an unfound pairing gives away its effect");
    assert.equal(lead.reveal, undefined, "an unfound pairing gives away its reveal");
  }
  // Found ones are marked, and nothing else changes about the list.
  const warm = leadsFor([{ id: "wolf-pair" }]);
  assert.deepEqual(warm.filter((lead) => lead.found).map((lead) => lead.id), ["wolf-pair"]);
  assert.deepEqual(warm.map((lead) => lead.id), cold.map((lead) => lead.id), "finding one reordered the list");
  // Ids are accepted as bare strings too, so a caller cannot get this subtly wrong.
  assert.deepEqual(leadsFor(["wolf-pair"]).filter((lead) => lead.found).map((lead) => lead.id), ["wolf-pair"]);
  assert.deepEqual(leadsFor().filter((lead) => lead.found), []);
});

test("what a pairing does is read off the effect, not written beside it", () => {
  // The notes recorded a flavour line and nothing else — "the screen anchors on the heavy
  // hull" says a pairing happened and not one thing about what it was worth. Written by
  // hand the sentence would be a second copy of every number in the file, and ERADICATION's
  // scoring line already showed how that ends: it read "1 VP per 4 wounds" for as long as
  // the rule paid 1 in 3.
  for (const synergy of synergyList()) {
    const mechanics = mechanicsOf(synergy);
    assert.ok(mechanics.length > 5, `${synergy.id} does not say what it does`);
    for (const value of Object.values(synergy.effect)) {
      if (typeof value !== "number") continue;
      // Every number in the effect appears in the sentence, one way or another.
      const shown = mechanics.includes(String(value))
        || mechanics.includes(String(Math.round(value * 100)))
        || mechanics.includes(String(1 + value));
      assert.ok(shown, `${synergy.id} hides ${value} from its own description: "${mechanics}"`);
    }
  }
  // And it tracks the effect rather than a copy of it.
  assert.match(mechanicsOf({ effect: { damageScale: 9.5 } }), /9\.5/);
  assert.match(mechanicsOf({ effect: { repairBonus: 3 } }), /4 instead of 1/);
  assert.equal(mechanicsOf({ effect: {} }), "");
  assert.equal(mechanicsOf(null), "");
});

test("the run writes down what it does and where it happened", () => {
  const run = startRun({ seed: 4 });
  const result = battle();
  const after = applyBattle({
    run, result, won: true,
    deployedIds: ["railjack", "hauler", "bastion", "command", "skimmer"],
  });
  assert.ok(after.discovered.length > 0, "nothing was found in a battle built to find something");
  for (const entry of after.discovered) {
    const synergy = synergyFor(entry.id);
    assert.deepEqual(entry.pair, synergy.pair, `${entry.id} recorded the wrong keywords`);
    assert.equal(entry.mechanics, mechanicsOf(synergy), `${entry.id} recorded stale mechanics`);
    assert.ok(entry.board, `${entry.id} does not say which board it was found on`);
    assert.ok(entry.holder && entry.partner && entry.battle);
  }
});
