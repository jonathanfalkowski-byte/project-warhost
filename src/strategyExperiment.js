const freezeTemplate = (template) => Object.freeze({
  ...template,
  assignments: Object.freeze({ ...template.assignments }),
  branches: Object.freeze({ ...template.branches }),
});

const template = (playbookId, posture, run, assignments, branches, priority, sacrifice) => freezeTemplate({
  id: `${playbookId}-${posture}`,
  playbookId,
  posture,
  run,
  name: posture.toUpperCase(),
  conditionId: "clear",
  assignments,
  branches,
  priority,
  sacrifice,
  hypothesis: `${priority} ${sacrifice}`,
  signal: "A competent editable starting plan; experienced commanders can find stronger interactions.",
});

export const STRATEGY_TRIALS = Object.freeze([
  template(
    "trapline",
    "aggressive",
    "A",
    { pull: "breaker", burn: "furnace", break: "harpoon", anchor: "railjack", recover: "hauler" },
    { beta: "tempo", rescue: "clock" },
    "Pushes the sabotage column forward immediately.",
    "Sacrifices handoff depth and recovery protection.",
  ),
  template(
    "trapline",
    "balanced",
    "B",
    { pull: "harpoon", burn: "railjack", break: "breaker", anchor: "furnace", recover: "hauler" },
    { beta: "tempo", rescue: "recover" },
    "Maintains useful coverage across every stage of the rolling operation.",
    "Sacrifices maximum speed and the strongest possible chain.",
  ),
  template(
    "trapline",
    "cautious",
    "C",
    { pull: "breaker", burn: "railjack", break: "harpoon", anchor: "furnace", recover: "hauler" },
    { beta: "protect", rescue: "recover" },
    "Protects secured ground and preserves the withdrawal route.",
    "Sacrifices mission tempo and can concede the extraction clock.",
  ),
  template(
    "spear",
    "aggressive",
    "A",
    { screen: "furnace", point: "harpoon", punch: "breaker", suppress: "railjack", recover: "hauler" },
    { beta: "tempo", rescue: "clock" },
    "Drives the advance guard and assault element directly at the decisive objective.",
    "Sacrifices a dedicated opening screen for speed.",
  ),
  template(
    "spear",
    "balanced",
    "B",
    { screen: "railjack", point: "harpoon", punch: "breaker", suppress: "furnace", recover: "hauler" },
    { beta: "tempo", rescue: "recover" },
    "Supports the central strike with screening, suppression, and recovery.",
    "Sacrifices specialization at either extreme.",
  ),
  template(
    "spear",
    "cautious",
    "C",
    { screen: "railjack", point: "breaker", punch: "harpoon", suppress: "furnace", recover: "hauler" },
    { beta: "protect", rescue: "recover" },
    "Builds the assault behind armor and keeps the rear element protected.",
    "Sacrifices a clean breakthrough sequence and arrives later.",
  ),
  template(
    "pressure",
    "aggressive",
    "A",
    { alpha: "harpoon", beta: "breaker", deny: "furnace", reactor: "railjack", recover: "hauler" },
    { beta: "tempo", rescue: "clock" },
    "Commits hard to both control objectives before converging.",
    "Sacrifices a purpose-built reactor element for simultaneous pressure.",
  ),
  template(
    "pressure",
    "balanced",
    "B",
    { alpha: "railjack", beta: "breaker", deny: "furnace", reactor: "harpoon", recover: "hauler" },
    { beta: "tempo", rescue: "recover" },
    "Keeps both axes functional while retaining a credible convergence force.",
    "Sacrifices the fastest route on either individual axis.",
  ),
  template(
    "pressure",
    "cautious",
    "C",
    { alpha: "railjack", beta: "harpoon", deny: "furnace", reactor: "breaker", recover: "hauler" },
    { beta: "protect", rescue: "recover" },
    "Secures one axis with armor before reinforcing the second and converging.",
    "Sacrifices simultaneous objective tempo.",
  ),
]);

export const strategyTrialsForPlaybook = (playbookId) => typeof playbookId === "string"
  ? STRATEGY_TRIALS.filter((trial) => trial.playbookId === playbookId)
  : [];

export const strategyTrialFor = (trialId) => STRATEGY_TRIALS.find((trial) => trial.id === trialId) ?? null;

export const strategyTrialResult = (trial, extractedCount) => {
  if (!trial) return null;
  const numeric = Number(extractedCount);
  const extracted = Number.isFinite(numeric) ? Math.min(20, Math.max(0, Math.floor(numeric))) : 0;
  return { extracted, label: "EDITABLE TEMPLATE" };
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
  return { prediction, actual, accurate: prediction.id === actual.id };
};
