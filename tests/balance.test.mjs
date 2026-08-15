import assert from "node:assert/strict";
import test from "node:test";

import { OPERATIONS } from "../src/operationData.js";
import { FORMATIONS, defaultRefits, resolveFormations } from "../src/formationData.js";
import { PLAYBOOKS, playbookForOperation } from "../src/playbookData.js";
import { missionPressureFor } from "../src/missionPressure.js";
import {
  calculatePlacementReadiness,
  evaluateTacticalSequence,
  summarizePlacementReadiness,
} from "../src/operationResolution.js";
import { sweepOperation, sweepRefitSpace, REFIT_SWEEP_ROSTER } from "../scripts/balance-sweep.mjs";

// The outcome pipeline is deterministic, so these resolve the entire decision space
// rather than sampling it: 120 formation permutations x 3 total-army plays x 3
// mission pressures x 4 authored branch combinations. About a second.
//
// These guard the design claims in AGENTS.md. They are intentionally loose — they
// assert the shape of the design, not tuned numbers, so ordinary balance work does not
// turn them red. Run `npm run analyse:balance` for the detailed picture, and see
// docs/balance.md for the findings that produced these guards.

const operation = OPERATIONS[0];
// Two axes, asserted separately. `rows` pins the roster to five so it isolates the
// ordering question; `listRows` opens the whole roster so it can answer the list
// question — which five to field — which is the larger decision.
const rows = sweepOperation(operation, { roster: REFIT_SWEEP_ROSTER });
const listRows = sweepOperation(operation);
const rate = (subset) => subset.filter((row) => row.won).length / subset.length;
const groupBy = (subset, key) => subset.reduce((acc, row) => { (acc[key(row)] ||= []).push(row); return acc; }, {});

test("the sweep resolves both decision axes in full", () => {
  assert.equal(rows.length, 4320, "ordering axis");
  // 126 ways to pick five of nine, each in 120 orders, across plays, pressures, branches.
  assert.equal(listRows.length, 544320, "list axis");
  assert.equal(new Set(listRows.map((row) => row.list)).size, 126);
});

test("resolution is deterministic", () => {
  // Everything below depends on this. A stray Math.random or Date.now would make the
  // sweep meaningless and the game unfair to reason about.
  assert.deepEqual(sweepOperation(operation, { roster: REFIT_SWEEP_ROSTER }), rows);
});

test("placement changes the outcome", () => {
  // AGENTS.md: "Moving a formation must be able to strengthen or break a plan."
  // A single outcome value everywhere would mean placement is decorative.
  const outcomes = new Set(rows.map((row) => row.extracted));
  assert.ok(outcomes.size >= 3, `expected a spread of extraction counts, got ${[...outcomes].join(", ")}`);
  const byOrder = Object.values(groupBy(rows, (row) => row.order)).map(rate);
  assert.ok(Math.max(...byOrder) - Math.min(...byOrder) > 0.1,
    "formation order barely changes the win rate, so placement is not a real decision");
});

test("no formation order is universally dominant", () => {
  // AGENTS.md: "never identify an optimal chain for the player". An order that won
  // everywhere would become the answer and end the puzzle.
  const byOrder = Object.entries(groupBy(rows, (row) => row.order)).map(([order, group]) => ({ order, win: rate(group) }));
  assert.deepEqual(byOrder.filter((entry) => entry.win === 1).map((entry) => entry.order), []);
  // Losing placements are correct — placement is supposed to be able to lose the
  // mission — but if most arrangements were hopeless the puzzle would be a needle hunt
  // rather than a decision.
  const hopeless = byOrder.filter((entry) => entry.win === 0).length;
  assert.ok(hopeless < byOrder.length * 0.25,
    `${hopeless} of ${byOrder.length} formation orders cannot win under any configuration`);
});

test("every fight is winnable with the right placement", () => {
  // The design rule: a player may bring a weak play into a bad matchup and still have a
  // route to victory through units and placement. No (pressure x play) pairing may be a
  // dead end. This is the strongest expression of "every fight should have a chance".
  const dead = [];
  for (const [pressure, byPressure] of Object.entries(groupBy(rows, (row) => row.pressure))) {
    for (const [play, group] of Object.entries(groupBy(byPressure, (row) => row.playbook))) {
      if (!group.some((row) => row.won)) dead.push(`${pressure} x ${play}`);
    }
  }
  assert.deepEqual(dead, [], `matchups no placement can win: ${dead.join(", ")}`);
});

test("placement decides more than the choice of play", () => {
  // The core requirement: the outcome must depend on units and placement, not on
  // looking up the right total-army play for the situation. Measured as how far the
  // extraction count moves when only placement changes, against how far it moves when
  // only the play changes.
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const spread = (group) => Math.max(...group.map((r) => r.extracted)) - Math.min(...group.map((r) => r.extracted));
  const pressures = [...new Set(rows.map((r) => r.pressure))];
  const branches = [...new Set(rows.map((r) => r.branches))];
  const plays = [...new Set(rows.map((r) => r.playbook))];
  const orders = [...new Set(rows.map((r) => r.order))];
  const placementSwing = [];
  const playSwing = [];
  for (const pressure of pressures) {
    for (const branch of branches) {
      const scoped = rows.filter((r) => r.pressure === pressure && r.branches === branch);
      for (const play of plays) placementSwing.push(spread(scoped.filter((r) => r.playbook === play)));
      for (const order of orders) playSwing.push(spread(scoped.filter((r) => r.order === order)));
    }
  }
  assert.ok(mean(placementSwing) > mean(playSwing) * 1.5,
    `placement swings ${mean(placementSwing).toFixed(2)} extractions against ${mean(playSwing).toFixed(2)} for the play; placement must be the deciding lever`);
});

test("the best placement is not the same answer everywhere", () => {
  // If one order were optimal under every pressure and play, placement would be a
  // solved lookup and the mission pressures would only be changing difficulty.
  const best = new Set();
  for (const [, byPressure] of Object.entries(groupBy(rows, (row) => row.pressure))) {
    for (const [, group] of Object.entries(groupBy(byPressure, (row) => row.playbook))) {
      // Many orders tie on win rate inside a single matchup, so break ties on average
      // extractions to pick a meaningful representative rather than an arbitrary one.
      const ranked = Object.entries(groupBy(group, (row) => row.order))
        .map(([order, forOrder]) => ({
          order,
          win: rate(forOrder),
          extracted: forOrder.reduce((sum, row) => sum + row.extracted, 0) / forOrder.length,
        }))
        .sort((a, b) => b.win - a.win || b.extracted - a.extracted);
      best.add(ranked[0].order);
    }
  }
  assert.ok(best.size >= 3, `only ${best.size} distinct best placements across 9 matchups; placement is a lookup`);
});

test("combo chains help without being mandatory", () => {
  // AGENTS.md: "Route responsibility is the primary placement decision; rendezvous
  // combo chains are secondary bonuses." So more chains should help, and zero chains
  // must still be able to win.
  const byCombos = groupBy(rows, (row) => row.combos);
  const none = byCombos["0"] ?? [];
  assert.ok(none.length > 0, "expected some plans with no combo chain at all");
  assert.ok(none.some((row) => row.won), "a plan with no combo chain can never win, so chains are mandatory");
  const counts = Object.keys(byCombos).map(Number).sort((a, b) => a - b);
  assert.ok(rate(byCombos[String(counts.at(-1))]) > rate(byCombos[String(counts[0])]),
    "more combo chains does not improve the win rate, so chains carry no value");
});

test("authored branch responses materially change the outcome", () => {
  // AGENTS.md: "Executing an authored breakpoint costs nothing... making foresight the
  // core skill." Foresight is only a skill if the choices diverge.
  const byBranches = Object.values(groupBy(rows, (row) => row.branches)).map(rate);
  assert.ok(Math.max(...byBranches) - Math.min(...byBranches) > 0.05,
    "every branch combination wins at the same rate, so authored responses do not matter");
});

test("every total-army play can reach a winning outcome", () => {
  // A play that cannot win under any placement or pressure is a trap option, not an
  // alternative approach. This asserts bare viability; the parity check is below.
  for (const [play, group] of Object.entries(groupBy(rows, (row) => row.playbook))) {
    assert.ok(group.some((row) => row.won), `total-army play "${play}" cannot win under any configuration`);
  }
});

test("every disclosed mission pressure is winnable", () => {
  // The player chooses a pressure before deployment. One that no combination of
  // placements, plays or authored responses can beat is a dead end they are invited to
  // walk into. `early-relief` was exactly that until 14 Aug 2026 — 0 wins in 1,440
  // configurations — because it moved the wave 45s earlier AND slowed two of the three
  // plays. See docs/balance.md.
  for (const [pressure, group] of Object.entries(groupBy(rows, (row) => row.pressure))) {
    assert.ok(group.some((row) => row.won), `mission pressure "${pressure}" cannot be won in any of its ${group.length} configurations`);
  }
});

test("no total-army play is a trap or a dominant answer", () => {
  // Viability alone is not enough: a play that wins seventeen times less often than
  // another is a punishment for curiosity, not an alternative approach.
  const byPlay = Object.entries(groupBy(rows, (row) => row.playbook))
    .map(([play, group]) => ({ play, win: group.filter((r) => r.won).length / group.length }));
  const best = Math.max(...byPlay.map((p) => p.win));
  const worst = Math.min(...byPlay.map((p) => p.win));
  assert.ok(worst > 0.05, `a total-army play is close to unplayable: ${JSON.stringify(byPlay)}`);
  assert.ok(best / worst < 3, `total-army plays are too far apart to be real alternatives: ${JSON.stringify(byPlay)}`);
});

test("every total-army play can still reach a decisive result", () => {
  // Being able to scrape the bare requirement is not parity. Each play must be able to
  // exceed it, or it can never produce a decisive victory.
  for (const [play, group] of Object.entries(groupBy(rows, (row) => row.playbook))) {
    assert.ok(Math.max(...group.map((r) => r.extracted)) > operation.requiredExtraction,
      `total-army play "${play}" can never exceed the ${operation.requiredExtraction}-extraction requirement`);
  }
});

// Refits change a formation's capabilities, and capabilities now decide how well it
// answers a stop's demands — so the loadout is a full dimension of the decision space,
// not a cosmetic choice. 32 loadouts x 4,320 placements = 138,240 outcomes, ~3s.
const deepRows = sweepRefitSpace(operation);

test("the refit dimension is swept in full", () => {
  assert.equal(deepRows.length, rows.length * 32, "32 loadouts across the five fielded formations");
});

test("no refit loadout is dominant or hopeless", () => {
  // AGENTS.md: refits "must make legible tradeoffs... Do not reduce refits to generic
  // stat bonuses, rank packages, recommend a build, or identify an optimal package".
  // A loadout that wins everywhere would be the build; one that never wins would be a
  // trap installed before the player ever places a formation.
  const byRefit = Object.entries(groupBy(deepRows, (row) => row.refits))
    .map(([loadout, group]) => ({ loadout, win: rate(group) }));
  assert.equal(byRefit.length, 32);
  assert.deepEqual(byRefit.filter((entry) => entry.win === 1).map((e) => e.loadout), []);
  assert.deepEqual(byRefit.filter((entry) => entry.win === 0).map((e) => e.loadout), []);
  const best = Math.max(...byRefit.map((e) => e.win));
  const worst = Math.min(...byRefit.map((e) => e.win));
  assert.ok(best / worst < 2.5, `loadout win rates span ${(best / worst).toFixed(1)}x; the pre-deployment choice is outweighing the mission`);
});

test("the loadout does not outweigh placement", () => {
  // Refits are installed before deployment. If they mattered more than where the
  // player puts each formation, the mission would be decided before it started.
  const spread = (group) => Math.max(...group.map((r) => r.extracted)) - Math.min(...group.map((r) => r.extracted));
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const branch = deepRows[0].branches;
  const scoped = deepRows.filter((r) => r.branches === branch && r.pressure === "fractured-transit" && r.playbook === "trapline");
  const loadouts = [...new Set(scoped.map((r) => r.refits))];
  const orders = [...new Set(scoped.map((r) => r.order))];
  const placementSwing = loadouts.map((lo) => spread(scoped.filter((r) => r.refits === lo)));
  const refitSwing = orders.map((o) => spread(scoped.filter((r) => r.order === o)));
  assert.ok(mean(placementSwing) > mean(refitSwing) * 1.5,
    `placement swings ${mean(placementSwing).toFixed(2)} against ${mean(refitSwing).toFixed(2)} for the loadout`);
});

test("every fight stays winnable across every loadout", () => {
  const dead = [];
  for (const [pressure, byPressure] of Object.entries(groupBy(deepRows, (row) => row.pressure))) {
    for (const [play, group] of Object.entries(groupBy(byPressure, (row) => row.playbook))) {
      if (!group.some((row) => row.won)) dead.push(`${pressure} x ${play}`);
    }
  }
  assert.deepEqual(dead, [], `matchups no loadout or placement can win: ${dead.join(", ")}`);
});

test("the debrief can explain what placement cost", () => {
  // Placement is the deciding lever, so a loss has to be explicable afterwards. The
  // resolution must carry, per stop, which demands went unanswered and the seconds
  // conceded — otherwise the player loses time to an invisible number.
  const formations = resolveFormations(defaultRefits());
  const playbook = playbookForOperation(PLAYBOOKS[0], operation);
  const condition = missionPressureFor("fractured-transit", operation.id);
  const order = ["hauler", "railjack", "furnace", "breaker", "harpoon"];
  const assignments = Object.fromEntries(playbook.roles.map((role, i) => [role.id, order[i]]));
  const sequence = evaluateTacticalSequence(playbook, assignments, formations);
  const readiness = calculatePlacementReadiness(playbook, assignments, sequence.handoffs, condition, formations);
  const summary = summarizePlacementReadiness(readiness);

  assert.equal(summary.placements.length, 5);
  for (const placement of summary.placements) {
    assert.ok(Array.isArray(placement.unansweredDemands), "each stop must report which demands went unanswered");
    assert.equal(typeof placement.taskDelay, "number", "each stop must report what it cost");
    assert.equal(placement.unansweredDemands.length + placement.matchedCapabilities.length, placement.demands.length);
  }
  // A deliberately mismatched plan must concede real, attributable time.
  assert.ok(summary.delay > 0, "a mismatched plan conceded no time, so the debrief has nothing to explain");
  assert.equal(summary.delay, summary.placements.reduce((sum, p) => sum + p.taskDelay, 0),
    "the total must be the sum of the per-stop costs, or the debrief will not add up");
});

// The roster is larger than the number of action stops, so the player's first decision
// is which formations to field at all. These guard that decision being real.

test("no list of five is dominant or dead", () => {
  // A list that won everywhere would be the answer and end army building; one that never
  // won would be a trap the player commits to before the mission starts.
  const byList = Object.entries(groupBy(listRows, (row) => row.list))
    .map(([list, group]) => ({ list, win: rate(group) }));
  assert.equal(byList.length, 126);
  assert.deepEqual(byList.filter((entry) => entry.win === 1).map((e) => e.list), []);
  assert.deepEqual(byList.filter((entry) => entry.win === 0).map((e) => e.list), []);
});

test("choosing the list matters as much as ordering it", () => {
  // If ordering dwarfed selection, the roster would be decoration and the game would be
  // back to marching order. These should be comparable, with neither trivial.
  const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const branch = listRows[0].branches;
  const listSwing = [];
  const orderSwing = [];
  for (const [, byPressure] of Object.entries(groupBy(listRows.filter((r) => r.branches === branch), (r) => r.pressure))) {
    for (const [, group] of Object.entries(groupBy(byPressure, (r) => r.playbook))) {
      const byList = Object.values(groupBy(group, (r) => r.list));
      const bestEach = byList.map((v) => Math.max(...v.map((x) => x.extracted)));
      listSwing.push(Math.max(...bestEach) - Math.min(...bestEach));
      for (const v of byList) orderSwing.push(Math.max(...v.map((x) => x.extracted)) - Math.min(...v.map((x) => x.extracted)));
    }
  }
  assert.ok(mean(listSwing) > 1, `the list barely changes the outcome (${mean(listSwing).toFixed(2)} extractions)`);
  assert.ok(mean(listSwing) > mean(orderSwing) * 0.6,
    `list ${mean(listSwing).toFixed(2)} vs order ${mean(orderSwing).toFixed(2)}; selection must be a peer decision to ordering`);
});

test("every formation earns a place in some list", () => {
  // AGENTS.md forbids identifying an optimal answer, and a formation nobody should ever
  // field is the same failure in reverse: a unit that exists only to be left behind.
  const roster = [...new Set(listRows.flatMap((row) => row.list.split("+")))];
  assert.equal(roster.length, 9);
  const weak = [];
  for (const id of roster) {
    const containing = listRows.filter((row) => row.list.includes(id));
    const bestList = Math.max(...Object.values(groupBy(containing, (row) => row.list)).map(rate));
    if (bestList < 0.1) weak.push(`${id} (best list ${(100 * bestList).toFixed(1)}%)`);
  }
  assert.deepEqual(weak, [], `formations that never justify a slot: ${weak.join(", ")}`);
});

test("the best list depends on the situation", () => {
  // One list optimal everywhere would make army building a solved lookup, exactly the
  // failure the placement puzzle already had before pressures reached the outcome.
  const best = new Set();
  for (const [, byPressure] of Object.entries(groupBy(listRows, (row) => row.pressure))) {
    for (const [, group] of Object.entries(groupBy(byPressure, (row) => row.playbook))) {
      const ranked = Object.entries(groupBy(group, (row) => row.list))
        .map(([list, forList]) => ({
          list,
          win: rate(forList),
          extracted: forList.reduce((sum, row) => sum + row.extracted, 0) / forList.length,
        }))
        .sort((a, b) => b.win - a.win || b.extracted - a.extracted);
      best.add(ranked[0].list);
    }
  }
  assert.ok(best.size >= 3, `only ${best.size} distinct best lists across 9 matchups; army building is a lookup`);
});
