// Turn staging: the battle advances in discrete moves, not as a continuous crawl.
//
// Playtest, 15 Aug 2026: "i am moving so slow in some spots... it should stage 1 we are
// all here, stage 2 boom we are here and so on." The underlying operation is resolved on
// a continuous timeline, and formations were drawn by interpolating that timeline
// directly, so a long quiet stretch between two authored milestones rendered as several
// seconds of everything inching forward. Nothing about the army's turn structure was
// visible in its movement.
//
// This quantises the *drawing* only. Every formation covers the ground between two
// mission milestones in a short burst at the start of the interval, then holds in place
// while the interval plays out — which is also when enemy orders land on it. The
// resolution pipeline never reads a drawn position, so nothing here can change an
// outcome; the timeline it is derived from is untouched.

// How long an advance takes, in game seconds. Fixed rather than a share of the interval:
// the authored milestones are unevenly spaced, so a proportional move made the long gaps
// (reactor to extraction) crawl for their whole first third while short gaps snapped —
// exactly the "moving so slow in some spots" the staging is meant to remove. Every turn
// now advances at the same brisk pace and then holds.
export const STAGE_MOVE_SECONDS = 18;
// Never spend more than this share of a short interval moving, so a tight pair of
// milestones still leaves a readable pause between the arrival and the next order.
export const STAGE_MOVE_MAX_SHARE = 0.5;

const finiteAscending = (values) => [...new Set(values.filter((value) => Number.isFinite(value) && value >= 0))]
  .sort((left, right) => left - right);

// The mission's own milestones are the turn boundaries — the times the authored plan
// already treats as "the army has arrived somewhere". Inventing a separate cadence would
// desynchronise the movement from the events being narrated over it.
export const battleStageTimesFor = ({ actionTimes = [], extractionAt = 0 } = {}) => {
  const times = finiteAscending([0, ...(Array.isArray(actionTimes) ? actionTimes : []), extractionAt]);
  return times.length >= 2 ? times : [0, Math.max(1, extractionAt || 1)];
};

export const battleStageIndexFor = ({ battleTime, stageTimes } = {}) => {
  if (!Array.isArray(stageTimes) || stageTimes.length === 0 || !Number.isFinite(battleTime)) return 0;
  let index = 0;
  while (index < stageTimes.length - 1 && stageTimes[index + 1] <= battleTime) index += 1;
  return index;
};

// Maps a continuous battle time onto the staged time used for drawing: races to the end
// of the current interval, then holds there. Monotonic, so nothing ever appears to
// reverse, and it agrees with the real timeline at every stage boundary.
export const stagedBattleTimeFor = ({ battleTime, stageTimes, moveSeconds = STAGE_MOVE_SECONDS } = {}) => {
  if (!Array.isArray(stageTimes) || stageTimes.length < 2 || !Number.isFinite(battleTime)) return battleTime;
  const first = stageTimes[0];
  const last = stageTimes.at(-1);
  if (battleTime <= first) return first;
  if (battleTime >= last) return last;

  const index = battleStageIndexFor({ battleTime, stageTimes });
  const from = stageTimes[index];
  const to = stageTimes[index + 1];
  const span = to - from;
  if (span <= 0) return to;

  const requested = Math.max(1, Number(moveSeconds) || STAGE_MOVE_SECONDS);
  const moveSpan = Math.max(1, Math.min(requested, span * STAGE_MOVE_MAX_SHARE));
  const progress = Math.min(1, (battleTime - from) / moveSpan);
  return from + span * progress;
};

// Where a formation that never cleared extraction stops.
//
// Fate times land in the short window between `extractionAt` and `completeAt`, which is
// 96-99% of the way along a route that terminates at the gantry by construction. So a
// formation reported CUT OFF was drawn arriving at extraction and then relabelled, which
// is why "the district was lost" read as wrong to a player watching every unit reach the
// end. A formation cut off from extraction did not get to extraction: it halts at the
// last action stop it actually reached.
export const haltedStageTimeFor = ({ stageTimes, fateAt, extractionAt } = {}) => {
  if (!Array.isArray(stageTimes) || stageTimes.length === 0) return 0;
  const stops = stageTimes.filter((time) => !Number.isFinite(extractionAt) || time < extractionAt);
  if (stops.length === 0) return stageTimes[0];
  const reached = Number.isFinite(fateAt) ? stops.filter((time) => time <= fateAt) : stops;
  return reached.length > 0 ? reached.at(-1) : stops[0];
};

// A formation is on the board during execution only if it was committed to an action
// stop. The rest of the roster stayed in reserve and was previously still drawn, parked
// in a row along the top of the map doing nothing for the whole battle.
export const drawnDuringExecution = ({ phase, assignedToStop } = {}) => (
  phase === "battle" || phase === "complete" ? Boolean(assignedToStop) : true
);
