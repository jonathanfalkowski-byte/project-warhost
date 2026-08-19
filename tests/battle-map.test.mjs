import test from "node:test";
import assert from "node:assert/strict";

import {
  ROUTES, ROUTES_OFFERED, RUN_LADDER, advance, applyBattle, engagementFor, routeFor, routesFor, startRun, takeRoute,
} from "../src/battle/campaign.js";

// The map. A run was five engagements in a fixed order with a shop between them; every
// engagement offers two or three roads to it now, and taking one throws the others away.

// Forced rather than taken: which roads a given engagement OFFERS is the subject of the
// test above, and this one is about what a road does once you are on it.
const withRoad = (run, id) => ({ ...run, route: id });

test("every engagement offers a choice, and one of them is the straight one", () => {
  for (let seed = 0; seed < 12; seed += 1) {
    let run = startRun({ seed });
    for (let battle = 0; battle < RUN_LADDER.length; battle += 1) {
      const offers = routesFor(run);
      assert.ok(offers.length >= 2, `battle ${battle + 1} of seed ${seed} offered ${offers.length} road(s)`);
      assert.equal(offers.length, Math.min(ROUTES_OFFERED, Object.keys(ROUTES).length));
      assert.equal(offers[0].id, "standing", "the standing battle is not on offer");
      assert.equal(new Set(offers.map((route) => route.id)).size, offers.length, "the same road was offered twice");
      // Deterministic: a run replays.
      assert.deepEqual(routesFor(run).map((route) => route.id), offers.map((route) => route.id));
      run = advance(run);
    }
  }
  // Across enough runs every road is reachable, or one of them is written and never played.
  const seen = new Set();
  for (let seed = 0; seed < 24; seed += 1) {
    let run = startRun({ seed });
    for (let battle = 0; battle < RUN_LADDER.length; battle += 1) {
      for (const route of routesFor(run)) seen.add(route.id);
      run = advance(run);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(ROUTES).sort(), "a road is written and never offered");
});

test("taking a road is a commitment", () => {
  const run = startRun({ seed: 2 });
  const offers = routesFor(run);
  const taken = takeRoute(run, offers[1].id);
  assert.equal(taken.route, offers[1].id);
  // Not revisited once taken — a choice you can change after seeing the enemy is a preview.
  assert.equal(takeRoute(taken, offers[0].id).route, offers[1].id, "the road was changed after it was taken");
  // And not a road this engagement never offered.
  const notOffered = Object.keys(ROUTES).find((id) => !offers.some((route) => route.id === id));
  if (notOffered) assert.equal(takeRoute(run, notOffered).route, null, "a road nobody offered was taken");
  // Marching on clears it, because the next engagement offers its own.
  assert.equal(advance({ ...taken, status: "active" }).route, null);
});

test("a road changes the engagement it leads to", () => {
  const run = startRun({ seed: 5 });
  const straight = engagementFor(withRoad(run, "standing"));
  assert.equal(straight.route.id, "standing");

  // SKIRMISH: fewer of them, and it pays less.
  const skirmish = engagementFor(withRoad(run, "skirmish"));
  assert.ok(skirmish.foe.units.length < straight.foe.units.length,
    `a skirmish fielded ${skirmish.foe.units.length} against the standing battle's ${straight.foe.units.length}`);
  assert.ok(skirmish.pays < 1);

  // WALK INTO IT: they hold one more card. The hand is the only hidden thing in the game,
  // so a road that adds to it is the one that actually raises the uncertainty.
  const ambush = engagementFor(withRoad(run, "ambush"));
  assert.equal(ambush.enemyHand.length, straight.enemyHand.length + 1);
  assert.ok(ambush.pays > 1);

  // FORCED MARCH: you field one fewer. The cost is on YOUR side of the board, which is the
  // only way a harder road can be harder while both armies have five positions.
  const march = engagementFor(withRoad(run, "march"));
  assert.equal(march.slots, straight.slots - 1);
  assert.ok(march.slots >= 3, "a road emptied the board");
  assert.ok(march.pays > 1);
  // And the enemy is unchanged by it — the price is yours, not theirs.
  assert.equal(march.foe.units.length, straight.foe.units.length);
});

test("what a road pays is what the run is paid", () => {
  const run = startRun({ seed: 7 });
  const result = { playerScore: 10, enemyScore: 4, rounds: [] };
  for (const id of Object.keys(ROUTES)) {
    const after = applyBattle({ run: withRoad(run, id), result, won: true, deployedIds: [], disposition: "dominion" });
    const record = after.history.at(-1);
    assert.equal(record.route, id, "the run does not remember which road it took");
    assert.equal(record.scored, 10, "what was scored on the board changed with the road");
    assert.equal(record.earned, Math.round(10 * routeFor(id).pays), `${id} paid ${record.earned}`);
    assert.equal(after.purse, run.purse + record.earned, "the purse was paid something other than what the record says");
  }
  // The straight road pays exactly what the board did, which is what every other axis of
  // the sweep is measured on.
  const straight = applyBattle({ run: withRoad(run, "standing"), result, won: true, deployedIds: [], disposition: "dominion" });
  assert.equal(straight.history.at(-1).earned, 10);
});

test("a harder road is worth more than an easier one", () => {
  // Not a balance claim — that is the sweep's map axis. This is the arithmetic one: the
  // roads that cost you something pay more than the one that does not, and the one that
  // hands you an advantage pays less. A road that took a price and paid the rate would be
  // a trap the screen describes as a choice.
  for (const route of Object.values(ROUTES)) {
    const costly = route.strengthStep > 0 || route.handStep > 0 || (route.slotStep ?? 0) < 0;
    const kind = route.strengthStep < 0 || route.handStep < 0 || (route.slotStep ?? 0) > 0;
    if (costly) assert.ok(route.pays > 1, `${route.name} costs something and pays the rate`);
    if (kind) assert.ok(route.pays < 1, `${route.name} hands you an advantage and pays full`);
    assert.ok(route.brief.length > 20, `${route.name} does not say what it is`);
  }
});
