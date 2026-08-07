import { battlefieldConsequencesAt } from "./battleConsequences.js";

const CAMPAIGN_STATES = Object.freeze({
  damaged: Object.freeze({ label: "DAMAGED", severity: 1 }),
  missing: Object.freeze({ label: "MISSING", severity: 2 }),
});

const copyConditions = (conditions = {}) => Object.fromEntries(
  Object.entries(conditions)
    .filter(([formationId, condition]) => typeof formationId === "string" && CAMPAIGN_STATES[condition?.state])
    .map(([formationId, condition]) => [formationId, { ...condition, ...CAMPAIGN_STATES[condition.state] }]),
);

export const integrityLossFor = ({ operationWon = false, extractedCount = 0 } = {}) => {
  if (operationWon) return 0;
  const safeExtractedCount = Math.max(0, Math.floor(Number(extractedCount) || 0));
  return safeExtractedCount > 0 ? 1 : 2;
};

export const campaignOutcomeFor = ({ hasNextOperation = false, operationWon = false, integrityRemaining = 0 } = {}) => {
  const safeIntegrity = Math.max(0, Math.floor(Number(integrityRemaining) || 0));
  if (safeIntegrity <= 0) return "destroyed";
  if (hasNextOperation) return "continue";
  return operationWon ? "terminal" : "destroyed";
};

export const seriousConditionsFromConsequences = ({ clashes = [], battleTime = 0 } = {}) => {
  const consequences = battlefieldConsequencesAt({ clashes, battleTime });
  const conditions = {};
  let missingAssigned = false;

  [...consequences.active]
    .sort((left, right) => right.severity - left.severity || left.formationId.localeCompare(right.formationId))
    .forEach((consequence) => {
      if (consequence.state !== "damaged" && consequence.state !== "cut-off") return;
      const becomesMissing = consequence.state === "cut-off" && !missingAssigned;
      const state = becomesMissing ? "missing" : "damaged";
      if (becomesMissing) missingAssigned = true;
      conditions[consequence.formationId] = {
        state,
        ...CAMPAIGN_STATES[state],
        cause: consequence.cause,
      };
    });

  return conditions;
};

export const mergeCampaignConditions = (existing = {}, incoming = {}) => {
  const merged = copyConditions(existing);
  Object.entries(copyConditions(incoming)).forEach(([formationId, condition]) => {
    const current = merged[formationId];
    if (!current || condition.severity >= current.severity) merged[formationId] = condition;
  });
  return merged;
};

export const ensureCostlyContinuationConditions = (conditions = {}, formationIds = []) => {
  const validIds = [...new Set(formationIds.filter((formationId) => typeof formationId === "string" && formationId.length > 0))];
  const validIdSet = new Set(validIds);
  const nextConditions = copyConditions(Object.fromEntries(
    Object.entries(conditions).filter(([formationId]) => validIdSet.has(formationId)),
  ));
  if (validIds.length === 0) return nextConditions;

  if (!Object.values(nextConditions).some((condition) => condition.state === "missing")) {
    const promotedId = [...validIds].reverse().find((formationId) => nextConditions[formationId]?.state === "damaged")
      ?? validIds.at(-1);
    nextConditions[promotedId] = {
      state: "missing",
      ...CAMPAIGN_STATES.missing,
      cause: "COSTLY WITHDRAWAL",
    };
  }

  if (!Object.values(nextConditions).some((condition) => condition.state === "damaged")) {
    const damagedId = [...validIds].reverse().find((formationId) => nextConditions[formationId]?.state !== "missing");
    if (damagedId) {
      nextConditions[damagedId] = {
        state: "damaged",
        ...CAMPAIGN_STATES.damaged,
        cause: "COSTLY WITHDRAWAL",
      };
    }
  }

  return nextConditions;
};

export const applyCampaignConditions = (formations = [], conditions = {}) => formations.map((formation) => {
  const condition = CAMPAIGN_STATES[conditions[formation.id]?.state]
    ? { ...conditions[formation.id], ...CAMPAIGN_STATES[conditions[formation.id].state] }
    : null;
  if (!condition) return { ...formation, available: true, campaignCondition: null, disabledCapability: null };
  if (condition.state === "missing") {
    return { ...formation, available: false, campaignCondition: condition, disabledCapability: null, capabilities: [] };
  }
  const disabledCapability = formation.capabilities.at(-1) ?? null;
  return {
    ...formation,
    available: true,
    campaignCondition: condition,
    disabledCapability,
    capabilities: disabledCapability ? formation.capabilities.slice(0, -1) : formation.capabilities,
  };
});

export const applyWorkshopAction = ({ refits = {}, conditions = {}, action = null, catalog = [] } = {}) => {
  const nextRefits = { ...refits };
  const nextConditions = copyConditions(conditions);
  if (!action || !["repair", "recover", "refit"].includes(action.type)) {
    return { refits: nextRefits, conditions: nextConditions, applied: false };
  }

  const formation = catalog.find((item) => item.id === action.formationId);
  if (!formation) return { refits: nextRefits, conditions: nextConditions, applied: false };

  if (action.type === "repair" && nextConditions[formation.id]?.state === "damaged") {
    delete nextConditions[formation.id];
    return { refits: nextRefits, conditions: nextConditions, applied: true };
  }
  if (action.type === "recover" && nextConditions[formation.id]?.state === "missing") {
    delete nextConditions[formation.id];
    return { refits: nextRefits, conditions: nextConditions, applied: true };
  }
  if (action.type === "refit" && nextConditions[formation.id]?.state !== "missing") {
    const refit = formation.refits?.find((item) => item.id === action.refitId);
    if (refit && nextRefits[formation.id] !== refit.id) {
      nextRefits[formation.id] = refit.id;
      return { refits: nextRefits, conditions: nextConditions, applied: true };
    }
  }

  return { refits: nextRefits, conditions: nextConditions, applied: false };
};
