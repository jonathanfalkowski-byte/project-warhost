import test from "node:test";
import assert from "node:assert/strict";

import { effectivenessSummary, formationEffectivenessFor } from "../src/formationEffectiveness.js";
import { ENEMY_RESPONSE_WINDOWS } from "../src/enemyPlanData.js";
import { defaultRefits, resolveFormations } from "../src/formationData.js";
import { missionPressureFor } from "../src/missionPressure.js";
import { OPERATIONS, breakpointsFor } from "../src/operationData.js";
import { PLAYBOOKS, playbookForOperation } from "../src/playbookData.js";
import {
  calculateOperationProfile,
  calculatePlacementReadiness,
  calculateRefitProtocols,
  evaluateTacticalSequence,
} from "../src/operationResolution.js";

const operation = OPERATIONS[0];
const playbook = playbookForOperation(PLAYBOOKS[0], operation);
const formations = resolveFormations(defaultRefits());
const condition = missionPressureFor(operation.conditionId, operation.id);
const branches = Object.fromEntries(breakpointsFor(operation).map((breakpoint) => [breakpoint.id, breakpoint.options[0].id]));

const runWith = (formationIds) => {
  const assignments = Object.fromEntries(
    playbook.roles.map((role, index) => [role.id, formationIds[index] ?? null]).filter(([, id]) => id),
  );
  const sequence = evaluateTacticalSequence(playbook, assignments, formations);
  const readiness = calculatePlacementReadiness(playbook, assignments, sequence.handoffs, condition, formations);
  const protocols = calculateRefitProtocols(playbook, assignments, formations, operation);
  const profile = calculateOperationProfile(sequence.handoffs, branches, readiness, condition, operation, protocols, playbook);
  return formationEffectivenessFor({ readiness, clashes: profile.enemyClashes, handoffs: sequence.handoffs, playbook });
};

const FULL_LIST = ["harpoon", "furnace", "breaker", "railjack", "hauler"];

test("every staffed stop gets a score and a grade", () => {
  const rows = runWith(FULL_LIST);
  assert.equal(rows.length, playbook.roles.length);
  rows.forEach((row, index) => {
    assert.equal(row.stopNumber, index + 1);
    assert.equal(row.staffed, true);
    assert.ok(row.effectiveness >= 0 && row.effectiveness <= 100, `stop ${row.stopNumber} scored ${row.effectiveness}`);
    assert.ok(["DECISIVE", "EFFECTIVE", "PARTIAL", "INEFFECTIVE"].includes(row.grade));
    assert.ok(row.worked.length > 0);
    assert.ok(row.change.length > 0);
  });
});

test("an empty stop is reported as unstaffed rather than scored as zero-by-accident", () => {
  const rows = runWith(["harpoon"]);
  assert.equal(rows[0].staffed, true);
  assert.equal(rows[4].staffed, false);
  assert.equal(rows[4].grade, "UNSTAFFED");
  assert.equal(rows[4].effectiveness, 0);
  assert.match(rows[4].change, /Staff/);
});

test("the score is the authored 40/20/40 weighting of its three components", () => {
  // Recomputing the headline from the parts it reports keeps the row honest: a player
  // who adds up the three boxes must land on the number next to them.
  for (const row of runWith(FULL_LIST)) {
    const expected = Math.round(0.4 * row.fit.percent + 0.2 * row.combo.percent + 0.4 * row.counter.percent);
    assert.equal(row.effectiveness, expected, `stop ${row.stopNumber} headline disagrees with its components`);
  }
});

test("counter credit comes from the orders actually aimed at that stop", () => {
  const rows = runWith(FULL_LIST);
  rows.forEach((row, stopIndex) => {
    const expected = ENEMY_RESPONSE_WINDOWS
      .map((window, stageIndex) => (window.includes(stopIndex) ? `E${stageIndex + 1}` : null))
      .filter(Boolean);
    assert.deepEqual(row.counter.orders.map((order) => order.number), expected);
  });
});

test("holding the counter capability is what raises the counter component", () => {
  // breaker carries BREACH and SHOCK, which is exactly E2's counter; railjack carries
  // neither. Both sit in E2's response window, so the difference is the capability.
  const withBreaker = runWith(["harpoon", "furnace", "breaker", "railjack", "hauler"])[2];
  const withoutIt = runWith(["harpoon", "furnace", "railjack", "railjack", "hauler"])[2];
  assert.equal(withBreaker.counter.percent, 100);
  assert.equal(withoutIt.counter.percent, 0);
  assert.ok(withBreaker.effectiveness > withoutIt.effectiveness);
});

test("combo credit is scored against the windows a stop actually has", () => {
  const rows = runWith(FULL_LIST);
  // The lead and recovery elements sit at the ends of the plan and have one window each;
  // scoring them out of two would penalise them for their position.
  assert.equal(rows[0].combo.windows, 1);
  assert.equal(rows.at(-1).combo.windows, 1);
  for (const row of rows.slice(1, -1)) assert.equal(row.combo.windows, 2);
  for (const row of rows) assert.ok(row.combo.percent <= 100);
});

test("combos are never worth more than fit or counter", () => {
  // The bonus layer must not be able to carry a badly placed list.
  const perfectComboOnly = 0.2 * 100;
  assert.ok(perfectComboOnly < 0.4 * 100, "a maxed combo score outweighs a maxed fit score");
});

test("the change line names the actual gap, not a generic prompt", () => {
  const rows = runWith(FULL_LIST);
  for (const row of rows) {
    for (const missed of row.fit.unanswered) {
      assert.ok(row.change.includes(missed), `stop ${row.stopNumber} omits its unanswered demand ${missed}`);
    }
  }
});

test("seconds conceded match what the resolution pipeline charged", () => {
  const assignments = Object.fromEntries(playbook.roles.map((role, index) => [role.id, FULL_LIST[index]]));
  const sequence = evaluateTacticalSequence(playbook, assignments, formations);
  const readiness = calculatePlacementReadiness(playbook, assignments, sequence.handoffs, condition, formations);
  const rows = formationEffectivenessFor({
    readiness,
    clashes: calculateOperationProfile(sequence.handoffs, branches, readiness, condition, operation, {}, playbook).enemyClashes,
    handoffs: sequence.handoffs,
    playbook,
  });
  playbook.roles.forEach((role, index) => {
    assert.equal(rows[index].secondsConceded, readiness[role.id].taskDelay);
  });
});

test("a better-matched list scores higher than a worse one", () => {
  // The readout is only useful if it moves in the same direction as the decision.
  const matched = effectivenessSummary(runWith(["harpoon", "furnace", "breaker", "bastion", "hauler"]));
  const scrambled = effectivenessSummary(runWith(["hauler", "hauler", "hauler", "hauler", "hauler"]));
  assert.ok(matched.average > scrambled.average, `${matched.average} should beat ${scrambled.average}`);
});

test("the summary reports the real best and worst rows", () => {
  const rows = runWith(FULL_LIST);
  const summary = effectivenessSummary(rows);
  const scores = rows.filter((row) => row.staffed).map((row) => row.effectiveness);
  assert.equal(summary.best.effectiveness, Math.max(...scores));
  assert.equal(summary.worst.effectiveness, Math.min(...scores));
  assert.equal(summary.average, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length));
});

test("every playbook and operation produces a readable row set", () => {
  for (const item of OPERATIONS) {
    for (const base of PLAYBOOKS) {
      const book = playbookForOperation(base, item);
      const pressure = missionPressureFor(item.conditionId, item.id);
      const assignments = Object.fromEntries(book.roles.map((role, index) => [role.id, FULL_LIST[index]]));
      const sequence = evaluateTacticalSequence(book, assignments, formations);
      const readiness = calculatePlacementReadiness(book, assignments, sequence.handoffs, pressure, formations);
      const profile = calculateOperationProfile(
        sequence.handoffs,
        Object.fromEntries(breakpointsFor(item).map((breakpoint) => [breakpoint.id, breakpoint.options[0].id])),
        readiness, pressure, item, {}, book,
      );
      const rows = formationEffectivenessFor({ readiness, clashes: profile.enemyClashes, handoffs: sequence.handoffs, playbook: book });
      assert.equal(rows.length, book.roles.length, `${item.id}/${base.id}`);
      for (const row of rows) assert.ok(Number.isFinite(row.effectiveness));
    }
  }
});

test("malformed input returns nothing rather than a fabricated score", () => {
  assert.deepEqual(formationEffectivenessFor({}), []);
  assert.deepEqual(formationEffectivenessFor({ playbook: null, readiness: {} }), []);
  const rows = formationEffectivenessFor({ readiness: {}, clashes: [], handoffs: [], playbook });
  assert.equal(rows.length, playbook.roles.length);
  for (const row of rows) assert.equal(row.staffed, false);
});
