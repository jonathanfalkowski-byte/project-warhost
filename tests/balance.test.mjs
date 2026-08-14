import assert from "node:assert/strict";
import test from "node:test";

import { OPERATIONS } from "../src/operationData.js";
import { sweepOperation } from "../scripts/balance-sweep.mjs";

// The outcome pipeline is deterministic, so these resolve the entire decision space
// rather than sampling it: 120 formation permutations x 3 total-army plays x 3
// mission pressures x 4 authored branch combinations. About a second.
//
// These guard the design claims in AGENTS.md. They are intentionally loose — they
// assert the shape of the design, not tuned numbers, so ordinary balance work does not
// turn them red. Run `npm run analyse:balance` for the detailed picture, and see
// docs/balance.md for the findings that produced these guards.

const operation = OPERATIONS[0];
const rows = sweepOperation(operation);
const rate = (subset) => subset.filter((row) => row.won).length / subset.length;
const groupBy = (subset, key) => subset.reduce((acc, row) => { (acc[key(row)] ||= []).push(row); return acc; }, {});

test("the sweep resolves the whole decision space", () => {
  assert.equal(rows.length, 4320);
});

test("resolution is deterministic", () => {
  // Everything below depends on this. A stray Math.random or Date.now would make the
  // sweep meaningless and the game unfair to reason about.
  assert.deepEqual(sweepOperation(operation), rows);
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
