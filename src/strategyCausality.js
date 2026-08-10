const safeNumber = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

const plural = (count, singular, pluralForm = `${singular}s`) => count === 1 ? singular : pluralForm;

export const strategyCausalityFor = ({ profile = {}, requiredExtraction = 0 } = {}) => {
  const readiness = profile.readiness ?? {};
  const staffedCount = safeNumber(readiness.staffedCount);
  const alignedCount = Math.min(staffedCount, safeNumber(readiness.alignedCount));
  const improvisedCount = Math.min(staffedCount, safeNumber(readiness.improvisedCount));
  const readinessDelay = safeNumber(readiness.delay);
  const handoffs = Array.isArray(profile.effects) ? profile.effects : [];
  const clashes = Array.isArray(profile.enemyClashes) ? profile.enemyClashes : [];
  const disruptedCount = clashes.filter((clash) => clash?.disrupted).length;
  const doctrine = profile.doctrine ?? {};
  const extractedCount = safeNumber(profile.extractedCount);
  const extractionTarget = safeNumber(requiredExtraction);
  const overrun = safeNumber(profile.overrun);
  const timeSaved = safeNumber(profile.timeSaved);
  const recoveryLost = safeNumber(profile.reinforcementLoss) + safeNumber(profile.enemyRecoveryLoss);

  const handoffNames = handoffs
    .map((effect) => effect?.maneuver?.name ?? effect?.name)
    .filter(Boolean);
  const enemyResults = clashes
    .map((clash) => `${clash?.label ?? "Enemy order"}: ${clash?.resolution?.label ?? (clash?.disrupted ? "DISRUPTED" : "LANDED")}`)
    .slice(0, 3);

  return [
    {
      id: "assignments", step: "01", label: "RESPONSIBILITY FIT",
      value: `${alignedCount}/${staffedCount} ALIGNED`,
      tone: improvisedCount > 0 ? "cost" : staffedCount > 0 ? "support" : "neutral",
      detail: improvisedCount > 0
        ? `${improvisedCount} improvised ${plural(improvisedCount, "assignment")} added ${readinessDelay} seconds after mitigation.`
        : staffedCount > 0 ? "Every staffed formation matched its assigned task." : "No staffed formations were recorded.",
    },
    {
      id: "handoffs", step: "02", label: "COMBO CHAINS",
      value: `${handoffs.length} ${plural(handoffs.length, "CHAIN", "CHAINS")} FORMED`,
      tone: handoffs.length > 0 ? "support" : "cost",
      detail: handoffNames.length > 0 ? handoffNames.join(" / ") : "No neighboring trigger-response chain activated.",
    },
    {
      id: "doctrine", step: "03", label: "PLAYBOOK DOCTRINE",
      value: doctrine.name ?? "NO DOCTRINE",
      tone: doctrine.triggered ? "support" : "cost",
      detail: doctrine.result ?? "No playbook modifier resolved.",
    },
    {
      id: "opposition", step: "04", label: "ENEMY PLAN",
      value: `${disruptedCount}/${clashes.length} ORDERS BROKEN`,
      tone: disruptedCount > 0 ? (disruptedCount === clashes.length ? "support" : "mixed") : "cost",
      detail: enemyResults.length > 0 ? enemyResults.join(" / ") : "No enemy order collisions were recorded.",
    },
    {
      id: "extraction", step: "05", label: "MISSION RESULT",
      value: `${extractedCount}/${extractionTarget} EXTRACTED`,
      tone: extractedCount >= extractionTarget && extractionTarget > 0 ? "support" : "cost",
      detail: overrun > 0
        ? `${overrun} seconds late; ${recoveryLost} recovery capacity lost.`
        : timeSaved > 0 ? `${timeSaved} seconds ahead of the enemy wave.` : "Extraction met the enemy wave at the gantry.",
    },
  ];
};
