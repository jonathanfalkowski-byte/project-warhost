import test from "node:test";
import assert from "node:assert/strict";

import {
  STAGE_MOVE_SECONDS,
  battleStageIndexFor,
  battleStageTimesFor,
  drawnDuringExecution,
  haltedStageTimeFor,
  stagedBattleTimeFor,
} from "../src/battleStaging.js";

const STAGES = [0, 90, 180, 270, 360, 450];
const staged = (battleTime, stageTimes = STAGES) => stagedBattleTimeFor({ battleTime, stageTimes });

test("turn boundaries come from the mission's own milestones", () => {
  const stageTimes = battleStageTimesFor({ actionTimes: [90, 180, 270, 360], extractionAt: 450 });
  assert.deepEqual(stageTimes, [0, 90, 180, 270, 360, 450]);
  // Duplicates and stray values must not create phantom turns.
  assert.deepEqual(
    battleStageTimesFor({ actionTimes: [90, 90, Number.NaN, -5, 180], extractionAt: 180 }),
    [0, 90, 180],
  );
});

test("an advance is a short burst followed by a hold", () => {
  // The regression this exists for: movement used to be spread evenly across the whole
  // interval, so a long gap between milestones rendered as everything inching forward.
  assert.equal(staged(0), 0);
  assert.equal(staged(STAGE_MOVE_SECONDS), 90, "the advance has not completed by the end of its move window");
  // ...and then holds for the rest of the interval rather than continuing to creep.
  for (const time of [STAGE_MOVE_SECONDS + 1, 45, 60, 89]) {
    assert.equal(staged(time), 90, `t=${time} kept moving after arriving`);
  }
});

test("every turn advances at the same pace regardless of interval length", () => {
  // Uneven authored milestones previously made some turns crawl and others snap.
  const uneven = [0, 30, 400];
  const shortTurn = stagedBattleTimeFor({ battleTime: 15, stageTimes: uneven });
  const longTurn = stagedBattleTimeFor({ battleTime: 30 + STAGE_MOVE_SECONDS, stageTimes: uneven });
  assert.equal(shortTurn, 30, "a short interval must still complete its advance");
  assert.equal(longTurn, 400, "a long interval must not stretch its advance to fit");
});

test("the staged clock agrees with the real timeline at every boundary", () => {
  for (const boundary of STAGES) assert.equal(staged(boundary), boundary);
  assert.equal(staged(-40), 0);
  assert.equal(staged(9999), 450);
});

test("staged time never runs backwards", () => {
  let previous = -1;
  for (let time = 0; time <= 500; time += 1) {
    const value = staged(time);
    assert.ok(value >= previous, `staged time reversed at t=${time}`);
    previous = value;
  }
});

test("a formation cut off from extraction halts at the last stop it reached", () => {
  // The reported bug: fate times land between extractionAt and completeAt, which is
  // 96-99% along a route that ends at the gantry, so every lost formation was drawn
  // arriving and then relabelled. "i got all units to the end" was an accurate reading
  // of what the map showed.
  const halted = haltedStageTimeFor({ stageTimes: STAGES, fateAt: 452, extractionAt: 450 });
  assert.ok(halted < 450, "a cut-off formation must not be drawn reaching extraction");
  assert.equal(halted, 360);

  // It halts at the stop it actually got to, not always the last one.
  assert.equal(haltedStageTimeFor({ stageTimes: STAGES, fateAt: 200, extractionAt: 450 }), 180);
  assert.equal(haltedStageTimeFor({ stageTimes: STAGES, fateAt: 5, extractionAt: 450 }), 0);
});

test("reserves leave the board once the operation is under way", () => {
  // They were drawn in a row along the top of the map for the whole battle, doing
  // nothing — reported as things "buzzing around at the top making no sense".
  assert.equal(drawnDuringExecution({ phase: "battle", assignedToStop: false }), false);
  assert.equal(drawnDuringExecution({ phase: "complete", assignedToStop: false }), false);
  assert.equal(drawnDuringExecution({ phase: "battle", assignedToStop: true }), true);
  // Planning still shows the whole roster, which is where the list decision is made.
  assert.equal(drawnDuringExecution({ phase: "plan", assignedToStop: false }), true);
  assert.equal(drawnDuringExecution({ phase: "drill", assignedToStop: false }), true);
});

test("stage index tracks the turn actually in progress", () => {
  assert.equal(battleStageIndexFor({ battleTime: 0, stageTimes: STAGES }), 0);
  assert.equal(battleStageIndexFor({ battleTime: 89, stageTimes: STAGES }), 0);
  assert.equal(battleStageIndexFor({ battleTime: 90, stageTimes: STAGES }), 1);
  assert.equal(battleStageIndexFor({ battleTime: 9999, stageTimes: STAGES }), STAGES.length - 1);
});

test("malformed input falls back to the raw clock rather than freezing the board", () => {
  assert.equal(stagedBattleTimeFor({ battleTime: 42, stageTimes: [] }), 42);
  assert.equal(stagedBattleTimeFor({ battleTime: 42, stageTimes: [10] }), 42);
  assert.equal(stagedBattleTimeFor({ battleTime: Number.NaN, stageTimes: STAGES }), Number.NaN);
  assert.equal(haltedStageTimeFor({}), 0);
  assert.equal(battleStageIndexFor({}), 0);
});
