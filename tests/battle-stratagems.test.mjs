import test from "node:test";
import assert from "node:assert/strict";

import {
  DETACHMENTS,
  STRATAGEMS,
  TRIGGERS,
  affordable,
  drawEnemyHand,
  enemyPlaysAt,
  scoutedPool,
  stratagemFor,
} from "../src/battle/stratagems.js";
import { NO_EFFECTS, deployUnit, effectsOf, resolveBattle, threatOf } from "../src/battle/battleRules.js";
import { CIRCUIT_CLASH, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
import { BATTLE_PROFILES } from "../src/battle/battleProfiles.js";
import { FORMATIONS } from "../src/formationData.js";

const objectives = CIRCUIT_CLASH.objectives;
const enemy = buildEnemyForce();
const PLAN = {
  p1: { formationId: "railjack", objectiveId: "south-relay" },
  p2: { formationId: "furnace", objectiveId: "reactor" },
  p3: { formationId: "breaker", objectiveId: "reactor" },
  p4: { formationId: "command", objectiveId: "reactor" },
  p5: { formationId: "skimmer", objectiveId: "east-gantry" },
};
const battleWith = ({ playerStratagems = [], enemyHand = [] } = {}) => {
  const player = buildPlayerForce({ deployment: PLAN, formations: FORMATIONS });
  return resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders,
    // On the ground the enemy was built for. Resolving on a flat plain while the enemy's
    // list was chosen against the Circuit's slag and stacks is two different battles.
    missionId: CIRCUIT_CLASH.id,
    playerStratagems, enemyHand,
  });
};

test("spending nothing changes nothing", () => {
  // The whole feature has to be additive: a battle with no stratagems must resolve
  // exactly as it did before they existed, or every balance number already measured is
  // invalidated.
  const bare = battleWith();
  const explicit = battleWith({ playerStratagems: [], enemyHand: [] });
  assert.deepEqual(bare.rounds, explicit.rounds);
  bare.rounds.forEach((round) => assert.deepEqual(round.spends, []));
  assert.deepEqual(effectsOf([]), { ...NO_EFFECTS });
});

test("a stratagem only fires in the round it was committed to", () => {
  // This is the "right place and time" decision: the same card in a different round is a
  // different battle. If it were not, the timing choice would be decoration.
  const early = battleWith({ playerStratagems: [{ id: "brace", round: 1 }] });
  const late = battleWith({ playerStratagems: [{ id: "brace", round: 4 }] });
  assert.deepEqual(early.rounds[0].spends.map((spend) => spend.id), ["brace"]);
  assert.deepEqual(early.rounds[3].spends, []);
  assert.deepEqual(late.rounds[0].spends, []);
  assert.deepEqual(late.rounds[3].spends.map((spend) => spend.id), ["brace"]);
  assert.notDeepEqual(
    early.rounds.map((round) => round.players.map((unit) => unit.wounds)),
    late.rounds.map((round) => round.players.map((unit) => unit.wounds)),
    "when a stratagem is spent made no difference to the battle",
  );
});

test("BRACE actually reduces what the army takes in the round it is spent", () => {
  const woundsAfter = (result, round) => result.rounds[round - 1].players
    .reduce((sum, unit) => sum + unit.wounds, 0);
  const bare = battleWith();
  const braced = battleWith({ playerStratagems: [{ id: "brace", round: 3 }] });
  assert.ok(woundsAfter(braced, 3) > woundsAfter(bare, 3), "bracing did not save any wounds");
  // And it is a one-round effect, not a permanent buff. Round 2 is untouched because the
  // spend had not happened yet, which is the cheapest possible proof it is not a buff.
  assert.deepEqual(braced.rounds[1].log, bare.rounds[1].log, "BRACE reached backwards into an earlier round");
  const enemyFire = (result, round) => result.rounds[round - 1].log
    .filter((entry) => entry.side === "enemy" && entry.phase === "shoot")
    .reduce((sum, entry) => sum + entry.amount, 0);
  assert.ok(enemyFire(braced, 3) < enemyFire(bare, 3), "the round it was spent in took full damage");
});

test("HOLD FAST flips an objective that was being lost on control", () => {
  // A stratagem the player cannot predict the consequence of is noise. Doubling control
  // has to be able to change who holds ground, and only for that round.
  const bare = battleWith();
  const holders = (result, round) => result.rounds[round - 1].objectives
    .map((objective) => `${objective.objectiveId}:${objective.holder}`).join(",");
  // Spent in a round where there is ground to flip, found rather than hardcoded. A fixed
  // round three happened to be the one round in this fixture where the markers were already
  // going the player's way, and the test failed for the terrain moving rather than for the
  // stratagem breaking.
  const round = [1, 2, 3, 4, 5].find((candidate) => holders(
    battleWith({ playerStratagems: [{ id: "hold-fast", round: candidate }] }), candidate,
  ) !== holders(bare, candidate));
  assert.ok(round, "doubling control changed no objective in any round");
  const held = battleWith({ playerStratagems: [{ id: "hold-fast", round }] });
  // Measured as the MARGIN, not the player's score. Doubling control can flip a marker the
  // enemy was holding to contested rather than to yours, which pays nobody and costs them
  // a point — worth exactly as much under DOMINION and invisible to a one-sided reading.
  const margin = (result, round) => result.rounds[round - 1].playerScore - result.rounds[round - 1].enemyScore;
  assert.ok(margin(held, round) > margin(bare, round), "the extra ground paid nothing");
});

test("OVERWATCH fires before anyone advances, and the log says so", () => {
  const watched = battleWith({ playerStratagems: [{ id: "overwatch", round: 3 }] });
  const shots = watched.rounds[2].log.filter((entry) => entry.phase === "overwatch");
  // Overwatch is only worth spending once the armies are already in range at the top of
  // the round — which, after the opening double advance, they are from round three.
  assert.ok(shots.length > 0, "overwatch produced no fire");
  assert.ok(shots.every((entry) => entry.side === "player"), "the enemy shot during the player's overwatch");
  // The spend is logged before the shooting it caused, so the round reads in order.
  const log = watched.rounds[2].log;
  assert.equal(log[0].phase, "stratagem");
  assert.ok(log.indexOf(shots[0]) > 0);
  // It is not a free extra round of shooting for the whole battle.
  assert.equal(watched.rounds[3].log.filter((entry) => entry.phase === "overwatch").length, 0);
});

test("FOCUS FIRE concentrates on one target and costs the formations out of range", () => {
  // Spent on the first round the armies are actually shooting, found rather than hardcoded.
  // A fixed round four went to zero the moment the enemy's list changed — every formation
  // out of range of the chosen target is the stratagem working, but it proves nothing about
  // concentration, and the test would have kept passing if it had been a 1.
  const bare = battleWith();
  // The round with the MOST shooting in it, not the first with any. The first round anyone
  // is in range is one formation clipping the nearest thing, and the most dangerous
  // formation on the board — which is what FOCUS FIRE picks — is still nowhere near.
  const shooting = (round) => round.log.filter((entry) => entry.side === "player" && entry.phase === "shoot").length;
  const contact = bare.rounds.reduce((best, round, index) => (shooting(round) > shooting(bare.rounds[best]) ? index : best), 0);
  assert.ok(shooting(bare.rounds[contact]) > 1, "the armies never really came into contact at all");
  const focused = battleWith({ playerStratagems: [{ id: "focus-fire", round: contact + 1 }] });
  const targets = (result) => new Set(result.rounds[contact].log
    .filter((entry) => entry.side === "player" && entry.phase === "shoot").map((entry) => entry.target));
  assert.equal(targets(focused).size, 1, "focus fire spread across more than one target");
  assert.ok(targets(bare).size >= 1);
  // And it picks the most dangerous thing SOMEONE CAN REACH, not the nearest and not the
  // most dangerous on the board. Ordering the army onto a hull nobody is in range of is not
  // a cost, it is the spend evaporating — it made this a two-point stratagem that fired
  // nothing in any round of any battle once the enemy walked a plan instead of beelining.
  const chosen = [...targets(focused)][0];
  // Everything the army shot at WITHOUT the stratagem was, by definition, something it could
  // reach. Whatever FOCUS FIRE picked has to be at least as dangerous as any of them.
  const byName = new Map(enemy.units.map((unit) => [unit.name, unit]));
  const wouldHaveShot = [...targets(bare)].map((name) => byName.get(name)).filter(Boolean);
  assert.ok(wouldHaveShot.length > 0, "the probe round has no shooting in it");
  for (const skipped of wouldHaveShot) {
    assert.ok(threatOf(byName.get(chosen)) >= threatOf(skipped),
      `focus fire picked ${chosen} over the more dangerous ${skipped.name}`);
  }
  // Threat is guns, then fists, then ground held — never proximity. Ranked by how close it
  // is instead, the army concentrates on whatever it was already going to shoot, and the
  // stratagem is two command points for nothing.
  const nearest = [...targets(bare)]
    .map((name) => byName.get(name))
    .filter(Boolean)
    .sort((left, right) => right.y - left.y)[0];
  assert.ok(nearest, "nothing was shot at without the stratagem");
  assert.ok(threatOf(byName.get(chosen)) >= threatOf(nearest), "focus fire picked by proximity");
  assert.ok(threatOf(byName.get(chosen)) > 0, "the threat ranking is not ranking anything");
});

test("SURGE FORWARD moves the army twice, and only that round", () => {
  const bare = battleWith();
  const surged = battleWith({ playerStratagems: [{ id: "surge", round: 2 }] });
  const advanced = (result, round) => result.rounds[round - 1].players
    .reduce((sum, unit) => sum + unit.y, 0);
  // The player advances up the board, so a second move lowers the summed y.
  assert.ok(advanced(surged, 2) < advanced(bare, 2), "surging moved the army no further");
  // Round one is untouched, because the spend had not happened yet.
  assert.equal(advanced(surged, 1), advanced(bare, 1));
});

test("EXECUTION ORDER also strikes twice, so the round it is spent in hits harder", () => {
  const bare = battleWith();
  const struck = battleWith({ playerStratagems: [{ id: "execution-order", round: 5 }] });
  const melee = (result, round) => result.rounds[round - 1].log
    .filter((entry) => entry.phase === "fight").reduce((sum, entry) => sum + entry.amount, 0);
  assert.ok(melee(struck, 5) > melee(bare, 5), "striking twice dealt no more damage");
});

test("SURGE FORWARD does not stack with the opening advance", () => {
  // Both armies already double-advance out of deployment. Letting SURGE add a third move
  // on round one made a one-point card worth six victory points on its own — the sweep
  // said so before anyone played it. Spent later it has to still do something.
  const bare = battleWith();
  const opening = battleWith({ playerStratagems: [{ id: "surge", round: 1 }] });
  const positions = (result, round) => result.rounds[round - 1].players.map((unit) => `${unit.x},${unit.y}`).join("|");
  assert.equal(positions(opening, 1), positions(bare, 1), "surging on round one moved the army further than the opening advance");
  const later = battleWith({ playerStratagems: [{ id: "surge", round: 2 }] });
  assert.notEqual(positions(later, 2), positions(bare, 2), "surging after round one did nothing at all");
});

test("EXECUTION ORDER means anything killed outright never swings back", () => {
  // Melee is simultaneous by default, and that is the exact rule this stratagem buys out
  // of. A one-blow kill has to cost the player nothing in the round they spent it.
  const duel = (playerStratagems) => {
    const axe = deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 50 } });
    const doomed = { ...deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 52 } }), wounds: 1 };
    return resolveBattle({
      playerUnits: [axe], enemyUnits: [doomed], objectives: [], rounds: 1,
      playerOrders: {}, enemyOrders: {}, playerStratagems,
    }).rounds[0];
  };
  const simultaneous = duel([]);
  const first = duel([{ id: "execution-order", round: 1 }]);
  assert.ok(simultaneous.enemies[0].wounds <= 0 && first.enemies[0].wounds <= 0, "the blow did not kill");
  // Both took the same shooting on the way in — shooting is not what this changes. The
  // difference between the two is exactly the melee blow the dead formation got back.
  const returned = deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 0, y: 0 } }).melee * 0.5;
  assert.ok(returned > 0, "the fixture cannot strike back at all, so it proves nothing");
  assert.equal(
    Number((first.players[0].wounds - simultaneous.players[0].wounds).toFixed(2)), returned,
    "a formation struck back after being killed outright",
  );
  // A survivor still answers, so it is strike-first and not blanket immunity.
  const survives = resolveBattle({
    playerUnits: [deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 50 } })],
    enemyUnits: [deployUnit({ formationId: "bastion", name: "WALL", position: { x: 50, y: 52 } })],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {},
    playerStratagems: [{ id: "execution-order", round: 1 }],
  }).rounds[0];
  assert.ok(survives.players[0].wounds < survives.players[0].maxWounds, "a formation that survived the blow did not answer it");
});

test("drawing a hand always terminates and never repeats a card", () => {
  // The first version walked the pool with a stride, which lands on the same index forever
  // whenever the stride and the pool size share a factor — a hang, not a bad hand.
  const cards = Object.keys(STRATAGEMS);
  for (let poolSize = 1; poolSize <= cards.length; poolSize += 1) {
    const detachment = { pool: cards.slice(0, poolSize), commandPoints: 3 };
    for (let seed = 0; seed < 24; seed += 1) {
      for (const size of [1, 2, 3]) {
        const hand = drawEnemyHand({ detachment, seed, size });
        assert.equal(hand.length, Math.min(size, poolSize));
        assert.equal(new Set(hand).size, hand.length, `pool ${poolSize} seed ${seed} repeated a card`);
      }
    }
  }
});

test("the enemy hand is drawn from its own pool, and is stable for a seed", () => {
  const detachment = DETACHMENTS.ordoPraesidium;
  for (let seed = 0; seed < 12; seed += 1) {
    const hand = drawEnemyHand({ detachment, seed });
    assert.equal(hand.length, 2);
    assert.equal(new Set(hand).size, 2, `seed ${seed} drew the same card twice`);
    hand.forEach((id) => assert.ok(detachment.pool.includes(id), `seed ${seed} drew ${id}, which is not in the pool`));
    assert.deepEqual(drawEnemyHand({ detachment, seed }), hand, `seed ${seed} is not repeatable`);
  }
  // Different seeds have to actually produce different hands, or there is no uncertainty.
  const hands = new Set(Array.from({ length: 12 }, (unused, seed) => drawEnemyHand({ detachment, seed }).join("+")));
  assert.ok(hands.size >= 3, `only ${hands.size} distinct hands across 12 seeds`);
});

test("a hand never exceeds the pool, and an empty pool draws nothing", () => {
  const small = { pool: ["brace"], commandPoints: 3 };
  assert.deepEqual(drawEnemyHand({ detachment: small, seed: 5 }), ["brace"]);
  assert.deepEqual(drawEnemyHand({ detachment: { pool: [] }, seed: 1 }), []);
  // A pool naming a stratagem that does not exist must not put a hole in the hand.
  assert.deepEqual(drawEnemyHand({ detachment: { pool: ["brace", "not-a-stratagem"] }, seed: 0 }), ["brace"]);
});

test("what the enemy holds changes the battle, which is where the uncertainty lives", () => {
  const outcomes = new Set();
  for (let seed = 0; seed < 8; seed += 1) {
    const result = battleWith({ enemyHand: drawEnemyHand({ seed }) });
    outcomes.add(`${result.playerScore}-${result.enemyScore}`);
    // Whatever it holds, it spends inside the battle rather than sitting on it.
    const spent = result.rounds.flatMap((round) => round.spends).filter((spend) => spend.side === "enemy");
    assert.equal(spent.length, 2, `seed ${seed} left cards unspent`);
  }
  assert.ok(outcomes.size > 1, "every enemy hand produced the same battle");
});

test("the enemy spends where the player can see it, in rounds 2 and 4", () => {
  const hand = ["brace", "focus-fire"];
  assert.equal(enemyPlaysAt({ hand, round: 1 }), null);
  assert.equal(enemyPlaysAt({ hand, round: 2 }), "brace");
  assert.equal(enemyPlaysAt({ hand, round: 3 }), null);
  assert.equal(enemyPlaysAt({ hand, round: 4 }), "focus-fire");
  assert.equal(enemyPlaysAt({ hand, round: 5 }), null);
  assert.equal(enemyPlaysAt({ hand: [], round: 2 }), null);
  // Every spend appears in the round log, so a battle is never lost to something the
  // player was not shown happening.
  const result = battleWith({ enemyHand: hand });
  const logged = result.rounds.flatMap((round) => round.log)
    .filter((entry) => entry.phase === "stratagem" && entry.side === "enemy").map((entry) => entry.actor);
  assert.deepEqual(logged, [stratagemFor("brace").name, stratagemFor("focus-fire").name]);
});

test("a spend reports what it actually did, not only what it meant to do", () => {
  // "I don't know if my command points did anything." A banner that states an intention
  // and never reports an outcome is a banner nobody believes.
  const braced = battleWith({ playerStratagems: [{ id: "brace", round: 3 }] });
  const spend = braced.rounds[2].spends.find((entry) => entry.id === "brace");
  assert.ok(spend.outcome, "BRACE reported no outcome");
  assert.match(spend.outcome, /taken this round/);
  // The number in the outcome is the damage that round actually took.
  const taken = braced.rounds[2].log
    .filter((entry) => entry.side === "enemy" && entry.phase !== "stratagem")
    .reduce((sum, entry) => sum + entry.amount, 0);
  assert.match(spend.outcome, new RegExp(taken.toFixed(1).replace(".", "\\.")));

  // Every stratagem says something, including when it did nothing at all.
  for (const [id, round] of [["overwatch", 3], ["focus-fire", 4], ["surge", 2], ["hold-fast", 3], ["execution-order", 5]]) {
    const result = battleWith({ playerStratagems: [{ id, round }] });
    const reported = result.rounds[round - 1].spends.find((entry) => entry.id === id);
    assert.ok(reported?.outcome?.length > 5, `${id} reported no outcome`);
  }
  // A stratagem spent where it can accomplish nothing says so rather than claiming a win.
  // On its own two-formation board rather than in the fixture above: whether the armies are
  // already in contact in a given round depends on the ground and on what the enemy brought,
  // and this assertion is about the REPORTING, not about either of those.
  const wasted = resolveBattle({
    playerUnits: [deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 95 } })],
    enemyUnits: [{ ...deployUnit({ formationId: "breaker", name: "FOE", position: { x: 50, y: 5 } }), id: "enemy-breaker" }],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {},
    playerStratagems: [{ id: "execution-order", round: 1 }],
  });
  assert.match(wasted.rounds[0].spends[0].outcome, /nothing was in contact/);
});

test("the player is shown the pool and never the hand", () => {
  const pool = scoutedPool(DETACHMENTS.ordoPraesidium);
  assert.equal(pool.length, DETACHMENTS.ordoPraesidium.pool.length);
  for (const entry of pool) {
    assert.ok(entry.name && entry.text && entry.trigger, `${entry.id} is not fully described`);
    assert.ok(Object.values(TRIGGERS).includes(entry.trigger), `${entry.id} has an unreadable trigger`);
  }
  // The scouting report carries no notion of which of them are actually held.
  const serialised = JSON.stringify(pool);
  assert.equal(serialised.includes("hand"), false);
  assert.equal(serialised.includes("held"), false);
});

test("command points bound the choice", () => {
  const detachment = DETACHMENTS.voidbreaker;
  assert.deepEqual(affordable({ chosen: [], detachment }), { spent: 0, remaining: 3 });
  assert.deepEqual(affordable({ chosen: ["brace", "hold-fast"], detachment }), { spent: 2, remaining: 1 });
  assert.equal(affordable({ chosen: ["focus-fire", "execution-order"], detachment }).remaining, -1);
  // Every stratagem in every pool has to be nameable and priced, or the budget is a lie.
  for (const entry of Object.values(DETACHMENTS)) {
    assert.ok(entry.commandPoints > 0);
    for (const id of entry.pool) {
      const stratagem = stratagemFor(id);
      assert.ok(stratagem, `${entry.id} pools an unknown stratagem: ${id}`);
      assert.ok(stratagem.cost >= 1 && stratagem.cost <= entry.commandPoints, `${id} is unaffordable in ${entry.id}`);
      assert.ok(TRIGGERS[stratagem.trigger], `${id} fires at an unknown moment`);
    }
  }
});

test("an unknown or malformed stratagem is ignored rather than crashing the battle", () => {
  const junk = battleWith({ playerStratagems: [{ id: "not-a-stratagem", round: 2 }, null, { round: 3 }] });
  assert.equal(junk.rounds.length, 5);
  junk.rounds.forEach((round) => assert.deepEqual(round.spends, []));
  assert.equal(stratagemFor("not-a-stratagem"), null);
  assert.deepEqual(effectsOf([null, undefined, {}]), { ...NO_EFFECTS });
});

test("a battle with stratagems is still perfectly repeatable", () => {
  // Determinism is what lets the whole space be swept rather than sampled, and adding a
  // hidden hand must not have introduced a source of randomness.
  const plan = { playerStratagems: [{ id: "brace", round: 2 }, { id: "hold-fast", round: 5 }], enemyHand: drawEnemyHand({ seed: 3 }) };
  assert.deepEqual(battleWith(plan).rounds, battleWith(plan).rounds);
});

test("effects stack by multiplying rather than by the last one winning", () => {
  const both = effectsOf([stratagemFor("brace"), { effect: { incomingDamageScale: 0.5 } }]);
  assert.equal(both.incomingDamageScale, 0.25);
  const mixed = effectsOf([stratagemFor("hold-fast"), stratagemFor("overwatch")]);
  assert.equal(mixed.controlScale, 2);
  assert.equal(mixed.extraShootingPhase, true);
});
