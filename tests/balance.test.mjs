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

test("no formation order is universally dominant or universally hopeless", () => {
  // AGENTS.md: "never identify an optimal chain for the player". An order that always
  // won would become the answer; one that never won would be a hidden trap.
  const byOrder = Object.entries(groupBy(rows, (row) => row.order)).map(([order, group]) => ({ order, win: rate(group) }));
  assert.deepEqual(byOrder.filter((entry) => entry.win === 1).map((entry) => entry.order), []);
  assert.deepEqual(byOrder.filter((entry) => entry.win === 0).map((entry) => entry.order), []);
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
