const safeNumber = (value) => Number.isFinite(value) ? Math.max(0, value) : 0;

const plural = (count, singular, pluralForm = `${singular}s`) => count === 1 ? singular : pluralForm;

export const strategyOutcomeStoryFor = ({ profile = {}, requiredExtraction = 0 } = {}) => {
  const readiness = profile.readiness ?? {};
  const staffedCount = safeNumber(readiness.staffedCount);
  const placements = Array.isArray(readiness.placements) ? readiness.placements : [];
  const combos = Array.isArray(profile.effects) ? profile.effects : [];
  const clashes = Array.isArray(profile.enemyClashes) ? profile.enemyClashes : [];
  const disruptedCount = clashes.filter((clash) => clash?.disrupted).length;
  const landedOrders = clashes.filter((clash) => !clash?.disrupted).slice(0, 3);
  const extractedCount = safeNumber(profile.extractedCount);
  const extractionTarget = safeNumber(requiredExtraction);
  const overrun = safeNumber(profile.overrun);
  const timeSaved = safeNumber(profile.timeSaved);
  const recoveryLost = safeNumber(profile.reinforcementLoss) + safeNumber(profile.enemyRecoveryLoss);

  const setupDetail = staffedCount > 0
    ? `${placements.slice(0, 3).map((placement) => `${placement.formationName ?? "A formation"} received ${placement.roleLabel ?? "an authored route order"}`).join("; ")}${placements.length > 3 ? `; ${placements.length - 3} more orders staffed` : ""}. Secondary bonus: ${combos.length} ${plural(combos.length, "combo chain")} formed.`
    : "No formation assignments were recorded.";
  const enemyDetail = landedOrders.length > 0
    ? landedOrders.map((clash) => {
      const missing = Array.isArray(clash?.resolution?.missingCapabilities) ? clash.resolution.missingCapabilities : [];
      return `${clash?.label ?? "Enemy order"} landed${missing.length > 0 ? ` because its assigned response lacked ${missing.join(" / ")}` : " against the assigned response"}`;
    }).join("; ")
    : clashes.length > 0 ? "Every enemy order was stopped by the assigned response." : "No enemy-order evidence was recorded.";
  const resultDetail = overrun > 0
    ? `${recoveryLost} recovery capacity was lost after the enemy wave arrived first.`
    : timeSaved > 0 ? `The force reached extraction ${timeSaved} seconds before the enemy wave.` : "The force and enemy wave reached extraction together.";

  return [
    {
      id: "choice",
      label: "1 · YOUR ROUTE ASSIGNMENTS",
      value: `${staffedCount} ROUTE ORDERS STAFFED`,
      detail: setupDetail,
      tone: staffedCount > 0 ? "support" : "cost",
    },
    {
      id: "collision",
      label: "2 · WHAT THE ENEMY EXPLOITED",
      value: `${disruptedCount}/${clashes.length} ORDERS STOPPED`,
      detail: enemyDetail,
      tone: disruptedCount === clashes.length && clashes.length > 0 ? "support" : disruptedCount > 0 ? "mixed" : "cost",
    },
    {
      id: "cost",
      label: "3 · MISSION COST",
      value: overrun > 0 ? `${overrun} SEC LATE → ${extractedCount}/${extractionTarget} EXTRACTED` : `${timeSaved} SEC EARLY → ${extractedCount}/${extractionTarget} EXTRACTED`,
      detail: resultDetail,
      tone: extractedCount >= extractionTarget && extractionTarget > 0 ? "support" : "cost",
    },
  ];
};

export const strategyCausalityFor = ({ profile = {}, requiredExtraction = 0 } = {}) => {
  const readiness = profile.readiness ?? {};
  const staffedCount = safeNumber(readiness.staffedCount);
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
      id: "assignments", step: "01", label: "ROUTE ORDERS",
      value: `${staffedCount} RESPONSIBILITIES STAFFED`,
      tone: staffedCount > 0 ? "support" : "neutral",
      detail: staffedCount > 0
        ? "Every assigned formation executed its authored order. There is no generic route-fit bonus or mismatch penalty."
        : "No staffed formations were recorded.",
    },
    {
      id: "handoffs", step: "02", label: "SECONDARY COMBO BONUS",
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
