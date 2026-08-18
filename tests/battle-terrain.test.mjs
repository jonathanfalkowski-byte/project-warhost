import test from "node:test";
import assert from "node:assert/strict";

import {
  TERRAIN_KINDS,
  coverScaleAt,
  crossesTerrain,
  mirrorPoint,
  moveScaleBetween,
  routeCost,
  sightBlocked,
  terrainAt,
  terrainFor,
  terrainKind,
} from "../src/battle/battleTerrain.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { CIRCUIT_CLASH, THE_NARROWS, missionList } from "../src/battle/battleMission.js";

const at = (formationId, x, y, id) => ({
  ...deployUnit({ formationId, name: id.toUpperCase(), position: { x, y } }), id,
});

test("no board, no terrain — a mission has to say which ground it is", () => {
  // Deliberately not defaulting to a board. A caller that forgets gets a flat plain, which
  // is obvious the first time anyone looks, rather than the Circuit's slag heaps quietly
  // turning up on the Narrows.
  assert.deepEqual(terrainFor(null), []);
  assert.deepEqual(terrainFor("not-a-board"), []);
  assert.deepEqual(terrainAt({ x: 50, y: 62 }, null), []);
  assert.equal(moveScaleBetween({ x: 50, y: 95 }, { x: 50, y: 50 }, null), 1);
  assert.equal(sightBlocked({ x: 22, y: 50 }, { x: 78, y: 50 }, null), false);
  assert.equal(coverScaleAt({ x: 22, y: 50 }, null), 1);
});

test("the ground is a mirror of itself, so neither edge is the better one", () => {
  for (const mission of missionList()) {
    const features = terrainFor(mission.id);
    assert.ok(features.length > 0, `${mission.id} has no terrain at all`);
    for (const feature of features) {
      const twin = features.find((other) => other.kind === feature.kind
        && other.x === feature.x && other.y === 100 - feature.y && other.radius === feature.radius);
      assert.ok(twin, `${feature.name} at ${feature.x},${feature.y} on ${mission.id} has no mirror`);
    }
    // Every feature is a kind the rules know about, and every kind names what it does.
    for (const feature of features) {
      assert.ok(terrainKind(feature.kind), `${feature.name} is a ${feature.kind}, which is not a kind of ground`);
      assert.ok(feature.name && feature.radius > 0, `${feature.name} is not a place`);
    }
    // No marker is buried: a formation standing on an objective must be able to stand on it.
    for (const objective of mission.objectives) {
      const blocked = terrainAt(objective, mission.id).filter((entry) => entry.kind === "blocking");
      assert.deepEqual(blocked, [], `${objective.name} is inside blocking terrain`);
    }
  }
  assert.deepEqual(mirrorPoint({ x: 20, y: 82 }), { x: 20, y: 18 });
  assert.equal(terrainKind("not-a-kind"), null);
});

test("broken ground is charged for CROSSING it, not for standing in it", () => {
  const mission = CIRCUIT_CLASH;
  const slag = terrainFor(mission.id).find((entry) => entry.kind === "broken");
  const before = { x: slag.x, y: slag.y + slag.radius + 6 };
  const beyond = { x: slag.x, y: slag.y - slag.radius - 6 };
  assert.equal(moveScaleBetween(before, beyond, mission.id), TERRAIN_KINDS.broken.moveScale);
  // A rule that only charged for standing in it would be free to anything fast enough to
  // clear the whole field in one move, which is exactly what ought to be paying.
  const clear = { x: 10, y: 90 };
  assert.equal(moveScaleBetween(clear, { x: 10, y: 60 }, mission.id), 1);
  // And the route cost reads it: the same distance is a longer walk through the slag.
  const across = routeCost(before, [beyond], mission.id);
  const open = routeCost(clear, [{ x: clear.x, y: clear.y - Math.hypot(beyond.x - before.x, beyond.y - before.y) }], mission.id);
  assert.ok(across > open, "crossing broken ground costs no more than crossing open ground");
});

test("a formation crossing the slag genuinely arrives later", () => {
  const mission = CIRCUIT_CLASH;
  const slag = terrainFor(mission.id).find((entry) => entry.kind === "broken" && entry.y > 50);
  // Straight down the lane the slag sits in, at the marker beyond it.
  const start = { x: slag.x, y: 90 };
  const march = (missionId) => resolveBattle({
    playerUnits: [{ ...deployUnit({ formationId: "harpoon", name: "RUNNER", position: start }), id: "runner" }],
    enemyUnits: [{ ...deployUnit({ formationId: "bastion", name: "WALL", position: { x: slag.x, y: 5 } }), id: "enemy-wall" }],
    objectives: mission.objectives, rounds: 2,
    playerOrders: { runner: "west-works" }, enemyOrders: {}, missionId,
  }).rounds.at(-1).players[0].y;
  assert.ok(march(mission.id) > march(null), "the slag cost the advance nothing");

  // And the same again for a formation WALKING AN AUTHORED ROUTE rather than beelining.
  // Those are two different code paths — a plan walks waypoints, an order beelines — and a
  // plan that ignored the ground would be the more expensive one to get wrong, because
  // every plan in the game is authored against this terrain.
  const walked = (missionId) => resolveBattle({
    playerUnits: [{ ...deployUnit({ formationId: "harpoon", name: "RUNNER", position: start }), id: "runner" }],
    enemyUnits: [{ ...deployUnit({ formationId: "bastion", name: "WALL", position: { x: slag.x, y: 5 } }), id: "enemy-wall" }],
    objectives: mission.objectives, rounds: 2,
    playerOrders: {}, enemyOrders: {}, missionId,
    playerPaths: { runner: [{ x: slag.x, y: slag.y }, { x: 22, y: 50 }] },
  }).rounds.at(-1).players[0].y;
  assert.ok(walked(mission.id) > walked(null), "the slag cost a walked route nothing");
});

test("nothing shoots through a stack, in either direction", () => {
  const mission = CIRCUIT_CLASH;
  const stack = terrainFor(mission.id).find((entry) => entry.kind === "blocking");
  const west = { x: stack.x - stack.radius - 4, y: stack.y };
  const east = { x: stack.x + stack.radius + 4, y: stack.y };
  assert.equal(sightBlocked(west, east, mission.id), true);
  assert.equal(sightBlocked(east, west, mission.id), true, "cover you can fire out of is a firing position");
  assert.equal(crossesTerrain(west, east, mission.id, "blocking"), true);
  // Round it, and the shot is on.
  assert.equal(sightBlocked(west, { x: east.x, y: east.y + 30 }, mission.id), false);

  // On the board: two gun lines either side of a stack, in range, and neither fires.
  const shots = (missionId) => resolveBattle({
    playerUnits: [at("railjack", west.x, west.y, "gun")],
    enemyUnits: [at("railjack", east.x, east.y, "enemy-gun")],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {}, missionId,
  }).rounds[0].log.filter((entry) => entry.phase === "shoot").length;
  assert.ok(shots(null) > 0, "the fixture is out of range even on a flat plain");
  assert.equal(shots(mission.id), 0, "a stack was shot straight through");
});

test("fire into cover is cut, and melee is not", () => {
  const mission = CIRCUIT_CLASH;
  const screen = terrainFor(mission.id).find((entry) => entry.kind === "cover");
  assert.equal(coverScaleAt(screen, mission.id), TERRAIN_KINDS.cover.damageScale);
  assert.equal(coverScaleAt({ x: screen.x, y: screen.y + screen.radius + 4 }, mission.id), 1);

  // Same shot, same range, one target in the screens and one beside them.
  const dealt = (target) => resolveBattle({
    playerUnits: [at("carriage", screen.x, screen.y + 34, "gun")],
    enemyUnits: [{ ...at("breaker", target.x, target.y, "enemy-target") }],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {}, missionId: mission.id,
  }).rounds[0].log.filter((entry) => entry.side === "player" && entry.phase === "shoot")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const inCover = dealt(screen);
  // Beside the screens on the OUTBOARD side, so the shot at it does not clip a stack.
  const inOpen = dealt({ x: screen.x - screen.radius - 5, y: screen.y });
  assert.ok(inCover > 0 && inOpen > 0, "one of the shots never happened");
  assert.ok(inCover < inOpen, "standing in cover was worth nothing");

  // Two formations in contact are in contact. A rule letting a screen stop a fight already
  // happening would be a rule about the screen rather than about the fight.
  const melee = (missionId) => resolveBattle({
    playerUnits: [at("breaker", screen.x, screen.y + 2, "axe")],
    enemyUnits: [at("breaker", screen.x, screen.y - 2, "enemy-axe")],
    objectives: [], rounds: 1, playerOrders: {}, enemyOrders: {}, missionId,
  }).rounds[0].log.filter((entry) => entry.phase === "fight").reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(melee(mission.id).toFixed(2), melee(null).toFixed(2), "cover changed a melee");
});

test("the two boards have different ground, or the second board is the first relabelled", () => {
  const shape = (missionId) => terrainFor(missionId)
    .map((entry) => `${entry.kind}@${entry.x},${entry.y}r${entry.radius}`).sort().join("|");
  assert.notEqual(shape(CIRCUIT_CLASH.id), shape(THE_NARROWS.id));
});
