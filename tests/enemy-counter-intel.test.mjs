import test from "node:test";
import assert from "node:assert/strict";

import {
  counterBoardSummary,
  disclosureFor,
  enemyCounterBoardFor,
} from "../src/enemyCounterIntel.js";
import { ENEMY_RESPONSE_WINDOWS, enemyPlanFor } from "../src/enemyPlanData.js";
import { defaultRefits, resolveFormations } from "../src/formationData.js";
import { missionPressureFor } from "../src/missionPressure.js";
import { OPERATIONS } from "../src/operationData.js";
import { PLAYBOOKS, playbookForOperation } from "../src/playbookData.js";
import { calculateEnemyClashes, calculatePlacementReadiness, evaluateTacticalSequence } from "../src/operationResolution.js";

const operation = OPERATIONS[0];
const playbook = playbookForOperation(PLAYBOOKS[0], operation);
const formations = resolveFormations(defaultRefits());
const condition = missionPressureFor(operation.conditionId, operation.id);

const boardWith = (formationIds) => enemyCounterBoardFor({
  operation,
  playbook,
  assignments: Object.fromEntries(playbook.roles.map((role, index) => [role.id, formationIds[index] ?? null]).filter(([, id]) => id)),
  formations,
  condition,
});

test("the board names the enemy objective, not only its next three moves", () => {
  const board = boardWith([]);
  assert.equal(board.objective, operation.matchup.enemyObjective);
  assert.equal(board.intent, enemyPlanFor(operation).intent);
});

test("each intelligence tier withholds a different thing", () => {
  const board = boardWith([]);
  const [known, uncertain, unknown] = board.orders;

  // KNOWN is a plan you can rehearse against.
  assert.equal(known.intelligence, "KNOWN");
  assert.ok(known.clock !== null, "a confirmed order discloses its clock");
  assert.ok(known.cost, "a confirmed order discloses its cost");
  assert.deepEqual(known.counters, enemyPlanFor(operation).stages[0].counterCapabilities);

  // UNCERTAIN tells you what breaks it, but not when it lands or what it costs.
  assert.equal(uncertain.intelligence, "UNCERTAIN");
  assert.equal(uncertain.clock, null, "a partial read must not disclose timing");
  assert.equal(uncertain.cost, null, "a partial read must not disclose cost");
  assert.ok(uncertain.counters.length > 0, "a partial read still names the counter");
  assert.ok(uncertain.label !== "UNIDENTIFIED ORDER");

  // UNKNOWN is the order a Command Seal exists to answer.
  assert.equal(unknown.intelligence, "UNKNOWN");
  assert.equal(unknown.counters, null, "a dark order must not disclose its counter");
  assert.equal(unknown.clock, null);
  assert.equal(unknown.cost, null);
  assert.equal(unknown.label, "UNIDENTIFIED ORDER");
  assert.equal(unknown.enemyName, null, "a dark order must not name the enemy formation");
  assert.match(unknown.guidance, /Command Seal/);
});

test("a dark order stays dark no matter how the player places", () => {
  // The whole roster in every stop still cannot scout E3. Otherwise the seal is
  // decorative again.
  for (const list of [["harpoon", "furnace", "breaker", "railjack", "hauler"], ["skimmer", "carriage", "command", "bastion", "harpoon"]]) {
    const dark = boardWith(list).orders[2];
    assert.equal(dark.counters, null);
    assert.equal(dark.coverage, "dark");
  }
});

test("coverage tracks what the player actually placed", () => {
  const empty = boardWith([]).orders[0];
  assert.equal(empty.coverage, "unstaffed");
  assert.match(empty.guidance, /No formation is in position/);

  // harpoon carries CONTROL, furnace carries DENIAL — together they are E1's counter.
  const answered = boardWith(["harpoon", "furnace"]).orders[0];
  assert.equal(answered.coverage, "answered");
  assert.deepEqual(answered.missing, []);
  assert.match(answered.guidance, /can break this order/);

  // harpoon alone covers CONTROL but not DENIAL.
  const partial = boardWith(["harpoon"]).orders[0];
  assert.equal(partial.coverage, "partial");
  assert.deepEqual(partial.missing, ["DENIAL"]);
  assert.match(partial.guidance, /still unanswered/);

  // hauler carries neither.
  const open = boardWith(["hauler", "hauler"]).orders[0];
  assert.equal(open.coverage, "open");
  assert.match(open.guidance, /Counter coverage remains open/);
});

test("the board advises about the same stops the resolution pipeline actually scores", () => {
  // If these drifted apart the board would tell the player to fix a stop that has no
  // bearing on the order it is advising about — worse than showing nothing.
  const assignments = Object.fromEntries(playbook.roles.map((role, index) => [role.id, formations[index].id]));
  const sequence = evaluateTacticalSequence(playbook, assignments, formations);
  const readiness = calculatePlacementReadiness(playbook, assignments, sequence.handoffs, condition, formations);
  const clashes = calculateEnemyClashes(operation, sequence.handoffs, [], readiness);
  const board = enemyCounterBoardFor({ operation, playbook, assignments, formations, condition });

  board.orders.forEach((order, stageIndex) => {
    const scoredIds = clashes[stageIndex].resolution.actorIds;
    const advisedIds = order.responders.map((responder) => responder.formationId).filter(Boolean);
    assert.deepEqual(advisedIds, scoredIds, `order ${order.number} advises about the stops it is scored against`);
    assert.deepEqual(order.responders.map((responder) => responder.stopIndex), ENEMY_RESPONSE_WINDOWS[stageIndex]);
  });
});

test("the board never leaks a resolution", () => {
  const board = boardWith(["harpoon", "furnace", "breaker", "railjack", "hauler"]);
  const serialized = JSON.stringify(board);
  for (const leak of ["playerScore", "enemyScore", "margin", "resolution", "DECISIVE", "OVERRUN", "disrupted", "will land as authored"]) {
    assert.equal(serialized.includes(leak), false, `counter-board must not carry ${leak}`);
  }
});

test("the summary counts only what was scouted", () => {
  assert.match(counterBoardSummary(boardWith([])), /^0 OF 2 SCOUTED ORDERS ANSWERED · 1 DARK$/);
  assert.match(
    counterBoardSummary(boardWith(["harpoon", "furnace", "breaker", "railjack", "hauler"])),
    /^2 OF 2 SCOUTED ORDERS ANSWERED · 1 DARK$/,
  );
});

test("every operation's plan is readable by the board", () => {
  for (const item of OPERATIONS) {
    for (const base of PLAYBOOKS) {
      const board = enemyCounterBoardFor({
        operation: item,
        playbook: playbookForOperation(base, item),
        assignments: {},
        formations,
        condition: missionPressureFor(item.conditionId, item.id),
      });
      assert.equal(board.orders.length, enemyPlanFor(item).stages.length);
      assert.ok(board.objective, `${item.id} discloses an enemy objective`);
      for (const order of board.orders) assert.ok(order.guidance.length > 0);
    }
  }
});

test("malformed input fails closed rather than inventing intelligence", () => {
  assert.deepEqual(enemyCounterBoardFor({}).orders, []);
  assert.deepEqual(enemyCounterBoardFor({ operation, playbook: null }).orders, []);
  assert.equal(disclosureFor("NOT A TIER").tier, "UNKNOWN");
  assert.equal(disclosureFor(undefined).counters, false);
});
