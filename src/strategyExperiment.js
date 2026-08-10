const freezeTrial = (trial) => Object.freeze({
  ...trial,
  assignments: Object.freeze({ ...trial.assignments }),
  branches: Object.freeze({ ...trial.branches }),
  expectedExtraction: Object.freeze({ ...trial.expectedExtraction }),
});

export const STRATEGY_TRIALS = Object.freeze([
  freezeTrial({
    id: "disjointed",
    run: "A",
    name: "DISJOINTED FORCE",
    hypothesis: "Wrong formations in the right plan should collapse under enemy pressure.",
    playbookId: "trapline",
    conditionId: "clear",
    assignments: { pull: "hauler", burn: "breaker", break: "railjack", anchor: "furnace", recover: "harpoon" },
    branches: { beta: "tempo", rescue: "clock" },
    expectedExtraction: { min: 0, max: 1 },
    signal: "Look for improvised-task delay, enemy overruns, and campaign-threatening losses.",
  }),
  freezeTrial({
    id: "cautious",
    run: "B",
    name: "CAUTIOUS FORCE",
    hypothesis: "Correct responsibilities with slow protective orders should survive, but lose the mission clock.",
    playbookId: "trapline",
    conditionId: "clear",
    assignments: { pull: "harpoon", burn: "railjack", break: "breaker", anchor: "furnace", recover: "hauler" },
    branches: { beta: "protect", rescue: "recover" },
    expectedExtraction: { min: 2, max: 3 },
    signal: "Look for task alignment and protection, but fewer handoffs and a late extraction.",
  }),
  freezeTrial({
    id: "coordinated",
    run: "C",
    name: "COORDINATED FORCE",
    hypothesis: "Correct responsibilities and a complete handoff chain should break enemy orders and clear extraction.",
    playbookId: "trapline",
    conditionId: "clear",
    assignments: { pull: "harpoon", burn: "furnace", break: "breaker", anchor: "railjack", recover: "hauler" },
    branches: { beta: "tempo", rescue: "clock" },
    expectedExtraction: { min: 4, max: 5 },
    signal: "Look for four handoffs, broken enemy orders, and a successful extraction.",
  }),
]);

export const strategyTrialFor = (trialId) => STRATEGY_TRIALS.find((trial) => trial.id === trialId) ?? null;

export const strategyTrialResult = (trial, extractedCount) => {
  if (!trial) return null;
  const numeric = Number(extractedCount);
  const extracted = Number.isFinite(numeric) ? Math.min(20, Math.max(0, Math.floor(numeric))) : 0;
  const withinExpected = extracted >= trial.expectedExtraction.min && extracted <= trial.expectedExtraction.max;
  return {
    extracted,
    withinExpected,
    label: withinExpected ? "EXPECTED BAND" : "OUTSIDE EXPECTED BAND",
  };
};

export const BLIND_PREDICTIONS = Object.freeze([
  Object.freeze({ id: "victory", label: "VICTORY", detail: "Meet the mission objective and extraction requirement." }),
  Object.freeze({ id: "withdrawal", label: "WITHDRAWAL", detail: "Complete the primary objective but miss extraction." }),
  Object.freeze({ id: "collapse", label: "COLLAPSE", detail: "No formation clears extraction." }),
]);

const boundedCount = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(20, Math.max(0, Math.floor(numeric))) : fallback;
};

export const blindOutcomeFor = ({ extractedCount = 0, requiredExtraction = 3 } = {}) => {
  const extracted = boundedCount(extractedCount);
  const required = Math.max(1, boundedCount(requiredExtraction, 3));
  return extracted >= required ? "victory" : extracted > 0 ? "withdrawal" : "collapse";
};

export const blindPredictionResult = ({ predictionId, extractedCount, requiredExtraction } = {}) => {
  const prediction = BLIND_PREDICTIONS.find((item) => item.id === predictionId) ?? null;
  if (!prediction) return null;
  const outcomeId = blindOutcomeFor({ extractedCount, requiredExtraction });
  const actual = BLIND_PREDICTIONS.find((item) => item.id === outcomeId);
  return {
    prediction,
    actual,
    accurate: prediction.id === actual.id,
  };
};
