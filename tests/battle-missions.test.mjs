import test from "node:test";
import assert from "node:assert/strict";

import { CIRCUIT_LANDMARKS, LANDMARK_TABLES, landmarksFor, resolveRoute } from "../src/battle/battleTerrain.js";
import { ARMIES, CIRCUIT_CLASH, THE_NARROWS, armyFor, buildEnemyForce, buildPlayerForce, missionFor, missionList } from "../src/battle/battleMission.js";
import { BATTLE_PLANS, plansFor, routeDestinationFor, routePointsFor } from "../src/battle/battlePlans.js";
import { DETACHMENTS } from "../src/battle/stratagems.js";
import { DISPOSITIONS } from "../src/battle/doctrine.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { FORMATIONS } from "../src/formationData.js";

const nameById = new Map(FORMATIONS.map((formation) => [formation.id, formation.name]));

test("every board names the same ground, so one plan can be played on any of them", () => {
  // The landmark names are ROLES, not places. That is the whole mechanism by which the
  // nine authored plans travel between missions — and the only real test of whether they
  // are doctrine or were overfitted to the board they were written on.
  const tables = Object.values(LANDMARK_TABLES);
  const roles = Object.keys(CIRCUIT_LANDMARKS).sort().join(",");
  for (const table of tables) {
    assert.equal(Object.keys(table).sort().join(","), roles, "a board names different ground from the others");
  }
  assert.ok(tables.length >= 2, "there is only one board, so nothing is being tested");
  // Unknown boards fall back rather than throwing.
  assert.deepEqual(landmarksFor("not-a-mission"), CIRCUIT_LANDMARKS);
});

test("every board's lanes are mirrored left to right", () => {
  // A lane that exists on one flank and not the other makes one half of every plan better
  // than the other half, and every balance number then measures that instead of the plan.
  for (const [missionId, table] of Object.entries(LANDMARK_TABLES)) {
    for (const [name, point] of Object.entries(table)) {
      const mirrored = Object.values(table).some((other) => (
        Math.abs(other.x - (100 - point.x)) < 0.001 && Math.abs(other.y - point.y) < 0.001
      ));
      assert.ok(mirrored, `${missionId}: ${name} has no mirror on the other flank`);
    }
  }
});

test("every mission is fair, and they are genuinely different boards", () => {
  for (const mission of missionList()) {
    assert.ok(mission.objectives.length >= 3, `${mission.id} has almost no objectives`);
    // Mirror symmetry about the centre line: neither army has the better half.
    for (const objective of mission.objectives) {
      const mirror = mission.objectives.find((other) => (
        other.x === objective.x && other.y === 100 - objective.y && other.points === objective.points
      ));
      assert.ok(mirror, `${mission.id}: ${objective.name} has no mirror`);
    }
    const half = (test) => mission.objectives.filter(test).reduce((sum, objective) => sum + objective.points, 0);
    assert.equal(half((objective) => objective.y > 50), half((objective) => objective.y < 50), `${mission.id} is lopsided`);
    assert.ok(Math.min(...mission.playerDeployment.map((slot) => slot.y)) > 80, `${mission.id}: the player does not deploy on its own edge`);
    assert.ok(Math.max(...mission.enemyDeployment.map((slot) => slot.y)) < 20, `${mission.id}: the enemy does not deploy opposite`);
  }
  // Same points on offer, different ground: the variable between boards is the geometry.
  const total = (mission) => mission.objectives.reduce((sum, objective) => sum + objective.points, 0);
  assert.equal(total(CIRCUIT_CLASH), total(THE_NARROWS), "the two boards are not worth the same");
  const spread = (mission) => Math.max(...mission.objectives.map((objective) => objective.y))
    - Math.min(...mission.objectives.map((objective) => objective.y));
  assert.ok(spread(THE_NARROWS) < spread(CIRCUIT_CLASH) * 0.8, "the second board is not actually a tighter one");
});

test("each board has its own enemy army, fielded from a detachment it is allowed", () => {
  for (const mission of missionList()) {
    const army = armyFor(mission.id);
    assert.ok(army, `${mission.id} has no enemy`);
    const detachment = Object.values(DETACHMENTS).find((entry) => entry.id === army.detachment)
      ?? DETACHMENTS[army.detachment];
    assert.ok(detachment, `${mission.id}: ${army.name} fields an unknown detachment`);
    assert.ok(detachment.dispositions.includes(army.disposition), `${army.name} may not declare ${army.disposition}`);
    // Every hull has a name in this doctrine, because the list is built per engagement now
    // and any of them can be fielded. A name attached to a slot instead of a hull would go
    // wrong the first time the list changed.
    for (const formation of FORMATIONS) {
      assert.ok(army.names?.[formation.id], `${army.name} has no name for its ${formation.id}`);
    }
    assert.equal(new Set(Object.values(army.names)).size, Object.keys(army.names).length,
      `${army.name} calls two hulls the same thing`);
    // Its plan comes from the same table the player picks from, and its disposition has to
    // offer it. Five hand-authored routes and targets per army is what made the enemy's
    // orders load-bearing for the entire balance — every axis of the sweep measures the
    // player against this army, so those lines were the measuring instrument.
    assert.ok(plansFor(army.disposition).some((entry) => entry.id === army.plan),
      `${army.name} declares ${army.disposition} and plays ${army.plan}, which is not one of its plans`);
    const force = buildEnemyForce(mission, army);
    assert.equal(force.units.length, mission.enemyDeployment.length, `${army.name} does not fill its deployment`);
    assert.equal(new Set(force.units.map((unit) => unit.id)).size, force.units.length, `${army.name} fields the same hull twice`);
    for (const unit of force.units) {
      assert.ok(mission.objectives.some((objective) => objective.id === force.orders[unit.id]), `${unit.name} advances on nothing`);
      assert.ok(force.paths[unit.id]?.length > 0, `${unit.name} has no route`);
      // It stays in its own half on the way in. The board is mirrored, so a plan that
      // crossed the centre line before reaching its ground would be reaching across.
      const [...walked] = force.paths[unit.id];
      const arrival = walked.at(-1);
      assert.ok(walked.slice(0, -1).every((point) => point.y <= 50),
        `${unit.name} crosses into the player's half on the way in`);
      assert.ok(arrival.y <= 50 + 1e-9, `${unit.name} ends up in the player's half`);
    }
  }
  // The two doctrines must actually differ, or the second board is the first with new
  // labels. They no longer differ by roster — the list is built per engagement — so what
  // has to differ is the doctrine: who they are and what they are allowed to declare.
  const doctrines = Object.values(ARMIES).map((army) => `${army.detachment}/${army.name}`);
  assert.equal(new Set(doctrines).size, doctrines.length, "two boards field the same enemy doctrine");
  const named = Object.values(ARMIES).map((army) => Object.values(army.names).sort().join("+"));
  assert.equal(new Set(named).size, named.length, "two boards call their formations the same things");
});

test("the same plan resolves to different ground on a different board", () => {
  for (const dispositionId of Object.keys(BATTLE_PLANS)) {
    for (const battlePlan of plansFor(dispositionId)) {
      const onCircuit = battlePlan.routes.map((unused, index) => routePointsFor(battlePlan, index, "circuit-clash"));
      const onNarrows = battlePlan.routes.map((unused, index) => routePointsFor(battlePlan, index, "narrows"));
      onCircuit.forEach((route, index) => {
        assert.equal(route.length, onNarrows[index].length, `${battlePlan.id} slot ${index} loses a waypoint between boards`);
        assert.equal(route.length, battlePlan.routes[index].length, `${battlePlan.id} slot ${index} routes through unnamed ground`);
      });
      assert.notDeepEqual(onCircuit, onNarrows, `${battlePlan.id} resolves identically on both boards`);
    }
  }
});

test("a plan reaches real objectives on every board it is played on", () => {
  for (const mission of missionList()) {
    for (const dispositionId of Object.keys(BATTLE_PLANS)) {
      for (const battlePlan of plansFor(dispositionId)) {
        const held = battlePlan.routes
          .map((unused, index) => routeDestinationFor(battlePlan, index, mission.objectives, mission.id))
          .filter(Boolean);
        assert.ok(held.length > 0, `${mission.id}: ${dispositionId}/${battlePlan.id} reaches no objective`);
        held.forEach((id) => assert.ok(mission.objectives.some((objective) => objective.id === id)));
      }
    }
  }
});

test("no route on any board is longer than a formation can walk", () => {
  // A route nobody finishes spends a whole deployment slot on someone still walking when
  // the battle ends. It has to hold on the tighter board as well as the wide one.
  for (const mission of missionList()) {
    const reachable = 11 * (mission.rounds + 1);
    for (const dispositionId of Object.keys(BATTLE_PLANS)) {
      for (const battlePlan of plansFor(dispositionId)) {
        battlePlan.routes.forEach((unused, index) => {
          const start = mission.playerDeployment[index];
          const points = routePointsFor(battlePlan, index, mission.id);
          const walked = points.reduce((sum, point, step) => {
            const previous = step === 0 ? start : points[step - 1];
            return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
          }, 0);
          assert.ok(walked <= reachable, `${mission.id}: ${battlePlan.id} slot ${index} is a ${walked.toFixed(0)} unit walk against ${reachable}`);
        });
      }
    }
  }
});

test("a battle on the second board resolves, scores and is repeatable", () => {
  const mission = THE_NARROWS;
  const foe = buildEnemyForce(mission);
  const deployment = Object.fromEntries(mission.playerDeployment.map((slot, index) => [
    slot.id, { formationId: ["railjack", "furnace", "breaker", "command", "skimmer"][index] },
  ]));
  const play = () => {
    const built = buildPlayerForce({ mission, deployment, formations: FORMATIONS, battlePlan: plansFor("dominion")[0] });
    return resolveBattle({
      playerUnits: built.units, enemyUnits: foe.units, objectives: mission.objectives,
      playerOrders: built.orders, enemyOrders: foe.orders,
      playerPaths: built.paths, enemyPaths: foe.paths,
      playerDisposition: "dominion", enemyDisposition: armyFor(mission.id).disposition,
      rounds: mission.rounds,
    });
  };
  const result = play();
  assert.equal(result.rounds.length, mission.rounds);
  assert.ok(result.playerScore > 0, "nobody scored anything on the second board");
  assert.deepEqual(play().rounds, result.rounds, "the second board is not deterministic");
  // The tighter board puts the armies in contact sooner than the wide one does.
  const firstShot = (battle) => battle.rounds.findIndex((round) => round.log.some((entry) => entry.phase === "shoot"));
  assert.ok(firstShot(result) <= 1, `contact only happened in round ${firstShot(result) + 1}`);
});

test("declaring a disposition changes the board for that side only", () => {
  const mission = CIRCUIT_CLASH;
  const foe = buildEnemyForce(mission);
  const deployment = Object.fromEntries(mission.playerDeployment.map((slot, index) => [
    slot.id, { formationId: ["railjack", "furnace", "breaker", "command", "skimmer"][index] },
  ]));
  const play = (playerDisposition) => {
    const built = buildPlayerForce({ mission, deployment, formations: FORMATIONS, battlePlan: plansFor(playerDisposition)[0] });
    return resolveBattle({
      playerUnits: built.units, enemyUnits: foe.units, objectives: mission.objectives,
      playerOrders: built.orders, enemyOrders: foe.orders, playerPaths: built.paths, enemyPaths: foe.paths,
      playerDisposition, enemyDisposition: "dominion",
    });
  };
  const dominion = play("dominion");
  const eradication = play("eradication");
  // Under ERADICATION no marker pays the player, so its score comes entirely from damage.
  assert.equal(
    eradication.rounds.every((round) => round.objectives.length === mission.objectives.length), true,
    "the markers stopped being tracked rather than stopping paying",
  );
  // Round by round: two dispositions can land on the same total by coincidence out of one
  // fixture, and never earn it the same way.
  assert.notDeepEqual(
    dominion.rounds.map((round) => round.playerGained),
    eradication.rounds.map((round) => round.playerGained),
  );
  // The enemy's board never changed: it is still scoring every marker it holds.
  assert.ok(dominion.enemyScore > 0 && eradication.enemyScore > 0);
});
