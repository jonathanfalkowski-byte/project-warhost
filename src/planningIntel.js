const RESOLVED_PHASES = new Set(["battle", "complete"]);

export const planningResultRevealed = ({ phase, handoffIndex, staffExerciseIndex }) => {
  if (RESOLVED_PHASES.has(phase)) return true;
  if (phase !== "plan" && phase !== "drill") return false;
  return Number.isInteger(handoffIndex)
    && handoffIndex >= 0
    && Number.isInteger(staffExerciseIndex)
    && handoffIndex === staffExerciseIndex;
};

export const claimStaffExercise = ({ currentIndex, requestedIndex, handoffCount }) => {
  if (currentIndex !== null) return currentIndex;
  if (!Number.isInteger(requestedIndex) || !Number.isInteger(handoffCount)) return null;
  if (requestedIndex < 0 || requestedIndex >= handoffCount) return null;
  return requestedIndex;
};
