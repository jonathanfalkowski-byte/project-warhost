import test from "node:test";
import assert from "node:assert/strict";

import { CIRCUIT_LANDMARKS as BATTLE_LANDMARKS, LANDMARK_TABLES, landmark, landmarksFor, resolveRoute } from "../src/battle/battleTerrain.js";
import { BATTLE_PLANS, planFor, plansFor, routeDestinationFor, routePointsFor } from "../src/battle/battlePlans.js";
import { DETACHMENTS, detachmentFor, detachmentList } from "../src/battle/stratagems.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { CIRCUIT_CLASH, IRON_PROCESSION, buildEnemyForce, buildPlayerForce } from "../src/battle/battleMission.js";
import { FORMATIONS } from "../src/formationData.js";

const objectives = CIRCUIT_CLASH.objectives;
const enemy = buildEnemyForce();
const nameById = new Map(FORMATIONS.map((formation) => [formation.id, formation.name]));

test("the board's named ground is mirrored about the centre line", () => {
  // A plan written for the player has to have a mirror that works for the enemy, or the
  // authored lanes quietly favour one edge and every balance number is measuring that.
  const points = Object.values(BATTLE_LANDMARKS);
  const has = (x, y) => points.some((point) => Math.abs(point.x - x) < 0.001 && Math.abs(point.y - y) < 0.001);
  const lanes = ["westApproach", "eastApproach", "westWorks", "eastGantry", "westNorth", "eastNorth"];
  for (const name of lanes) {
    const point = landmark(name);
    assert.ok(point, `${name} is not on the board`);
    assert.ok(has(100 - point.x, point.y), `${name} has no mirror across the centre column`);
  }
  // And the flank lanes really are outside the centre one.
  assert.ok(landmark("westApproach").x < landmark("centreSouth").x - 20);
  assert.ok(landmark("eastApproach").x > landmark("centreSouth").x + 20);
});

test("a route resolves to points, and unknown ground is dropped rather than becoming the origin", () => {
  assert.deepEqual(resolveRoute(["reactor"]), [{ x: 50, y: 50 }]);
  assert.deepEqual(resolveRoute([]), []);
  // A typo must not put a formation at (0, 0) and silently walk it off the board.
  const withTypo = resolveRoute(["centreSouth", "raector", "reactor"]);
  assert.equal(withTypo.length, 2);
  assert.equal(withTypo.every((point) => point.x > 0 && point.y > 0), true);
  assert.equal(landmark("not-real-ground"), null);
  // Resolving twice gives independent points, so a walking unit cannot mutate the map.
  const first = resolveRoute(["reactor"]);
  first[0].x = 999;
  assert.equal(resolveRoute(["reactor"])[0].x, 50);
});

test("a formation walks its route rather than the straight line to the objective", () => {
  // The whole point of a plan: the flanking formation is genuinely not in the centre when
  // the shooting starts, and it pays for that in distance.
  const slot = CIRCUIT_CLASH.playerDeployment[0];
  const flanking = deployUnit({ formationId: "railjack", name: "FLANK", position: slot });
  const direct = deployUnit({ formationId: "railjack", name: "DIRECT", position: slot });
  const result = resolveBattle({
    playerUnits: [flanking], enemyUnits: [], objectives, rounds: 3,
    playerPaths: { railjack: resolveRoute(["westGate", "westApproach", "westWorks"]) },
    playerOrders: {}, enemyOrders: {},
  });
  const straight = resolveBattle({
    playerUnits: [direct], enemyUnits: [], objectives, rounds: 3,
    playerOrders: { railjack: "west-works" }, enemyOrders: {},
  });
  const at = (battle) => battle.rounds.at(-1).players[0];
  assert.notEqual(`${at(result).x.toFixed(2)},${at(result).y.toFixed(2)}`, `${at(straight).x.toFixed(2)},${at(straight).y.toFixed(2)}`);
  // The route goes wide first, so after three rounds it is further west than the beeline.
  assert.ok(at(result).x < at(straight).x, "the flanking route did not actually go wide");
});

test("leftover movement carries into the next leg instead of stopping at every corner", () => {
  // A unit that stopped short at each waypoint would make every multi-leg plan slower in
  // proportion to how many corners it has, which is an accident, not a design.
  const slot = { x: 50, y: 95 };
  const unit = deployUnit({ formationId: "skimmer", name: "FAST", position: slot });
  const cornered = resolveBattle({
    playerUnits: [unit], enemyUnits: [], objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {},
    playerPaths: { skimmer: resolveRoute(["southRelay", "centreSouth", "reactor"]) },
  }).rounds[0].players[0];
  // Move 22, doubled on the opening round: it clears both corners and reaches the Reactor.
  assert.ok(cornered.y <= 51, `stopped at ${cornered.y.toFixed(1)} instead of carrying through the corners`);
});

test("a formation that runs out of route stops there and does not drift", () => {
  const unit = deployUnit({ formationId: "skimmer", name: "FAST", position: { x: 50, y: 95 } });
  const result = resolveBattle({
    playerUnits: [unit], enemyUnits: [], objectives: [], rounds: 5, playerOrders: {}, enemyOrders: {},
    playerPaths: { skimmer: resolveRoute(["southRelay"]) },
  });
  const finals = result.rounds.map((round) => `${round.players[0].x.toFixed(2)},${round.players[0].y.toFixed(2)}`);
  assert.equal(new Set(finals.slice(1)).size, 1, `the formation kept moving after its route ended: ${finals.join(" ")}`);
});

test("the enemy walks the same plan the player can declare, from the other edge", () => {
  // It beelined before, which arrived as a flat rank; then it walked five hand-authored
  // routes, which made its orders the measuring instrument for the whole balance. Now it
  // declares a plan out of the same table, and the mirror is what makes one authored plan
  // mean the same thing to both armies.
  assert.ok(Object.keys(enemy.paths).length > 0, "the enemy army has no routes at all");
  assert.equal(enemy.plan.id, IRON_PROCESSION.plan);
  const plan = planFor(IRON_PROCESSION.disposition, IRON_PROCESSION.plan);
  enemy.units.forEach((unit, index) => {
    const ours = routePointsFor(plan, index, CIRCUIT_CLASH.id);
    const theirs = enemy.paths[unit.id];
    assert.equal(theirs.length, ours.length, `${unit.name} walks a different number of waypoints than the plan has`);
    // Point for point, exactly reflected about the centre line. Anything less and a lane
    // quietly favours one edge, which is the whole reason the boards are mirrored.
    ours.forEach((point, step) => {
      assert.equal(theirs[step].x, point.x, `${unit.name} step ${step} is not the mirror`);
      assert.equal(theirs[step].y, 100 - point.y, `${unit.name} step ${step} is not the mirror`);
    });
  });
  // And its routes stay in its own half on the way in.
  for (const [id, route] of Object.entries(enemy.paths)) {
    assert.ok(route.slice(0, -1).every((point) => point.y <= 50), `${id} crosses into the player's half on the way in`);
  }
});

test("a plan's destination is derived from where its route ends", () => {
  // Declaring the objective separately would let a plan claim ground its own path never
  // reaches, which is exactly the sort of thing nobody notices for months.
  const spear = planFor("dominion", "spear");
  spear.routes.forEach((unused, index) => {
    const destination = routeDestinationFor(spear, index, objectives);
    if (!destination) return;
    const target = objectives.find((objective) => objective.id === destination);
    const end = routePointsFor(spear, index).at(-1);
    assert.ok(Math.hypot(target.x - end.x, target.y - end.y) < 1, `${destination} is not where slot ${index} stops`);
  });
  // Ground that is not an objective is honestly reported as holding nothing.
  assert.equal(routeDestinationFor({ routes: [["centreSouth"]] }, 0, objectives), null);
  assert.equal(routeDestinationFor(null, 0, objectives), null);
});

test("building a force from a plan gives every staffed slot its route", () => {
  const deployment = {
    p1: { formationId: "railjack" }, p2: { formationId: "furnace" }, p3: { formationId: "breaker" },
  };
  const built = buildPlayerForce({ deployment, formations: FORMATIONS, battlePlan: planFor("dominion", "trapline") });
  assert.equal(built.units.length, 3);
  assert.equal(Object.keys(built.paths).length, 3);
  assert.equal(built.orders.railjack, "west-works", "the plan's destination did not become the order");
  // An explicit override beats the plan, because the plan is the opening position of the
  // argument and not the end of it.
  const overridden = buildPlayerForce({
    deployment: { p1: { formationId: "railjack", objectiveId: "reactor" } },
    formations: FORMATIONS, battlePlan: planFor("dominion", "trapline"),
  });
  assert.equal(overridden.orders.railjack, "reactor");
  // With no plan at all it still builds, and nobody has a route.
  const bare = buildPlayerForce({ deployment, formations: FORMATIONS });
  assert.deepEqual(bare.paths, {});
});

test("a detachment rule is in force every round rather than spent", () => {
  const list = ["railjack", "furnace", "breaker", "command", "skimmer"];
  const play = (rule) => {
    const units = list.map((formationId, index) => deployUnit({
      formationId, name: nameById.get(formationId), position: CIRCUIT_CLASH.playerDeployment[index],
    }));
    return resolveBattle({
      playerUnits: units, enemyUnits: enemy.units, objectives,
      playerOrders: {}, enemyOrders: enemy.orders, enemyPaths: enemy.paths,
      playerPaths: Object.fromEntries(list.map((formationId, index) => [formationId, routePointsFor(planFor("dominion", "spear"), index)])),
      playerDetachmentRule: rule,
    });
  };
  const bare = play(null);
  for (const detachment of detachmentList()) {
    const withRule = play(detachment.rule);
    // BOTH sides. RANGING OATH improves the player's shooting, so what it changes first is
    // the ENEMY's wounds; reading only the player's caught it by knock-on, which is a
    // coincidence dressed as an assertion.
    const boardOf = (battle) => battle.rounds.map((round) => [
      round.players.map((unit) => unit.wounds), round.enemies.map((unit) => unit.wounds),
    ]);
    assert.notDeepEqual(boardOf(withRule), boardOf(bare), `${detachment.id}'s rule changed nothing on the board`);
  }
  // And it is not a one-round effect: the very first round already differs.
  const armoured = play(DETACHMENTS.voidbreaker.rule);
  const firstShooting = armoured.rounds.findIndex((round) => round.log.some((entry) => entry.side === "enemy"));
  assert.ok(firstShooting >= 0);
  assert.notDeepEqual(armoured.rounds[firstShooting].players, bare.rounds[firstShooting].players);
});

test("every detachment is a whole army: a rule, a pool, a budget and a gate", () => {
  for (const entry of detachmentList()) {
    assert.ok(entry.rule?.name && entry.rule?.text, `${entry.id} has no army rule`);
    assert.ok(entry.rule.effect && Object.keys(entry.rule.effect).length > 0, `${entry.id}'s rule does nothing`);
    assert.ok(entry.pool.length >= 3, `${entry.id} has too small a stratagem pool to choose from`);
    assert.ok(entry.commandPoints > 0);
    assert.ok(entry.dispositions.length >= 2);
  }
  // The rules have to differ, or the detachments are the same army with three names.
  const rules = detachmentList().map((entry) => JSON.stringify(entry.rule.effect));
  assert.equal(new Set(rules).size, rules.length, "two detachments have the same army rule");
  // So do the pools.
  const pools = detachmentList().map((entry) => [...entry.pool].sort().join("+"));
  assert.equal(new Set(pools).size, pools.length, "two detachments offer the same stratagems");
  assert.equal(detachmentFor("not-a-detachment").id, "voidbreaker");
});

test("the nine plans are nine different battles", () => {
  const list = ["railjack", "furnace", "breaker", "command", "skimmer"];
  const outcomes = new Set();
  for (const dispositionId of Object.keys(BATTLE_PLANS)) {
    for (const battlePlan of plansFor(dispositionId)) {
      const units = list.map((formationId, index) => deployUnit({
        formationId, name: nameById.get(formationId), position: CIRCUIT_CLASH.playerDeployment[index],
      }));
      const result = resolveBattle({
        playerUnits: units, enemyUnits: enemy.units, objectives,
        playerOrders: {}, enemyOrders: enemy.orders, enemyPaths: enemy.paths,
        playerPaths: Object.fromEntries(list.map((formationId, index) => [formationId, routePointsFor(battlePlan, index)])),
        playerDisposition: dispositionId, enemyDisposition: IRON_PROCESSION.disposition,
      });
      outcomes.add(result.rounds.at(-1).players.map((unit) => `${unit.x.toFixed(0)},${unit.y.toFixed(0)}`).join("|"));
    }
  }
  // Two plans may legitimately score the same; none may put the army in the same place.
  assert.ok(outcomes.size >= 7, `nine plans produced only ${outcomes.size} distinct final positions`);
});
