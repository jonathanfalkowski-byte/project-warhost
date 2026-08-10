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
