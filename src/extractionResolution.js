const boundedInteger = (value, fallback = 0, maximum = 99) => {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.min(maximum, Math.max(0, Math.floor(numeric)))
    : fallback;
};

export const resolveExtractionOutcome = ({
  deployedCount = 0,
  requiredExtraction = 3,
  protectedCount = 0,
  overrun = 0,
  recoveryLoss = 0,
} = {}) => {
  const deployed = boundedInteger(deployedCount, 0, 20);
  const required = boundedInteger(requiredExtraction, 3, 20);
  const protectedCapacity = boundedInteger(protectedCount, 0, 20);
  const overrunSeconds = boundedInteger(overrun, 0, 3600);
  const directRecoveryLoss = boundedInteger(recoveryLoss, 0, 20);
  const reserveCapacity = Math.min(deployed, required + 1 + protectedCapacity);
  const waveLoss = Math.floor(overrunSeconds / 30);
  const extractedCount = Math.max(0, reserveCapacity - waveLoss - directRecoveryLoss);
  const outcome = extractedCount >= required
    ? "victory"
    : extractedCount > 0
      ? "defeat"
      : "annihilation";

  return {
    deployedCount: deployed,
    requiredExtraction: required,
    reserveCapacity,
    protectedCapacity,
    overrun: overrunSeconds,
    waveLoss,
    recoveryLoss: directRecoveryLoss,
    extractedCount,
    outcome,
  };
};
