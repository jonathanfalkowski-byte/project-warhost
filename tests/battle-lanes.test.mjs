import test from "node:test";
import assert from "node:assert/strict";

import { BATTLE_PLANS, fillLanes, laneFillFor, laneTotal, plansFor, routeDestinationFor, routePointsFor } from "../src/battle/battlePlans.js";
import { CIRCUIT_CLASH } from "../src/battle/battleMission.js";

// A plan is lanes now rather than one route per deployment slot. The conversion has to be
// EXACTLY what was there before at the size the plans were written for, or every balance
// number in the project is measuring a different game than the one that produced them.

// The nine plans as they were, frozen. Not derived from the source — a guard that reads the
// thing it is guarding proves nothing.
const AS_WRITTEN = {
  "dominion/trapline": [
    ["westGate", "westApproach", "westWorks"], ["southWest", "southRelay"], ["centreSouth", "reactor"],
    ["southEast", "eastApproach", "eastGantry"], ["eastGate", "eastApproach", "eastGantry"],
  ],
  "dominion/spear": [
    ["southWest", "southRelay"], ["centreSouth", "reactor"], ["centreSouth", "reactor"],
    ["centreSouth", "reactor"], ["southEast", "eastApproach", "eastGantry"],
  ],
  "dominion/pressure": [
    ["westGate", "westApproach", "westWorks"], ["westGate", "westApproach", "westWorks"], ["southRelay"],
    ["eastGate", "eastApproach", "eastGantry"], ["eastGate", "eastApproach", "eastGantry"],
  ],
  "eradication/headhunt": [
    ["southWest", "westApproach", "westWorks"], ["centreSouth", "reactor"], ["centreSouth", "reactor"],
    ["centreSouth", "reactor"], ["southEast", "eastApproach", "eastGantry"],
  ],
  "eradication/decapitate": [
    ["southWest", "centreSouth", "reactor"], ["centreSouth", "reactor"], ["centreSouth", "reactor", "centreNorth"],
    ["centreSouth", "reactor", "centreNorth"], ["southEast", "centreSouth", "reactor"],
  ],
  "eradication/crossfire": [
    ["southWest", "centreSouth"], ["centreSouth", "reactor"], ["centreSouth", "reactor"],
    ["southEast", "centreSouth"], ["southEast", "eastApproach", "eastGantry"],
  ],
  "safeguard/home-line": [
    ["westGate", "westApproach", "westWorks"], ["southWest", "southRelay"], ["southRelay"],
    ["southEast", "eastApproach", "eastGantry"], ["eastGate", "eastApproach", "eastGantry"],
  ],
  "safeguard/tight-shell": [
    ["southWest", "southRelay"], ["southWest", "southRelay"], ["southRelay"],
    ["centreSouth", "reactor"], ["southEast", "centreSouth", "reactor"],
  ],
  "safeguard/counterweight": [
    ["westGate", "westApproach", "westWorks"], ["southWest", "southRelay"], ["southRelay"],
    ["centreSouth", "reactor"], ["eastGate", "eastApproach", "eastGantry"],
  ],
};

test("every plan is exactly what it was, at the size it was written for", () => {
  let checked = 0;
  for (const [disposition, plans] of Object.entries(BATTLE_PLANS)) {
    for (const plan of plans) {
      const expected = AS_WRITTEN[`${disposition}/${plan.id}`];
      assert.ok(expected, `${disposition}/${plan.id} is a plan the guard does not know about`);
      assert.deepEqual(fillLanes(plan.lanes, laneTotal(plan.lanes)), expected, `${plan.id} converted to lanes wrongly`);
      assert.deepEqual(plan.routes, expected, `${plan.id}.routes no longer reads as it did`);
      checked += 1;
    }
  }
  assert.equal(checked, Object.keys(AS_WRITTEN).length, "a plan was added or removed without the guard being told");
});

test("a plan keeps its shape at any size", () => {
  for (const plans of Object.values(BATTLE_PLANS)) {
    for (const plan of plans) {
      const total = laneTotal(plan.lanes);
      for (const size of [1, 2, 3, 5, 7, 8, 11, 12, 16]) {
        const filled = fillLanes(plan.lanes, size);
        assert.equal(filled.length, size, `${plan.id} walked ${filled.length} routes for an army of ${size}`);
        // Every lane it still has is staffed, and no lane is dropped while there is an
        // army wide enough to staff it.
        const share = laneFillFor(plan.lanes, size);
        assert.ok(share.every((entry) => entry.count >= 1), `${plan.id} left a lane it kept with nobody in it`);
        if (size >= plan.lanes.length) {
          assert.equal(share.length, plan.lanes.length, `${plan.id} dropped a lane it had room for at ${size}`);
          // The heaviest lane stays the heaviest: doubling the army does not turn a column
          // into a line.
          const heaviest = plan.lanes.reduce((best, entry, index) => (entry.share > plan.lanes[best].share ? index : best), 0);
          const fattest = share.reduce((best, entry, index) => (entry.count > share[best].count ? index : best), 0);
          assert.equal(share[fattest].count >= share[heaviest].count, true, `${plan.id} put its weight somewhere else at ${size}`);
        } else {
          assert.equal(share.length, size, `${plan.id} kept more lanes than it had formations at ${size}`);
        }
      }
      // Written for five, and the proportions hold: a lane with three of five shares takes
      // most of an army of eleven too.
      const doubled = laneFillFor(plan.lanes, total * 2);
      for (const entry of doubled) {
        assert.ok(entry.count >= entry.share, `${plan.id} shrank a lane when the army doubled`);
      }
    }
  }
});

test("a lane nobody can fill is dropped, and it is the lightest one", () => {
  // The plans in the game are close enough to even that the remainder always happens to
  // reach every lane, so this is measured on a deliberately lopsided one: ten shares down
  // one road and one down each of two others.
  const lopsided = [{ share: 10, route: ["reactor"] }, { share: 1, route: ["southRelay"] }, { share: 1, route: ["westWorks"] }];
  for (const size of [3, 4, 5, 6, 12]) {
    const share = laneFillFor(lopsided, size);
    assert.ok(share.every((entry) => entry.count >= 1), `a lane was kept with nobody in it at ${size}`);
    assert.equal(share.reduce((sum, entry) => sum + entry.count, 0), size);
  }
  // Below the number of lanes, what survives is the WEIGHT of the plan, not the first
  // thing written down: one formation walking SPEAR walks the Spine.
  assert.deepEqual(laneFillFor(lopsided, 1).map((entry) => entry.route), [["reactor"]]);
  assert.deepEqual(laneFillFor(lopsided, 2).map((entry) => entry.route), [["reactor"], ["southRelay"]]);
  const spear = plansFor("dominion").find((plan) => plan.id === "spear");
  assert.deepEqual(fillLanes(spear.lanes, 1), [["centreSouth", "reactor"]], "one formation under SPEAR did not walk the Spine");
});

test("the ground a formation is sent to comes from the size of the army it is in", () => {
  // SPEAR is three fifths of whatever it has on the Spine. At five that is slots two,
  // three and four; at ten it is six formations, and the plan still reads as a column.
  const spear = plansFor("dominion").find((plan) => plan.id === "spear");
  const held = (size) => Array.from({ length: size }, (unused, index) => routeDestinationFor(spear, index, CIRCUIT_CLASH.objectives, CIRCUIT_CLASH.id, false, size));
  const atFive = held(5);
  assert.equal(atFive.filter((id) => id === "reactor").length, 3);
  const atTen = held(10);
  assert.equal(atTen.length, 10);
  assert.ok(atTen.filter((id) => id === "reactor").length >= 5, `an army of ten put ${atTen.filter((id) => id === "reactor").length} on the Spine`);
  // And left out entirely, it is still the plan as authored — every existing caller.
  assert.deepEqual(Array.from({ length: 5 }, (unused, index) => routePointsFor(spear, index, CIRCUIT_CLASH.id)),
    Array.from({ length: 5 }, (unused, index) => routePointsFor(spear, index, CIRCUIT_CLASH.id, false, 5)));
});

test("a part-strength army walks the whole plan, not the middle of it", async () => {
  // Three formations under a plan written for five used to take slots two, three and four
  // of it — a slice out of the middle of a doctrine rather than the doctrine at three
  // fifths strength. Under TRAPLINE that meant an army that never went near either flank.
  const { buildEnemyForce, buildPlayerForce, armyFor } = await import("../src/battle/battleMission.js");
  const { FORMATIONS } = await import("../src/formationData.js");
  const trapline = plansFor("dominion").find((plan) => plan.id === "trapline");
  const held = (units, orders) => new Set(units.map((unit) => orders[unit.id]));

  const spear = plansFor("dominion").find((plan) => plan.id === "spear");
  const foe = buildEnemyForce(CIRCUIT_CLASH, armyFor(CIRCUIT_CLASH.id), { disposition: "dominion", planId: "spear", strength: 3, seed: 0 });
  assert.equal(foe.units.length, 3);
  assert.equal(held(foe.units, foe.orders).size, 3, "a three-formation enemy sent everything to the same ground");
  // Exactly the plan at that size, in order — not three routes out of a plan for five.
  assert.deepEqual(
    foe.units.map((unit) => foe.orders[unit.id]),
    [0, 1, 2].map((index) => routeDestinationFor(spear, index, CIRCUIT_CLASH.objectives, CIRCUIT_CLASH.id, true, 3)),
    "a part-strength enemy was ordered to a slice out of the middle of its doctrine",
  );
  foe.units.forEach((unit, index) => {
    assert.deepEqual(foe.paths[unit.id], routePointsFor(spear, index, CIRCUIT_CLASH.id, true, 3),
      "a part-strength enemy walked a slice out of the middle of its doctrine");
  });

  // The player's half of the same claim: three filled slots, three different lanes.
  const deployment = {};
  ["p1", "p3", "p5"].forEach((slotId, index) => {
    const formation = FORMATIONS[index];
    deployment[slotId] = { id: `${formation.id}#${index}`, formationId: formation.id, name: formation.name };
  });
  const force = buildPlayerForce({ mission: CIRCUIT_CLASH, deployment, formations: FORMATIONS, battlePlan: trapline });
  assert.equal(force.units.length, 3);
  assert.equal(held(force.units, force.orders).size, 3, "three formations under TRAPLINE walked to the same marker");
  force.units.forEach((unit, index) => {
    assert.deepEqual(force.paths[unit.id], routePointsFor(trapline, index, CIRCUIT_CLASH.id, false, 3),
      "a part-strength warband walked a slice out of the middle of its plan");
  });
  // And at full strength it is untouched: five slots, the five routes as authored.
  const full = {};
  CIRCUIT_CLASH.playerDeployment.forEach((slot, index) => {
    const formation = FORMATIONS[index];
    full[slot.id] = { id: `${formation.id}#${index}`, formationId: formation.id, name: formation.name };
  });
  const whole = buildPlayerForce({ mission: CIRCUIT_CLASH, deployment: full, formations: FORMATIONS, battlePlan: trapline });
  whole.units.forEach((unit, index) => {
    assert.deepEqual(whole.paths[unit.id], routePointsFor(trapline, index, CIRCUIT_CLASH.id, false, 5));
  });
});
