import test from "node:test";
import assert from "node:assert/strict";

import {
  DISPOSITIONS,
  liveSitesFor,
  STRATEGIES,
  dispositionFor,
  dispositionsFor,
  scoreRound,
  strategiesFor,
  strategyFor,
} from "../src/battle/doctrine.js";
import { DETACHMENTS } from "../src/battle/stratagems.js";
import { resolveBattle, deployUnit } from "../src/battle/battleRules.js";
import { BATTLE_PLANS, planFor, plansFor, routeDestinationFor, routePointsFor } from "../src/battle/battlePlans.js";
import { CIRCUIT_LANDMARKS as BATTLE_LANDMARKS, routeCost } from "../src/battle/battleTerrain.js";
import { CIRCUIT_CLASH, IRON_PROCESSION, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
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
const battleAs = (playerDisposition) => {
  const player = buildPlayerForce({ deployment: PLAN, formations: FORMATIONS });
  return resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders,
    playerDisposition, enemyDisposition: "dominion",
  });
};

test("a detachment gates which dispositions its army may declare", () => {
  // The point of the layer. A detachment that could declare everything would be a label.
  const guild = dispositionsFor(DETACHMENTS.voidbreaker).map((entry) => entry.id);
  const ordo = dispositionsFor(DETACHMENTS.ordoPraesidium).map((entry) => entry.id);
  assert.notDeepEqual(guild, ordo, "both detachments allow exactly the same dispositions");
  for (const detachment of Object.values(DETACHMENTS)) {
    const allowed = dispositionsFor(detachment);
    assert.ok(allowed.length >= 2, `${detachment.id} offers no real choice of disposition`);
    assert.ok(allowed.length < Object.keys(DISPOSITIONS).length, `${detachment.id} can declare everything`);
    allowed.forEach((entry) => assert.ok(DISPOSITIONS[entry.id], `${detachment.id} gates an unknown disposition`));
  }
  // Something has to be reachable from either one, or the two are separate games.
  const shared = guild.filter((id) => ordo.includes(id));
  assert.ok(shared.length > 0, "no disposition is reachable from both detachments");
  // An unknown detachment offers nothing rather than throwing.
  assert.deepEqual(dispositionsFor(undefined), []);
  assert.deepEqual(dispositionsFor({ dispositions: ["not-a-disposition"] }), []);
});

test("every disposition offers exactly three strategies, and each is a plan with paths", () => {
  // A strategy is a route per deployment slot, not five objective assignments. Five
  // assignments have no shape — you cannot look at them and see a pincer or a refused
  // flank. This is the guard that keeps them plans.
  const slots = CIRCUIT_CLASH.playerDeployment.length;
  for (const id of Object.keys(DISPOSITIONS)) {
    const plans = plansFor(id);
    assert.equal(plans.length, 3, `${id} does not offer three strategies`);
    const seen = new Set();
    for (const entry of plans) {
      assert.equal(seen.has(entry.id), false, `${id} lists ${entry.id} twice`);
      seen.add(entry.id);
      assert.ok(entry.name && entry.summary && entry.shape, `${id}/${entry.id} is not described`);
      assert.equal(entry.routes.length, slots, `${id}/${entry.id} does not route every slot`);
      entry.routes.forEach((route, index) => {
        assert.ok(route.length >= 1, `${id}/${entry.id} slot ${index} has an empty route`);
        route.forEach((name) => assert.ok(BATTLE_LANDMARKS[name], `${id}/${entry.id} routes through unknown ground: ${name}`));
        // Every leg has to actually go somewhere, or the drawn path doubles back on itself.
        const points = routePointsFor(entry, index);
        assert.equal(points.length, route.length, `${id}/${entry.id} slot ${index} lost a waypoint`);
        for (let step = 1; step < points.length; step += 1) {
          const gap = Math.hypot(points[step].x - points[step - 1].x, points[step].y - points[step - 1].y);
          assert.ok(gap > 1, `${id}/${entry.id} slot ${index} has a zero-length leg`);
        }
      });
      // A plan has to send someone somewhere that scores, or it cannot win under any rule.
      const held = entry.routes.map((unused, index) => routeDestinationFor(entry, index, objectives)).filter(Boolean);
      assert.ok(held.length > 0, `${id}/${entry.id} reaches no objective at all`);
    }
    // A plan has to be a plan. If most of its slots are a single hop straight at an
    // objective it has stopped being a route and gone back to being an assignment, which
    // is the exact thing paths were brought in to replace.
    for (const entry of plans) {
      const routed = entry.routes.filter((route) => route.length >= 2).length;
      assert.ok(routed >= 3, `${id}/${entry.id} routes only ${routed} of its five slots through any intermediate ground`);
    }
    // Three identical route sets would not be three strategies.
    const shapes = plans.map((entry) => entry.routes.map((route) => route.join(">")).join("|"));
    assert.equal(new Set(shapes).size, 3, `${id} has duplicate plans`);
  }
});

test("a route is genuinely longer than the road up the middle", () => {
  // The cost of a flank has to be real or the plan is decoration. PINCER goes up the
  // outside lanes; SPEAR goes straight up the centre. The first must walk further.
  // Measured FROM THE DEPLOYMENT SLOT and priced in movement rather than in distance. It
  // used to start summing at the route's first waypoint, so the leg out of the slot was
  // free — which made a plan that starts at the far gates read as SHORTER than one that
  // starts at the centre. And it counted plain distance, so a route through the slag cost
  // what a route across open ground cost.
  const lengthOf = (entry, index) => routeCost(
    CIRCUIT_CLASH.playerDeployment[index],
    routePointsFor(entry, index, CIRCUIT_CLASH.id),
    CIRCUIT_CLASH.id,
  );
  const walked = (entry) => entry.routes.reduce((sum, unused, index) => sum + lengthOf(entry, index), 0);
  // Reaching onto contested ground costs more than sitting on your own relay, and pushing
  // through the middle of them costs most of all. Note what is NOT asserted: that a flank
  // route beats a central one. Once the outside gates are the way round the slag, the wide
  // plans start close to their own edge and the central ones walk the length of the board —
  // the cost of a flank is the ground it crosses, not the shape it makes.
  assert.ok(
    walked(planFor("dominion", "trapline")) > walked(planFor("safeguard", "tight-shell")),
    "the plan that reaches further is not actually a longer walk",
  );
  assert.ok(
    walked(planFor("eradication", "decapitate")) > walked(planFor("eradication", "crossfire")),
    "pushing through the centre is not a longer walk than sitting in front of it",
  );
  // And walking it puts the army somewhere else: two plans cannot end in the same places.
  const ends = (entry) => entry.routes.map((unused, index) => routePointsFor(entry, index).at(-1)).map((point) => `${point.x},${point.y}`).join("|");
  assert.notEqual(ends(planFor("dominion", "pressure")), ends(planFor("dominion", "trapline")));

  // No authored route may be longer than a move-11 formation can walk in the battle —
  // just above the middle of the roster, so a plan is allowed to demand speed but never
  // to demand the impossible. The first drafts of PINCER and PRESSURE both had a route
  // nobody could finish: 74 and 91 units against the 66 that is reachable, which spends
  // a whole deployment slot on a formation that is still walking when the battle ends.
  const REACHABLE = 11 * (CIRCUIT_CLASH.rounds + 1);
  for (const id of Object.keys(DISPOSITIONS)) {
    for (const entry of plansFor(id)) {
      entry.routes.forEach((unused, index) => {
        const start = CIRCUIT_CLASH.playerDeployment[index];
        const points = routePointsFor(entry, index);
        const walked = points.reduce((sum, point, step) => {
          const previous = step === 0 ? start : points[step - 1];
          return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
        }, 0);
        assert.ok(walked <= REACHABLE, `${id}/${entry.id} slot ${index} is a ${walked.toFixed(0)} unit walk, past the ${REACHABLE} that is reachable`);
      });
    }
  }
});

test("a disposition replaces the victory condition rather than decorating it", () => {
  // The same battle, resolved three ways, must produce three different scores — otherwise
  // declaring one is flavour text.
  // Compared round by round rather than on the final total. Two dispositions scoring the
  // same NUMBER out of one fixture is a coincidence — two of them earning it the same way,
  // round for round, is the thing this test exists to catch.
  const shapes = ["dominion", "eradication", "safeguard"]
    .map((id) => battleAs(id).rounds.map((round) => round.playerGained).join("/"));
  assert.equal(new Set(shapes).size, 3, `the three dispositions scored ${shapes.join("  ")}`);
  // And the enemy's score never moves, because only the player's rule changed.
  const enemyScores = new Set(["dominion", "eradication", "safeguard"].map((id) => battleAs(id).enemyScore));
  assert.equal(enemyScores.size, 1, "changing the player's disposition changed the enemy's score");
});

test("a disposition decides which markers are live, not just what holding one pays", () => {
  // This is what makes declaring one a commitment rather than a modifier: the board
  // visibly changes. ERADICATION darkens every marker; SAFEGUARD darkens everything past
  // your own half and doubles what is left.
  const board = [
    { objectiveId: "home", holder: "player", points: 2, y: 82 },
    { objectiveId: "centre", holder: "player", points: 2, y: 50 },
    { objectiveId: "deep", holder: "player", points: 2, y: 18 },
  ];
  const liveIds = (id, side = "player") => liveSitesFor({ disposition: id, side, objectives: board })
    .map((objective) => objective.objectiveId).sort();
  assert.deepEqual(liveIds("dominion"), ["centre", "deep", "home"], "dominion darkened something");
  assert.deepEqual(liveIds("eradication"), [], "eradication left a marker live");
  assert.deepEqual(liveIds("safeguard"), ["home"], "safeguard's live set is not its own half");
  // The halves are mirrored, so the same rule reads correctly from the other edge.
  assert.deepEqual(liveIds("safeguard", "enemy"), ["deep"]);
  // And SAFEGUARD's fewer markers are worth more, which is the trade it is making. Read
  // through the multiplier rather than written out: a guard that hardcodes the number it
  // is guarding stops guarding the moment the number is tuned.
  assert.ok(DISPOSITIONS.safeguard.homeMultiplier > 1, "safeguard's own ground is not worth more than anyone else's");
  assert.equal(liveSitesFor({ disposition: "safeguard", side: "player", objectives: board })[0].points, 2 * DISPOSITIONS.safeguard.homeMultiplier);
  assert.equal(liveSitesFor({ disposition: "dominion", side: "player", objectives: board })[0].points, 2);
  // Re-valuing must not scribble on the mission.
  assert.equal(board[0].points, 2, "the live set mutated the mission's objectives");
});

test("DOMINION pays for ground, ERADICATION pays for damage, SAFEGUARD pays for keeping the army whole", () => {
  const held = [{ objectiveId: "a", holder: "player", points: 2, y: 82 }];
  const deep = [{ objectiveId: "b", holder: "player", points: 2, y: 18 }];
  const centre = [{ objectiveId: "c", holder: "player", points: 2, y: 50 }];

  assert.equal(scoreRound({ disposition: "dominion", side: "player", objectives: held }), 2);
  assert.equal(scoreRound({ disposition: "dominion", side: "player", objectives: deep }), 2, "dominion cares where the ground is");
  assert.equal(scoreRound({ disposition: "dominion", side: "player", objectives: held, damage: 30, destroyed: 2 }), 2, "dominion was paid for kills");

  assert.equal(scoreRound({ disposition: "eradication", side: "player", objectives: held }), 0, "eradication was paid for ground");
  const forDamage = (wounds) => Math.floor(wounds / DISPOSITIONS.eradication.damagePerPoint);
  assert.equal(scoreRound({ disposition: "eradication", side: "player", damage: 8 }), forDamage(8));
  assert.equal(scoreRound({ disposition: "eradication", side: "player", damage: 8, destroyed: 1 }), forDamage(8) + DISPOSITIONS.eradication.wreckBounty);
  // What has already been paid for is subtracted, so a wound is never cashed twice.
  assert.equal(scoreRound({ disposition: "eradication", side: "player", damage: 8, damagePaid: 1 }), forDamage(8) - 1);

  // Safeguard's own half pays its multiplier; anything outside it is dark and pays nothing.
  assert.equal(scoreRound({ disposition: "safeguard", side: "player", objectives: held, lost: 1 }), 2 * DISPOSITIONS.safeguard.homeMultiplier);
  assert.equal(scoreRound({ disposition: "safeguard", side: "player", objectives: held, lost: 0 }), 2 * DISPOSITIONS.safeguard.homeMultiplier + 1);
  assert.equal(scoreRound({ disposition: "safeguard", side: "player", objectives: deep, lost: 1 }), 0, "safeguard cashed ground in the enemy half");
  assert.equal(scoreRound({ disposition: "safeguard", side: "player", objectives: centre, lost: 1 }), 0, "safeguard cashed the centre line");
  assert.equal(scoreRound({ disposition: "safeguard", side: "enemy", objectives: [{ ...deep[0], holder: "enemy" }], lost: 1 }), 2 * DISPOSITIONS.safeguard.homeMultiplier);
  assert.equal(scoreRound({ disposition: "safeguard", side: "enemy", objectives: [{ ...held[0], holder: "enemy" }], lost: 1 }), 0);
});

test("a round pays nobody for ground held by the other side", () => {
  const contested = [
    { objectiveId: "a", holder: "enemy", points: 2, y: 82 },
    { objectiveId: "b", holder: "contested", points: 2, y: 50 },
  ];
  for (const id of Object.keys(DISPOSITIONS)) {
    // lost: 1 switches off SAFEGUARD's clean-round payment, so what is left is the ground.
    assert.equal(scoreRound({ disposition: id, side: "player", objectives: contested, lost: 1 }), 0, `${id} paid for ground it did not hold`);
  }
});

test("scoring never goes negative and an unknown disposition falls back rather than crashing", () => {
  assert.equal(dispositionFor("not-a-disposition").id, "dominion");
  assert.equal(scoreRound({ disposition: "not-a-disposition", side: "player", objectives: [] }), 0);
  assert.equal(scoreRound({}), 0);
  assert.equal(scoreRound({ disposition: DISPOSITIONS.eradication, side: "player", damage: -50 }), 0);
  const battle = resolveBattle({ playerDisposition: "nonsense", enemyDisposition: "nonsense" });
  assert.equal(battle.rounds.length, 5);
  assert.equal(battle.playerDisposition.id, "dominion");
});

test("the strategy chosen decides where the army is sent", () => {
  const nameById = new Map(FORMATIONS.map((formation) => [formation.id, formation.name]));
  const list = ["railjack", "furnace", "breaker", "command", "skimmer"];
  const play = (entry) => {
    const units = list.map((formationId, index) => deployUnit({
      formationId, name: nameById.get(formationId), position: CIRCUIT_CLASH.playerDeployment[index],
    }));
    return resolveBattle({
      playerUnits: units, enemyUnits: enemy.units, objectives,
      playerOrders: {}, enemyOrders: enemy.orders, enemyPaths: enemy.paths,
      playerPaths: Object.fromEntries(list.map((formationId, index) => [formationId, routePointsFor(entry, index)])),
      playerDisposition: "dominion", enemyDisposition: "dominion",
      // On the actual ground. Two plans that differ only in which lane they use are the
      // same plan on a flat plain, which is what the board was before there was terrain.
      missionId: CIRCUIT_CLASH.id,
    });
  };
  // WHERE THE ARMY STANDS is the claim. Three plans must put it in three different places
  // — that is what a plan is. Scoring is judged more weakly on purpose: two plans that hold
  // the same three markers against one particular enemy score the same, and that is a fact
  // about that enemy rather than about the plans. Asserting three distinct scores here was
  // asserting a coincidence, and it held right up until the terrain moved.
  const finals = BATTLE_PLANS.dominion.map((entry) => play(entry).rounds.at(-1).players
    .map((unit) => `${unit.x.toFixed(0)},${unit.y.toFixed(0)}`).join("|"));
  assert.equal(new Set(finals).size, BATTLE_PLANS.dominion.length, "three plans put the army in the same place");
  const outcomes = BATTLE_PLANS.dominion.map((entry) => play(entry).rounds.map((round) => round.playerGained).join("/"));
  assert.ok(new Set(outcomes).size > 1, `every dominion plan scored the same: ${outcomes[0]}`);
});

test("strategyFor falls back to the disposition's first plan rather than returning nothing", () => {
  assert.equal(strategyFor("dominion", "spear").id, "spear");
  assert.equal(strategyFor("dominion", "not-a-strategy").id, STRATEGIES.dominion[0].id);
  assert.equal(strategyFor("not-a-disposition", "anything"), null);
  assert.deepEqual(strategiesFor("not-a-disposition"), []);
});

test("the enemy declares a disposition its own detachment allows, and the player is shown it", () => {
  // What the enemy is trying to do is disclosed; only its stratagem hand is hidden. That
  // split is the whole disclosure design — you plan against intent, not against a mystery.
  const detachment = DETACHMENTS[IRON_PROCESSION.detachment];
  assert.ok(detachment, "the enemy army names a detachment that does not exist");
  assert.ok(
    (detachment.dispositions ?? []).includes(IRON_PROCESSION.disposition),
    `${detachment.id} may not declare ${IRON_PROCESSION.disposition}`,
  );
  assert.ok(DISPOSITIONS[IRON_PROCESSION.disposition].summary.length > 0);
});

test("both armies score under their own rule in the same battle", () => {
  const player = buildPlayerForce({ deployment: PLAN, formations: FORMATIONS });
  const asymmetric = resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders,
    playerDisposition: "eradication", enemyDisposition: "eradication",
  });
  const mirrored = resolveBattle({
    playerUnits: player.units, enemyUnits: enemy.units, objectives,
    playerOrders: player.orders, enemyOrders: enemy.orders,
    playerDisposition: "eradication", enemyDisposition: "dominion",
  });
  assert.notDeepEqual(
    asymmetric.rounds.map((round) => round.enemyGained),
    mirrored.rounds.map((round) => round.enemyGained),
    "the enemy's disposition did not change what its rounds paid",
  );
  assert.equal(asymmetric.playerScore, mirrored.playerScore, "the enemy's disposition changed the player's scoring");
  // Each round reports what it paid each side, so a score is never unexplained.
  asymmetric.rounds.forEach((round) => {
    assert.equal(typeof round.playerGained, "number");
    assert.equal(typeof round.enemyGained, "number");
  });
  assert.equal(asymmetric.rounds.reduce((sum, round) => sum + round.playerGained, 0), asymmetric.playerScore);
  assert.equal(asymmetric.rounds.reduce((sum, round) => sum + round.enemyGained, 0), asymmetric.enemyScore);
});

test("a formation is only ever paid for once under ERADICATION", () => {
  // Losses are counted from the top of each round, not from the start of the battle. If
  // that were wrong a wreck would keep paying its 4 VP every remaining round — which is
  // both a scoring bug and a reason nobody would ever declare anything else.
  const axe = deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 50 } });
  const doomed = { ...deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 52 } }), wounds: 1 };
  const result = resolveBattle({
    playerUnits: [axe], enemyUnits: [doomed], objectives: [], rounds: 5,
    playerOrders: {}, enemyOrders: {}, playerDisposition: "eradication", enemyDisposition: "eradication",
  });
  const paid = result.rounds.map((round) => round.playerGained);
  assert.ok(paid[0] >= 3, `the round the kill happened paid ${paid[0]}`);
  // Nothing is left alive to damage or destroy, so every later round pays nothing at all.
  assert.deepEqual(paid.slice(1), [0, 0, 0, 0], `later rounds paid ${paid.slice(1).join(", ")}`);
  assert.equal(result.playerScore, paid[0], "the total is more than the sum of its rounds");

  // And the mirror, because the two sides count their losses with separate running totals
  // and only testing one of them leaves the other free to double-pay.
  const mirrored = resolveBattle({
    playerUnits: [{ ...deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 52 } }), wounds: 1 }],
    enemyUnits: [deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 50 } })],
    objectives: [], rounds: 5, playerOrders: {}, enemyOrders: {},
    playerDisposition: "eradication", enemyDisposition: "eradication",
  });
  const enemyPaid = mirrored.rounds.map((round) => round.enemyGained);
  assert.ok(enemyPaid[0] >= 3, `the round the kill happened paid ${enemyPaid[0]}`);
  assert.deepEqual(enemyPaid.slice(1), [0, 0, 0, 0], `later rounds paid ${enemyPaid.slice(1).join(", ")}`);

  // SAFEGUARD reads the same counter from the other direction: a round is clean only if
  // you lost nothing *this* round, not if you have never lost anything. It also has to be
  // holding its own ground — a clean round paid for hiding, and across a run that
  // compounded into a disposition that was simply the right answer.
  const home = { id: "home", name: "HOME", x: 50, y: 82, points: 1 };
  const holder = () => deployUnit({ formationId: "railjack", name: "HOLDER", position: { x: 50, y: 82 } });
  const safeguarded = resolveBattle({
    playerUnits: [holder(), { ...deployUnit({ formationId: "skimmer", name: "DOOMED", position: { x: 50, y: 52 } }), wounds: 1 }],
    enemyUnits: [deployUnit({ formationId: "breaker", name: "AXE", position: { x: 50, y: 50 } })],
    objectives: [home], rounds: 5, playerOrders: {}, enemyOrders: {},
    playerPaths: { railjack: [{ x: 50, y: 82 }], skimmer: [{ x: 50, y: 52 }] },
    playerDisposition: "safeguard", enemyDisposition: "dominion",
  });
  const clean = safeguarded.rounds.map((round) => round.playerGained);
  // Holding a 1 VP objective in its own half pays the multiplier; a clean round adds one.
  const ground = 1 * DISPOSITIONS.safeguard.homeMultiplier;
  assert.equal(clean[0], ground, "the round the formation died still counted as a clean round");
  assert.deepEqual(clean.slice(1), [ground + 1, ground + 1, ground + 1, ground + 1], "rounds after the loss never became clean again");

  // And with no ground held at all, a clean round pays nothing.
  const hiding = resolveBattle({
    playerUnits: [deployUnit({ formationId: "railjack", name: "HIDING", position: { x: 4, y: 96 } })],
    enemyUnits: [], objectives: [home], rounds: 3, playerOrders: {}, enemyOrders: {},
    playerPaths: { railjack: [{ x: 4, y: 96 }] }, playerDisposition: "safeguard",
  });
  assert.deepEqual(hiding.rounds.map((round) => round.playerGained), [0, 0, 0], "a clean round paid for hiding");
});
